import { MapEntity } from '@/core/entities/Map';
import { MapRepository } from '@/infrastructure/supabase/mapRepository';
import { MapPresets, MapPresetMeta, DEFAULT_THEME_WEIGHTS } from '@/engine/MapPresets';

export class GetMapsUseCase {
  static async execute(): Promise<Record<string, MapPresetMeta>> {
    try {
      const maps = await MapRepository.findAll();
      const dynamicMaps: Record<string, MapPresetMeta> = { ...MapPresets };
      
      for (const map of maps) {
        // 불변식: 엔진 기본 프리셋 id 는 항상 공식맵이며 [커스텀] 말머리를 갖지 않는다.
        // 과거에 잘못 저장된 DB 행도 읽는 시점에 교정한다(무마이그레이션 자가 치유).
        const isPreset = !!MapPresets[map.id];
        dynamicMaps[map.id] = {
          name: isPreset ? map.name.replace(/^\[커스텀\]\s*/, '') : map.name,
          description: map.description || '',
          isOfficial: isPreset ? true : map.isOfficial,
          lengthType: map.lengthType,
          complexity: map.complexity,
          worldHeight: map.worldHeight,
          wallStyle: map.wallStyle,
          bgImage: map.bgImage,
          themeWeights: { ...DEFAULT_THEME_WEIGHTS, ...map.themeWeights },
          layoutConfig: { endMarginPercent: 0.02, spawnGap: 50, ...map.layoutConfig },
          items: map.items.length > 0 ? map.items : (MapPresets[map.id]?.items || [])
        };
      }
      return dynamicMaps;
    } catch (error) {
      console.error('GetMapsUseCase failed, using fallback:', error);
      return MapPresets;
    }
  }
}
