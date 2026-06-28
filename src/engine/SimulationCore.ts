import RAPIER from '@dimforge/rapier2d-compat';
import { MapBuilder } from './MapBuilder';
import type { WallStyle } from './MapBuilder';
import { ChipFactory } from './ChipFactory';
import { RankingTracker } from './RankingTracker';
import { SkillSystem } from './SkillSystem';
import { applyDensity } from './GimmickInjector';
import { ThemeWeights, DEFAULT_THEME_WEIGHTS } from './MapPresets';

// ──────────────────────────────────────────────────────────────────────────
// SimulationCore: 물리 시뮬레이션의 "순수 코어".
//   - 브라우저(Web Worker)와 Node 헤드리스 하네스가 동일한 로직을 공유하도록
//     physics.worker.ts 의 스텝 로직을 self.postMessage 와 분리해 추출한 모듈.
//   - 모든 시간 기반 로직(쿨다운/리스폰)을 Date.now()/setTimeout 이 아닌
//     "프레임 카운트" 기반으로 변환 → 헤드리스 가속 실행에서도 정확히 재현되고,
//     실시간 워커에서도 setInterval 스로틀링에 강건해진다(60fps에서 동작 동일).
//   - 효과/이벤트는 self.postMessage 대신 this.events 배열에 적재한다.
//     소비자(worker = postMessage, harness = 메트릭 수집)가 스텝 후 드레인한다.
// ──────────────────────────────────────────────────────────────────────────

export interface SimEvent {
  type: string;
  payload?: any;
}

export interface SimInitConfig {
  width: number;
  height: number;          // 프리셋이 없을 때의 폴백 높이
  worldHeight: number;     // 결승선 = worldHeight + 20
  wallStyle: WallStyle;
  mapItems: any[] | null;  // 명시적 배치 아이템(프리셋/커스텀). null이면 랜덤 생성
  gimmickDensity: number;
  isCustomMap?: boolean;   // 커스텀 맵 여부 (밀도 조절 무시)
  themeWeights?: ThemeWeights; // 맵별 추가 기믹 가중치
  mapKey?: string;         // 프리셋 ID (시드 생성용)
  survivors: any[];
  targetCount: number;
  mode: string;            // 'speed' | 'turtle' | 'custom' | 'random'
  customRank: number;
  randomRanks?: number[];   // 랜덤 모드에서 컴퓨터가 뽑은 당첨 등수 배열
  rng?: () => number;      // 결정론적 재현을 위한 난수 주입(스폰 위치). 기본 Math.random
}

const PORTAL_COOLDOWN_FRAMES = 60;   // 1초
const HOLE_COOLDOWN_FRAMES = 120;    // 2초
const HOLE_PENALTY_FRAMES = 90;      // 1.5초 갇힘 후 리스폰

// 월드 중력(px/s²). v2: 칩 이동 속도를 끌어올려 "루즈함"을 해소(11×→15×).
// 댐핑 하향(ChipFactory 0.18)과 함께 종단속도를 크게 높여 칩이 쭉쭉 나아가게 한다.
export const GRAVITY_Y = 9.81 * 15;

// 부스터 1레벨당 부여 Δv(px/s). v2: 빨라진 칩 대비 체감 유지 위해 상향(160→210).
const BOOSTER_DV_PER_LEVEL = 210;
// 중력장 force 1당 중심부 Δv/frame(px/s). v2: 칩이 빨라 well 통과 시간이 짧아진 만큼 상향(0.4→0.52).
// force 5 ≈ 중력과 맞먹는 휨(통과 가능), force 9~10 ≈ 강한 포획. 폭주/영구포획 방지용 상한 적용.
const WELL_DV_PER_FORCE = 0.52;
const WELL_FORCE_CAP = 14;
// 블랙홀 접선(소용돌이) 성분 비율 — 너무 크면 영구 궤도에 갇히므로 절제.
const BLACKHOLE_SWIRL = 0.16;
const WELL_DEADZONE = 14; // 중심 특이점 방지 반경
// 중력장의 "위로 끌어당기는" 성분 감쇠. 1.0이면 칩을 중력에 맞서 띄워 정체시키므로,
// 위 방향 성분만 크게 줄여 "옆으로/아래로 휘되 띄우지는 않는" 드라마틱한 곡선을 만든다.
const WELL_UPWARD_DAMP = 0.3;

let rapierReady = false;

export class SimulationCore {
  world: RAPIER.World | null = null;
  eventQueue: RAPIER.EventQueue | null = null;
  activeChips: RAPIER.RigidBody[] = [];
  mapData: any[] = [];
  events: SimEvent[] = [];

  gameOver = false;

  private survivorsData: any[] = [];
  private targetCount = 1;
  private gameMode = 'speed';
  private randomRanks: number[] = [];     // 랜덤 모드 당첨 등수 목록
  private randomWinners: any[] = [];      // 랜덤 모드에서 당첨된 참가자 누적 배열
  private customWinningRank = 1;
  private worldHeight = 1200;
  private rng: () => number = Math.random;

  finishedChips = new Set<string>();
  private finishOrder: string[] = [];

  // 프레임 기반 쿨다운/스케줄
  private lastWarpFrame = new Map<string, number>();
  private holeRespawns: { body: RAPIER.RigidBody; chipId: string; atFrame: number; x: number; y: number }[] = [];

  // Anti-Stuck 상태
  private chipMaxY = new Map<string, number>();
  private chipLastProgressFrame = new Map<string, number>();
  private lowSpeedFrames = 0;

  frame = 0; // 게임 시작 이후 경과 프레임

  // RAPIER WASM 초기화(1회). 워커/하네스 모두 init 전에 호출해야 함.
  static async ensureRapier() {
    if (rapierReady) return;
    await RAPIER.init();
    // 캐시된 구버전 스킬 코드가 존재하지 않는 함수를 호출해도 크래시되지 않도록 방어
    if (RAPIER.RigidBody && !(RAPIER.RigidBody.prototype as any).setAdditionalMassProps) {
      (RAPIER.RigidBody.prototype as any).setAdditionalMassProps = function () {
        // no-op (legacy guard)
      };
    }
    rapierReady = true;
  }

  init(config: SimInitConfig) {
    SkillSystem.reset();
    if (this.world) this.world.free();

    this.gameOver = false;
    this.frame = 0;
    this.lowSpeedFrames = 0;
    this.finishedChips.clear();
    this.finishOrder.length = 0;
    this.lastWarpFrame.clear();
    this.holeRespawns.length = 0;
    this.chipMaxY.clear();
    this.chipLastProgressFrame.clear();
    this.events = [];

    this.worldHeight = config.worldHeight;
    this.targetCount = config.targetCount;
    this.gameMode = config.mode;
    this.randomRanks = config.randomRanks || [];
    this.randomWinners = [];
    this.customWinningRank = config.customRank;
    this.survivorsData = config.survivors;
    this.rng = config.rng ?? Math.random;

    const gravity = { x: 0.0, y: GRAVITY_Y };
    this.world = new RAPIER.World(gravity);
    this.eventQueue = new RAPIER.EventQueue(true);

    // 외벽
    MapBuilder.createWalls(this.world, config.width, this.worldHeight, 100, config.wallStyle);

    // 장애물 배치
    const isCustomMap = config.isCustomMap ?? false;
    const baseItems = config.mapItems && config.mapItems.length > 0 ? config.mapItems : null;
    if (baseItems) {
      const finalItems = isCustomMap
        ? baseItems
        : applyDensity(
            baseItems,
            config.gimmickDensity,
            this.worldHeight,
            config.themeWeights ?? DEFAULT_THEME_WEIGHTS,
            config.mapKey ?? 'unknown'
          );
      finalItems.forEach((item: any) => {
        if (item.type === 'pin') {
          MapBuilder.createPin(this.world!, item.x, item.y, item.radius || 15, false, item.restitution, item.friction);
        } else if (item.type === 'bumper') {
          MapBuilder.createPin(this.world!, item.x, item.y, item.radius || 15, true, item.restitution, item.friction);
        } else if (item.type === 'wall') {
          MapBuilder.createRect(this.world!, item.x, item.y, item.w || 100, item.h || 20, 'wall', item.rotation || 0, item.restitution, item.friction);
        } else if (item.type === 'windmill' || item.type === 'piston') {
          MapBuilder.createKinematic(this.world!, item);
        } else if (item.type === 'portal' || item.type === 'booster' || item.type === 'blackhole' || item.type === 'whitehole' || item.type === 'hole') {
          MapBuilder.createSensor(this.world!, item);
        }
      });
    } else {
      MapBuilder.buildRandomMap(this.world, config.width, config.height, config.gimmickDensity);
    }

    // 렌더링용 맵 데이터 스냅샷
    this.mapData = [];
    this.world.forEachRigidBody((body) => {
      const userData = body.userData as any;
      if (userData && userData.type && userData.type !== 'chip') {
        const t = body.translation();
        this.mapData.push({
          type: userData.type,
          x: t.x,
          y: t.y,
          w: userData.w,
          h: userData.h,
          radius: userData.radius,
          rotation: body.rotation(),
          speed: userData.speed,
          color: userData.color,
          waypointB: userData.waypointB,
          originX: userData.originX,
          originY: userData.originY,
        });
      }
    });

    // 칩 스폰
    this.activeChips = [];
    config.survivors.forEach((s: any) => {
      const spawnX = config.width * 0.1 + this.rng() * (config.width * 0.8);
      const chip = ChipFactory.createChip(this.world!, spawnX, 50, 12, s.id);
      chip.setLinvel({ x: 0, y: 0 }, true);
      this.activeChips.push(chip);
    });
  }

  shuffle(width: number) {
    if (!this.world) return;
    this.activeChips.forEach((chip) => {
      const spawnX = width * 0.1 + this.rng() * (width * 0.8);
      chip.setTranslation({ x: spawnX, y: 50 }, true);
      chip.setLinvel({ x: 0, y: 0 }, true);
    });
  }

  // 한 프레임 진행. dtMultiplier 로 슬로모션(스킬 연출) 지원.
  step(dtMultiplier: number = 1.0) {
    if (!this.world || !this.eventQueue) return;
    this.events = [];

    this.world.integrationParameters.dt = (1 / 60) * dtMultiplier;
    this.world.step(this.eventQueue);

    this.handleCollisions();
    this.applyGravityWells();
    this.applyPistons();
    this.processHoleRespawns();

    // 스킬 프레임루프: 매 프레임 활성 스킬의 지속 효과 적용 + 만료 해제
    const { expiredChipIds } = SkillSystem.step(this.world, this.frame, this.activeChips);
    if (expiredChipIds.length > 0) {
      for (const expired of expiredChipIds) {
        this.events.push({ type: 'SKILL_EXPIRED', payload: { chipId: expired.chipId, skill: expired.skill } });
      }
    }

    const totalSpeed = this.scanChipsAndFinish();

    if (this.activeChips.length > 0 && !this.gameOver) {
      this.applyAntiStuck(totalSpeed);
    }

    this.frame++;

    if (this.frame % 10 === 0) {
      const ranks = RankingTracker.updateRankings(this.world);
      this.events.push({ type: 'RANKINGS_UPDATE', payload: ranks });
    }
  }

  free() {
    // 스킬 시스템 상태 정리 (활성 스킬 엔트리 전부 해제)
    SkillSystem.reset();
    if (this.world) {
      this.world.free();
      this.world = null;
    }
    this.eventQueue = null;
    this.activeChips = [];
  }

  // ── 내부 로직 ─────────────────────────────────────────────────────────

  // 질량 정규화 임펄스: 인자는 "목표 속도 변화량(px/s)". impulse = Δv × mass.
  // 칩 질량/월드 중력이 바뀌어도 효과 강도가 직관적으로 유지된다.
  private applyDeltaV(chip: RAPIER.RigidBody, dvx: number, dvy: number) {
    const m = chip.mass() || 1;
    chip.applyImpulse({ x: dvx * m, y: dvy * m }, true);
  }

  // 중력장 전용: 위(-y) 방향 성분을 감쇠해 칩이 중력에 맞서 정체/공전하는 것을 방지.
  private applyWellDeltaV(chip: RAPIER.RigidBody, dvx: number, dvy: number) {
    const m = chip.mass() || 1;
    const iy = dvy < 0 ? dvy * WELL_UPWARD_DAMP : dvy;
    chip.applyImpulse({ x: dvx * m, y: iy * m }, true);
  }

  private handleCollisions() {
    const world = this.world!;
    this.eventQueue!.drainCollisionEvents((handle1, handle2, intersecting) => {
      if (!intersecting) return;
      const c1 = world.getCollider(handle1);
      const c2 = world.getCollider(handle2);
      if (!c1 || !c2) return;
      const b1 = c1.parent();
      const b2 = c2.parent();
      if (!b1 || !b2) return;

      const d1 = b1.userData as any;
      const d2 = b2.userData as any;

      const v1 = b1.linvel();
      const v2 = b2.linvel();
      const relVx = v1.x - v2.x;
      const relVy = v1.y - v2.y;
      const impactV = Math.sqrt(relVx * relVx + relVy * relVy);

      if (impactV > 50) {
        const isBumper = d1?.type === 'bumper' || d2?.type === 'bumper';
        const x = (b1.translation().x + b2.translation().x) / 2;
        if (isBumper) {
          this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'bumperHit', impulse: impactV * 10, x } });
        } else {
          this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'wallHit', impulse: impactV * 5, x } });
        }
      }

      let chipBody: RAPIER.RigidBody | null = null;
      let sensorBody: RAPIER.RigidBody | null = null;

      if (d1?.type === 'chip' && ['portal', 'booster', 'hole'].includes(d2?.type)) { chipBody = b1; sensorBody = b2; }
      if (d2?.type === 'chip' && ['portal', 'booster', 'hole'].includes(d1?.type)) { chipBody = b2; sensorBody = b1; }

      if (chipBody && sensorBody) {
        const chipData = chipBody.userData as any;
        const sensorData = sensorBody.userData as any;

        if (sensorData.type === 'portal') {
          const lastWarp = this.lastWarpFrame.get(chipData.id) || -99999;
          if (this.frame - lastWarp > PORTAL_COOLDOWN_FRAMES) {
            let targetPortal: any = null;
            world.forEachRigidBody((b) => {
              const d = b.userData as any;
              if (d?.type === 'portal' && d.color === sensorData.color && b.handle !== sensorBody!.handle) {
                targetPortal = b;
              }
            });
            if (targetPortal) {
              const tPos = targetPortal.translation();
              chipBody.setTranslation({ x: tPos.x, y: tPos.y }, true);
              this.lastWarpFrame.set(chipData.id, this.frame);
              this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'warp' } });
            }
          }
        } else if (sensorData.type === 'booster') {
          const angle = (sensorData.rotation || 0) * (Math.PI / 180);
          const dv = (sensorData.power || 3) * BOOSTER_DV_PER_LEVEL;
          this.applyDeltaV(chipBody, Math.sin(angle) * dv, -Math.cos(angle) * dv);
          this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'bumperHit', impulse: dv, x: sensorBody.translation().x } });
        } else if (sensorData.type === 'hole') {
          const lastWarp = this.lastWarpFrame.get(chipData.id) || -99999;
          if (this.frame - lastWarp > HOLE_COOLDOWN_FRAMES) {
            this.lastWarpFrame.set(chipData.id, this.frame);
            chipBody.setLinvel({ x: 0, y: 0 }, true);
            chipBody.setGravityScale(0, true);
            this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'holeTrapped' } });
            this.events.push({ type: 'HOLE_TRAPPED', payload: { chipId: chipData.id } });
            // 프레임 기반 리스폰 예약: 함정 위로 큰 폭(약 600px) 되돌리되, x를 전 폭으로
            // 넓게 분산시킨다. 좁게 리스폰하면 같은 함정으로 다시 빨려 들어가 무한 루프가
            // 생기므로(중앙 단일 흐름), 넓은 산포로 재진입을 깬다. 운 요소(후퇴)는 유지.
            const holeY = sensorBody.translation().y;
            this.holeRespawns.push({
              body: chipBody,
              chipId: chipData.id,
              atFrame: this.frame + HOLE_PENALTY_FRAMES,
              x: 120 + this.rng() * 560,
              y: Math.max(80, holeY - 600),
            });
          }
        }
      }
    });
  }

  private processHoleRespawns() {
    if (this.holeRespawns.length === 0) return;
    const remaining: typeof this.holeRespawns = [];
    for (const r of this.holeRespawns) {
      if (this.frame >= r.atFrame) {
        try {
          r.body.setTranslation({ x: r.x, y: r.y }, true);
          r.body.setLinvel({ x: 0, y: 0 }, true);
          SkillSystem.recalcPhysics(r.body, r.chipId);
        } catch (e) {
          // body 해제됨 → 무시
        }
      } else {
        remaining.push(r);
      }
    }
    this.holeRespawns = remaining;
  }

  private applyGravityWells() {
    const world = this.world!;
    const blackholes: RAPIER.RigidBody[] = [];
    const whiteholes: RAPIER.RigidBody[] = [];
    world.forEachRigidBody((b) => {
      const d = b.userData as any;
      if (d?.type === 'blackhole') blackholes.push(b);
      if (d?.type === 'whitehole') whiteholes.push(b);
    });

    // 블랙홀: 중심으로 끌어당기는 radial 성분 + 접선(swirl) 성분 → "빨려드는 소용돌이".
    // 매 프레임 Δv(px/s)를 질량정규화로 부여. force 는 중심부 Δv/frame 에 직결된다.
    blackholes.forEach((bh) => {
      const bhData = bh.userData as any;
      const bhPos = bh.translation();
      const radius = bhData.radius || 150;
      const S = Math.min(bhData.force || 5, WELL_FORCE_CAP) * WELL_DV_PER_FORCE;
      this.activeChips.forEach((chip) => {
        const data = chip.userData as any;
        if (data?.finished) return;
        const cPos = chip.translation();
        const dx = bhPos.x - cPos.x;
        const dy = bhPos.y - cPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius && dist > WELL_DEADZONE) {
          const falloff = 1 - dist / radius;
          const ux = dx / dist, uy = dy / dist;
          const radialDv = S * falloff;
          const swirlDv = S * BLACKHOLE_SWIRL * falloff;
          // 접선 방향 = radial 을 90° 회전한 (-uy, ux)
          this.applyWellDeltaV(chip, ux * radialDv - uy * swirlDv, uy * radialDv + ux * swirlDv);
        }
      });
    });

    // 화이트홀: 바깥으로 밀어내는 깔끔한 직선 반발(swirl 없음).
    whiteholes.forEach((wh) => {
      const whData = wh.userData as any;
      const whPos = wh.translation();
      const radius = whData.radius || 100;
      const S = Math.min(whData.force || 5, WELL_FORCE_CAP) * WELL_DV_PER_FORCE;
      this.activeChips.forEach((chip) => {
        const data = chip.userData as any;
        if (data?.finished) return;
        const cPos = chip.translation();
        const dx = cPos.x - whPos.x;
        const dy = cPos.y - whPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius && dist > WELL_DEADZONE) {
          const pushDv = (1 - dist / radius) * S;
          this.applyWellDeltaV(chip, (dx / dist) * pushDv, (dy / dist) * pushDv);
        }
      });
    });
  }

  private applyPistons() {
    const world = this.world!;
    world.forEachRigidBody((b) => {
      const d = b.userData as any;
      if (d?.type === 'piston' && d.waypointB) {
        const speed = d.speed || 2;
        const t = (Math.sin(this.frame * speed * 0.01) + 1) / 2;
        const ax = d.originX, ay = d.originY;
        const bx = d.waypointB.x, by = d.waypointB.y;
        const nx = ax + (bx - ax) * t;
        const ny = ay + (by - ay) * t;
        b.setNextKinematicTranslation({ x: nx, y: ny });
      }
    });
  }

  // 칩 순회: 완주 판정 + 게임오버 판정. totalSpeed 반환(anti-stuck용)
  private scanChipsAndFinish(): number {
    let totalSpeed = 0;
    for (let i = 0; i < this.activeChips.length; i++) {
      const body = this.activeChips[i];
      const data = body.userData as any;
      
      // 완주한 칩은 속도 계산에서 제외
      if (data?.type === 'chip' && !this.finishedChips.has(data.id)) {
        const v = body.linvel();
        totalSpeed += Math.sqrt(v.x * v.x + v.y * v.y);
      }

      const t = body.translation();
      if (data?.type === 'chip' && t.y > this.worldHeight + 20 && !this.finishedChips.has(data.id)) {
        this.finishedChips.add(data.id);
        data.finished = true;
        this.finishOrder.push(data.id);
        this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'finish' } });

        const survivor = this.survivorsData.find((s: any) => s.id === data.id);
        if (survivor) {
          this.events.push({ type: 'CHIP_FINISHED', payload: { rank: this.finishOrder.length, survivor, position: { x: t.x, y: t.y } } });
        }

        let isGameOver = false;
        let winners: any[] = [];
        if (this.gameMode === 'speed') {
          if (this.finishOrder.length === this.targetCount) {
            isGameOver = true;
            winners = this.finishOrder.map((id) => this.survivorsData.find((s: any) => s.id === id)).filter(Boolean);
          }
        } else if (this.gameMode === 'turtle') {
          const targetLength = Math.max(0, this.survivorsData.length - this.targetCount);
          if (this.finishOrder.length >= targetLength) {
            isGameOver = true;
            const finishedSet = new Set(this.finishOrder);
            winners = this.survivorsData.filter((s: any) => !finishedSet.has(s.id));
          }
        } else if (this.gameMode === 'custom') {
          // 커스텀 레이스: 지정한 N번째 완주자가 단독 우승
          if (this.finishOrder.length === this.customWinningRank) {
            isGameOver = true;
            winners = [survivor];
          }
        } else if (this.gameMode === 'random') {
          // 랜덤 레이스: 컴퓨터가 미리 뽑아둔 등수에 해당하는 참가자를 수집
          if (this.randomRanks.includes(this.finishOrder.length)) {
            this.randomWinners.push(survivor);
          }
          // 모든 당첨 등수가 채워지거나, 모든 칩이 완주하면 게임 오버
          if (this.randomWinners.length >= this.targetCount || this.finishOrder.length === this.survivorsData.length) {
            isGameOver = true;
            winners = this.randomWinners;
          }
        }

        if (isGameOver && !this.gameOver) {
          this.gameOver = true;
          this.events.push({ type: 'GAME_OVER', payload: { winners, mode: this.gameMode } });
        }
      }
    }
    return totalSpeed;
  }

  private applyAntiStuck(totalSpeed: number) {
    const world = this.world!;
    const avgSpeed = totalSpeed / this.activeChips.length;

    // Level 1: Gravity Storm — 평균 속도 < 10 이 5초(300프레임) 지속 시 전체 넉백
    if (avgSpeed < 10) {
      this.lowSpeedFrames++;
      if (this.lowSpeedFrames > 300) {
        this.events.push({ type: 'GRAVITY_STORM' });
        // 질량정규화 넉백(Δv px/s): 가로로 흩고 약하게 위로 띄운 뒤 다시 낙하시킴
        this.activeChips.forEach((chip) => {
          this.applyDeltaV(chip, (Math.random() - 0.5) * 700, -Math.random() * 350);
        });
        this.lowSpeedFrames = 0;
      }
    } else {
      this.lowSpeedFrames = 0;
    }

    // Level 2: Y축 진척 체크 — 개별 칩 15초(900프레임) 동안 80px 미만 전진 시 강제 하향
    this.activeChips.forEach((chip) => {
      const data = chip.userData as any;
      if (!data || data.type !== 'chip' || this.finishedChips.has(data.id)) return;
      const t = chip.translation();
      const prevMaxY = this.chipMaxY.get(data.id) || 0;
      if (t.y > prevMaxY) {
        this.chipMaxY.set(data.id, t.y);
        if (t.y - prevMaxY > 80 || prevMaxY === 0) {
          this.chipLastProgressFrame.set(data.id, this.frame);
        }
      }
      const lastProgress = this.chipLastProgressFrame.get(data.id) || 0;
      // 10초(600프레임) 진전 없으면 탈출 임펄스. 코너 끼임 대비 "중앙으로" 밀어내고
      // 강하게 아래로 보낸다(벽 코너에서 빠져나오도록 수평 성분을 중앙 지향으로).
      if (this.frame - lastProgress > 600) {
        const towardCenter = (400 - t.x) * 0.9; // 중앙(x=400)으로 향하는 Δv
        this.applyDeltaV(chip, towardCenter + (Math.random() - 0.5) * 120, 360);
        this.chipLastProgressFrame.set(data.id, this.frame);
      }
    });

    // Level 3: Absolute Timeout — 3분(10800프레임) 경과 시 중력 2배 + 중력장 비활성화
    if (this.frame === 10800) {
      const grav = world.gravity;
      world.gravity = { x: grav.x, y: grav.y * 2 };
      world.forEachRigidBody((b) => {
        const d = b.userData as any;
        if (d?.type === 'blackhole' || d?.type === 'whitehole') {
          d.force = 0;
        }
      });
    }
  }
}
