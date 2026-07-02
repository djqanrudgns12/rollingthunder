import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'

export function useRosterSync() {
  const supabase = createClient()
  const { participants, setParticipants } = useGameStore()
  const { isLoggedIn } = useUIStore()
  
  const isFirstLoad = useRef(true)
  const isSyncingFromServer = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isLoggedIn) return

    // 1. 초기 로드 시 서버에서 현재 Roster 가져오기
    const loadCurrentRoster = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session?.user?.id) return

        const { data, error } = await supabase
          .from('user_current_roster')
          .select('participants')
          .eq('user_id', sessionData.session.user.id)
          .single()

        if (!error && data?.participants) {
          isSyncingFromServer.current = true
          // 로컬 훼손을 최소화하면서 서버 데이터를 우선적으로 보여주기 위해 setParticipants 수행
          setParticipants(data.participants)
          
          // 상태 변경 감지에 의한 무한루프 방지
          setTimeout(() => {
            isSyncingFromServer.current = false
          }, 100)
        }
      } catch (err) {
        console.error('Failed to load current roster', err)
      }
      isFirstLoad.current = false
    }

    loadCurrentRoster()

    // 2. Realtime 구독 설정
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (!session?.user?.id) return;
      
      channel = supabase
        .channel('user-roster-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_current_roster',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload: any) => {
            if (payload.new && 'participants' in payload.new) {
              isSyncingFromServer.current = true
              setParticipants(payload.new.participants)
              setTimeout(() => {
                isSyncingFromServer.current = false
              }, 100)
            }
          }
        )
        .subscribe()
    })

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [isLoggedIn, supabase, setParticipants])

  // 3. 로컬 participants 변경 시 서버로 동기화 (디바운스 적용)
  useEffect(() => {
    if (!isLoggedIn || isFirstLoad.current || isSyncingFromServer.current) return

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current)
    }

    debounceTimer.current = setTimeout(async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session?.user?.id) return

        // Upsert를 사용하여 레코드가 없으면 삽입, 있으면 업데이트
        await supabase.from('user_current_roster').upsert({
          user_id: sessionData.session.user.id,
          participants: participants,
          updated_at: new Date().toISOString()
        })
      } catch (e) {
        console.error('Failed to sync roster to server', e)
      }
    }, 1500) // 1.5초 디바운스

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [participants, isLoggedIn, supabase])
}
