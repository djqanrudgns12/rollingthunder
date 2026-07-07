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
let isResolving = false; // "결과 빨리보기"(RESOLVE_REST) 터보 루프 진행 중 플래그

let positionsBuffer: Float32Array;
let bufferPool: ArrayBuffer[] = [];
let obstacleBufferPool: ArrayBuffer[] = []; // OBSTACLE_FRAME 전용 풀(FRAME과 크기 다름)
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
  // [성능 최적화] 매 프레임이 아닌 12프레임(~0.2초)마다 전송하여 React 재렌더 50% 절감
  // 왜: setSkillCooldowns → zustand 상태 갱신 → LiveLeaderboard 재렌더 비용이 큼.
  // 게이지 시각 변화에 0.2초 간격은 충분히 부드러움.
  cooldownBroadcastCounter++;
  if (cooldownBroadcastCounter < 12) return;
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

// 이동/회전 기물(스피너·피스톤·풍차·플리퍼)의 실제 물리 트랜스폼을 렌더로 전송.
// 포맷: 기물당 [x, y, rotationRad], 순서는 core.movingBodies(=INIT_DONE.movingObstacleIds)와 동일.
// 칩 버퍼(FRAME)와 분리된 별도 채널 → 칩 인덱스 매핑에 영향 없음.
function broadcastObstacles() {
  if (!core || core.movingBodies.length === 0) return;
  const bodies = core.movingBodies;
  const byteLen = bodies.length * 3 * 4;

  // FRAME과 동일한 버퍼 풀 패턴: 매 스텝 new Float32Array 할당(GC 압박) 제거.
  // 메인 스레드가 소비 후 RECYCLE_OBSTACLE_BUFFER로 되돌려준다.
  let bufferToUse: ArrayBuffer;
  if (obstacleBufferPool.length > 0) {
    bufferToUse = obstacleBufferPool.pop()!;
    if (bufferToUse.byteLength !== byteLen) {
      bufferToUse = new ArrayBuffer(byteLen);
    }
  } else {
    bufferToUse = new ArrayBuffer(byteLen);
  }

  const buf = new Float32Array(bufferToUse);
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i].body;
    const t = b.translation();
    buf[i * 3 + 0] = t.x;
    buf[i * 3 + 1] = t.y;
    buf[i * 3 + 2] = b.rotation();
  }
  (self.postMessage as any)({ type: 'OBSTACLE_FRAME', payload: bufferToUse }, [bufferToUse]);
}

// core.events 를 그대로 메인 스레드로 중계
function flushEvents() {
  if (!core) return;
  for (const ev of core.events) {
    self.postMessage(ev.payload !== undefined ? { type: ev.type, payload: ev.payload } : { type: ev.type });
  }
}

// ── 순위 가중 스킬 추첨 (PRD-gameplay-dynamics §4.B3) ──
// 하위권일수록 전진계(booster/tank/teleport), 상위권일수록 slime(자기 감속) 확률↑.
// 스킬 발동은 화면에 보이므로 역전이 "조작"이 아니라 "스킬 덕분"으로 읽힌다.
// comebackStrength 0이면 가중 없이 균등 추첨(기존 동작). 가중치는 강도에 비례해 1↔목표값 보간.
const SKILL_TIER_WEIGHTS: Record<SkillType, { top: number; bottom: number }> = {
  booster:  { top: 0.5, bottom: 2.0 },
  tank:     { top: 0.5, bottom: 2.0 },
  teleport: { top: 0.5, bottom: 2.0 },
  slime:    { top: 2.0, bottom: 0.5 },
  ghost:    { top: 1.0, bottom: 1.0 },
  magnet:   { top: 1.0, bottom: 1.0 }, // 시전자 주변을 끌어당김 — 하위권이 쓰면 자연 견제
  none:     { top: 1.0, bottom: 1.0 }, // 타입 충족용 — AVAILABLE_SKILLS에 없어 추첨되지 않음
};

function pickSkillForChip(chipId: string): SkillType {
  const uniform = () => AVAILABLE_SKILLS[Math.floor(Math.random() * AVAILABLE_SKILLS.length)];
  const s = core?.comebackStrength01 ?? 0;
  const ranks = core?.latestRanks ?? [];
  if (s <= 0 || ranks.length < 3) return uniform();
  const entry = ranks.find((r) => r.id === chipId);
  if (!entry) return uniform();

  const pct = entry.rank / ranks.length; // 0에 가까울수록 선두, 1에 가까울수록 꼴등
  const tier: 'top' | 'bottom' | null = pct <= 1 / 3 ? 'top' : pct >= 2 / 3 ? 'bottom' : null;
  if (!tier) return uniform(); // 중위권은 균등

  // 강도 비례 보간된 가중 랜덤 추첨
  const weights = AVAILABLE_SKILLS.map((sk) => 1 + (SKILL_TIER_WEIGHTS[sk][tier] - 1) * s);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < AVAILABLE_SKILLS.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return AVAILABLE_SKILLS[i];
  }
  return AVAILABLE_SKILLS[AVAILABLE_SKILLS.length - 1];
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
      // 쿨타임 도달 → 스킬 발동 (역전 다이내믹스: 순위 가중 추첨, 강도 0이면 기존 균등 추첨)
      const randomSkill = pickSkillForChip(cd.chipId);

      // 메인 스레드에 스킬 발동 이벤트 전달 (UI 컷씬 연출 트리거)
      self.postMessage({ type: 'SKILL_FIRED', payload: { chipId: cd.chipId, skill: randomSkill } });

      // 물리 엔진에 스킬 효과 적용 (v2: currentFrame + activeChips 전달)
      // [성능 최적화] chipBodyMap 전달 — O(1) 룩업
      SkillSystem.triggerSkill(core.world!, cd.chipId, randomSkill, core.frame, core.activeChips, core.finishedChips, core.chipBodyMap);

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
      selectedMapPreset,
      comebackStrength,
      playTime
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
    isResolving = false;

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
      comebackStrength, // 역전 다이내믹스 강도(0~100, 미지정 시 코어 기본 50)
      playTime, // "플레이 시간"(0~100, 미지정 시 코어 기본 50=중립)
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

    self.postMessage({ type: 'INIT_DONE', payload: { activeChipsCount: core.activeChips.length, mapData: core.mapData, movingObstacleIds: core.movingBodies.map((m) => m.id) } });
    broadcastFrame();
    broadcastObstacles();

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
    // RESOLVE_REST 터보 루프 중에는 메인 스레드 STEP을 무시(이중 스텝 방지)
    if (!core || !isRunning || isResolving) return;
    core.step(baseTimeScale * effectTimeScale);
    flushEvents();
    broadcastFrame();
    broadcastObstacles();

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
  } else if (type === 'RECYCLE_OBSTACLE_BUFFER') {
    if (payload && payload.byteLength) {
      obstacleBufferPool.push(payload);
    }
  } else if (type === 'NUDGE') {
    if (core && core.world) {
      // [성능 최적화] activeChips 직접 전달 — forEachRigidBody 제거
      NudgeSystem.applyNudgeToChips(core.activeChips, payload.force || 150);
    }
  } else if (type === 'SET_TIME_SCALE') {
    // 결승 슬로모션 등 외부 제어용 (스킬과 무관)
    effectTimeScale = payload.scale;
  } else if (type === 'SET_BASE_TIME_SCALE') {
    // 환경 설정용
    baseTimeScale = payload.scale;
  } else if (type === 'SET_COMEBACK_STRENGTH') {
    // 환경설정 "순위 역동성" 슬라이더(0~100) 실시간 반영
    core?.setComebackStrength(payload.value);
  } else if (type === 'SET_PLAY_TIME') {
    // 환경설정 "플레이 시간" 슬라이더(0~100) 실시간 반영
    core?.setPlayTime(payload.value);
  } else if (type === 'RESOLVE_REST') {
    // "결과 빨리보기"(PRD-endgame-pacing §4.C-1): 우승 확정 후 남은 주자의 완주를
    // 실제 물리 그대로 고속 처리. STEP 메시지를 기다리지 않고 자체 루프로 스텝하되,
    // FRAME 브로드캐스트를 5프레임에 1회로 줄여 타임랩스처럼 보이게 한다.
    // Y좌표 순 추정이 아닌 실시간 진행과 동일한 시뮬레이션 결과이므로 순위표가 정확하다.
    if (!core || !isRunning || isResolving || !core.gameOver || core.allFinished) return;
    isResolving = true;
    const TURBO_MAX_FRAMES = 14400; // 안전 상한(헤드리스 하네스와 동일, 240초 상당)
    let turboFrames = 0;
    const runChunk = () => {
      if (!core || !isRunning) { isResolving = false; return; }
      for (let i = 0; i < 600; i++) {
        if (core.allFinished || turboFrames >= TURBO_MAX_FRAMES) break;
        core.step(baseTimeScale * effectTimeScale);
        turboFrames++;
        flushEvents();
        if (turboFrames % 5 === 0) { broadcastFrame(); broadcastObstacles(); }
        processSkillCooldowns();
      }
      broadcastFrame();
      broadcastObstacles();
      if (core.allFinished || turboFrames >= TURBO_MAX_FRAMES) {
        isResolving = false;
        // STEP 루프의 ALL_FINISHED와 중복 전송되지 않도록 카운터를 선점한다.
        if (postFinishFrames === 0) {
          postFinishFrames = 1;
          self.postMessage({ type: 'ALL_FINISHED' });
        }
      } else {
        setTimeout(runChunk, 0); // 청크 사이 양보 — 메시지 큐(STOP 등) 처리 허용
      }
    };
    runChunk();
  } else if (type === 'STOP') {
    isRunning = false;
    isResolving = false;
    chipCooldowns = [];
    if (core) {
      core.free();
      core = null;
    }
  }
};
