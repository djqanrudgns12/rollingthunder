import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 클라이언트 쿠키에서 '로그인 상태 유지' 여부 확인 (문자열 'false'가 아니면 true로 간주)
  const isKeepLoggedIn = request.cookies.get('keep_logged_in')?.value !== 'false'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = { ...options }
            
            // 로그인 상태 유지가 아닐 경우, 세션 쿠키로 만들기 위해 만료 시간 제거
            if (!isKeepLoggedIn) {
              delete cookieOptions.maxAge
              delete cookieOptions.expires
            }
            
            request.cookies.set(name, value)
          })
          
          supabaseResponse = NextResponse.next({
            request,
          })
          
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = { ...options }
            
            // 동일하게 갱신되는 응답(Response) 쿠키에도 만료 시간을 제거
            if (!isKeepLoggedIn) {
              delete cookieOptions.maxAge
              delete cookieOptions.expires
            }
            
            supabaseResponse.cookies.set(name, value, cookieOptions)
          })
        },
      },
    }
  )

  // 페이지 이동/로드 시마다 세션이 유효한지 확인하고 필요하면 갱신(Refresh)합니다.
  // 이 호출을 통해 만료된 access_token이 refresh_token을 이용해 새로 발급되며,
  // 위에서 설정한 setAll 함수가 호출되어 브라우저에 최신 토큰이 쿠키로 저장됩니다.
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - 이미지/정적 자산 확장자들
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
