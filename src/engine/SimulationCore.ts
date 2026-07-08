import RAPIER from '@dimforge/rapier2d-compat';
import { MapBuilder } from './MapBuilder';
import type { WallStyle } from './MapBuilder';
import { ChipFactory } from './ChipFactory';
import { RankingTracker } from './RankingTracker';
import { SkillSystem } from './SkillSystem';
import { applyDensity } from './GimmickInjector';
import { ThemeWeights, DEFAULT_THEME_WEIGHTS } from './MapPresets';
import { getWallTransform } from './wallGeometry';
import { computeKeepOutZones, type KeepOutZone } from './SafePlacement';
import { generateSpawnSlots } from './spawnSlots';

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
  comebackStrength?: number; // 역전 다이내믹스 강도(0~100, 기본 50). 0이면 완전 비활성
  playTime?: number;       // "플레이 시간" 설정(0~100, 기본 50=중립). PRD-endgame-pacing 참조
}

const GLOBAL_SPEED_MODIFIER = 0.9; // 전체 게임 배속 하향 조정치
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

// ── 수직 낙하감 튜닝 (PRD-gameplay-dynamics §4.A) ──
// 수평 속도 전용 지수 감쇠(초당). 기물이 주는 측면 킥(임펄스)은 그대로 들어오되
// 이후 공기저항처럼 자연 감쇠해 수직 낙하로 복귀 → "해파리 글라이딩" 질감 제거.
// linearDamping(0.18, 종단 낙하속도 결정)은 축 구분이 없으므로 건드리지 않고 여기서 x축만 처리.
// 바람 대포(~300px/s² 연속 가속)의 평형 측면 속도 ≈ 300/0.9 ≈ 330px/s → 기물 체감 보존.
const H_DAMP = 0.9;
// 수평 속도 소프트 캡(px/s): 초과분만 강감쇠(하드 클램프 아님) — 극단적 측면 발사 방지.
const LAT_SOFT_CAP = 900;

// ── 역전 다이내믹스 (PRD-gameplay-dynamics §4.B) — comebackStrength(0~1)로 일괄 스케일 ──
// B1 팩 압축: 선두와의 Y 격차에 비례한 미세 하향 어시스트. GAP_REF에서 최대치 도달.
const GAP_REF = 1200;          // 격차 정규화 기준(px)
const CATCHUP_ACCEL = 90;      // 최대 어시스트 가속(px/s²) ≈ 중력(147)의 60% — 보이지 않는 미풍 수준
// B2 선두 미세 역풍: 2위와 이 거리 이상 벌어진 독주에만 하향 속도 드래그(접전 시 즉시 해제).
const LEAD_GAP_PX = 400;
const LEADER_DRAG_PER_S = 0.06; // 초당 하향 속도 감쇠율(강도 1 기준 ~6%/s)
// B4 후반 증폭: 진행도 0.5부터 B1을 1.0→1.5배 선형 증폭(후반부 역전 지원).
const LATE_RAMP_MAX = 1.5;

// ── 엔드게임 페이싱 (PRD-endgame-pacing §4.A) — "플레이 시간" 설정(0~100, 기본 50) ──
// 50 = 완전 중립(기존 동작과 동일). 50 미만(compress)은 우승 확정 후 마무리 구간을 압축하고
// 끼임 대응(anti-stuck)을 앞당기며, 50 초과(extend)는 자동 개입을 늦춰 느긋하게 관전하게 한다.
// 우승 확정 전 레이스 물리는 어떤 값에서도 불변 — 전 모드(스피드/거북이/커스텀/랜덤)에서
// 승자는 gameOver 시점에 이미 확정되므로, 이후 개입은 승패에 영향을 줄 수 없다(안전 경계).
// playTime=0에서 dt 부스트 상한 = 1 + 3.0 = 4배. 수동 빨리감기 4배와 동일한 dt 영역이라
// 물리 안정성 신규 리스크 없음(4/60 클램프가 최종 안전장치). 시뮬 기준 꼬리 median ≤8s 달성용.
const ENDGAME_MAX_BOOST_SPAN = 3.0;
const ENDGAME_RAMP_FRAMES = 180;    // 우승 확정 후 부스트/견인이 최대치에 닿는 램프(~3초)
const FINISH_PULL_MAX = 150;        // playTime=0 기준 잔여 주자 하향 견인 가속(px/s²)

// ── 구조 리스폰 (PRD-endgame-pacing §4.B) — 상시 안전장치 ──
// L2 탈출 임펄스가 연속 실패한 "밀폐 포켓" 끼임 칩을 인근 열린 공간으로 이동시킨다.
// 임펄스 2회 실패 전제 + 재구조 간격 덕에 정상 레이스에서는 발동하지 않는다.
const RESCUE_AFTER_L2_FAILURES = 2;                           // 임펄스 N회 실패 후 리스폰으로 격상
const RESCUE_MIN_INTERVAL = Math.round(600 * COOLDOWN_SCALE); // 같은 칩 재구조 최소 간격(~10초)
const RESCUE_MAX_ATTEMPTS = 12;                               // 링 샘플링 시도 횟수
const RESCUE_RING_BASE = 60;                                  // 첫 시도 반경(px)
const RESCUE_RING_STEP = 30;                                  // 시도당 반경 증가(px)
const RESCUE_CLEARANCE = 38;                                  // 기물/벽과의 최소 이격(칩 반경 18 + 여유)
const RESCUE_FORWARD_CAP = 30;                                // 진행도(chipMaxY) 초과 전진 허용치(px)
// 구조 대상은 "거의 정지한" 칩만: 룰렛 그릇 순환·포탈 루프처럼 움직이면서 Y 진전이
// 없는 것은 의도된 기믹 동작이므로 제외한다(시뮬 검증: 게이트 없이는 룰렛 맵에서
// 판당 20회+ 오발동). 이중 게이트 — ① 판정 순간 속도 ② 정체 기간 누적 이동량 평균.
// 쐐기 끼임은 임펄스 에피소드를 포함해도 평균 이동 속도가 낮고, 그릇 대기 칩은 휘저어져
// 누적 이동량이 크다.
const RESCUE_MAX_SPEED = 60;      // 판정 순간 속도 상한(px/s)
const RESCUE_MAX_AVG_SPEED = 40;  // 정체 기간 평균 이동 속도 상한(px/s)
// 2단계(하드) 격상: 그릇 순환·포탈 루프처럼 "움직이지만 진전 없는" 상태도 이 배수의
// 시간(기본 ~55초, 플레이 시간 비례)을 넘기면 속도 게이트를 무시하고 구조한다.
// 통상적인 그릇 체류(수십 초 내 방출)는 건드리지 않으면서 무한 루프·미완주만 차단.
const RESCUE_HARD_MULT = 10;

// 부스터 1레벨당 부여 Δv(px/s). v2: 빨라진 칩 대비 체감 유지 위해 상향(160→210).
const BOOSTER_DV_PER_LEVEL = 210;
// 얼음블록 타격 시 칩을 법선 방향으로 "확정 반발"시키는 속도(px/s) — 범퍼식 강한 아케이드 반발.
// 매 타격마다 일정 속도로 튕겨나가므로(에너지 감쇠로 얹혀 멈추지 않음) HP가 끝까지 소진되어 파괴된다.
const ICE_BOUNCE_SPEED = 280;
// 한 번의 접촉(바운스)이 여러 hp 감소로 중복 카운트되지 않도록 하는 최소 타격 간격(프레임).
const ICE_HIT_COOLDOWN_FRAMES = 8;
// 얼음 HP를 깎는 최소 충돌 상대속도(px/s). 낮춰서 약한 접촉도 균열이 진행되게 함(기존 20).
const ICE_HIT_MIN_IMPACT = 10;
// 물리 구동으로 시각을 매 프레임 동기화해야 하는 "움직이는" 기물 타입.
// (렌더가 로컬 타이머로 독립 애니메이션하면 물리 콜라이더와 어긋나므로 실제 트랜스폼을 전송한다.)
const MOVING_OBSTACLE_TYPES = new Set(['spinner', 'piston', 'windmill', 'flipper']);
// 중력장 force 1당 중심부 Δv/frame(px/s).
// v3: 0.52는 v2 속도 상향(중력 147px/s², 종단 ~817px/s) 이후 프리셋 force 3~4 기준
// 통과 편향이 ~2%에 불과해 "효과 없음"으로 체감됐다(헤드리스 측정). 3배 상향해
// force 4 ≈ 중심부 384px/s²(중력의 ~2.6배)로 궤적이 눈에 띄게 휘도록 조정.
const WELL_DV_PER_FORCE = 1.6;
const WELL_FORCE_CAP = 14;
// 블랙홀 접선(소용돌이) 성분 비율 — 너무 크면 영구 궤도에 갇히므로 절제.
const BLACKHOLE_SWIRL = 0.16;
const WELL_DEADZONE = 14; // 중심 특이점 방지 반경
// 중력장의 "위로 끌어당기는" 성분 감쇠. 1.0이면 칩을 중력에 맞서 띄워 정체시키므로,
// 위 방향 성분만 크게 줄여 "옆으로/아래로 휘되 띄우지는 않는" 드라마틱한 곡선을 만든다.
// 이 감쇠 덕에 흡인을 강화해도 칩이 영구 포획되지 않고 아래로 빠져나간다(+anti-stuck 보조).
const WELL_UPWARD_DAMP = 0.3;
// 블랙홀 내부 감속(초당 비율×falloff): 필드 안에서 칩을 서서히 늦춰 "빨려드는" 질감을 주고
// 체류 시간을 늘려 흡인이 체감되게 한다. 감속만으론 정지하지 않으며(중력·swirl 유지) 탈출 가능.
// 종단속도(~800px/s) 통과 시 체류가 0.3초 남짓이라, 감속이 곧 흡인 체감의 핵심이다.
const BLACKHOLE_DRAG_PER_S = 2.2;
// 화이트홀: 필드 내 칩을 중심으로 흡입하다가, 중심 도달 시 다른 화이트홀(없으면 자신)에서
// 무작위 방향(하방 편향)으로 뱉어낸다. 배출 직후 쿨다운 동안은 모든 화이트홀 흡입 면제(핑퐁 방지).
const WH_CAPTURE_DIST = 26;                                   // 중심 포획 판정 반경
const WH_EJECT_COOLDOWN_FRAMES = Math.round(90 * COOLDOWN_SCALE); // 재흡입 면제(약 1.5초)
const WH_EJECT_SPEED_BASE = 260;                              // 배출 속도(px/s) 기본
const WH_EJECT_SPEED_PER_FORCE = 40;                          // force 1당 배출 속도 가산

let rapierReady = false;

export class SimulationCore {
  world: RAPIER.World | null = null;
  eventQueue: RAPIER.EventQueue | null = null;
  activeChips: RAPIER.RigidBody[] = [];
  mapData: any[] = [];
  events: SimEvent[] = [];

  // 이동/회전 기물(스피너·피스톤·풍차·플리퍼)을 init 에서 고정 순서로 수집.
  // 워커가 매 프레임 이 순서대로 [x, y, rotationRad] 를 브로드캐스트해 렌더 시각을 물리와 일치시킨다.
  movingBodies: { id: string; body: RAPIER.RigidBody }[] = [];

  // ── [성능 최적화] 기믹 강체 캐시 ──
  // 왜: 매 프레임 forEachRigidBody로 전체 물리 세계를 순회하던 것을 init 시 1회 캐싱으로 교체.
  // iceblock 파괴(processPendingRemovals)는 이 캐시 대상 타입이 아니므로 무효화 불필요.
  private cachedBlackholes: RAPIER.RigidBody[] = [];
  private cachedWhiteholes: RAPIER.RigidBody[] = [];
  private cachedWindcannons: RAPIER.RigidBody[] = [];
  private cachedFlippers: RAPIER.RigidBody[] = [];
  private cachedKinematics: RAPIER.RigidBody[] = []; // windmill/spinner/piston
  private portalsByColor: Map<string, RAPIER.RigidBody[]> = new Map();
  // chipId → RigidBody O(1) 룩업 (SkillSystem, RankingTracker에 전달)
  chipBodyMap: Map<string, RAPIER.RigidBody> = new Map();

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
  private worldWidth = 800;
  private rng: () => number = Math.random;

  // 역전 다이내믹스 강도(0~1). 환경설정 슬라이더(0~100)에서 스케일. 실시간 변경 가능.
  comebackStrength01 = 0.5;
  // "플레이 시간"(0~1). 환경설정 슬라이더(0~100)에서 스케일. 실시간 변경 가능. 0.5=중립.
  playTime01 = 0.5;
  private gameOverFrame = -1;         // GAME_OVER 발생 프레임(마무리 가속/견인 램프 기준점)
  private finishRushAnnounced = false; // FINISH_RUSH 이벤트 1회 발행 플래그
  private l3Fired = false;            // L3 절대 타임아웃 1회 발동 플래그(=== 비교 취약성 제거)
  // 최근 순위 스냅샷(10프레임 주기 갱신). 워커의 순위 가중 스킬 추첨(B3)이 참조.
  latestRanks: { id: string; y: number; rank: number }[] = [];

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

  // 구조 리스폰 상태 (PRD-endgame-pacing §4.B)
  // "진짜 정체" 추적: 칩이 마지막으로 80px 전진(하강)한 시점의 y/프레임.
  // chipMaxY는 매 프레임 갱신되는 최대 도달점이라 단일 프레임 델타로는 진행을 판별할 수
  // 없으므로(정상 하강도 프레임당 ~13px), 밀폐 끼임 판정에는 이 별도 기준점을 쓴다.
  private rescueBaseY = new Map<string, number>();
  private rescueBaseFrame = new Map<string, number>();
  private chipLastRescueFrame = new Map<string, number>(); // 칩별 마지막 구조 리스폰 프레임
  private rescueTravel = new Map<string, number>();        // 기준점 이후 누적 이동량(px)
  private chipPrevPos = new Map<string, { x: number; y: number }>(); // 이동량 계산용 직전 위치
  private rescueZones: KeepOutZone[] = [];   // 구조 후보 검증용 키프아웃 원(전 기물+외벽)
  private rescueHazards: KeepOutZone[] = []; // 폴백 검증용(hole/중력장만)
  private wallStyle: WallStyle = 'straight';

  // 피스톤 위상 시계(프레임 등가). sim 시간(dt)에 비례 누적 → 전역 배속/슬로모션과 속도 일관.
  private pistonClock = 0;

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
    this.pistonClock = 0;
    this.finishedChips.clear();
    this.finishOrder.length = 0;
    this.lastWarpFrame.clear();
    this.holeRespawns.length = 0;
    this.luckyEffects.length = 0;
    this.pendingRemovals.length = 0;
    this.chipMaxY.clear();
    this.chipLastProgressFrame.clear();
    this.rescueBaseY.clear();
    this.rescueBaseFrame.clear();
    this.chipLastRescueFrame.clear();
    this.rescueTravel.clear();
    this.chipPrevPos.clear();
    this.gameOverFrame = -1;
    this.finishRushAnnounced = false;
    this.l3Fired = false;
    this.events = [];

    this.worldHeight = config.worldHeight;
    this.worldWidth = config.width || 800;
    this.comebackStrength01 = Math.max(0, Math.min(1, (config.comebackStrength ?? 50) / 100));
    this.playTime01 = Math.max(0, Math.min(1, (config.playTime ?? 50) / 100));
    this.wallStyle = config.wallStyle;
    this.latestRanks = [];
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
        } else if (item.type === 'portal' || item.type === 'booster' || item.type === 'blackhole' || item.type === 'whitehole' || item.type === 'hole' || item.type === 'windcannon' || item.type === 'luckygate' || item.type === 'speedgate' || item.type === 'slowgate') {
          const body = item.type === 'windcannon' 
            ? MapBuilder.createWindCannon(this.world!, item)
            : item.type === 'luckygate'
            ? MapBuilder.createLuckyGate(this.world!, item)
            : item.type === 'speedgate'
            ? MapBuilder.createSpeedGate(this.world!, item)
            : item.type === 'slowgate'
            ? MapBuilder.createSlowGate(this.world!, item)
            : MapBuilder.createSensor(this.world!, item);
          if (body && item.soundTag) (body.userData as any).soundTag = item.soundTag;
        }
      });
    } else {
      MapBuilder.buildRandomMap(this.world, config.width, config.height, config.gimmickDensity);
    }

    // 렌더링용 맵 데이터 스냅샷
    this.mapData = [];
    this.movingBodies = [];
    this.world.forEachRigidBody((body) => {
      const userData = body.userData as any;
      if (userData && userData.type && userData.type !== 'chip') {
        const t = body.translation();
        this.mapData.push({
          type: userData.type,
          id: userData.id,
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
        // 움직이는 기물은 매 프레임 트랜스폼을 렌더로 보내기 위해 고정 순서로 수집
        if (MOVING_OBSTACLE_TYPES.has(userData.type) && userData.id) {
          this.movingBodies.push({ id: userData.id, body });
        }
      }
    });

    // 구조 리스폰용 키프아웃 존 캐시(SafePlacement의 원 근사 재사용) — PRD-endgame-pacing §4.B.
    // iceblock은 벽 취급(파괴 후에도 존이 남는 보수적 오탐 — 무해), hole/portal은 반경 확대
    // (함정·즉시 워프 위 리스폰 금지), polygon은 정점 바운딩 반경으로 근사.
    // 외벽 세그먼트도 mapData에 포함되므로 벽면 밀착 배치는 자연히 걸러진다.
    const zoneItems = this.mapData.map((it: any) => {
      if (it.type === 'iceblock') return { ...it, type: 'wall' };
      if (it.type === 'hole') return { ...it, radius: (it.radius || 30) + 20 };
      if (it.type === 'portal') return { ...it, radius: 40 };
      if (it.type === 'polygon' && Array.isArray(it.vertices)) {
        const r = it.vertices.reduce((m: number, v: any) => Math.max(m, Math.hypot(v.x, v.y)), 20);
        return { ...it, type: 'wall', w: r * 2, h: r * 2 };
      }
      return it;
    });
    this.rescueZones = computeKeepOutZones(zoneItems as any);
    this.rescueHazards = computeKeepOutZones(
      zoneItems.filter((it: any) => it.type === 'hole' || it.type === 'blackhole' || it.type === 'whitehole') as any
    );

    // 칩 스폰 (스마트 그리드 배치)
    this.activeChips = [];
    this.chipBodyMap.clear();
    // PRD v4: layoutConfig 전달
    const slots = this.generateSlots(config.survivors.length, config.width, config.layoutConfig, config.worldHeight);
    config.survivors.forEach((s: any, idx: number) => {
      const slot = slots[idx];
      const chip = ChipFactory.createChip(this.world!, slot.x, slot.y, 18, s.id);
      chip.setLinvel({ x: 0, y: 0 }, true);
      this.activeChips.push(chip);
      this.chipBodyMap.set(s.id, chip);
    });

    // [성능 최적화] 기믹 강체를 타입별로 1회 캐싱 — 매 프레임 forEachRigidBody 제거
    this.cacheGimmickBodies();
  }

  private generateSlots(count: number, width: number, layoutConfig?: any, worldHeight: number = 3300): {x: number, y: number}[] {
    // 스폰 슬롯 산출은 순수 함수로 추출됨 — 에디터 스폰 프리뷰와 동일 소스 공유(오차 0).
    return generateSpawnSlots(count, width, layoutConfig, worldHeight, this.rng);
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

  // 한 프레임 진행. dtMultiplier 로 슬로모션(스킬 연출) 및 고배속(Hybrid Sub-stepping) 지원.
  step(dtMultiplier: number = 1.0) {
    if (!this.world || !this.eventQueue) return;
    this.events = [];

    let steps = 1;
    let stepMultiplier = dtMultiplier;

    // 고배속 안전 분할 (예: 4.0배속 -> steps: 4, stepMultiplier: 1.0)
    // 1배속 이하(슬로모션 등)는 기존과 같이 1 step으로 부드럽게 보간
    if (dtMultiplier > 1.0) {
      steps = Math.ceil(dtMultiplier);
      stepMultiplier = dtMultiplier / steps;
    }

    for (let i = 0; i < steps; i++) {
      this.internalStep(stepMultiplier);
    }
  }

  // 내부 물리 스텝 (1배속 스케일 기준으로 동작 보장)
  private internalStep(dtMultiplier: number) {
    if (!this.world || !this.eventQueue) return; // 안전장치


    // 마무리 자동 가속(FINISH RUSH): 우승 확정 후에만 1을 초과하므로 승패에 무영향.
    // 기존 4/60 클램프가 최종 안전장치(수동 빨리감기·배속과 곱해져도 기허용 상한 유지).
    const rawDt = (1 / 60) * GLOBAL_SPEED_MODIFIER * dtMultiplier * this.endgameBoost();
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
    // [성능 최적화] chipBodyMap 전달 — SkillSystem 내부의 O(N) find를 O(1) 룩업으로 교체
    const { expiredChipIds } = SkillSystem.step(this.world, this.frame, this.activeChips, this.finishedChips, this.chipBodyMap);
    if (expiredChipIds.length > 0) {
      for (const expired of expiredChipIds) {
        this.events.push({ type: 'SKILL_EXPIRED', payload: { chipId: expired.chipId, skill: expired.skill } });
      }
    }

    // 역전 다이내믹스(팩 압축·선두 역풍) — 클램프 직전에 적용해 캡의 보호를 받는다.
    const simDt = this.world.integrationParameters.dt;
    this.applyComebackDynamics(simDt);

    // 마무리 견인(PRD-endgame-pacing §4.A③): 우승 확정 후 잔여 주자에 하향 가속.
    this.applyFinishPull(simDt);

    // 모든 임펄스(중력장/스킬) 적용 이후 net 속도를 전역 상한으로 클램프 →
    // 다음 스텝의 적분·렌더 브로드캐스트 모두 캡 적용된 속도를 본다.
    this.clampVelocities(simDt);

    const totalSpeed = this.scanChipsAndFinish();

    // 우승 확정 후에도 남은 주자가 끼이지 않고 결승선을 통과하도록 anti-stuck는 계속 동작
    // (마지막 주자까지 완주하는 것이 의도된 동작). 완주한 칩은 applyAntiStuck 내부에서 제외됨.
    if (this.activeChips.length > 0) {
      this.applyAntiStuck(totalSpeed);
    }

    this.frame++;

    if (this.frame % 10 === 0) {
      // [성능 최적화] activeChips 직접 전달 — forEachRigidBody 제거
      const ranks = RankingTracker.updateRankingsFromChips(this.activeChips);
      this.latestRanks = ranks; // 워커의 순위 가중 스킬 추첨(B3)용 스냅샷
      this.events.push({ type: 'RANKINGS_UPDATE', payload: ranks });
    }
  }

  // 역전 다이내믹스 강도 실시간 변경(환경설정 슬라이더 → SET_COMEBACK_STRENGTH)
  setComebackStrength(value: number) {
    this.comebackStrength01 = Math.max(0, Math.min(1, value / 100));
  }

  // "플레이 시간" 실시간 변경(환경설정 슬라이더 → SET_PLAY_TIME). 50=중립.
  setPlayTime(value: number) {
    this.playTime01 = Math.max(0, Math.min(1, value / 100));
  }

  // ── 엔드게임 페이싱 (PRD-endgame-pacing §4.A) ──
  // 압축 강도(0~1): playTime 50 미만에서만 커짐 / 연장 강도(0~1): 50 초과에서만 커짐.
  private get compress(): number { return Math.max(0, 0.5 - this.playTime01) * 2; }
  private get extendAmount(): number { return Math.max(0, this.playTime01 - 0.5) * 2; }
  // anti-stuck(L1/L2/L3)·구조 리스폰 공용 윈도 스케일: 0.5(빠른 개입) ← 1.0 → 1.8(느긋)
  private get stuckWindowScale(): number { return 1 - 0.5 * this.compress + 0.8 * this.extendAmount; }

  // 우승 확정 후 dt 배율(1~3배). 확정 후 ENDGAME_RAMP_FRAMES에 걸쳐 선형 램프.
  private endgameBoost(): number {
    if (!this.gameOver || this.gameOverFrame < 0 || this.allFinished) return 1;
    const maxBoost = 1 + ENDGAME_MAX_BOOST_SPAN * this.compress;
    if (maxBoost <= 1) return 1;
    const ramp = Math.min(1, Math.max(0, this.frame - this.gameOverFrame) / ENDGAME_RAMP_FRAMES);
    const boost = 1 + (maxBoost - 1) * ramp;
    if (!this.finishRushAnnounced && boost > 1.05) {
      this.finishRushAnnounced = true;
      this.events.push({ type: 'FINISH_RUSH', payload: { maxBoost } });
    }
    return boost;
  }

  // 마무리 견인: 우승 확정 후 미완주·비동결 칩에 하향 가속(compress에 비례, 최대 150px/s²).
  // clampVelocities 직전에 적용되어 MAX_CHIP_SPEED 캡의 보호를 받는다.
  private applyFinishPull(dt: number) {
    if (!this.gameOver || this.gameOverFrame < 0 || this.allFinished) return;
    const accel = FINISH_PULL_MAX * this.compress;
    if (accel <= 0) return;
    const ramp = Math.min(1, Math.max(0, this.frame - this.gameOverFrame) / ENDGAME_RAMP_FRAMES);
    const dv = accel * ramp * dt;
    for (const chip of this.activeChips) {
      const d = chip.userData as any;
      if (!d || this.finishedChips.has(d.id)) continue;
      if (chip.gravityScale() === 0) continue; // 스턴/홀 트랩 동결 상태 제외
      this.applyDeltaV(chip, 0, dv);
    }
  }

  // [성능 최적화] init 완료 후 1회 호출 — 기믹 강체를 타입별 캐시로 수집.
  // 왜: applyGravityWells/applyWindCannons/applyFlippers/applyPistons에서 매 프레임
  // forEachRigidBody(전체 물리 세계 순회)를 하던 것을 제거하기 위함.
  private cacheGimmickBodies() {
    this.cachedBlackholes = [];
    this.cachedWhiteholes = [];
    this.cachedWindcannons = [];
    this.cachedFlippers = [];
    this.cachedKinematics = [];
    this.portalsByColor.clear();
    this.world!.forEachRigidBody((b) => {
      const d = b.userData as any;
      if (!d) return;
      switch (d.type) {
        case 'blackhole': this.cachedBlackholes.push(b); break;
        case 'whitehole': this.cachedWhiteholes.push(b); break;
        case 'windcannon': this.cachedWindcannons.push(b); break;
        case 'flipper': this.cachedFlippers.push(b); break;
        case 'windmill': case 'spinner': case 'piston':
          this.cachedKinematics.push(b); break;
        case 'portal': {
          const color = d.color;
          let arr = this.portalsByColor.get(color);
          if (!arr) { arr = []; this.portalsByColor.set(color, arr); }
          arr.push(b);
          break;
        }
      }
    });
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
    this.movingBodies = [];
    this.chipBodyMap.clear();
    this.cachedBlackholes = [];
    this.cachedWhiteholes = [];
    this.cachedWindcannons = [];
    this.cachedFlippers = [];
    this.cachedKinematics = [];
    this.portalsByColor.clear();
  }

  // ── 내부 로직 ─────────────────────────────────────────────────────────

  // 질량 정규화 임펄스: 인자는 "목표 속도 변화량(px/s)". impulse = Δv × mass.
  // 칩 질량/월드 중력이 바뀌어도 효과 강도가 직관적으로 유지된다.
  private applyDeltaV(chip: RAPIER.RigidBody, dvx: number, dvy: number) {
    const m = chip.mass() || 1;
    chip.applyImpulse({ x: dvx * m, y: dvy * m }, true);
  }

  // 칩 속도 후처리(매 스텝): ① 수평 전용 감쇠(수직 낙하감 복원) ② 수평 소프트 캡
  // ③ 전역 크기 상한(MAX_CHIP_SPEED, 방향 보존) — 화면 밖 로켓 방지 최종 안전장치.
  // 수직(vy)은 ①②에서 건드리지 않아 낙하/기물 수직 효과는 불변.
  // ①은 "빠르게 하강 중"일 때만 적용(fallFactor): 저속·굴림·끼임 탈출 상황의 측면 이동은
  // 보존해야 정체(gravityStorm)가 늘지 않는다(시뮬레이터 A/B로 확인된 회귀 방지).
  private clampVelocities(dt: number) {
    const softDecay = Math.exp(-6 * dt);          // 소프트 캡 초과분 강감쇠 계수
    for (let i = 0; i < this.activeChips.length; i++) {
      const body = this.activeChips[i];
      const v = body.linvel();
      // 하강 속도 400px/s 이상에서 완전 적용, 0에 가까울수록(정체/상승) 무감쇠
      const fallFactor = Math.min(Math.max(v.y, 0) / 400, 1);
      let vx = fallFactor > 0 ? v.x * Math.exp(-H_DAMP * fallFactor * dt) : v.x;
      const ax = Math.abs(vx);
      if (ax > LAT_SOFT_CAP) {
        vx = Math.sign(vx) * (LAT_SOFT_CAP + (ax - LAT_SOFT_CAP) * softDecay);
      }
      let vy = v.y;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > MAX_CHIP_SPEED) {
        const k = MAX_CHIP_SPEED / speed;
        vx *= k; vy *= k;
      }
      if (vx !== v.x || vy !== v.y) {
        body.setLinvel({ x: vx, y: vy }, true);
      }
    }
  }

  // ── 역전 다이내믹스 (PRD-gameplay-dynamics §4.B) ──
  // B1 팩 압축: 선두와의 격차 비례 미세 하향 어시스트(연속·질량 정규화 → 순간 역전 아님).
  // B2 선두 미세 역풍: 2위와 LEAD_GAP_PX 이상 독주 시에만 하향 속도 드래그(접전 복귀 시 해제).
  // B4 후반 증폭: 진행도 0.5+에서 B1을 최대 LATE_RAMP_MAX배.
  // comebackStrength01=0이면 전체 비활성(순수 물리). 스턴/홀 동결(gravityScale 0) 칩 제외.
  private applyComebackDynamics(dt: number) {
    const s = this.comebackStrength01;
    if (s <= 0 || this.activeChips.length < 2 || this.gameOver && this.allFinished) return;

    // 미완주 칩 기준 선두/2위 Y 산출
    let leaderY = -Infinity, secondY = -Infinity;
    let leader: RAPIER.RigidBody | null = null;
    for (const chip of this.activeChips) {
      const d = chip.userData as any;
      if (!d || this.finishedChips.has(d.id)) continue;
      const y = chip.translation().y;
      if (y > leaderY) { secondY = leaderY; leaderY = y; leader = chip; }
      else if (y > secondY) { secondY = y; }
    }
    if (!leader) return;

    const progress = Math.max(0, Math.min(1, leaderY / this.worldHeight));
    const lateRamp = progress >= 0.5 ? 1 + ((progress - 0.5) / 0.5) * (LATE_RAMP_MAX - 1) : 1;

    for (const chip of this.activeChips) {
      const d = chip.userData as any;
      if (!d || this.finishedChips.has(d.id)) continue;
      if (chip.gravityScale() === 0) continue; // 스턴/홀 트랩 동결 상태 제외

      if (chip === leader) {
        // B2: 독주 억제 — 하향 이동 중일 때만 미세 드래그
        if (secondY > -Infinity && leaderY - secondY > LEAD_GAP_PX) {
          const v = chip.linvel();
          if (v.y > 0) {
            chip.setLinvel({ x: v.x, y: v.y * (1 - LEADER_DRAG_PER_S * s * dt) }, true);
          }
        }
        continue;
      }

      // B1: 격차 비례 하향 어시스트 (순수 하향 — 수직 낙하감과 정합)
      const gap = leaderY - chip.translation().y;
      const t = Math.min(gap / GAP_REF, 1);
      if (t > 0) {
        this.applyDeltaV(chip, 0, t * CATCHUP_ACCEL * s * lateRamp * dt);
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

      if (d1?.type === 'chip' && ['portal', 'booster', 'hole', 'luckygate', 'speedgate', 'slowgate', 'flipper', 'windcannon'].includes(d2?.type)) { chipBody = b1; sensorBody = b2; }
      if (d2?.type === 'chip' && ['portal', 'booster', 'hole', 'luckygate', 'speedgate', 'slowgate', 'flipper', 'windcannon'].includes(d1?.type)) { chipBody = b2; sensorBody = b1; }

      // 얼음 블록 충돌 로직
      if (d1?.type === 'iceblock' || d2?.type === 'iceblock') {
        const iceBody = d1?.type === 'iceblock' ? b1 : b2;
        const iceData = iceBody.userData as any;
        const theChip = d1?.type === 'chip' ? b1 : (d2?.type === 'chip' ? b2 : null);

        if (theChip && iceData.hp > 0 && impactV > ICE_HIT_MIN_IMPACT) {
          // 한 번의 접촉(짧은 시간 내 반복 start 이벤트)이 여러 hp 감소로 중복 카운트되는 것을 방지.
          const chipId = (theChip.userData as any)?.id ?? 'unknown';
          const hitKey = `ice_${chipId}_${iceData.id}`;
          const lastHit = this.lastWarpFrame.get(hitKey) ?? -99999;
          if (this.frame - lastHit >= ICE_HIT_COOLDOWN_FRAMES) {
            this.lastWarpFrame.set(hitKey, this.frame);
            iceData.hp--;

            // 강한 아케이드 반발(범퍼식): 블록 중심→칩 방향(법선)으로 확정된 속도로 튕겨낸다.
            // 법선 성분을 ICE_BOUNCE_SPEED 로 재설정(접선 성분 보존) → 매 타격마다 확실히 분리되어
            // 재낙하·재타격이 반복되고 HP가 끝까지 소진되어 파괴된다(공이 얹혀 멈추지 않음).
            const cp = theChip.translation();
            const bp = iceBody.translation();
            let nx = cp.x - bp.x, ny = cp.y - bp.y;
            const dist = Math.sqrt(nx * nx + ny * ny);
            if (dist > 0.001) { nx /= dist; ny /= dist; } else { nx = 0; ny = -1; }
            const cv = theChip.linvel();
            const vn = cv.x * nx + cv.y * ny;
            theChip.setLinvel({
              x: cv.x - vn * nx + ICE_BOUNCE_SPEED * nx,
              y: cv.y - vn * ny + ICE_BOUNCE_SPEED * ny,
            }, true);

            this.events.push({
              type: 'ICE_CRACK',
              payload: { id: iceData.id, remainingHp: iceData.hp, maxHp: iceData.maxHp, x: bp.x, y: bp.y }
            });

            if (iceData.hp <= 0) {
              this.pendingRemovals.push(iceBody);
              this.events.push({
                type: 'ICE_DESTROY',
                payload: { id: iceData.id, x: bp.x, y: bp.y }
              });
            }
          }
        }
      }

      if (chipBody && sensorBody) {
        const chipData = chipBody.userData as any;
        const sensorData = sensorBody.userData as any;

        if (sensorData.type === 'portal') {
          const portalKey = `portal_${chipData.id}`;
          const lastWarp = this.lastWarpFrame.get(portalKey) ?? -99999;
          if (this.frame - lastWarp > PORTAL_COOLDOWN_FRAMES) {
            // [성능 최적화] 색상별 캐시 Map으로 O(1) 조회 — forEachRigidBody 제거
            const sameColorPortals = this.portalsByColor.get(sensorData.color) || [];
            const targetPortals = sameColorPortals.filter(b => b.handle !== sensorBody!.handle);
            if (targetPortals.length > 0) {
              const idx = Math.floor(this.rng() * targetPortals.length);
              const targetPortal = targetPortals[idx];
              const tPos = targetPortal.translation();
              chipBody.setTranslation({ x: tPos.x, y: tPos.y }, true);
              this.lastWarpFrame.set(portalKey, this.frame);
              this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'warp' } });
            }
          }
        } else if (sensorData.type === 'booster') {
          const angle = (sensorData.rotation ?? 0) * (Math.PI / 180);
          const dv = (sensorData.power || 3) * BOOSTER_DV_PER_LEVEL;
          this.applyDeltaV(chipBody, Math.sin(angle) * dv, -Math.cos(angle) * dv);
          this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'bumperHit', impulse: dv, x: sensorBody.translation().x } });
        } else if (sensorData.type === 'hole') {
          const holeKey = `hole_${chipData.id}`;
          const lastWarp = this.lastWarpFrame.get(holeKey) ?? -99999;
          if (this.frame - lastWarp > HOLE_COOLDOWN_FRAMES) {
            this.lastWarpFrame.set(holeKey, this.frame);
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
        } else if (sensorData.type === 'speedgate') {
          const gateId = sensorData.id;
          const cooldownKey = `speed_${chipData.id}_${gateId}`;
          const lastTrigger = this.lastWarpFrame.get(cooldownKey) || -99999;
          if (this.frame - lastTrigger > Math.round(120 * COOLDOWN_SCALE)) {
            this.lastWarpFrame.set(cooldownKey, this.frame);
            this.applyLuckyEffect(chipBody, chipData, 'speed_up', sensorData);
          }
        } else if (sensorData.type === 'slowgate') {
          const gateId = sensorData.id;
          const cooldownKey = `slow_${chipData.id}_${gateId}`;
          const lastTrigger = this.lastWarpFrame.get(cooldownKey) || -99999;
          if (this.frame - lastTrigger > Math.round(120 * COOLDOWN_SCALE)) {
            this.lastWarpFrame.set(cooldownKey, this.frame);
            this.applyLuckyEffect(chipBody, chipData, 'speed_down', sensorData);
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
      case 'speed_up': {
        const origDamping = chip.linearDamping();
        const origGravity = chip.gravityScale();
        chip.setLinearDamping(0.0);
        chip.setGravityScale(1.8, true);
        this.luckyEffects.push({
          body: chip, chipId: chipData.id,
          atFrame: this.frame + Math.round(600 * COOLDOWN_SCALE), // 10 seconds
          restore: () => {
            try {
              chip.setLinearDamping(origDamping);
              chip.setGravityScale(origGravity, true);
            } catch {}
          }
        });
        break;
      }
      case 'speed_down': {
        const origDamping = chip.linearDamping();
        const origGravity = chip.gravityScale();
        chip.setLinearDamping(3.0);
        chip.setGravityScale(0.4, true);
        this.luckyEffects.push({
          body: chip, chipId: chipData.id,
          atFrame: this.frame + Math.round(600 * COOLDOWN_SCALE), // 10 seconds
          restore: () => {
            try {
              chip.setLinearDamping(origDamping);
              chip.setGravityScale(origGravity, true);
            } catch {}
          }
        });
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
    // [성능 최적화] 캐시된 windcannon 목록 직접 사용 — forEachRigidBody 제거
    const cannons = this.cachedWindcannons;
    if (cannons.length === 0) return;
    
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
          // windForce는 MapBuilder에서 px/s² 단위로 정규화됨(에디터 레벨 값 ×20 환산 포함)
          const force = cd.windForce ?? 300;
          if (force > 0) this.applyDeltaV(chip, dirX * force * (1/60), dirY * force * (1/60));
        }
      }
    }
  }

  private applyFlippers() {
    // [성능 최적화] 캐시된 flipper 목록 직접 순회 — forEachRigidBody 제거
    for (const b of this.cachedFlippers) {
      const d = b.userData as any;
      if (!d) continue;
      
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
    }
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
          // 홀 리스폰은 위로 크게 되돌리므로, 구조 리스폰의 정체 시계도 새 위치 기준으로 재시작
          // (재하강 구간을 "정체"로 오판해 구조가 발동하는 것을 방지)
          this.rescueBaseY.set(r.chipId, r.y);
          this.rescueBaseFrame.set(r.chipId, this.frame);
          this.rescueTravel.set(r.chipId, 0);
          const hp = this.chipPrevPos.get(r.chipId);
          if (hp) { hp.x = r.x; hp.y = r.y; }
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
    // [성능 최적화] 캐시된 blackhole/whitehole 목록 직접 사용 — forEachRigidBody 제거
    const blackholes = this.cachedBlackholes;
    const whiteholes = this.cachedWhiteholes;
    if (blackholes.length === 0 && whiteholes.length === 0) return;

    const dt = this.world!.integrationParameters.dt;

    // 블랙홀: 중심으로 끌어당기는 radial 성분 + 접선(swirl) 성분 → "빨려드는 소용돌이".
    // 매 프레임 Δv(px/s)를 질량정규화로 부여. force 는 중심부 Δv/frame 에 직결된다.
    // 추가로 필드 내부에서 속도를 서서히 감쇠(BLACKHOLE_DRAG_PER_S)해 "서서히 빨려드는"
    // 질감을 만든다. 위 방향 흡인 감쇠(WELL_UPWARD_DAMP)로 영구 포획은 방지된다.
    blackholes.forEach((bh) => {
      const bhData = bh.userData as any;
      const bhPos = bh.translation();
      const radius = bhData.radius || 150;
      const S = Math.min(bhData.force ?? 5, WELL_FORCE_CAP) * WELL_DV_PER_FORCE;
      if (S <= 0) return; // anti-stuck 타임아웃(force=0) 시 완전 비활성
      this.activeChips.forEach((chip) => {
        const data = chip.userData as any;
        if (data?.finished) return;
        const cPos = chip.translation();
        const dx = bhPos.x - cPos.x;
        const dy = bhPos.y - cPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius && dist > WELL_DEADZONE) {
          // sqrt falloff: 선형 falloff는 종단속도 통과 시(체류 ~0.3초) 외곽~중간 거리대의
          // 힘이 너무 작아 무효과로 체감됐다. sqrt 곡선으로 중간 거리 흡인을 끌어올린다.
          const falloff = Math.sqrt(1 - dist / radius);
          const ux = dx / dist, uy = dy / dist;
          const v = chip.linvel();
          // 속도 적응 보정: 종단속도(~800px/s) 통과는 체류가 짧아 같은 Δv/frame으로는
          // 휨이 절반 이하로 체감된다. 빠를수록 흡인을 키우고(최대 2배), 감속으로 칩이
          // 느려지면 자동으로 기본 강도로 복귀하므로 저속 영구포획 위험은 늘지 않는다.
          const speedBoost = Math.min(2, Math.max(1, Math.hypot(v.x, v.y) / 450));
          const radialDv = S * falloff * speedBoost;
          const swirlDv = S * BLACKHOLE_SWIRL * falloff * speedBoost;
          // 내부 감속(중심에 가까울수록 강함) — 체류 시간을 늘려 흡인을 체감시킨다.
          // 반드시 흡인 임펄스보다 먼저 적용(setLinvel이 직후 임펄스를 덮어쓰지 않도록).
          const drag = Math.min(BLACKHOLE_DRAG_PER_S * falloff * dt, 0.5);
          chip.setLinvel({ x: v.x * (1 - drag), y: v.y * (1 - drag) }, true);
          // 접선 방향 = radial 을 90° 회전한 (-uy, ux)
          this.applyWellDeltaV(chip, ux * radialDv - uy * swirlDv, uy * radialDv + ux * swirlDv);
        }
      });
    });

    // 화이트홀: 필드 내 칩을 중심으로 흡입하고, 중심(WH_CAPTURE_DIST)에 도달하면
    // 다른 화이트홀(없으면 자기 자신)에서 무작위 하방 편향 방향으로 뱉어낸다.
    whiteholes.forEach((wh) => {
      const whData = wh.userData as any;
      const whPos = wh.translation();
      const radius = whData.radius || 100;
      const forceVal = Math.min(whData.force ?? 5, WELL_FORCE_CAP);
      const S = forceVal * WELL_DV_PER_FORCE;
      if (S <= 0) return; // anti-stuck 타임아웃(force=0) 시 완전 비활성
      this.activeChips.forEach((chip) => {
        const data = chip.userData as any;
        if (data?.finished) return;
        // 방금 배출된 칩은 쿨다운 동안 모든 화이트홀 흡입 면제(배출→재흡입 핑퐁 방지)
        const ejectKey = `whitehole_${data.id}`;
        const lastEject = this.lastWarpFrame.get(ejectKey) ?? -99999;
        if (this.frame - lastEject < WH_EJECT_COOLDOWN_FRAMES) return;
        const cPos = chip.translation();
        const dx = whPos.x - cPos.x;
        const dy = whPos.y - cPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= radius) return;

        if (dist <= WH_CAPTURE_DIST) {
          // ── 포획 → 배출: 다른 화이트홀이 있으면 그중 하나로 워프해서 뱉어낸다 ──
          this.lastWarpFrame.set(ejectKey, this.frame);
          const exits = whiteholes.filter((o) => o.handle !== wh.handle);
          const exit = exits.length > 0 ? exits[Math.floor(this.rng() * exits.length)] : wh;
          const ePos = exit.translation();
          // 배출 방향: 수직 아래(+y) 기준 ±99° 무작위 — 옆/아래로 뱉어 레이스 흐름 유지
          const ang = Math.PI / 2 + (this.rng() - 0.5) * Math.PI * 1.1;
          const dirX = Math.cos(ang), dirY = Math.sin(ang);
          const speed = WH_EJECT_SPEED_BASE + forceVal * WH_EJECT_SPEED_PER_FORCE;
          chip.setTranslation({ x: ePos.x + dirX * 30, y: ePos.y + dirY * 30 }, true);
          chip.setLinvel({ x: dirX * speed, y: dirY * speed }, true);
          this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'warp' } });
          this.events.push({
            type: 'WHITEHOLE_EJECT',
            payload: { chipId: data.id, fromId: whData.id, toId: (exit.userData as any)?.id, x: ePos.x, y: ePos.y },
          });
        } else if (dist > WELL_DEADZONE) {
          // ── 흡입: 블랙홀과 동일한 radial 흡인(swirl 없음, sqrt falloff + 속도 적응 보정) ──
          const v = chip.linvel();
          const speedBoost = Math.min(2, Math.max(1, Math.hypot(v.x, v.y) / 450));
          const pullDv = S * Math.sqrt(1 - dist / radius) * speedBoost;
          this.applyWellDeltaV(chip, (dx / dist) * pullDv, (dy / dist) * pullDv);
        }
      });
    });
  }

  private applyPistons() {
    const world = this.world!;
    // 실제 적분 dt(sim 시간). 전역 배속(0.7)·슬로모션이 반영된 값이라 피스톤이 다른 물리와 같은 시간축을 탄다.
    const dtSim = world.integrationParameters.dt;
    if (dtSim <= 0) return;

    // 위상 시계를 sim 시간에 비례해 진행(프레임 등가: dt*60). 스텝 후 도달할 "다음" 위상.
    const clockNext = this.pistonClock + dtSim * 60;

    // [성능 최적화] 캐시된 kinematic 강체(windmill/spinner/piston) 직접 순회 — forEachRigidBody 제거
    for (const b of this.cachedKinematics) {
      const d = b.userData as any;

      // 풍차/스피너: kinematicVelocityBased는 매 프레임 속도를 재설정해야 유지됨
      if ((d?.type === 'windmill' || d?.type === 'spinner') && d.speed) {
        b.setAngvel(d.speed, true);
        continue;
      }

      if (d?.type === 'piston' && d.waypointB) {
        const speed = d.speed || 2;
        const tNext = (Math.sin(clockNext * speed * 0.01) + 1) / 2;
        const ax = d.originX, ay = d.originY;
        const bx = d.waypointB.x, by = d.waypointB.y;

        const targetX = ax + (bx - ax) * tNext;
        const targetY = ay + (by - ay) * tNext;

        const currentPos = b.translation();

        // 목표 위치에 도달하기 위한 정확한 선속도(VelocityBased Kinematic). 분모는 실제 적분 dt.
        const vx = (targetX - currentPos.x) / dtSim;
        const vy = (targetY - currentPos.y) / dtSim;

        b.setLinvel({ x: vx, y: vy }, true);
      }
    }

    this.pistonClock = clockNext;
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
          this.gameOverFrame = this.frame; // 마무리 가속/견인(FINISH RUSH) 램프 기준점
          this.events.push({ type: 'GAME_OVER', payload: { winners, mode: this.gameMode } });
        }
      }
    }
    return totalSpeed;
  }

  private applyAntiStuck(totalSpeed: number) {
    const world = this.world!;
    // "플레이 시간" 설정에 따른 개입 시점 스케일: 0.5(빠른 구조) ← 1.0(중립) → 1.8(느긋)
    const winScale = this.stuckWindowScale;
    // totalSpeed는 미완주 칩만 합산(scanChipsAndFinish)하므로 분모도 미완주 수로 맞춘다.
    // (기존: 전체 칩 수로 나눠 완주자가 늘수록 평균이 과소평가 → 종반 폭풍 과발동 버그)
    const racingCount = Math.max(1, this.activeChips.length - this.finishedChips.size);
    const avgSpeed = totalSpeed / racingCount;

    // Level 1: Gravity Storm — 평균 속도 < 10 이 기본 5초(300프레임, 플레이 시간 비례) 지속 시 전체 넉백
    if (avgSpeed < 10) {
      this.lowSpeedFrames++;
      if (this.lowSpeedFrames > Math.round(300 * winScale)) {
        this.events.push({ type: 'GRAVITY_STORM' });
        // 질량정규화 넉백(Δv px/s): 가로로 흩고 약하게 위로 띄운 뒤 다시 낙하시킴.
        // 수평 성분 축소(±350→±150): 정체 해소 목적은 유지하되 측면 산포(해파리 표류) 완화.
        // 완주해 결승선 아래 정지한 칩은 제외(흔들 이유가 없음).
        // 난수는 this.rng 사용 — 헤드리스 하네스의 시드 재현(결정론)을 완전하게 유지.
        this.activeChips.forEach((chip) => {
          const d = chip.userData as any;
          if (d && this.finishedChips.has(d.id)) return;
          this.applyDeltaV(chip, (this.rng() - 0.5) * 300, -this.rng() * 350);
        });
        this.lowSpeedFrames = 0;
      }
    } else {
      this.lowSpeedFrames = 0;
    }

    // Level 2: Y축 진척 체크 — 진전 없는 칩에 탈출 임펄스. 임펄스가 연속 실패하면
    // "밀폐 포켓" 끼임으로 판단해 구조 리스폰(§4.B)으로 격상한다.
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
      // 구조 리스폰용 "진짜 정체" 기준점 갱신: 기준 y보다 80px 더 내려갔으면 전진으로 인정.
      // L2 임펄스 판정과 독립 — 임펄스는 기존 동작 그대로 유지하고, 리스폰만 이 기준을 본다.
      // (chipMaxY 단일 프레임 델타 기준은 정상 하강 칩도 "정체"로 오판해 리스폰이 남발된다.)
      const baseY = this.rescueBaseY.get(data.id);
      if (baseY === undefined || t.y > baseY + 80) {
        this.rescueBaseY.set(data.id, t.y);
        this.rescueBaseFrame.set(data.id, this.frame);
        this.rescueTravel.set(data.id, 0);
      }
      // 정체 기간 누적 이동량(쐐기 끼임 vs 그릇 순환 판별용)
      const prev = this.chipPrevPos.get(data.id);
      if (prev) {
        this.rescueTravel.set(data.id, (this.rescueTravel.get(data.id) || 0) + Math.hypot(t.x - prev.x, t.y - prev.y));
        prev.x = t.x; prev.y = t.y;
      } else {
        this.chipPrevPos.set(data.id, { x: t.x, y: t.y });
      }
      const lastProgress = this.chipLastProgressFrame.get(data.id) || 0;
      // 5초(300프레임) 진전 없으면 탈출 임펄스 — 수직 주도 재설계(PRD-gameplay-dynamics §4.A3).
      // 기존 수평 최대 ±450(중앙 x=400 하드코딩)이 "갑자기 옆으로 발사"의 주범이었으므로
      // 수평은 중앙 지향 ±150으로 캡하고 하향 500 주도로 끼임을 해소한다.
      // ⚠️ L2 윈도는 플레이 시간 슬라이더로 스케일하지 않는다: 이 임펄스는 정상 주행 칩에도
      // 주기적으로 걸리는 기존 특성이 있어, 주기를 바꾸면 우승 확정 전 레이스 페이스 자체가
      // 변해 승패가 달라진다(시뮬 검증으로 확인). 스케일은 구조 격상·L1·L3에만 적용한다.
      const l2Window = Math.round(300 * COOLDOWN_SCALE);
      if (this.frame - lastProgress > l2Window) {
        // 임펄스 (RESCUE_AFTER_L2_FAILURES)회 상당의 시간(기본 ~3윈도, 플레이 시간 비례)
        // 동안 80px도 전진하지 못했다면 밀폐 포켓 끼임으로 판단하고 구조 리스폰(§4.B)으로 격상.
        const stuckSince = this.rescueBaseFrame.get(data.id) ?? this.frame;
        const stuckFrames = Math.max(1, this.frame - stuckSince);
        const lastRescue = this.chipLastRescueFrame.get(data.id) ?? -99999;
        const v = chip.linvel();
        const avgTravelSpeed = ((this.rescueTravel.get(data.id) || 0) / stuckFrames) * 60;
        // 1단계(쐐기): 거의 정지 상태로 진전 없음 → 빠르게 구조(기본 ~17초).
        // 2단계(하드): 움직이지만(그릇 순환/포탈 루프) 오래 진전 없음 → 게이트 무시 구조(기본 ~55초).
        const wedgeStuck =
          stuckFrames > Math.round(l2Window * (RESCUE_AFTER_L2_FAILURES + 1) * winScale) &&
          Math.hypot(v.x, v.y) < RESCUE_MAX_SPEED && // 순환/루프 중인 칩 제외 — 쐐기 끼임만
          avgTravelSpeed < RESCUE_MAX_AVG_SPEED;     // 그릇 안에서 휘저어지는 칩 제외
        const hardStuck = stuckFrames > Math.round(l2Window * RESCUE_HARD_MULT * winScale);
        const canRescue =
          (wedgeStuck || hardStuck) &&
          chip.gravityScale() !== 0 && // 홀 트랩/스턴 동결 상태 제외
          this.frame - lastRescue >= RESCUE_MIN_INTERVAL;
        if (canRescue && this.rescueChip(chip, data.id, t)) {
          this.chipLastRescueFrame.set(data.id, this.frame);
        } else {
          const towardCenter = Math.max(-150, Math.min(150, (this.worldWidth / 2 - t.x) * 0.5));
          this.applyDeltaV(chip, towardCenter + (this.rng() - 0.5) * 80, 500);
        }
        this.chipLastProgressFrame.set(data.id, this.frame);
      }
    });

    // Level 3: Absolute Timeout — 기본 3분(10800프레임, 플레이 시간 비례) 경과 시 중력 2배 + 중력장 비활성화.
    // 트리거 프레임이 슬라이더로 실시간에 변할 수 있으므로 === 비교 대신 >= + 1회 플래그로 판정.
    if (!this.l3Fired && this.frame >= Math.round(10800 * COOLDOWN_SCALE * winScale)) {
      this.l3Fired = true;
      const grav = world.gravity;
      world.gravity = { x: grav.x, y: grav.y * 2 };
      // [성능 최적화] 캐시 사용 — forEachRigidBody 제거
      for (const b of this.cachedBlackholes) { (b.userData as any).force = 0; }
      for (const b of this.cachedWhiteholes) { (b.userData as any).force = 0; }
      this.events.push({ type: 'FINAL_SURGE' }); // UI 연출 표면화용(PRD-endgame-pacing §4.C-4)
    }
  }

  // ── 구조 리스폰 (PRD-endgame-pacing §4.B) ──
  // 핵심 규칙: ① 열린 공간 검증(키프아웃 원 + 외벽 지오메트리) ② 진행도(chipMaxY)를
  // 초과해 전진하지 않음(공정성) ③ 실패 시 기존 임펄스로 대체(무한 안전).
  private rescueChip(chip: RAPIER.RigidBody, chipId: string, from: { x: number; y: number }): boolean {
    const maxY = this.chipMaxY.get(chipId) ?? from.y;
    const endMargin = this.layoutConfig?.endMarginPercent ?? 0.02;
    const finishLineY = this.worldHeight * (1 - endMargin);
    const yMin = (this.layoutConfig?.startLineY ?? 70) + 50;
    // 벌어놓은 진행도 + 소폭(30px) 이내로만 전진 허용, 결승선 직전 100px 배치 금지
    const yMax = Math.min(maxY + RESCUE_FORWARD_CAP, from.y + 40, finishLineY - 100);
    const target = this.findRescueSpot(from.x, from.y, yMin, Math.max(yMin, yMax));
    if (!target) return false;
    chip.setTranslation(target, true);
    chip.setLinvel({ x: 0, y: 0 }, true);
    SkillSystem.recalcPhysics(chip, chipId);
    // 리스폰 지점 기준으로 정체 시계·이동량 추적을 재시작(즉시 재발동/이동량 오산입 방지)
    this.rescueBaseY.set(chipId, target.y);
    this.rescueBaseFrame.set(chipId, this.frame);
    this.rescueTravel.set(chipId, 0);
    const rp = this.chipPrevPos.get(chipId);
    if (rp) { rp.x = target.x; rp.y = target.y; }
    this.events.push({ type: 'SOUND_EFFECT', payload: { type: 'warp' } });
    this.events.push({ type: 'CHIP_RESCUED', payload: { chipId, from: { x: from.x, y: from.y }, to: target } });
    return true;
  }

  // 링 샘플링(반경 점증) → 외벽 지오메트리로 x 클램프 → 키프아웃 원 검증. 난수는 this.rng(결정론).
  private findRescueSpot(cx: number, cy: number, yMin: number, yMax: number): { x: number; y: number } | null {
    // 중앙 편향: 끼임은 대부분 벽-기물 사이 포켓에서 발생하므로(진단 샘플 근거),
    // 배치 기준점을 중앙 쪽으로 30% 당겨 같은 포켓으로의 재낙하를 줄인다.
    const bx = cx + (this.worldWidth / 2 - cx) * 0.3;
    for (let i = 0; i < RESCUE_MAX_ATTEMPTS; i++) {
      const r = RESCUE_RING_BASE + i * RESCUE_RING_STEP;
      const ang = this.rng() * Math.PI * 2;
      const y = Math.min(yMax, Math.max(yMin, cy + Math.sin(ang) * r * 0.5));
      const spot = this.clampToPlayArea(bx + Math.cos(ang) * r, y);
      if (spot && this.isSpotClear(this.rescueZones, spot.x, spot.y)) return spot;
    }
    // 폴백: 해당 y의 플레이 영역 중앙선(80px 위) — 위험 기물(hole/중력장)만 회피 확인.
    // 그마저 막히면 null → 호출부가 기존 탈출 임펄스로 대체하고 다음 윈도에 재시도한다.
    const fy = Math.min(yMax, Math.max(yMin, cy - 80));
    const spot = this.clampToPlayArea(this.worldWidth / 2, fy);
    if (spot) {
      const wt = getWallTransform(fy, this.worldHeight, this.wallStyle);
      spot.x = (wt.leftOffset + (this.worldWidth - wt.rightOffset)) / 2; // 실제 내폭 중앙
      if (this.isSpotClear(this.rescueHazards, spot.x, spot.y)) return spot;
    }
    return null;
  }

  // 임의 y에서 외벽 안쪽(클리어런스 포함)으로 x를 클램프. 내폭이 없으면 null.
  private clampToPlayArea(x: number, y: number): { x: number; y: number } | null {
    const wt = getWallTransform(y, this.worldHeight, this.wallStyle);
    const innerL = wt.leftOffset + RESCUE_CLEARANCE;
    const innerR = this.worldWidth - wt.rightOffset - RESCUE_CLEARANCE;
    if (innerR <= innerL) return null;
    return { x: Math.min(innerR, Math.max(innerL, x)), y };
  }

  private isSpotClear(zones: KeepOutZone[], x: number, y: number): boolean {
    for (const z of zones) {
      if (Math.abs(z.y - y) > 400) continue; // 원거리 존 프리필터
      const dx = x - z.x, dy = y - z.y;
      const req = z.r + RESCUE_CLEARANCE;
      if (dx * dx + dy * dy < req * req) return false;
    }
    return true;
  }
}
