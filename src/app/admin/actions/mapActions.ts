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

export async function toggleOfficialMap(mapId: string, isOfficial: boolean) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const { error } = await supabase
      .from('maps')
      .update({ is_official: isOfficial, updated_at: new Date().toISOString() })
      .eq('id', mapId)

    if (error) throw error

    revalidatePath('/admin/maps')
    return { success: true }
  } catch (error: any) {
    console.error('[toggleOfficialMap Error]:', error)
    return { success: false, error: error.message || '맵 상태 변경에 실패했습니다.' }
  }
}

export async function deleteCustomMap(mapId: string) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const { error } = await supabase
      .from('maps')
      .delete()
      .eq('id', mapId)

    if (error) throw error

    revalidatePath('/admin/maps')
    return { success: true }
  } catch (error: any) {
    console.error('[deleteCustomMap Error]:', error)
    return { success: false, error: error.message || '맵 삭제에 실패했습니다.' }
  }
}
