import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // env 누락 가드: Supabase env가 없으면 auth 시도 자체가 매 요청을 깨뜨린다.
  // 이 경우 인증 없이 통과시켜 앱(로컬 프리셋 폴백 경로)이 최소한 구동되게 한다.
  // 정상 env에서는 아래 로직이 기존과 완전히 동일하게 동작한다.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse
  }

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
  // [최적화] 모든 경로에서 getUser() 네트워크 통신을 피하기 위해, 리다이렉션이 필요한 루트('/') 경로일 때만 확인합니다.
  if (request.nextUrl.pathname === '/') {
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const dashboardUrl = request.nextUrl.clone()
      dashboardUrl.pathname = '/dashboard'
      
      const redirectResponse = NextResponse.redirect(dashboardUrl)
      
      supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value, { ...cookie })
      })
      
      return redirectResponse
    }
  }

  // 루트 경로가 아니거나 유저가 없으면 원래 응답을 그대로 반환 (블로킹 X)
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|html|txt|xml|ico)$).*)',
  ],
}
