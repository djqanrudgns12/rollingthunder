import type { Viewport } from 'pixi-viewport';

// ──────────────────────────────────────────────────────────────────────────
// CameraDirector: 경기 카메라의 단일 두뇌.
//   - 매 프레임 "단 하나의" 목표 {x, y, zoom}을 정하고, 프레임레이트 독립 지수 댐핑으로
//     실제 뷰포트를 부드럽게 수렴시킨다(여러 스프링이 경합하던 '정신없음' 제거).
//   - 기본은 선두 그룹을 여유있게 담는 프레이밍. 결승 결착/우승자에서만 시네마틱 줌인+슬로모션.
//   - 슬로모션(SET_TIME_SCALE) 호출 소유자를 이 클래스 하나로 일원화한다.
//   - 미니맵 클릭-점프/드래그-스크럽 같은 수동 조작도 여기서 목표로 흡수(일정 시간 후 자동 복귀).
// ──────────────────────────────────────────────────────────────────────────

type Mode = 'race' | 'manual' | 'winner';

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

  private mode: Mode = 'race';
  private manualExpireMs = 0;
  private manualTargetX = 0;
  private manualTargetY = 0;
  private focusChipId: string | null = null; // 수동 칩 락온 / 우승자 락온
  private scrubbing = false;
  private freeManual = false; // 사용자가 메인 화면을 직접 드래그/핀치 중 → 카메라가 손을 뗌

  private slowMoActive = false;
  private leadBattle = false;
  private zoomPunch = 0; // 도달자 가벼운 줌 펀치(감쇠)

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

  // 메인 뷰포트를 사용자가 직접 드래그/휠/핀치 → 카메라가 손을 떼고(자유 조작) 잠시 후 복귀
  notifyUserPan() {
    if (this.mode === 'winner') return;
    this.mode = 'manual';
    this.freeManual = true;
    this.focusChipId = null;
    this.manualExpireMs = performance.now() + 3500;
  }

  // 미니맵 탭 → 해당 좌표로 점프. chipId가 있으면 그 칩을 락온 추적.
  minimapJump(x: number, y: number, chipId: string | null) {
    if (this.mode === 'winner') return;
    this.mode = 'manual';
    this.freeManual = false;
    this.scrubbing = false;
    this.focusChipId = chipId;
    this.manualTargetX = x;
    this.manualTargetY = y;
    this.manualExpireMs = performance.now() + 3500;
  }

  // 미니맵 드래그 스크럽(1:1)
  minimapScrubStart() { if (this.mode !== 'winner') { this.mode = 'manual'; this.freeManual = false; this.scrubbing = true; this.focusChipId = null; } }
  minimapScrub(x: number, y: number) {
    if (this.mode === 'winner') return;
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

  // 도달자(우승 아님) 가벼운 강조: 짧은 줌 펀치(슬로모션 없음)
  flashFinisher() {
    this.zoomPunch = Math.max(this.zoomPunch, 0.18);
  }

  // 우승 확정: 우승자 락온 + 최대 줌 + 슬로모션 비트
  triggerWinner(winnerId: string | null) {
    this.mode = 'winner';
    this.focusChipId = winnerId;
    this.leadBattle = true;
    this.setTimeScale(0.25);
    this.slowMoActive = true;
    // 우승 여운 후 정상 속도 복귀
    setTimeout(() => { if (this.slowMoActive) { this.setTimeScale(1.0); this.slowMoActive = false; } }, 1500);
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

    // 선두 그룹 가중 중심 X(선두에 가까울수록 큰 가중) + 후미 Y
    let sumW = 0, sumX = 0, packBackY = leaderY;
    for (const [, p] of chips) {
      const d = leaderY - p.y;
      if (d >= -60 && d <= this.PACK_BAND) {
        const w = 1 - Math.max(0, d) / this.PACK_BAND; // 0..1
        sumW += w; sumX += p.x * w;
        if (p.y < packBackY) packBackY = p.y;
      }
    }
    const centroidX = sumW > 0 ? sumX / sumW : leaderX;

    // 저상통과 → 떨림 제거
    this.smCentroidX = damp(this.smCentroidX, centroidX, this.CENTROID_K, dt);
    this.smLeaderY = this.hasLeader ? damp(this.smLeaderY, leaderY, this.LEADER_K, dt) : leaderY;
    this.hasLeader = true;

    const progress = this.smLeaderY / this.worldH;

    // ── 2) 모드 전이 ──
    if (this.mode === 'manual' && !this.scrubbing && performance.now() > this.manualExpireMs) {
      this.mode = 'race';
      this.focusChipId = null;
    }
    // 결착 구간/슬로모션은 race·manual 어디서든 감지(winner 제외 전이는 GAME_OVER가 담당)
    if (this.mode !== 'winner') {
      if (!this.leadBattle && progress >= this.LEAD_BATTLE_AT) this.leadBattle = true;
      if (this.leadBattle && progress < this.LEAD_BATTLE_AT - 0.05) this.leadBattle = false; // 히스테리시스
      if (!this.slowMoActive && progress >= this.SLOWMO_AT) { this.slowMoActive = true; this.setTimeScale(0.45); }
      if (this.slowMoActive && progress < this.SLOWMO_AT - 0.03) { this.slowMoActive = false; this.setTimeScale(1.0); }
    }

    // ── 3) 목표 {x, y, zoom} 결정 ──
    let targetX: number, targetY: number, targetZoom: number;

    if (this.mode === 'manual' && this.scrubbing) {
      // 스크럽 중엔 camX/Y가 이미 직접 동기화됨 → 목표=현재
      targetX = this.camX; targetY = this.camY; targetZoom = this.camZoom;
    } else if (this.mode === 'manual') {
      targetX = this.manualTargetX;
      targetY = this.focusChipId ? this.smLeaderY : this.manualTargetY;
      targetZoom = this.focusChipId ? 1.6 : Math.max(this.camZoom, this.fitWidthZoom());
    } else {
      // RACE / WINNER 공통: 선두 그룹 프레이밍
      const packSpan = Math.max(leaderY - packBackY, 240);
      const fitPack = this.screenH / (packSpan + 360); // 그룹+여백이 화면에 담기는 줌
      let baseZoom = this.clampZoom(fitPack);

      if (this.mode === 'winner') {
        baseZoom = this.WINNER_ZOOM;
      } else if (this.leadBattle) {
        // 결착: 진행도 0.86→0.99 동안 baseZoom→BATTLE_ZOOM 으로 부드럽게 가중
        const t = Math.min(1, Math.max(0, (progress - this.LEAD_BATTLE_AT) / (0.99 - this.LEAD_BATTLE_AT)));
        baseZoom = baseZoom + (this.BATTLE_ZOOM - baseZoom) * (t * t);
      }
      targetZoom = baseZoom;

      targetX = this.smCentroidX;
      // 선두가 화면 하단 ~62%에 오도록(앞을 더 보여줌). 가시 높이의 일부만큼 위로 센터.
      const visH = this.screenH / Math.max(targetZoom, 0.001);
      targetY = this.smLeaderY - visH * 0.12;
    }

    // 도달자 줌 펀치(감쇠)
    this.zoomPunch = damp(this.zoomPunch, 0, 6, dt);

    // ── 4) 단일 댐핑 후 적용 ──
    if (!(this.mode === 'manual' && this.scrubbing)) {
      this.camX = damp(this.camX, targetX, this.PAN_K, dt);
      this.camY = damp(this.camY, targetY, this.PAN_K, dt);
      this.camZoom = damp(this.camZoom, targetZoom, this.ZOOM_K, dt);
    }

    const appliedZoom = this.clampZoom(this.camZoom + this.zoomPunch);
    this.vp.moveCenter(this.camX, this.camY);
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
