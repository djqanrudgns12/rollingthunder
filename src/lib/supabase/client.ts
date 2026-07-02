import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  let isKeepLoggedIn = true
  if (typeof document !== 'undefined') {
    // keep_logged_in 쿠키가 명시적으로 false인지 확인
    isKeepLoggedIn = !document.cookie.includes('keep_logged_in=false')
  }

  const cookieOptions: any = {
    path: '/',
  }
  
  if (isKeepLoggedIn) {
    cookieOptions.maxAge = 60 * 60 * 24 * 365
  } else {
    cookieOptions.maxAge = undefined
  }

  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions
    }
  )
}
