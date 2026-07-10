import { EditorItemType } from '@/store/editorStore';
import { ThemeWeights } from './MapPresets';

export interface DensityResult {
  survivalRate: number;
  injectionCount: number;
  injectionMix: Partial<Record<EditorItemType, number>>;
}

export function calculateDensity(
  density: number,
  fillerCount: number,
  worldHeight: number,
  themeWeights: ThemeWeights
): DensityResult {
  let survivalRate = 1.0;
  let injectionCount = 0;
  const injectionMix: Partial<Record<EditorItemType, number>> = {
    pin: 0, bumper: 0, booster: 0, portal: 0, blackhole: 0, whitehole: 0, hole: 0, windmill: 0, wall: 0, piston: 0, spinner: 0
  };

  const clampedDensity = Math.max(10, Math.min(90, density));

  if (clampedDensity <= 50) {
    survivalRate = clampedDensity / 50;
  } else {
    survivalRate = 1.0;
    const scaleFactor = worldHeight / 2700;
    injectionCount = Math.ceil(fillerCount * ((clampedDensity - 50) / 50) * scaleFactor);
    
    let remaining = injectionCount;
    const keys = Object.keys(themeWeights) as (keyof ThemeWeights)[];
    
    for (const key of keys) {
      const count = Math.round(injectionCount * (themeWeights[key] ?? 0));
      injectionMix[key] = count;
      remaining -= count;
    }

    if (remaining !== 0) {
      injectionMix['pin'] = Math.max(0, (injectionMix['pin'] ?? 0) + remaining);
    }

    // 포탈은 쌍(짝수)으로만 주입 가능
    if ((injectionMix['portal'] ?? 0) % 2 !== 0) {
      injectionMix['portal'] = (injectionMix['portal'] ?? 0) - 1;
      injectionMix['pin'] = (injectionMix['pin'] ?? 0) + 1;
    }
  }

  return { survivalRate, injectionCount, injectionMix };
}
