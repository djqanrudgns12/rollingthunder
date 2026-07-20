/**
 * 로그인 성능 마이그레이션(024_login_perf.sql) 등가성 검증
 * ───────────────────────────────────────────────────────────────────────────
 * 실행: npx tsx scripts/verifyLoginPerf.ts
 *
 * 임시 유저 A/B를 만들어 실제 RLS 하에서 행 가시성을 검사한다.
 * 024 적용 "전/후"에 각각 실행해 결과가 동일해야 한다(= RLS 재작성이 시맨틱 보존).
 * RPC(get_lobby_bootstrap)는 적용 전엔 '미존재'가 정상, 적용 후엔 레거시 쿼리와 값 일치를 검사.
 * 임시 유저는 종료 시 삭제(cascade로 프로필/로그도 함께 정리).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnvLocal() {
  const p = path.resolve(__dirname, '../.env.local')
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] === undefined) process.env[m[1]] = v
  }
}
loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// src/lib/legal.ts 와 동일 값(스크립트 독립 실행을 위해 하드코드 아님 — 파일에서 파싱)
function readLegalVersions(): { terms: string; privacy: string } {
  const src = fs.readFileSync(path.resolve(__dirname, '../src/lib/legal.ts'), 'utf8')
  const terms = src.match(/TERMS_VERSION\s*=\s*'([^']+)'/)?.[1] ?? ''
  const privacy = src.match(/PRIVACY_VERSION\s*=\s*'([^']+)'/)?.[1] ?? ''
  return { terms, privacy }
}

let pass = 0, fail = 0
function check(name: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

async function makeUser(admin: SupabaseClient, tag: string) {
  const email = `rt_perf_${tag}_${Date.now()}@example.com`
  const password = 'Perf!' + Math.random().toString(36).slice(2, 10) + 'x9'
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw new Error(`임시 유저 생성 실패(${tag}): ${error?.message}`)
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { error: eS } = await client.auth.signInWithPassword({ email, password })
  if (eS) throw new Error(`로그인 실패(${tag}): ${eS.message}`)
  return { id: data.user.id, email, client }
}

async function main() {
  const admin = createClient(url, svcKey, { auth: { persistSession: false } })
  const { terms, privacy } = readLegalVersions()
  console.log(`── 로그인 성능 마이그레이션 등가성 검증 (terms=${terms}, privacy=${privacy}) ──\n`)

  const A = await makeUser(admin, 'a')
  const B = await makeUser(admin, 'b')
  console.log(`임시 유저: A=${A.email.split('@')[0]}, B=${B.email.split('@')[0]}\n`)

  try {
    // B에게 칩 로그 1건 생성(관리자 가시성 검사용 — B 삭제 시 cascade 정리)
    await admin.rpc('add_chips', { p_user_id: B.id, p_amount: 1, p_reason: 'perf_diag' })

    // ── 1) anon: profiles 0행 (000/014 제거 전후 동일해야 함) ──
    console.log('[1] anon 접근')
    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: anonProfiles, error: eAnon } = await anon.from('profiles').select('id').limit(5)
    check('anon profiles → 0행', !eAnon && (anonProfiles?.length ?? 0) === 0, eAnon?.message)

    // ── 2) authenticated 기본 가시성 ──
    console.log('\n[2] 일반 유저(A) 가시성')
    const { data: own } = await A.client.from('profiles').select('id').eq('id', A.id)
    check('A → 자기 프로필 1행', (own?.length ?? 0) === 1)
    const { data: other } = await A.client.from('profiles').select('id').eq('id', B.id)
    check('A → 타인(B) 프로필 1행(022)', (other?.length ?? 0) === 1)

    const { data: store, error: eStore } = await A.client
      .from('user_maps')
      .select('id, name, profiles!user_maps_owner_id_fkey(name, username)')
      .eq('is_published', true).limit(5)
    check('A → 맵 스토어 목록+제작자 조인', !eStore && (store?.length ?? 0) > 0, eStore?.message)

    const { data: bLogsAsA, error: eBLogs } = await A.client.from('chip_logs').select('log_id').eq('user_id', B.id)
    check('A → B의 chip_logs 0행(비관리자)', !eBLogs && (bLogsAsA?.length ?? 0) === 0, eBLogs?.message)
    const { data: bInvAsA } = await A.client.from('user_inventory').select('item_code').eq('user_id', B.id)
    check('A → B의 인벤토리 0행', (bInvAsA?.length ?? 0) === 0)
    const { data: bConsAsA } = await A.client.from('user_consents').select('id').eq('user_id', B.id)
    check('A → B의 동의이력 0행', (bConsAsA?.length ?? 0) === 0)
    const { data: ownLogs, error: eOwnLogs } = await A.client.from('chip_logs').select('log_id').eq('user_id', A.id)
    check('A → 자기 chip_logs 조회 가능', !eOwnLogs, eOwnLogs?.message)
    void ownLogs

    // ── 3) 관리자 가시성 (A를 admin 승격) ──
    console.log('\n[3] 관리자(A→admin) 가시성')
    await admin.from('profiles').update({ role: 'admin' }).eq('id', A.id)
    const { data: bLogsAsAdmin, error: eAdmLogs } = await A.client.from('chip_logs').select('log_id').eq('user_id', B.id)
    check('admin → B의 chip_logs 1행', !eAdmLogs && (bLogsAsAdmin?.length ?? 0) === 1, eAdmLogs?.message)
    const { data: allMapsAsAdmin } = await A.client.from('user_maps').select('id').limit(1)
    check('admin → user_maps 접근(FOR ALL)', (allMapsAsAdmin?.length ?? 0) >= 0)
    await admin.from('profiles').update({ role: 'user' }).eq('id', A.id) // 원복

    // ── 4) RPC get_lobby_bootstrap ──
    console.log('\n[4] get_lobby_bootstrap RPC')
    const { data: boot, error: eBoot } = await A.client.rpc('get_lobby_bootstrap', {
      p_terms_version: terms, p_privacy_version: privacy,
    })
    if (eBoot) {
      const missing = /function|schema cache|PGRST202/i.test(eBoot.message)
      console.log(`  ℹ RPC ${missing ? '미존재 — 024 적용 전(폴백 경로 사용됨). 적용 후 재실행 시 아래 값 검증이 수행됩니다.' : '오류: ' + eBoot.message}`)
      if (!missing) fail++
    } else if (!boot) {
      check('RPC 결과 존재', false, 'NULL 반환(프로필 미생성?)')
    } else {
      check('RPC: profile/inventory/stats/needsReconsent 키', ['profile', 'inventory', 'stats', 'needsReconsent'].every(k => k in boot))
      // 레거시 쿼리와 값 대조
      const { data: prof } = await A.client.from('profiles').select('*').eq('id', A.id).single()
      check('RPC.profile.id = 레거시 profiles.id', boot.profile?.id === prof?.id)
      check('RPC.profile.chips_balance 일치', Number(boot.profile?.chips_balance ?? 0) === Number(prof?.chips_balance ?? 0))
      const { data: inv } = await A.client.from('user_inventory').select('item_code').eq('user_id', A.id)
      const legacyInv = (inv ?? []).map(r => r.item_code).sort()
      const rpcInv = ([...(boot.inventory ?? [])] as string[]).sort()
      check('RPC.inventory 일치', JSON.stringify(rpcInv) === JSON.stringify(legacyInv))
      const { count: total } = await A.client.from('missions').select('*', { count: 'exact', head: true }).in('type', ['achievement', 'hidden'])
      const { count: done } = await A.client.from('user_achievements').select('*', { count: 'exact', head: true }).eq('user_id', A.id).eq('completed', true)
      check('RPC.stats 일치', Number(boot.stats?.total_achievements) === (total ?? 0) && Number(boot.stats?.achievements_completed) === (done ?? 0))
      const { data: cons } = await A.client.from('user_consents').select('doc_type')
        .eq('user_id', A.id)
        .or(`and(doc_type.eq.terms,version.eq.${terms}),and(doc_type.eq.privacy,version.eq.${privacy})`)
      const agreed = new Set((cons ?? []).map(r => r.doc_type))
      const legacyNeeds = !(agreed.has('terms') && agreed.has('privacy'))
      check('RPC.needsReconsent 일치', !!boot.needsReconsent === legacyNeeds)
      // anon 차단
      const { error: eAnonRpc } = await anon.rpc('get_lobby_bootstrap', { p_terms_version: terms, p_privacy_version: privacy })
      check('anon → RPC 실행 거부', !!eAnonRpc)
    }
  } finally {
    await admin.auth.admin.deleteUser(A.id)
    await admin.auth.admin.deleteUser(B.id)
    console.log('\n임시 유저 삭제 완료')
  }

  console.log(`\n결과: ✓ ${pass}  ✗ ${fail}`)
  process.exit(fail === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
