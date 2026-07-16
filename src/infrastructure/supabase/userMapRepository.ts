import { createClient } from '@/lib/supabase/server';
import { UserMapEntity, UserMapDownloadEntity } from '@/core/entities/UserMap';
import { DatabaseError } from '@/core/errors/AppError';

export type StoreSort = 'popular' | 'latest';

function rowToEntity(row: any): UserMapEntity {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description || '',
    lengthType: row.length_type,
    complexity: row.complexity,
    worldHeight: row.world_height,
    wallStyle: row.wall_style,
    bgImage: row.bg_image || undefined,
    themeWeights: row.theme_weights || {},
    layoutConfig: row.layout_config || {},
    items: row.items || [],
    schemaVersion: row.schema_version ?? 1,
    isPublished: row.is_published,
    publishedAt: row.published_at ? new Date(row.published_at) : undefined,
    validationSummary: row.validation_summary || undefined,
    downloadCount: row.download_count ?? 0,
    likeCount: row.like_count ?? 0,
    creatorName: row.profiles ? (row.profiles.name || row.profiles.username || '알 수 없음') : undefined,
    createdAt: row.created_at ? new Date(row.created_at) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
  };
}

export class UserMapRepository {
  /** insert(신규) 또는 update(기존 소유 맵). 저장된 맵 id 반환. */
  static async save(map: Partial<UserMapEntity> & { ownerId: string }): Promise<string> {
    const supabase = await createClient();
    const payload = {
      owner_id: map.ownerId,
      name: map.name,
      description: map.description || '',
      length_type: map.lengthType || 'Middle',
      complexity: map.complexity || 'Medium',
      world_height: map.worldHeight || 2400,
      wall_style: map.wallStyle || 'straight',
      bg_image: map.bgImage ?? null,
      theme_weights: map.themeWeights || {},
      layout_config: map.layoutConfig || {},
      items: map.items || [],
      schema_version: map.schemaVersion ?? 1,
    };

    if (map.id) {
      const { error } = await supabase
        .from('user_maps')
        .update(payload)
        .eq('id', map.id)
        .eq('owner_id', map.ownerId);
      if (error) {
        throw new DatabaseError(`맵 저장 중 오류가 발생했습니다: ${error.message}`);
      }
      return map.id;
    }

    const { data, error } = await supabase
      .from('user_maps')
      .insert(payload)
      .select('id')
      .single();
    if (error) {
      // DB 트리거(슬롯 제한)의 예외 메시지를 사용자 친화적으로 변환
      if (error.message.includes('MAP_SLOT_LIMIT')) {
        throw new DatabaseError('맵 슬롯이 가득 찼습니다. (최대 10개)');
      }
      throw new DatabaseError(`맵 저장 중 오류가 발생했습니다: ${error.message}`);
    }
    return data.id;
  }

  static async findByOwner(ownerId: string): Promise<UserMapEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_maps')
      .select('*')
      .eq('owner_id', ownerId)
      .order('updated_at', { ascending: false });
    if (error) {
      throw new DatabaseError(`내 맵 조회 중 오류가 발생했습니다: ${error.message}`);
    }
    return (data || []).map(rowToEntity);
  }

  static async findById(id: string): Promise<UserMapEntity | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_maps')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new DatabaseError(`맵 조회 중 오류가 발생했습니다: ${error.message}`);
    }
    return data ? rowToEntity(data) : null;
  }

  static async countByOwner(ownerId: string): Promise<number> {
    const supabase = await createClient();
    const { count, error } = await supabase
      .from('user_maps')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId);
    if (error) {
      throw new DatabaseError(`맵 개수 조회 중 오류가 발생했습니다: ${error.message}`);
    }
    return count || 0;
  }

  static async delete(id: string, ownerId: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('user_maps')
      .delete()
      .eq('id', id)
      .eq('owner_id', ownerId);
    if (error) {
      throw new DatabaseError(`맵 삭제 중 오류가 발생했습니다: ${error.message}`);
    }
  }

  /** 스토어 목록: 배포된 맵 + 제작자 표시명 조인 */
  static async findPublished(options: { sort: StoreSort; limit?: number }): Promise<UserMapEntity[]> {
    const supabase = await createClient();
    let query = supabase
      .from('user_maps')
      // FK 힌트 필수: user_map_likes(맵♥유저)가 user_maps↔profiles 다대다 경로를 만들어
      // 무힌트 임베드는 PGRST201(관계 모호)로 실패한다 → owner_id FK로 명시.
      .select('*, profiles!user_maps_owner_id_fkey(name, username)')
      .eq('is_published', true)
      .limit(options.limit ?? 60);

    if (options.sort === 'popular') {
      query = query.order('download_count', { ascending: false }).order('published_at', { ascending: false });
    } else {
      query = query.order('published_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) {
      throw new DatabaseError(`스토어 맵 조회 중 오류가 발생했습니다: ${error.message}`);
    }
    return (data || []).map(rowToEntity);
  }

  static async publish(id: string, validationSummary: any): Promise<void> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_maps')
      .update({
        is_published: true,
        published_at: new Date().toISOString(),
        validation_summary: validationSummary,
        validated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id')
      .single();
    if (error) {
      throw new DatabaseError(`맵 배포 중 오류가 발생했습니다: ${error.message}`);
    }
    if (!data) {
      throw new DatabaseError('맵 배포에 실패했습니다. 대상 맵을 찾을 수 없거나 권한이 부족합니다.');
    }
  }

  /**
   * 다운로드 RPC 호출 — 서버에서 원자적으로 처리:
   * 스냅샷 기록 + (최초·비소유자면) 다운로더 100칩 차감 → 제작자 100칩 지급.
   * 잔액 부족 시 RPC 가 예외를 던지고 전체 롤백된다.
   */
  static async download(mapId: string): Promise<{
    name: string; creatorName: string; firstDownload: boolean; charged: boolean; newBalance: number | null;
  }> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('download_user_map', { p_map_id: mapId });
    if (error) {
      if (error.message.includes('Insufficient chips_balance')) {
        throw new DatabaseError('칩이 부족합니다. (다운로드 비용: 100칩)');
      }
      if (error.message.includes('MAP_NOT_FOUND')) {
        throw new DatabaseError('배포된 맵을 찾을 수 없습니다.');
      }
      throw new DatabaseError(`맵 다운로드 중 오류가 발생했습니다: ${error.message}`);
    }
    return {
      name: data.name,
      creatorName: data.creatorName,
      firstDownload: data.firstDownload,
      charged: data.charged,
      newBalance: data.newBalance,
    };
  }

  static async findDownloads(userId: string): Promise<UserMapDownloadEntity[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_map_downloads')
      .select('*')
      .eq('user_id', userId)
      .order('downloaded_at', { ascending: false });
    if (error) {
      throw new DatabaseError(`다운로드한 맵 조회 중 오류가 발생했습니다: ${error.message}`);
    }
    return (data || []).map((row) => ({
      id: row.id,
      sourceMapId: row.source_map_id,
      mapName: row.map_name,
      creatorName: row.creator_name,
      snapshot: row.snapshot,
      downloadedAt: new Date(row.downloaded_at),
    }));
  }

  static async toggleLike(mapId: string): Promise<{ liked: boolean; likeCount: number }> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc('toggle_user_map_like', { p_map_id: mapId });
    if (error) {
      throw new DatabaseError(`좋아요 처리 중 오류가 발생했습니다: ${error.message}`);
    }
    return { liked: data.liked, likeCount: data.likeCount };
  }

  /** 현재 유저가 좋아요한 맵 id 목록 (스토어 ♥ 상태 표시용) */
  static async findLikedMapIds(userId: string): Promise<string[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_map_likes')
      .select('map_id')
      .eq('user_id', userId);
    if (error) {
      throw new DatabaseError(`좋아요 목록 조회 중 오류가 발생했습니다: ${error.message}`);
    }
    return (data || []).map((r) => r.map_id);
  }
}
