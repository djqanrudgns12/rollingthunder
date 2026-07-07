import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'

// 싱글톤이므로 모듈 스코프에서 한 번만 가져옴 — 매 렌더마다 참조가 바뀌지 않아
// useEffect 의존성 배열이 불필요하게 재실행되는 것을 방지
const supabase = createClient()

export function useRosterSync() {
  const { participants, setParticipants, globalSkin, setGlobalSkin } = useGameStore()
  const { isLoggedIn } = useUIStore()
  
  const isFirstLoad = useRef(true)
  const isSyncingFromServer = useRef(false)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isLoggedIn) return

    // cleanup이 먼저 실행된 경우 모든 비동기 작업을 차단하기 위한 플래그
    let aborted = false

    // cleanup에서 비동기 콜백 완료 전후 모두 안전하게 채널을 제거하기 위해
    // 채널 이름을 동기적으로 확정해 둔다
    const channelName = `user-roster-changes-${crypto.randomUUID()}`

    // 비동기 콜백 안에서 생성된 채널 참조를 저장 (이 effect 인스턴스 전용)
    let channel: ReturnType<typeof supabase.channel> | null = null

    // 1. 초기 로드 시 서버에서 현재 Roster 가져오기
    const loadCurrentRoster = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session?.user?.id) return

        // select('*') 사용: global_skin 마이그레이션(013) 적용 전 DB에서도
        // 컬럼 지정 select 오류 없이 로스터 로드가 동작하도록 함
        const { data, error } = await supabase
          .from('user_current_roster')
          .select('*')
          .eq('user_id', sessionData.session.user.id)
          .single()

        if (!error && data?.participants) {
          isSyncingFromServer.current = true
          // 로컬 훼손을 최소화하면서 서버 데이터를 우선적으로 보여주기 위해 setParticipants 수행
          setParticipants(data.participants)
          // 서버에 저장된 스킨 일괄 설정이 있으면 드롭다운(globalSkin)도 함께 복원
          if (data.global_skin) {
            setGlobalSkin(data.global_skin)
          }

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
    // 채널 생성 → .on() → .subscribe()를 하나의 체인으로 묶어
    // "subscribe() 이후 .on() 호출" 문제를 원천 차단
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      // cleanup이 이미 실행되었으면 새 채널을 절대 만들지 않음
      if (aborted || !session?.user?.id) return
      
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_current_roster',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload: any) => {
            // cleanup 후에 도착한 메시지는 무시
            if (aborted) return
            if (payload.new && 'participants' in payload.new) {
              isSyncingFromServer.current = true
              setParticipants(payload.new.participants)
              if (payload.new.global_skin) {
                setGlobalSkin(payload.new.global_skin)
              }
              setTimeout(() => {
                isSyncingFromServer.current = false
              }, 100)
            }
          }
        )
        .subscribe()
    })

    return () => {
      // 비동기 콜백이 아직 실행 전이면 구독 자체를 막음
      aborted = true

      // case 1: 비동기 콜백이 이미 완료되어 channel이 존재하는 경우
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }

      // case 2: 비동기 콜백이 아직 완료되지 않은 경우
      // → aborted 플래그로 인해 콜백 내에서 채널 생성 자체가 차단됨
      // → 별도 처리 불필요
    }
  }, [isLoggedIn, setParticipants, setGlobalSkin])

  // 3. 로컬 participants/globalSkin 변경 시 서버로 동기화 (디바운스 적용)
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
          global_skin: globalSkin || 'skin_chip_base',
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
  }, [participants, globalSkin, isLoggedIn])
}
