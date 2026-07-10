import { EditorItem, EditorItemType } from '@/store/editorStore';
import { ThemeWeights } from './MapPresets';
import { classifyItems } from './GimmickClassifier';
import { calculateDensity } from './DensityCalculator';
import { computeKeepOutZones, findSafePositions } from './SafePlacement';

// 32비트 시드 -> 결정론적 난수 스트림 (0~1)
function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// 문자열 시드 -> 숫자 변환
function hashSeed(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return hash >>> 0;
}

// 배열 셔플 (결정론적)
function shuffle<T>(array: T[], rng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function applyDensity(
  baseItems: EditorItem[],
  density: number,
  worldHeight: number,
  themeWeights: ThemeWeights,
  mapKey: string
): EditorItem[] {
  const seedNum = hashSeed(`${mapKey}_${density}`);
  const rng = mulberry32(seedNum);

  const { skeleton, fillers } = classifyItems(baseItems);
  const densityResult = calculateDensity(density, fillers.length, worldHeight, themeWeights);

  let finalFillers: EditorItem[] = [];

  // --- 간솎기 (Density <= 50) ---
  if (densityResult.survivalRate < 1.0) {
    const survivalCount = Math.ceil(fillers.length * densityResult.survivalRate);
    
    // 포탈 그룹화 및 보존 우선순위에 따른 분류
    const portalsByColor: Record<string, EditorItem[]> = {};
    const otherFillers: { item: EditorItem, priority: number }[] = [];
    
    const TYPE_PRIORITY: Record<string, number> = {
      blackhole: 1, whitehole: 1, windmill: 2, booster: 3, windcannon: 3, luckygate: 3, speedgate: 3, slowgate: 3, flipper: 4, piston: 4, spinner: 4, iceblock: 4, bumper: 5, pin: 6, hole: 6
    };

    for (const f of fillers) {
      if (f.type === 'portal' && f.color) {
        if (!portalsByColor[f.color]) portalsByColor[f.color] = [];
        portalsByColor[f.color].push(f);
      } else {
        otherFillers.push({ item: f, priority: TYPE_PRIORITY[f.type] || 5 });
      }
    }

    // 최소 보장 (원본에 있을 경우 1개씩 강제 보장)
    const guaranteed: EditorItem[] = [];
    const needed = { blackhole: 1, whitehole: 1, windmill: 1, booster: 1, windcannon: 1, luckygate: 1, speedgate: 1, slowgate: 1, piston: 1, spinner: 1, flipper: 1 };
    
    // 우선순위 정렬 (숫자가 낮을수록 높음)
    otherFillers.sort((a, b) => a.priority - b.priority);

    const remainingFillers = [];
    for (const f of otherFillers) {
      const type = f.item.type as keyof typeof needed;
      if (needed[type] > 0) {
        guaranteed.push(f.item);
        needed[type]--;
      } else {
        remainingFillers.push(f.item);
      }
    }

    // 포탈 쌍을 그룹으로 셔플 (1개의 요소로 취급)
    const portalGroups = Object.values(portalsByColor);
    const shuffledPortals = shuffle(portalGroups, rng);
    
    // 나머지 필러 셔플
    const shuffledRemaining = shuffle(remainingFillers, rng);
    
    // 순서: guaranteed -> shuffledPortals -> shuffledRemaining
    let currentCount = guaranteed.length;
    finalFillers.push(...guaranteed);
    
    for (const group of shuffledPortals) {
      if (currentCount + group.length <= survivalCount) {
        finalFillers.push(...group);
        currentCount += group.length;
      }
    }
    
    for (const item of shuffledRemaining) {
      if (currentCount < survivalCount) {
        finalFillers.push(item);
        currentCount++;
      }
    }

  } else {
    // --- 유지 및 추가 주입 (Density > 50) ---
    finalFillers = [...fillers];
    
    const keepOuts = computeKeepOutZones(baseItems);
    const positions = findSafePositions(keepOuts, densityResult.injectionCount, 800, worldHeight, rng);
    
    let posIdx = 0;
    let injectedPortalCount = 0;
    let portalId = 0;
    const portalColors = ['#ff00ff', '#00ffff', '#ffff00', '#00ff00', '#ff0000'];

    const types = Object.keys(densityResult.injectionMix) as EditorItemType[];
    
    for (const type of types) {
      let count = densityResult.injectionMix[type] ?? 0;
      while (count > 0 && posIdx < positions.length) {
        const pos = positions[posIdx++];
        
        const item: EditorItem = {
          id: `inj_${type}_${posIdx}`,
          type,
          x: pos.x,
          y: pos.y
        };

        if (type === 'pin') item.radius = 8;
        else if (type === 'bumper') { item.radius = 14; item.restitution = 1.4; }
        else if (type === 'booster') { item.rotation = 180; item.power = 2; }
        else if (type === 'blackhole') { item.radius = 120; item.force = 3; }
        else if (type === 'whitehole') { item.radius = 110; item.force = 4; }
        else if (type === 'hole') { item.radius = 26; }
        else if (type === 'windmill') { item.speed = (rng() > 0.5 ? 1 : -1) * (5 + rng() * 4); }
        else if (type === 'portal') {
          // 포탈은 쌍으로 추가
          const colorIdx = Math.floor(injectedPortalCount / 2) % portalColors.length;
          item.color = portalColors[colorIdx];
          item.id = `inj_portal_${portalId++}`;
          injectedPortalCount++;
        }

        finalFillers.push(item);
        count--;
      }
    }
  }

  return [...skeleton, ...finalFillers];
}
