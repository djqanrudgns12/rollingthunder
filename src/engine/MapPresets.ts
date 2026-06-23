import { EditorItem } from '@/store/editorStore';

export const MapPresets: Record<string, EditorItem[]> = {
  'neon_expressway': [
    // Top funnel
    { id: 'w1', type: 'wall', x: 200, y: 150, w: 300, h: 20, rotation: 30 },
    { id: 'w2', type: 'wall', x: 600, y: 150, w: 300, h: 20, rotation: -30 },
    // Boosters pushing chips towards the center
    { id: 'b1', type: 'booster', x: 300, y: 300, rotation: 45, power: 3 },
    { id: 'b2', type: 'booster', x: 500, y: 300, rotation: -45, power: 3 },
    // Center chaotic bumpers
    { id: 'bp1', type: 'bumper', x: 400, y: 400, radius: 20, restitution: 1.8 },
    { id: 'bp2', type: 'bumper', x: 300, y: 500, radius: 15, restitution: 1.5 },
    { id: 'bp3', type: 'bumper', x: 500, y: 500, radius: 15, restitution: 1.5 },
    // Side walls
    { id: 'w3', type: 'wall', x: 100, y: 600, w: 20, h: 400, rotation: 0 },
    { id: 'w4', type: 'wall', x: 700, y: 600, w: 20, h: 400, rotation: 0 },
    // Lower speed traps
    { id: 'wm1', type: 'windmill', x: 250, y: 700, speed: 5 },
    { id: 'wm2', type: 'windmill', x: 550, y: 700, speed: -5 },
    // Final funnel
    { id: 'w5', type: 'wall', x: 250, y: 950, w: 400, h: 20, rotation: 40 },
    { id: 'w6', type: 'wall', x: 550, y: 950, w: 400, h: 20, rotation: -40 },
  ],
  'gravity_abyss': [
    // Zig-zag falling paths
    { id: 'w1', type: 'wall', x: 300, y: 200, w: 400, h: 20, rotation: 15 },
    { id: 'w2', type: 'wall', x: 500, y: 400, w: 400, h: 20, rotation: -15 },
    { id: 'w3', type: 'wall', x: 300, y: 600, w: 400, h: 20, rotation: 15 },
    // Massive blackhole in the middle pulling everything
    { id: 'bh1', type: 'blackhole', x: 400, y: 500, radius: 150, force: 150 },
    // Whiteholes pushing them away near the edges
    { id: 'wh1', type: 'whitehole', x: 150, y: 500, radius: 100, force: 100 },
    { id: 'wh2', type: 'whitehole', x: 650, y: 500, radius: 100, force: 100 },
    // Pins surrounding the drop
    { id: 'p1', type: 'pin', x: 400, y: 800, radius: 10 },
    { id: 'p2', type: 'pin', x: 350, y: 850, radius: 10 },
    { id: 'p3', type: 'pin', x: 450, y: 850, radius: 10 },
  ],
  'mechanical_factory': [
    // Heavy pistons (we use walls with high restitution to act as heavy bouncers for now)
    { id: 'w1', type: 'wall', x: 200, y: 300, w: 100, h: 50, rotation: 0, restitution: 2.0 },
    { id: 'w2', type: 'wall', x: 600, y: 300, w: 100, h: 50, rotation: 0, restitution: 2.0 },
    // Conveyor belt simulation (windmills)
    { id: 'wm1', type: 'windmill', x: 400, y: 500, speed: 10 },
    { id: 'wm2', type: 'windmill', x: 300, y: 650, speed: -8 },
    { id: 'wm3', type: 'windmill', x: 500, y: 650, speed: 8 },
    // Pinball bumpers array
    { id: 'bp1', type: 'bumper', x: 400, y: 800, radius: 20, restitution: 2.5 },
    { id: 'bp2', type: 'bumper', x: 250, y: 750, radius: 15, restitution: 2.0 },
    { id: 'bp3', type: 'bumper', x: 550, y: 750, radius: 15, restitution: 2.0 },
  ]
};

export function getPresetMap(presetKey: string): EditorItem[] | null {
  return MapPresets[presetKey] || null;
}
