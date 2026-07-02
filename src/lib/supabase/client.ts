import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | undefined = undefined

export function createClient() {
  if (client) return client

  let isKeepLoggedIn = true
  if (typeof document !== 'undefined') {
    // keep_logged_in 쿠키가 명시적으로 false인지 확인
    isKeepLoggedIn = !document.cookie.includes('keep_logged_in=false')
  }

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // @supabase/ssr 클라이언트는 maxAge 대신 lifetime을 지원합니다.
        // 0으로 설정하면 브라우저 종료 시 삭제되는 세션 쿠키가 됩니다.
        lifetime: isKeepLoggedIn ? 60 * 60 * 24 * 365 : 0,
      }
    }
  )

  return client
}
