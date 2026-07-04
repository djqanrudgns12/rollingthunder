import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | undefined = undefined

export function createClient() {
  if (client) return client

  // NOTE: 과거 cookieOptions.lifetime 옵션은 @supabase/ssr 타입에 존재하지 않는
  // 무효 속성으로 런타임에서 조용히 무시되고 있었다(제거해도 동작 무변경).
  // "로그인 유지" 세션 수명은 server.ts / middleware.ts 가 maxAge/expires로 강제한다.
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  return client
}
