import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// 앱 전역에서 싱글톤(Singleton) 패턴으로 사용할 수 있는 공용 Supabase 클라이언트
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
