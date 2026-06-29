import { createClient } from '@supabase/supabase-js'
import { MapPresets, MapPresetMeta } from '@/engine/MapPresets'

// 브라우저 및 클라이언트 환경을 위한 Supabase 클라이언트 설정
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * DB에서 맵 데이터를 동적으로 불러옵니다.
 * DB 오류나 네트워크 단절 시, MapPresets.ts의 로컬 하드코딩 데이터를 Fallback으로 반환합니다.
 */
export async function fetchMapPresets(): Promise<Record<string, MapPresetMeta>> {
  try {
    const { data, error } = await supabase
      .from('maps')
      .select('*')

    if (error) {
      console.warn('Supabase DB에서 맵을 불러오는 데 실패했습니다. 로컬 Fallback을 사용합니다.', error.message)
      return MapPresets
    }

    if (!data || data.length === 0) {
      console.warn('DB에 등록된 맵이 없습니다. 로컬 Fallback을 사용합니다.')
      return MapPresets
    }

    // DB 스키마(snake_case)를 TypeScript 객체(camelCase)로 변환
    // 기본 프리셋(MapPresets) 위에 DB에서 수정한 내용을 덮어씁니다.
    const dynamicMaps: Record<string, MapPresetMeta> = { ...MapPresets }
    data.forEach(row => {
      dynamicMaps[row.id] = {
        name: row.name,
        description: row.description || '',
        lengthType: row.length_type as any,
        complexity: row.complexity as any,
        worldHeight: row.world_height || 2400,
        wallStyle: row.wall_style as any,
        bgImage: row.bg_image,
        themeWeights: row.theme_weights || {},
        layoutConfig: row.layout_config || {},
        // DB에 items가 없거나 비어있다면 로컬 프리셋 데이터(MapPresets)를 우선 사용 (맵 에디터 데이터 유실 방지)
        items: (row.items && Array.isArray(row.items) && row.items.length > 0) 
                ? row.items 
                : (MapPresets[row.id]?.items || [])
      }
    })

    console.log('✅ Supabase DB에서 맵 데이터를 성공적으로 불러왔습니다.', Object.keys(dynamicMaps))
    return dynamicMaps

  } catch (err) {
    console.error('MapFetcher 예외 발생. 로컬 Fallback을 사용합니다.', err)
    return MapPresets
  }
}

export async function saveMapData(mapId: string, mapMeta: MapPresetMeta): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('maps')
      .upsert({
        id: mapId,
        items: mapMeta.items,
        world_height: mapMeta.worldHeight,
        name: mapMeta.name,
        description: mapMeta.description,
        length_type: mapMeta.lengthType,
        complexity: mapMeta.complexity,
        wall_style: mapMeta.wallStyle,
        bg_image: mapMeta.bgImage,
        theme_weights: mapMeta.themeWeights,
        layout_config: mapMeta.layoutConfig
      }, { onConflict: 'id' })
      
    if (error) {
      console.error('맵 데이터 저장 실패:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('saveMapData 예외 발생:', err)
    return false
  }
}
