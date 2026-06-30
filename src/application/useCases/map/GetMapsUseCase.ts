import { MapEntity } from '@/core/entities/Map';
import { MapRepository } from '@/infrastructure/supabase/mapRepository';
import { MapPresets, MapPresetMeta } from '@/engine/MapPresets';

export class GetMapsUseCase {
  static async execute(): Promise<Record<string, MapPresetMeta>> {
    try {
      const maps = await MapRepository.findAll();
      const dynamicMaps: Record<string, MapPresetMeta> = { ...MapPresets };
      
      for (const map of maps) {
        dynamicMaps[map.id] = {
          name: map.name,
          description: map.description || '',
          lengthType: map.lengthType,
          complexity: map.complexity,
          worldHeight: map.worldHeight,
          wallStyle: map.wallStyle,
          bgImage: map.bgImage,
          themeWeights: map.themeWeights || {},
          layoutConfig: map.layoutConfig || {},
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
