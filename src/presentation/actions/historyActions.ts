import { createClient } from '@/lib/supabase/client'

export async function logMapEditAction(mapId: string, actionType: string, actionDetails: any) {
  try {
    const supabase = createClient()
    
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { success: false, error: 'Not authenticated' }

    const { error } = await supabase.from('map_edit_history').insert({
      map_id: mapId,
      user_id: session.user.id,
      action_type: actionType,
      action_details: actionDetails
    })

    if (error) {
      console.error('Failed to log map edit action:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (err: any) {
    console.error('Error logging map edit action:', err)
    return { success: false, error: err.message }
  }
}
