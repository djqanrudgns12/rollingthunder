'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

// 공통된 관리자 권한 확인 헬퍼
async function requireAdmin(supabase: any) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (error || profile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required')
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
  } catch (error: any) {
    console.error('[deleteUserAccount Error]:', error)
    return { success: false, error: error.message || '계정 영구 삭제에 실패했습니다.' }
  }
}

export async function updateUserRole(userId: string, newRole: 'user' | 'premium' | 'admin') {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) throw error

    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    console.error('[updateUserRole Error]:', error)
    return { success: false, error: error.message || '권한 수정에 실패했습니다.' }
  }
}

export async function updateUserChips(userId: string, newChipsBalance: number) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    if (newChipsBalance < 0) {
      throw new Error('보유 칩은 0 이상이어야 합니다.')
    }

    // 1. 프로필의 보유 칩 강제 수정
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ chips_balance: newChipsBalance, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (profileError) throw profileError

    // 2. 어드민 개입 로그 기록 (Audit)
    const { error: logError } = await supabase
      .from('chip_logs')
      .insert({
        user_id: userId,
        amount: 0, // 실제 획득이 아니라 세팅이므로, 필요에 따라 차액을 기록할 수도 있음
        reason: 'ADMIN_OVERRIDE_BALANCE_TO_' + newChipsBalance
      })

    if (logError) console.warn('Failed to insert admin chip log:', logError)

    revalidatePath('/admin')
    return { success: true }
  } catch (error: any) {
    console.error('[updateUserChips Error]:', error)
    return { success: false, error: error.message || '칩 밸런스 수정에 실패했습니다.' }
  }
}
