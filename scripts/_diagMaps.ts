/**
 * 맵 스토어 진단(수정 검증용) — 임시 테스트 유저로 실제 RLS 하에서 스토어 쿼리 재현.
 * 실행: npx tsx scripts/_diagMaps.ts   (임시 유저는 종료 시 삭제)
 */
import { createClient } from '@supabase/supabase-js'
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
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const STORE_SELECT = '*, profiles!user_maps_owner_id_fkey(name, username)' // 수정된 임베드(코드와 동일)

async function main() {
  const admin = createClient(url, svc, { auth: { persistSession: false } })

  // 0) 서비스롤 현황
  const { count: pubCount } = await admin.from('user_maps').select('id', { count: 'exact', head: true }).eq('is_published', true)
  console.log(`[service-role] is_published=true: ${pubCount ?? 0}행`)

  // 1) 수정된 임베드 — 서비스롤(RLS 무관, 임베드 문법 자체 검증)
  const { data: srRows, error: e1 } = await admin.from('user_maps').select(STORE_SELECT).eq('is_published', true).limit(60)
  console.log(`\n[service-role] 수정 임베드 쿼리: ${e1 ? 'ERR ' + e1.message : `OK ${srRows!.length}행`}`)

  // 2) 임시 authenticated 유저 생성 → 실제 스토어 조건(로그인 RLS) 재현
  const email = `rt_diag_${Date.now()}@example.com`
  const password = 'Diag!' + Math.random().toString(36).slice(2, 10) + 'x9'
  const { data: created, error: eC } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (eC || !created.user) { console.error('임시 유저 생성 실패:', eC?.message); process.exit(1) }
  const tempId = created.user.id
  console.log(`\n[temp-user] 생성: ${email}`)

  try {
    const authed = createClient(url, anonKey, { auth: { persistSession: false } })
    const { error: eS } = await authed.auth.signInWithPassword({ email, password })
    if (eS) { console.error('로그인 실패:', eS.message); return }

    const { data: rows, error: e2 } = await authed.from('user_maps').select(STORE_SELECT).eq('is_published', true)
      .order('download_count', { ascending: false }).order('published_at', { ascending: false }).limit(60)
    console.log(`\n[authenticated] 스토어 쿼리: ${e2 ? 'ERR ' + JSON.stringify(e2) : `OK ${rows!.length}행`}`)
    let namedCount = 0
    for (const r of rows || []) {
      const p: any = (r as any).profiles
      const creator = p?.name || p?.username || null
      if (creator) namedCount++
      console.log(` - ${(r as any).name} | 제작자=${creator ?? '∅(profiles RLS 차단)'}`)
    }
    if ((rows?.length ?? 0) > 0 && namedCount === 0) {
      console.log('\n⚠ 제작자명 전부 ∅ → 라이브 DB에 022_fix_profiles_select_rls.sql 미적용(적용 필요)')
    } else if (namedCount > 0) {
      console.log('\n✓ 제작자명 표시 정상(022 적용됨)')
    }
  } finally {
    await admin.auth.admin.deleteUser(tempId)
    console.log(`\n[temp-user] 삭제 완료: ${email}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
