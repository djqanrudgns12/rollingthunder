import { EditorItem } from '@/store/editorStore';

export interface KeepOutZone { x: number; y: number; r: number; }

export function computeKeepOutZones(items: EditorItem[]): KeepOutZone[] {
  const keepOuts: KeepOutZone[] = [];
  
  for (const item of items) {
    let r = item.radius || 15;
    
    if (item.type === 'wall') {
      const w = item.w || 100;
      const h = item.h || 20;
      r = Math.max(w, h) / 2;
    } else if (item.type === 'piston') {
      r = Math.max(item.w || 100, item.h || 20) / 2 + 50; // 이동 반경 감안
      // 원점과 도착점 모두 등록
      keepOuts.push({ x: item.x, y: item.y, r });
      if (item.waypointB) {
        keepOuts.push({ x: item.waypointB.x, y: item.waypointB.y, r });
      }
      continue;
    } else if (item.type === 'blackhole' || item.type === 'whitehole') {
      r = (item.radius || 150) * 0.8; // 중심부 가까이만 keep-out
    } else if (item.type === 'windmill') {
      r = 70; // 블레이드 반경
    }
    
    keepOuts.push({ x: item.x, y: item.y, r });
  }
  
  return keepOuts;
}

export function findSafePositions(
  keepOuts: KeepOutZone[],
  count: number,
  worldWidth: number,
  worldHeight: number,
  rng: () => number,
  minSpacing: number = 40
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const MAX_ATTEMPTS = 100;
  
  const isSafe = (x: number, y: number, r: number) => {
    // 보호 구역 (스폰존, 결승선 직전)
    if (y < 200 || y > worldHeight - 200) return false;
    
    // keep-out 충돌
    for (const k of keepOuts) {
      const dx = x - k.x;
      const dy = y - k.y;
      const distSq = dx * dx + dy * dy;
      const reqDist = k.r + r + 30; // 30px 여유 공간
      if (distSq < reqDist * reqDist) return false;
    }
    
    // 새로 생성된 좌표 간 충돌
    for (const p of positions) {
      const dx = x - p.x;
      const dy = y - p.y;
      const distSq = dx * dx + dy * dy;
      const reqDist = r * 2;
      if (distSq < reqDist * reqDist) return false;
    }
    
    return true;
  };
  
  for (let i = 0; i < count; i++) {
    let placed = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const x = 70 + rng() * (worldWidth - 140);
      const y = 200 + rng() * (worldHeight - 400);
      
      if (isSafe(x, y, minSpacing)) {
        positions.push({ x, y });
        placed = true;
        break;
      }
    }
  }
  
  return positions;
}
