import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

// 앱 전역에서 싱글톤(Singleton) 패턴으로 사용할 수 있는 공용 Supabase 클라이언트
// 환경변수 미설정 시 placeholder로 생성되어 빌드는 통과하나, 실제 API 호출 시 실패합니다.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
