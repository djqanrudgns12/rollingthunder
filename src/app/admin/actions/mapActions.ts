'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient, requireAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type MapSortColumn = 'name' | 'created_at' | 'download_count' | 'like_count' | 'is_published'
export type MapSortDirection = 'asc' | 'desc'
export type MapSource = 'official' | 'custom'

/** 관리자 맵 목록에서 사용하는 통합 맵 타입 */
export interface AdminMapEntry {
  id: string
  source: MapSource
  name: string
  description?: string | null
  length_type?: string | null
  complexity?: string | null
  creator_username: string
  is_published: boolean
  is_featured: boolean
  download_count: number
  like_count: number
  created_at: string
}

/**
 * 공식 프리셋 맵(maps) + 커스텀 맵(user_maps)을 통합 조회한다.
 * - maps 테이블: is_official=true인 공식 프리셋. FK 없으므로 creator='System'.
 * - user_maps 테이블: 유저 커스텀 맵. owner_id FK로 profiles.username 조인.
 * - 검색/정렬/페이지네이션 지원.
 */
export async function getAdminMaps(
  page: number = 1,
  limit: number = 50,
  searchQuery?: string,
  sortColumn: MapSortColumn = 'created_at',
  sortDirection: MapSortDirection = 'desc',
) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const offset = (page - 1) * limit

    // ── 1. user_maps (커스텀 맵) 조회 ──
    let userMapsQuery = supabase
      .from('user_maps')
      .select(
        'id, name, description, length_type, complexity, is_published, is_featured, download_count, like_count, created_at, owner_id, profiles!user_maps_owner_id_fkey(username)',
        { count: 'exact' },
      )

    if (searchQuery && searchQuery.trim()) {
      const likeTerm = `%${searchQuery.trim()}%`
      userMapsQuery = userMapsQuery.ilike('name', likeTerm)
    }

    const { data: userMaps, error: umError, count: umCount } = await userMapsQuery
      .order(sortColumn, { ascending: sortDirection === 'asc' })
      .range(offset, offset + limit - 1)

    if (umError) throw umError

    // ── 2. maps (공식 프리셋) 조회 ──
    let officialQuery = supabase
      .from('maps')
      .select('id, name, description, length_type, complexity, is_official, created_at', { count: 'exact' })

    if (searchQuery && searchQuery.trim()) {
      officialQuery = officialQuery.ilike('name', `%${searchQuery.trim()}%`)
    }

    const { data: officialMaps, error: omError, count: omCount } = await officialQuery
      .order('created_at', { ascending: false })

    if (omError) throw omError

    // ── 3. 통합 엔트리 구성 ──
    const entries: AdminMapEntry[] = []

    // 공식 프리셋 맵 추가
    if (officialMaps) {
      for (const m of officialMaps) {
        entries.push({
          id: m.id,
          source: 'official',
          name: m.name,
          description: m.description,
          length_type: m.length_type,
          complexity: m.complexity,
          creator_username: 'System',
          is_published: true, // 공식 맵은 항상 배포 상태
          is_featured: false,  // 공식 맵은 featured 불필요
          download_count: 0,
          like_count: 0,
          created_at: m.created_at,
        })
      }
    }

    // 커스텀 맵 추가
    if (userMaps) {
      for (const m of userMaps) {
        const profile = m.profiles as any
        entries.push({
          id: m.id,
          source: 'custom',
          name: m.name,
          description: m.description,
          length_type: m.length_type,
          complexity: m.complexity,
          creator_username: profile?.username || 'Unknown',
          is_published: m.is_published,
          is_featured: m.is_featured ?? false,
          download_count: m.download_count,
          like_count: m.like_count,
          created_at: m.created_at,
        })
      }
    }

    // 정렬 (공식+커스텀 합쳐서 클라이언트 사이드 정렬)
    const dir = sortDirection === 'asc' ? 1 : -1
    entries.sort((a, b) => {
      const aVal = a[sortColumn as keyof AdminMapEntry]
      const bVal = b[sortColumn as keyof AdminMapEntry]
      if (typeof aVal === 'string' && typeof bVal === 'string') return aVal.localeCompare(bVal) * dir
      if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir
      if (typeof aVal === 'boolean' && typeof bVal === 'boolean') return ((aVal ? 1 : 0) - (bVal ? 1 : 0)) * dir
      return 0
    })

    const totalCount = (omCount || 0) + (umCount || 0)

    return { success: true, data: entries, count: totalCount, officialCount: omCount || 0, customCount: umCount || 0 }
  } catch (error: any) {
    console.error('[getAdminMaps Error]:', error)
    return { success: false, error: error.message || '맵 목록을 불러오는데 실패했습니다.' }
  }
}

/**
 * user_maps의 배포 상태(is_published)를 토글한다.
 */
export async function toggleMapPublished(mapId: string, isPublished: boolean) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('user_maps')
      .update({
        is_published: isPublished,
        published_at: isPublished ? new Date().toISOString() : null,
      })
      .eq('id', mapId)

    if (error) throw error

    revalidatePath('/admin/maps')
    return { success: true }
  } catch (error: any) {
    console.error('[toggleMapPublished Error]:', error)
    return { success: false, error: error.message || '맵 배포 상태 변경에 실패했습니다.' }
  }
}

/**
 * user_maps의 추천 상태(is_featured)를 토글한다.
 */
export async function toggleMapFeatured(mapId: string, isFeatured: boolean) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('user_maps')
      .update({ is_featured: isFeatured })
      .eq('id', mapId)

    if (error) throw error

    revalidatePath('/admin/maps')
    return { success: true }
  } catch (error: any) {
    console.error('[toggleMapFeatured Error]:', error)
    return { success: false, error: error.message || '추천 상태 변경에 실패했습니다.' }
  }
}

/**
 * 맵을 강제 삭제한다.
 * - source='custom': user_maps에서 삭제 (FK CASCADE로 downloads, likes 자동 삭제)
 * - source='official': maps 테이블에서 삭제
 */
export async function deleteAdminMap(mapId: string, source: MapSource) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const adminClient = createAdminClient()
    const table = source === 'official' ? 'maps' : 'user_maps'
    const { error } = await adminClient
      .from(table)
      .delete()
      .eq('id', mapId)

    if (error) throw error

    revalidatePath('/admin/maps')
    return { success: true }
  } catch (error: any) {
    console.error('[deleteAdminMap Error]:', error)
    return { success: false, error: error.message || '맵 삭제에 실패했습니다.' }
  }
}
