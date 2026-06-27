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
  items: EditorItem[];                       // 장애물 배치 배열
}

// ──────────────────────────────────────────────
// 맵 설계 황금률 (모든 맵에 적용):
// 1. 깔때기 하단 틈 ≥ 80px (칩 3개 동시 통과)
// 2. 맵 내부 벽 |rotation| ≥ 8° (수평 위 무한 점프 방지)
// 3. 장애물 x 좌표 60~740 범위 내
// 4. 결승선 전 마지막 200px은 장애물 없음
// 5. 풍차(반경 50px) 바로 아래 150px은 빈 공간
// ──────────────────────────────────────────────

export const MapPresets: Record<string, MapPresetMeta> = {

  // ========== MAP 1: 네온 아케이드 ==========
  'neon_arcade': {
    name: '네온 아케이드',
    description: '범퍼·부스터·풍차',
    lengthType: 'Middle',
    complexity: 'Medium',
    worldHeight: 2400,
    wallStyle: 'straight',
    items: [
      // Zone 1: 입구 깔때기 (θ=±25°, 틈≈100px)
      { id: 'n_w1', type: 'wall', x: 220, y: 200, w: 280, h: 20, rotation: 25 },
      { id: 'n_w2', type: 'wall', x: 580, y: 200, w: 280, h: 20, rotation: -25 },
      // Zone 2: 범퍼 삼각 패턴
      { id: 'n_bp1', type: 'bumper', x: 400, y: 450, radius: 22, restitution: 1.8 },
      { id: 'n_bp2', type: 'bumper', x: 280, y: 570, radius: 16, restitution: 1.6 },
      { id: 'n_bp3', type: 'bumper', x: 520, y: 570, radius: 16, restitution: 1.6 },
      { id: 'n_bp4', type: 'bumper', x: 340, y: 680, radius: 18, restitution: 1.7 },
      { id: 'n_bp5', type: 'bumper', x: 460, y: 680, radius: 18, restitution: 1.7 },
      // Zone 3: 경사 슬라이드
      { id: 'n_w3', type: 'wall', x: 280, y: 830, w: 320, h: 20, rotation: 15 },
      { id: 'n_w4', type: 'wall', x: 520, y: 950, w: 320, h: 20, rotation: -15 },
      // Zone 4: 부스터 가속
      { id: 'n_b1', type: 'booster', x: 250, y: 1080, rotation: 30, power: 3 },
      { id: 'n_b2', type: 'booster', x: 550, y: 1080, rotation: -30, power: 3 },
      // Zone 5: 풍차 + 범퍼
      { id: 'n_wm1', type: 'windmill', x: 350, y: 1280, speed: 5 },
      { id: 'n_bp6', type: 'bumper', x: 200, y: 1480, radius: 18, restitution: 1.8 },
      { id: 'n_bp7', type: 'bumper', x: 600, y: 1480, radius: 18, restitution: 1.8 },
      { id: 'n_bp8', type: 'bumper', x: 400, y: 1550, radius: 16, restitution: 1.6 },
      // Zone 6: 지그재그 슬라이드
      { id: 'n_w5', type: 'wall', x: 260, y: 1700, w: 300, h: 20, rotation: 18 },
      { id: 'n_w6', type: 'wall', x: 540, y: 1820, w: 300, h: 20, rotation: -18 },
      { id: 'n_w7', type: 'wall', x: 260, y: 1940, w: 300, h: 20, rotation: 18 },
      // Zone 7: 부스터 + 범퍼
      { id: 'n_b3', type: 'booster', x: 300, y: 2050, rotation: 25, power: 3 },
      { id: 'n_b4', type: 'booster', x: 500, y: 2050, rotation: -25, power: 3 },
      { id: 'n_bp9', type: 'bumper', x: 400, y: 2100, radius: 16, restitution: 1.7 },
      // Zone 8: 출구 깔때기 (θ=±25°, 틈≈120px)
      { id: 'n_w8', type: 'wall', x: 200, y: 2200, w: 280, h: 20, rotation: 25 },
      { id: 'n_w9', type: 'wall', x: 600, y: 2200, w: 280, h: 20, rotation: -25 },
    ],
  },

  // ========== MAP 2: 블랙홀의 함정 ==========
  'gravity_abyss': {
    name: '블랙홀의 함정',
    description: '블랙홀·화이트홀·핀',
    lengthType: 'Middle',
    complexity: 'Complex',
    worldHeight: 2600,
    wallStyle: 'straight',
    items: [
      // Zone 1: 진입 슬라이드
      { id: 'g_w1', type: 'wall', x: 300, y: 250, w: 300, h: 20, rotation: 15 },
      { id: 'g_w2', type: 'wall', x: 500, y: 400, w: 300, h: 20, rotation: -15 },
      // Zone 2: 1차 중력장 (블랙홀 중앙 + 양쪽 화이트홀)
      { id: 'g_bh1', type: 'blackhole', x: 400, y: 600, radius: 120, force: 80 },
      { id: 'g_wh1', type: 'whitehole', x: 150, y: 600, radius: 80, force: 60 },
      { id: 'g_wh2', type: 'whitehole', x: 650, y: 600, radius: 80, force: 60 },
      // Zone 3: 핀 감속대 (삼각형 패턴)
      { id: 'g_p1', type: 'pin', x: 400, y: 800, radius: 10 },
      { id: 'g_p2', type: 'pin', x: 320, y: 860, radius: 10 },
      { id: 'g_p3', type: 'pin', x: 480, y: 860, radius: 10 },
      { id: 'g_p4', type: 'pin', x: 260, y: 920, radius: 10 },
      { id: 'g_p5', type: 'pin', x: 400, y: 920, radius: 10 },
      { id: 'g_p6', type: 'pin', x: 540, y: 920, radius: 10 },
      { id: 'g_p7', type: 'pin', x: 200, y: 980, radius: 10 },
      // Zone 4: 2차 중력장 (오프셋)
      { id: 'g_bh2', type: 'blackhole', x: 250, y: 1200, radius: 100, force: 70 },
      { id: 'g_wh3', type: 'whitehole', x: 600, y: 1200, radius: 80, force: 60 },
      { id: 'g_w3', type: 'wall', x: 550, y: 1350, w: 250, h: 20, rotation: -12 },
      // Zone 5: 경사 슬라이드 + 핀
      { id: 'g_w4', type: 'wall', x: 280, y: 1500, w: 280, h: 20, rotation: 12 },
      { id: 'g_p8', type: 'pin', x: 350, y: 1580, radius: 10 },
      { id: 'g_p9', type: 'pin', x: 500, y: 1580, radius: 10 },
      { id: 'g_p10', type: 'pin', x: 300, y: 1640, radius: 10 },
      { id: 'g_p11', type: 'pin', x: 450, y: 1640, radius: 10 },
      // Zone 6: 3차 거대 중력장
      { id: 'g_bh3', type: 'blackhole', x: 400, y: 1900, radius: 160, force: 100 },
      { id: 'g_wh4', type: 'whitehole', x: 120, y: 1900, radius: 90, force: 70 },
      { id: 'g_wh5', type: 'whitehole', x: 680, y: 1900, radius: 90, force: 70 },
      { id: 'g_w5', type: 'wall', x: 280, y: 2100, w: 200, h: 20, rotation: 20 },
      { id: 'g_w6', type: 'wall', x: 520, y: 2100, w: 200, h: 20, rotation: -20 },
      // Zone 7: 핀 미로
      { id: 'g_p12', type: 'pin', x: 250, y: 2180, radius: 10 },
      { id: 'g_p13', type: 'pin', x: 400, y: 2180, radius: 10 },
      { id: 'g_p14', type: 'pin', x: 550, y: 2180, radius: 10 },
      { id: 'g_p15', type: 'pin', x: 320, y: 2240, radius: 10 },
      { id: 'g_p16', type: 'pin', x: 480, y: 2240, radius: 10 },
      { id: 'g_p17', type: 'pin', x: 200, y: 2300, radius: 10 },
      { id: 'g_p18', type: 'pin', x: 350, y: 2300, radius: 10 },
      { id: 'g_p19', type: 'pin', x: 600, y: 2300, radius: 10 },
      // Zone 8: 출구 깔때기 (θ=±22°, 틈≈100px)
      { id: 'g_w7', type: 'wall', x: 220, y: 2420, w: 260, h: 20, rotation: 22 },
      { id: 'g_w8', type: 'wall', x: 580, y: 2420, w: 260, h: 20, rotation: -22 },
    ],
  },

  // ========== MAP 3: 톱니바퀴 공장 ==========
  'mechanical_factory': {
    name: '톱니바퀴 공장',
    description: '풍차·고탄성벽',
    lengthType: 'Long',
    complexity: 'Complex',
    worldHeight: 3200,
    wallStyle: 'zigzag',
    items: [
      // Zone 1: 피스톤 입구 (고탄성 경사벽)
      { id: 'm_w1', type: 'wall', x: 250, y: 250, w: 150, h: 30, rotation: 12, restitution: 1.8 },
      { id: 'm_w2', type: 'wall', x: 550, y: 300, w: 150, h: 30, rotation: -12, restitution: 1.8 },
      { id: 'm_w3', type: 'wall', x: 400, y: 400, w: 160, h: 30, rotation: 10, restitution: 1.8 },
      // Zone 2: 1차 풍차 회랑
      { id: 'm_wm1', type: 'windmill', x: 300, y: 580, speed: 6 },
      { id: 'm_wm2', type: 'windmill', x: 500, y: 700, speed: -6 },
      // Zone 3: 범퍼 어레이
      { id: 'm_bp1', type: 'bumper', x: 400, y: 900, radius: 22, restitution: 2.3 },
      { id: 'm_bp2', type: 'bumper', x: 250, y: 850, radius: 16, restitution: 2.0 },
      { id: 'm_bp3', type: 'bumper', x: 550, y: 850, radius: 16, restitution: 2.0 },
      { id: 'm_bp4', type: 'bumper', x: 320, y: 1000, radius: 16, restitution: 2.0 },
      { id: 'm_bp5', type: 'bumper', x: 480, y: 1000, radius: 16, restitution: 2.0 },
      // Zone 4: 2차 풍차 + 경사벽
      { id: 'm_wm3', type: 'windmill', x: 400, y: 1200, speed: -10 },
      { id: 'm_w4', type: 'wall', x: 250, y: 1380, w: 200, h: 20, rotation: 15 },
      { id: 'm_w5', type: 'wall', x: 550, y: 1380, w: 200, h: 20, rotation: -15 },
      // Zone 5: 좁은 통로 + 범퍼
      { id: 'm_w6', type: 'wall', x: 160, y: 1550, w: 20, h: 200, rotation: 0 },
      { id: 'm_w7', type: 'wall', x: 640, y: 1550, w: 20, h: 200, rotation: 0 },
      { id: 'm_bp6', type: 'bumper', x: 350, y: 1550, radius: 16, restitution: 2.0 },
      { id: 'm_bp7', type: 'bumper', x: 450, y: 1600, radius: 16, restitution: 2.0 },
      // Zone 6: 3차 풍차 3연속 (지그재그 배치)
      { id: 'm_wm4', type: 'windmill', x: 200, y: 1800, speed: 7 },
      { id: 'm_wm5', type: 'windmill', x: 400, y: 1920, speed: -8 },
      { id: 'm_wm6', type: 'windmill', x: 600, y: 2040, speed: 7 },
      // Zone 7: 고탄성 미로 (경사벽 좌우 교차)
      { id: 'm_w8', type: 'wall', x: 250, y: 2200, w: 250, h: 20, rotation: 12, restitution: 2.0 },
      { id: 'm_w9', type: 'wall', x: 550, y: 2320, w: 250, h: 20, rotation: -14, restitution: 2.0 },
      { id: 'm_w10', type: 'wall', x: 300, y: 2440, w: 250, h: 20, rotation: 16, restitution: 2.0 },
      { id: 'm_w11', type: 'wall', x: 500, y: 2560, w: 250, h: 20, rotation: -12, restitution: 2.0 },
      // Zone 8: 최종 초고속 풍차
      { id: 'm_wm7', type: 'windmill', x: 400, y: 2750, speed: 14 },
      { id: 'm_w12', type: 'wall', x: 220, y: 2900, w: 200, h: 20, rotation: 18 },
      { id: 'm_w13', type: 'wall', x: 580, y: 2900, w: 200, h: 20, rotation: -18 },
      // Zone 9: 출구 깔때기 (θ=±22°, 틈≈110px)
      { id: 'm_w14', type: 'wall', x: 230, y: 3050, w: 250, h: 20, rotation: 22 },
      { id: 'm_w15', type: 'wall', x: 570, y: 3050, w: 250, h: 20, rotation: -22 },
    ],
  },

  // ========== MAP 4: 부스트 하이웨이 ==========
  'boost_highway': {
    name: '부스트 하이웨이',
    description: '초고속 부스터 스프린트',
    lengthType: 'Short',
    complexity: 'Simple',
    worldHeight: 1600,
    wallStyle: 'narrow',
    items: [
      // Zone 1: 입구 깔때기 (θ=±20°, 틈≈120px)
      { id: 'bh_w1', type: 'wall', x: 250, y: 200, w: 200, h: 20, rotation: 20 },
      { id: 'bh_w2', type: 'wall', x: 550, y: 200, w: 200, h: 20, rotation: -20 },
      // Zone 2: 1차 부스터
      { id: 'bh_b1', type: 'booster', x: 280, y: 380, rotation: 35, power: 3 },
      { id: 'bh_b2', type: 'booster', x: 520, y: 380, rotation: -35, power: 3 },
      // Zone 3: 경사 슬라이드
      { id: 'bh_w3', type: 'wall', x: 350, y: 530, w: 250, h: 20, rotation: 12 },
      // Zone 4: 2차 부스터 (수직 방향, power=4)
      { id: 'bh_b3', type: 'booster', x: 400, y: 700, rotation: 0, power: 4 },
      // Zone 5: 핀 3개 (최소한의 감속)
      { id: 'bh_p1', type: 'pin', x: 320, y: 870, radius: 10 },
      { id: 'bh_p2', type: 'pin', x: 400, y: 920, radius: 10 },
      { id: 'bh_p3', type: 'pin', x: 480, y: 870, radius: 10 },
      // Zone 6: 3차 부스터
      { id: 'bh_b4', type: 'booster', x: 300, y: 1050, rotation: 25, power: 4 },
      { id: 'bh_b5', type: 'booster', x: 500, y: 1050, rotation: -25, power: 4 },
      // Zone 7: 최종 부스터
      { id: 'bh_b6', type: 'booster', x: 350, y: 1200, rotation: 15, power: 3 },
      { id: 'bh_b7', type: 'booster', x: 450, y: 1200, rotation: -15, power: 3 },
      // Zone 8: 출구 경사벽 (θ=±18°, 틈≈130px)
      { id: 'bh_w4', type: 'wall', x: 250, y: 1380, w: 180, h: 20, rotation: 18 },
      { id: 'bh_w5', type: 'wall', x: 550, y: 1380, w: 180, h: 20, rotation: -18 },
    ],
  },

  // ========== MAP 5: 차원 포탈 미궁 ==========
  'portal_labyrinth': {
    name: '차원 포탈 미궁',
    description: '포탈 순간이동·밀폐 방 구조',
    lengthType: 'Middle',
    complexity: 'Complex',
    worldHeight: 2500,
    wallStyle: 'straight',
    items: [
      // Room 1: 진입실 → 경사 깔때기 → 밀폐 경사벽 → 포탈A
      { id: 'pl_w1', type: 'wall', x: 250, y: 220, w: 250, h: 20, rotation: 20 },
      { id: 'pl_w2', type: 'wall', x: 550, y: 220, w: 250, h: 20, rotation: -20 },
      // 밀폐 경사벽 (θ=8°로 칩이 왼쪽으로 미끄러져 포탈 쪽으로 모임)
      { id: 'pl_w3', type: 'wall', x: 400, y: 480, w: 640, h: 20, rotation: 8 },
      // 포탈A 쌍 (입구: 밀폐벽의 낮은쪽 끝 / 출구: 아래 방)
      { id: 'pl_pa1', type: 'portal', x: 120, y: 450, color: '#FF6600' },
      { id: 'pl_pa2', type: 'portal', x: 600, y: 560, color: '#FF6600' },
      // Room 2: 범퍼 → 밀폐벽 → 포탈B
      { id: 'pl_bp1', type: 'bumper', x: 350, y: 680, radius: 18, restitution: 1.6 },
      { id: 'pl_bp2', type: 'bumper', x: 500, y: 750, radius: 18, restitution: 1.6 },
      { id: 'pl_bp3', type: 'bumper', x: 250, y: 800, radius: 16, restitution: 1.5 },
      // 밀폐 경사벽 (θ=-8°로 오른쪽으로 미끄러짐)
      { id: 'pl_w4', type: 'wall', x: 400, y: 950, w: 640, h: 20, rotation: -8 },
      { id: 'pl_pb1', type: 'portal', x: 680, y: 920, color: '#00FF66' },
      { id: 'pl_pb2', type: 'portal', x: 200, y: 1050, color: '#00FF66' },
      // Room 3: 풍차실
      { id: 'pl_wm1', type: 'windmill', x: 350, y: 1200, speed: 5 },
      { id: 'pl_wm2', type: 'windmill', x: 550, y: 1350, speed: -5 },
      // 밀폐 경사벽
      { id: 'pl_w5', type: 'wall', x: 400, y: 1500, w: 640, h: 20, rotation: 8 },
      { id: 'pl_pc1', type: 'portal', x: 120, y: 1470, color: '#6600FF' },
      { id: 'pl_pc2', type: 'portal', x: 500, y: 1600, color: '#6600FF' },
      // Room 4: 핀 그리드 + 출구
      { id: 'pl_p1', type: 'pin', x: 250, y: 1720, radius: 10 },
      { id: 'pl_p2', type: 'pin', x: 400, y: 1720, radius: 10 },
      { id: 'pl_p3', type: 'pin', x: 550, y: 1720, radius: 10 },
      { id: 'pl_p4', type: 'pin', x: 320, y: 1800, radius: 10 },
      { id: 'pl_p5', type: 'pin', x: 480, y: 1800, radius: 10 },
      { id: 'pl_p6', type: 'pin', x: 200, y: 1880, radius: 10 },
      { id: 'pl_p7', type: 'pin', x: 400, y: 1880, radius: 10 },
      { id: 'pl_p8', type: 'pin', x: 600, y: 1880, radius: 10 },
      // 경사 슬라이드
      { id: 'pl_w6', type: 'wall', x: 300, y: 2000, w: 250, h: 20, rotation: 15 },
      { id: 'pl_w7', type: 'wall', x: 500, y: 2120, w: 250, h: 20, rotation: -15 },
      // 출구 깔때기 (θ=±20°, 틈≈100px)
      { id: 'pl_w8', type: 'wall', x: 230, y: 2300, w: 240, h: 20, rotation: 20 },
      { id: 'pl_w9', type: 'wall', x: 570, y: 2300, w: 240, h: 20, rotation: -20 },
    ],
  },

  // ========== MAP 6: 플링코 폭포 ==========
  'plinko_cascade': {
    name: '플링코 폭포',
    description: '핀 120+개 순수 운 게임',
    lengthType: 'Long',
    complexity: 'Complex',
    worldHeight: 3600,
    wallStyle: 'straight',
    items: (() => {
      // 프로그래밍 방식으로 대량의 핀을 생성하여 플링코 보드 구현
      const items: EditorItem[] = [];
      let id = 0;
      // 상단 플링코 (y=150~1100, 55px 간격, 육각 패턴)
      for (let row = 0; row < 18; row++) {
        const y = 180 + row * 55;
        const offset = (row % 2 === 0) ? 0 : 27;
        for (let col = 0; col < 12; col++) {
          const x = 100 + col * 55 + offset;
          if (x > 60 && x < 740) {
            // 4행마다 범퍼 1개를 섞어 예측불가 튕김 추가
            if (row % 4 === 0 && col % 3 === 1) {
              items.push({ id: `pk_bp${id++}`, type: 'bumper', x, y, radius: 12, restitution: 1.5 });
            } else {
              items.push({ id: `pk_p${id++}`, type: 'pin', x, y, radius: 8 });
            }
          }
        }
      }
      // 중간 휴식: 경사벽 2개
      items.push({ id: 'pk_w1', type: 'wall', x: 280, y: 1200, w: 250, h: 20, rotation: 15 });
      items.push({ id: 'pk_w2', type: 'wall', x: 520, y: 1300, w: 250, h: 20, rotation: -15 });
      // 범퍼 서프라이즈
      items.push({ id: 'pk_bp_s1', type: 'bumper', x: 250, y: 1450, radius: 18, restitution: 1.8 });
      items.push({ id: 'pk_bp_s2', type: 'bumper', x: 400, y: 1500, radius: 20, restitution: 1.8 });
      items.push({ id: 'pk_bp_s3', type: 'bumper', x: 550, y: 1450, radius: 18, restitution: 1.8 });
      items.push({ id: 'pk_bp_s4', type: 'bumper', x: 320, y: 1580, radius: 14, restitution: 1.6 });
      items.push({ id: 'pk_bp_s5', type: 'bumper', x: 480, y: 1580, radius: 14, restitution: 1.6 });
      // 하단 플링코 (y=1650~2700, 60px 간격, 밀도 약간 낮춤)
      for (let row = 0; row < 18; row++) {
        const y = 1680 + row * 60;
        const offset = (row % 2 === 0) ? 0 : 30;
        for (let col = 0; col < 11; col++) {
          const x = 110 + col * 60 + offset;
          if (x > 60 && x < 740) {
            items.push({ id: `pk_p2_${id++}`, type: 'pin', x, y, radius: 8 });
          }
        }
      }
      // 소형 범퍼대
      items.push({ id: 'pk_bp_e1', type: 'bumper', x: 250, y: 2850, radius: 14, restitution: 1.6 });
      items.push({ id: 'pk_bp_e2', type: 'bumper', x: 400, y: 2900, radius: 14, restitution: 1.6 });
      items.push({ id: 'pk_bp_e3', type: 'bumper', x: 550, y: 2850, radius: 14, restitution: 1.6 });
      items.push({ id: 'pk_bp_e4', type: 'bumper', x: 320, y: 2970, radius: 14, restitution: 1.6 });
      // 경사 수렴 + 출구 깔때기
      items.push({ id: 'pk_w3', type: 'wall', x: 280, y: 3150, w: 240, h: 20, rotation: 18 });
      items.push({ id: 'pk_w4', type: 'wall', x: 520, y: 3150, w: 240, h: 20, rotation: -18 });
      items.push({ id: 'pk_w5', type: 'wall', x: 250, y: 3350, w: 220, h: 20, rotation: 20 });
      items.push({ id: 'pk_w6', type: 'wall', x: 550, y: 3350, w: 220, h: 20, rotation: -20 });
      return items;
    })(),
  },

  // ========== MAP 7: 운명의 룰렛 ==========
  'roulette_of_fate': {
    name: '운명의 룰렛',
    description: '거대 깔때기 병목 경쟁',
    lengthType: 'Short',
    complexity: 'Medium',
    worldHeight: 1800,
    wallStyle: 'wide',
    items: [
      // Zone 1: 거대 깔때기 (θ=±35°, 넓은 외벽에서 시작하여 수렴)
      { id: 'rf_w1', type: 'wall', x: 150, y: 400, w: 450, h: 20, rotation: 35 },
      { id: 'rf_w2', type: 'wall', x: 650, y: 400, w: 450, h: 20, rotation: -35 },
      // Zone 2: 초크포인트 (폭 100px 수직 통로)
      { id: 'rf_w3', type: 'wall', x: 310, y: 780, w: 20, h: 180, rotation: 0 },
      { id: 'rf_w4', type: 'wall', x: 490, y: 780, w: 20, h: 180, rotation: 0 },
      // Zone 3: 화이트홀 방출 + 경사 분산
      { id: 'rf_wh1', type: 'whitehole', x: 400, y: 1050, radius: 100, force: 70 },
      { id: 'rf_w5', type: 'wall', x: 280, y: 1150, w: 200, h: 20, rotation: 12 },
      { id: 'rf_w6', type: 'wall', x: 520, y: 1150, w: 200, h: 20, rotation: -12 },
      // Zone 4: 핀 감속
      { id: 'rf_p1', type: 'pin', x: 250, y: 1300, radius: 10 },
      { id: 'rf_p2', type: 'pin', x: 350, y: 1330, radius: 10 },
      { id: 'rf_p3', type: 'pin', x: 450, y: 1300, radius: 10 },
      { id: 'rf_p4', type: 'pin', x: 550, y: 1330, radius: 10 },
      { id: 'rf_p5', type: 'pin', x: 300, y: 1380, radius: 10 },
      { id: 'rf_p6', type: 'pin', x: 400, y: 1400, radius: 10 },
      { id: 'rf_p7', type: 'pin', x: 500, y: 1380, radius: 10 },
      { id: 'rf_p8', type: 'pin', x: 200, y: 1420, radius: 10 },
      // Zone 5: 출구 깔때기 (θ=±18°, 틈≈130px)
      { id: 'rf_w7', type: 'wall', x: 250, y: 1580, w: 220, h: 20, rotation: 18 },
      { id: 'rf_w8', type: 'wall', x: 550, y: 1580, w: 220, h: 20, rotation: -18 },
    ],
  },

  // ========== MAP 8: 토네이도 협곡 ==========
  'tornado_canyon': {
    name: '토네이도 협곡',
    description: '블랙홀+풍차 회오리',
    lengthType: 'Long',
    complexity: 'Medium',
    worldHeight: 3000,
    wallStyle: 'zigzag',
    items: [
      // Zone 1: 진입 분기 (중앙 수직벽)
      { id: 'tc_w1', type: 'wall', x: 400, y: 230, w: 20, h: 160, rotation: 0 },
      { id: 'tc_w2', type: 'wall', x: 280, y: 380, w: 200, h: 20, rotation: 15 },
      { id: 'tc_w3', type: 'wall', x: 520, y: 380, w: 200, h: 20, rotation: -15 },
      // Zone 2: 1차 토네이도
      { id: 'tc_bh1', type: 'blackhole', x: 400, y: 750, radius: 180, force: 80 },
      { id: 'tc_wm1', type: 'windmill', x: 200, y: 650, speed: 6 },
      { id: 'tc_wm2', type: 'windmill', x: 600, y: 850, speed: -6 },
      // 탈출 경사벽
      { id: 'tc_w4', type: 'wall', x: 120, y: 950, w: 180, h: 20, rotation: 10 },
      { id: 'tc_w5', type: 'wall', x: 680, y: 950, w: 180, h: 20, rotation: -10 },
      // Zone 3: 휴식 구간
      { id: 'tc_w6', type: 'wall', x: 280, y: 1200, w: 250, h: 20, rotation: 12 },
      { id: 'tc_w7', type: 'wall', x: 520, y: 1350, w: 250, h: 20, rotation: -12 },
      { id: 'tc_w8', type: 'wall', x: 300, y: 1500, w: 250, h: 20, rotation: 15 },
      { id: 'tc_p1', type: 'pin', x: 350, y: 1280, radius: 10 },
      { id: 'tc_p2', type: 'pin', x: 500, y: 1280, radius: 10 },
      { id: 'tc_p3', type: 'pin', x: 250, y: 1430, radius: 10 },
      { id: 'tc_p4', type: 'pin', x: 600, y: 1430, radius: 10 },
      // Zone 4: 2차 토네이도
      { id: 'tc_bh2', type: 'blackhole', x: 400, y: 1850, radius: 160, force: 70 },
      { id: 'tc_wm3', type: 'windmill', x: 220, y: 1750, speed: 8 },
      { id: 'tc_wm4', type: 'windmill', x: 580, y: 1950, speed: -8 },
      // 탈출 경사벽
      { id: 'tc_w9', type: 'wall', x: 130, y: 2050, w: 180, h: 20, rotation: 12 },
      { id: 'tc_w10', type: 'wall', x: 670, y: 2050, w: 180, h: 20, rotation: -12 },
      // Zone 5: 탈출 슬라이드
      { id: 'tc_w11', type: 'wall', x: 280, y: 2300, w: 250, h: 20, rotation: 18 },
      { id: 'tc_w12', type: 'wall', x: 520, y: 2400, w: 250, h: 20, rotation: -18 },
      // Zone 6: 핀 감속
      { id: 'tc_p5', type: 'pin', x: 300, y: 2550, radius: 10 },
      { id: 'tc_p6', type: 'pin', x: 400, y: 2580, radius: 10 },
      { id: 'tc_p7', type: 'pin', x: 500, y: 2550, radius: 10 },
      { id: 'tc_p8', type: 'pin', x: 250, y: 2630, radius: 10 },
      { id: 'tc_p9', type: 'pin', x: 550, y: 2630, radius: 10 },
      { id: 'tc_p10', type: 'pin', x: 350, y: 2680, radius: 10 },
      // Zone 7: 출구 깔때기 (θ=±20°, 틈≈100px)
      { id: 'tc_w13', type: 'wall', x: 230, y: 2800, w: 240, h: 20, rotation: 20 },
      { id: 'tc_w14', type: 'wall', x: 570, y: 2800, w: 240, h: 20, rotation: -20 },
    ],
  },

  // ========== MAP 9: 바운스 미러 ==========
  'bounce_mirror': {
    name: '바운스 미러',
    description: '좌우 대칭·초고탄성 벽',
    lengthType: 'Middle',
    complexity: 'Simple',
    worldHeight: 2400,
    wallStyle: 'straight',
    items: [
      // Zone 1: 대칭 분기 (중앙 수직벽)
      { id: 'bm_w1', type: 'wall', x: 400, y: 260, w: 20, h: 200, rotation: 0 },
      // Zone 2: 바운스 통로 (좌우 대칭, rest=2.5, 모든 벽 경사 ≥ 10°)
      { id: 'bm_w2', type: 'wall', x: 200, y: 450, w: 200, h: 20, rotation: 15, restitution: 2.5 },
      { id: 'bm_w3', type: 'wall', x: 600, y: 450, w: 200, h: 20, rotation: -15, restitution: 2.5 },
      { id: 'bm_w4', type: 'wall', x: 250, y: 600, w: 200, h: 20, rotation: -12, restitution: 2.5 },
      { id: 'bm_w5', type: 'wall', x: 550, y: 600, w: 200, h: 20, rotation: 12, restitution: 2.5 },
      { id: 'bm_w6', type: 'wall', x: 200, y: 750, w: 200, h: 20, rotation: 15, restitution: 2.5 },
      { id: 'bm_w7', type: 'wall', x: 600, y: 750, w: 200, h: 20, rotation: -15, restitution: 2.5 },
      // Zone 3: 합류 + 핀 (대칭)
      { id: 'bm_w8', type: 'wall', x: 400, y: 920, w: 250, h: 20, rotation: 10, restitution: 2.0 },
      { id: 'bm_p1', type: 'pin', x: 300, y: 1020, radius: 10 },
      { id: 'bm_p2', type: 'pin', x: 500, y: 1020, radius: 10 },
      { id: 'bm_p3', type: 'pin', x: 250, y: 1080, radius: 10 },
      { id: 'bm_p4', type: 'pin', x: 400, y: 1080, radius: 10 },
      { id: 'bm_p5', type: 'pin', x: 550, y: 1080, radius: 10 },
      { id: 'bm_p6', type: 'pin', x: 200, y: 1140, radius: 10 },
      // Zone 4: 고탄성 경사 구간 (좌우 교차, 모두 경사 ≥ 10°)
      { id: 'bm_w9', type: 'wall', x: 250, y: 1300, w: 220, h: 20, rotation: 14, restitution: 2.5 },
      { id: 'bm_w10', type: 'wall', x: 550, y: 1300, w: 220, h: 20, rotation: -14, restitution: 2.5 },
      { id: 'bm_w11', type: 'wall', x: 250, y: 1450, w: 220, h: 20, rotation: -12, restitution: 2.5 },
      { id: 'bm_w12', type: 'wall', x: 550, y: 1450, w: 220, h: 20, rotation: 12, restitution: 2.5 },
      { id: 'bm_w13', type: 'wall', x: 300, y: 1600, w: 200, h: 20, rotation: 16, restitution: 2.5 },
      { id: 'bm_w14', type: 'wall', x: 500, y: 1600, w: 200, h: 20, rotation: -16, restitution: 2.5 },
      // Zone 5: 핀 감속 (대칭)
      { id: 'bm_p7', type: 'pin', x: 250, y: 1750, radius: 10 },
      { id: 'bm_p8', type: 'pin', x: 350, y: 1780, radius: 10 },
      { id: 'bm_p9', type: 'pin', x: 450, y: 1780, radius: 10 },
      { id: 'bm_p10', type: 'pin', x: 550, y: 1750, radius: 10 },
      { id: 'bm_p11', type: 'pin', x: 300, y: 1840, radius: 10 },
      { id: 'bm_p12', type: 'pin', x: 400, y: 1860, radius: 10 },
      { id: 'bm_p13', type: 'pin', x: 500, y: 1840, radius: 10 },
      { id: 'bm_w15', type: 'wall', x: 280, y: 1960, w: 200, h: 20, rotation: 12, restitution: 1.5 },
      { id: 'bm_w16', type: 'wall', x: 520, y: 1960, w: 200, h: 20, rotation: -12, restitution: 1.5 },
      // Zone 6: 출구 깔때기 (대칭, θ=±22°, 틈≈100px)
      { id: 'bm_w17', type: 'wall', x: 220, y: 2150, w: 250, h: 20, rotation: 22 },
      { id: 'bm_w18', type: 'wall', x: 580, y: 2150, w: 250, h: 20, rotation: -22 },
    ],
  },

  // ========== MAP 10: 운석 지대 ==========
  'meteor_field': {
    name: '운석 지대',
    description: '범퍼만 25+개, 벽 없음',
    lengthType: 'Long',
    complexity: 'Medium',
    worldHeight: 2800,
    wallStyle: 'wide',
    items: [
      // 벽이 하나도 없는 맵. 오직 둥근 범퍼만 불규칙 배치.
      // 범퍼는 원형이므로 칩이 위에 착지하여 점프만 반복하는 문제가 원천적으로 없음.
      // Zone 1: 소형 운석 (r=10~14)
      { id: 'mf_b1', type: 'bumper', x: 200, y: 200, radius: 12, restitution: 1.5 },
      { id: 'mf_b2', type: 'bumper', x: 450, y: 280, radius: 14, restitution: 1.5 },
      { id: 'mf_b3', type: 'bumper', x: 600, y: 220, radius: 10, restitution: 1.5 },
      { id: 'mf_b4', type: 'bumper', x: 320, y: 400, radius: 12, restitution: 1.5 },
      { id: 'mf_b5', type: 'bumper', x: 550, y: 430, radius: 14, restitution: 1.5 },
      { id: 'mf_b6', type: 'bumper', x: 150, y: 480, radius: 10, restitution: 1.5 },
      // Zone 2: 중형 운석 (r=18~24)
      { id: 'mf_b7', type: 'bumper', x: 350, y: 620, radius: 22, restitution: 1.8 },
      { id: 'mf_b8', type: 'bumper', x: 580, y: 700, radius: 20, restitution: 1.8 },
      { id: 'mf_b9', type: 'bumper', x: 180, y: 750, radius: 18, restitution: 1.8 },
      { id: 'mf_b10', type: 'bumper', x: 450, y: 830, radius: 24, restitution: 1.8 },
      { id: 'mf_b11', type: 'bumper', x: 280, y: 880, radius: 20, restitution: 1.7 },
      { id: 'mf_b12', type: 'bumper', x: 650, y: 920, radius: 18, restitution: 1.8 },
      { id: 'mf_b13', type: 'bumper', x: 120, y: 980, radius: 22, restitution: 1.7 },
      // Zone 3: 초대형 운석 (r=30~35)
      { id: 'mf_b14', type: 'bumper', x: 350, y: 1150, radius: 35, restitution: 2.0 },
      { id: 'mf_b15', type: 'bumper', x: 550, y: 1300, radius: 30, restitution: 2.0 },
      // Zone 4: 혼합 지대
      { id: 'mf_b16', type: 'bumper', x: 200, y: 1450, radius: 16, restitution: 1.6 },
      { id: 'mf_b17', type: 'bumper', x: 400, y: 1500, radius: 28, restitution: 1.9 },
      { id: 'mf_b18', type: 'bumper', x: 600, y: 1480, radius: 14, restitution: 1.5 },
      { id: 'mf_b19', type: 'bumper', x: 300, y: 1620, radius: 22, restitution: 1.8 },
      { id: 'mf_b20', type: 'bumper', x: 500, y: 1680, radius: 18, restitution: 1.7 },
      { id: 'mf_b21', type: 'bumper', x: 150, y: 1720, radius: 12, restitution: 1.5 },
      { id: 'mf_b22', type: 'bumper', x: 650, y: 1750, radius: 20, restitution: 1.8 },
      { id: 'mf_b23', type: 'bumper', x: 350, y: 1850, radius: 10, restitution: 1.5 },
      { id: 'mf_b24', type: 'bumper', x: 550, y: 1900, radius: 16, restitution: 1.6 },
      { id: 'mf_b25', type: 'bumper', x: 200, y: 1950, radius: 14, restitution: 1.6 },
      // Zone 5: 밀집 운석
      { id: 'mf_b26', type: 'bumper', x: 300, y: 2100, radius: 16, restitution: 1.6 },
      { id: 'mf_b27', type: 'bumper', x: 450, y: 2150, radius: 18, restitution: 1.6 },
      { id: 'mf_b28', type: 'bumper', x: 200, y: 2200, radius: 14, restitution: 1.6 },
      { id: 'mf_b29', type: 'bumper', x: 600, y: 2180, radius: 16, restitution: 1.6 },
      { id: 'mf_b30', type: 'bumper', x: 350, y: 2300, radius: 12, restitution: 1.6 },
      { id: 'mf_b31', type: 'bumper', x: 500, y: 2350, radius: 14, restitution: 1.6 },
      { id: 'mf_b32', type: 'bumper', x: 150, y: 2380, radius: 16, restitution: 1.6 },
      // Zone 6: 삼각형 수렴 (범퍼 3개로 자연 깔때기 효과)
      { id: 'mf_b33', type: 'bumper', x: 250, y: 2520, radius: 25, restitution: 1.5 },
      { id: 'mf_b34', type: 'bumper', x: 550, y: 2520, radius: 25, restitution: 1.5 },
      { id: 'mf_b35', type: 'bumper', x: 400, y: 2620, radius: 22, restitution: 1.5 },
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
