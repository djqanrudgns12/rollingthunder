import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// [Server-Side RNG]
// 클라이언트에서 조작할 수 없도록 서버 런타임에서 확률을 계산하고,
// 칩 차감(deduct_chips RPC) → 인벤토리 지급 → 감사 로그(gacha_logs) 순으로 기록합니다.
const GACHA_COST = 100

export async function POST() {
  try {
    // 1. 인증: 쿠키 세션 기반 (RLS 정책과 정합 — auth.uid() = user_id)
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    // 2. 서버 사이드 확률 계산
    const rand = Math.random() * 100
    let tier = 'N'
    let itemId = 'N_default'

    if (rand <= 1) { // 1% 확률 (UR 등급)
      tier = 'UR'
      const urItems = ['UR_blackhole', 'UR_supernova', 'UR_matrix_rain']
      itemId = urItems[Math.floor(Math.random() * urItems.length)]
    } else if (rand <= 5) { // 4% 확률 (SR 등급)
      tier = 'SR'
      const srItems = ['SR_cat', 'SR_shiba', 'SR_ufo']
      itemId = srItems[Math.floor(Math.random() * srItems.length)]
    } else if (rand <= 30) { // 25% 확률 (R 등급)
      tier = 'R'
      const rItems = ['R_metal', 'R_glass', 'R_neon_trail']
      itemId = rItems[Math.floor(Math.random() * rItems.length)]
    } else { // 70% 확률 (N 등급)
      tier = 'N'
      const nItems = ['N_red', 'N_blue', 'N_green']
      itemId = nItems[Math.floor(Math.random() * nItems.length)]
    }

    // 3. 칩 차감 (원자적 RPC — 잔액 부족 시 예외)
    const { error: deductError } = await supabase.rpc('deduct_chips', {
      p_user_id: user.id,
      p_amount: GACHA_COST,
      p_reason: 'gacha_pull',
    })

    if (deductError) {
      return NextResponse.json({ error: '칩이 부족하거나 결제 처리에 실패했습니다.' }, { status: 402 })
    }

    // 4. 유저 인벤토리(user_inventory)에 아이템 지급 (중복 획득은 무시)
    const { error: invError } = await supabase
      .from('user_inventory')
      .upsert(
        { user_id: user.id, item_type: 'skin', item_code: itemId },
        { onConflict: 'user_id,item_type,item_code', ignoreDuplicates: true }
      )

    if (invError) throw invError

    // 5. 가챠 결과(gacha_logs) 무결성 감사용 로그 기록
    const { error: logError } = await supabase
      .from('gacha_logs')
      .insert({
        user_id: user.id,
        cost: GACHA_COST,
        reward_tier: tier,
        reward_item_code: itemId,
      })

    if (logError) throw logError

    // 클라이언트에게는 최종 결과만 전달합니다.
    return NextResponse.json({
      success: true,
      reward: { tier, itemId }
    })

  } catch (error) {
    console.error('Gacha API Error:', error)
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
