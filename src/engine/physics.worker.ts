import { SimulationCore } from './SimulationCore';
import { SkillSystem } from './SkillSystem';
import { NudgeSystem } from './NudgeSystem';
import { getPresetMeta } from './MapPresets';
import type { WallStyle } from './MapBuilder';

// ──────────────────────────────────────────────────────────────────────────
// physics.worker.ts: SimulationCore 의 I/O 래퍼.
//   - 물리/효과/승패 로직은 전부 SimulationCore 가 담당한다.
//   - 워커는 ① 메시지 수신(INIT/SHUFFLE/START/STOP/NUDGE)
//            ② 스텝 결과(core.events)를 self.postMessage 로 중계
//            ③ 렌더 프레임 브로드캐스트(Float32Array)
//            ④ 스킬 발동 인터벌 + 슬로모션(dtMultiplier) 타이밍 만 관리한다.
// ──────────────────────────────────────────────────────────────────────────

let core: SimulationCore | null = null;
let isRunning = false;
let stepInterval: any = null;
let skillInterval: any = null;

let positionsBuffer: Float32Array;
let isSkillEnabled = true;
let dtMultiplier = 1.0; // 슬로모션 배율(스킬 연출/SET_TIME_SCALE 제어). 모듈 스코프로 공유.

function broadcastFrame() {
  if (!core || core.activeChips.length === 0) return;
  const chips = core.activeChips;
  for (let i = 0; i < chips.length; i++) {
    const t = chips[i].translation();
    const v = chips[i].linvel();
    positionsBuffer[i * 5 + 0] = i;
    positionsBuffer[i * 5 + 1] = t.x;
    positionsBuffer[i * 5 + 2] = t.y;
    positionsBuffer[i * 5 + 3] = v.x;
    positionsBuffer[i * 5 + 4] = v.y;
  }
  const frameData = new Float32Array(positionsBuffer);
  (self.postMessage as any)({ type: 'FRAME', payload: frameData }, [frameData.buffer]);
}

// core.events 를 그대로 메인 스레드로 중계
function flushEvents() {
  if (!core) return;
  for (const ev of core.events) {
    self.postMessage(ev.payload !== undefined ? { type: ev.type, payload: ev.payload } : { type: ev.type });
  }
}

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    await SimulationCore.ensureRapier();

    if (skillInterval) clearInterval(skillInterval);
    if (stepInterval) clearInterval(stepInterval);

    const {
      width, height, customMapData, selectedMapPreset, gimmickDensity,
      survivors, targetCount, mode, customRank, isSkillEnabled: isSkill,
    } = payload;

    const presetMeta = selectedMapPreset && selectedMapPreset !== 'random' ? getPresetMeta(selectedMapPreset) : null;
    const worldHeight = presetMeta ? presetMeta.worldHeight : height;
    const wallStyle: WallStyle = presetMeta ? presetMeta.wallStyle : 'zigzag';
    const presetData = presetMeta ? presetMeta.items : null;
    const mapItems = customMapData && customMapData.length > 0 ? customMapData : presetData;

    isSkillEnabled = isSkill ?? true;

    if (!core) core = new SimulationCore();
    core.init({
      width, height, worldHeight, wallStyle,
      mapItems, gimmickDensity,
      survivors, targetCount, mode, customRank,
    });

    positionsBuffer = new Float32Array(core.activeChips.length * 5);

    self.postMessage({ type: 'INIT_DONE', payload: { activeChipsCount: core.activeChips.length, mapData: core.mapData } });
    broadcastFrame();

  } else if (type === 'SHUFFLE') {
    if (!core || isRunning) return;
    core.shuffle(payload.width);
    broadcastFrame();

  } else if (type === 'START') {
    if (!core) return;
    isRunning = true;
    dtMultiplier = 1.0;

    if (skillInterval) clearInterval(skillInterval);
    if (isSkillEnabled) {
      skillInterval = setInterval(() => {
        if (!core || core.activeChips.length === 0) return;
        const aliveChips = core.activeChips.filter((c) => {
          const d = c.userData as any;
          return d && d.type === 'chip';
        });
        if (aliveChips.length === 0) return;
        const randomChip = aliveChips[Math.floor(Math.random() * aliveChips.length)];
        const chipData = randomChip.userData as any;

        const skills: any[] = ['tank', 'booster'];
        const randomSkill = skills[Math.floor(Math.random() * skills.length)];

        self.postMessage({ type: 'SKILL_FIRED', payload: { chipId: chipData.id, skill: randomSkill } });
        dtMultiplier = 0.15;
        SkillSystem.triggerSkill(core.world!, chipData.id, randomSkill);

        setTimeout(() => { dtMultiplier = 1.0; }, 1500);
      }, 8000);
    }

    stepInterval = setInterval(() => {
      if (!core) return;
      core.step(dtMultiplier);
      flushEvents();
      broadcastFrame();
    }, 1000 / 60);

  } else if (type === 'NUDGE') {
    if (core && core.world) {
      NudgeSystem.applyNudge(core.world, payload.force || 150);
    }
  } else if (type === 'SET_TIME_SCALE') {
    dtMultiplier = payload.scale;
  } else if (type === 'STOP') {
    isRunning = false;
    if (stepInterval) clearInterval(stepInterval);
    if (skillInterval) clearInterval(skillInterval);
    if (core) {
      core.free();
      core = null;
    }
  }
};
