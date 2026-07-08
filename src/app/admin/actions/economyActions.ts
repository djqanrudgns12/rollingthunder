'use server'

import { createClient } from '@/lib/supabase/server'
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

export async function getEconomyLogs(page: number = 1, limit: number = 50) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const offset = (page - 1) * limit

    const { data, error, count } = await supabase
      .from('chip_logs')
      .select('*, profiles(username, role)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return { success: true, data, count }
  } catch (error: any) {
    console.error('[getEconomyLogs Error]:', error)
    return { success: false, error: error.message || '경제 로그를 불러오는데 실패했습니다.' }
  }
}
