'use server'

/**
 * 상점 아이템 구매 Server Action (v2 — 성능 최적화)
 *
 * v1 대비 변경점:
 * - DB 왕복 4회(auth + profile + deduct_chips + inventory) → 2회(auth + purchase_item_atomic)
 * - 통합 RPC purchase_item_atomic이 칩 차감 + 인벤토리 추가를 단일 트랜잭션으로 처리
 * - 아이템 검증(가격, 권한)은 하드코딩 데이터(MOCK_ITEMS)로 서버에서 수행 (DB 불필요)
 *
 * 보안:
 * - Server Action은 Next.js 서버에서만 실행되므로 클라이언트 변조 불가
 * - purchase_item_atomic RPC 내부에서 Row Lock + 잔액 검증 + 중복 구매 방지
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

  // ── 2단계: 아이템 정보 조회 (하드코딩된 shopData에서 검색 — DB 불필요) ──
  const item: ShopItem | undefined = MOCK_ITEMS.find((i) => i.item_id === itemId)

  if (!item) {
    return { success: false, error: '존재하지 않는 아이템입니다.' }
  }

  // 기본 보유 아이템이나 가격이 0인 아이템은 구매 대상이 아님
  if (item.isDefault || item.price <= 0) {
    return { success: false, error: '구매할 수 없는 아이템입니다.' }
  }

  // ── 3단계: 등급(Role) ↔ 희귀도(Rarity) 권한 검증 ──
  // 유저의 role은 JWT 토큰의 app_metadata 또는 RPC 내부에서 검증할 수도 있지만,
  // 현재 구조에서는 purchase_item_atomic이 role을 모르므로 Server Action에서 사전 검증합니다.
  // getUser()의 user_metadata에는 role이 없으므로, 빠른 경로로 profiles에서 role만 조회합니다.
  const { data: roleData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole: string = roleData?.role || 'guest'
  const userRoleLevel = ROLE_HIERARCHY[userRole] ?? 0
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

  // ── 4단계: 통합 RPC 호출 (칩 차감 + 인벤토리 추가를 단일 트랜잭션으로) ──
  const itemType = item.item_id.split('_')[0] || 'shop_item'
  const { data: newBalance, error: purchaseError } = await supabase.rpc('purchase_item_atomic', {
    p_user_id: user.id,
    p_amount: item.price,
    p_reason: `buy_item_${item.item_id}`,
    p_item_type: itemType,
    p_item_code: item.item_id,
  })

  if (purchaseError) {
    // RPC 내부 예외 메시지 파싱
    const msg = purchaseError.message || ''
    if (msg.includes('Insufficient')) {
      return { success: false, error: '칩이 부족합니다!' }
    }
    if (msg.includes('already owned')) {
      return { success: false, error: '이미 보유한 아이템입니다.' }
    }
    return { success: false, error: '구매 처리 중 오류가 발생했습니다. 다시 시도해주세요.' }
  }

  return {
    success: true,
    newBalance: typeof newBalance === 'number' ? newBalance : undefined,
  }
}
