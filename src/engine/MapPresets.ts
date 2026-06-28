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

// ── v2: 골격 다양화용 헬퍼 ───────────────────────────────────────────────

// 호(arc): 짧은 벽 세그먼트로 원호를 근사. 나선·원형 사발 등 곡선 골격에 사용.
// fromDeg→toDeg(시계, x축 0°, y-down) 구간을 그린다. 각 세그먼트는 반지름에 접한다.
function arc(cx: number, cy: number, r: number, fromDeg: number, toDeg: number, opts: { seg?: number; segLen?: number; rest?: number } = {}): EditorItem[] {
  const seg = opts.seg ?? 9;
  const segLen = opts.segLen ?? 46;
  const rest = opts.rest ?? 0.25;
  const out: EditorItem[] = [];
  for (let i = 0; i <= seg; i++) {
    const aDeg = fromDeg + (toDeg - fromDeg) * (i / seg);
    const a = (aDeg * Math.PI) / 180;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    out.push({ id: kid('ar'), type: 'wall', x, y, w: segLen, h: 14, rotation: aDeg + 90, restitution: rest, friction: 0.07 });
  }
  return out;
}

// 수직 레인 분할: 폭을 n개 레인으로 나누는 세로벽(중간중간 틈으로 레인 교차/병합).
function lanes(y0: number, y1: number, n: number, opts: { segH?: number; gap?: number } = {}): EditorItem[] {
  const segH = opts.segH ?? 220;
  const gap = opts.gap ?? 90;
  const out: EditorItem[] = [];
  for (let k = 1; k < n; k++) {
    const x = (800 * k) / n;
    for (let y = y0; y < y1; y += segH + gap) {
      const h = Math.min(segH, y1 - y);
      out.push({ id: kid('ln'), type: 'wall', x, y: y + h / 2, w: 16, h, rotation: 0, friction: 0.07 });
    }
  }
  return out;
}

// 박스 방: 좌우 세로벽 + 바닥 양끝 짧은 턱(중앙 바닥은 열려 칩이 떨어짐). 박스형 미로 외형.
// 닫힌 방으로 만들지 않는다(중앙 바닥이 항상 열려 있어 진행을 막지 않음).
function room(x: number, y: number, w: number, h: number, opts: { floorGap?: number } = {}): EditorItem[] {
  const floorGap = opts.floorGap ?? 130;
  const ledge = (w - floorGap) / 2;
  return [
    { id: kid('rm'), type: 'wall', x: x - w / 2, y: y, w: 16, h, rotation: 0, friction: 0.07 },
    { id: kid('rm'), type: 'wall', x: x + w / 2, y: y, w: 16, h, rotation: 0, friction: 0.07 },
    { id: kid('rm'), type: 'wall', x: x - w / 2 + ledge / 2, y: y + h / 2, w: ledge, h: 14, rotation: 8, friction: 0.07 },
    { id: kid('rm'), type: 'wall', x: x + w / 2 - ledge / 2, y: y + h / 2, w: ledge, h: 14, rotation: -8, friction: 0.07 },
  ];
}

// 셰브론 ∨: cx 를 중심으로 양쪽 슬로프가 안쪽으로 기울되 "중앙 gap"을 남긴다.
// 칩은 슬로프 위에 착지해 gap 으로 빠져나가므로 V-골 정체가 없다(가쪽 직낙도 차단).
function chevron(cx: number, y: number, opts: { gap?: number; len?: number; deg?: number; rest?: number } = {}): EditorItem[] {
  const gap = opts.gap ?? 140;
  const len = opts.len ?? 180;
  const deg = opts.deg ?? 15;
  const rest = opts.rest ?? 0.85;
  return [
    { id: kid('cv'), type: 'wall', x: cx - gap / 2 - len * 0.4, y, w: len, h: 16, rotation: deg, restitution: rest, friction: 0.08 },
    { id: kid('cv'), type: 'wall', x: cx + gap / 2 + len * 0.4, y, w: len, h: 16, rotation: -deg, restitution: rest, friction: 0.08 },
  ];
}

export const MapPresets: Record<string, MapPresetMeta> = {

  // ========== MAP 1: 네온 아케이드 ==========
  'neon_arcade': {
    name: '네온 아케이드',
    description: '범퍼·부스터·풍차가 난무하는 핀볼 아케이드. 중앙 포탈이 확률적 지름길을 연다',
    lengthType: 'Long',
    complexity: 'Medium',
    worldHeight: 3300,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_neon_arcade.png',
    items: [
      // 골격: 핀볼 테이블. 개방 베이마다 범퍼 군집 + 측벽 킥커(가쪽 칩을 안으로 튕김)
      // + 각진 부스터(플런저)로 칩이 사방 난반사. 지그재그 슬로프 없음.
      ...funnel(170, { gap: 170, deg: 24, len: 280 }),
      // Bay 1
      { id: 'n_k1', type: 'wall', x: 120, y: 420, w: 230, h: 16, rotation: 22, friction: 0.07 },
      { id: 'n_k2', type: 'wall', x: 680, y: 420, w: 230, h: 16, rotation: -22, friction: 0.07 },
      { id: 'n_bp1', type: 'bumper', x: 300, y: 520, radius: 18, restitution: 1.4 },
      { id: 'n_bp2', type: 'bumper', x: 500, y: 520, radius: 18, restitution: 1.4 },
      { id: 'n_bp3', type: 'bumper', x: 400, y: 640, radius: 22, restitution: 1.5 },
      { id: 'n_b1', type: 'booster', x: 250, y: 760, rotation: 150, power: 2 },
      { id: 'n_b2', type: 'booster', x: 550, y: 760, rotation: 210, power: 2 },
      // Bay 2 — 풍차 + 범퍼 아치
      { id: 'n_k3', type: 'wall', x: 130, y: 940, w: 210, h: 16, rotation: 20, friction: 0.07 },
      { id: 'n_k4', type: 'wall', x: 670, y: 940, w: 210, h: 16, rotation: -20, friction: 0.07 },
      { id: 'n_wm1', type: 'windmill', x: 400, y: 1080, speed: 6 },
      { id: 'n_bp4', type: 'bumper', x: 220, y: 1120, radius: 16, restitution: 1.4 },
      { id: 'n_bp5', type: 'bumper', x: 580, y: 1120, radius: 16, restitution: 1.4 },
      // Bay 3 — 확률 분기 포탈(지름길) + 범퍼
      { id: 'n_k5', type: 'wall', x: 120, y: 1340, w: 230, h: 16, rotation: 22, friction: 0.07 },
      { id: 'n_k6', type: 'wall', x: 680, y: 1340, w: 230, h: 16, rotation: -22, friction: 0.07 },
      { id: 'n_pa1', type: 'portal', x: 400, y: 1440, color: '#FF6600' },
      { id: 'n_pa2', type: 'portal', x: 560, y: 2000, color: '#FF6600' },
      { id: 'n_bp6', type: 'bumper', x: 280, y: 1520, radius: 18, restitution: 1.5 },
      { id: 'n_bp7', type: 'bumper', x: 520, y: 1520, radius: 18, restitution: 1.5 },
      { id: 'n_b3', type: 'booster', x: 400, y: 1640, rotation: 180, power: 2 },
      // Bay 4 — 풍차 + 킥커
      { id: 'n_k7', type: 'wall', x: 130, y: 1840, w: 210, h: 16, rotation: 20, friction: 0.07 },
      { id: 'n_k8', type: 'wall', x: 670, y: 1840, w: 210, h: 16, rotation: -20, friction: 0.07 },
      { id: 'n_wm2', type: 'windmill', x: 400, y: 1980, speed: -7 },
      { id: 'n_bp8', type: 'bumper', x: 250, y: 2020, radius: 16, restitution: 1.4 },
      { id: 'n_bp9', type: 'bumper', x: 550, y: 2020, radius: 16, restitution: 1.4 },
      // Bay 5 — 범퍼 군집 마무리
      { id: 'n_bp10', type: 'bumper', x: 350, y: 2200, radius: 18, restitution: 1.4 },
      { id: 'n_bp11', type: 'bumper', x: 450, y: 2260, radius: 18, restitution: 1.4 },
      // Bay 6 — 부스터 + 범퍼
      { id: 'n_k9', type: 'wall', x: 120, y: 2420, w: 230, h: 16, rotation: 22, friction: 0.07 },
      { id: 'n_k10', type: 'wall', x: 680, y: 2420, w: 230, h: 16, rotation: -22, friction: 0.07 },
      { id: 'n_bp12', type: 'bumper', x: 300, y: 2520, radius: 18, restitution: 1.4 },
      { id: 'n_bp13', type: 'bumper', x: 500, y: 2520, radius: 18, restitution: 1.4 },
      { id: 'n_b4', type: 'booster', x: 250, y: 2640, rotation: 150, power: 2 },
      { id: 'n_b5', type: 'booster', x: 550, y: 2640, rotation: 210, power: 2 },
      // Bay 7 — 풍차 마무리
      { id: 'n_wm3', type: 'windmill', x: 400, y: 2860, speed: 8 },
      { id: 'n_bp14', type: 'bumper', x: 250, y: 2900, radius: 16, restitution: 1.4 },
      { id: 'n_bp15', type: 'bumper', x: 550, y: 2900, radius: 16, restitution: 1.4 },
      // 출구 깔때기
      ...funnel(3080, { gap: 150 }),
    ],
  },

  // ========== MAP 2: 블랙홀의 함정 ==========
  'gravity_abyss': {
    name: '블랙홀의 함정',
    description: '좌우 엇갈린 블랙홀·화이트홀 우물 체인이 칩을 곡선 궤적의 소용돌이로 빨아들이는 심연',
    lengthType: 'Long',
    complexity: 'Complex',
    worldHeight: 3300,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_gravity_abyss.png',
    items: [
      // 골격: 중력 우물 체인. 좌우로 엇갈린 대형 블랙홀(인력)·화이트홀(척력)이 칩을
      // 사선으로 당기고 밀어 곡선 궤적의 소용돌이 강하를 만든다. 벽은 호(arc) 가드레일만.
      ...funnel(170, { gap: 160, deg: 24, len: 280 }),
      // 가쪽 킥커(곡선 호는 C-포켓에 칩이 갇히므로 직선 저마찰 킥커로 가쪽 직낙만 차단)
      { id: 'g_k1', type: 'wall', x: 120, y: 700, w: 250, h: 16, rotation: 22, friction: 0.07 },
      { id: 'g_k2', type: 'wall', x: 680, y: 1120, w: 250, h: 16, rotation: -22, friction: 0.07 },
      { id: 'g_k3', type: 'wall', x: 120, y: 1540, w: 250, h: 16, rotation: 22, friction: 0.07 },
      // 우물 체인(엇갈림)
      { id: 'g_bh1', type: 'blackhole', x: 300, y: 520, radius: 165, force: 4 },
      { id: 'g_wh1', type: 'whitehole', x: 560, y: 560, radius: 135, force: 4 },
      { id: 'g_bh2', type: 'blackhole', x: 520, y: 920, radius: 165, force: 4 },
      { id: 'g_wh2', type: 'whitehole', x: 250, y: 980, radius: 135, force: 4 },
      ...pinField(1140, 1, { spacing: 64, bumperEvery: 4 }),
      { id: 'g_bh3', type: 'blackhole', x: 300, y: 1380, radius: 165, force: 4 },
      { id: 'g_wh3', type: 'whitehole', x: 560, y: 1420, radius: 135, force: 4 },
      { id: 'g_ps1', type: 'piston', x: 400, y: 1640, w: 150, h: 20, speed: 3, waypointB: { x: 250, y: 1640 } },
      { id: 'g_bh4', type: 'blackhole', x: 520, y: 1820, radius: 165, force: 4 },
      { id: 'g_wh4', type: 'whitehole', x: 250, y: 1880, radius: 135, force: 4 },
      ...pinField(2080, 1, { spacing: 64, bumperEvery: 4 }),
      ...arc(780, 2300, 360, 120, 240, { seg: 10, rest: 0.2 }),
      { id: 'g_bh5', type: 'blackhole', x: 300, y: 2280, radius: 165, force: 4 },
      { id: 'g_wh5', type: 'whitehole', x: 560, y: 2320, radius: 135, force: 4 },
      { id: 'g_bh6', type: 'blackhole', x: 520, y: 2680, radius: 165, force: 4 },
      { id: 'g_wh6', type: 'whitehole', x: 250, y: 2740, radius: 135, force: 4 },
      ...pinField(2900, 1, { spacing: 64, bumperEvery: 4 }),
      { id: 'g_bh7', type: 'blackhole', x: 400, y: 3080, radius: 175, force: 4 },
      // 출구 깔때기
      ...funnel(3200, { gap: 130 }),
    ],
  },

  // ========== MAP 3: 톱니바퀴 공장 ==========
  'mechanical_factory': {
    name: '톱니바퀴 공장',
    description: '수평 컨베이어 피스톤과 대형 톱니가 칩을 층층이 넘기는 조립 라인',
    lengthType: 'Long',
    complexity: 'Complex',
    worldHeight: 2700,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_mechanical_factory.png',
    items: [
      // 골격: 조립 라인. 수평 컨베이어 피스톤(좌우 왕복 플랫폼) + 대형 톱니(풍차) +
      // 저마찰 캐치 렛지가 칩을 다음 층으로 넘긴다. 피스톤을 놓쳐도 렛지가 흐름을 보장.
      ...funnel(170, { gap: 160, deg: 24, len: 280 }),
      { id: 'm_ps1', type: 'piston', x: 300, y: 440, w: 220, h: 20, speed: 2, waypointB: { x: 520, y: 440 } },
      { id: 'm_l1', type: 'wall', x: 680, y: 580, w: 240, h: 16, rotation: -14, friction: 0.07 },
      { id: 'm_wm1', type: 'windmill', x: 400, y: 780, speed: 7 },
      { id: 'm_ps2', type: 'piston', x: 500, y: 1000, w: 220, h: 20, speed: 2, waypointB: { x: 280, y: 1000 } },
      { id: 'm_l2', type: 'wall', x: 120, y: 1140, w: 240, h: 16, rotation: 14, friction: 0.07 },
      { id: 'm_wm2', type: 'windmill', x: 400, y: 1340, speed: -8 },
      { id: 'm_b1', type: 'booster', x: 690, y: 1460, rotation: 195, power: 2 },
      { id: 'm_ps3', type: 'piston', x: 300, y: 1600, w: 220, h: 20, speed: 3, waypointB: { x: 520, y: 1600 } },
      { id: 'm_l3', type: 'wall', x: 680, y: 1740, w: 240, h: 16, rotation: -14, friction: 0.07 },
      { id: 'm_wm3', type: 'windmill', x: 400, y: 1940, speed: 10 },
      { id: 'm_h1', type: 'hole', x: 620, y: 2060, radius: 26 },
      { id: 'm_l4', type: 'wall', x: 130, y: 2140, w: 240, h: 16, rotation: 14, friction: 0.07 },
      ...pinField(2320, 1, { spacing: 70, bumperEvery: 3 }),
      // 출구 깔때기
      ...funnel(2480, { gap: 130 }),
    ],
  },

  // ========== MAP 4: 부스트 하이웨이 ==========
  'boost_highway': {
    name: '부스트 하이웨이',
    description: '세로 레인을 부스터로 직진 질주하고 틈에서 차선을 바꾸는 멀티레인 스피드웨이',
    lengthType: 'Long',
    complexity: 'Medium',
    worldHeight: 3300,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_boost_highway.png',
    items: [
      // 골격: 수직 레인 스피드웨이. 세로벽으로 나뉜 평행 레인을 하향 부스터로 직진 질주,
      // 레인 사이 틈에서 확률적으로 차선 변경(운). 핀 산란대로 순위 셔플.
      ...funnel(160, { gap: 220, deg: 26, len: 320 }),
      // 3레인 구간(분리벽 x≈267/533). 부스터는 약하게(power 2)로 "꾸준한 가속" 유지.
      ...lanes(320, 920, 3, { segH: 260, gap: 95 }),
      { id: 'bh_b0', type: 'booster', x: 133, y: 430, rotation: 180, power: 2 },
      { id: 'bh_b1', type: 'booster', x: 400, y: 560, rotation: 180, power: 2 },
      { id: 'bh_b2', type: 'booster', x: 667, y: 430, rotation: 180, power: 2 },
      { id: 'bh_b3', type: 'booster', x: 133, y: 800, rotation: 180, power: 2 },
      { id: 'bh_b4', type: 'booster', x: 667, y: 800, rotation: 180, power: 2 },
      // 병합 산란대(차선 셔플)
      ...pinField(1000, 2, { spacing: 62, r: 9, bumperEvery: 3 }),
      // 4레인 구간(분리벽 x≈200/400/600)
      ...lanes(1240, 1900, 4, { segH: 260, gap: 95 }),
      { id: 'bh_b5', type: 'booster', x: 100, y: 1360, rotation: 180, power: 2 },
      { id: 'bh_b6', type: 'booster', x: 300, y: 1500, rotation: 180, power: 2 },
      { id: 'bh_b7', type: 'booster', x: 500, y: 1360, rotation: 180, power: 2 },
      { id: 'bh_b8', type: 'booster', x: 700, y: 1500, rotation: 180, power: 2 },
      { id: 'bh_b9', type: 'booster', x: 200, y: 1780, rotation: 180, power: 2 },
      { id: 'bh_b10', type: 'booster', x: 600, y: 1780, rotation: 180, power: 2 },
      // 병합 산란대
      ...pinField(1980, 2, { spacing: 62, r: 9, bumperEvery: 3 }),
      // 3레인 구간(마지막)
      ...lanes(2200, 2800, 3, { segH: 260, gap: 95 }),
      { id: 'bh_b11', type: 'booster', x: 133, y: 2320, rotation: 180, power: 2 },
      { id: 'bh_b12', type: 'booster', x: 400, y: 2450, rotation: 180, power: 2 },
      { id: 'bh_b13', type: 'booster', x: 667, y: 2320, rotation: 180, power: 2 },
      { id: 'bh_b14', type: 'booster', x: 133, y: 2680, rotation: 180, power: 2 },
      { id: 'bh_b15', type: 'booster', x: 667, y: 2680, rotation: 180, power: 2 },
      // 최종 산란 + 출구
      ...pinField(2880, 2, { spacing: 62, r: 9, bumperEvery: 3 }),
      ...funnel(3080, { gap: 160 }),
    ],
  },

  // ========== MAP 5: 차원 포탈 미궁 ==========
  'portal_labyrinth': {
    name: '차원 포탈 미궁',
    description: '엇갈린 박스 방을 떨어지며 통과하고, 같은 색 포탈로 비인접 방에 워프하는 방-미로',
    lengthType: 'Long',
    complexity: 'Complex',
    worldHeight: 3000,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_portal_labyrinth.png',
    items: [
      // 골격: 박스 방 미로. 좌우 엇갈린 방(박스벽 + 바닥 중앙 gap)을 칩이 떨어지며 통과하고,
      // 같은 색 포탈이 비인접 방으로 워프(확률 지름길). 방 바닥은 항상 열려 진행을 막지 않음.
      ...funnel(170, { gap: 150, deg: 24, len: 280 }),
      ...room(300, 420, 340, 170, { floorGap: 130 }),
      { id: 'pl_r1a', type: 'bumper', x: 230, y: 400, radius: 16, restitution: 1.3 },
      { id: 'pl_r1b', type: 'bumper', x: 370, y: 400, radius: 16, restitution: 1.3 },
      { id: 'pl_pa1', type: 'portal', x: 300, y: 470, color: '#FF6600' },
      ...room(500, 720, 340, 170, { floorGap: 130 }),
      { id: 'pl_r2a', type: 'bumper', x: 430, y: 700, radius: 16, restitution: 1.3 },
      { id: 'pl_r2b', type: 'bumper', x: 570, y: 700, radius: 16, restitution: 1.3 },
      { id: 'pl_pb1', type: 'portal', x: 500, y: 770, color: '#00FF66' },
      ...room(300, 1020, 340, 170, { floorGap: 130 }),
      { id: 'pl_r3a', type: 'bumper', x: 300, y: 1000, radius: 18, restitution: 1.3 },
      ...room(500, 1320, 340, 170, { floorGap: 130 }),
      { id: 'pl_pa2', type: 'portal', x: 500, y: 1300, color: '#FF6600' },
      { id: 'pl_r4a', type: 'bumper', x: 430, y: 1360, radius: 16, restitution: 1.3 },
      ...room(300, 1620, 340, 170, { floorGap: 130 }),
      { id: 'pl_pb2', type: 'portal', x: 300, y: 1600, color: '#00FF66' },
      { id: 'pl_r5a', type: 'bumper', x: 370, y: 1660, radius: 16, restitution: 1.3 },
      ...room(500, 1920, 340, 170, { floorGap: 130 }),
      { id: 'pl_r6a', type: 'bumper', x: 500, y: 1900, radius: 18, restitution: 1.3 },
      ...room(300, 2220, 340, 170, { floorGap: 130 }),
      { id: 'pl_r7a', type: 'bumper', x: 230, y: 2200, radius: 16, restitution: 1.3 },
      { id: 'pl_r7b', type: 'bumper', x: 370, y: 2200, radius: 16, restitution: 1.3 },
      ...room(500, 2520, 340, 170, { floorGap: 130 }),
      { id: 'pl_r8a', type: 'bumper', x: 500, y: 2500, radius: 18, restitution: 1.3 },
      // 출구 깔때기
      ...funnel(2800, { gap: 130 }),
    ],
  },

  // ========== MAP 6: 플링코 폭포 ==========
  'plinko_cascade': {
    name: '플링코 폭포',
    description: '한 점에서 떨어진 칩이 삼각 핀밭(골턴 보드)을 따라 무작위로 퍼지는 순수 운의 플링코',
    lengthType: 'Long',
    complexity: 'Complex',
    worldHeight: 2700,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_plinko_cascade.png',
    items: ((): EditorItem[] => {
      // 골격: 골턴 보드(삼각 핀밭). 좁은 한 점에서 떨어뜨려 아래로 갈수록 넓어지는 삼각형
      // 핀밭으로 칩을 퍼뜨린다(순수 운). 삼각 변을 따라 측벽이 가쪽 이탈을 막는다.
      const out: EditorItem[] = [];
      out.push(...funnel(170, { gap: 110, deg: 28, len: 300 }));
      // 삼각 핀밭: 위는 좁고 아래로 갈수록 넓어진다(spacing 64로 끼임 방지).
      // 핀밭 자체가 칩을 가두므로 가쪽 벽은 두지 않는다(쐐기 정체 원인).
      const top = 380, rows = 33, rowH = 60, spacing = 64;
      for (let r = 0; r < rows; r++) {
        const y = top + r * rowH;
        const half = Math.min(330, 70 + r * 20);
        const offset = (r % 2) * (spacing / 2);
        for (let x = 400 - half; x <= 400 + half; x += spacing) {
          const xx = x + offset;
          if (xx > 74 && xx < 726) {
            const isB = r % 5 === 2 && Math.abs(xx - 400) < half * 0.5;
            out.push(isB
              ? { id: kid('pk'), type: 'bumper', x: xx, y, radius: 12, restitution: 1.4 }
              : { id: kid('pk'), type: 'pin', x: xx, y, radius: 8 });
          }
        }
      }
      out.push(...funnel(top + rows * rowH + 70, { gap: 160 }));
      return out;
    })(),
  },

  // ========== MAP 7: 운명의 룰렛 ==========
  'roulette_of_fate': {
    name: '운명의 룰렛',
    description: '원형 사발 안에서 칩이 림을 돌고 중심 화이트홀이 폭발적으로 흩뿌리는 룰렛 볼',
    lengthType: 'Long',
    complexity: 'Medium',
    worldHeight: 3000,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_roulette_of_fate.png',
    items: [
      // 골격: 원형 룰렛 볼. 마주보는 호(arc) 측벽이 사발을 이루고(상단 진입·하단 배출 열림),
      // 중심 화이트홀이 칩을 림으로 밀어 돌린 뒤 하단 gap 으로 떨어뜨린다.
      ...funnel(200, { gap: 130, deg: 28, len: 340 }),
      // Bowl 1
      ...arc(400, 680, 280, -60, 60, { seg: 8, rest: 0.25 }),
      ...arc(400, 680, 280, 120, 240, { seg: 8, rest: 0.25 }),
      { id: 'rf_wh1', type: 'whitehole', x: 400, y: 600, radius: 175, force: 6 },
      { id: 'rf_pa1', type: 'portal', x: 400, y: 960, color: '#FF6600' },
      ...pinField(1060, 1, { spacing: 62, bumperEvery: 4 }),
      // Bowl 2
      ...arc(400, 1440, 280, -60, 60, { seg: 8, rest: 0.25 }),
      ...arc(400, 1440, 280, 120, 240, { seg: 8, rest: 0.25 }),
      { id: 'rf_wh2', type: 'whitehole', x: 400, y: 1360, radius: 175, force: 6 },
      { id: 'rf_pa2', type: 'portal', x: 300, y: 1720, color: '#FF6600' },
      ...pinField(1820, 1, { spacing: 62, bumperEvery: 4 }),
      // Bowl 3
      ...arc(400, 2200, 280, -60, 60, { seg: 8, rest: 0.25 }),
      ...arc(400, 2200, 280, 120, 240, { seg: 8, rest: 0.25 }),
      { id: 'rf_wh3', type: 'whitehole', x: 400, y: 2120, radius: 175, force: 6 },
      ...pinField(2560, 1, { spacing: 62, bumperEvery: 4 }),
      // 출구 깔때기
      ...funnel(2780, { gap: 130 }),
    ],
  },

  // ========== MAP 8: 토네이도 협곡 ==========
  'tornado_canyon': {
    name: '토네이도 협곡',
    description: '거대 블랙홀을 세로로 쌓은 토네이도 컬럼이 칩을 빨아 휘감고 역회전 풍차가 가른다',
    lengthType: 'Long',
    complexity: 'Medium',
    worldHeight: 2700,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_tornado_canyon.png',
    items: [
      // 골격: 토네이도 컬럼. 중앙에 거대 블랙홀을 세로로 쌓아 칩을 빨아들이며 휘감고(가쪽 칩도
      // 중앙으로 당겨 직낙 차단), 양옆 역회전 풍차가 가른다. 호(arc)가 층을 나눈다.
      // 골격: 풍차 건틀릿. 회전 블레이드(풍차)가 베이마다 칩을 휘저어 가르고, 측벽 킥커가
      // 가쪽 칩을 안으로 보낸다. 작은 소용돌이 우물(force 3)이 회오리 손맛을 더한다.
      // (중앙 거대 우물은 12칩을 한 점에 모아 정체시키므로 쓰지 않는다)
      ...funnel(170, { gap: 160, deg: 24, len: 280 }),
      // Bay 1
      { id: 'tc_k1', type: 'wall', x: 110, y: 460, w: 230, h: 16, rotation: 22, friction: 0.07 },
      { id: 'tc_k2', type: 'wall', x: 690, y: 460, w: 230, h: 16, rotation: -22, friction: 0.07 },
      { id: 'tc_wm1', type: 'windmill', x: 400, y: 620, speed: 8 },
      { id: 'tc_wm2', type: 'windmill', x: 230, y: 820, speed: -7 },
      { id: 'tc_wm3', type: 'windmill', x: 570, y: 820, speed: 7 },
      // Bay 2 — 소용돌이 우물
      { id: 'tc_k3', type: 'wall', x: 130, y: 1020, w: 210, h: 16, rotation: 20, friction: 0.07 },
      { id: 'tc_k4', type: 'wall', x: 670, y: 1020, w: 210, h: 16, rotation: -20, friction: 0.07 },
      { id: 'tc_bh1', type: 'blackhole', x: 400, y: 1180, radius: 130, force: 3 },
      { id: 'tc_wm4', type: 'windmill', x: 250, y: 1200, speed: 8 },
      { id: 'tc_wm5', type: 'windmill', x: 550, y: 1200, speed: -8 },
      // Bay 3 — 피스톤 + 풍차
      { id: 'tc_k5', type: 'wall', x: 110, y: 1420, w: 230, h: 16, rotation: 22, friction: 0.07 },
      { id: 'tc_k6', type: 'wall', x: 690, y: 1420, w: 230, h: 16, rotation: -22, friction: 0.07 },
      { id: 'tc_wm6', type: 'windmill', x: 400, y: 1580, speed: 9 },
      { id: 'tc_ps1', type: 'piston', x: 300, y: 1780, w: 160, h: 20, speed: 3, waypointB: { x: 500, y: 1780 } },
      // Bay 4 — 소용돌이 + 부스터 탈출
      { id: 'tc_k7', type: 'wall', x: 130, y: 1920, w: 210, h: 16, rotation: 20, friction: 0.07 },
      { id: 'tc_k8', type: 'wall', x: 670, y: 1920, w: 210, h: 16, rotation: -20, friction: 0.07 },
      { id: 'tc_bh2', type: 'blackhole', x: 400, y: 2080, radius: 130, force: 3 },
      { id: 'tc_wm7', type: 'windmill', x: 250, y: 2100, speed: 9 },
      { id: 'tc_wm8', type: 'windmill', x: 550, y: 2100, speed: -9 },
      { id: 'tc_b1', type: 'booster', x: 110, y: 2280, rotation: 170, power: 2 },
      { id: 'tc_b2', type: 'booster', x: 690, y: 2280, rotation: 190, power: 2 },
      // 출구 깔때기
      ...funnel(2440, { gap: 130 }),
    ],
  },

  // ========== MAP 9: 바운스 미러 ==========
  'bounce_mirror': {
    name: '바운스 미러',
    description: '중앙 범퍼가 칩을 좌우로 가르고 셰브론이 다시 중앙으로 튕기는 완전 대칭 위브 맵',
    lengthType: 'Middle',
    complexity: 'Medium',
    worldHeight: 2500,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_bounce_mirror.png',
    items: [
      // 골격: 완전 좌우대칭 셰브론 위브. 중앙 범퍼(둥근 스플리터)가 칩을 좌/우로 가르면,
      // 양옆 고탄성 셰브론 암(∨)이 칩을 다시 중앙으로 튕겨 보낸다(동시에 가쪽 직낙 차단).
      ...funnel(170, { gap: 150, deg: 24, len: 280 }),
      // 좌우 교대 셰브론(중앙 gap)으로 만드는 대칭 위브: 한 셰브론의 드롭이 다음 셰브론의
      // 반대쪽 암에 떨어져 칩이 ∨∧∨∧ 로 짜이며 내려간다. 범퍼가 바운스 손맛을 더함.
      ...chevron(330, 360, { gap: 130, len: 200, rest: 0.85 }),
      { id: 'bm_b0', type: 'bumper', x: 500, y: 360, radius: 16, restitution: 1.25 },
      ...chevron(470, 550, { gap: 130, len: 200, rest: 0.85 }),
      { id: 'bm_b1', type: 'bumper', x: 300, y: 550, radius: 16, restitution: 1.25 },
      ...chevron(330, 740, { gap: 130, len: 200, rest: 0.85 }),
      { id: 'bm_b2', type: 'bumper', x: 500, y: 740, radius: 16, restitution: 1.25 },
      ...chevron(470, 930, { gap: 130, len: 200, rest: 0.85 }),
      { id: 'bm_b3', type: 'bumper', x: 300, y: 930, radius: 16, restitution: 1.25 },
      ...chevron(330, 1120, { gap: 130, len: 200, rest: 0.85 }),
      { id: 'bm_b4', type: 'bumper', x: 500, y: 1120, radius: 16, restitution: 1.25 },
      ...chevron(470, 1310, { gap: 130, len: 200, rest: 0.85 }),
      { id: 'bm_b5', type: 'bumper', x: 300, y: 1310, radius: 16, restitution: 1.25 },
      ...chevron(330, 1500, { gap: 130, len: 200, rest: 0.85 }),
      { id: 'bm_b6', type: 'bumper', x: 500, y: 1500, radius: 16, restitution: 1.25 },
      ...chevron(470, 1690, { gap: 130, len: 200, rest: 0.85 }),
      { id: 'bm_b7', type: 'bumper', x: 300, y: 1690, radius: 16, restitution: 1.25 },
      ...chevron(330, 1880, { gap: 130, len: 200, rest: 0.85 }),
      ...chevron(470, 2070, { gap: 130, len: 200, rest: 0.85 }),
      // 출구 깔때기
      ...funnel(2260, { gap: 140 }),
    ],
  },

  // ========== MAP 10: 운석 지대 ==========
  'meteor_field': {
    name: '운석 지대',
    description: '벽이 거의 없는 개활 소행성대. 흩어진 대형 운석(범퍼)을 칩이 무작위로 튕기며 강하',
    lengthType: 'Long',
    complexity: 'Medium',
    worldHeight: 2500,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_meteor_field.png',
    items: [
      // 골격: 개활 소행성대. 흩어진 대형 둥근 운석(범퍼) 사이를 칩이 핀볼처럼 튕기며 내려간다.
      // 범퍼 골(cusp) 정체를 막기 위해 가쪽 킥커와 저마찰 "레스큐 렛지"를 군데군데 깔았다.
      ...funnel(170, { gap: 180, deg: 22, len: 280 }),
      { id: 'mf_b1', type: 'bumper', x: 300, y: 380, radius: 26, restitution: 1.4 },
      { id: 'mf_b2', type: 'bumper', x: 520, y: 430, radius: 30, restitution: 1.4 },
      { id: 'mf_k1', type: 'wall', x: 110, y: 540, w: 230, h: 16, rotation: 22, friction: 0.07 },
      { id: 'mf_b3', type: 'bumper', x: 400, y: 600, radius: 24, restitution: 1.4 },
      { id: 'mf_b4', type: 'bumper', x: 620, y: 660, radius: 22, restitution: 1.4 },
      { id: 'mf_l1', type: 'wall', x: 660, y: 800, w: 260, h: 16, rotation: -16, friction: 0.07 },
      { id: 'mf_b5', type: 'bumper', x: 250, y: 850, radius: 28, restitution: 1.4 },
      { id: 'mf_b6', type: 'bumper', x: 470, y: 920, radius: 24, restitution: 1.4 },
      { id: 'mf_k2', type: 'wall', x: 690, y: 1040, w: 230, h: 16, rotation: -22, friction: 0.07 },
      { id: 'mf_b7', type: 'bumper', x: 350, y: 1100, radius: 30, restitution: 1.4 },
      { id: 'mf_b8', type: 'bumper', x: 560, y: 1160, radius: 22, restitution: 1.4 },
      { id: 'mf_l2', type: 'wall', x: 140, y: 1300, w: 260, h: 16, rotation: 16, friction: 0.07 },
      { id: 'mf_b9', type: 'bumper', x: 450, y: 1360, radius: 26, restitution: 1.4 },
      { id: 'mf_b10', type: 'bumper', x: 640, y: 1420, radius: 24, restitution: 1.4 },
      { id: 'mf_k3', type: 'wall', x: 110, y: 1560, w: 230, h: 16, rotation: 22, friction: 0.07 },
      { id: 'mf_b11', type: 'bumper', x: 320, y: 1620, radius: 28, restitution: 1.4 },
      { id: 'mf_b12', type: 'bumper', x: 540, y: 1680, radius: 24, restitution: 1.4 },
      { id: 'mf_l3', type: 'wall', x: 660, y: 1820, w: 260, h: 16, rotation: -16, friction: 0.07 },
      { id: 'mf_b13', type: 'bumper', x: 280, y: 1880, radius: 26, restitution: 1.4 },
      { id: 'mf_b14', type: 'bumper', x: 480, y: 1940, radius: 22, restitution: 1.4 },
      { id: 'mf_b15', type: 'bumper', x: 400, y: 2080, radius: 24, restitution: 1.4 },
      // 출구 깔때기
      ...funnel(2280, { gap: 150 }),
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
