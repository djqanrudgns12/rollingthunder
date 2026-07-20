'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient, requireAdmin } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { PREMIUM_UPGRADE_BONUS_CHIPS, PREMIUM_UPGRADE_REASON } from '@/lib/premium'

export type SortColumn = 'nickname' | 'name' | 'username' | 'role' | 'chips_balance' | 'created_at' | 'last_seen_at'
export type SortDirection = 'asc' | 'desc'

export async function getUsers(
  page: number = 1,
  limit: number = 50,
  searchQuery?: string,
  sortColumn: SortColumn = 'created_at',
  sortDirection: SortDirection = 'desc',
) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const offset = (page - 1) * limit

    // 검색+정렬+last_seen_at 을 profiles 테이블에서 직접 조회
    // auth.admin.listUsers() 의존을 제거하여 1000명 제한 버그 해소
    let query = supabase
      .from('profiles')
      .select('id, username, nickname, name, role, chips_balance, created_at, last_seen_at', { count: 'exact' })

    // 검색 필터: username, nickname, name 대상 (ilike 부분일치)
    // UUID(id)는 타입 캐스트(::text)를 PostgREST가 지원하지 않으므로,
    // UUID 형식인 경우에만 정확 일치(eq)로 추가한다.
    if (searchQuery && searchQuery.trim()) {
      const term = searchQuery.trim()
      const likeTerm = `%${term}%`
      const isUUID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(term)

      let orFilter = `username.ilike.${likeTerm},nickname.ilike.${likeTerm},name.ilike.${likeTerm}`
      if (isUUID) {
        orFilter += `,id.eq.${term}`
      }
      query = query.or(orFilter)
    }

    const { data: profiles, error, count } = await query
      .order(sortColumn, { ascending: sortDirection === 'asc' })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return { success: true, data: profiles, count }
  } catch (error) {
    console.error('[getUsers Error]:', error)
    return { success: false, error: error instanceof Error ? error.message : '유저 목록을 불러오는데 실패했습니다.' }
  }
}

export async function deleteUserAccount(userId: string) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    // 관리자 인가 통과 시, 서비스 롤 클라이언트를 사용해 auth.users 에서 유저를 완전 삭제 (Hard Delete)
    const adminClient = createAdminClient()
    const { error } = await adminClient.auth.admin.deleteUser(userId)
    
    if (error) throw error

    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('[deleteUserAccount Error]:', error)
    return { success: false, error: error instanceof Error ? error.message : '계정 영구 삭제에 실패했습니다.' }
  }
}

export async function updateUserRole(userId: string, newRole: 'user' | 'premium' | 'admin') {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    // 021 마이그레이션부터 authenticated 롤은 role 컬럼 UPDATE 권한이 없으므로
    // (권한 상승 차단), 관리자 인가 후 서비스 롤 클라이언트로 수행한다.
    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) throw error

    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('[updateUserRole Error]:', error)
    return { success: false, error: error instanceof Error ? error.message : '권한 수정에 실패했습니다.' }
  }
}

export async function updateUserChips(userId: string, newChipsBalance: number) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    if (newChipsBalance < 0) {
      throw new Error('보유 칩은 0 이상이어야 합니다.')
    }

    // chips_balance는 authenticated 롤의 UPDATE 권한에서 제외된 컬럼이므로 서비스 롤로 수행
    const adminClient = createAdminClient()

    // 1. 프로필의 보유 칩 강제 수정
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ chips_balance: newChipsBalance, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (profileError) throw profileError

    // 2. 어드민 개입 로그 기록 (Audit) — 타인 user_id 행 삽입이므로 서비스 롤 필요
    const { error: logError } = await adminClient
      .from('chip_logs')
      .insert({
        user_id: userId,
        amount: 0, // 실제 획득이 아니라 세팅이므로, 필요에 따라 차액을 기록할 수도 있음
        reason: 'ADMIN_OVERRIDE_BALANCE_TO_' + newChipsBalance
      })

    if (logError) console.warn('Failed to insert admin chip log:', logError)

    revalidatePath('/admin')
    return { success: true }
  } catch (error) {
    console.error('[updateUserChips Error]:', error)
    return { success: false, error: error instanceof Error ? error.message : '칩 밸런스 수정에 실패했습니다.' }
  }
}

/**
 * 단일 유저를 프리미엄으로 승급하고 보너스 칩을 지급한다.
 * - 이미 premium 또는 admin이면 중복 보상 없이 스킵.
 * - add_chips RPC로 원자적 칩 지급 + chip_logs 자동 기록.
 */
export async function upgradeToPremium(userId: string) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const adminClient = createAdminClient()

    // 1. 현재 역할 확인 — 중복 보상 방지
    const { data: profile, error: fetchError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (fetchError || !profile) {
      throw new Error('유저 프로필을 찾을 수 없습니다.')
    }

    if (profile.role === 'premium' || profile.role === 'admin') {
      return { success: true, skipped: true, reason: '이미 프리미엄 이상 등급입니다.' }
    }

    // 2. role을 premium으로 변경
    const { error: roleError } = await adminClient
      .from('profiles')
      .update({ role: 'premium' })
      .eq('id', userId)

    if (roleError) throw roleError

    // 3. 보너스 칩 지급 (add_chips RPC — Row Lock + chip_logs 자동 기록)
    const { error: chipError } = await adminClient.rpc('add_chips', {
      p_user_id: userId,
      p_amount: PREMIUM_UPGRADE_BONUS_CHIPS,
      p_reason: PREMIUM_UPGRADE_REASON,
    })

    if (chipError) {
      console.error('[upgradeToPremium] Chip grant failed:', chipError)
      // 칩 지급 실패 시에도 role은 이미 변경됨 — 관리자에게 알림
      return {
        success: true,
        skipped: false,
        warning: `승급은 완료되었으나 칩 지급에 실패했습니다: ${chipError.message}`,
      }
    }

    revalidatePath('/admin')
    return { success: true, skipped: false }
  } catch (error) {
    console.error('[upgradeToPremium Error]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '프리미엄 승급에 실패했습니다.',
    }
  }
}

/**
 * 여러 유저를 일괄 프리미엄 승급한다.
 * 각 유저별로 upgradeToPremium 로직을 실행하며, 결과를 집계하여 반환한다.
 */
export async function bulkUpgradeToPremium(userIds: string[]) {
  try {
    const supabase = await createClient()
    await requireAdmin(supabase)

    const adminClient = createAdminClient()
    let upgraded = 0
    let skipped = 0
    let failed = 0
    const errors: string[] = []

    for (const userId of userIds) {
      try {
        // 1. 현재 역할 확인
        const { data: profile, error: fetchError } = await adminClient
          .from('profiles')
          .select('role, username')
          .eq('id', userId)
          .single()

        if (fetchError || !profile) {
          failed++
          errors.push(`${userId.slice(0, 8)}: 프로필 조회 실패`)
          continue
        }

        if (profile.role === 'premium' || profile.role === 'admin') {
          skipped++
          continue
        }

        // 2. role 변경
        const { error: roleError } = await adminClient
          .from('profiles')
          .update({ role: 'premium' })
          .eq('id', userId)

        if (roleError) {
          failed++
          errors.push(`${profile.username || userId.slice(0, 8)}: role 변경 실패`)
          continue
        }

        // 3. 보너스 칩 지급
        const { error: chipError } = await adminClient.rpc('add_chips', {
          p_user_id: userId,
          p_amount: PREMIUM_UPGRADE_BONUS_CHIPS,
          p_reason: PREMIUM_UPGRADE_REASON,
        })

        if (chipError) {
          // role은 이미 변경됨 — 칩만 실패
          errors.push(`${profile.username || userId.slice(0, 8)}: 칩 지급 실패`)
        }

        upgraded++
      } catch (e) {
        failed++
        errors.push(`${userId.slice(0, 8)}: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
      }
    }

    revalidatePath('/admin')
    return { success: true, upgraded, skipped, failed, errors }
  } catch (error) {
    console.error('[bulkUpgradeToPremium Error]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '일괄 승급에 실패했습니다.',
      upgraded: 0,
      skipped: 0,
      failed: 0,
      errors: [],
    }
  }
}
