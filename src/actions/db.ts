'use server'

import { createClient } from '@/lib/supabase/server'

// 데이터베이스 접근은 오로지 이 파일(Server Actions)을 통해서만 이루어집니다.
// 프론트엔드 직접 접근 금지 원칙 준수

export async function createSession(title: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { data, error } = await supabase
    .from('sessions')
    .insert({ user_id: user.id, title, status: 'pending' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function saveParticipants(sessionId: string, participants: any[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { error } = await supabase
    .from('participants')
    .insert(
      participants.map(p => ({
        session_id: sessionId,
        name: p.name,
        color: p.color,
        icon_url: p.iconUrl,
        skin_id: p.skinId
      }))
    )

  if (error) throw error
}

export async function saveResults(sessionId: string, results: any[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Unauthorized")

  const { error } = await supabase
    .from('results')
    .insert(
      results.map(r => ({
        session_id: sessionId,
        participant_id: r.participantId,
        rank: r.rank,
        score: r.score
      }))
    )

  if (error) throw error
}
