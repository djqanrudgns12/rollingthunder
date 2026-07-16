'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * 로그인된 유저의 last_seen_at을 주기적으로 갱신하는 훅.
 *
 * 동작 방식:
 * 1. 마운트 시 즉시 한 번 touch_last_seen() RPC 호출
 * 2. 이후 SYNC_INTERVAL_MS(5분) 간격으로 반복 호출
 * 3. 탭이 비활성→활성 전환 시 마지막 갱신으로부터 SYNC_INTERVAL_MS 이상 경과했으면 즉시 호출
 * 4. 세션이 없으면(비로그인) 모든 동작 스킵
 */

const SYNC_INTERVAL_MS = 5 * 60 * 1000 // 5분

export default function LastSeenSync() {
  const lastSyncRef = useRef<number>(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function touchLastSeen() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return

        await supabase.rpc('touch_last_seen')
        lastSyncRef.current = Date.now()
      } catch {
        // 네트워크 오류 등은 조용히 무시 — 다음 주기에 재시도
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastSyncRef.current
        if (elapsed >= SYNC_INTERVAL_MS) {
          touchLastSeen()
        }
      }
    }

    // 1. 마운트 시 즉시 갱신
    touchLastSeen()

    // 2. 5분 간격 반복
    intervalRef.current = setInterval(touchLastSeen, SYNC_INTERVAL_MS)

    // 3. 탭 활성화 시 갱신
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // UI를 렌더링하지 않는 순수 사이드이펙트 컴포넌트
  return null
}
