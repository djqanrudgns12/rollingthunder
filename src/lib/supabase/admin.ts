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

/**
 * 관리자 권한인지 확인하는 공통 헬퍼 함수입니다.
 * 세션 정보와 프로필 롤을 모두 검사하여 관리자가 아니면 에러를 던집니다.
 */
export async function requireAdmin(supabase: any) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  if (error || profile?.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required')
  }
}
