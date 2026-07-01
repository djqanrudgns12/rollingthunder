/**
 * 에디터 ↔ 게임 렌더 정합성(WYSIWYG) 회귀 검증
 * ───────────────────────────────────────────────────────────────────────────
 * 각 프리셋을 실제 SimulationCore 로 빌드하여 게임 렌더 입력(core.mapData)을 얻고,
 * 에디터 렌더 입력(외벽 computeWallSegments + 저작 아이템)과 위치로 매칭하여
 * "회전 도(degree) 값이 정확히 일치"하는지 확인한다.
 *
 * 이 스크립트가 통과하면: 에디터가 그리는 각 기물의 각도 = 게임에서 실제 생성되는 각도.
 *
 * 실행:  npx tsx scripts/verifyLayoutParity.ts
 */
import { SimulationCore } from '../src/engine/SimulationCore';
import { MapPresets } from '../src/engine/MapPresets';
import { computeWallSegments } from '../src/engine/wallGeometry';
import { itemRotationDeg } from '../src/lib/render/rotation';

const WIDTH = 800;
const POS_TOL = 1.5;   // 위치 매칭 허용 오차(px)
const ROT_TOL = 0.05;  // 회전 허용 오차(도)

const norm360 = (d: number) => ((d % 360) + 360) % 360;
const angDiff = (a: number, b: number) => {
  const d = Math.abs(norm360(a) - norm360(b));
  return Math.min(d, 360 - d);
};

async function main() {
  await (SimulationCore as any).ensureRapier?.();
  const survivors = [{ id: 'c0', name: 'P0', color: '#fff' }];
  let totalFail = 0;

  for (const [key, meta] of Object.entries(MapPresets)) {
    const core = new SimulationCore();
    core.init({
      width: WIDTH, height: meta.worldHeight, worldHeight: meta.worldHeight,
      wallStyle: meta.wallStyle as any, mapItems: meta.items, gimmickDensity: 50,
      isOfficial: true, // 밀도 우회 → mapData == 저작 아이템 + 외벽 (편집본 정확 재현)
      survivors, targetCount: 1, mode: 'speed', customRank: 1,
    } as any);

    const mapData: any[] = core.mapData;

    // 에디터 렌더 입력: 외벽(단일 소스) + 저작 아이템
    const editorItems = [
      ...computeWallSegments(WIDTH, meta.worldHeight, 100, meta.wallStyle as any),
      ...meta.items,
    ].filter((it: any) => it.type !== 'startline' && it.type !== 'endline');

    const used = new Set<number>();
    let matched = 0, rotOK = 0, fails = 0;

    for (const it of editorItems) {
      let best = -1, bestD = Infinity;
      for (let i = 0; i < mapData.length; i++) {
        if (used.has(i)) continue;
        const m = mapData[i];
        const d = Math.hypot(m.x - it.x, m.y - it.y);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (best < 0 || bestD > POS_TOL) continue;
      used.add(best);
      matched++;

      const editorDeg = itemRotationDeg(it);
      const gameDeg = mapData[best].rotation ?? 0;   // 이제 '도' 단위
      if (angDiff(editorDeg, gameDeg) <= ROT_TOL) {
        rotOK++;
      } else {
        fails++; totalFail++;
        if (fails <= 5) {
          console.log(`  ✗ ${key} ${it.type}@(${Math.round(it.x)},${Math.round(it.y)})  editor=${editorDeg.toFixed(2)}°  game=${gameDeg.toFixed(2)}°`);
        }
      }
    }

    const wallCount = computeWallSegments(WIDTH, meta.worldHeight, 100, meta.wallStyle as any).length;
    const gameWallCount = mapData.filter((m) => m.type === 'wall').length;
    const flag = fails === 0 ? '✓' : '✗';
    console.log(
      `${flag} ${key.padEnd(20)} matched ${matched}/${editorItems.length}  rot일치 ${rotOK}/${matched}  ` +
      `외벽(edit=${wallCount}, game=${gameWallCount})`
    );
  }

  console.log(totalFail === 0
    ? '\n✅ PARITY OK — 매칭된 모든 기물의 회전 도(°) 값이 에디터=게임 일치'
    : `\n❌ ${totalFail} 개 불일치`);
  process.exit(totalFail === 0 ? 0 : 1);
}

main();
