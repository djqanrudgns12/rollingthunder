import { EditorItem } from '@/store/editorStore';
import type { WallStyle } from './MapBuilder';

// 맵 프리셋 메타데이터: 각 맵의 이름·길이·복잡도·외벽 스타일·장애물 좌표를 하나로 묶음
export interface ThemeWeights {
  pin: number;
  bumper: number;
  booster: number;
  portal: number;
  blackhole: number;
  whitehole: number;
  hole: number;
  windmill: number;
  iceblock: number;
  windcannon: number;
  luckygate: number;
  flipper: number;
}

export const DEFAULT_THEME_WEIGHTS: ThemeWeights = {
  pin: 0.1, bumper: 0.3, booster: 0.1, portal: 0.05, blackhole: 0.05, whitehole: 0.05, hole: 0.05, windmill: 0.3,
  iceblock: 0, windcannon: 0, luckygate: 0, flipper: 0
};

export interface MapPresetMeta {
  name: string;                              // UI에 표시될 맵 이름
  description: string;                       // 맵 특성 한 줄 설명
  lengthType: 'Short' | 'Middle' | 'Long';   // 길이 분류
  complexity: 'Simple' | 'Medium' | 'Complex'; // 복잡도 분류
  worldHeight: number;                       // 이 맵 전용 월드 높이
  wallStyle: WallStyle;                      // 외벽 스타일 (straight/zigzag/narrow/wide)
  bgImage?: string;                          // 맵별 전용 배경 이미지 경로
  themeWeights: ThemeWeights;                // 밀도 증가 시 추가 주입 비율
  layoutConfig?: {                           // PRD v6.0: 절대 좌표 배치 지원
    startLineY?: number;                     // 절대 좌표 (우선 적용)
    startMarginPercent?: number;             // 기존 비율 (하위 호환용)
    endMarginPercent: number;
    spawnGap: number;
  };
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
    { id: kid('fn'), type: 'wall', x: 400 - gap / 2 - len * 0.36, y, w: len, h: 20, rotation: deg, friction: 0.1, soundTag: 'funnel' },
    { id: kid('fn'), type: 'wall', x: 400 + gap / 2 + len * 0.36, y, w: len, h: 20, rotation: -deg, friction: 0.1, soundTag: 'funnel' },
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

// ── 사이드 직낙 방지 헬퍼 ────────────────────────────────────────────────
// 모든 맵의 양쪽 가장자리(x<150, x>650) 무방비 구간에 배치하여
// 외벽을 타고 수직 낙하하는 "엣지허깅" 꼼수를 차단한다.

// 사이드 킥커: 가쪽으로 빠지는 칩을 중앙으로 밀어내는 경사벽
function sideKicker(y: number, side: 'left' | 'right', opts: { w?: number; deg?: number } = {}): EditorItem {
  const w = opts.w ?? 180;
  const deg = opts.deg ?? 20;
  if (side === 'left') {
    return { id: kid('sk'), type: 'wall', x: 95, y, w, h: 16, rotation: deg, friction: 0.07 };
  }
  return { id: kid('sk'), type: 'wall', x: 705, y, w, h: 16, rotation: -deg, friction: 0.07 };
}

// 사이드 범퍼: 가쪽 직낙 칩을 안쪽으로 튕겨내는 범퍼
function sideBumper(y: number, side: 'left' | 'right', opts: { r?: number; rest?: number } = {}): EditorItem {
  const r = opts.r ?? 16;
  const rest = opts.rest ?? 1.3;
  return { id: kid('sb'), type: 'bumper', x: side === 'left' ? 90 : 710, y, radius: r, restitution: rest };
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
    themeWeights: { pin: 0.15, bumper: 0.35, booster: 0.20, portal: 0.05, blackhole: 0.00, whitehole: 0.00, hole: 0.05, windmill: 0.20 },
    layoutConfig: { startLineY: 70, endMarginPercent: 0.02, spawnGap: 50 },
    items: [
      // 골격: 핀볼 테이블. 개방 베이마다 범퍼 군집 + 측벽 킥커(가쪽 칩을 안으로 튕김)
      // + 각진 부스터(플런저)로 칩이 사방 난반사. 지그재그 슬로프 없음.
      // 입구: 플런저 슬롯 — 비대칭 핀볼 플리퍼. 좌측은 완만(10°), 우측은 급경사(28°)
      { id: 'n_ent1', type: 'wall', x: 240, y: 180, w: 480, h: 20, rotation: 10, friction: 0.07 },
      { id: 'n_ent2', type: 'wall', x: 660, y: 195, w: 260, h: 20, rotation: -28, friction: 0.07 },
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
      // 사이드 보강: 가쪽 직낙 차단
      sideBumper(750, 'left'), sideBumper(680, 'right'),
      sideKicker(1200, 'left'), sideKicker(1250, 'right'),
      sideBumper(1650, 'left'), sideBumper(1700, 'right'),
      { id: 'n_swm1', type: 'windmill', x: 120, y: 2200, speed: 5 },
      { id: 'n_swm2', type: 'windmill', x: 680, y: 2150, speed: -5 },
      sideBumper(2780, 'left'), sideBumper(2820, 'right'),
      // 출구: 핀볼 드레인 — 가장자리 급경사(35°) + 중앙 완만(12°) 2단 배수구
      // 검산: 가장자리 벽 inner_end = 80+65=145, 720-65=655 → 겹침 없음
      { id: 'n_ex1', type: 'wall', x: 80, y: 3020, w: 160, h: 16, rotation: 35, friction: 0.07 },
      { id: 'n_ex2', type: 'wall', x: 720, y: 3020, w: 160, h: 16, rotation: -35, friction: 0.07 },
      // 검산: 중앙 벽 inner_end = 210+107=317, 590-107=483 → gap=166px ✓
      { id: 'n_ex3', type: 'wall', x: 210, y: 3080, w: 220, h: 20, rotation: 12, friction: 0.07 },
      { id: 'n_ex4', type: 'wall', x: 590, y: 3080, w: 220, h: 20, rotation: -12, friction: 0.07 },
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
    themeWeights: { pin: 0.25, bumper: 0.05, booster: 0.00, portal: 0.00, blackhole: 0.35, whitehole: 0.30, hole: 0.00, windmill: 0.05 },
    layoutConfig: { startLineY: 70, endMarginPercent: 0.02, spawnGap: 50 },
    items: [
      // 골격: 중력 우물 체인. 베이마다 가쪽 킥커가 칩을 중앙으로 보내면 좌우로 엇갈린
      // 블랙홀(인력)·화이트홀(척력)이 사선으로 당기고 밀어 곡선 궤적을 만든다.
      // (우물 아래 핀밭은 칩을 우물이 핀에 박아 정체시키므로 두지 않는다)
      // 입구: 쌍둥이 강착 원반 — W자형 4방향 슬로프로 좌·우 두 곳에서 수렴
      { id: 'g_ent1', type: 'wall', x: 75, y: 170, w: 150, h: 20, rotation: 22, friction: 0.01 },
      { id: 'g_ent2', type: 'wall', x: 325, y: 170, w: 150, h: 20, rotation: -22, friction: 0.01 },
      { id: 'g_ent3', type: 'wall', x: 475, y: 170, w: 150, h: 20, rotation: 22, friction: 0.01 },
      { id: 'g_ent4', type: 'wall', x: 725, y: 170, w: 150, h: 20, rotation: -22, friction: 0.01 },
      // Bay 1
      { id: 'g_k1', type: 'wall', x: 120, y: 540, w: 250, h: 16, rotation: 22, friction: 0.07 },
      { id: 'g_k2', type: 'wall', x: 680, y: 540, w: 250, h: 16, rotation: -22, friction: 0.07 },
      { id: 'g_bh1', type: 'blackhole', x: 300, y: 780, radius: 140, force: 4 },
      { id: 'g_wh1', type: 'whitehole', x: 560, y: 780, radius: 120, force: 4 },
      // Bay 2
      { id: 'g_k3', type: 'wall', x: 120, y: 1080, w: 250, h: 16, rotation: 22, friction: 0.07 },
      { id: 'g_k4', type: 'wall', x: 680, y: 1080, w: 250, h: 16, rotation: -22, friction: 0.07 },
      { id: 'g_bh2', type: 'blackhole', x: 520, y: 1320, radius: 140, force: 4 },
      { id: 'g_wh2', type: 'whitehole', x: 250, y: 1320, radius: 120, force: 4 },
      { id: 'g_ps1', type: 'piston', x: 400, y: 1540, w: 150, h: 20, speed: 3, waypointB: { x: 250, y: 1540 } },
      // Bay 3
      { id: 'g_k5', type: 'wall', x: 120, y: 1700, w: 250, h: 16, rotation: 22, friction: 0.07 },
      { id: 'g_k6', type: 'wall', x: 680, y: 1700, w: 250, h: 16, rotation: -22, friction: 0.07 },
      { id: 'g_bh3', type: 'blackhole', x: 300, y: 1940, radius: 140, force: 4 },
      { id: 'g_wh3', type: 'whitehole', x: 560, y: 1940, radius: 120, force: 4 },
      // Bay 4
      { id: 'g_k7', type: 'wall', x: 120, y: 2320, w: 250, h: 16, rotation: 22, friction: 0.07 },
      { id: 'g_k8', type: 'wall', x: 680, y: 2320, w: 250, h: 16, rotation: -22, friction: 0.07 },
      { id: 'g_bh4', type: 'blackhole', x: 520, y: 2560, radius: 140, force: 4 },
      { id: 'g_wh4', type: 'whitehole', x: 250, y: 2560, radius: 120, force: 4 },
      // 피날레 우물
      { id: 'g_bh5', type: 'blackhole', x: 400, y: 2920, radius: 150, force: 4 },
      { id: 'g_sp1', type: 'spinner', x: 400, y: 3050, w: 160, h: 18, speed: 6, soundTag: 'spinner_whoosh' },
      // 사이드 보강: 가쪽 직낙 차단
      sideKicker(800, 'left', { deg: 25 }), sideKicker(750, 'right', { deg: 25 }),
      sideBumper(1400, 'left'), sideBumper(1350, 'right'),
      sideKicker(2000, 'left'), sideKicker(2050, 'right'),
      sideBumper(2700, 'left'), sideBumper(2750, 'right'),
      sideKicker(3000, 'left', { deg: 22 }), sideKicker(2950, 'right', { deg: 22 }),
      // 출구: 심연의 목구멍 — 초급경사(40°) 좁은 스로트 + 가장자리 수직 봉인
      { id: 'g_ex1', type: 'wall', x: 80, y: 3050, w: 16, h: 160, rotation: 0, friction: 0.07 },
      { id: 'g_ex2', type: 'wall', x: 720, y: 3050, w: 16, h: 160, rotation: 0, friction: 0.07 },
      { id: 'g_ex3', type: 'wall', x: 235, y: 3140, w: 300, h: 20, rotation: 40, friction: 0.01 },
      { id: 'g_ex4', type: 'wall', x: 565, y: 3140, w: 300, h: 20, rotation: -40, friction: 0.01 },
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
    themeWeights: { pin: 0.15, bumper: 0.10, booster: 0.10, portal: 0.00, blackhole: 0.00, whitehole: 0.00, hole: 0.10, windmill: 0.55 },
    layoutConfig: { startLineY: 70, endMarginPercent: 0.02, spawnGap: 50 },
    items: [
      // 골격: 조립 라인. 수평 컨베이어 피스톤(좌우 왕복 플랫폼) + 대형 톱니(풍차) +
      // 저마찰 캐치 렛지가 칩을 다음 층으로 넘긴다. 피스톤을 놓쳐도 렛지가 흐름을 보장.
      // 입구: 다단 호퍼 — 1단(넓은 완만 수렴) + 2단(좁은 급경사 투입). 공장 원자재 호퍼
      // 검산 1단: inner_end = 150+128=278, 650-128=522 → gap=244px (확장)
      { id: 'm_ent1', type: 'wall', x: 150, y: 120, w: 260, h: 20, rotation: 10, friction: 0.07 },
      { id: 'm_ent2', type: 'wall', x: 650, y: 120, w: 260, h: 20, rotation: -10, friction: 0.07 },
      // 검산 2단: inner_end = 260+56=316, 540-56=484 → gap=168px (병목 해소)
      { id: 'm_ent3', type: 'wall', x: 260, y: 210, w: 120, h: 16, rotation: 22, friction: 0.07 },
      { id: 'm_ent4', type: 'wall', x: 540, y: 210, w: 120, h: 16, rotation: -22, friction: 0.07 },
      { id: 'm_ps1', type: 'piston', x: 300, y: 440, w: 220, h: 20, speed: 2, waypointB: { x: 520, y: 440 } },
      { id: 'm_l1', type: 'wall', x: 680, y: 580, w: 240, h: 16, rotation: -14, friction: 0.07 },
      { id: 'm_sp1', type: 'spinner', x: 280, y: 620, w: 140, h: 16, speed: 5, soundTag: 'spinner_whoosh' },
      { id: 'm_sp2', type: 'spinner', x: 520, y: 620, w: 140, h: 16, speed: -5, soundTag: 'spinner_whoosh' },
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
      // 사이드 보강: 가쪽 직낙 차단 (공장 좌측 거대 무방비 1140px 해소)
      sideKicker(400, 'left', { deg: 18 }), sideKicker(750, 'left', { deg: 15 }),
      sideBumper(1000, 'left'), sideBumper(900, 'right'),
      sideKicker(1250, 'right', { deg: 18 }),
      sideBumper(1900, 'left'), sideBumper(2000, 'right'),
      sideKicker(2350, 'left'), sideKicker(2400, 'right'),
      // 출구: 비대칭 편측 컨베이어 — 좌측 넓은 경사 + 우측 좁은 경사. 공장 배출구 형태
      // 검산: inner_end = 190+124=314, 600-117=483 → gap=169px ✓
      { id: 'm_ex1', type: 'wall', x: 190, y: 2500, w: 260, h: 20, rotation: 18, friction: 0.07 },
      { id: 'm_ex2', type: 'wall', x: 600, y: 2510, w: 240, h: 20, rotation: -12, friction: 0.07 },
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
    themeWeights: { pin: 0.40, bumper: 0.10, booster: 0.40, portal: 0.00, blackhole: 0.00, whitehole: 0.00, hole: 0.00, windmill: 0.10 },
    layoutConfig: { startLineY: 70, endMarginPercent: 0.02, spawnGap: 50 },
    items: [
      // 골격: 수직 레인 스피드웨이. 세로벽으로 나뉜 평행 레인을 하향 부스터로 직진 질주,
      // 레인 사이 틈에서 확률적으로 차선 변경(운). 핀 산란대로 순위 셔플.
      // 입구: 스타트 그리드 — 짧은 분리벽 3개 + 경사로 4차선 배정 (h:60으로 갈림 방지)
      { id: 'bh_grid1', type: 'wall', x: 200, y: 150, w: 16, h: 60, rotation: 0, friction: 0.07 },
      { id: 'bh_grid2', type: 'wall', x: 400, y: 150, w: 16, h: 60, rotation: 0, friction: 0.07 },
      { id: 'bh_grid3', type: 'wall', x: 600, y: 150, w: 16, h: 60, rotation: 0, friction: 0.07 },
      // 3레인 구간(분리벽 x≈267/533). 부스터는 약하게(power 2)로 "꾸준한 가속" 유지.
      ...lanes(320, 920, 3, { segH: 260, gap: 95 }),
      { id: 'bh_b0', type: 'booster', x: 133, y: 430, rotation: 180, power: 2 },
      { id: 'bh_b1', type: 'booster', x: 400, y: 560, rotation: 180, power: 2 },
      { id: 'bh_b2', type: 'booster', x: 667, y: 430, rotation: 180, power: 2 },
      { id: 'bh_b3', type: 'booster', x: 133, y: 800, rotation: 180, power: 2 },
      { id: 'bh_b4', type: 'booster', x: 667, y: 800, rotation: 180, power: 2 },
      // 병합 산란대(차선 셔플)
      ...pinField(1000, 2, { spacing: 95, r: 9, bumperEvery: 3 }),
      // 4레인 구간(분리벽 x≈200/400/600)
      ...lanes(1240, 1900, 4, { segH: 260, gap: 95 }),
      { id: 'bh_b5', type: 'booster', x: 100, y: 1360, rotation: 180, power: 2 },
      { id: 'bh_b6', type: 'booster', x: 300, y: 1500, rotation: 180, power: 2 },
      { id: 'bh_b7', type: 'booster', x: 500, y: 1360, rotation: 180, power: 2 },
      { id: 'bh_b8', type: 'booster', x: 700, y: 1500, rotation: 180, power: 2 },
      { id: 'bh_b9', type: 'booster', x: 200, y: 1780, rotation: 180, power: 2 },
      { id: 'bh_b10', type: 'booster', x: 600, y: 1780, rotation: 180, power: 2 },
      // 병합 산란대
      ...pinField(1980, 2, { spacing: 95, r: 9, bumperEvery: 3 }),
      // 3레인 구간(마지막)
      ...lanes(2200, 2800, 3, { segH: 260, gap: 95 }),
      { id: 'bh_b11', type: 'booster', x: 133, y: 2320, rotation: 180, power: 2 },
      { id: 'bh_b12', type: 'booster', x: 400, y: 2450, rotation: 180, power: 2 },
      { id: 'bh_b13', type: 'booster', x: 667, y: 2320, rotation: 180, power: 2 },
      { id: 'bh_b14', type: 'booster', x: 133, y: 2680, rotation: 180, power: 2 },
      { id: 'bh_b15', type: 'booster', x: 667, y: 2680, rotation: 180, power: 2 },
      // 사이드 보강: 레인 분리구간 사이 및 병합구간에서의 가쪽 직낙 차단
      sideBumper(1120, 'left'), sideBumper(1150, 'right'),
      sideBumper(2050, 'left'), sideBumper(2080, 'right'),
      sideKicker(2960, 'left'), sideKicker(2980, 'right'),
      // 최종 산란대
      ...pinField(2880, 2, { spacing: 95, r: 9, bumperEvery: 3 }),
      // 출구: 체커 플래그 — 넓은 gap(200px)의 열린 깔때기로 속도 유지
      ...funnel(3080, { gap: 200, deg: 18, len: 240 }),
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
    themeWeights: { pin: 0.10, bumper: 0.20, booster: 0.00, portal: 0.00, blackhole: 0.00, whitehole: 0.00, hole: 0.00, windmill: 0.10 },
    layoutConfig: { startLineY: 70, endMarginPercent: 0.02, spawnGap: 50 },
    items: [
      // ========== Zone 1: 환영의 십자로 (Crossroads of Illusion) ==========
      // 좌우 비대칭 진입로. 좌측은 핀밭을 지나 주황 포탈로, 우측은 중앙으로 하강
      { id: 'pl_z1_w1', type: 'wall', x: 200, y: 180, w: 400, h: 20, rotation: 15, friction: 0.0 },
      { id: 'pl_z1_w2', type: 'wall', x: 650, y: 220, w: 300, h: 20, rotation: -20, friction: 0.0 },
      ...pinField(250, 1, { spacing: 60, bumperEvery: 5 }), // 좌측 핀밭 (y: 250+)
      { id: 'pl_pa_in', type: 'portal', x: 150, y: 400, color: '#FF6600' }, // 주황 입구 (Zone 1 좌측) - 지름길
      
      // ========== Zone 2: 양자 얽힘 바운스 룸 (Quantum Bounce Room) ==========
      // 폐쇄된 육각형 룸 (y: 500 ~ 950)
      { id: 'pl_z2_w1', type: 'wall', x: 250, y: 550, w: 200, h: 20, rotation: 45, friction: 0.0 },
      { id: 'pl_z2_w2', type: 'wall', x: 550, y: 550, w: 200, h: 20, rotation: -45, friction: 0.0 },
      { id: 'pl_z2_w3', type: 'wall', x: 150, y: 750, w: 20, h: 250, rotation: 0, friction: 0.0 },
      { id: 'pl_z2_w4', type: 'wall', x: 650, y: 750, w: 20, h: 250, rotation: 0, friction: 0.0 },
      { id: 'pl_z2_w5', type: 'wall', x: 230, y: 950, w: 250, h: 20, rotation: -20, friction: 0.0 }, // 바닥 좌
      { id: 'pl_z2_w6', type: 'wall', x: 570, y: 950, w: 250, h: 20, rotation: 20, friction: 0.0 },  // 바닥 우
      // 모서리 끼임 방지 범퍼
      { id: 'pl_z2_b_anti1', type: 'bumper', x: 150, y: 900, radius: 12, restitution: 1.5 },
      { id: 'pl_z2_b_anti2', type: 'bumper', x: 650, y: 900, radius: 12, restitution: 1.5 },
      // 중앙 gap: 약 106px (충분히 빠져나감)
      
      // 초고탄성 범퍼 도배 (룸 내부)
      { id: 'pl_z2_b1', type: 'bumper', x: 250, y: 700, radius: 20, restitution: 1.6 },
      { id: 'pl_z2_b2', type: 'bumper', x: 400, y: 650, radius: 25, restitution: 1.6 },
      { id: 'pl_z2_b3', type: 'bumper', x: 550, y: 700, radius: 20, restitution: 1.6 },
      { id: 'pl_z2_b4', type: 'bumper', x: 300, y: 800, radius: 15, restitution: 1.6 },
      { id: 'pl_z2_b5', type: 'bumper', x: 500, y: 800, radius: 15, restitution: 1.6 },
      { id: 'pl_z2_b6', type: 'bumper', x: 400, y: 850, radius: 18, restitution: 1.6 },
      { id: 'pl_sp1', type: 'spinner', x: 300, y: 720, w: 120, h: 16, speed: -6, soundTag: 'spinner_whoosh' },
      { id: 'pl_sp2', type: 'spinner', x: 500, y: 720, w: 120, h: 16, speed: 6, soundTag: 'spinner_whoosh' },
      
      // 포탈 맹점 배치
      { id: 'pl_pb_in', type: 'portal', x: 220, y: 880, color: '#00FF66' }, // 초록 입구 (함정 - 상단 회귀)
      { id: 'pl_pc_in', type: 'portal', x: 580, y: 880, color: '#9900FF' }, // 보라 입구 (보상 - 직행)

      // ========== Zone 3: 시지프스의 깔때기 (Sisyphus' Funnel) ==========
      // 거대한 V자형 깔때기 + 중간 탈출 틈새 (y: 1100 ~ 1500)
      { id: 'pl_z3_w1a', type: 'wall', x: 100, y: 1250, w: 150, h: 20, rotation: 35, friction: 0.0 },
      { id: 'pl_z3_w1b', type: 'wall', x: 300, y: 1390, w: 150, h: 20, rotation: 35, friction: 0.0 },
      { id: 'pl_z3_w2a', type: 'wall', x: 700, y: 1250, w: 150, h: 20, rotation: -35, friction: 0.0 },
      { id: 'pl_z3_w2b', type: 'wall', x: 500, y: 1390, w: 150, h: 20, rotation: -35, friction: 0.0 },
      
      // 탈출 보조 풍차 및 절망 포탈
      { id: 'pl_z3_wm1', type: 'windmill', x: 290, y: 1340, speed: -12 }, // 틈새로 쳐올리는 역회전 풍차
      { id: 'pl_z3_wm2', type: 'windmill', x: 510, y: 1340, speed: 12 },
      { id: 'pl_pd_in', type: 'portal', x: 400, y: 1480, color: '#FF0033' }, // 빨강 입구 (함정 - 육각방 천장 회귀)
      
      // 사이드 보호
      sideKicker(1600, 'left', { deg: 15 }), sideKicker(1600, 'right', { deg: 15 }),

      // ========== Zone 4: 도플갱어의 춤 (Dance of Doppelgangers) ==========
      // 기하학적 다중 포탈 겹침 무늬 (y: 1700 ~ 2200)
      { id: 'pl_pe_in', type: 'portal', x: 350, y: 1800, color: '#00FFFF' }, // 시안 입구
      { id: 'pl_pf_in', type: 'portal', x: 450, y: 1800, color: '#FF00FF' }, // 마젠타 입구
      { id: 'pl_pe_out', type: 'portal', x: 400, y: 1950, color: '#00FFFF' }, // 시안 출구 (가운데 교차)
      { id: 'pl_pf_out', type: 'portal', x: 300, y: 1950, color: '#FF00FF' }, // 마젠타 출구
      { id: 'pl_pg_in', type: 'portal', x: 500, y: 1950, color: '#FFFF00' },  // 노랑 입구
      { id: 'pl_pg_out', type: 'portal', x: 400, y: 2100, color: '#FFFF00' }, // 노랑 출구
      
      // 외곽 이탈 방지 가드레일 (포탈 존으로 칩을 유도)
      { id: 'pl_z4_w1', type: 'wall', x: 150, y: 1900, w: 300, h: 20, rotation: 60, friction: 0.0 },
      { id: 'pl_z4_w2', type: 'wall', x: 650, y: 1900, w: 300, h: 20, rotation: -60, friction: 0.0 },
      { id: 'pl_sp3', type: 'spinner', x: 300, y: 2250, w: 120, h: 16, speed: 5, soundTag: 'spinner_whoosh' },
      { id: 'pl_sp4', type: 'spinner', x: 500, y: 2300, w: 120, h: 16, speed: -5, soundTag: 'spinner_whoosh' },
      
      // ========== 포탈 출구 매핑 (Outlets) ==========
      { id: 'pl_pa_out', type: 'portal', x: 400, y: 1080, color: '#FF6600' }, // 주황 출구 (Zone 1 -> Zone 3 직행)
      { id: 'pl_pb_out', type: 'portal', x: 400, y: 120, color: '#00FF66' },  // 초록 출구 (Zone 2 함정 -> 최상단 중앙 회귀)
      { id: 'pl_pc_out', type: 'portal', x: 400, y: 2350, color: '#9900FF' }, // 보라 출구 (Zone 2 보상 -> Zone 4 배출구 직행)
      { id: 'pl_pd_out', type: 'portal', x: 400, y: 550, color: '#FF0033' },  // 빨강 출구 (Zone 3 함정 -> Zone 2 내부 천장)

      // ========== 출구: 지그재그 미로 배출 ==========
      { id: 'pl_ex1', type: 'wall', x: 150, y: 2450, w: 300, h: 20, rotation: 12, friction: 0.0 },
      { id: 'pl_ex2', type: 'wall', x: 650, y: 2550, w: 300, h: 20, rotation: -12, friction: 0.0 },
      { id: 'pl_ex3', type: 'wall', x: 150, y: 2650, w: 300, h: 20, rotation: 12, friction: 0.0 },
      { id: 'pl_ex4', type: 'wall', x: 650, y: 2750, w: 300, h: 20, rotation: -12, friction: 0.0 },
      { id: 'pl_ex5', type: 'wall', x: 250, y: 2880, w: 240, h: 16, rotation: 10, friction: 0.0 },
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
    themeWeights: { pin: 0.70, bumper: 0.25, booster: 0.00, portal: 0.00, blackhole: 0.00, whitehole: 0.00, hole: 0.00, windmill: 0.05 },
    layoutConfig: { startLineY: 70, endMarginPercent: 0.02, spawnGap: 50 },
    items: ((): EditorItem[] => {
      // 골격: 골턴 보드(삼각 핀밭). 좁은 한 점에서 떨어뜨려 아래로 갈수록 넓어지는 삼각형
      // 핀밭으로 칩을 퍼뜨린다(순수 운). 삼각 변을 따라 측벽이 가쪽 이탈을 막는다.
      const out: EditorItem[] = [];
      // 입구: 니들 드롭 — 천장 양쪽 벽 + 중앙 130px 통로로 진입
      // 검산: inner_end = 185+148=333, 615-148=467 → gap=134px ✓
      out.push(
        { id: kid('nd'), type: 'wall', x: 185, y: 200, w: 300, h: 24, rotation: 3, friction: 0.07 },
        { id: kid('nd'), type: 'wall', x: 615, y: 200, w: 300, h: 24, rotation: -3, friction: 0.07 },
      );
      // 삼각 핀밭: 위는 좁고 아래로 갈수록 넓어진다.
      // 간격을 대폭 확장(spacing 96, rowH 90)하여 차량 끼임을 방지합니다.
      const top = 380, rows = 24, rowH = 90, spacing = 96;
      for (let r = 0; r < rows; r++) {
        const y = top + r * rowH;
        const half = Math.min(330, 70 + r * 30);
        const offset = (r % 2) * (spacing / 2);
        for (let x = 400 - half; x <= 400 + half; x += spacing) {
          const xx = x + offset;
          // 사이드 풍차(x:40, x:760) 주변 트랩 방지를 위한 클리어 존(140~660) 확보
          if (xx > 140 && xx < 660) {
            // 주황색 범퍼 장벽화 방지: 한 칸씩 건너뛰어 게이트 생성
            const isB = r % 5 === 2 && Math.abs(xx - 400) < half * 0.5 && (Math.round(Math.abs(xx - 400) / spacing) % 2 === 0);
            out.push(isB
              ? { id: kid('pk'), type: 'bumper', x: xx, y, radius: 12, restitution: 1.4 }
              : { id: kid('pk'), type: 'pin', x: xx, y, radius: 8 });
          }
        }
      }
      // 사이드 보강: 엣지허깅 직낙을 방지하고 안쪽으로 퍼올리는 구출 풍차 배치
      out.push(
        { id: kid('wm'), type: 'windmill', x: 40, y: 550, speed: 7 },
        { id: kid('wm'), type: 'windmill', x: 760, y: 550, speed: -7 },
        { id: kid('wm'), type: 'windmill', x: 40, y: 950, speed: 7 },
        { id: kid('wm'), type: 'windmill', x: 760, y: 950, speed: -7 },
        { id: kid('wm'), type: 'windmill', x: 40, y: 1350, speed: 7 },
        { id: kid('wm'), type: 'windmill', x: 760, y: 1350, speed: -7 },
        { id: kid('wm'), type: 'windmill', x: 40, y: 1750, speed: 7 },
        { id: kid('wm'), type: 'windmill', x: 760, y: 1750, speed: -7 },
        { id: kid('wm'), type: 'windmill', x: 40, y: 2150, speed: 7 },
        { id: kid('wm'), type: 'windmill', x: 760, y: 2150, speed: -7 },
        { id: 'pl_cs1', type: 'spinner', x: 180, y: 2350, w: 100, h: 14, speed: 6, soundTag: 'spinner_whoosh' },
        { id: 'pl_cs2', type: 'spinner', x: 340, y: 2400, w: 100, h: 14, speed: -6, soundTag: 'spinner_whoosh' },
        { id: 'pl_cs3', type: 'spinner', x: 500, y: 2350, w: 100, h: 14, speed: 6, soundTag: 'spinner_whoosh' },
        { id: 'pl_cs4', type: 'spinner', x: 660, y: 2400, w: 100, h: 14, speed: -6, soundTag: 'spinner_whoosh' }
      );
      // 출구: 다중 갈퀴 바닥 — 짧은 경사벽 7개로 여러 틈새로 배출 (h:35, 약간 기울여 갈림 방지)
      const rakeY = top + rows * rowH + 70;
      for (let rx = 120; rx <= 680; rx += 95) {
        const tilt = (rx % 190 < 95) ? 5 : -5; // 교대로 약간 기울임
        out.push({ id: kid('rk'), type: 'wall', x: rx, y: rakeY, w: 16, h: 35, rotation: tilt, friction: 0.07 });
      }
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
    themeWeights: { pin: 0.30, bumper: 0.10, booster: 0.00, portal: 0.10, blackhole: 0.00, whitehole: 0.35, hole: 0.00, windmill: 0.15 },
    layoutConfig: { startLineY: 70, endMarginPercent: 0.02, spawnGap: 50 },
    items: [
      // 골격: 원형 룰렛 볼. 마주보는 호(arc) 측벽이 사발을 이루고(상단 진입·하단 배출 열림),
      // 중심 화이트홀이 칩을 림으로 밀어 돌린 뒤 하단 gap 으로 떨어뜨린다.
      // 입구: 비대칭 스핀 트랙 — 좌측에서 우측으로 휘어지는 거대 슬로프 + 우측 짧은 급경사
      { id: 'rf_ent1', type: 'wall', x: 280, y: 200, w: 560, h: 20, rotation: 8, friction: 0.07 },
      { id: 'rf_ent2', type: 'wall', x: 700, y: 220, w: 180, h: 20, rotation: -35, friction: 0.07 },
      // Bowl 1
      ...arc(400, 680, 280, -60, 60, { seg: 8, rest: 0.25 }),
      ...arc(400, 680, 280, 120, 240, { seg: 8, rest: 0.25 }),
      { id: 'rf_wh1', type: 'whitehole', x: 400, y: 600, radius: 175, force: 6 },
      { id: 'rf_pa1', type: 'portal', x: 400, y: 960, color: '#FF6600' },
      ...pinField(1060, 1, { spacing: 110, bumperEvery: 4 }),
      // Bowl 2
      ...arc(400, 1440, 280, -60, 60, { seg: 8, rest: 0.25 }),
      ...arc(400, 1440, 280, 120, 240, { seg: 8, rest: 0.25 }),
      { id: 'rf_wh2', type: 'whitehole', x: 400, y: 1360, radius: 175, force: 6 },
      { id: 'rf_pa2', type: 'portal', x: 300, y: 1720, color: '#FF6600' },
      ...pinField(1820, 1, { spacing: 110, bumperEvery: 4 }),
      // Bowl 3
      ...arc(400, 2200, 280, -60, 60, { seg: 8, rest: 0.25 }),
      ...arc(400, 2200, 280, 120, 240, { seg: 8, rest: 0.25 }),
      { id: 'rf_wh3', type: 'whitehole', x: 400, y: 2120, radius: 175, force: 6 },
      ...pinField(2560, 1, { spacing: 110, bumperEvery: 4 }),
      // 사이드 기믹: 원형 사발 옆 빗금(고립) 구간 풍차 배치
      { id: 'rf_wm1', type: 'windmill', x: 180, y: 480, speed: 7 },
      { id: 'rf_wm2', type: 'windmill', x: 620, y: 430, speed: -7 },
      { id: 'rf_wm3', type: 'windmill', x: 180, y: 1300, speed: 7 },
      { id: 'rf_wm4', type: 'windmill', x: 620, y: 1330, speed: -7 },
      { id: 'rf_wm5', type: 'windmill', x: 180, y: 2080, speed: 7 },
      { id: 'rf_wm6', type: 'windmill', x: 620, y: 2110, speed: -7 },

      // 사이드 보강: arc 사발 바깥쪽 사이드 직낙 차단
      sideKicker(450, 'left', { deg: 22 }), sideKicker(400, 'right', { deg: 22 }),
      sideBumper(950, 'left'), sideBumper(980, 'right'),
      sideKicker(1270, 'left', { deg: 18 }), sideKicker(1300, 'right', { deg: 18 }),
      sideBumper(1660, 'left'), sideBumper(1700, 'right'),
      sideKicker(2050, 'left'), sideKicker(2080, 'right'),
      sideBumper(2430, 'left'), sideBumper(2460, 'right'),
      // 사이드 기믹: 하단 사선 벽 양 끝단(모서리) 고립 방지 풍차 (교차점 틈새 완벽 방어)
      { id: 'rf_wm7', type: 'windmill', x: 120, y: 2765, speed: 8 },
      { id: 'rf_wm8', type: 'windmill', x: 680, y: 2765, speed: -8 },
      // 중앙 상단 교차점: 두 청록색 프레임(출구 안쪽 벽) 사이 빈 공간
      { id: 'rf_wm9', type: 'windmill', x: 400, y: 2790, speed: 6 },

      // 출구: 광폭 완만 사발 — 가장자리 급경사(30°) + 중앙 완만(8°)
      // 검산: 가장자리 inner_end = 80+69=149, 720-69=651
      { id: 'rf_ex1', type: 'wall', x: 80, y: 2720, w: 160, h: 16, rotation: 30, friction: 0.07 },
      { id: 'rf_ex2', type: 'wall', x: 720, y: 2720, w: 160, h: 16, rotation: -30, friction: 0.07 },
      // 검산: 중앙 inner_end = 210+119=329, 590-119=471 → gap=142px ✓
      { id: 'rf_ex3', type: 'wall', x: 210, y: 2790, w: 240, h: 20, rotation: 8, friction: 0.07 },
      { id: 'rf_ex4', type: 'wall', x: 590, y: 2790, w: 240, h: 20, rotation: -8, friction: 0.07 },
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
    themeWeights: { pin: 0.10, bumper: 0.05, booster: 0.10, portal: 0.00, blackhole: 0.25, whitehole: 0.00, hole: 0.00, windmill: 0.50 },
    layoutConfig: { startLineY: 70, endMarginPercent: 0.02, spawnGap: 50 },
    items: [
      // 골격: 토네이도 컬럼. 중앙에 거대 블랙홀을 세로로 쌓아 칩을 빨아들이며 휘감고(가쪽 칩도
      // 중앙으로 당겨 직낙 차단), 양옆 역회전 풍차가 가른다. 호(arc)가 층을 나눈다.
      // 골격: 풍차 건틀릿. 회전 블레이드(풍차)가 베이마다 칩을 휘저어 가르고, 측벽 킥커가
      // 가쪽 칩을 안으로 보낸다. 작은 소용돌이 우물(force 3)이 회오리 손맛을 더한다.
      // (중앙 거대 우물은 12칩을 한 점에 모아 정체시키므로 쓰지 않는다)
      // 입구: 다운버스트 — 극단 비대칭. 입구 좁음 문제 해결 위해 좌측 벽 길이 축소 (560 -> 480)
      { id: 'tc_ent1', type: 'wall', x: 240, y: 180, w: 480, h: 20, rotation: 8, friction: 0.07 },
      { id: 'tc_ent2', type: 'wall', x: 700, y: 200, w: 200, h: 20, rotation: -35, friction: 0.07 },
      { id: 'tc_wm_new', type: 'windmill', x: 400, y: 380, speed: 7 },
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
      { id: 'tc_sp1', type: 'spinner', x: 300, y: 2280, w: 140, h: 16, speed: 5, soundTag: 'spinner_whoosh' },
      { id: 'tc_sp2', type: 'spinner', x: 550, y: 2280, w: 140, h: 16, speed: -5, soundTag: 'spinner_whoosh' },
      { id: 'tc_b1', type: 'booster', x: 110, y: 2280, rotation: 170, power: 2 },
      { id: 'tc_b2', type: 'booster', x: 690, y: 2280, rotation: 190, power: 2 },
      // 사이드 보강: 가쪽 직낙 차단
      sideBumper(700, 'left'), sideBumper(750, 'right'),
      sideKicker(1220, 'left', { deg: 18 }), sideKicker(1250, 'right', { deg: 18 }),
      sideBumper(1650, 'left'), sideBumper(1700, 'right'),
      // 출구: 소용돌이 꼬리 — 겹침 현상 방지를 위해 우측 출구 틈새(tc_ex2와 tc_ex4 사이) 확장
      { id: 'tc_ex1', type: 'wall', x: 200, y: 2380, w: 400, h: 20, rotation: 18, friction: 0.07 },
      { id: 'tc_ex2', type: 'wall', x: 500, y: 2420, w: 300, h: 20, rotation: 12, friction: 0.07 },
      { id: 'tc_ex3', type: 'wall', x: 80, y: 2350, w: 160, h: 16, rotation: 30, friction: 0.07 },
      { id: 'tc_ex4', type: 'wall', x: 760, y: 2450, w: 80, h: 16, rotation: -25, friction: 0.07 },
    ],
  },

  // ========== MAP 9: 혼돈의 거울 ==========
  'bounce_mirror': {
    name: '혼돈의 거울',
    description: '극강의 혼돈과 비대칭, 쉴 새 없는 튕김과 지름길 포탈 워프가 난무하는 운명의 시련',
    lengthType: 'Long',
    complexity: 'High',
    worldHeight: 4200,
    wallStyle: 'straight',
    bgImage: '/images/assets/map_bg_bounce_mirror.png',
    themeWeights: { pin: 0.15, bumper: 0.40, booster: 0.15, portal: 0.10, blackhole: 0.05, whitehole: 0.05, hole: 0.00, windmill: 0.10 },
    layoutConfig: { startLineY: 70, endMarginPercent: 0.02, spawnGap: 50 },
    items: [
      // 1구간: 혼돈의 소용돌이 (y: 150 ~ 900)
      // 입구 스플리터 (비대칭) - 틈새 간격을 대폭 확장하고 경사를 가파르게 하여 빠른 낙하 유도
      { id: kid('wm'), type: 'wall', x: 180, y: 180, w: 200, h: 20, rotation: 40, restitution: 0.5, friction: 0.07 },
      { id: kid('wm'), type: 'wall', x: 670, y: 220, w: 200, h: 20, rotation: -35, restitution: 0.5, friction: 0.07 },
      // 거대 비대칭 풍차 2대 - 중앙 통로 확보를 위해 좌우로 더 넓게 배치
      { id: kid('wm'), type: 'windmill', x: 200, y: 420, speed: 7 },
      { id: kid('wm'), type: 'windmill', x: 600, y: 560, speed: -9 },
      // 직낙 차단용 중앙 대형 범퍼
      { id: kid('bp'), type: 'bumper', x: 400, y: 700, radius: 40, restitution: 1.5 },
      
      // 2구간: 기적의 틈새 & 로또 포탈 (y: 900 ~ 1900)
      // 왼쪽 로또 공간 (막혀있는 듯 하나 포탈 존재)
      { id: kid('wl'), type: 'wall', x: 180, y: 900, w: 260, h: 16, rotation: -25, restitution: 0.5, friction: 0.07 }, // 왼쪽 가장자리로 유도
      // 가장자리 구석에 포탈 (안쪽으로 120px 여유 공간)
      { id: 'bm_sp_new1', type: 'spinner', x: 150, y: 1000, w: 120, h: 16, speed: -8, soundTag: 'spinner_whoosh' },
      { id: kid('pt'), type: 'portal', x: 90, y: 1050, color: '#FF33CC' }, // 워프 진입점 A (하단 역전용)
      // 포탈 밑을 받쳐주는 벽 (구석 형성하되 완전히 막히지 않게 조심, 포탈이 흡수함)
      sideKicker(1150, 'left', { w: 200, deg: 35 }), 

      // 중앙 우측은 지연 핀 지대
      { id: kid('pn'), type: 'pin', x: 500, y: 950 }, { id: kid('pn'), type: 'pin', x: 560, y: 980 },
      { id: kid('pn'), type: 'pin', x: 440, y: 1010 }, { id: kid('pn'), type: 'pin', x: 620, y: 1040 },
      { id: kid('pn'), type: 'pin', x: 500, y: 1070 }, { id: kid('pn'), type: 'pin', x: 560, y: 1100 },
      { id: kid('bp'), type: 'bumper', x: 650, y: 1250, radius: 25, restitution: 1.4 },
      
      // 오른쪽 갇힘 구제 포탈
      { id: kid('wl'), type: 'wall', x: 600, y: 1400, w: 300, h: 16, rotation: 25, restitution: 0.5, friction: 0.07 }, 
      { id: kid('pt'), type: 'portal', x: 710, y: 1550, color: '#33CCFF' }, // 워프 진입점 B
      sideKicker(1650, 'right', { w: 200, deg: 35 }),

      // 3구간: 중력 왜곡 & 가속의 방 (y: 1900 ~ 3000)
      // 포탈 A와 B의 출구 (가장 아래쪽으로 역전 텔레포트)
      { id: kid('pt'), type: 'portal', x: 400, y: 1950, color: '#FF33CC' }, // 포탈 A 출구 (역전)
      { id: kid('pt'), type: 'portal', x: 200, y: 2200, color: '#33CCFF' }, // 포탈 B 출구 (부스터 하이웨이 직행)

      // 블랙홀 화이트홀의 미로
      { id: kid('bh'), type: 'blackhole', x: 600, y: 2000, force: 1.2 },
      { id: kid('wh'), type: 'whitehole', x: 600, y: 2200, force: 1.5 },
      { id: kid('bh'), type: 'blackhole', x: 250, y: 2400, force: 1.5 },
      { id: kid('wh'), type: 'whitehole', x: 550, y: 2600, force: 1.2 },

      // 화이트홀이 튕겨내는 위치(x: 200~300)에 부스터 하이웨이 연쇄
      { id: kid('bs'), type: 'booster', x: 250, y: 2600, w: 100, h: 20, rotation: 90, force: 20 },
      { id: kid('bs'), type: 'booster', x: 250, y: 2750, w: 100, h: 20, rotation: 90, force: 20 },
      { id: kid('bs'), type: 'booster', x: 250, y: 2900, w: 100, h: 20, rotation: 90, force: 25 },
      
      // 오른쪽 안전한 셰브론 기반 굽이길 (단 Gap은 150으로 넓게)
      ...chevron(550, 2800, { gap: 150, len: 180, deg: 15 }),
      { id: kid('wl'), type: 'wall', x: 700, y: 2950, w: 200, h: 16, rotation: -20, restitution: 0.5 },

      // 4구간: 메가 범퍼 지대 & 최후의 심판 (y: 3000 ~ 4200)
      { id: kid('bp'), type: 'bumper', x: 400, y: 3100, radius: 45, restitution: 1.5 },
      { id: kid('bp'), type: 'bumper', x: 200, y: 3250, radius: 35, restitution: 1.5 },
      { id: kid('bp'), type: 'bumper', x: 600, y: 3350, radius: 30, restitution: 1.5 },
      { id: kid('bp'), type: 'bumper', x: 300, y: 3500, radius: 40, restitution: 1.5 },
      { id: kid('bp'), type: 'bumper', x: 500, y: 3650, radius: 35, restitution: 1.5 },
      { id: 'bm_sp1', type: 'spinner', x: 400, y: 3600, w: 160, h: 18, speed: 7, soundTag: 'spinner_whoosh' },

      // 최후의 방해꾼 초고속 풍차
      { id: kid('wm'), type: 'windmill', x: 400, y: 3850, speed: 12 },
      
      // 출구 대형 깔때기 (최소 Gap 180 보장으로 절대로 막히지 않음)
      ...funnel(4000, { gap: 180, deg: 25, len: 350 }),

      // ============================================
      // 사이드 직낙 방지 헬퍼 보강 (넓게 배치해 끼임 방지)
      sideKicker(500, 'left', { deg: 25 }), sideKicker(800, 'right', { deg: 25 }),
      sideBumper(1200, 'left'), sideBumper(1300, 'right'),
      sideKicker(1800, 'left', { deg: 20 }), sideKicker(1800, 'right', { deg: 20 }),
      sideBumper(2300, 'left'), sideBumper(2100, 'right'),
      sideKicker(2500, 'right', { deg: 30 }),
      sideBumper(2800, 'left'), sideBumper(3200, 'right'),
      sideKicker(3400, 'left', { deg: 25 }), sideKicker(3500, 'right', { deg: 25 }),
      sideBumper(3700, 'left'), sideBumper(3700, 'right'),
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
    themeWeights: { pin: 0.10, bumper: 0.70, booster: 0.05, portal: 0.00, blackhole: 0.00, whitehole: 0.00, hole: 0.00, windmill: 0.15 },
    layoutConfig: { startLineY: 70, endMarginPercent: 0.02, spawnGap: 50 },
    items: [
      // 골격: 개활 소행성대. 흩어진 대형 둥근 운석(범퍼) 사이를 칩이 핀볼처럼 튕기며 내려간다.
      // 범퍼 골(cusp) 정체를 막기 위해 가쪽 킥커와 저마찰 "레스큐 렛지"를 군데군데 깔았다.
      // 입구: 운석 벨트 충돌 — 벽 대신 거대 범퍼 5개로 초기 산란. 우주 공간 느낌
      { id: 'mf_ent1', type: 'bumper', x: 100, y: 180, radius: 24, restitution: 1.5 },
      { id: 'mf_ent2', type: 'bumper', x: 280, y: 200, radius: 22, restitution: 1.5 },
      { id: 'mf_ent3', type: 'bumper', x: 400, y: 160, radius: 28, restitution: 1.5 },
      { id: 'mf_ent4', type: 'bumper', x: 540, y: 195, radius: 22, restitution: 1.5 },
      { id: 'mf_ent5', type: 'bumper', x: 700, y: 175, radius: 24, restitution: 1.5 },
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
      { id: 'mf_sp1', type: 'spinner', x: 320, y: 1230, w: 180, h: 18, speed: 4, soundTag: 'spinner_whoosh' },
      { id: 'mf_l2', type: 'wall', x: 140, y: 1300, w: 260, h: 16, rotation: 16, friction: 0.07 },
      { id: 'mf_sp2', type: 'spinner', x: 560, y: 1330, w: 180, h: 18, speed: -4, soundTag: 'spinner_whoosh' },
      { id: 'mf_b9', type: 'bumper', x: 450, y: 1360, radius: 26, restitution: 1.4 },
      { id: 'mf_b10', type: 'bumper', x: 640, y: 1420, radius: 24, restitution: 1.4 },
      { id: 'mf_k3', type: 'wall', x: 110, y: 1560, w: 230, h: 16, rotation: 22, friction: 0.07 },
      { id: 'mf_b11', type: 'bumper', x: 320, y: 1620, radius: 28, restitution: 1.4 },
      { id: 'mf_b12', type: 'bumper', x: 540, y: 1680, radius: 24, restitution: 1.4 },
      { id: 'mf_l3', type: 'wall', x: 660, y: 1820, w: 260, h: 16, rotation: -16, friction: 0.07 },
      { id: 'mf_b13', type: 'bumper', x: 280, y: 1880, radius: 26, restitution: 1.4 },
      { id: 'mf_b14', type: 'bumper', x: 480, y: 1940, radius: 22, restitution: 1.4 },
      { id: 'mf_b15', type: 'bumper', x: 400, y: 2080, radius: 24, restitution: 1.4 },
      // 사이드 보강: 가쪽 직낙 차단
      sideBumper(400, 'left'), sideBumper(350, 'right'),
      sideKicker(800, 'left', { deg: 20 }), sideKicker(850, 'right', { deg: 20 }),
      sideBumper(1100, 'left'), sideBumper(1150, 'right'),
      sideKicker(1800, 'left'), sideKicker(1850, 'right'),
      
      // === 끼임 방지 범퍼 (풍차 부근 데드존 방어) ===
      { id: 'mf_anti_stuck_r1', type: 'bumper', x: 680, y: 1950, radius: 20, restitution: 1.8 },
      { id: 'mf_anti_stuck_r2', type: 'bumper', x: 700, y: 2150, radius: 20, restitution: 1.8 },
      { id: 'mf_anti_stuck_l1', type: 'bumper', x: 120, y: 1950, radius: 20, restitution: 1.8 },
      { id: 'mf_anti_stuck_l2', type: 'bumper', x: 100, y: 2150, radius: 20, restitution: 1.8 },

      // 출구: 중력 포집 빗면 — 양쪽 슬로프로 중앙 수렴 + 가장자리 봉인
      // 검산: inner_end = 190+124=314, 610-124=486 → gap=172px ✓
      { id: 'mf_ex1', type: 'wall', x: 190, y: 2260, w: 260, h: 20, rotation: 15, friction: 0.07 },
      { id: 'mf_ex2', type: 'wall', x: 610, y: 2260, w: 260, h: 20, rotation: -15, friction: 0.07 },
      // 검산: 가장자리 inner_end = 80+69=149, 720-69=651 → 중앙벽과 겹침 없음
      { id: 'mf_ex3', type: 'wall', x: 80, y: 2220, w: 160, h: 16, rotation: 30, friction: 0.07 },
      { id: 'mf_ex4', type: 'wall', x: 720, y: 2220, w: 160, h: 16, rotation: -30, friction: 0.07 },
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
