'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// 이메일 기반 인증을 우회하기 위한 가상 도메인
const FAKE_DOMAIN = '@rt.local'

export async function login(formData: FormData) {
  const supabase = await createClient()
  const username = formData.get('username') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email: `${username}${FAKE_DOMAIN}`,
    password,
  })

  if (error) {
    return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' }
  }

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const username = formData.get('username') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  const { error } = await supabase.auth.signUp({
    email: `${username}${FAKE_DOMAIN}`,
    password,
    options: {
      data: {
        username: username, // 메타데이터에 실제 username 저장
        name: name, // 이름 저장
      }
    }
  })

  if (error) {
    if (error.message.includes('already registered')) {
      return { error: '이미 존재하는 아이디입니다.' }
    }
    return { error: error.message }
  }

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function deleteAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const adminAuthClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Supabase Admin API를 사용해 해당 사용자 완전히 삭제 (auth.users 에서 삭제)
    // 연관된 데이터(예: public 스키마 내 foreign key ON DELETE CASCADE 설정된 데이터)도 함께 사라집니다.
    await adminAuthClient.auth.admin.deleteUser(user.id)
    
    await supabase.auth.signOut()
  }

  revalidatePath('/', 'layout')
  redirect('/')
}
