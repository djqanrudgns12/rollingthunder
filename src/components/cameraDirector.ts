import type { Viewport } from 'pixi-viewport';
import { useGameStore } from '@/store/gameStore';

// ──────────────────────────────────────────────────────────────────────────
// CameraDirector: 경기 카메라의 단일 두뇌.
//   - 매 프레임 "단 하나의" 목표 {x, y, zoom}을 정하고, 프레임레이트 독립 지수 댐핑으로
//     실제 뷰포트를 부드럽게 수렴시킨다(여러 스프링이 경합하던 '정신없음' 제거).
//   - 기본은 선두 그룹을 여유있게 담는 프레이밍. 그 위에 "시네마틱 비트(DirectorBeat)"
//     레이어를 얹어 축구 중계처럼 능동적인 줌/속도 연출을 한다:
//       TRACKING → (결승 직전 + 드라마 조건) ANTICIPATION(줌인+슬로우)
//                → (통과 순간) CLIMAX(스냅 가속+펀치) → HANDOFF(다음 주자 휘프팬) → TRACKING
//   - 비트는 모두 매 프레임 누적 실시간 dt로 구동된다(슬로모션은 물리 dt만 늦추고 렌더 틱은
//     실시간이므로 비트 타이밍은 "실제 초" 기준 — setTimeout 불필요/결정적).
//   - 슬로모션(SET_TIME_SCALE) 호출 소유자를 이 클래스 하나로 일원화한다(부드러운 이즈 + 스팸 방지).
//   - 미니맵 클릭-점프/드래그-스크럽 같은 수동 조작도 여기서 목표로 흡수(일정 시간 후 자동 복귀).
// ──────────────────────────────────────────────────────────────────────────

type Mode = 'idle' | 'race' | 'manual' | 'finisher_focus';
// 결승 연출 비트(레이싱 중에만 활성). idle=평상 추적.
//  climax=CROSS(통과 순간 완주자 추적) → linger=결승선 여운 → handoff=다음 선두 복귀
type FinisherPhase = 'idle' | 'climax' | 'linger' | 'handoff';
// 사용자 줌 상태머신
type UserZoomState = 'INACTIVE' | 'ZOOMING' | 'HOLDING' | 'RETURNING';

export interface CameraDirectorOpts {
  worldWidth: number;
  worldHeight: number;
  screenW: number;
  screenH: number;
  setTimeScale: (scale: number) => void;
  endMarginPercent?: number; // PRD v6.0: 종료선 동기화
}

// 프레임레이트 독립 지수 보간: dt(초)에 무관하게 일정한 "절반 도달 시간"을 보장.
function damp(cur: number, target: number, k: number, dt: number): number {
  return target + (cur - target) * Math.exp(-k * dt);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// 부드러운 S자 보간(0→1): 진입/이탈 램프에 사용
function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/**
 * 임계감쇠 스프링(Unity SmoothDamp 이식). 움직이는 목표를 오버슈트 없이,
 * 저장된 속도(velRef.v)를 누적해 낮은 지연으로 추종한다. 카메라 수직 추적용.
 * @param velRef 외부에 보관하는 속도 상태 { v }
 * @param smoothTime 대략적인 "목표 도달 시간"(작을수록 팽팽)
 */
function smoothDamp(cur: number, target: number, velRef: { v: number }, smoothTime: number, dt: number): number {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (velRef.v + omega * change) * dt;
  velRef.v = (velRef.v - omega * temp) * exp;
  let out = target + (change + temp) * exp;
  // 목표를 지나치는 경우(오버슈트) 방지
  if ((target - cur > 0) === (out > target)) {
    out = target;
    velRef.v = (out - target) / dt;
  }
  return out;
}

export class CameraDirector {
  private vp: Viewport;
  private worldW: number;
  private worldH: number;
  private finishLineY: number; // PRD v6.0: 실제 종료선 Y
  private screenW: number;
  private screenH: number;
  private setTimeScale: (scale: number) => void;

  // 현재(부드럽게 수렴 중인) 카메라 상태
  private camX: number;
  private camY: number;
  private camZoom: number;

  // 저상통과(low-pass)된 추적 기준값 — 멤버십 변화로 인한 좌우 떨림 제거
  private smCentroidX: number;
  private smLeaderY = 0;
  private hasLeader = false;
  private leaderVy = 0;
  // 팩 스팬 저역통과: 칩이 팩 창(1000px)을 드나들거나 완주로 빠질 때 이산 점프 → 줌 튐 방지
  private smPackSpan = 400;

  private mode: Mode = 'idle';
  private gameState: 'idle' | 'playing' | 'winner_declared' | 'all_finished' = 'idle';
  private manualExpireMs = 0;
  private manualTargetX = 0;
  private manualTargetY = 0;
  private focusChipId: string | null = null; // 수동 칩 락온 / 결승 락온
  private scrubbing = false;
  private freeManual = false; // 사용자가 메인 화면을 직접 드래그/핀치 중 → 카메라가 손을 뗌

  private leadBattle = false;
  private zoomPunch = 0; // 도달자 가벼운 줌 펀치(감쇠)
  private shakeIntensity = 0; // 스크린 셰이크 강도
  private winnerDecided = false; // 우승 확정 후엔 결착 시네마틱을 더 걸지 않고 남은 레이스만 추적

  // ── 시네마틱 비트 상태 ──
  private finisherQueue: { chipId: string; crossX?: number }[] = [];
  private finisherPhase: FinisherPhase = 'idle';
  private finisherPhaseT = 0;            // 현재 비트 경과(실시간 초)
  private anticipating = false;          // 결승 직전 줌인+슬로우 활성
  private anticipationT = 0;             // 슬로우 지속(스톨 가드용)
  private anticipationCooldownT = 0;     // 재무장 방지 쿨다운
  private photoFinishActive = false;     // 1·2위 접전(듀얼 프레이밍)
  private lastStandActive = false;       // 남은 주자 1~2명(라스트 스탠드 긴장)
  private nextFinishIsWinner = true;     // 다음 완주자가 "우승 슬롯"인가(PhysicsCanvas가 갱신)
  private establishingT = 0;             // 오프닝(줌아웃→푸시인) 잔여
  private lastLeaderId: string | null = null; // 선두 교체 감지용
  private overtakeCooldownT = 0;         // 선두 교체 하이라이트 쿨다운
  // 정밀 추적/결승 연출 상태
  private camVelYRef = { v: 0 };         // 수직 SmoothDamp 속도 상태
  private finishFocusX = 0;              // 결승 통과 지점 X(LINGER 프레이밍 고정용)
  private anticipationRamp = 0;          // APPROACH 진행도(0→1, 슬로우·줌 램프)

  // ── 사용자 줌 상태 ──
  private userZoomState: UserZoomState = 'INACTIVE';
  private userZoom = 1.0;             // 사용자가 설정한 줌 레벨
  private lastUserZoomMs = 0;         // 마지막 줌 입력 시각 (디바운스용)
  private holdStartMs = 0;            // HOLDING 진입 시각

  // 시간 배율(슬로모션/가속): 부드럽게 이즈, 변화가 충분할 때만 워커로 전송
  private timeScaleCurrent = 1.0;
  private timeScaleTarget = 1.0;
  private timeScaleSent = 1.0;
  private fastForwardMultiplier = 1.0;

  // ── 튜닝 상수 ──
  private readonly PAN_K = 15.0;         // 위치 댐핑 강도 (초정밀 추적)
  private readonly ZOOM_K = 2.0;         // 줌 댐핑 강도 (부드럽게 줌인)
  private readonly CENTROID_K = 15.0;    // 중심 X 저상통과 (정밀 추적)
  private readonly LEADER_K = 22.0;      // 선두 Y 저상통과 (빠른 반응, 하단 1/3 고정 강화)
  private readonly LEAD_BATTLE_AT = 0.86; // 진행도 이 이상이면 결착 줌인 시작
  private readonly MAX_ZOOM = 3.5;       // 극대 확대(평상 상한)
  private readonly BATTLE_ZOOM = 2.0;    // 결착 구간 줌

  // 사용자 줌 튜닝
  private readonly USER_ZOOM_MIN = 0.25;      // 사용자 줌 최소 (맵 전체 조감)
  private readonly USER_ZOOM_MAX = 3.5;       // 사용자 줌 최대
  private readonly ZOOM_DEBOUNCE_MS = 300;    // ZOOMING→HOLDING 전환 대기
  private readonly ZOOM_HOLD_S = 5.0;         // HOLDING 유지 시간 (playing)
  private readonly ZOOM_HOLD_IDLE_S = 2.0;    // HOLDING 유지 시간 (idle)
  private readonly ZOOM_RETURN_K = 1.5;       // 복귀 줌 댐핑
  private readonly PAN_RETURN_K = 2.0;        // 복귀 위치 댐핑

  // 정밀 추적 튜닝
  private readonly LEADER_SCREEN_BIAS = 0.167; // 1등 화면 세로 위치(0.5+bias=하단 1/3, ~67%)
  private readonly LOOKAHEAD_S = 0.15;         // 실제 vy 예측 룩어헤드(추적 지연 상쇄)
  private readonly VERT_SMOOTH_TIME = 0.14;    // 수직 SmoothDamp 팽팽함(작을수록 타이트, 하단 1/3 고정 강화)
  private readonly HANDOFF_SMOOTH_TIME = 0.28; // 핸드오프(다음 선두 복귀) 수직 완만도

  // 스크린 셰이크 전역 스케일: ON일 때도 카메라 흔들림을 최소화(거의 없는 수준). OFF는 완전 0.
  private readonly SHAKE_SCALE = 0.10;

  // 시네마틱 비트 튜닝
  private readonly PHOTO_FINISH_PX = 130;    // 1·2위 Y간격 이 이내면 접전(포토피니시)
  private readonly SLOWMO_SCALE = 0.16;       // 극도의 슬로우 모션 배율(결승 순간, 살짝 빠르게)
  private readonly LASTSTAND_SCALE = 0.55;   // 마지막 주자 추적 슬로모션(완만)
  private readonly ETA_ARM = 1.4;            // 결승 예상도달(초) 이하면 APPROACH 진입(더 늦게 진입)
  private readonly ETA_RELEASE = 1.9;        // ETA 이 이상이면 APPROACH 해제(히스테리시스)
  private readonly FINISH_ZOOM = 3.2;        // 결승 극대 줌(과한 확대 완화)
  private readonly FINISH_ZOOM_K = 5.0;      // 결승 접근/통과 시 줌 수렴 가속(극대 줌 실제 도달)
  private readonly FINISH_LOCK_PX = 260;     // 이 거리 이내면 결승 임박 → 슬로우 유지(스톨 가드 예외)
  private readonly MAX_ANTICIPATION_S = 1.6; // 슬로우 최대 지속(스톨 가드)
  private readonly CLIMAX_S = 0.6;           // CROSS(통과 순간 극대 줌+슬로우 유지) 시간(0.7→0.6)
  private readonly LINGER_S = 0.5;           // 여운+리포커스 블렌드 시간(1.5→0.5: 여운 총 ~1.1초)
  private readonly HANDOFF_S = 1.2;          // 다음 주자 복귀 활공 시간(1.0→1.2, 리포커스 여속)
  private readonly LEADER_SWITCH_PX = 14;    // 선두 교체 히스테리시스(px): 이 이상 앞서야 포커스 전환(미세 추월 반복 시 좌우 튐 방지)
  private readonly RAMP_K = 7.0;             // APPROACH 램프 이징 강도(무장/해제 스냅 제거)
  private readonly ESTABLISH_S = 1.0;        // 오프닝 푸시인 시간
  private readonly OVERTAKE_CD_S = 1.5;      // 선두 교체 하이라이트 쿨다운
  private readonly TIMESCALE_K = 9.0;        // 시간배율 이즈 강도
  private readonly HANDOFF_PAN_K = 5.0;      // 핸드오프 위치 댐핑(휘프팬→활공, 9→5)
  private readonly HANDOFF_ZOOM_K = 3.5;     // 핸드오프 줌 댐핑(완만한 줌아웃, 6→3.5)

  // ── 차분 모드(calmMode) 저모션 세트(Tier 2). OFF면 위 Tier1 기본값 사용 ──
  private calm = false;                       // update() 시작 시 매 프레임 캐시
  private readonly CALM_SLOWMO_SCALE = 0.7;   // 슬로모션 급락 완화(전정계 자극 저감)
  private readonly CALM_LASTSTAND_SCALE = 0.8;
  private readonly CALM_MAX_ZOOM = 1.4;       // 얕은 줌 상한
  private readonly CALM_BATTLE_ZOOM = 1.35;
  private readonly CALM_ESTABLISH_S = 0.4;    // 오프닝 스윕 완화
  private readonly CALM_FINISH_ZOOM = 1.6;    // 차분 모드 결승 줌(완만)
  // 저모션 게터: this.calm에 따라 상수 선택(update 경유 호출 전체에 일관 적용)
  private get finishZoom() { return this.calm ? this.CALM_FINISH_ZOOM : this.FINISH_ZOOM; }
  // 결승 연출 중(APPROACH/CROSS/LINGER)에는 줌 상한을 FINISH_ZOOM으로 한시 상향
  private get zoomCeiling() {
    const finishing = this.anticipating || this.finisherPhase === 'climax' || this.finisherPhase === 'linger';
    return finishing ? this.finishZoom : this.maxZoom;
  }
  private get maxZoom() { return this.calm ? this.CALM_MAX_ZOOM : this.MAX_ZOOM; }
  private get battleZoom() { return this.calm ? this.CALM_BATTLE_ZOOM : this.BATTLE_ZOOM; }
  private get slowmoScale() { return this.calm ? this.CALM_SLOWMO_SCALE : this.SLOWMO_SCALE; }
  private get lastStandScale() { return this.calm ? this.CALM_LASTSTAND_SCALE : this.LASTSTAND_SCALE; }
  private get handoffPanK() { return this.calm ? this.PAN_K : this.HANDOFF_PAN_K; } // 차분: 급스냅 휘프팬 제거
  private get handoffZoomK() { return this.calm ? this.ZOOM_K : this.HANDOFF_ZOOM_K; }
  // 결승 접근/통과 시 줌 수렴 가속(차분 모드는 완만한 기본 ZOOM_K 유지)
  private get finishZoomK() { return this.calm ? this.ZOOM_K : this.FINISH_ZOOM_K; }

  constructor(vp: Viewport, opts: CameraDirectorOpts) {
    this.vp = vp;
    this.worldW = opts.worldWidth;
    this.worldH = opts.worldHeight;
    this.finishLineY = opts.worldHeight * (1 - (opts.endMarginPercent ?? 0.02)); // PRD v6.0
    this.screenW = opts.screenW;
    this.screenH = opts.screenH;
    this.setTimeScale = opts.setTimeScale;
    this.camX = vp.center.x;
    this.camY = vp.center.y;
    this.camZoom = vp.scale.x || 1;
    this.smCentroidX = this.worldW / 2;
  }

  setFastForwardMultiplier(mult: number) {
    this.fastForwardMultiplier = mult;
  }

  resize(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
  }

  setGameState(state: 'idle' | 'playing' | 'winner_declared' | 'all_finished') {
    const prev = this.gameState;
    if (prev === state) return; // 동일 상태 재호출 무시 — 매 프레임 setGameState('playing') 호출에 의한 줌 강제 복귀 방지
    this.gameState = state;
    if (state === 'idle') {
      if (this.mode !== 'finisher_focus' && this.mode !== 'manual') {
        this.mode = 'idle';
      }
    } else if (state === 'playing') {
      if (this.mode === 'idle') {
        this.mode = 'race';
      }
      // 사용자 줌이 활성 상태면 부드러운 복귀로 전환 (게임 시작 시 줌 고정 방지)
      if (this.userZoomState === 'ZOOMING' || this.userZoomState === 'HOLDING') {
        this.userZoomState = 'RETURNING';
        this.mode = 'race';
        this.freeManual = false;
      }
      // 오프닝 연출: idle→playing 전이 시 넓게 빠졌다가 출발 팩으로 푸시인
      if (prev !== 'playing') {
        this.establishingT = useGameStore.getState().calmMode ? this.CALM_ESTABLISH_S : this.ESTABLISH_S;
        this.camZoom = this.fitWidthZoom(); // 즉시 줌아웃 → 추적 줌이 더 타이트해 자연스레 밀려들어옴
      }
    }
  }

  // 메인 뷰포트를 사용자가 직접 드래그 → 카메라가 손을 떼고(자유 조작) 잠시 후 복귀
  // 주의: 휠/핀치 줌은 applyUserZoom()에서 별도 처리 (상태머신 기반)
  notifyUserInteraction() {
    // 통과 순간(climax) 같은 결정적 연출 중에는 카메라가 손을 떼지 않는다.
    if (this.mode === 'finisher_focus') return;
    this.mode = 'manual';
    this.freeManual = true;
    this.focusChipId = null;
    this.manualExpireMs = performance.now() + 3000;
    // 수동 전환 시 슬로모션 즉시 해제(슬로우인 채로 사용자가 패닝하는 어색함 방지)
    this.anticipating = false;
    this.resetTimeScale();
  }

  /**
   * 사용자가 휠/핀치로 줌을 변경할 때 호출.
   * CameraDirector가 줌의 유일한 소유자이므로, pixi-viewport 플러그인을 거치지 않고
   * 여기서 직접 줌을 계산하고 뷰포트에 적용한다.
   * @param zoomDelta - 줌 배율 변화율 (예: 0.1 = 10% 확대, -0.1 = 10% 축소)
   * @param screenX - 줌 중심점의 화면 좌표 X (CSS 픽셀)
   * @param screenY - 줌 중심점의 화면 좌표 Y (CSS 픽셀)
   */
  applyUserZoom(zoomDelta: number, screenX: number, screenY: number) {
    // ── 가드: 결정적 연출 중 무시 ──
    if (this.mode === 'finisher_focus') return;
    // ── 가드: 미니맵 스크럽 중 무시 ──
    if (this.mode === 'manual' && this.scrubbing) return;

    // ── 줌 계산: 마우스/터치 위치 기준 ──
    const oldZoom = this.camZoom;
    const newZoom = Math.max(
      this.USER_ZOOM_MIN,
      Math.min(this.USER_ZOOM_MAX, oldZoom * (1 + zoomDelta))
    );

    // 마우스/터치가 가리키는 월드 좌표 (줌 전)
    const worldX = this.camX + (screenX - this.screenW / 2) / oldZoom;
    const worldY = this.camY + (screenY - this.screenH / 2) / oldZoom;

    // 줌 후에도 동일한 화면 위치에 동일한 월드 좌표가 오도록 카메라 이동
    const newCamX = worldX - (screenX - this.screenW / 2) / newZoom;
    const newCamY = worldY - (screenY - this.screenH / 2) / newZoom;

    // ── 내부 상태 갱신 ──
    this.camZoom = newZoom;
    this.camX = newCamX;
    this.camY = newCamY;
    this.userZoom = newZoom;

    // ── 뷰포트 즉시 반영 (CameraDirector가 유일한 줌 소유자) ──
    this.vp.scale.set(newZoom);
    this.vp.moveCenter(newCamX, newCamY);

    // ── 상태머신 전환 ──
    this.userZoomState = 'ZOOMING';
    this.lastUserZoomMs = performance.now();

    // 휠 줌은 위치 추적을 멈추지 않음 (줌만 오버라이드)
    // 단, manualExpireMs 타이머는 갱신하여 드래그 타이머와 동기화
    this.manualExpireMs = performance.now() + (this.ZOOM_HOLD_S * 1000);

    // ── 슬로모션 해제 ──
    this.anticipating = false;
    this.resetTimeScale();
  }

  // 현재 줌 레벨 반환 (PhysicsCanvas의 핀치 처리에서 사용)
  getZoom(): number {
    return this.camZoom;
  }

  // 사용자 줌 상태 강제 초기화 (결정적 연출 진입 시)
  private resetUserZoom() {
    if (this.userZoomState !== 'INACTIVE') {
      this.userZoomState = 'INACTIVE';
    }
  }

  // 미니맵 탭 → 해당 좌표로 점프. chipId가 있으면 그 칩을 락온 추적.
  minimapJump(x: number, y: number, chipId: string | null) {
    this.mode = 'manual';
    this.freeManual = false;
    this.scrubbing = false;
    this.focusChipId = chipId;
    this.manualTargetX = x;
    this.manualTargetY = y;
    this.manualExpireMs = performance.now() + 3000;
  }

  // 미니맵 드래그 스크럽(1:1)
  minimapScrubStart() {
    this.mode = 'manual';
    this.freeManual = false;
    this.scrubbing = true;
    this.focusChipId = null;
  }

  minimapScrub(x: number, y: number) {
    this.mode = 'manual';
    this.scrubbing = true;
    this.manualTargetX = x;
    this.manualTargetY = y;
    // 스크럽은 즉시 동기화(스크롤바 느낌)
    this.camX = x;
    this.camY = y;
  }

  minimapScrubEnd() {
    this.scrubbing = false;
    this.manualExpireMs = performance.now() + 3000;
  }

  // 도달자 가벼운 줌 펀치(감쇠)
  flashFinisher() {
    if (useGameStore.getState().calmMode) return; // 차분 모드: 줌 펀치 생략
    this.zoomPunch = Math.max(this.zoomPunch, 0.14);
  }

  // 스크린 셰이크 효과. ON일 때도 SHAKE_SCALE로 대폭 축소(관전 어지러움 방지 → 거의 없는 수준).
  // OFF/차분 모드는 조기 return → 완전 0.
  addShake(intensity: number) {
    const s = useGameStore.getState();
    if (!s.isScreenShakeEnabled || s.calmMode) return; // 차분 모드에서도 셰이크 억제
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity * this.SHAKE_SCALE);
  }

  // PhysicsCanvas가 게임 로직(모드/목표 등수)으로 계산해 알려주는 드라마 컨텍스트.
  // 다음 완주자가 "우승 슬롯"인지 여부 → 결승 직전 ANTICIPATION 게이팅에 사용.
  setDrama(nextFinishIsWinner: boolean) {
    this.nextFinishIsWinner = nextFinishIsWinner;
    this.winnerDecided = !nextFinishIsWinner;
  }

  // 완주 발생 → 결승 연출 큐잉. dramatic=false(중상위권 다수)면 무거운 락온/슬로우 없이
  // 가벼운 줌 펀치만 주어 템포를 유지한다("핵심 순간만" 정책).
  focusNextFinisher(chipId: string, dramatic: boolean, crossX?: number) {
    this.flashFinisher();
    if (dramatic) {
      this.finisherQueue.push({ chipId, crossX });
    }
  }

  getState() {
    return { x: this.vp.center.x, y: this.vp.center.y, zoom: this.vp.scale.x };
  }

  // 매 프레임 호출. chips: 활성 칩 위치+수직속도 맵, leaderHintId: 랭킹 1위 힌트(없어도 됨)
  update(dtSec: number, chips: Map<string, { x: number; y: number; vy?: number }>, leaderHintId: string | null) {
    void leaderHintId;
    const dt = Math.min(Math.max(dtSec, 0.001), 0.05);
    this.calm = useGameStore.getState().calmMode; // 차분 모드 캐시(이하 저모션 게터 일괄 적용)

    // 시간배율은 전역(모드 무관) — 매 프레임 부드럽게 이즈(전 프레임 타겟 기준, 1프레임 지연은 무시 가능).
    this.tickTimeScale(dt);
    this.anticipationCooldownT = Math.max(0, this.anticipationCooldownT - dt);
    this.overtakeCooldownT = Math.max(0, this.overtakeCooldownT - dt);
    this.establishingT = Math.max(0, this.establishingT - dt);

    // ── 0) 사용자 줌 상태머신 (모드와 독립적으로 구동) ──
    const now = performance.now();
    if (this.userZoomState === 'ZOOMING') {
      if (now - this.lastUserZoomMs > this.ZOOM_DEBOUNCE_MS) {
        this.userZoomState = 'HOLDING';
        this.holdStartMs = now;
      }
    } else if (this.userZoomState === 'HOLDING') {
      if (this.gameState === 'all_finished') {
        // 완주 후: 무제한 유지 (복귀 안 함)
      } else {
        const holdMs = this.gameState === 'idle'
          ? this.ZOOM_HOLD_IDLE_S * 1000
          : this.ZOOM_HOLD_S * 1000;
        if (now - this.holdStartMs > holdMs) {
          this.userZoomState = 'RETURNING';
        }
      }
    }
    // RETURNING/INACTIVE: 댐핑 섹션에서 수렴 체크

    // ── 0.1) 자유 수동 모드 (화면 드래그) — 줌과 분리 ──
    if (this.mode === 'manual' && this.freeManual) {
      this.timeScaleTarget = 1.0; // 수동 중엔 항상 정상 속도
      if (this.vp.scale.x < 0.3) this.vp.scale.set(0.3);
      if (this.vp.scale.x > 3.0) this.vp.scale.set(3.0);
      const leaderYNow = this.frontRunnerY(chips);
      const nearFinish = leaderYNow / this.worldH >= this.LEAD_BATTLE_AT;
      if (now > this.manualExpireMs || nearFinish) {
        this.camX = this.vp.center.x;
        this.camY = this.vp.center.y;
        this.camZoom = this.vp.scale.x;
        this.mode = 'race';
        this.freeManual = false;
      } else {
        return; // 드래그 중 — 위치 업데이트 스킵 (줌은 applyUserZoom에서 이미 적용)
      }
    }

    // ── 1) 선두/2위/잔여주자 산출 ──
    // 선두 = (결승선 직전까지) 가장 멀리 내려간 칩. finished(아래로 빠진) 칩은 제외.
    // 단, CROSS/LINGER 중에는 focusChipId(완주자)를 결승선 아래에서도 계속 추적(아래 락온).
    const finishLineY = this.finishLineY; // PRD v6.0
    let leaderY = -Infinity, leaderX = this.smCentroidX, leaderId: string | null = null;
    let leaderVyRaw = 0;
    let secondY = -Infinity, secondX = this.smCentroidX;
    let racingCount = 0;
    for (const [id, p] of chips) {
      if (p.y <= finishLineY) {
        racingCount++; // 아직 결승선 통과 전 = 레이싱 중
        if (p.y > leaderY) {
          secondY = leaderY; secondX = leaderX;
          leaderY = p.y; leaderX = p.x; leaderId = id; leaderVyRaw = p.vy ?? 0;
        } else if (p.y > secondY) {
          secondY = p.y; secondX = p.x;
        }
      }
    }
    if (leaderY === -Infinity) {
      // 모두 결승선 통과 → 마지막 알려진 선두 유지 또는 가장 아래 칩
      for (const [, p] of chips) if (p.y > leaderY) { leaderY = p.y; leaderX = p.x; leaderVyRaw = p.vy ?? 0; }
    }
    if (leaderY === -Infinity) leaderY = this.smLeaderY; // 칩이 없으면 기존 유지

    // 선두 스위치 히스테리시스: 접전에서 미세 추월이 매 프레임 반복되면 포커스 X가 좌우로
    // 튀며 "툭툭 끊기는" 모션이 된다. 새 선두가 기존 선두보다 LEADER_SWITCH_PX 이상
    // 확실히 앞설 때만 포커스를 넘긴다(포토피니시 판정·순위 로직과는 무관, 프레이밍 전용).
    if (leaderId && this.lastLeaderId && leaderId !== this.lastLeaderId) {
      const prev = chips.get(this.lastLeaderId);
      if (prev && prev.y <= finishLineY && leaderY - prev.y < this.LEADER_SWITCH_PX) {
        leaderId = this.lastLeaderId;
        leaderX = prev.x; leaderY = prev.y; leaderVyRaw = prev.vy ?? 0;
      }
    }

    // 완주자 락온(CROSS/LINGER) 또는 수동 칩 락온이 있으면 그 칩으로 선두 기준을 덮어씀
    if (this.focusChipId) {
      const fp = chips.get(this.focusChipId);
      if (fp) { leaderY = fp.y; leaderX = fp.x; leaderVyRaw = fp.vy ?? 0; }
    }

    // 선두 그룹 가중 중심 대신 1등 플레이어(leaderX)를 1순위로 추적하여 중구난방 방지
    const centroidX = leaderX;

    // Y축 속도: 워커가 준 실제 vy를 가볍게 스무딩(유한차분 지연 제거 → 예측 정확도↑)
    this.leaderVy = damp(this.leaderVy, leaderVyRaw, 12.0, dt);

    // 실제 속도 피드포워드로 카메라가 고속 낙하 선두를 놓치지 않도록 리드(Lead).
    // 슬로우모션 중에는 vy가 실시간 속도라 마블 실제 이동량보다 과하게 앞서 예측→끊김.
    // timeScaleCurrent를 곱해 슬로우 중 룩어헤드를 줄여 오버슈트/뚝뚝 끊김을 제거.
    const predictedY = leaderY + this.leaderVy * this.LOOKAHEAD_S * this.timeScaleCurrent;

    // 저상통과 → 떨림 제거
    this.smCentroidX = damp(this.smCentroidX, centroidX, this.CENTROID_K, dt);
    this.smLeaderY = this.hasLeader ? damp(this.smLeaderY, predictedY, this.LEADER_K, dt) : predictedY;
    this.hasLeader = true;

    const progress = this.smLeaderY / this.worldH;
    const playing = this.gameState === 'playing' || this.gameState === 'winner_declared';

    // ── 2) 모드 전이 ──
    if (this.mode === 'manual' && !this.scrubbing) {
      if (this.gameState === 'all_finished') {
        // 게임 종료 후에는 수동 모드 타이머를 무시하여 자유롭게 감상 가능
      } else if (performance.now() > this.manualExpireMs) {
        this.mode = this.gameState === 'idle' ? 'idle' : 'race';
        this.focusChipId = null;
      }
    }
    // 결착 구간(progress 기반 줌)은 우승 확정 전에만 감지
    if (this.mode !== 'finisher_focus' && !this.winnerDecided) {
      if (!this.leadBattle && progress >= this.LEAD_BATTLE_AT) this.leadBattle = true;
      if (this.leadBattle && progress < this.LEAD_BATTLE_AT - 0.05) this.leadBattle = false; // 히스테리시스
    }

    // ── 3) 시네마틱 비트 구동(레이싱 중에만) ──
    this.lastStandActive = playing && racingCount > 0 && racingCount <= 2;

    if (this.mode !== 'idle' && !(this.mode === 'manual')) {
      this.driveFinisherSequence(dt);

      // 선두 교체 하이라이트(후반부 + 쿨다운, 결승 연출/슬로우 중이 아닐 때만)
      if (
        leaderId && this.lastLeaderId && leaderId !== this.lastLeaderId &&
        progress >= 0.5 && this.overtakeCooldownT <= 0 &&
        this.finisherPhase === 'idle' && !this.anticipating && playing
      ) {
        this.zoomPunch = Math.max(this.zoomPunch, this.calm ? 0 : 0.09);
        this.addShake(6);
        this.overtakeCooldownT = this.OVERTAKE_CD_S;
      }

      // 결승 직전 APPROACH(적응형 슬로우+줌) 무장/해제 — 속도 적응 ETA + 히스테리시스
      const distToFinish = finishLineY - leaderY;
      const etaSpeed = Math.max(this.leaderVy, 200); // 멈춰있을 때 무한대 방지
      const eta = distToFinish > 0 ? distToFinish / etaSpeed : Infinity;
      const photoFinish = secondY > -Infinity && (leaderY - secondY) <= this.PHOTO_FINISH_PX;
      // 극도의 슬로우/줌은 모드별 실제 당첨자(nextFinishIsWinner)에게만 한정 — 접전/최후2인 확장 제거.
      const dramaWorthy = this.nextFinishIsWinner;
      if (this.finisherPhase === 'idle' && playing && !this.freeManual) {
        if (!this.anticipating) {
          if (eta <= this.ETA_ARM && distToFinish > 0 && dramaWorthy
              && this.anticipationCooldownT <= 0 && this.establishingT <= 0) {
            this.anticipating = true;
            this.anticipationT = 0;
            this.photoFinishActive = photoFinish; // arm 시 1회 확정(라이브 재판정 안 함 → 줌 튐 방지)
          }
        } else {
          this.anticipationT += dt;
          // 결승 임박(매우 가까움) 시엔 해제하지 않음 → 슬로우/줌이 통과 순간까지 지속되어 피크에 도달.
          const veryClose = distToFinish > 0 && distToFinish <= this.FINISH_LOCK_PX;
          // 해제: ETA가 릴리즈 임계 초과(선두 후퇴) 또는 스톨 가드 초과 → 정상 속도 복귀
          if (!veryClose && (eta > this.ETA_RELEASE || this.anticipationT > this.MAX_ANTICIPATION_S)) {
            this.anticipating = false;
            this.anticipationCooldownT = this.anticipationT > this.MAX_ANTICIPATION_S ? 1.2 : 0.4;
          }
        }
      }
      // APPROACH 진행도(ETA_ARM→0 을 0→1로 매핑, S자 이즈) — 슬로우/줌을 연속 심화.
      // 무장/해제 순간 램프가 0↔값으로 스냅하면 줌 타겟이 점프해 "툭" 끊기므로,
      // 램프 자체를 저역통과해 진입·이탈 모두 연속 곡선으로 만든다.
      const rampTarget = this.anticipating
        ? smoothstep(clamp01((this.ETA_ARM - eta) / this.ETA_ARM))
        : 0;
      this.anticipationRamp = damp(this.anticipationRamp, rampTarget, this.RAMP_K, dt);
    }
    if (leaderId) this.lastLeaderId = leaderId;

    // 시간배율 타겟 결정(통과 연출 중이 아닐 때만 — CROSS는 스냅 가속을 직접 세팅)
    if (this.finisherPhase === 'idle') {
      let tsT = 1.0;
      if (this.lastStandActive) tsT = this.lastStandScale;
      if (this.anticipating) tsT = lerp(1.0, this.slowmoScale, this.anticipationRamp); // 진행도 램프
      this.timeScaleTarget = playing ? tsT : 1.0;
    }

    // ── 4) 목표 {x, y, zoom} 결정 ──
    let targetX: number, targetY: number, targetZoom: number;

    if (this.mode === 'idle') {
      this.timeScaleTarget = 1.0;
      targetZoom = this.fitWidthZoom();
      targetX = this.worldW / 2;
      const visH = this.screenH / Math.max(targetZoom, 0.001);
      targetY = 50 - visH * 0.33;

      // 대기 상태에서는 떨림 보정 값들을 중앙/출발선으로 고정 (시작 시 부드러운 전환용)
      this.smCentroidX = targetX;
      this.smLeaderY = 50;
    } else if (this.mode === 'manual' && this.scrubbing) {
      // 스크럽 중엔 camX/Y가 이미 직접 동기화됨 → 목표=현재
      targetX = this.camX; targetY = this.camY; targetZoom = this.camZoom;
    } else if (this.mode === 'manual') {
      this.timeScaleTarget = 1.0;
      targetX = this.manualTargetX;
      targetY = this.focusChipId ? this.smLeaderY : this.manualTargetY;
      targetZoom = this.focusChipId ? 1.6 : Math.max(this.camZoom, this.fitWidthZoom());
    } else {
      // RACE / FINISHER 공통: 프레이밍 (스마트 줌 로직 + 시네마틱 비트 오버라이드)
      let packBackY = this.smLeaderY;
      for (const [, p] of chips) {
        // 선두보다 뒤에 있는 칩들 중 너무 멀리 떨어진 칩은 제외 (최대 1000px 뒤까지 고려)
        if (p.y < this.smLeaderY && p.y > this.smLeaderY - 1000) {
          if (p.y < packBackY) packBackY = p.y;
        }
      }

      let packSpan = this.smLeaderY - packBackY;
      packSpan = Math.max(200, Math.min(packSpan, 700));
      // 팩 스팬 저역통과: 칩이 1000px 창을 드나들거나 완주로 빠지면 packSpan이 이산 점프
      // → baseZoom이 튀며 하단부 실시간 줌이 "툭툭" 끊긴다. 스팬 자체를 부드럽게.
      this.smPackSpan = damp(this.smPackSpan, packSpan, 4.0, dt);

      // 경기 진행도에 따라 카메라가 서서히 줌인(기본 여백 감소): 초반 넓게, 후반 타이트하게.
      const progressFactor = clamp01(progress);
      const dynamicPadding = 500 - (progressFactor * 250);
      const fitPack = this.screenH / (this.smPackSpan + dynamicPadding);
      let baseZoom = this.clampZoom(fitPack);

      // 결착(progress) 줌 램프 — ANTICIPATION/통과 연출이 없을 때만(서로 싸우지 않게 일원화)
      if (this.leadBattle && !this.anticipating && this.finisherPhase === 'idle') {
        const t = clamp01((progress - this.LEAD_BATTLE_AT) / (0.99 - this.LEAD_BATTLE_AT));
        baseZoom = baseZoom + (this.battleZoom - baseZoom) * (t * t);
      }

      if (this.finisherPhase === 'climax') {
        // CROSS: 통과 순간 완주자를 결승선 아래로 따라가며 극대 줌(FINISH_ZOOM). 완주 VFX가 여기서 터짐.
        targetZoom = this.finishZoom;
        const visH = this.screenH / Math.max(targetZoom, 0.001);
        targetX = this.smCentroidX;
        targetY = this.smLeaderY - visH * this.LEADER_SCREEN_BIAS;
      } else if (this.finisherPhase === 'linger') {
        // LINGER(짧은 여운 → 연속 리포커스): 결승 지점 프레이밍에서 다음 주자 추적 프레이밍으로
        // S자 곡선 블렌드. 줌도 같은 곡선으로 극대 줌 → 추적 줌(baseZoom)으로 줌아웃 —
        // "확 축소"가 아니라 실제 카메라를 돌리듯 초점 이동과 줌아웃이 동시에 서서히 진행된다.
        // (focusChipId는 CROSS 종료 시 해제됨 → smCentroidX/smLeaderY가 이미 다음 선두를 향해 수렴 중)
        const lingerT = smoothstep(clamp01(this.finisherPhaseT / this.LINGER_S));
        targetZoom = lerp(this.finishZoom, baseZoom, lingerT);
        const visH = this.screenH / Math.max(targetZoom, 0.001);
        targetX = lerp(this.finishFocusX, this.smCentroidX, lingerT);
        targetY = lerp(this.finishLineY, this.smLeaderY, lingerT) - visH * this.LEADER_SCREEN_BIAS;
      } else if (this.finisherPhase === 'handoff') {
        // HANDOFF: LINGER 블렌드의 종점(다음 선두 추적 프레이밍)을 그대로 이어받아 활공.
        // 기존 fitWidthZoom()*1.2 과줌아웃(화면이 확 빠지는 점프)을 제거 — 추적 줌으로 자연 수렴.
        targetZoom = baseZoom;
        const visH = this.screenH / Math.max(targetZoom, 0.001);
        targetX = this.smCentroidX;
        targetY = this.smLeaderY - visH * this.LEADER_SCREEN_BIAS;
      } else if (this.anticipating && this.photoFinishActive) {
        // 포토피니시: 1·2위를 한 화면에 담는다(둘의 중앙, 둘 다 보이게 줌 완화)
        const dx = Math.abs(leaderX - secondX);
        const dyy = Math.abs(leaderY - secondY);
        const fitBothW = this.screenW / (dx + 340);
        const fitBothH = this.screenH / (dyy + 380);
        targetZoom = this.clampZoom(Math.min(fitBothW, fitBothH, this.battleZoom));
        targetX = (leaderX + secondX) / 2;
        targetY = (leaderY + secondY) / 2;
      } else if (this.anticipating) {
        // 단독 선두 APPROACH: baseZoom→FINISH_ZOOM 진행도 램프(연속 심화) + 하단 1/3
        targetZoom = lerp(baseZoom, this.finishZoom, this.anticipationRamp);
        const visH = this.screenH / Math.max(targetZoom, 0.001);
        targetX = this.smCentroidX;
        targetY = this.smLeaderY - visH * this.LEADER_SCREEN_BIAS;
      } else {
        // TRACKING — 1등을 하단 1/3 선에 고정
        targetZoom = baseZoom;
        const visH = this.screenH / Math.max(targetZoom, 0.001);
        targetX = this.smCentroidX;
        targetY = this.smLeaderY - visH * this.LEADER_SCREEN_BIAS;
      }
    }

    // 도달자 줌 펀치(감쇠)
    this.zoomPunch = damp(this.zoomPunch, 0, 6, dt);

    // ── 댐핑 강도 선택(휘프팬/오프닝) ──
    // 수직 캐치업은 SmoothDamp 스프링이 거리 비례로 자연 가속하므로 이진 부스트 불필요(제거).
    let currentPanK = this.PAN_K;
    let currentZoomK = this.establishingT > 0 ? this.ZOOM_K * 0.6 : this.ZOOM_K; // 오프닝은 완만한 푸시인
    // 결승 접근/통과 중엔 줌을 빠르게 수렴시켜 극대 줌에 실제로 도달(느린 ZOOM_K로는 창이 짧아 못 미침)
    if (this.anticipating || this.finisherPhase === 'climax') {
      currentZoomK = this.finishZoomK;
    }
    if (this.finisherPhase === 'handoff' || this.finisherPhase === 'linger') {
      // 리포커스 활공(LINGER 블렌드~HANDOFF 수렴): 조금 빠르되 연속적인 팬/줌아웃
      currentPanK = this.handoffPanK;
      currentZoomK = this.handoffZoomK;
    }

    // ── 사용자 줌 오버라이드: 추적 위치는 유지하되, 줌만 사용자 값으로 덮어씀 ──
    if (this.userZoomState === 'ZOOMING' || this.userZoomState === 'HOLDING') {
      targetZoom = this.userZoom;
      currentZoomK = 15.0; // 사용자 줌 입력은 지연 없이 즉각 반응
    }

    // ── 단일 댐핑 후 적용 ──
    this.shakeIntensity = damp(this.shakeIntensity, 0, 10, dt); // 셰이크 감쇠

    if (!(this.mode === 'manual' && this.scrubbing)) {
      const isReturning = this.userZoomState === 'RETURNING';
      const effectivePanK = isReturning ? this.PAN_RETURN_K : currentPanK;
      const effectiveZoomK = isReturning ? this.ZOOM_RETURN_K : currentZoomK;

      this.camX = damp(this.camX, targetX, effectivePanK, dt);
      // 수직: 레이스/결승 추적은 SmoothDamp(실제 vy 피드포워드가 targetY에 반영됨) — 저지연·무오버슈트
      const springY = (this.mode === 'race' || this.mode === 'finisher_focus') && !isReturning;
      if (springY) {
        let vertSmooth = this.VERT_SMOOTH_TIME;
        if (this.finisherPhase === 'handoff' || this.finisherPhase === 'linger') vertSmooth = this.HANDOFF_SMOOTH_TIME;
        else if (this.establishingT > 0) vertSmooth = 0.45; // 오프닝 완만한 푸시인
        this.camY = smoothDamp(this.camY, targetY, this.camVelYRef, vertSmooth, dt);
      } else {
        this.camVelYRef.v = 0; // 스프링 미사용 구간 진입/이탈 시 속도 리셋(복귀 점프 방지)
        this.camY = damp(this.camY, targetY, effectivePanK, dt);
      }
      this.camZoom = damp(this.camZoom, targetZoom, effectiveZoomK, dt);

      // ZOOMING/HOLDING: 댐핑 후 userZoom으로 스냅 (미세 오차 축적 방지)
      if ((this.userZoomState === 'ZOOMING' || this.userZoomState === 'HOLDING')
          && Math.abs(this.camZoom - this.userZoom) < 0.001) {
        this.camZoom = this.userZoom;
      }

      // RETURNING 완료 체크: 줌이 목표에 충분히 수렴하면 INACTIVE로
      if (isReturning && Math.abs(this.camZoom - targetZoom) < 0.01) {
        this.userZoomState = 'INACTIVE';
      }
    }

    // 사용자 줌이 활성일 때는 USER_ZOOM 범위(0.25~3.5) 사용, 비활성일 때는 자동 카메라 범위(clampZoom)
    let appliedZoom: number;
    if (this.userZoomState !== 'INACTIVE') {
      appliedZoom = Math.min(this.USER_ZOOM_MAX, Math.max(this.USER_ZOOM_MIN, this.camZoom + this.zoomPunch));
    } else {
      appliedZoom = this.clampZoom(this.camZoom + this.zoomPunch);
    }

    // 셰이크 적용
    let finalX = this.camX;
    let finalY = this.camY;
    if (this.shakeIntensity > 0.5) {
      finalX += (Math.random() - 0.5) * this.shakeIntensity;
      finalY += (Math.random() - 0.5) * this.shakeIntensity;
    }

    // ── 카메라 뷰포트 내부 자체 Clamp (배경 클리핑 방어 로직) ──
    // pixi-viewport clamp가 매 프레임 moveCenter로 인해 우회되는 현상을 막고,
    // 극단적인 셰이크/줌 변화 시 배경 아래로 캔버스(검은 박스)가 보이지 않게 막습니다.
    const visW = this.screenW / appliedZoom;
    const visH = this.screenH / appliedZoom;
    const minX = -200 + visW / 2;
    const maxX = this.worldW + 200 - visW / 2;
    const minY = -500 + visH / 2;
    const maxY = this.worldH + 200 - visH / 2; // PhysicsCanvas clamp 바운더리 일치

    // 화면이 허용된 맵 바운더리보다 더 클 경우 중앙에 고정, 아니면 Clamp 적용
    finalX = minX <= maxX ? Math.max(minX, Math.min(maxX, finalX)) : this.worldW / 2;
    finalY = minY <= maxY ? Math.max(minY, Math.min(maxY, finalY)) : (this.worldH - 300) / 2;

    this.vp.moveCenter(finalX, finalY);
    this.vp.scale.set(appliedZoom);
  }

  // ── 결승 연출 시퀀스(프레임 구동): 큐 소비 → CROSS(완주자 추적+극슬로우 유지) → LINGER(여운·정상속도 복귀) → HANDOFF(활공) → idle ──
  private driveFinisherSequence(dt: number) {
    if (this.finisherPhase === 'idle') {
      if (this.finisherQueue.length > 0) {
        const item = this.finisherQueue.shift()!;
        // 완주자를 락온해 CROSS 동안 결승선 아래까지 따라간다(통과 순간 부각).
        this.focusChipId = item.chipId || null;
        this.finishFocusX = item.crossX ?? this.smCentroidX; // 통과 지점 X(LINGER 고정용)
        this.mode = 'finisher_focus';
        this.finisherPhase = 'climax';
        this.finisherPhaseT = 0;
        this.anticipating = false;
        this.leadBattle = false;
        // 사용자 줌 강제 해제 (결정적 연출 우선)
        this.resetUserZoom();
        this.freeManual = false;
        // 통과 순간 = 극도의 슬로우 유지(가속 아님). 접근 슬로우에서 이어받아 급변 없이 피크 유지.
        this.timeScaleTarget = this.slowmoScale;
        this.timeScaleCurrent = Math.min(this.timeScaleCurrent, this.slowmoScale);
        this.zoomPunch = Math.max(this.zoomPunch, this.calm ? 0 : 0.08);
        this.addShake(5);
      }
      return;
    }

    this.finisherPhaseT += dt;
    if (this.finisherPhase === 'climax') {
      // CROSS(통과 순간 극슬로우 유지) → LINGER(결승선 여운)
      if (this.finisherPhaseT >= this.CLIMAX_S) {
        this.finisherPhase = 'linger';
        this.finisherPhaseT = 0;
        this.focusChipId = null;        // 락온 해제: LINGER는 결승선(고정 X)에 머무름
        this.timeScaleTarget = 1.0;     // 여운 동안 정상 속도로 부드럽게 복귀
      }
    } else if (this.finisherPhase === 'linger') {
      // LINGER(여운) → HANDOFF(다음 선두 복귀)
      if (this.finisherPhaseT >= this.LINGER_S) {
        this.finisherPhase = 'handoff';
        this.finisherPhaseT = 0;
      }
    } else if (this.finisherPhase === 'handoff') {
      if (this.finisherPhaseT >= this.HANDOFF_S) {
        this.finisherPhase = 'idle';
        this.finisherPhaseT = 0;
        if (this.finisherQueue.length === 0 && this.mode === 'finisher_focus') {
          this.mode = this.gameState === 'idle' ? 'idle' : 'race';
        }
      }
    }
  }

  // 시간배율을 타겟으로 부드럽게 이즈. 변화가 충분(또는 타겟 도달)할 때만 워커로 전송(메시지 스팸 방지).
  private tickTimeScale(dt: number) {
    if (this.fastForwardMultiplier > 1.0) {
      if (this.timeScaleSent !== this.fastForwardMultiplier) {
        this.timeScaleCurrent = this.fastForwardMultiplier;
        this.timeScaleTarget = this.fastForwardMultiplier;
        this.timeScaleSent = this.fastForwardMultiplier;
        this.setTimeScale(this.fastForwardMultiplier);
      }
      return;
    }

    this.timeScaleCurrent = damp(this.timeScaleCurrent, this.timeScaleTarget, this.TIMESCALE_K, dt);
    if (Math.abs(this.timeScaleCurrent - this.timeScaleTarget) < 0.012) {
      this.timeScaleCurrent = this.timeScaleTarget;
    }
    const reachedAndUnsent = this.timeScaleCurrent === this.timeScaleTarget && this.timeScaleSent !== this.timeScaleCurrent;
    if (Math.abs(this.timeScaleCurrent - this.timeScaleSent) >= 0.03 || reachedAndUnsent) {
      this.timeScaleSent = this.timeScaleCurrent;
      this.setTimeScale(this.timeScaleCurrent);
    }
  }

  // 시간배율 즉시 1.0 복원(수동 전환 등)
  private resetTimeScale() {
    this.timeScaleTarget = 1.0;
    this.timeScaleCurrent = 1.0;
    if (this.timeScaleSent !== 1.0) {
      this.timeScaleSent = 1.0;
      this.setTimeScale(1.0);
    }
  }

  // (결승선 직전까지) 가장 멀리 내려간 칩의 Y
  private frontRunnerY(chips: Map<string, { x: number; y: number }>): number {
    let y = -Infinity;
    const cap = this.worldH + 60;
    for (const [, p] of chips) if (p.y < cap && p.y > y) y = p.y;
    return y === -Infinity ? this.smLeaderY : y;
  }

  // 트랙 폭이 화면에 들어오는 줌(여백 포함 - 와이드 베이스 줌)
  private fitWidthZoom(): number {
    return this.screenW / (this.worldW + 800);
  }

  private clampZoom(z: number): number {
    const ceil = this.zoomCeiling; // 결승 연출 중엔 FINISH_ZOOM까지 허용
    const minZ = Math.min(this.fitWidthZoom(), ceil);
    return Math.min(ceil, Math.max(minZ, z));
  }
}
