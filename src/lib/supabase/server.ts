import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient(keepLoggedIn?: boolean) {
  const cookieStore = await cookies()
  
  // 쿠키에서 기존 로그인 유지 설정 확인
  // 주의: src/middleware.ts 에서도 이 쿠키 값을 읽어 세션 갱신 시 만료 시간을 조절합니다.
  const isKeepLoggedIn = keepLoggedIn ?? (cookieStore.get('keep_logged_in')?.value !== 'false')

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              const cookieOptions = { ...options }
              
              // 로그인 상태 유지가 아닐 경우, 세션 쿠키로 만들기 위해 만료 시간 제거
              if (!isKeepLoggedIn) {
                delete cookieOptions.maxAge
                delete cookieOptions.expires
              }
              
              cookieStore.set(name, value, cookieOptions)
            })
            
            // 로그인 상태 유지 옵션 자체를 쿠키에 저장
            if (keepLoggedIn !== undefined) {
              if (keepLoggedIn) {
                cookieStore.set('keep_logged_in', 'true', { path: '/', maxAge: 60 * 60 * 24 * 365 })
              } else {
                // 브라우저 종료 시 이 쿠키도 함께 삭제되도록 만료 시간 지정 안 함
                cookieStore.set('keep_logged_in', 'false', { path: '/' })
              }
            }
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
