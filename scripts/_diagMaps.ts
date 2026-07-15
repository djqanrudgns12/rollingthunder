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
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function main() {
  const admin = createClient(url, svc, { auth: { persistSession: false } })

  // 1) 서비스롤: 전체 user_maps 행
  const { data: all, error: e1 } = await admin
    .from('user_maps')
    .select('id, name, owner_id, is_published, published_at, schema_version, validated_at')
    .order('created_at', { ascending: true })
  console.log('=== [service-role] user_maps 전체 ===')
  if (e1) console.log('ERR', e1.message)
  console.log('총', all?.length ?? 0, '행')
  for (const r of all || []) console.log(` - ${r.name} | published=${r.is_published} | owner=${r.owner_id?.slice(0, 8)} | pub_at=${r.published_at}`)

  // 2) 서비스롤: is_published=true 개수
  const { count: pubCount } = await admin.from('user_maps').select('id', { count: 'exact', head: true }).eq('is_published', true)
  console.log('\nis_published=true (service-role):', pubCount ?? 0)

  // 3) anon(RLS) 시뮬레이션 — 스토어 쿼리와 동일 (익명, 세션 없음)
  const pub = createClient(url, anon, { auth: { persistSession: false } })
  const { data: anonRows, error: e3 } = await pub
    .from('user_maps')
    .select('*, profiles(name, username)')
    .eq('is_published', true)
    .limit(60)
  console.log('\n=== [anon/RLS] 스토어 쿼리 결과 ===')
  if (e3) console.log('ERR', e3.message)
  console.log('보이는 행:', anonRows?.length ?? 0)
  for (const r of anonRows || []) console.log(` - ${r.name} | creator=${(r as any).profiles?.name ?? '∅'}`)

  // 4) profiles RLS 확인 — anon이 owner 프로필을 읽을 수 있는지
  if (all && all.length) {
    const { data: prof, error: e4 } = await pub.from('profiles').select('id, name, username, role').eq('id', all[0].owner_id).maybeSingle()
    console.log('\n=== [anon/RLS] owner profiles 읽기 ===')
    console.log(e4 ? `ERR ${e4.message}` : (prof ? `${prof.name ?? prof.username ?? prof.id} (role=${prof.role})` : '∅ (RLS로 안 보임)'))
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
