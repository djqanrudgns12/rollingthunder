import { createClient } from '@/lib/supabase/server';
import { MapEntity } from '@/core/entities/Map';
import { DatabaseError } from '@/core/errors/AppError';

export class MapRepository {
  static async save(mapData: MapEntity): Promise<void> {
    const supabase = await createClient();
    
    // CamelCase를 SnakeCase로 변환하여 DB에 저장
    const { error } = await supabase
      .from('maps')
      .upsert({
        id: mapData.id,
        name: mapData.name,
        description: mapData.description,
        is_official: mapData.isOfficial ?? false,
        length_type: mapData.lengthType,
        complexity: mapData.complexity,
        world_height: mapData.worldHeight,
        wall_style: mapData.wallStyle,
        bg_image: mapData.bgImage,
        theme_weights: mapData.themeWeights,
        layout_config: mapData.layoutConfig,
        items: mapData.items,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      throw new DatabaseError(`맵 저장 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  static async findAll(): Promise<MapEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('maps')
      .select('*');

    if (error) {
      throw new DatabaseError(`맵 목록 조회 중 오류가 발생했습니다: ${error.message}`);
    }

    // SnakeCase를 CamelCase로 변환하여 반환
    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      description: row.description || '',
      isOfficial: row.is_official,
      lengthType: row.length_type as any,
      complexity: row.complexity as any,
      worldHeight: row.world_height,
      wallStyle: row.wall_style as any,
      bgImage: row.bg_image || undefined,
      themeWeights: row.theme_weights || {},
      layoutConfig: row.layout_config || {},
      items: row.items || [],
      updatedAt: new Date(row.updated_at)
    }));
  }

  static async setOfficial(mapId: string, isOfficial: boolean): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('maps')
      .update({ is_official: isOfficial })
      .eq('id', mapId);

    if (error) {
      throw new DatabaseError(`맵 배포 상태 업데이트 중 오류가 발생했습니다: ${error.message}`);
    }
  }
}
