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
  isOfficial?: boolean;    // 공식/배포 맵 여부 (편집본 정확 재현 위해 밀도 조절 무시)
  themeWeights?: ThemeWeights; // 맵별 추가 기믹 가중치
  layoutConfig?: any;      // 맵별 레이아웃 설정
  mapKey?: string;         // 프리셋 ID (시드 생성용)
  survivors: any[];
  targetCount: number;
  mode: string;            // 'speed' | 'turtle' | 'custom' | 'random'
  customRank: number;
  randomRanks?: number[];   // 랜덤 모드에서 컴퓨터가 뽑은 당첨 등수 배열
  rng?: () => number;      // 결정론적 재현을 위한 난수 주입(스폰 위치). 기본 Math.random
}

const GLOBAL_SPEED_MODIFIER = 0.7; // 전체 게임 배속 하향 조정치
const COOLDOWN_SCALE = 1 / GLOBAL_SPEED_MODIFIER; // 프레임 기반 쿨타임 길이 비례 증가 상수

const PORTAL_COOLDOWN_FRAMES = Math.round(60 * COOLDOWN_SCALE);   // 1초
const HOLE_COOLDOWN_FRAMES = Math.round(120 * COOLDOWN_SCALE);    // 2초
const HOLE_PENALTY_FRAMES = Math.round(90 * COOLDOWN_SCALE);      // 1.5초 갇힘 후 리스폰

// 월드 중력(px/s²). v2: 칩 이동 속도를 끌어올려 "루즈함"을 해소(11×→15×).
// 댐핑 하향(ChipFactory 0.18)과 함께 종단속도를 크게 높여 칩이 쭉쭉 나아가게 한다.
export const GRAVITY_Y = 9.81 * 15;

// 전역 칩 속도 상한(px/s). 정상 종단속도(~817)의 약 2.4배.
// 왜: 스킬(특히 Booster/Tank)·중력장이 임펄스를 누적시키면 댐핑이 낮아(0.18) 속도가
// 사실상 무한대로 치솟아 칩이 화면 밖으로 사라지고 카메라가 추적을 포기하며 게임이 급종료된다.
// 매 프레임 모든 칩의 선속도 크기를 이 값으로 클램프해 어떤 스킬 조합에서도 카메라 추적 한계
// 안에 머물게 하는 최종 안전장치다(개별 스킬 밸런스와 독립적으로 동작).
const MAX_CHIP_SPEED = 2000;

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

  // 모든 칩이 결승선을 통과했는지(마지막 주자까지 완주). 워커 루프 종료 판정에 사용.
  get allFinished(): boolean {
    return this.activeChips.length > 0 && this.finishedChips.size >= this.activeChips.length;
  }

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
  private luckyEffects: { body: RAPIER.RigidBody; chipId: string; atFrame: number; restore: () => void }[] = [];
  private pendingRemovals: RAPIER.RigidBody[] = [];

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
    this.luckyEffects.length = 0;
    this.pendingRemovals.length = 0;
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
    this.layoutConfig = config.layoutConfig;

    const gravity = { x: 0.0, y: GRAVITY_Y };
    this.world = new RAPIER.World(gravity);
    this.eventQueue = new RAPIER.EventQueue(true);

    // 외벽
    MapBuilder.createWalls(this.world, config.width, this.worldHeight, 100, config.wallStyle);

    // 장애물 배치
    const isCustomMap = config.isCustomMap ?? false;
    // 공식/커스텀(저작) 맵은 편집본을 그대로 재현 — 밀도 절차(applyDensity) 우회.
    const isAuthored = isCustomMap || (config.isOfficial ?? false);
    const baseItems = config.mapItems && config.mapItems.length > 0 ? config.mapItems : null;
    if (baseItems) {
      const finalItems = isAuthored
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
          const body = MapBuilder.createPin(this.world!, item.x, item.y, item.radius || 15, false, item.restitution, item.friction);
          if (body && item.soundTag) (body.userData as any).soundTag = item.soundTag;
        } else if (item.type === 'bumper') {
          const body = MapBuilder.createPin(this.world!, item.x, item.y, item.radius || 15, true, item.restitution, item.friction);
          if (body && item.soundTag) (body.userData as any).soundTag = item.soundTag;
        } else if (item.type === 'wall' || item.type === 'iceblock' || item.type === 'polygon') {
          let body;
          if (item.type === 'iceblock') {
            body = MapBuilder.createBreakableBlock(this.world!, item);
          } else if (item.type === 'polygon') {
            body = MapBuilder.createPolygon(this.world!, item);
          } else {
            body = MapBuilder.createRect(this.world!, item.x, item.y, item.w || 100, item.h || 20, 'wall', item.angle ?? item.rotation ?? 0, item.restitution, item.friction);
          }
          if (body && item.soundTag) (body.userData as any).soundTag = item.soundTag;
        } else if (item.type === 'windmill' || item.type === 'piston' || item.type === 'spinner' || item.type === 'flipper') {
          const body = item.type === 'flipper'
            ? MapBuilder.createFlipper(this.world!, item)
            : MapBuilder.createKinematic(this.world!, item);
          if (body && item.soundTag) (body.userData as any).soundTag = item.soundTag;
        } else if (item.type === 'portal' || item.type === 'booster' || item.type === 'blackhole' || item.type === 'whitehole' || item.type === 'hole' || item.type === 'windcannon' || item.type === 'luckygate') {
          const body = item.type === 'windcannon' 
            ? MapBuilder.createWindCannon(this.world!, item)
            : item.type === 'luckygate'
            ? MapBuilder.createLuckyGate(this.world!, item)
            : MapBuilder.createSensor(this.world!, item);
          if (body && item.soundTag) (body.userData as any).soundTag = item.soundTag;
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
          // 렌더 정규 단위(도)로 저장 — 게임/에디터 렌더러가 rotation 을 '도'로 해석한다. [lib/render/rotation.ts]
          rotation: body.rotation() * (180 / Math.PI),
          speed: userData.speed,
          color: userData.color,
          waypointB: userData.waypointB,
          originX: userData.originX,
          originY: userData.originY,
          vertices: userData.vertices,
          hp: userData.hp,
          maxHp: userData.maxHp,
        });
      }
    });

    // 칩 스폰 (스마트 그리드 배치)
    this.activeChips = [];
    // PRD v4: layoutConfig 전달
    const slots = this.generateSlots(config.survivors.length, config.width, config.layoutConfig, config.worldHeight);
    config.survivors.forEach((s: any, idx: number) => {
      const slot = slots[idx];
      const chip = ChipFactory.createChip(this.world!, slot.x, slot.y, 18, s.id);
      chip.setLinvel({ x: 0, y: 0 }, true);
      this.activeChips.push(chip);
    });
  }

  private generateSlots(count: number, width: number, layoutConfig?: any, worldHeight: number = 3300): {x: number, y: number}[] {
    const slots: {x: number, y: number}[] = [];
    let spacingX = 85;  // 기본 가로 간격
    let rowSpacingY = 75; // 기본 세로 간격
    const availableWidth = width * 0.92;
    
    const startLineY = layoutConfig?.startLineY ?? 
                       (layoutConfig?.startMarginPercent ? worldHeight * layoutConfig.startMarginPercent : 70);
    const spawnGap = layoutConfig?.spawnGap ?? 50;
    
    // PRD v6.0 Auto-Scale 로직
    const MIN_SPACING_X = 55;
    const MIN_SPACING_Y = 65;
    const topLimit = -400; // 카메라가 닿는 확장된 천장
    const availableHeight = startLineY - spawnGap - topLimit;

    // 단계적 압축 로직
    let maxPerRow = Math.max(1, Math.floor(availableWidth / spacingX));
    let rows = Math.ceil(count / maxPerRow);
    let requiredHeight = (rows - 1) * rowSpacingY;

    // 가로 압축 (Step 1)
    while (requiredHeight > availableHeight && spacingX > MIN_SPACING_X) {
      spacingX = Math.max(MIN_SPACING_X, spacingX - 5);
      maxPerRow = Math.max(1, Math.floor(availableWidth / spacingX));
      rows = Math.ceil(count / maxPerRow);
      requiredHeight = (rows - 1) * rowSpacingY;
    }

    // 세로 압축 (Step 2)
    while (requiredHeight > availableHeight && rowSpacingY > MIN_SPACING_Y) {
      rowSpacingY = Math.max(MIN_SPACING_Y, rowSpacingY - 5);
      requiredHeight = (rows - 1) * rowSpacingY;
    }

    let slotIdx = 0;
    
    for (let r = 0; r < rows; r++) {
      // PRD v6.0: 강제 클램핑 해제 (공간이 없으면 topLimit 위쪽으로 오버플로우 허용)
      const rowY = startLineY - spawnGap - (rows - 1 - r) * rowSpacingY;
      const countInRow = (r === rows - 1) ? (count - slotIdx) : maxPerRow;
      
      // 줄의 실제 너비 계산 후 중앙 정렬
      const rowWidth = (countInRow - 1) * spacingX;
      const rowStartX = (width - rowWidth) / 2;
      
      for (let c = 0; c < countInRow; c++) {
        slots.push({ x: rowStartX + c * spacingX, y: rowY });
        slotIdx++;
      }
    }
    
    // Fisher-Yates 셔플
    for (let i = slots.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    
    return slots;
  }

  // PRD v4: Store layoutConfig for shuffle
  private layoutConfig?: any;

  shuffle(width: number) {
    if (!this.world) return;
    const slots = this.generateSlots(this.activeChips.length, width, this.layoutConfig, this.worldHeight);
    this.activeChips.forEach((chip, idx) => {
      const slot = slots[idx];
      chip.setTranslation({ x: slot.x, y: slot.y }, true);
      chip.setLinvel({ x: 0, y: 0 }, true);
    });
  }

  // 한 프레임 진행. dtMultiplier 로 슬로모션(스킬 연출) 지원.
  step(dtMultiplier: number = 1.0) {
    if (!this.world || !this.eventQueue) return;
    this.events = [];

    const rawDt = (1 / 60) * GLOBAL_SPEED_MODIFIER * dtMultiplier;
    this.world.integrationParameters.dt = Math.min(rawDt, 4 / 60);

    // 물리 스텝(world.step) 이전에 피스톤 등 강체의 이동 목표(선속도 등)를 갱신해야 엔진이 이번 프레임의 충돌(Sweep)을 정상 계산합니다.
    this.applyPistons();

    this.world.step(this.eventQueue);

    this.handleCollisions();
    this.applyGravityWells();
    this.applyWindCannons();
    this.applyFlippers();
    this.processHoleRespawns();
    this.processLuckyEffects();
    this.processPendingRemovals();

    // 스킬 프레임루프: 매 프레임 활성 스킬의 지속 효과 적용 + 만료 해제
    const { expiredChipIds } = SkillSystem.step(this.world, this.frame, this.activeChips, this.finishedChips);
    if (expiredChipIds.length > 0) {
      for (const expired of expiredChipIds) {
        this.events.push({ type: 'SKILL_EXPIRED', payload: { chipId: expired.chipId, skill: expired.skill } });
      }
    }

    // 모든 임펄스(중력장/스킬) 적용 이후 net 속도를 전역 상한으로 클램프 →
    // 다음 스텝의 적분·렌더 브로드캐스트 모두 캡 적용된 속도를 본다.
    this.clampVelocities();

    const totalSpeed = this.scanChipsAndFinish();

    // 우승 확정 후에도 남은 주자가 끼이지 않고 결승선을 통과하도록 anti-stuck는 계속 동작
    // (마지막 주자까지 완주하는 것이 의도된 동작). 완주한 칩은 applyAntiStuck 내부에서 제외됨.
    if (this.activeChips.length > 0) {
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

  // 모든 활성 칩의 선속도 크기를 MAX_CHIP_SPEED로 제한(방향 보존).
  // 칩이 화면 밖으로 로켓처럼 튀어나가 카메라가 추적을 놓치는 현상의 최종 안전장치.
  private clampVelocities() {
    for (let i = 0; i < this.activeChips.length; i++) {
      const body = this.activeChips[i];
      const v = body.linvel();
      const speed = Math.sqrt(v.x * v.x + v.y * v.y);
      if (speed > MAX_CHIP_SPEED) {
        const k = MAX_CHIP_SPEED / speed;
        body.setLinvel({ x: v.x * k, y: v.y * k }, true);
      }
    }
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
        const soundTag = d1?.soundTag || d2?.soundTag;
        const x = (b1.translation().x + b2.translation().x) / 2;
        if (soundTag) {
          this.events.push({ type: 'SOUND_EFFECT', payload: { type: soundTag, impulse: impactV * 10, x } });
        } else if (isBumper) {
          this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'bumperHit', impulse: impactV * 10, x } });
        } else {
          this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'wallHit', impulse: impactV * 5, x } });
        }
      }

      let chipBody: RAPIER.RigidBody | null = null;
      let sensorBody: RAPIER.RigidBody | null = null;

      if (d1?.type === 'chip' && ['portal', 'booster', 'hole', 'luckygate', 'flipper', 'windcannon'].includes(d2?.type)) { chipBody = b1; sensorBody = b2; }
      if (d2?.type === 'chip' && ['portal', 'booster', 'hole', 'luckygate', 'flipper', 'windcannon'].includes(d1?.type)) { chipBody = b2; sensorBody = b1; }

      // 얼음 블록 충돌 로직
      if (d1?.type === 'iceblock' || d2?.type === 'iceblock') {
        const iceBody = d1?.type === 'iceblock' ? b1 : b2;
        const iceData = iceBody.userData as any;
        const theChip = d1?.type === 'chip' ? b1 : (d2?.type === 'chip' ? b2 : null);
        
        if (theChip && iceData.hp > 0 && impactV > 20) {
          iceData.hp--;
          this.events.push({ 
            type: 'ICE_CRACK', 
            payload: { id: iceData.id, remainingHp: iceData.hp, maxHp: iceData.maxHp, x: iceBody.translation().x, y: iceBody.translation().y } 
          });
          
          if (iceData.hp <= 0) {
            this.pendingRemovals.push(iceBody);
            this.events.push({ 
              type: 'ICE_DESTROY', 
              payload: { id: iceData.id, x: iceBody.translation().x, y: iceBody.translation().y } 
            });
          }
        }
      }

      if (chipBody && sensorBody) {
        const chipData = chipBody.userData as any;
        const sensorData = sensorBody.userData as any;

        if (sensorData.type === 'portal') {
          const lastWarp = this.lastWarpFrame.get(chipData.id) || -99999;
          if (this.frame - lastWarp > PORTAL_COOLDOWN_FRAMES) {
            const targetPortals: any[] = [];
            world.forEachRigidBody((b) => {
              const d = b.userData as any;
              if (d?.type === 'portal' && d.color === sensorData.color && b.handle !== sensorBody!.handle) {
                targetPortals.push(b);
              }
            });
            if (targetPortals.length > 0) {
              const idx = Math.floor(this.rng() * targetPortals.length);
              const targetPortal = targetPortals[idx];
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
        } else if (sensorData.type === 'flipper') {
          const flipperData = sensorBody.userData as any;
          if (flipperData.state === 'idle') {
            flipperData.state = 'swinging';
            flipperData.stateFrame = this.frame;
            this.events.push({ type: 'FLIPPER_SWING', payload: { id: flipperData.id } });
            this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'bumperHit', impulse: 50, x: sensorBody.translation().x } });
          }
        } else if (sensorData.type === 'luckygate') {
          const gateId = sensorData.id;
          const cooldownKey = `lucky_${chipData.id}_${gateId}`;
          const lastTrigger = this.lastWarpFrame.get(cooldownKey) || -99999;
          if (this.frame - lastTrigger > Math.round(120 * COOLDOWN_SCALE)) {
            this.lastWarpFrame.set(cooldownKey, this.frame);
            const roll = this.rng();
            let effect: 'boost' | 'bounce' | 'stun' | 'repel';
            if (roll < 0.30) effect = 'boost';
            else if (roll < 0.60) effect = 'bounce';
            else if (roll < 0.85) effect = 'stun';
            else effect = 'repel';
            this.applyLuckyEffect(chipBody, chipData, effect, sensorData);
          }
        }
      }
    });
  }

  private applyLuckyEffect(chip: RAPIER.RigidBody, chipData: any, effect: string, gate: any) {
    switch (effect) {
      case 'boost':
        this.applyDeltaV(chip, 0, -400);
        break;
      case 'bounce': {
        const collider = chip.collider(0);
        const origRestitution = collider.restitution();
        collider.setRestitution(2.0);
        this.luckyEffects.push({
          body: chip, chipId: chipData.id,
          atFrame: this.frame + Math.round(180 * COOLDOWN_SCALE),
          restore: () => { try { collider.setRestitution(origRestitution); } catch {} }
        });
        break;
      }
      case 'stun':
        chip.setGravityScale(0, true);
        chip.setLinvel({ x: 0, y: 0 }, true);
        this.luckyEffects.push({
          body: chip, chipId: chipData.id,
          atFrame: this.frame + Math.round(90 * COOLDOWN_SCALE),
          restore: () => {
            try {
              chip.setGravityScale(1, true);
              this.applyDeltaV(chip, 0, 80);
            } catch {}
          }
        });
        break;
      case 'repel': {
        const chipPos = chip.translation();
        for (const other of this.activeChips) {
          if (other === chip) continue;
          const od = other.userData as any;
          if (od?.finished) continue;
          const oPos = other.translation();
          const dx = oPos.x - chipPos.x;
          const dy = oPos.y - chipPos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100 && dist > 1) {
            this.applyDeltaV(other, (dx / dist) * 200, (dy / dist) * 200);
          }
        }
        break;
      }
    }
    this.events.push({
      type: 'LUCKY_EFFECT',
      payload: { chipId: chipData.id, effect, gateId: gate.id, x: chip.translation().x, y: chip.translation().y }
    });
  }

  private processLuckyEffects() {
    if (this.luckyEffects.length === 0) return;
    const remaining: typeof this.luckyEffects = [];
    for (const eff of this.luckyEffects) {
      if (this.frame >= eff.atFrame) {
        eff.restore();
      } else {
        remaining.push(eff);
      }
    }
    this.luckyEffects = remaining;
  }

  private processPendingRemovals() {
    if (this.pendingRemovals.length === 0) return;
    for (const body of this.pendingRemovals) {
      try { 
        this.world!.removeRigidBody(body); 
        this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'warp', impulse: 10 } }); // 얼음 파괴 효과음 대용
      } catch {}
    }
    this.pendingRemovals = [];
  }

  private applyWindCannons() {
    const world = this.world!;
    const cannons: RAPIER.RigidBody[] = [];
    world.forEachRigidBody((b) => {
      const d = b.userData as any;
      if (d?.type === 'windcannon') cannons.push(b);
    });
    
    for (const cannon of cannons) {
      const cd = cannon.userData as any;
      const cyclePeriod = cd.onFrames + cd.offFrames;
      const phase = this.frame % cyclePeriod;
      const isActive = phase < cd.onFrames;
      
      if (phase === 0) {
        this.events.push({ type: 'WIND_ON', payload: { id: cd.id } });
      } else if (phase === cd.onFrames) {
        this.events.push({ type: 'WIND_OFF', payload: { id: cd.id } });
      }
      
      if (!isActive) continue;
      
      const angleRad = (cd.windAngle || 0) * (Math.PI / 180);
      const dirX = Math.sin(angleRad);
      const dirY = -Math.cos(angleRad);
      
      const cannonPos = cannon.translation();
      const halfW = (cd.w || 120) / 2;
      const halfH = (cd.h || 120) / 2;
      
      for (const chip of this.activeChips) {
        const chipData = chip.userData as any;
        if (chipData?.finished) continue;
        const cPos = chip.translation();
        
        if (Math.abs(cPos.x - cannonPos.x) < halfW && Math.abs(cPos.y - cannonPos.y) < halfH) {
          const force = cd.windForce || 300;
          this.applyDeltaV(chip, dirX * force * (1/60), dirY * force * (1/60));
        }
      }
    }
  }

  private applyFlippers() {
    const world = this.world!;
    world.forEachRigidBody((b) => {
      const d = b.userData as any;
      if (d?.type !== 'flipper') return;
      
      const restRad = (d.restAngle || 20) * (Math.PI / 180);
      const swingRad = (d.swingAngle || -40) * (Math.PI / 180);
      const currentRot = b.rotation();
      
      if (d.state === 'swinging') {
        const sideMul = d.side === 'right' ? -1 : 1;
        if ((sideMul > 0 && currentRot <= swingRad) || (sideMul < 0 && currentRot >= -swingRad)) {
          d.state = 'returning';
          d.stateFrame = this.frame;
        } else {
          b.setAngvel(-d.swingSpeed * sideMul, true);
        }
      } else if (d.state === 'returning') {
        const diff = Math.abs(currentRot - restRad * (d.side === 'right' ? -1 : 1));
        if (diff < 0.05 || this.frame - d.stateFrame > Math.round(30 * COOLDOWN_SCALE)) {
          d.state = 'idle';
          b.setAngvel(0, true);
          b.setRotation(restRad * (d.side === 'right' ? -1 : 1), true);
        } else {
          b.setAngvel(d.returnSpeed * (d.side === 'right' ? -1 : 1), true);
        }
      } else {
        b.setAngvel(0, true);
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
    const dt = Math.max(world.integrationParameters.dt, 1 / 60);
    
    world.forEachRigidBody((b) => {
      const d = b.userData as any;
      if (d?.type === 'piston' && d.waypointB) {
        const speed = d.speed || 2;
        // 다음 프레임(this.frame + 1)의 목표 위치 계산
        const tNext = (Math.sin((this.frame + 1) * speed * 0.01) + 1) / 2;
        const ax = d.originX, ay = d.originY;
        const bx = d.waypointB.x, by = d.waypointB.y;
        
        const targetX = ax + (bx - ax) * tNext;
        const targetY = ay + (by - ay) * tNext;
        
        const currentPos = b.translation();
        
        // 목표 위치에 도달하기 위한 정확한 선속도를 계산하여 적용 (VelocityBased Kinematic)
        const vx = (targetX - currentPos.x) / dt;
        const vy = (targetY - currentPos.y) / dt;
        
        b.setLinvel({ x: vx, y: vy }, true);
      }
    });
  }

  // 칩 순회: 완주 판정 + 게임오버 판정. totalSpeed 반환(anti-stuck용)
  private scanChipsAndFinish(): number {
    let totalSpeed = 0;
    const endMargin = this.layoutConfig?.endMarginPercent ?? 0.02;
    const finishLineY = this.worldHeight * (1 - endMargin); // PRD v6.0: 실제 종료선 Y
    
    for (let i = 0; i < this.activeChips.length; i++) {
      const body = this.activeChips[i];
      const data = body.userData as any;
      
      // 완주한 칩은 속도 계산에서 제외
      if (data?.type === 'chip' && !this.finishedChips.has(data.id)) {
        const v = body.linvel();
        totalSpeed += Math.sqrt(v.x * v.x + v.y * v.y);
      }

      const t = body.translation();
      if (data?.type === 'chip' && t.y > finishLineY && !this.finishedChips.has(data.id)) {
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
      // 5초(300프레임) 진전 없으면 탈출 임펄스. 코너 끼임 대비 "중앙으로" 밀어내고
      // 강하게 아래로 보낸다(벽 코너에서 빠져나오도록 수평 성분을 중앙 지향으로).
      if (this.frame - lastProgress > Math.round(300 * COOLDOWN_SCALE)) {
        const towardCenter = (400 - t.x) * 1.5; // 중앙(x=400)으로 향하는 Δv (기존 0.9에서 강화)
        this.applyDeltaV(chip, towardCenter + (Math.random() - 0.5) * 150, 450); // 아래로 보내는 힘 강화 (기존 360 -> 450)
        this.chipLastProgressFrame.set(data.id, this.frame);
      }
    });

    // Level 3: Absolute Timeout — 3분(10800프레임) 경과 시 중력 2배 + 중력장 비활성화
    if (this.frame === Math.round(10800 * COOLDOWN_SCALE)) {
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
