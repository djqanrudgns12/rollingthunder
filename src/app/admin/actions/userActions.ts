'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient, requireAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export type SortColumn = 'username' | 'role' | 'chips_balance' | 'created_at' | 'last_seen_at'
export type SortDirection = 'asc' | 'desc'

export async function getUsers(
  page: number = 1,
  limit: number = 50,
  searchQuery?: string,
  sortColumn: SortColumn = 'created_at',
  sortDirection: SortDirection = 'desc',
) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const offset = (page - 1) * limit

    // 검색+정렬+last_seen_at 을 profiles 테이블에서 직접 조회
    // auth.admin.listUsers() 의존을 제거하여 1000명 제한 버그 해소
    let query = supabase
      .from('profiles')
      .select('id, username, nickname, name, role, chips_balance, created_at, last_seen_at', { count: 'exact' })

    // 검색 필터: username, nickname, name 대상 (ilike 부분일치)
    // UUID(id)는 타입 캐스트(::text)를 PostgREST가 지원하지 않으므로,
    // UUID 형식인 경우에만 정확 일치(eq)로 추가한다.
    if (searchQuery && searchQuery.trim()) {
      const term = searchQuery.trim()
      const likeTerm = `%${term}%`
      const isUUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(term)

      let orFilter = `username.ilike.${likeTerm},nickname.ilike.${likeTerm},name.ilike.${likeTerm}`
      if (isUUID) {
        orFilter += `,id.eq.${term}`
      }
      query = query.or(orFilter)
    }

    const { data: profiles, error, count } = await query
      .order(sortColumn, { ascending: sortDirection === 'asc' })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return { success: true, data: profiles, count }
  } catch (error) {
    console.error('[getUsers Error]:', error)
    return { success: false, error: error instanceof Error ? error.message : '유저 목록을 불러오는데 실패했습니다.' }
  }
}

export async function deleteUserAccount(userId: string) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    // 관리자 인가 통과 시, 서비스 롤 클라이언트를 사용해 auth.users 에서 유저를 완전 삭제 (Hard Delete)
    const adminClient = createAdminClient()
    const { error } = await adminClient.auth.admin.deleteUser(userId)
    
    if (error) throw error

    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('[deleteUserAccount Error]:', error)
    return { success: false, error: error instanceof Error ? error.message : '계정 영구 삭제에 실패했습니다.' }
  }
}

export async function updateUserRole(userId: string, newRole: 'user' | 'premium' | 'admin') {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    // 021 마이그레이션부터 authenticated 롤은 role 컬럼 UPDATE 권한이 없으므로
    // (권한 상승 차단), 관리자 인가 후 서비스 롤 클라이언트로 수행한다.
    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) throw error

    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('[updateUserRole Error]:', error)
    return { success: false, error: error instanceof Error ? error.message : '권한 수정에 실패했습니다.' }
  }
}

export async function updateUserChips(userId: string, newChipsBalance: number) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    if (newChipsBalance < 0) {
      throw new Error('보유 칩은 0 이상이어야 합니다.')
    }

    // chips_balance는 authenticated 롤의 UPDATE 권한에서 제외된 컬럼이므로 서비스 롤로 수행
    const adminClient = createAdminClient()

    // 1. 프로필의 보유 칩 강제 수정
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ chips_balance: newChipsBalance, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (profileError) throw profileError

    // 2. 어드민 개입 로그 기록 (Audit) — 타인 user_id 행 삽입이므로 서비스 롤 필요
    const { error: logError } = await adminClient
      .from('chip_logs')
      .insert({
        user_id: userId,
        amount: 0, // 실제 획득이 아니라 세팅이므로, 필요에 따라 차액을 기록할 수도 있음
        reason: 'ADMIN_OVERRIDE_BALANCE_TO_' + newChipsBalance
      })

    if (logError) console.warn('Failed to insert admin chip log:', logError)

    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('[updateUserChips Error]:', error)
    return { success: false, error: error instanceof Error ? error.message : '칩 밸런스 수정에 실패했습니다.' }
  }
}
