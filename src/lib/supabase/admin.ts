import { createClient } from '@supabase/supabase-js'

// 서버 환경에서만 사용할 수 있도록 제한
if (typeof window !== 'undefined') {
  throw new Error('createAdminClient must only be used on the server side.')
}

/**
 * 서비스 롤 키(Service Role Key)를 사용하는 관리자 권한의 Supabase 클라이언트를 반환합니다.
 * 이 클라이언트는 Row Level Security (RLS) 정책을 모두 무시하므로 주의해서 사용해야 합니다.
 * 주로 auth.users 에서 계정을 강제 삭제하거나, 어드민 권한이 필수적인 백그라운드 작업에 사용됩니다.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for Admin Client. Please check SUPABASE_SERVICE_ROLE_KEY.')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
