/**
 * Admin 커스텀 맵 10종 시드 (docs/PRD-new-obstacles.md PART 2 §P2.5)
 * ───────────────────────────────────────────────────────────────────────────
 * 서비스롤로 user_maps 에 admin 소유·배포(is_published=true) 상태의 맵 10종을 멱등 upsert.
 *
 * 실행(전체 삽입·배포):   npx tsx scripts/seedAdminMaps.ts
 * 읽기전용 환경 점검만:     npx tsx scripts/seedAdminMaps.ts --check
 * 소유 계정 지정:          ADMIN_EMAIL=you@example.com npx tsx scripts/seedAdminMaps.ts
 *
 * 동작:
 *   (a) .env.local 자동 로드 → SUPABASE_URL / SERVICE_ROLE_KEY 확보, 서비스롤 클라이언트 생성
 *   (b) SQL 환경 점검 — user_maps 테이블 존재 확인(없으면 015_map_store.sql 적용 안내 후 중단)
 *   (c) admin 소유자 해석 — ADMIN_EMAIL(기본 djqanrudgns12@gmail.com) 계정을 찾아 profiles.role='admin' 승격
 *   (d) 헤드리스 재검증(fail-closed) — 전 맵 전원 완주 통과 시에만 진행
 *   (e) 맵별 멱등 upsert(owner_id+name 매칭) + is_published/published_at/validation_summary 설정
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { ADMIN_MAPS } from './adminMaps.data'
import { runValidation } from './validateAdminMaps'

const DEFAULT_ADMIN_EMAIL = 'djqanrudgns12@gmail.com'

// ── .env.local 자동 로드(이미 설정된 값은 유지) ──────────────────────────────
function loadEnvLocal() {
  const p = path.resolve(__dirname, '../.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    const key = m[1]
    let val = m[2]
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1)
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function admin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('환경변수 누락: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (.env.local 확인)')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

/** user_maps 테이블 존재 여부(= 015 마이그레이션 적용 여부) 확인 */
async function checkEnv(sb: SupabaseClient): Promise<boolean> {
  const { error } = await sb.from('user_maps').select('id', { count: 'exact', head: true })
  if (error) {
    if (/relation .*user_maps.* does not exist|Could not find the table|schema cache/i.test(error.message)) {
      console.error('❌ user_maps 테이블이 없습니다. supabase/migrations/015_map_store.sql 을 먼저 적용하세요.')
      return false
    }
    console.error('❌ user_maps 조회 오류:', error.message)
    return false
  }
  console.log('✓ user_maps 테이블 확인')
  return true
}

async function findUserIdByEmail(sb: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 })
    if (error) { console.error('❌ auth 사용자 조회 오류:', error.message); return null }
    const u = data.users.find((x) => (x.email || '').toLowerCase() === email.toLowerCase())
    if (u) return u.id
    if (data.users.length < 200) break
  }
  return null
}

async function emailForId(sb: SupabaseClient, id: string): Promise<string | null> {
  const { data } = await sb.auth.admin.getUserById(id)
  return data?.user?.email || null
}

/**
 * 소유 admin 계정 해석:
 *   1) ADMIN_EMAIL 명시 → 그 계정을 찾아 admin 승격
 *   2) 미지정 & 기존 admin 프로필 존재 → 그 admin을 소유자로 사용(승격 불필요)
 *   3) 그 외 → 기본 이메일(DEFAULT_ADMIN_EMAIL) 계정을 admin 승격
 * promote=false(--check)는 승격/삽입 없이 조회만.
 */
async function resolveAdminOwner(sb: SupabaseClient, explicitEmail: string | undefined, promote: boolean): Promise<{ id: string; email: string | null } | null> {
  // 1) 명시적 이메일
  if (explicitEmail) {
    const id = await findUserIdByEmail(sb, explicitEmail)
    if (!id) { console.error(`❌ '${explicitEmail}' 계정을 찾을 수 없습니다.`); return null }
    if (promote) await promoteToAdmin(sb, id, explicitEmail)
    return { id, email: explicitEmail }
  }
  // 2) 기존 admin 프로필 재사용
  const { data: admins } = await sb.from('profiles').select('id').eq('role', 'admin').limit(1)
  if (admins && admins.length) {
    const id = admins[0].id
    const email = await emailForId(sb, id)
    console.log(`✓ 기존 admin 소유자 사용: ${email || id}`)
    return { id, email }
  }
  // 3) 기본 이메일 승격
  const id = await findUserIdByEmail(sb, DEFAULT_ADMIN_EMAIL)
  if (!id) {
    console.error(`❌ admin 계정 없음 + 기본 계정('${DEFAULT_ADMIN_EMAIL}') 미가입. ADMIN_EMAIL=<가입한_이메일> 로 지정하세요.`)
    return null
  }
  if (promote) await promoteToAdmin(sb, id, DEFAULT_ADMIN_EMAIL)
  return { id, email: DEFAULT_ADMIN_EMAIL }
}

async function promoteToAdmin(sb: SupabaseClient, userId: string, email: string) {
  const { data: prof } = await sb.from('profiles').select('id, role').eq('id', userId).maybeSingle()
  if (!prof) {
    const { error } = await sb.from('profiles').insert({ id: userId, role: 'admin' })
    if (error) throw new Error(`profiles 생성 오류: ${error.message}`)
    console.log(`✓ profiles 생성 + admin 승격: ${email}`)
  } else if (prof.role !== 'admin') {
    const { error } = await sb.from('profiles').update({ role: 'admin' }).eq('id', userId)
    if (error) throw new Error(`admin 승격 오류: ${error.message}`)
    console.log(`✓ admin 승격: ${email} (기존 role=${prof.role})`)
  } else {
    console.log(`✓ 이미 admin: ${email}`)
  }
}

async function seed(sb: SupabaseClient, ownerId: string) {
  // 배포 전 fail-closed 재검증(8 races)
  console.log('\n헤드리스 재검증 중(8 races)…')
  const res = await runValidation(8, 14)
  if (!res.allPass) {
    console.error('❌ 검증 실패 맵이 있어 시드를 중단합니다:')
    for (const s of Object.values(res.summaries)) if (!s.pass) console.error(`   - ${s.name}: 타임아웃 ${s.timedOutRaces}/${s.races}`)
    process.exit(1)
  }
  console.log('✓ 전 맵 검증 통과\n')

  // 기존 admin 소유 맵(이름→id) 조회 → 멱등 매칭
  const { data: existing } = await sb.from('user_maps').select('id, name').eq('owner_id', ownerId)
  const byName = new Map<string, string>((existing || []).map((r: any) => [r.name, r.id]))

  const nowIso = new Date().toISOString()
  let inserted = 0, updated = 0
  for (const m of ADMIN_MAPS) {
    const payload: any = {
      owner_id: ownerId,
      name: m.name,
      description: m.description,
      length_type: m.lengthType,
      complexity: m.complexity,
      world_height: m.worldHeight,
      wall_style: m.wallStyle,
      bg_image: m.bgImage,
      theme_weights: m.themeWeights,
      layout_config: m.layoutConfig,
      items: m.items,
      schema_version: 1,
      is_published: true,
      published_at: nowIso,
      validation_summary: res.summaries[m.key],
      validated_at: nowIso,
    }
    const existingId = byName.get(m.name)
    if (existingId) {
      const { error } = await sb.from('user_maps').update(payload).eq('id', existingId)
      if (error) { console.error(`❌ 업데이트 실패 [${m.name}]:`, error.message); process.exit(1) }
      console.log(`  ↻ 업데이트  ${m.name}  (${m.wallStyle}, ${m.complexity}/${m.lengthType})`)
      updated++
    } else {
      const { error } = await sb.from('user_maps').insert(payload)
      if (error) { console.error(`❌ 삽입 실패 [${m.name}]:`, error.message); process.exit(1) }
      console.log(`  ＋ 삽입      ${m.name}  (${m.wallStyle}, ${m.complexity}/${m.lengthType})`)
      inserted++
    }
  }
  console.log(`\n✅ 완료: 삽입 ${inserted} · 업데이트 ${updated} (owner=admin, is_published=true)`)
  console.log('   → 앱 /shop 맵 스토어 탭에서 10종 노출, admin 계정 /editor "내 맵"에서 관리 가능')
}

async function main() {
  loadEnvLocal()
  const checkOnly = process.argv.includes('--check')
  const explicitEmail = process.env.ADMIN_EMAIL
  const sb = admin()

  console.log(`── Admin 맵 시드 ${checkOnly ? '(환경 점검 전용)' : ''} ──`)
  const envOk = await checkEnv(sb)
  if (!envOk) process.exit(1)

  const owner = await resolveAdminOwner(sb, explicitEmail, !checkOnly)
  if (checkOnly) {
    const { count } = await sb.from('user_maps').select('id', { count: 'exact', head: true }).eq('is_published', true)
    console.log(`✓ 현재 배포된 커스텀 맵(user_maps is_published): ${count ?? 0}개`)
    console.log(owner ? `✓ 소유자 후보: ${owner.email || owner.id}` : 'ℹ 소유자 미해석(위 안내 참조)')
    console.log(`\nℹ 점검 완료. 실제 삽입: npx tsx scripts/seedAdminMaps.ts  (다른 계정: ADMIN_EMAIL=<이메일> …)`)
    return
  }
  if (!owner) process.exit(1)
  console.log(`소유 admin: ${owner.email || owner.id}`)
  await seed(sb, owner.id)
}

main().catch((e) => { console.error(e); process.exit(1) })
