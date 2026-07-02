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
// 결승 연출 비트(레이싱 중에만 활성). 'tracking'은 평상 추적.
type FinisherPhase = 'idle' | 'climax' | 'handoff';
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
  private lastLeaderY = 0;
  private leaderVy = 0;

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
  private finisherQueue: { chipId: string }[] = [];
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

  // ── 사용자 줌 상태 ──
  private userZoomState: UserZoomState = 'INACTIVE';
  private userZoom = 1.0;             // 사용자가 설정한 줌 레벨
  private lastUserZoomMs = 0;         // 마지막 줌 입력 시각 (디바운스용)
  private holdStartMs = 0;            // HOLDING 진입 시각

  // 시간 배율(슬로모션/가속): 부드럽게 이즈, 변화가 충분할 때만 워커로 전송
  private timeScaleCurrent = 1.0;
  private timeScaleTarget = 1.0;
  private timeScaleSent = 1.0;
  private isFastForward = false;

  // ── 튜닝 상수 ──
  private readonly PAN_K = 15.0;         // 위치 댐핑 강도 (초정밀 추적)
  private readonly ZOOM_K = 2.0;         // 줌 댐핑 강도 (부드럽게 줌인)
  private readonly CENTROID_K = 15.0;    // 중심 X 저상통과 (정밀 추적)
  private readonly LEADER_K = 18.0;      // 선두 Y 저상통과 (빠른 반응)
  private readonly LEAD_BATTLE_AT = 0.86; // 진행도 이 이상이면 결착 줌인 시작
  private readonly MAX_ZOOM = 3.5;       // 극대 확대
  private readonly BATTLE_ZOOM = 2.0;
  private readonly WINNER_ZOOM = 3.5;    // 극도의 줌인

  // 사용자 줌 튜닝
  private readonly USER_ZOOM_MIN = 0.25;      // 사용자 줌 최소 (맵 전체 조감)
  private readonly USER_ZOOM_MAX = 3.5;       // 사용자 줌 최대
  private readonly ZOOM_DEBOUNCE_MS = 300;    // ZOOMING→HOLDING 전환 대기
  private readonly ZOOM_HOLD_S = 5.0;         // HOLDING 유지 시간 (playing)
  private readonly ZOOM_HOLD_IDLE_S = 2.0;    // HOLDING 유지 시간 (idle)
  private readonly ZOOM_RETURN_K = 1.5;       // 복귀 줌 댐핑
  private readonly PAN_RETURN_K = 2.0;        // 복귀 위치 댐핑

  // 시네마틱 비트 튜닝
  private readonly IMMINENT_PX = 1500;       // 결승선까지 이 거리 안이면 ETA 체크
  private readonly PHOTO_FINISH_PX = 130;    // 1·2위 Y간격 이 이내면 접전(포토피니시)
  private readonly SLOWMO_SCALE = 0.15;      // 극도의 슬로우 모션 배율
  private readonly LASTSTAND_SCALE = 0.55;   // 마지막 주자 추적 슬로모션(완만)
  private readonly RELEASE_SCALE = 1.12;     // 통과 순간 스냅 가속 펀치(완화: 1.18→1.12)
  private readonly MAX_ANTICIPATION_S = 1.2; // 슬로우 최대 지속(스톨 가드)
  private readonly CLIMAX_S = 0.55;          // 통과자 락온 유지 시간
  private readonly HANDOFF_S = 0.5;          // 다음 주자 휘프팬 시간
  private readonly ESTABLISH_S = 1.0;        // 오프닝 푸시인 시간
  private readonly OVERTAKE_CD_S = 1.5;      // 선두 교체 하이라이트 쿨다운
  private readonly TIMESCALE_K = 9.0;        // 시간배율 이즈 강도
  private readonly HANDOFF_PAN_K = 9.0;      // 휘프팬 위치 댐핑(빠른 스냅, 완화: 11→9)
  private readonly HANDOFF_ZOOM_K = 6.0;     // 휘프팬 줌 댐핑(완화: 7→6)

  // ── 차분 모드(calmMode) 저모션 세트(Tier 2). OFF면 위 Tier1 기본값 사용 ──
  private calm = false;                       // update() 시작 시 매 프레임 캐시
  private readonly CALM_SLOWMO_SCALE = 0.7;   // 슬로모션 급락 완화(전정계 자극 저감)
  private readonly CALM_LASTSTAND_SCALE = 0.8;
  private readonly CALM_RELEASE_SCALE = 1.0;  // 통과 순간 스냅 펀치 제거
  private readonly CALM_MAX_ZOOM = 1.4;       // 얕은 줌 상한
  private readonly CALM_BATTLE_ZOOM = 1.35;
  private readonly CALM_WINNER_ZOOM = 1.4;
  private readonly CALM_ESTABLISH_S = 0.4;    // 오프닝 스윕 완화
  // 저모션 게터: this.calm에 따라 상수 선택(update 경유 호출 전체에 일관 적용)
  private get maxZoom() { return this.calm ? this.CALM_MAX_ZOOM : this.MAX_ZOOM; }
  private get battleZoom() { return this.calm ? this.CALM_BATTLE_ZOOM : this.BATTLE_ZOOM; }
  private get winnerZoom() { return this.calm ? this.CALM_WINNER_ZOOM : this.WINNER_ZOOM; }
  private get slowmoScale() { return this.calm ? this.CALM_SLOWMO_SCALE : this.SLOWMO_SCALE; }
  private get lastStandScale() { return this.calm ? this.CALM_LASTSTAND_SCALE : this.LASTSTAND_SCALE; }
  private get releaseScale() { return this.calm ? this.CALM_RELEASE_SCALE : this.RELEASE_SCALE; }
  private get handoffPanK() { return this.calm ? this.PAN_K : this.HANDOFF_PAN_K; } // 차분: 급스냅 휘프팬 제거
  private get handoffZoomK() { return this.calm ? this.ZOOM_K : this.HANDOFF_ZOOM_K; }

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

  setFastForward(active: boolean) {
    this.isFastForward = active;
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

  // 스크린 셰이크 효과
  addShake(intensity: number) {
    const s = useGameStore.getState();
    if (!s.isScreenShakeEnabled || s.calmMode) return; // 차분 모드에서도 셰이크 억제
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  // PhysicsCanvas가 게임 로직(모드/목표 등수)으로 계산해 알려주는 드라마 컨텍스트.
  // 다음 완주자가 "우승 슬롯"인지 여부 → 결승 직전 ANTICIPATION 게이팅에 사용.
  setDrama(nextFinishIsWinner: boolean) {
    this.nextFinishIsWinner = nextFinishIsWinner;
    this.winnerDecided = !nextFinishIsWinner;
  }

  // 완주 발생 → 결승 연출 큐잉. dramatic=false(중상위권 다수)면 무거운 락온/슬로우 없이
  // 가벼운 줌 펀치만 주어 템포를 유지한다("핵심 순간만" 정책).
  focusNextFinisher(chipId: string, dramatic: boolean) {
    this.flashFinisher();
    if (dramatic || this.lastStandActive) {
      this.finisherQueue.push({ chipId });
    }
  }

  getState() {
    return { x: this.vp.center.x, y: this.vp.center.y, zoom: this.vp.scale.x };
  }

  // 매 프레임 호출. chips: 활성 칩 위치 맵, leaderHintId: 랭킹 1위 힌트(없어도 됨)
  update(dtSec: number, chips: Map<string, { x: number; y: number }>, leaderHintId: string | null) {
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
    const finishLineY = this.finishLineY; // PRD v6.0
    const racingCap = this.worldH + 60;
    let leaderY = -Infinity, leaderX = this.smCentroidX, leaderId: string | null = null;
    let secondY = -Infinity, secondX = this.smCentroidX;
    let racingCount = 0;
    for (const [id, p] of chips) {
      if (p.y <= finishLineY) {
        racingCount++; // 아직 결승선 통과 전 = 레이싱 중
        if (p.y > leaderY) {
          secondY = leaderY; secondX = leaderX;
          leaderY = p.y; leaderX = p.x; leaderId = id;
        } else if (p.y > secondY) {
          secondY = p.y; secondX = p.x;
        }
      }
    }
    if (leaderY === -Infinity) {
      // 모두 결승선 통과 → 마지막 알려진 선두 유지 또는 가장 아래 칩
      for (const [, p] of chips) if (p.y > leaderY) { leaderY = p.y; leaderX = p.x; }
    }
    if (leaderY === -Infinity) leaderY = this.smLeaderY; // 칩이 없으면 기존 유지

    // 우승자/수동 칩 락온이 있으면 그 칩으로 선두 기준을 덮어씀(climax 중 통과자 추적)
    if (this.focusChipId) {
      const fp = chips.get(this.focusChipId);
      if (fp) { leaderY = fp.y; leaderX = fp.x; }
    }

    // 선두 그룹 가중 중심 대신 1등 플레이어(leaderX)를 1순위로 추적하여 중구난방 방지
    const centroidX = leaderX;

    // Y축 속도 계산 및 저상통과 (정밀 예측 추적용)
    let currentLeaderVy = 0;
    if (this.lastLeaderId === leaderId && dt > 0) {
      currentLeaderVy = (leaderY - this.lastLeaderY) / dt;
    }
    this.leaderVy = damp(this.leaderVy, currentLeaderVy, 10.0, dt);
    this.lastLeaderY = leaderY;

    // 예측 좌표를 이용해 카메라가 플레이어를 절대 놓치지 않도록 리드(Lead)
    const predictedY = leaderY + this.leaderVy * 0.05;

    // 저상통과 → 떨림 제거
    this.smCentroidX = damp(this.smCentroidX, centroidX, this.CENTROID_K, dt);
    this.smLeaderY = this.hasLeader ? damp(this.smLeaderY, predictedY, this.LEADER_K, dt) : leaderY;
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

      // 결승 직전 ANTICIPATION 무장/해제(통과 연출이 진행 중이 아닐 때만)
      const distToFinish = finishLineY - leaderY;
      const etaSpeed = Math.max(this.leaderVy, 200); // 멈춰있을 때 무한대 방지
      const eta = distToFinish / etaSpeed;
      const imminent = distToFinish > 0 && distToFinish <= this.IMMINENT_PX && eta <= 2.5;
      const photoFinish = secondY > -Infinity && (leaderY - secondY) <= this.PHOTO_FINISH_PX;
      const dramaWorthy = this.nextFinishIsWinner || photoFinish || this.lastStandActive;
      if (this.finisherPhase === 'idle' && playing && !this.freeManual) {
        if (!this.anticipating) {
          if (imminent && dramaWorthy && this.anticipationCooldownT <= 0 && this.establishingT <= 0) {
            this.anticipating = true;
            this.anticipationT = 0;
            this.photoFinishActive = photoFinish;
          }
        } else {
          this.anticipationT += dt;
          this.photoFinishActive = photoFinish; // 프레이밍은 라이브로 갱신
          if (!imminent || this.anticipationT > this.MAX_ANTICIPATION_S) {
            // 선두 후퇴(짧은 쿨다운) 또는 스톨(긴 쿨다운) → 정상 속도 복귀
            this.anticipating = false;
            this.anticipationCooldownT = this.anticipationT > this.MAX_ANTICIPATION_S ? 1.2 : 0.4;
          }
        }
      }
    }
    if (leaderId) this.lastLeaderId = leaderId;

    // 시간배율 타겟 결정(통과 연출 중이 아닐 때만 — climax는 스냅 가속을 직접 세팅)
    if (this.finisherPhase === 'idle') {
      let tsT = 1.0;
      if (this.lastStandActive) tsT = this.lastStandScale;
      if (this.anticipating) tsT = this.slowmoScale;
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

      // 경기 진행도에 따라 카메라가 서서히 줌인(기본 여백 감소): 초반 넓게, 후반 타이트하게.
      const progressFactor = clamp01(progress);
      const dynamicPadding = 500 - (progressFactor * 250);
      const fitPack = this.screenH / (packSpan + dynamicPadding);
      let baseZoom = this.clampZoom(fitPack);

      // 결착(progress) 줌 램프 — ANTICIPATION/통과 연출이 없을 때만(서로 싸우지 않게 일원화)
      if (this.leadBattle && !this.anticipating && this.finisherPhase === 'idle') {
        const t = clamp01((progress - this.LEAD_BATTLE_AT) / (0.99 - this.LEAD_BATTLE_AT));
        baseZoom = baseZoom + (this.battleZoom - baseZoom) * (t * t);
      }

      if (this.finisherPhase === 'climax') {
        // 통과 순간: 결승선 부근을 가장 타이트하게(WINNER_ZOOM) 잡는다 — 완주 VFX(파티클/등수)가 여기서 터짐.
        targetZoom = this.winnerZoom;
        const visH = this.screenH / Math.max(targetZoom, 0.001);
        targetX = this.smCentroidX;
        targetY = this.smLeaderY - visH * 0.33;
      } else if (this.finisherPhase === 'handoff') {
        // 호흡: 한 단계 빠지며 다음 선두로 휘프팬
        targetZoom = Math.min(baseZoom, this.clampZoom(this.fitWidthZoom() * 1.2));
        const visH = this.screenH / Math.max(targetZoom, 0.001);
        targetX = this.smCentroidX;
        targetY = this.smLeaderY - visH * 0.33;
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
        // 단독 선두 결승 직전: WINNER_ZOOM 푸시인 + 화면 정중앙 아래(1/3)
        targetZoom = this.winnerZoom;
        const visH = this.screenH / Math.max(targetZoom, 0.001);
        targetX = this.smCentroidX;
        targetY = this.smLeaderY - visH * 0.33;
      } else {
        // TRACKING
        targetZoom = baseZoom;
        const visH = this.screenH / Math.max(targetZoom, 0.001);
        targetX = this.smCentroidX;
        targetY = this.smLeaderY - visH * 0.33;
      }
    }

    // 도달자 줌 펀치(감쇠)
    this.zoomPunch = damp(this.zoomPunch, 0, 6, dt);

    // ── 댐핑 강도 선택(휘프팬/오프닝/캐치업) ──
    let currentPanK = this.PAN_K;
    let currentZoomK = this.establishingT > 0 ? this.ZOOM_K * 0.6 : this.ZOOM_K; // 오프닝은 완만한 푸시인
    const distY = targetY - this.camY;
    if (distY > this.screenH * 0.5 && this.mode !== 'manual') {
      // 선두가 화면 밑으로 도망가면 카메라 속도 부스트
      currentPanK = this.PAN_K * 2.5;
    }
    if (this.finisherPhase === 'handoff') {
      // 다음 주자로 빠르게 스냅(휘프팬)
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
      this.camY = damp(this.camY, targetY, effectivePanK, dt);
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

    this.vp.moveCenter(finalX, finalY);
    this.vp.scale.set(appliedZoom);
  }

  // ── 결승 연출 시퀀스(프레임 구동): 큐 소비 → CLIMAX(스냅 가속) → HANDOFF(휘프팬) → idle ──
  private driveFinisherSequence(dt: number) {
    if (this.finisherPhase === 'idle') {
      if (this.finisherQueue.length > 0) {
        this.finisherQueue.shift();
        // 통과 직후 결승선 부근을 잡는다(아래 climax 프레이밍이 finishLineY를 직접 사용).
        // 완주 칩은 이미 결승선 아래로 빠졌으므로 락온하지 않는다.
        this.focusChipId = null;
        this.mode = 'finisher_focus';
        this.finisherPhase = 'climax';
        this.finisherPhaseT = 0;
        this.anticipating = false;
        this.leadBattle = false;
        // 사용자 줌 강제 해제 (결정적 연출 우선)
        this.resetUserZoom();
        this.freeManual = false;
        // 통과 순간 = 갑자기 빨라짐: 시간배율을 즉시 1.0 위로 펀치 후 1.0로 정착
        this.timeScaleCurrent = this.releaseScale;
        this.timeScaleSent = this.releaseScale;
        this.setTimeScale(this.releaseScale);
        this.timeScaleTarget = 1.0;
        this.zoomPunch = Math.max(this.zoomPunch, this.calm ? 0 : 0.14);
        this.addShake(14);
      }
      return;
    }

    this.finisherPhaseT += dt;
    if (this.finisherPhase === 'climax') {
      if (this.finisherPhaseT >= this.CLIMAX_S) {
        this.finisherPhase = 'handoff';
        this.finisherPhaseT = 0;
        this.focusChipId = null; // 호흡 → 다음 선두로 휘프팬
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
    if (this.isFastForward) {
      if (this.timeScaleSent !== 2.0) {
        this.timeScaleCurrent = 2.0;
        this.timeScaleTarget = 2.0;
        this.timeScaleSent = 2.0;
        this.setTimeScale(2.0);
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
    const minZ = Math.min(this.fitWidthZoom(), this.maxZoom);
    return Math.min(this.maxZoom, Math.max(minZ, z));
  }
}
