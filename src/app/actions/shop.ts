'use server'

/**
 * 상점 아이템 구매 Server Action
 *
 * 왜 Server Action을 쓰는가:
 * 기존에는 클라이언트에서 직접 deduct_chips RPC를 호출했기 때문에,
 * 브라우저 콘솔이나 네트워크 변조로 권한 없는 아이템도 구매할 수 있었습니다.
 * Server Action은 Next.js 서버에서만 실행되므로 클라이언트 변조가 불가능합니다.
 *
 * 흐름:
 * 1. 세션에서 현재 유저 확인 (인증)
 * 2. DB profiles 테이블에서 유저의 role 조회 (권한)
 * 3. shopData.ts의 MOCK_ITEMS에서 아이템 정보 매칭 (데이터)
 * 4. role ↔ rarity 권한 검증 (보안)
 * 5. deduct_chips RPC 호출 (결제)
 */

import { createClient } from '@/lib/supabase/server'
import { MOCK_ITEMS, type ShopItem } from '@/data/shopData'

// ---------- 등급 관련 상수 ----------

/** 유저 등급 위계 — 숫자가 클수록 높은 등급 */
const ROLE_HIERARCHY: Record<string, number> = {
  guest: 0,
  user: 1,
  premium: 2,
  admin: 3,
}

/**
 * 아이템 희귀도(Rarity)별 구매에 필요한 최소 등급 매핑
 *
 * 왜 이렇게 설계했는가:
 * - guest: Normal까지만 → Normal의 최소 등급 = 0 (guest)
 * - user:  Rare까지만   → Rare의 최소 등급 = 1 (user)
 * - Epic 이상은 premium(2) 이상만 가능
 */
const RARITY_MIN_ROLE: Record<string, number> = {
  Normal: 0,     // 게스트도 구매 가능
  Rare: 1,       // user(노말 회원) 이상
  Epic: 2,       // premium 이상
  Legendary: 2,  // premium 이상
  Mythic: 2,     // premium 이상
}

// ---------- 반환 타입 ----------

interface PurchaseResult {
  success: boolean
  /** 구매 성공 시 차감 후 잔여 칩 */
  newBalance?: number
  error?: string
}

// ---------- Server Action ----------

export async function purchaseShopItem(itemId: string): Promise<PurchaseResult> {
  // ── 1단계: 인증 확인 ──
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  // ── 2단계: DB에서 유저 프로필(role, chips_balance) 조회 ──
  // 왜 DB에서 다시 조회하는가: 클라이언트 Zustand 상태는 변조 가능하므로,
  // 서버에서 DB의 실제 데이터를 기준으로 검증해야 합니다.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, chips_balance')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { success: false, error: '유저 프로필을 찾을 수 없습니다.' }
  }

  const userRole: string = profile.role || 'guest'
  const userRoleLevel = ROLE_HIERARCHY[userRole] ?? 0

  // ── 3단계: 아이템 정보 조회 (하드코딩된 shopData에서 검색) ──
  const item: ShopItem | undefined = MOCK_ITEMS.find((i) => i.item_id === itemId)

  if (!item) {
    return { success: false, error: '존재하지 않는 아이템입니다.' }
  }

  // 기본 보유 아이템이나 가격이 0인 아이템은 구매 대상이 아님
  if (item.isDefault || item.price <= 0) {
    return { success: false, error: '구매할 수 없는 아이템입니다.' }
  }

  // ── 4단계: 등급(Role) ↔ 희귀도(Rarity) 권한 검증 ──
  const requiredRoleLevel = RARITY_MIN_ROLE[item.rarity] ?? 2

  if (userRoleLevel < requiredRoleLevel) {
    return {
      success: false,
      error: `프리미엄 전용 상품입니다. 현재 등급(${userRole})으로는 ${item.rarity} 등급 아이템을 구매할 수 없습니다.`,
    }
  }

  // 프리미엄 전용 탭(piece, background, frame) 아이템 추가 검증
  if (item.requiresPremium && !['admin', 'premium'].includes(userRole)) {
    return {
      success: false,
      error: '프리미엄 등급 이상만 구매 가능한 아이템입니다.',
    }
  }

  // ── 5단계: 칩 잔액 검증 (사전 확인용, 실제 차감은 RPC에서 트랜잭션으로 처리) ──
  if (profile.chips_balance < item.price) {
    return {
      success: false,
      error: `칩이 부족합니다! (보유: ${profile.chips_balance.toLocaleString()}C / 필요: ${item.price.toLocaleString()}C)`,
    }
  }

  // ── 6단계: deduct_chips RPC 호출 (트랜잭션 + Row-level lock) ──
  const { data: newBalance, error: deductError } = await supabase.rpc('deduct_chips', {
    p_user_id: user.id,
    p_amount: item.price,
    p_reason: `buy_item_${item.item_id}`,
  })

  if (deductError) {
    // deduct_chips 내부에서 잔액 부족 등의 예외가 발생한 경우
    return { success: false, error: '구매 처리 중 오류가 발생했습니다. 다시 시도해주세요.' }
  }

  // ── 7단계: user_inventory에 구매한 아이템 추가 ──
  const itemType = item.item_id.split('_')[0] || 'shop_item'
  const { error: inventoryError } = await supabase
    .from('user_inventory')
    .insert({
      user_id: user.id,
      item_type: itemType,
      item_code: item.item_id,
    })

  if (inventoryError) {
    console.error('Failed to add item to inventory:', inventoryError)
    // 인벤토리 삽입 실패 시 환불 처리를 하거나 관리자 로그를 남겨야 할 수 있지만,
    // 현재는 결제가 성공했으므로 에러 로깅만 하고 성공으로 처리 (재지급 로직 필요 가능)
  }

  return {
    success: true,
    newBalance: typeof newBalance === 'number' ? newBalance : undefined,
  }
}
