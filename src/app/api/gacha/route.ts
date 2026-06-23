import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 서버 환경에서만 동작하므로 환경 변수에서 URL과 키를 가져옵니다.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function POST(request: Request) {
  try {
    const { participantId, cost = 100 } = await request.json()

    if (!participantId) {
      return NextResponse.json({ error: 'participantId is required' }, { status: 400 })
    }

    // [Server-Side RNG] 
    // 클라이언트에서 조작할 수 없도록 서버 런타임에서 확률을 계산합니다.
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

    // 1. 유저 인벤토리(user_inventory) DB에 아이템 기록
    const { error: invError } = await supabase
      .from('user_inventory')
      .insert({
        participant_id: participantId,
        part_type: 'body',
        item_id: itemId
      })

    if (invError) throw invError

    // 2. 가챠 결과(gacha_logs) DB에 무결성 감사용 로그 기록
    const { error: logError } = await supabase
      .from('gacha_logs')
      .insert({
        participant_id: participantId,
        cost,
        reward_tier: tier,
        reward_item_id: itemId
      })

    if (logError) throw logError

    // 클라이언트에게는 암호화된 최종 결과만 전달합니다.
    return NextResponse.json({
      success: true,
      reward: { tier, itemId }
    })

  } catch (error: any) {
    console.error('Gacha API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
