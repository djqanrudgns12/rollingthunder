import { SimulationCore } from './SimulationCore';
import { SkillSystem, type SkillType } from './SkillSystem';
import { NudgeSystem } from './NudgeSystem';
import { getPresetMeta } from './MapPresets';
import type { WallStyle } from './MapBuilder';

// ──────────────────────────────────────────────────────────────────────────
// physics.worker.ts: SimulationCore 의 I/O 래퍼.
//   - 물리/효과/승패 로직은 전부 SimulationCore 가 담당한다.
//   - 워커는 ① 메시지 수신(INIT/SHUFFLE/START/STOP/NUDGE)
//            ② 스텝 결과(core.events)를 self.postMessage 로 중계
//            ③ 렌더 프레임 브로드캐스트(Float32Array)
//            ④ 개별 마블 쿨타임 관리 + 스킬 자동 발동
// ──────────────────────────────────────────────────────────────────────────

let core: SimulationCore | null = null;
let isRunning = false;
let stepInterval: any = null;

let positionsBuffer: Float32Array;
let isSkillEnabled = true;
let dtMultiplier = 1.0; // 결승 슬로모션(SET_TIME_SCALE)만 사용. 스킬 발동으로 변경하지 않음.

// ── 개별 쿨타임 관리 ──
// 각 마블(칩)마다 독립적인 쿨타임을 가지며, 쿨타임이 차면 스킬이 자동 발동된다.
// 왜 이 구조인가: 기존에는 전체 인터벌 1개로 모든 마블을 돌리다보니 동시성이 없었고,
// 스킬 발동 시 슬로모션까지 걸려 게임 흐름이 끊어졌다. 이제 각자 독립적으로 돌아간다.
interface ChipCooldown {
  chipId: string;
  maxCooldown: number;     // 이 마블의 쿨타임 주기 (프레임 수, 예: 300~900)
  currentCooldown: number; // 현재까지 경과한 프레임 수 (0에서 시작하여 max까지 증가)
}
let chipCooldowns: ChipCooldown[] = [];

// 사용 가능한 스킬 종류 (워커에서 무작위 선택)
// PRD v2: 6종 스킬 전부 활성화. 순간이동과 자석은 강력하지만 드물게 등장
const AVAILABLE_SKILLS: SkillType[] = ['tank', 'booster', 'ghost', 'slime', 'magnet', 'teleport'];

// 쿨타임 범위: 최소 300프레임(5초)~최대 900프레임(15초) @60fps
const MIN_COOLDOWN_FRAMES = 300;
const MAX_COOLDOWN_FRAMES = 900;

// 무작위 쿨타임 생성 (각 마블마다 다른 주기를 갖도록)
function randomCooldown(): number {
  return MIN_COOLDOWN_FRAMES + Math.floor(Math.random() * (MAX_COOLDOWN_FRAMES - MIN_COOLDOWN_FRAMES));
}

// 쿨타임 진행도(0~1)를 메인 스레드로 전송하는 함수
// 왜 별도 이벤트인가: 프레임 데이터(Float32Array)는 위치/속도용이므로 별도 채널로 분리해야
// 메인 스레드에서 게이지 렌더링과 물리 렌더링을 독립적으로 처리할 수 있다.
let cooldownBroadcastCounter = 0;
function broadcastCooldowns() {
  // 매 프레임이 아닌 6프레임(~0.1초)마다 전송하여 성능 최적화
  cooldownBroadcastCounter++;
  if (cooldownBroadcastCounter < 6) return;
  cooldownBroadcastCounter = 0;

  const cooldownMap: Record<string, number> = {};
  for (const cd of chipCooldowns) {
    // 진행률: 0.0(방금 초기화) ~ 1.0(스킬 발동 직전)
    cooldownMap[cd.chipId] = cd.currentCooldown / cd.maxCooldown;
  }
  self.postMessage({ type: 'COOLDOWN_UPDATE', payload: cooldownMap });
}

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

// ── 개별 쿨타임 처리 (매 물리 스텝마다 호출) ──
// 각 칩의 쿨타임을 1씩 증가시키고, max에 도달하면 스킬을 발동한 뒤 즉시 초기화한다.
// 이 방식은 게임 속도(dtMultiplier)에 영향을 받지 않으며, 순수 프레임 카운트 기반이다.
function processSkillCooldowns() {
  if (!core || !isSkillEnabled) return;

  for (const cd of chipCooldowns) {
    if (core.finishedChips.has(cd.chipId)) continue;

    cd.currentCooldown++;

    if (cd.currentCooldown >= cd.maxCooldown) {
      // 쿨타임 도달 → 스킬 발동
      const randomSkill = AVAILABLE_SKILLS[Math.floor(Math.random() * AVAILABLE_SKILLS.length)];

      // 메인 스레드에 스킬 발동 이벤트 전달 (UI 컷씬 연출 트리거)
      self.postMessage({ type: 'SKILL_FIRED', payload: { chipId: cd.chipId, skill: randomSkill } });

      // 물리 엔진에 스킬 효과 적용 (v2: currentFrame + activeChips 전달)
      SkillSystem.triggerSkill(core.world!, cd.chipId, randomSkill, core.frame, core.activeChips, core.finishedChips);

      // 쿨타임 즉시 초기화 + 새로운 랜덤 쿨타임 부여
      cd.currentCooldown = 0;
      cd.maxCooldown = randomCooldown();
    }
  }
}

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    await SimulationCore.ensureRapier();

    if (stepInterval) clearInterval(stepInterval);

    const {
      width, height, customMapData, selectedMapPreset, gimmickDensity,
      survivors, targetCount, mode, customRank, randomRanks, isSkillEnabled: isSkill,
    } = payload;

    const presetMeta = selectedMapPreset && selectedMapPreset !== 'random' ? getPresetMeta(selectedMapPreset) : null;
    const worldHeight = presetMeta ? presetMeta.worldHeight : height;
    const wallStyle: WallStyle = presetMeta ? presetMeta.wallStyle : 'zigzag';
    const presetData = presetMeta ? presetMeta.items : null;
    const mapItems = customMapData && customMapData.length > 0 ? customMapData : presetData;
    const isCustomMap = !!(customMapData && customMapData.length > 0);

    isSkillEnabled = isSkill ?? true;
    dtMultiplier = 1.0;

    if (!core) core = new SimulationCore();
    core.init({
      width, height, worldHeight, wallStyle,
      mapItems, gimmickDensity, isCustomMap,
      themeWeights: presetMeta?.themeWeights,
      mapKey: selectedMapPreset && selectedMapPreset !== 'random' ? selectedMapPreset : 'random',
      survivors, targetCount, mode, customRank, randomRanks,
    });

    positionsBuffer = new Float32Array(core.activeChips.length * 5);

    // ── 각 마블에 대해 개별 쿨타임 초기화 ──
    chipCooldowns = [];
    if (isSkillEnabled && survivors) {
      for (const s of survivors) {
        chipCooldowns.push({
          chipId: s.id,
          maxCooldown: randomCooldown(),
          currentCooldown: 0,
        });
      }
    }

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

    // 스킬 쿨타임 초기화 (게임 재시작 시)
    for (const cd of chipCooldowns) {
      cd.currentCooldown = 0;
      cd.maxCooldown = randomCooldown();
    }

    stepInterval = setInterval(() => {
      if (!core) return;
      core.step(dtMultiplier);
      flushEvents();
      broadcastFrame();

      // 게임 종료 시 워커 내부 루프 자동 중단
      if (core.gameOver) {
        clearInterval(stepInterval);
        stepInterval = null;
        chipCooldowns = [];
        isRunning = false;
        return;
      }

      // ── 핵심: 매 물리 스텝마다 개별 쿨타임 처리 ──
      // 스킬 발동 시 슬로모션을 걸지 않으므로 게임 흐름이 전혀 방해받지 않는다.
      processSkillCooldowns();
      broadcastCooldowns();
    }, 1000 / 60);

  } else if (type === 'NUDGE') {
    if (core && core.world) {
      NudgeSystem.applyNudge(core.world, payload.force || 150);
    }
  } else if (type === 'SET_TIME_SCALE') {
    // 결승 슬로모션 등 외부 제어용 (스킬과 무관)
    dtMultiplier = payload.scale;
  } else if (type === 'STOP') {
    isRunning = false;
    if (stepInterval) clearInterval(stepInterval);
    chipCooldowns = [];
    if (core) {
      core.free();
      core = null;
    }
  }
};
