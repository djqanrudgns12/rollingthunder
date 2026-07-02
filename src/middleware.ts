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
          cookiesToSet.forEach(({ name, value }) => {
            // Server Component들이 동일 요청 내에서 갱신된 쿠키를 읽을 수 있도록 request에 세팅합니다.
            // request.cookies 에는 maxAge 옵션이 필요하지 않습니다.
            request.cookies.set(name, value)
          })
          
          supabaseResponse = NextResponse.next({
            request,
          })
          
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieOptions = { ...options }
            
            // 방어 로직: Supabase가 쿠키 삭제를 요청한 경우 (로그아웃, 세션 폐기 등)
            if (options.maxAge === 0 || value === '') {
              cookieOptions.maxAge = 0
              cookieOptions.expires = new Date(0)
            } 
            // 로그인 상태 유지가 아닐 경우, 세션 쿠키로 만들기 위해 만료 시간 제거
            else if (!isKeepLoggedIn) {
              delete cookieOptions.maxAge
              delete cookieOptions.expires
            } 
            // 로그인 상태 유지일 경우 명시적으로 1년으로 설정
            else {
              cookieOptions.maxAge = 60 * 60 * 24 * 365
              cookieOptions.expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)
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
