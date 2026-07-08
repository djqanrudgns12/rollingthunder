'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function getMaps(page: number = 1, limit: number = 50) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const offset = (page - 1) * limit

    const { data: maps, error, count } = await supabase
      .from('maps')
      .select('*, profiles!inner(username)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return { success: true, data: maps, count }
  } catch (error: any) {
    console.error('[getMaps Error]:', error)
    return { success: false, error: error.message || '맵 목록을 불러오는데 실패했습니다.' }
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
