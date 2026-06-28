/**
 * 헤드리스 시뮬레이션 하네스
 * ───────────────────────────────────────────────────────────────────────────
 * 각 맵 프리셋을 SimulationCore 로 무헤드 다회 실행하여, 맵 설계 품질을
 * 정량 지표로 측정한다. 맵 재설계(Workstream D)의 측정→튜닝→재측정 루프에 사용.
 *
 * 실행:  npx tsx scripts/simulate.ts [races] [chips] [mapKey]
 *   races  맵당 반복 횟수 (기본 40)
 *   chips  레이스당 칩 수   (기본 12)
 *   mapKey 특정 맵만 측정   (생략 시 전체)
 *
 * 측정 지표:
 *   - 완주시간 median/p10/p90 (목표 창 45~70초)
 *   - 공정성: 스폰 x ↔ 최종 순위 |상관계수| (낮을수록 시작위치 무관 = 공정)
 *   - 엣지허깅: 레이스의 50% 이상을 측벽 45px 이내에서 보낸 칩 비율
 *   - 정체: GRAVITY_STORM 발동 수 / 타임아웃(미완주) 레이스 수
 *   - 박진감: 선두 교체(lead change) 평균 횟수
 *   - 기믹 적중률: 메인 기믹별 "상호작용 반경 진입 칩 비율" (죽은 기믹 탐지)
 */
import { SimulationCore } from '../src/engine/SimulationCore';
import { MapPresets, getPresetMeta } from '../src/engine/MapPresets';
import type { WallStyle } from '../src/engine/MapBuilder';

const WIDTH = 800;
const MAX_SECONDS = 240;            // 안전 상한(미완주 판정)
const MAX_FRAMES = MAX_SECONDS * 60;

// ── 시드 가능한 RNG (mulberry32) ──
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
}

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0) return NaN;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; syy += ys[i] * ys[i]; sxy += xs[i] * ys[i];
  }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  const d = Math.sqrt(vx * vy);
  return d === 0 ? 0 : cov / d;
}

function innerBounds(style: WallStyle): [number, number] {
  if (style === 'narrow') return [100, WIDTH - 100];
  if (style === 'wide') return [-50, WIDTH + 50];
  return [0, WIDTH];
}

// 메인 기믹(상호작용 반경) 정의
const MAIN_TYPES = new Set(['windmill', 'blackhole', 'whitehole', 'booster', 'portal', 'hole', 'piston']);
function interactionRadius(item: any): number {
  switch (item.type) {
    case 'windmill': return 62;
    case 'blackhole':
    case 'whitehole': return (item.radius || 150);
    case 'booster': return 40;
    case 'portal': return 35;
    case 'hole': return (item.radius || 30) + 12;
    case 'piston': return (item.w || 100) / 2 + 18;
    default: return 0;
  }
}

interface MapResult {
  key: string;
  name: string;
  worldHeight: number;
  finishTimes: number[];      // 초
  timedOutRaces: number;
  gravityStorms: number;
  leadChanges: number[];      // 레이스별
  spawnX: number[];           // 칩별
  rankNorm: number[];         // 칩별 정규화 순위 0..1 (완주순)
  gimmickHits: Map<string, { type: string; hit: number; total: number }>;
  edgeHuggers: number;        // 엣지허깅 칩 수
  totalChips: number;
  stuckSamples: { x: number; y: number }[];
  speedSum: number;           // 평균 칩 속도 누적(px/s)
  speedSamples: number;
}

function runMap(key: string, races: number, chips: number): MapResult {
  const meta = getPresetMeta(key)!;
  const [innerL, innerR] = innerBounds(meta.wallStyle);
  const edgeNear = 45;

  const res: MapResult = {
    key, name: meta.name, worldHeight: meta.worldHeight,
    finishTimes: [], timedOutRaces: 0, gravityStorms: 0, leadChanges: [],
    spawnX: [], rankNorm: [], gimmickHits: new Map(), edgeHuggers: 0, totalChips: 0,
    stuckSamples: [], speedSum: 0, speedSamples: 0,
  };

  // 메인 기믹 목록(인스턴스별) 준비
  const mainGimmicks = meta.items
    .filter((it: any) => MAIN_TYPES.has(it.type))
    .map((it: any, idx: number) => ({ id: it.id || `${it.type}_${idx}`, type: it.type, x: it.x, y: it.y, r: interactionRadius(it) }));
  for (const g of mainGimmicks) res.gimmickHits.set(g.id, { type: g.type, hit: 0, total: 0 });

  for (let r = 0; r < races; r++) {
    const rng = mulberry32(1000 + r * 7919 + key.length * 31);
    const survivors = Array.from({ length: chips }, (_, i) => ({ id: `c${i}`, name: `P${i}`, color: '#fff' }));

    const core = new SimulationCore();
    core.init({
      width: WIDTH, height: meta.worldHeight, worldHeight: meta.worldHeight,
      wallStyle: meta.wallStyle, mapItems: meta.items, gimmickDensity: 50,
      survivors, targetCount: chips, mode: 'speed', customRank: 1, rng,
    });

    // 스폰 x 기록
    const spawn: Record<string, number> = {};
    core.activeChips.forEach((c) => { spawn[(c.userData as any).id] = c.translation().x; });

    const finishFrame: Record<string, number> = {};
    const gimmickSeen: Record<string, Set<string>> = {}; // gimmickId -> set of chipIds seen
    for (const g of mainGimmicks) gimmickSeen[g.id] = new Set();
    const edgeFrames: Record<string, number> = {};
    let aliveFramesPerChip = 0;
    let leadId: string | null = null;
    let leadChanges = 0;

    while (core.frame < MAX_FRAMES && Object.keys(finishFrame).length < chips) {
      core.step(1.0);
      aliveFramesPerChip++;

      for (const ev of core.events) {
        if (ev.type === 'CHIP_FINISHED') {
          const id = ev.payload.survivor.id;
          if (finishFrame[id] === undefined) finishFrame[id] = core.frame;
        } else if (ev.type === 'GRAVITY_STORM') {
          res.gravityStorms++;
        } else if (ev.type === 'RANKINGS_UPDATE') {
          const top = ev.payload[0];
          if (top && top.id !== leadId) { if (leadId !== null) leadChanges++; leadId = top.id; }
        }
      }

      // 기믹 진입 + 엣지허깅 샘플링
      for (const c of core.activeChips) {
        const id = (c.userData as any).id;
        if (finishFrame[id] !== undefined) continue;
        const t = c.translation();
        const v = c.linvel();
        res.speedSum += Math.sqrt(v.x * v.x + v.y * v.y);
        res.speedSamples++;
        if (t.x - innerL < edgeNear || innerR - t.x < edgeNear) {
          edgeFrames[id] = (edgeFrames[id] || 0) + 1;
        }
        for (const g of mainGimmicks) {
          // piston/windmill 은 움직이지만 근사로 초기 좌표 사용
          const dx = t.x - g.x, dy = t.y - g.y;
          if (dx * dx + dy * dy < g.r * g.r) gimmickSeen[g.id].add(id);
        }
      }
    }

    if (Object.keys(finishFrame).length < chips) {
      res.timedOutRaces++;
      // 진단: 미완주 칩의 마지막 위치(어디서 막히는지)
      for (const c of core.activeChips) {
        const id = (c.userData as any).id;
        if (finishFrame[id] === undefined) {
          const t = c.translation();
          res.stuckSamples.push({ x: Math.round(t.x), y: Math.round(t.y) });
        }
      }
    }
    res.leadChanges.push(leadChanges);

    // 순위 집계: 완주 프레임 오름차순, 미완주는 뒤로
    const order = survivors.map((s) => s.id).sort((a, b) => {
      const fa = finishFrame[a] ?? Infinity, fb = finishFrame[b] ?? Infinity;
      return fa - fb;
    });
    order.forEach((id, idx) => {
      res.spawnX.push(spawn[id]);
      res.rankNorm.push(chips > 1 ? idx / (chips - 1) : 0);
      if (finishFrame[id] !== undefined) res.finishTimes.push(finishFrame[id] / 60);
      res.totalChips++;
      const ef = (edgeFrames[id] || 0) / Math.max(1, aliveFramesPerChip);
      if (ef > 0.5) res.edgeHuggers++;
    });

    for (const g of mainGimmicks) {
      const rec = res.gimmickHits.get(g.id)!;
      rec.hit += gimmickSeen[g.id].size;
      rec.total += chips;
    }

    core.free();
  }

  return res;
}

function fmt(n: number, d = 1): string {
  return Number.isFinite(n) ? n.toFixed(d) : '  -  ';
}

function report(res: MapResult) {
  const ft = [...res.finishTimes].sort((a, b) => a - b);
  const med = quantile(ft, 0.5), p10 = quantile(ft, 0.1), p90 = quantile(ft, 0.9);
  const fairness = Math.abs(pearson(res.spawnX, res.rankNorm));
  const edgePct = (res.edgeHuggers / res.totalChips) * 100;
  const avgLead = res.leadChanges.reduce((a, b) => a + b, 0) / res.leadChanges.length;

  // 기믹별 적중률
  const gimmickRates: { type: string; rate: number }[] = [];
  res.gimmickHits.forEach((rec) => gimmickRates.push({ type: rec.type, rate: rec.total ? rec.hit / rec.total : 0 }));
  const dead = gimmickRates.filter((g) => g.rate < 0.15);
  const avgGimmick = gimmickRates.length ? gimmickRates.reduce((a, b) => a + b.rate, 0) / gimmickRates.length : NaN;

  const flag = (ok: boolean) => (ok ? '✓' : '✗');
  const medOk = med >= 45 && med <= 70;

  console.log(`\n■ ${res.key}  (${res.name})  worldHeight=${res.worldHeight}`);
  const avgSpeed = res.speedSamples ? res.speedSum / res.speedSamples : NaN;
  console.log(`  완주시간   median ${fmt(med)}s  [p10 ${fmt(p10)} ~ p90 ${fmt(p90)}]   평균속도 ${fmt(avgSpeed, 0)}px/s`);
  console.log(`  공정성     |corr(spawnX, rank)| = ${fmt(fairness, 2)}  ${flag(fairness < 0.25)} (<0.25)`);
  console.log(`  엣지허깅   ${fmt(edgePct)}% 칩  ${flag(edgePct < 12)} (<12%)`);
  console.log(`  정체       gravityStorm ${res.gravityStorms}회 / 미완주레이스 ${res.timedOutRaces}  ${flag(res.gravityStorms === 0 && res.timedOutRaces === 0)}`);
  console.log(`  박진감     선두교체 평균 ${fmt(avgLead)}회  ${flag(avgLead >= 3)} (>=3)`);
  console.log(`  기믹적중   평균 ${fmt(avgGimmick * 100)}%  죽은기믹(${'<15%'}) ${dead.length}개 ${flag(dead.length === 0)}`);
  if (dead.length) {
    const byType: Record<string, number> = {};
    dead.forEach((d) => { byType[d.type] = (byType[d.type] || 0) + 1; });
    console.log(`             └ 죽은기믹 분포: ${Object.entries(byType).map(([t, n]) => `${t}×${n}`).join(', ')}`);
  }
  if (res.stuckSamples.length) {
    const s = res.stuckSamples.slice(0, 8).map((p) => `(${p.x},${p.y})`).join(' ');
    console.log(`  [진단] 막힌 칩 위치(샘플): ${s}`);
  }
}

async function main() {
  const races = Number(process.argv[2]) || 40;
  const chips = Number(process.argv[3]) || 12;
  const only = process.argv[4];

  await SimulationCore.ensureRapier();

  const keys = only ? [only] : Object.keys(MapPresets);
  console.log(`헤드리스 시뮬레이션:  races=${races}  chips=${chips}  maps=${keys.length}`);

  for (const key of keys) {
    if (!MapPresets[key]) { console.log(`(스킵: 알 수 없는 맵 ${key})`); continue; }
    const res = runMap(key, races, chips);
    report(res);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
