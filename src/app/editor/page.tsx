import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { UserRepository } from '@/infrastructure/supabase/userRepository'
import EditorPageClient from './EditorPageClient'

// 맵에디터는 premium/admin 전용 — 서버 컴포넌트에서 게이팅 (admin/layout.tsx 패턴).
// dynamic({ ssr: false }) 는 서버 컴포넌트에서 불가하므로 클라이언트 셸(EditorPageClient)로 분리.
export default async function EditorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const role = await UserRepository.getUserRole(user.id)
  if (role !== 'admin' && role !== 'premium') {
    redirect('/')
  }

  return <EditorPageClient />
}
