import { EditorItem } from '@/store/editorStore';

// 월드: width 800 x height 2400. 칩은 y=50 에서 출발, 결승선 y>2420.
// 각 프리셋은 y≈150 ~ 2300 범위에 여러 구간(zone)으로 장애물을 배치해 충분한 길이를 확보한다.
export const MapPresets: Record<string, EditorItem[]> = {
  'neon_expressway': [
    // --- Zone 1: 상단 깔때기 + 부스터 ---
    { id: 'w1', type: 'wall', x: 200, y: 150, w: 300, h: 20, rotation: 30 },
    { id: 'w2', type: 'wall', x: 600, y: 150, w: 300, h: 20, rotation: -30 },
    { id: 'b1', type: 'booster', x: 300, y: 320, rotation: 45, power: 3 },
    { id: 'b2', type: 'booster', x: 500, y: 320, rotation: -45, power: 3 },
    // --- Zone 2: 중앙 범퍼 난타 ---
    { id: 'bp1', type: 'bumper', x: 400, y: 480, radius: 22, restitution: 1.8 },
    { id: 'bp2', type: 'bumper', x: 280, y: 580, radius: 16, restitution: 1.6 },
    { id: 'bp3', type: 'bumper', x: 520, y: 580, radius: 16, restitution: 1.6 },
    { id: 'bp4', type: 'bumper', x: 400, y: 700, radius: 18, restitution: 1.7 },
    // 측벽
    { id: 'w3', type: 'wall', x: 90, y: 650, w: 20, h: 500, rotation: 0 },
    { id: 'w4', type: 'wall', x: 710, y: 650, w: 20, h: 500, rotation: 0 },
    // --- Zone 3: 풍차 속도 트랩 ---
    { id: 'wm1', type: 'windmill', x: 260, y: 950, speed: 5 },
    { id: 'wm2', type: 'windmill', x: 540, y: 950, speed: -5 },
    { id: 'w5', type: 'wall', x: 400, y: 1120, w: 260, h: 20, rotation: 0 },
    // --- Zone 4: 지그재그 + 부스터 ---
    { id: 'w6', type: 'wall', x: 250, y: 1300, w: 400, h: 20, rotation: 25 },
    { id: 'w7', type: 'wall', x: 550, y: 1480, w: 400, h: 20, rotation: -25 },
    { id: 'b3', type: 'booster', x: 150, y: 1400, rotation: -30, power: 4 },
    { id: 'b4', type: 'booster', x: 650, y: 1580, rotation: 30, power: 4 },
    // --- Zone 5: 풍차 + 범퍼 ---
    { id: 'wm3', type: 'windmill', x: 400, y: 1700, speed: 7 },
    { id: 'bp5', type: 'bumper', x: 250, y: 1820, radius: 18, restitution: 1.8 },
    { id: 'bp6', type: 'bumper', x: 550, y: 1820, radius: 18, restitution: 1.8 },
    { id: 'wm4', type: 'windmill', x: 250, y: 1980, speed: -6 },
    { id: 'wm5', type: 'windmill', x: 550, y: 1980, speed: 6 },
    // --- Zone 6: 최종 깔때기 ---
    { id: 'w8', type: 'wall', x: 250, y: 2200, w: 420, h: 20, rotation: 40 },
    { id: 'w9', type: 'wall', x: 550, y: 2200, w: 420, h: 20, rotation: -40 },
  ],
  'gravity_abyss': [
    // --- Zone 1: 지그재그 낙하 ---
    { id: 'w1', type: 'wall', x: 300, y: 220, w: 420, h: 20, rotation: 15 },
    { id: 'w2', type: 'wall', x: 500, y: 440, w: 420, h: 20, rotation: -15 },
    { id: 'w3', type: 'wall', x: 300, y: 660, w: 420, h: 20, rotation: 15 },
    // --- Zone 2: 첫 블랙홀 + 화이트홀 ---
    { id: 'bh1', type: 'blackhole', x: 400, y: 560, radius: 140, force: 150 },
    { id: 'wh1', type: 'whitehole', x: 140, y: 560, radius: 90, force: 100 },
    { id: 'wh2', type: 'whitehole', x: 660, y: 560, radius: 90, force: 100 },
    // 핀 군집
    { id: 'p1', type: 'pin', x: 400, y: 840, radius: 12 },
    { id: 'p2', type: 'pin', x: 340, y: 900, radius: 12 },
    { id: 'p3', type: 'pin', x: 460, y: 900, radius: 12 },
    { id: 'p4', type: 'pin', x: 280, y: 960, radius: 12 },
    { id: 'p5', type: 'pin', x: 520, y: 960, radius: 12 },
    // --- Zone 3: 측면 화이트홀 통로 ---
    { id: 'w4', type: 'wall', x: 250, y: 1120, w: 360, h: 20, rotation: -20 },
    { id: 'w5', type: 'wall', x: 550, y: 1320, w: 360, h: 20, rotation: 20 },
    { id: 'wh3', type: 'whitehole', x: 400, y: 1220, radius: 110, force: 120 },
    // --- Zone 4: 거대 블랙홀 ---
    { id: 'bh2', type: 'blackhole', x: 400, y: 1560, radius: 170, force: 180 },
    { id: 'wh4', type: 'whitehole', x: 150, y: 1560, radius: 90, force: 110 },
    { id: 'wh5', type: 'whitehole', x: 650, y: 1560, radius: 90, force: 110 },
    // --- Zone 5: 핀 미로 + 작은 블랙홀 ---
    { id: 'p6', type: 'pin', x: 250, y: 1820, radius: 12 },
    { id: 'p7', type: 'pin', x: 400, y: 1820, radius: 12 },
    { id: 'p8', type: 'pin', x: 550, y: 1820, radius: 12 },
    { id: 'bh3', type: 'blackhole', x: 400, y: 2000, radius: 120, force: 130 },
    { id: 'p9', type: 'pin', x: 320, y: 2080, radius: 12 },
    { id: 'p10', type: 'pin', x: 480, y: 2080, radius: 12 },
    // --- Zone 6: 최종 깔때기 ---
    { id: 'w6', type: 'wall', x: 250, y: 2240, w: 400, h: 20, rotation: 38 },
    { id: 'w7', type: 'wall', x: 550, y: 2240, w: 400, h: 20, rotation: -38 },
  ],
  'mechanical_factory': [
    // --- Zone 1: 피스톤(고탄성 벽) ---
    { id: 'w1', type: 'wall', x: 200, y: 300, w: 100, h: 50, rotation: 0, restitution: 2.0 },
    { id: 'w2', type: 'wall', x: 600, y: 300, w: 100, h: 50, rotation: 0, restitution: 2.0 },
    { id: 'w3', type: 'wall', x: 400, y: 200, w: 120, h: 40, rotation: 0, restitution: 1.8 },
    // --- Zone 2: 컨베이어(풍차) ---
    { id: 'wm1', type: 'windmill', x: 400, y: 520, speed: 10 },
    { id: 'wm2', type: 'windmill', x: 280, y: 680, speed: -8 },
    { id: 'wm3', type: 'windmill', x: 520, y: 680, speed: 8 },
    // --- Zone 3: 핀볼 범퍼 어레이 ---
    { id: 'bp1', type: 'bumper', x: 400, y: 860, radius: 22, restitution: 2.4 },
    { id: 'bp2', type: 'bumper', x: 250, y: 800, radius: 16, restitution: 2.0 },
    { id: 'bp3', type: 'bumper', x: 550, y: 800, radius: 16, restitution: 2.0 },
    { id: 'bp4', type: 'bumper', x: 320, y: 960, radius: 16, restitution: 2.0 },
    { id: 'bp5', type: 'bumper', x: 480, y: 960, radius: 16, restitution: 2.0 },
    // 측벽
    { id: 'w4', type: 'wall', x: 90, y: 1000, w: 20, h: 500, rotation: 0 },
    { id: 'w5', type: 'wall', x: 710, y: 1000, w: 20, h: 500, rotation: 0 },
    // --- Zone 4: 피스톤 2차 ---
    { id: 'w6', type: 'wall', x: 250, y: 1200, w: 120, h: 50, rotation: 0, restitution: 2.2 },
    { id: 'w7', type: 'wall', x: 550, y: 1200, w: 120, h: 50, rotation: 0, restitution: 2.2 },
    { id: 'wm4', type: 'windmill', x: 400, y: 1380, speed: -12 },
    // --- Zone 5: 풍차 컨베이어 + 범퍼 ---
    { id: 'wm5', type: 'windmill', x: 280, y: 1560, speed: 9 },
    { id: 'wm6', type: 'windmill', x: 520, y: 1560, speed: -9 },
    { id: 'bp6', type: 'bumper', x: 400, y: 1720, radius: 22, restitution: 2.5 },
    { id: 'bp7', type: 'bumper', x: 250, y: 1820, radius: 16, restitution: 2.0 },
    { id: 'bp8', type: 'bumper', x: 550, y: 1820, radius: 16, restitution: 2.0 },
    // --- Zone 6: 최종 풍차 + 깔때기 ---
    { id: 'wm7', type: 'windmill', x: 400, y: 2000, speed: 14 },
    { id: 'w8', type: 'wall', x: 250, y: 2220, w: 400, h: 20, rotation: 40, restitution: 1.5 },
    { id: 'w9', type: 'wall', x: 550, y: 2220, w: 400, h: 20, rotation: -40, restitution: 1.5 },
  ]
};

export function getPresetMap(presetKey: string): EditorItem[] | null {
  return MapPresets[presetKey] || null;
}
