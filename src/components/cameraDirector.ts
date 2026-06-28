import type { Viewport } from 'pixi-viewport';

// ──────────────────────────────────────────────────────────────────────────
// CameraDirector: 경기 카메라의 단일 두뇌.
//   - 매 프레임 "단 하나의" 목표 {x, y, zoom}을 정하고, 프레임레이트 독립 지수 댐핑으로
//     실제 뷰포트를 부드럽게 수렴시킨다(여러 스프링이 경합하던 '정신없음' 제거).
//   - 기본은 선두 그룹을 여유있게 담는 프레이밍. 결승 결착/우승자에서만 시네마틱 줌인+슬로모션.
//   - 슬로모션(SET_TIME_SCALE) 호출 소유자를 이 클래스 하나로 일원화한다.
//   - 미니맵 클릭-점프/드래그-스크럽 같은 수동 조작도 여기서 목표로 흡수(일정 시간 후 자동 복귀).
// ──────────────────────────────────────────────────────────────────────────

type Mode = 'idle' | 'race' | 'manual' | 'finisher_focus';

export interface CameraDirectorOpts {
  worldWidth: number;
  worldHeight: number;
  screenW: number;
  screenH: number;
  setTimeScale: (scale: number) => void;
}

// 프레임레이트 독립 지수 보간: dt(초)에 무관하게 일정한 "절반 도달 시간"을 보장.
function damp(cur: number, target: number, k: number, dt: number): number {
  return target + (cur - target) * Math.exp(-k * dt);
}

export class CameraDirector {
  private vp: Viewport;
  private worldW: number;
  private worldH: number;
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

  private mode: Mode = 'idle';
  private gameState: 'idle' | 'playing' | 'finished' = 'idle';
  private manualExpireMs = 0;
  private manualTargetX = 0;
  private manualTargetY = 0;
  private focusChipId: string | null = null; // 수동 칩 락온 / 우승자 락온
  private scrubbing = false;
  private freeManual = false; // 사용자가 메인 화면을 직접 드래그/핀치 중 → 카메라가 손을 뗌

  private slowMoActive = false;
  private leadBattle = false;
  private zoomPunch = 0; // 도달자 가벼운 줌 펀치(감쇠)
  private shakeIntensity = 0; // 스크린 셰이크 강도
  private winnerDecided = false; // 우승 확정 후엔 결착 시네마틱/슬로모션을 더 걸지 않고 남은 레이스만 추적
  private finisherQueue: { chipId: string }[] = [];
  private isProcessingFinisher = false;

  // ── 튜닝 상수 ──
  private readonly PAN_K = 5.0;          // 위치 댐핑 강도
  private readonly ZOOM_K = 3.0;         // 줌 댐핑 강도
  private readonly CENTROID_K = 3.0;     // 중심 X 저상통과
  private readonly LEADER_K = 7.0;       // 선두 Y 저상통과(반응성 위해 다소 빠르게)
  private readonly PACK_BAND = 700;      // 선두에서 이 거리(px) 안쪽을 '선두 그룹'으로 본다
  private readonly LEAD_BATTLE_AT = 0.86; // 진행도 이 이상이면 결착 줌인 시작
  private readonly SLOWMO_AT = 0.93;     // 진행도 이 이상이면 슬로모션
  private readonly MAX_ZOOM = 2.3;
  private readonly BATTLE_ZOOM = 1.95;
  private readonly WINNER_ZOOM = 2.15;

  constructor(vp: Viewport, opts: CameraDirectorOpts) {
    this.vp = vp;
    this.worldW = opts.worldWidth;
    this.worldH = opts.worldHeight;
    this.screenW = opts.screenW;
    this.screenH = opts.screenH;
    this.setTimeScale = opts.setTimeScale;
    this.camX = vp.center.x;
    this.camY = vp.center.y;
    this.camZoom = vp.scale.x || 1;
    this.smCentroidX = this.worldW / 2;
  }

  resize(screenW: number, screenH: number) {
    this.screenW = screenW;
    this.screenH = screenH;
  }

  setGameState(state: 'idle' | 'playing' | 'finished') {
    this.gameState = state;
    if (state === 'idle') {
      if (this.mode !== 'finisher_focus' && this.mode !== 'manual') {
        this.mode = 'idle';
      }
    } else if (state === 'playing') {
      if (this.mode === 'idle') {
        this.mode = 'race';
      }
    }
  }

  // 메인 뷰포트를 사용자가 직접 드래그/휠/핀치 → 카메라가 손을 떼고(자유 조작) 잠시 후 복귀
  notifyUserPan() {
    if (this.mode === 'finisher_focus') return;
    this.mode = 'manual';
    this.freeManual = true;
    this.focusChipId = null;
    this.manualExpireMs = performance.now() + 3500;
  }

  // 미니맵 탭 → 해당 좌표로 점프. chipId가 있으면 그 칩을 락온 추적.
  minimapJump(x: number, y: number, chipId: string | null) {
    if (this.mode === 'finisher_focus') return;
    this.mode = 'manual';
    this.freeManual = false;
    this.scrubbing = false;
    this.focusChipId = chipId;
    this.manualTargetX = x;
    this.manualTargetY = y;
    this.manualExpireMs = performance.now() + 3500;
  }

  // 미니맵 드래그 스크럽(1:1)
  minimapScrubStart() { if (this.mode !== 'finisher_focus') { this.mode = 'manual'; this.freeManual = false; this.scrubbing = true; this.focusChipId = null; } }
  minimapScrub(x: number, y: number) {
    if (this.mode === 'finisher_focus') return;
    this.scrubbing = true;
    this.manualTargetX = x;
    this.manualTargetY = y;
    // 스크럽은 즉시 동기화(스크롤바 느낌)
    this.camX = x;
    this.camY = y;
  }
  minimapScrubEnd() {
    this.scrubbing = false;
    this.manualExpireMs = performance.now() + 2500;
  }

  // 도달자 가벼운 줌 펀치(감쇠)
  flashFinisher() {
    this.zoomPunch = Math.max(this.zoomPunch, 0.18);
  }

  // 스크린 셰이크 효과
  addShake(intensity: number) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  // 개별 피니셔 포커싱 및 슬로우 모션 큐잉
  focusNextFinisher(chipId: string) {
    this.finisherQueue.push({ chipId });
    if (!this.isProcessingFinisher) {
      this.processNextFinisher();
    }
  }

  private processNextFinisher() {
    if (this.finisherQueue.length === 0) {
      this.isProcessingFinisher = false;
      if (this.mode === 'finisher_focus') {
        this.mode = 'race';
        this.focusChipId = null;
      }
      return;
    }

    this.isProcessingFinisher = true;
    const finisher = this.finisherQueue.shift()!;
    this.mode = 'finisher_focus';
    this.focusChipId = finisher.chipId;
    this.leadBattle = false; // 결착 연출 중지

    // 0.8초간 슬로우 모션
    this.setTimeScale(0.35);
    this.slowMoActive = true;

    setTimeout(() => {
      if (this.slowMoActive) {
        this.setTimeScale(1.0);
        this.slowMoActive = false;
      }
    }, 800);

    // 1.5초 후 다음 피니셔 처리 (다이나믹 줌아웃-줌인 호흡)
    setTimeout(() => {
      // 다음 타겟으로 가기 전에 줌아웃 효과를 위해 잠시 focus 해제
      this.focusChipId = null; 
      setTimeout(() => {
        this.processNextFinisher();
      }, 300); // 0.3초 줌아웃 호흡 후 다음 포커스
    }, 1500);
  }

  getState() {
    return { x: this.vp.center.x, y: this.vp.center.y, zoom: this.vp.scale.x };
  }

  // 매 프레임 호출. chips: 활성 칩 위치 맵, leaderHintId: 랭킹 1위 힌트(없어도 됨)
  update(dtSec: number, chips: Map<string, { x: number; y: number }>, leaderHintId: string | null) {
    void leaderHintId;
    const dt = Math.min(Math.max(dtSec, 0.001), 0.05);

    // 자유 수동(메인 화면 직접 조작) 중에는 카메라가 손을 뗀다(pixi-viewport가 처리).
    // 단, 결착 구간/타임아웃이 오면 즉시 복귀(현재 뷰 상태를 동기화해 점프 없이 이어받음).
    if (this.mode === 'manual' && this.freeManual) {
      const leaderYNow = this.frontRunnerY(chips);
      const nearFinish = leaderYNow / this.worldH >= this.LEAD_BATTLE_AT;
      if (performance.now() > this.manualExpireMs || nearFinish) {
        this.camX = this.vp.center.x; this.camY = this.vp.center.y; this.camZoom = this.vp.scale.x;
        this.mode = 'race'; this.freeManual = false;
      } else {
        return; // 손 뗌
      }
    }

    // ── 1) 선두 그룹 산출 ──
    // 선두 = (결승선 직전까지) 가장 멀리 내려간 칩. finished(아래로 빠진) 칩은 제외.
    let leaderY = -Infinity;
    let leaderX = this.smCentroidX;
    const racingMaxY = this.worldH + 60;
    for (const [, p] of chips) {
      if (p.y < racingMaxY && p.y > leaderY) { leaderY = p.y; leaderX = p.x; }
    }
    if (leaderY === -Infinity) {
      // 모두 결승선 통과 → 마지막 알려진 선두 유지 또는 가장 아래 칩
      for (const [, p] of chips) if (p.y > leaderY) { leaderY = p.y; leaderX = p.x; }
    }
    if (leaderY === -Infinity) leaderY = this.smLeaderY; // 칩이 없으면 기존 유지

    // 우승자/수동 칩 락온이 있으면 그 칩으로 선두 기준을 덮어씀
    if (this.focusChipId) {
      const fp = chips.get(this.focusChipId);
      if (fp) { leaderY = fp.y; leaderX = fp.x; }
    }

    // 선두 그룹 가중 중심 대신 1등 플레이어(leaderX)를 1순위로 추적하여 중구난방 방지
    const centroidX = leaderX;

    // 저상통과 → 떨림 제거
    this.smCentroidX = damp(this.smCentroidX, centroidX, this.CENTROID_K, dt);
    this.smLeaderY = this.hasLeader ? damp(this.smLeaderY, leaderY, this.LEADER_K, dt) : leaderY;
    this.hasLeader = true;

    const progress = this.smLeaderY / this.worldH;

    // ── 2) 모드 전이 ──
    if (this.mode === 'manual' && !this.scrubbing) {
      if (this.gameState === 'finished') {
        // 게임 종료 후에는 수동 모드 타이머를 무시하여 자유롭게 감상 가능
      } else if (performance.now() > this.manualExpireMs) {
        this.mode = this.gameState === 'idle' ? 'idle' : 'race';
        this.focusChipId = null;
      }
    }
    // 결착 구간/슬로모션은 우승 확정 전에만 감지
    if (this.mode !== 'finisher_focus' && !this.winnerDecided) {
      if (!this.leadBattle && progress >= this.LEAD_BATTLE_AT) this.leadBattle = true;
      if (this.leadBattle && progress < this.LEAD_BATTLE_AT - 0.05) this.leadBattle = false; // 히스테리시스
    }

    // ── 3) 목표 {x, y, zoom} 결정 ──
    let targetX: number, targetY: number, targetZoom: number;

    if (this.mode === 'idle') {
      targetZoom = this.fitWidthZoom();
      targetX = this.worldW / 2;
      const visH = this.screenH / Math.max(targetZoom, 0.001);
      targetY = 50 - visH * 0.12;
      
      // 대기 상태에서는 떨림 보정 값들을 중앙/출발선으로 고정 (시작 시 부드러운 전환용)
      this.smCentroidX = targetX;
      this.smLeaderY = 50;
    } else if (this.mode === 'manual' && this.scrubbing) {
      // 스크럽 중엔 camX/Y가 이미 직접 동기화됨 → 목표=현재
      targetX = this.camX; targetY = this.camY; targetZoom = this.camZoom;
    } else if (this.mode === 'manual') {
      targetX = this.manualTargetX;
      targetY = this.focusChipId ? this.smLeaderY : this.manualTargetY;
      targetZoom = this.focusChipId ? 1.6 : Math.max(this.camZoom, this.fitWidthZoom());
    } else {
      // RACE / FINISHER 공통: 프레이밍
      let packSpan = 240;
      // leaderY - packBackY 로직은 삭제했으므로 기본값 사용 (어차피 리더 중심으로 줌)
      const fitPack = this.screenH / (packSpan + 360); 
      let baseZoom = this.clampZoom(fitPack);

      if (this.mode === 'finisher_focus') {
        baseZoom = this.focusChipId ? this.WINNER_ZOOM : this.fitWidthZoom(); // 타겟 없으면 줌아웃 호흡
      } else if (this.leadBattle) {
        // 결착: 진행도 0.86→0.99 동안 baseZoom→BATTLE_ZOOM 으로 부드럽게 가중
        const t = Math.min(1, Math.max(0, (progress - this.LEAD_BATTLE_AT) / (0.99 - this.LEAD_BATTLE_AT)));
        baseZoom = baseZoom + (this.BATTLE_ZOOM - baseZoom) * (t * t);
      }
      targetZoom = baseZoom;

      targetX = this.smCentroidX;
      
      const visH = this.screenH / Math.max(targetZoom, 0.001);
      // 포커스/결승 접근 시 오프셋을 줄여 화면 정중앙~살짝 아래(0.05)에 배치
      const yOffset = (this.mode === 'finisher_focus' || this.leadBattle) ? visH * 0.05 : visH * 0.12;
      targetY = this.smLeaderY - yOffset;
    }

    // 도달자 줌 펀치(감쇠)
    this.zoomPunch = damp(this.zoomPunch, 0, 6, dt);

    // ── 선두 이탈 방지 (Catch-up) ──
    let currentPanK = this.PAN_K;
    const distY = targetY - this.camY;
    if (distY > this.screenH * 0.5 && this.mode === 'race') {
      // 선두가 화면 밑으로 도망가면 카메라 속도 부스트
      currentPanK = this.PAN_K * 2.5;
    }

    // ── 4) 단일 댐핑 후 적용 ──
    this.shakeIntensity = damp(this.shakeIntensity, 0, 10, dt); // 셰이크 감쇠
    
    if (!(this.mode === 'manual' && this.scrubbing)) {
      this.camX = damp(this.camX, targetX, currentPanK, dt);
      this.camY = damp(this.camY, targetY, currentPanK, dt);
      this.camZoom = damp(this.camZoom, targetZoom, this.ZOOM_K, dt);
    }

    const appliedZoom = this.clampZoom(this.camZoom + this.zoomPunch);
    
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

  // (결승선 직전까지) 가장 멀리 내려간 칩의 Y
  private frontRunnerY(chips: Map<string, { x: number; y: number }>): number {
    let y = -Infinity;
    const cap = this.worldH + 60;
    for (const [, p] of chips) if (p.y < cap && p.y > y) y = p.y;
    return y === -Infinity ? this.smLeaderY : y;
  }

  // 트랙 폭이 화면에 들어오는 줌(여백 포함)
  private fitWidthZoom(): number {
    return this.screenW / (this.worldW + 120);
  }

  private clampZoom(z: number): number {
    const minZ = Math.min(this.fitWidthZoom(), this.MAX_ZOOM);
    return Math.min(this.MAX_ZOOM, Math.max(minZ, z));
  }
}
