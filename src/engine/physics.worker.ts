import { SimulationCore } from './SimulationCore';
import { SkillSystem, type SkillType } from './SkillSystem';
import { NudgeSystem } from './NudgeSystem';
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
let postFinishFrames = 0;

let positionsBuffer: Float32Array;
let bufferPool: ArrayBuffer[] = [];
let isSkillEnabled = true;
let baseTimeScale = 1.0; // 환경설정에서 지정한 기본 배속
let effectTimeScale = 1.0; // 카메라 연출용 (슬로모션, 스냅 등)

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

const GLOBAL_SPEED_MODIFIER = 0.7;
const COOLDOWN_SCALE = 1 / GLOBAL_SPEED_MODIFIER;

// 쿨타임 범위: 최소 300프레임(5초)~최대 900프레임(15초) @60fps (배속 보정 적용됨)
const MIN_COOLDOWN_FRAMES = Math.round(300 * COOLDOWN_SCALE);
const MAX_COOLDOWN_FRAMES = Math.round(900 * COOLDOWN_SCALE);

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
  const bufferLen = chips.length * 5;
  const byteLen = bufferLen * 4;

  let bufferToUse: ArrayBuffer;
  if (bufferPool.length > 0) {
    bufferToUse = bufferPool.pop()!;
    if (bufferToUse.byteLength !== byteLen) {
      bufferToUse = new ArrayBuffer(byteLen);
    }
  } else {
    bufferToUse = new ArrayBuffer(byteLen);
  }

  positionsBuffer = new Float32Array(bufferToUse);

  for (let i = 0; i < chips.length; i++) {
    const t = chips[i].translation();
    const v = chips[i].linvel();
    positionsBuffer[i * 5 + 0] = i;
    positionsBuffer[i * 5 + 1] = t.x;
    positionsBuffer[i * 5 + 2] = t.y;
    positionsBuffer[i * 5 + 3] = v.x;
    positionsBuffer[i * 5 + 4] = v.y;
  }
  
  (self.postMessage as any)({ type: 'FRAME', payload: bufferToUse }, [bufferToUse]);
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
  // ═══════════════════════════════════════════════════════════════════
  // ██ PROTECTED: 전원 완주 시 스킬 시스템 완전 중단 ██
  // 모든 참가자가 결승선을 통과한 후에는 어떤 스킬도 발동되지 않습니다.
  // 개별 완주자 필터링(L113)과 함께 이중 보호를 형성합니다.
  // ⚠️ DO NOT MODIFY: 사용자 요청에 의해 영구 고정된 로직입니다.
  // ═══════════════════════════════════════════════════════════════════
  if (!core || !isSkillEnabled || core.allFinished) return;

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

    const {
      width, height, customMapData, customMapMeta, presetMeta, gimmickDensity,
      survivors, targetCount, mode, customRank, randomRanks, isSkillEnabled: isSkill,
      baseTimeScale: initBaseTimeScale,
      selectedMapPreset
    } = payload;

    // customMapData가 있으면 share code를 통해 강제 로드된 맵, 없더라도 presetMeta.isOfficial === false 이면 로컬에 임시 저장된 커스텀 맵으로 판별.
    const hasShareCodeCustomMap = !!(customMapData && customMapData.length > 0);
    const isCustomMap = hasShareCodeCustomMap || (presetMeta && presetMeta.isOfficial === false);
    
    // share code를 통해 로드된 맵이 우선순위를 가짐.
    const activeMeta = hasShareCodeCustomMap ? customMapMeta : presetMeta;
    
    const worldHeight = activeMeta?.worldHeight || height;
    const wallStyle: WallStyle = activeMeta?.wallStyle || 'zigzag';
    const presetData = presetMeta ? presetMeta.items : null;
    // 실제 시뮬레이션에 전달할 아이템 데이터 (공유 코드 커스텀 맵 > 로컬 캐시 커스텀 맵/프리셋 맵)
    const mapItems = hasShareCodeCustomMap ? customMapData : presetData;
    const layoutConfig = activeMeta?.layoutConfig;
    const themeWeights = activeMeta?.themeWeights;

    isSkillEnabled = isSkill ?? true;
    if (initBaseTimeScale !== undefined) {
      baseTimeScale = initBaseTimeScale;
    }
    effectTimeScale = 1.0;

    if (!core) core = new SimulationCore();
    core.init({
      width, height, worldHeight, wallStyle,
      mapItems, gimmickDensity, isCustomMap,
      // 공식(배포) 맵은 편집본 정확 재현을 위해 밀도 절차를 우회한다.
      isOfficial: activeMeta?.isOfficial === true,
      themeWeights,
      layoutConfig, // PRD v6.0: 커스텀 맵의 레이아웃 메타데이터도 반영
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
    effectTimeScale = 1.0;
    postFinishFrames = 0;

    // 스킬 쿨타임 초기화 (게임 재시작 시)
    for (const cd of chipCooldowns) {
      cd.currentCooldown = 0;
      cd.maxCooldown = randomCooldown();
    }

  } else if (type === 'STEP') {
    if (!core || !isRunning) return;
    core.step(baseTimeScale * effectTimeScale);
    flushEvents();
    broadcastFrame();

    // 워커 루프는 "우승 확정(gameOver)"이 아니라 "마지막 주자까지 완주(allFinished)" 시 종료.
    // 우승자가 나와도 남은 주자들이 결승선을 통과할 때까지 시뮬레이션을 계속 진행한다.
    // 마지막 주자가 결승선에 닿자마자 멈추는 현상(화면에 칩이 걸쳐서 정지)을 막기 위해 2초(120프레임) 추가 대기.
    if (core.allFinished) {
      postFinishFrames++;
      // ═══════════════════════════════════════════════════════════════════
      // ██ PROTECTED: 전원 완주 시 ALL_FINISHED 이벤트 1회 전송 ██
      // GAME_OVER(우승자 확정)와 ALL_FINISHED(전원 완주)는 다른 이벤트입니다.
      // UI는 이 이벤트를 받아야만 'all_finished' 상태로 전환합니다.
      // ⚠️ DO NOT MODIFY: 사용자 요청에 의해 영구 고정된 로직입니다.
      // ═══════════════════════════════════════════════════════════════════
      if (postFinishFrames === 1) {
        self.postMessage({ type: 'ALL_FINISHED' });
      }
      // "다 끝났더라도 진행환경은 유지. 사진처럼 멈추지 말라는거야"라는 요청에 따라
      // 물리 루프를 완전히 끄지 않고 계속 백그라운드 환경이 살아있도록 유지합니다.
      if (postFinishFrames > 120) {
        chipCooldowns = [];
      }
    }

    // ── 핵심: 매 물리 스텝마다 개별 쿨타임 처리 ──
    // 스킬 발동 시 슬로모션을 걸지 않으므로 게임 흐름이 전혀 방해받지 않는다.
    processSkillCooldowns();
    broadcastCooldowns();

  } else if (type === 'RECYCLE_BUFFER') {
    if (payload && payload.byteLength) {
      bufferPool.push(payload);
    }
  } else if (type === 'NUDGE') {
    if (core && core.world) {
      NudgeSystem.applyNudge(core.world, payload.force || 150);
    }
  } else if (type === 'SET_TIME_SCALE') {
    // 결승 슬로모션 등 외부 제어용 (스킬과 무관)
    effectTimeScale = payload.scale;
  } else if (type === 'SET_BASE_TIME_SCALE') {
    // 환경 설정용
    baseTimeScale = payload.scale;
  } else if (type === 'STOP') {
    isRunning = false;
    chipCooldowns = [];
    if (core) {
      core.free();
      core = null;
    }
  }
};
