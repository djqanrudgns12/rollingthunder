import { EditorItem } from '@/store/editorStore';
import type { WallStyle } from './MapBuilder';

// 맵 프리셋 메타데이터: 각 맵의 이름·길이·복잡도·외벽 스타일·장애물 좌표를 하나로 묶음
export interface MapPresetMeta {
  name: string;                              // UI에 표시될 맵 이름
  description: string;                       // 맵 특성 한 줄 설명
  lengthType: 'Short' | 'Middle' | 'Long';   // 길이 분류
  complexity: 'Simple' | 'Medium' | 'Complex'; // 복잡도 분류
  worldHeight: number;                       // 이 맵 전용 월드 높이
  wallStyle: WallStyle;                      // 외벽 스타일 (straight/zigzag/narrow/wide)
  bgImage?: string;                          // 맵별 전용 배경 이미지 경로
  items: EditorItem[];                       // 장애물 배치 배열
}

// ──────────────────────────────────────────────
// 맵 설계 황금률 (모든 맵에 적용):
// 1. 깔때기 하단 틈 ≥ 80px (칩 3개 동시 통과)
// 2. 맵 내부 벽 |rotation| ≥ 8° (수평 위 무한 점프 방지)
// 3. 장애물 x 좌표 60~740 범위 내
// 4. 결승선 전 마지막 200px은 장애물 없음
// 5. 풍차(반경 50px) 바로 아래 150px은 빈 공간
// 6. [엣지허깅 차단] 가쪽 직낙 통로 금지. 서펜타인 램프(serp)나 디플렉터로
//    모든 칩이 좌우로 휘둘리며 중앙을 통과하게 한다. → 메인 기믹이 실제로 칩과 부딪힘.
// 7. [순수 운] 유저 개입 없음. 분기/지름길은 맵이 확률적으로 만든다(splitPeak/포탈).
//    진행을 막거나 정체시키는 구조 금지(헤드리스 시뮬레이션으로 검증).
// 8. [강도] 범퍼 탄성 ≤ 2.0, 벽 탄성 ≤ 1.6 (폭주/무한바운스 방지).
// ──────────────────────────────────────────────

// ── MapKit: 맵 구성 헬퍼 ────────────────────────────────────────────────
// 좌표계: x ∈ [0,800](플레이 70~730), y 0→worldHeight, rotation=도(°).
let _kitId = 0;
const kid = (p: string) => `${p}_${_kitId++}`;

// 서펜타인 램프: 한쪽 벽에 붙어 반대쪽으로 흘러내리며 끝에 틈을 남기는 긴 경사벽을
// 좌우 교대로 쌓는다. 가쪽 직낙을 원천 차단하고 경로를 늘리며, 모든 칩이 중앙을
// 가로지르게 만드는 핵심 구조. gap 은 램프 사이 수직 간격.
function serp(y0: number, count: number, opts: { gapY?: number; rest?: number; deg?: number; friction?: number } = {}): EditorItem[] {
  const gapY = opts.gapY ?? 230;
  const rest = opts.rest ?? 0.25;
  const deg = opts.deg ?? 11;
  // 낮은 마찰(기본 0.08): 칩이 경사면/벽 코너에 들러붙지 않고 미끄러져 내려가게 한다.
  // 코너 끼임을 원천 차단하고 낙하 속도도 자연스럽게 확보한다.
  const friction = opts.friction ?? 0.08;
  const out: EditorItem[] = [];
  for (let i = 0; i < count; i++) {
    const y = y0 + i * gapY;
    const gapRight = i % 2 === 0; // 짝수: 오른쪽에 틈 / 홀수: 왼쪽에 틈
    if (gapRight) {
      // 왼쪽 벽에 붙어 오른쪽으로 내려감(오른쪽 끝 x≈700에 틈)
      out.push({ id: kid('sp'), type: 'wall', x: 340, y, w: 720, h: 20, rotation: deg, restitution: rest, friction });
    } else {
      // 오른쪽 벽에 붙어 왼쪽으로 내려감(왼쪽 끝 x≈100에 틈)
      out.push({ id: kid('sp'), type: 'wall', x: 460, y, w: 720, h: 20, rotation: -deg, restitution: rest, friction });
    }
  }
  return out;
}

// 헥사 핀 필드: 균일 분산 핀 격자(순수 운 감속/산란). bumperEvery>0 이면 일부를 범퍼로.
function pinField(y0: number, rows: number, opts: { spacing?: number; r?: number; bumperEvery?: number } = {}): EditorItem[] {
  const spacing = opts.spacing ?? 70;
  const r = opts.r ?? 9;
  const bumperEvery = opts.bumperEvery ?? 0;
  const out: EditorItem[] = [];
  let n = 0;
  for (let row = 0; row < rows; row++) {
    const y = y0 + row * spacing;
    const offset = (row % 2) * (spacing / 2);
    for (let x = 90 + offset; x <= 710; x += spacing) {
      const isBumper = bumperEvery > 0 && n % bumperEvery === 0;
      out.push(isBumper
        ? { id: kid('pf'), type: 'bumper', x, y, radius: r + 3, restitution: 1.3 }
        : { id: kid('pf'), type: 'pin', x, y, radius: r });
      n++;
    }
  }
  return out;
}

// 출구 깔때기: 중앙 gap 으로 수렴하는 한 쌍. 결승 직전 수렴용. 낮은 마찰로 들러붙음 방지.
function funnel(y: number, opts: { gap?: number; deg?: number; len?: number } = {}): EditorItem[] {
  const gap = opts.gap ?? 110;
  const deg = opts.deg ?? 22;
  const len = opts.len ?? 260;
  return [
    { id: kid('fn'), type: 'wall', x: 400 - gap / 2 - len * 0.36, y, w: len, h: 20, rotation: deg, friction: 0.1 },
    { id: kid('fn'), type: 'wall', x: 400 + gap / 2 + len * 0.36, y, w: len, h: 20, rotation: -deg, friction: 0.1 },
  ];
}

export const MapPresets: Record<string, MapPresetMeta> = {

  // ========== MAP 1: 네온 아케이드 ==========
  'neon_arcade': {
    name: '네온 아케이드',
    description: '범퍼·부스터·풍차가 난무하는 아케이드. 중앙 포탈이 확률적 지름길을 연다',
    lengthType: 'Middle',
    complexity: 'Medium',
    worldHeight: 2500,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_neon_arcade.png',
    items: [
      // 입구 깔때기 → 시작 위치 무력화
      ...funnel(170, { gap: 150, deg: 24, len: 280 }),
      // 1단: 서펜타인(340~800) + 중앙 범퍼 + 틈 부스터
      ...serp(340, 3, { gapY: 230, rest: 0.25 }),
      { id: 'n_bp1', type: 'bumper', x: 400, y: 460, radius: 20, restitution: 1.5 },
      { id: 'n_bp2', type: 'bumper', x: 330, y: 690, radius: 16, restitution: 1.4 },
      { id: 'n_bp3', type: 'bumper', x: 470, y: 690, radius: 16, restitution: 1.4 },
      { id: 'n_b1', type: 'booster', x: 690, y: 460, rotation: 195, power: 3 },
      { id: 'n_b2', type: 'booster', x: 110, y: 690, rotation: 165, power: 3 },
      // 풍차 챔버(중앙, 아래 220px 클리어 → 모든 칩 통과)
      { id: 'n_wm1', type: 'windmill', x: 630, y: 960, speed: 5 },
      // 확률 분기 지름길: 중앙 포탈 입구를 지나는 칩만 아래로 워프
      { id: 'n_pa1', type: 'portal', x: 400, y: 1180, color: '#FF6600' },
      { id: 'n_pa2', type: 'portal', x: 600, y: 1620, color: '#FF6600' },
      ...pinField(1240, 1, { spacing: 70, bumperEvery: 3 }),
      // 2단: 서펜타인(1360~1820) + 중앙 범퍼 + 부스터
      ...serp(1360, 3, { gapY: 230, rest: 0.25 }),
      { id: 'n_bp4', type: 'bumper', x: 400, y: 1480, radius: 18, restitution: 1.5 },
      { id: 'n_b3', type: 'booster', x: 690, y: 1700, rotation: 195, power: 3 },
      // 풍차 챔버(중앙)
      { id: 'n_wm2', type: 'windmill', x: 630, y: 2020, speed: -6 },
      ...pinField(2240, 1, { spacing: 70, bumperEvery: 4 }),
      // 출구 깔때기
      ...funnel(2300, { gap: 120 }),
    ],
  },

  // ========== MAP 2: 블랙홀의 함정 ==========
  'gravity_abyss': {
    name: '블랙홀의 함정',
    description: '낙하 경로에 박힌 블랙홀 소용돌이와 화이트홀 반발이 궤적을 비트는 중력장 미궁',
    lengthType: 'Middle',
    complexity: 'Complex',
    worldHeight: 2300,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_gravity_abyss.png',
    items: [
      // 입구 깔때기 → 시작 위치 무력화
      ...funnel(170, { gap: 150, deg: 24, len: 280 }),
      // 서펜타인이 페이스를 잡고, 중력장은 force 3~4의 "부드러운 휨"으로 통과시킨다.
      // (force가 크면 칩이 수평 진동에 갇혀 정체되므로 ≤4로 절제)
      ...serp(330, 3, { gapY: 230, rest: 0.2 }),
      { id: 'g_bh1', type: 'blackhole', x: 400, y: 560, radius: 120, force: 4 },
      { id: 'g_wh1', type: 'whitehole', x: 300, y: 900, radius: 110, force: 3 },
      ...pinField(960, 2, { spacing: 66 }),
      ...serp(1130, 3, { gapY: 230, rest: 0.2 }),
      { id: 'g_bh2', type: 'blackhole', x: 380, y: 1360, radius: 120, force: 4 },
      { id: 'g_wh2', type: 'whitehole', x: 520, y: 1590, radius: 110, force: 3 },
      // 피스톤 게이트(타이밍 운)
      { id: 'g_ps1', type: 'piston', x: 400, y: 1790, w: 150, h: 20, speed: 3, waypointB: { x: 250, y: 1790 } },
      ...pinField(1900, 2, { spacing: 64 }),
      // 출구 깔때기
      ...funnel(2080, { gap: 120 }),
    ],
  },

  // ========== MAP 3: 톱니바퀴 공장 ==========
  'mechanical_factory': {
    name: '톱니바퀴 공장',
    description: '풍차·고탄성벽',
    lengthType: 'Long',
    complexity: 'Complex',
    worldHeight: 2600,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_mechanical_factory.png',
    items: [
      // 입구 깔때기 → 시작 위치 무력화
      ...funnel(170, { gap: 150, deg: 24, len: 280 }),
      // 1단: 서펜타인(340~800) → 풍차 챔버(아래 150px 클리어) → 피스톤
      ...serp(340, 3, { gapY: 230, rest: 0.3 }),
      { id: 'm_wm1', type: 'windmill', x: 630, y: 960, speed: 6 },
      { id: 'm_ps1', type: 'piston', x: 330, y: 1180, w: 150, h: 20, speed: 2, waypointB: { x: 540, y: 1180 } },
      ...pinField(1320, 1, { spacing: 70, bumperEvery: 3 }),
      // 2단: 서펜타인(1440~1900) + 부스터 + 측면 hole 함정(피할 수 있는 위험)
      ...serp(1440, 3, { gapY: 230, rest: 0.3 }),
      { id: 'm_b1', type: 'booster', x: 690, y: 1560, rotation: 190, power: 3 },
      { id: 'm_h1', type: 'hole', x: 250, y: 1790, radius: 26 },
      // 풍차 챔버 + 피스톤
      { id: 'm_wm2', type: 'windmill', x: 630, y: 2080, speed: -10 },
      { id: 'm_ps2', type: 'piston', x: 330, y: 2300, w: 130, h: 20, speed: 3, waypointB: { x: 520, y: 2300 } },
      { id: 'm_b2', type: 'booster', x: 110, y: 2200, rotation: 170, power: 3 },
      // 출구 깔때기
      ...funnel(2440, { gap: 130 }),
    ],
  },

  // ========== MAP 4: 부스트 하이웨이 ==========
  'boost_highway': {
    name: '부스트 하이웨이',
    description: '서펜타인 슬로프를 따라 부스터로 가속하는 스프린트',
    lengthType: 'Middle',
    complexity: 'Medium',
    worldHeight: 2200,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_boost_highway.png',
    items: [
      // 입구 깔때기: 모든 칩을 중앙으로 모아 시작 위치 유불리 제거(순수 운). 틈을 넓혀 정체 방지.
      ...funnel(170, { gap: 150, deg: 24, len: 280 }),
      // 1차 서펜타인 + 하향 부스터(틈마다 100% 적중 가속)
      ...serp(340, 3, { gapY: 230, rest: 0.2, deg: 13 }),
      { id: 'bh_b0', type: 'booster', x: 690, y: 460, rotation: 190, power: 3 },
      { id: 'bh_b1', type: 'booster', x: 110, y: 690, rotation: 170, power: 3 },
      // 핀 산란대: 순위를 뒤섞음
      ...pinField(920, 2, { spacing: 64, r: 9, bumperEvery: 4 }),
      // 2차 서펜타인 + 부스터
      ...serp(1100, 3, { gapY: 230, rest: 0.2, deg: 13 }),
      { id: 'bh_b2', type: 'booster', x: 690, y: 1220, rotation: 190, power: 3 },
      { id: 'bh_b3', type: 'booster', x: 110, y: 1450, rotation: 170, power: 3 },
      { id: 'bh_b4', type: 'booster', x: 690, y: 1680, rotation: 190, power: 3 },
      // 출구 깔때기
      ...funnel(1980, { gap: 140 }),
    ],
  },

  // ========== MAP 5: 차원 포탈 미궁 ==========
  'portal_labyrinth': {
    name: '차원 포탈 미궁',
    description: '낙하 중 마주치는 포탈이 칩을 확률적으로 워프시키는 차원 미궁(지름길/후퇴 공존)',
    lengthType: 'Middle',
    complexity: 'Complex',
    worldHeight: 2400,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_portal_labyrinth.png',
    items: [
      // 입구 깔때기 → 시작 위치 무력화
      ...funnel(170, { gap: 150, deg: 24, len: 280 }),
      // 1단: 서펜타인(330~790). 포탈A 입구(중앙)를 지나는 칩만 대형 워프(지름길)
      ...serp(330, 3, { gapY: 230, rest: 0.25 }),
      { id: 'pl_pa1', type: 'portal', x: 400, y: 450, color: '#FF6600' },
      { id: 'pl_pa2', type: 'portal', x: 300, y: 1180, color: '#FF6600' },
      // 풍차 챔버(아래 220px 클리어)
      { id: 'pl_wm1', type: 'windmill', x: 630, y: 960, speed: 5 },
      ...pinField(1180, 1, { spacing: 70, bumperEvery: 4 }),
      // 2단: 서펜타인(1320~1780). 포탈B = 또 다른 확률 지름길
      ...serp(1320, 3, { gapY: 230, rest: 0.25 }),
      { id: 'pl_pb1', type: 'portal', x: 400, y: 1440, color: '#00FF66' },
      { id: 'pl_pb2', type: 'portal', x: 520, y: 1980, color: '#00FF66' },
      // 풍차 챔버
      { id: 'pl_wm2', type: 'windmill', x: 630, y: 1980, speed: -6 },
      // 출구 깔때기
      ...funnel(2200, { gap: 120 }),
    ],
  },

  // ========== MAP 6: 플링코 폭포 ==========
  'plinko_cascade': {
    name: '플링코 폭포',
    description: '대량의 핀이 칩을 무작위로 튕겨내는 순수 운(運)의 플링코 폭포',
    lengthType: 'Long',
    complexity: 'Complex',
    worldHeight: 3300,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_plinko_cascade.png',
    items: [
      // 입구 깔때기 → 시작 위치 무력화(가벼운 수렴)
      ...funnel(170, { gap: 170, deg: 22, len: 280 }),
      // 상단 핀 폭포(헥사 격자). 끼임 방지를 위해 간격을 너무 좁히지 않는다(≥60).
      ...pinField(320, 13, { spacing: 62, r: 8, bumperEvery: 11 }),
      // 1차 휴식: 범퍼 서프라이즈(예측불가 튕김)
      { id: 'pk_b1', type: 'bumper', x: 250, y: 1180, radius: 18, restitution: 1.6 },
      { id: 'pk_b2', type: 'bumper', x: 400, y: 1230, radius: 20, restitution: 1.6 },
      { id: 'pk_b3', type: 'bumper', x: 550, y: 1180, radius: 18, restitution: 1.6 },
      // 중단 핀 폭포
      ...pinField(1360, 13, { spacing: 64, r: 8, bumperEvery: 13 }),
      // 2차 범퍼 휴식
      { id: 'pk_b4', type: 'bumper', x: 320, y: 2240, radius: 16, restitution: 1.5 },
      { id: 'pk_b5', type: 'bumper', x: 500, y: 2240, radius: 16, restitution: 1.5 },
      // 하단 핀 폭포
      ...pinField(2380, 10, { spacing: 66, r: 8, bumperEvery: 15 }),
      // 출구 깔때기
      ...funnel(3120, { gap: 130 }),
    ],
  },

  // ========== MAP 7: 운명의 룰렛 ==========
  'roulette_of_fate': {
    name: '운명의 룰렛',
    description: '거대 깔때기로 모인 칩을 화이트홀이 폭발적으로 흩뿌리는 운명의 룰렛',
    lengthType: 'Middle',
    complexity: 'Medium',
    worldHeight: 2200,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_roulette_of_fate.png',
    items: [
      // 거대 깔때기(테마): 모든 칩을 좁은 중앙으로 수렴 → 시작 위치 완전 무력화
      ...funnel(220, { gap: 110, deg: 32, len: 360 }),
      // 룰렛의 핵심: 수렴한 칩 무리를 화이트홀이 사방으로 흩뿌린다(운명의 분산)
      { id: 'rf_wh1', type: 'whitehole', x: 400, y: 560, radius: 140, force: 6 },
      ...serp(720, 3, { gapY: 230, rest: 0.3 }),
      { id: 'rf_wh2', type: 'whitehole', x: 400, y: 950, radius: 110, force: 4 },
      // 확률 지름길 포탈
      { id: 'rf_pa1', type: 'portal', x: 400, y: 1080, color: '#FF6600' },
      { id: 'rf_pa2', type: 'portal', x: 300, y: 1620, color: '#FF6600' },
      ...pinField(1280, 2, { spacing: 66, bumperEvery: 5 }),
      ...serp(1440, 2, { gapY: 230, rest: 0.3 }),
      { id: 'rf_wh3', type: 'whitehole', x: 380, y: 1560, radius: 110, force: 4 },
      ...pinField(1780, 1, { spacing: 64 }),
      // 출구 깔때기
      ...funnel(1980, { gap: 120 }),
    ],
  },

  // ========== MAP 8: 토네이도 협곡 ==========
  'tornado_canyon': {
    name: '토네이도 협곡',
    description: '블랙홀 회오리와 역회전 풍차가 칩을 휘감는 협곡. 피스톤·부스터로 탈출',
    lengthType: 'Long',
    complexity: 'Medium',
    worldHeight: 2560,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_tornado_canyon.png',
    items: [
      // 입구 깔때기 → 시작 위치 무력화
      ...funnel(170, { gap: 150, deg: 24, len: 280 }),
      // 1차 회오리: 서펜타인(340~800) + 중앙 블랙홀(부드러운 휨)
      ...serp(340, 3, { gapY: 230, rest: 0.25 }),
      { id: 'tc_bh1', type: 'blackhole', x: 400, y: 580, radius: 125, force: 4 },
      { id: 'tc_b1', type: 'booster', x: 110, y: 700, rotation: 170, power: 3 },
      // 풍차 챔버 + 피스톤
      { id: 'tc_wm1', type: 'windmill', x: 630, y: 960, speed: 7 },
      { id: 'tc_ps1', type: 'piston', x: 330, y: 1180, w: 140, h: 20, speed: 3, waypointB: { x: 520, y: 1180 } },
      ...pinField(1320, 1, { spacing: 70 }),
      // 2차 회오리: 서펜타인(1440~1900) + 중앙 블랙홀
      ...serp(1440, 3, { gapY: 230, rest: 0.25 }),
      { id: 'tc_bh2', type: 'blackhole', x: 380, y: 1560, radius: 130, force: 4 },
      // 풍차 챔버(피날레) + 부스터 탈출
      { id: 'tc_wm2', type: 'windmill', x: 630, y: 2060, speed: -9 },
      { id: 'tc_b2', type: 'booster', x: 690, y: 2160, rotation: 190, power: 3 },
      // 출구 깔때기
      ...funnel(2340, { gap: 120 }),
    ],
  },

  // ========== MAP 9: 바운스 미러 ==========
  'bounce_mirror': {
    name: '바운스 미러',
    description: '중앙 스플리터가 칩을 좌우로 가르고, 고탄성 경사벽이 끊임없이 튕겨내는 대칭 맵',
    lengthType: 'Middle',
    complexity: 'Medium',
    worldHeight: 2300,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_bounce_mirror.png',
    items: [
      // 입구 깔때기 → 시작 위치 무력화
      ...funnel(170, { gap: 150, deg: 24, len: 280 }),
      // 중앙 대형 범퍼 = 스플리터: 둥글어서 균형점이 없어 칩을 좌/우로 무작위 분기(순수 운)
      { id: 'bm_sp1', type: 'bumper', x: 400, y: 320, radius: 30, restitution: 1.5 },
      // 탄성 서펜타인(rest 0.42 — 무한바운스 방지) + 중앙 범퍼
      ...serp(470, 3, { gapY: 230, rest: 0.42 }),
      { id: 'bm_bp1', type: 'bumper', x: 400, y: 585, radius: 18, restitution: 1.5 },
      ...pinField(1060, 2, { spacing: 66 }),
      // 두 번째 중앙 범퍼 스플리터 + 서펜타인
      { id: 'bm_sp2', type: 'bumper', x: 400, y: 1170, radius: 30, restitution: 1.5 },
      ...serp(1320, 3, { gapY: 230, rest: 0.42 }),
      { id: 'bm_bp2', type: 'bumper', x: 400, y: 1435, radius: 18, restitution: 1.5 },
      ...pinField(1910, 1, { spacing: 64 }),
      // 출구 깔때기
      ...funnel(2080, { gap: 120 }),
    ],
  },

  // ========== MAP 10: 운석 지대 ==========
  'meteor_field': {
    name: '운석 지대',
    description: '벽 없이 둥근 운석(범퍼)만 빼곡한 무중력 지대. 중력장이 흐름을 비튼다',
    lengthType: 'Long',
    complexity: 'Medium',
    worldHeight: 2400,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_meteor_field.png',
    items: [
      // 운석(범퍼)이 빼곡한 협곡. 둥근 범퍼만으로 격자를 짜면 범퍼 사이 "골"에 칩이
      // 안정적으로 갇히므로(저중력), 저마찰 서펜타인을 바닥에 깔아 항상 미끄러져 내려가게 하고
      // 그 위에 운석 범퍼를 흩뿌려 카오스를 만든다.
      ...funnel(170, { gap: 160, deg: 22, len: 280 }),
      // 저마찰 서펜타인 사이사이에 "운석 범퍼 산란대"(전부 범퍼)를 끼워, 칩이 범퍼에
      // 무작위로 튕긴 뒤에도 바로 아래 서펜타인이 받아 미끄러뜨려 정체를 방지한다.
      ...serp(330, 2, { gapY: 240, rest: 0.2 }),
      ...pinField(720, 2, { spacing: 74, r: 12, bumperEvery: 1 }),
      ...serp(940, 2, { gapY: 240, rest: 0.2 }),
      ...pinField(1330, 2, { spacing: 74, r: 12, bumperEvery: 1 }),
      ...serp(1550, 2, { gapY: 240, rest: 0.2 }),
      ...pinField(1940, 2, { spacing: 74, r: 12, bumperEvery: 1 }),
      // 출구 깔때기
      ...funnel(2180, { gap: 130 }),
    ],
  },
};

// MapPresets에서 메타데이터(items 포함) 전체를 반환
export function getPresetMeta(presetKey: string): MapPresetMeta | null {
  return MapPresets[presetKey] || null;
}

// 하위 호환: 기존 코드에서 EditorItem[] 만 필요한 경우
export function getPresetMap(presetKey: string): EditorItem[] | null {
  const meta = MapPresets[presetKey];
  return meta ? meta.items : null;
}
