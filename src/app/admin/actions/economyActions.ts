'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getEconomyLogs(
  page: number = 1, 
  limit: number = 50, 
  searchQuery: string = '', 
  sortBy: string = 'created_at', 
  sortOrder: 'asc' | 'desc' = 'desc'
) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const offset = (page - 1) * limit

    let query = supabase
      .from('chip_logs')
      .select('*, profiles!inner(username, role)', { count: 'exact' })
      .range(offset, offset + limit - 1)

    // 1. 검색 (username 혹은 user_id)
    if (searchQuery) {
      // UUID 포맷인지 간단 확인
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchQuery);
      if (isUUID) {
        query = query.eq('user_id', searchQuery);
      } else {
        query = query.ilike('profiles.username', `%${searchQuery}%`);
      }
    }

    // 2. 정렬
    if (sortBy === 'username') {
      // profiles 테이블의 username 기준 정렬 (supabase-js 최신 버전 지원)
      query = query.order('username', { foreignTable: 'profiles', ascending: sortOrder === 'asc' });
    } else {
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    }

    const { data, error, count } = await query;

    if (error) throw error

    return { success: true, data, count }
  } catch (error: any) {
    console.error('[getEconomyLogs Error]:', error)
    return { success: false, error: error.message || '경제 로그를 불러오는데 실패했습니다.' }
  }
}
