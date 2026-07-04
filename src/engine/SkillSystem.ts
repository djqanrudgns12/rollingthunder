import RAPIER from '@dimforge/rapier2d-compat';
import { UserData } from './types';

// ──────────────────────────────────────────────────────────────────────────
// SkillSystem v2: 프레임 기반 지속 효과 아키텍처
//
// 왜 리팩터링했는가?
//   기존 setTimeout 기반 스킬 해제는 Web Worker의 이벤트 루프와 물리 엔진의
//   world.step()이 비동기로 작동하여 정확한 타이밍 보장이 불가능했다.
//   이제 모든 스킬 효과는 "발동 프레임 ~ 만료 프레임" 동안 매 step()마다
//   물리 속성을 적용/해제하는 프레임 동기 방식으로 작동한다.
// ──────────────────────────────────────────────────────────────────────────

export type SkillType = 'tank' | 'slime' | 'ghost' | 'magnet' | 'teleport' | 'booster' | 'none';

// 활성 스킬 엔트리: 매 프레임 순회하며 지속 효과 적용 + 만료 시 원상 복구
interface ActiveSkillEntry {
  skill: SkillType;
  chipId: string;
  startFrame: number;
  expireFrame: number;     // 이 프레임에 도달하면 해제
}

// ── 스킬별 밸런스 상수 ───────────────────────────────────────────────────

// 탱크: 무거운 불도저 돌파. v3 밸런스: 중력 8→3, 감쇠 0→0.12(폭주 방지),
//   반발 0.95→0.45("튀어오름" 완화). 여전히 무겁고 빠르되 화면 밖 이탈하지 않는다.
const TANK_GRAVITY_SCALE = 3.0;
const TANK_DAMPING = 0.12;
const TANK_RESTITUTION = 0.45;
const TANK_DURATION_FRAMES = 120;  // 2초

// 부스터: 하방 추진 엔진. v3 밸런스: 무한 가속(force 300/frame)이 fly-off 주범이었으므로
//   force를 50으로 낮추고 BOOSTER_TARGET_SPEED 거버너로 "타깃 속도까지 가속 후 유지"하게 한다.
const BOOSTER_FORCE_PER_FRAME = 50;   // ΔV/frame (질량 정규화됨) — 가속률만 담당
const BOOSTER_TARGET_SPEED = 1500;    // 하방 속도가 이 값 미만일 때만 추진 적용(무한 가속 제거)
const BOOSTER_DURATION_FRAMES = 90;   // 1.5초

// 유령화: 저중력 + 저감쇠 + 극저반발로 장애물을 스르르 통과
//   v3: 감쇠 0.02→0.08(무한 드리프트 방지, 저중력 부유감은 유지)
const GHOST_GRAVITY_SCALE = 0.3;
const GHOST_DAMPING = 0.08;
const GHOST_RESTITUTION = 0.05;
const GHOST_DURATION_FRAMES = 150;  // 2.5초

// 슬라임: 끈적한 통로 차단. v3 밸런스: 완전 정지(불합리)를 강한 감속으로 완화.
//   감쇠 2.0→0.9, 마찰 5.0→2.0(접착 고정 제거), 지속 3s→2s.
const SLIME_FRICTION = 2.0;
const SLIME_RESTITUTION = 0.0;
const SLIME_DAMPING = 0.9;
const SLIME_DURATION_FRAMES = 120;  // 2초

// 자석: 반경 내 타 칩을 끌어당기는 인력장. 발동자는 약간의 중력 이득.
//   v3: 세기 8→5, 반경 400→350, 지속 3s→2.5s로 광역 간섭/끌림 폭주 완화.
const MAGNET_RADIUS = 350;             // 인력 반경 (px)
const MAGNET_STRENGTH = 5.0;           // 인력 세기 (ΔV/frame)
const MAGNET_SELF_GRAVITY = 1.5;       // 발동자 중력 스케일
const MAGNET_UPWARD_DAMP = 0.3;        // 위로 끌어올리는 성분 감쇠 (정체 방지)
const MAGNET_DURATION_FRAMES = 150;    // 2.5초

// 순간이동: 1단계 상위 칩과 위치 스왑. 즉시 효과이므로 지속 프레임 불필요
//   v3: 워프 거리 300→180으로 "급소멸" 점프 폭 축소
const TELEPORT_WARP_DISTANCE = 180;    // 1등일 때 순간 워프 거리 (px)

// (제거됨) SKILL_COOLDOWNS: 주석과 달리 어디서도 참조하지 않는 죽은 export였음.
// 실제 발동 쿨타임은 physics.worker의 randomCooldown()(5~15초 균등)이 결정한다.

export class SkillSystem {
  // 현재 활성화된 스킬 엔트리 목록
  private static activeEntries: ActiveSkillEntry[] = [];

  // ── 물리 속성 재계산 (중복 스킬 대응) ──────────────────────────────
  public static recalcPhysics(body: RAPIER.RigidBody, chipId: string) {
    // 칩의 기본 물리 속성 (ChipFactory.ts 참조)
    let targetGravity = 1.0;
    let targetDamping = 0.18;
    let targetRestitution = 0.6;
    let targetFriction = 0.2;

    const activeSkills = this.activeEntries.filter(e => e.chipId === chipId).map(e => e.skill);

    // 우선순위가 높은 스킬이 덮어쓰도록 순차 적용 (또는 특정 스킬 특수 규칙)
    for (const skill of activeSkills) {
      if (skill === 'tank') {
        targetGravity = TANK_GRAVITY_SCALE;
        targetDamping = TANK_DAMPING;
        targetRestitution = TANK_RESTITUTION;
      } else if (skill === 'ghost') {
        targetGravity = GHOST_GRAVITY_SCALE;
        targetDamping = GHOST_DAMPING;
        targetRestitution = GHOST_RESTITUTION;
      } else if (skill === 'slime') {
        targetDamping = SLIME_DAMPING;
        targetFriction = SLIME_FRICTION;
        targetRestitution = SLIME_RESTITUTION;
      } else if (skill === 'magnet') {
        targetGravity = MAGNET_SELF_GRAVITY;
      }
    }

    try {
      body.setGravityScale(targetGravity, true);
      body.setLinearDamping(targetDamping);
      const collider = body.collider(0);
      if (collider) {
        collider.setRestitution(targetRestitution);
        collider.setFriction(targetFriction);
      }
    } catch (e) {
      // Body 해제된 경우 무시
    }
  }

  // ── 발동: 즉시 효과 적용 + 엔트리 등록 ────────────────────────────
  static triggerSkill(
    world: RAPIER.World,
    chipId: string,
    skill: SkillType,
    currentFrame: number,
    activeChips: RAPIER.RigidBody[],
    finishedChips?: Set<string>,
  ) {
    if (skill === 'none') return;

    // 동일 칩에 같은 스킬이 이미 활성 중이면 무시 (중복 발동 방지)
    if (this.activeEntries.some(e => e.chipId === chipId && e.skill === skill)) return;

    // 타겟 칩 찾기
    const targetBody = activeChips.find(chip => {
      const data = chip.userData as any;
      return data && data.type === 'chip' && data.id === chipId;
    });
    if (!targetBody) return;

    // 순간이동은 즉시 효과이므로 별도 처리 (엔트리 등록 불필요)
    if (skill === 'teleport') {
      this.executeTeleport(world, targetBody, chipId, activeChips, finishedChips);
      return;
    }

    // 칩당 지속형 스킬 1개만 유지: 기존에 걸려있던 다른 스킬을 제거(교체)하여
    // Booster+Tank+Magnet 같은 극단 조합(속도 폭주/과도한 방해)을 원천 차단.
    // (위에서 동일 스킬 중복은 이미 early-return 처리됨)
    this.activeEntries = this.activeEntries.filter(e => e.chipId !== chipId);

    // 스킬별 지속 프레임 결정
    let durationFrames = 0;
    switch (skill) {
      case 'tank': durationFrames = TANK_DURATION_FRAMES; break;
      case 'booster': durationFrames = BOOSTER_DURATION_FRAMES; break;
      case 'ghost': durationFrames = GHOST_DURATION_FRAMES; break;
      case 'slime': durationFrames = SLIME_DURATION_FRAMES; break;
      case 'magnet': durationFrames = MAGNET_DURATION_FRAMES; break;
    }

    // 엔트리 등록 → step()에서 매 프레임 순회
    this.activeEntries.push({
      skill,
      chipId,
      startFrame: currentFrame,
      expireFrame: currentFrame + durationFrames,
    });

    // 중복 스킬 문제를 방지하기 위해 전체 물리 속성 재계산
    this.recalcPhysics(targetBody, chipId);
  }

  // ── 매 프레임 호출: 지속 효과 적용 + 만료 해제 ────────────────────
  static step(
    world: RAPIER.World,
    currentFrame: number,
    activeChips: RAPIER.RigidBody[],
    finishedChips?: Set<string>,
  ): { expiredChipIds: { chipId: string; skill: SkillType }[] } {
    const expired: { chipId: string; skill: SkillType }[] = [];
    if (this.activeEntries.length === 0) return { expiredChipIds: expired };

    const remaining: ActiveSkillEntry[] = [];

    for (const entry of this.activeEntries) {
      // ═══════════════════════════════════════════════════════════════════
      // ██ PROTECTED: 완주한 칩의 활성 스킬 즉시 해제 ██
      // 결승선을 통과한 플레이어의 모든 지속 스킬(booster, magnet, tank 등)은
      // 즉시 만료 처리합니다. 이 칩이 스킬 효과를 가진 채로 다른 칩에게
      // 영향(예: magnet 인력)을 주는 것을 방지합니다.
      // ⚠️ DO NOT MODIFY: 사용자 요청에 의해 영구 고정된 로직입니다.
      // ═══════════════════════════════════════════════════════════════════
      if (finishedChips && finishedChips.has(entry.chipId)) {
        expired.push({ chipId: entry.chipId, skill: entry.skill });
        continue;
      }

      const body = activeChips.find(chip => {
        const data = chip.userData as any;
        return data && data.type === 'chip' && data.id === entry.chipId;
      });

      if (!body) {
        continue;
      }

      // 만료 체크
      if (currentFrame >= entry.expireFrame) {
        expired.push({ chipId: entry.chipId, skill: entry.skill });
        continue; // remaining에 넣지 않음
      }

      switch (entry.skill) {
        case 'booster':
          // 하방 속도가 타깃 미만일 때만 추진력 적용(질량 정규화).
          // "타깃 속도까지 가속 후 유지" → 무한 가속/화면 밖 이탈 방지.
          if (body.linvel().y < BOOSTER_TARGET_SPEED) {
            this.applyDeltaV(body, 0, BOOSTER_FORCE_PER_FRAME);
          }
          break;

        case 'magnet':
          // 매 프레임 반경 내 타 칩에 인력 적용
          this.applyMagnetForce(body, entry.chipId, activeChips);
          break;
      }

      remaining.push(entry);
    }

    this.activeEntries = remaining;

    // 만료된 칩들에 대해 물리 속성 복구
    for (const exp of expired) {
      const body = activeChips.find(chip => {
        const data = chip.userData as any;
        return data && data.type === 'chip' && data.id === exp.chipId;
      });
      if (body) {
        this.recalcPhysics(body, exp.chipId);
      }
    }

    return { expiredChipIds: expired };
  }

  // ── 순간이동: 1단계 상위 칩과 좌표 스왑 ─────────────────────────────
  private static executeTeleport(
    world: RAPIER.World,
    selfBody: RAPIER.RigidBody,
    selfId: string,
    activeChips: RAPIER.RigidBody[],
    finishedChips?: Set<string>,
  ) {
    // 모든 "진행 중인" 칩만 필터링하여 Y좌표 내림차순 정렬 (완주한 칩은 배제)
    const chipPositions: { body: RAPIER.RigidBody; id: string; y: number }[] = [];
    for (const chip of activeChips) {
      const data = chip.userData as any;
      if (data && data.type === 'chip' && data.id) {
        if (finishedChips && finishedChips.has(data.id)) continue;
        const y = chip.translation().y;
        chipPositions.push({ body: chip, id: data.id, y: y });
      }
    }
    chipPositions.sort((a, b) => b.y - a.y); // Y가 클수록 앞서 있음 (진행 방향)

    const selfIndex = chipPositions.findIndex(c => c.id === selfId);
    if (selfIndex < 0) return;

    if (selfIndex > 0) {
      // 2등 이하: 바로 1단계 위 칩과 좌표 스왑
      const target = chipPositions[selfIndex - 1];
      const selfPos = selfBody.translation();
      const targetPos = target.body.translation();

      // 좌표 교환
      selfBody.setTranslation({ x: targetPos.x, y: targetPos.y }, true);
      target.body.setTranslation({ x: selfPos.x, y: selfPos.y }, true);

      // 속도 초기화 (벽 끼임 방지)
      selfBody.setLinvel({ x: 0, y: 0 }, true);
      target.body.setLinvel({ x: 0, y: 0 }, true);
    } else {
      // 이미 1등: 전방 워프
      const selfPos = selfBody.translation();
      selfBody.setTranslation({ x: selfPos.x, y: selfPos.y + TELEPORT_WARP_DISTANCE }, true);
      selfBody.setLinvel({ x: 0, y: 0 }, true);
    }
  }

  // ── 자석 인력: 반경 내 타 칩을 끌어당김 ─────────────────────────────
  private static applyMagnetForce(
    magnetBody: RAPIER.RigidBody,
    magnetChipId: string,
    activeChips: RAPIER.RigidBody[],
  ) {
    // ═══════════════════════════════════════════════════════════════════
    // ██ PROTECTED: 완주한 캐스터의 magnet 인력 차단 ██
    // 결승선을 통과한 플레이어의 magnet이 다른 칩을 끌어당기지 않도록 합니다.
    // ⚠️ DO NOT MODIFY: 사용자 요청에 의해 영구 고정된 로직입니다.
    // ═══════════════════════════════════════════════════════════════════
    const magnetData = magnetBody.userData as any;
    if (magnetData?.finished) return;

    const mPos = magnetBody.translation();

    for (const chip of activeChips) {
      const data = chip.userData as any;
      if (!data || data.type !== 'chip' || data.finished || data.id === magnetChipId) continue;

      const cPos = chip.translation();
      const dx = mPos.x - cPos.x;
      const dy = mPos.y - cPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MAGNET_RADIUS && dist > 10) { // 10px 데드존 (특이점 방지)
        // 거리 반비례 제곱 인력: 가까울수록 강하게 끌어당김
        const strength = MAGNET_STRENGTH * Math.pow(1 - dist / MAGNET_RADIUS, 2);
        let dvx = (dx / dist) * strength;
        let dvy = (dy / dist) * strength;

        // 위(-y) 방향 인력 감쇠: 칩을 중력에 맞서 띄우는 것을 방지
        if (dvy < 0) dvy *= MAGNET_UPWARD_DAMP;

        this.applyDeltaV(chip, dvx, dvy);
      }
    }
  }

  // ── 질량 정규화 임펄스 (SimulationCore.applyDeltaV와 동일 패턴) ─────
  private static applyDeltaV(chip: RAPIER.RigidBody, dvx: number, dvy: number) {
    const m = chip.mass() || 1;
    chip.applyImpulse({ x: dvx * m, y: dvy * m }, true);
  }

  // ── 게임 종료 시 모든 활성 스킬 정리 ────────────────────────────────
  static reset() {
    this.activeEntries = [];
  }

  // ── 외부 조회: 특정 칩에 활성화된 스킬 목록 ─────────────────────────
  static getActiveSkills(chipId: string): SkillType[] {
    return this.activeEntries
      .filter(e => e.chipId === chipId)
      .map(e => e.skill);
  }
}
