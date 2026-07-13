'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient, requireAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getUsers(page: number = 1, limit: number = 50) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const offset = (page - 1) * limit

    const { data: profiles, error, count } = await supabase
      .from('profiles')
      .select('id, username, role, chips_balance, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    // Fetch auth.users to get last_sign_in_at
    const adminClient = createAdminClient()
    const { data: authData, error: authError } = await adminClient.auth.admin.listUsers()
    
    const authUsersMap = new Map()
    if (!authError && authData?.users) {
      authData.users.forEach(u => authUsersMap.set(u.id, u.last_sign_in_at))
    }

    const usersWithLastSignIn = profiles?.map(p => ({
      ...p,
      last_sign_in_at: authUsersMap.get(p.id) || null
    }))

    return { success: true, data: usersWithLastSignIn, count }
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
