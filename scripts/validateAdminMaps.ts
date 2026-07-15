/**
 * Admin 커스텀 맵 10종 헤드리스 검증 (docs/PRD-new-obstacles.md PART 2 §P2.6)
 *   실행: node --env-file=.env.local --import tsx scripts/validateAdminMaps.ts
 *   또는: npx tsx scripts/validateAdminMaps.ts
 *
 * 각 맵을 SimulationCore로 다회(기본 12) 실행하여:
 *   - 전원 완주(타임아웃 0) — 완주 가능성 보증(합격 필수 조건)
 *   - 완주시간 median/p90 리포트
 *   - 크래시 없음
 * 시드 스크립트가 runValidation()을 재사용해 배포 전 fail-closed 재검증한다.
 */
import { SimulationCore } from '../src/engine/SimulationCore'
import { ADMIN_MAPS, type AdminMapDef } from './adminMaps.data'

const WIDTH = 800

function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base]
}

export interface MapValidationSummary {
  key: string
  name: string
  races: number
  chips: number
  completionRate: number   // 0..1 (전 레이스 전 칩 완주 비율)
  timedOutRaces: number
  medianSec: number
  p90Sec: number
  pass: boolean
  checks: { name: string; pass: boolean }[]
}

function validateMap(def: AdminMapDef, races: number, chips: number): MapValidationSummary {
  const maxFrames = 240 * 60
  const finishTimes: number[] = []
  let timedOutRaces = 0
  let finishedTotal = 0
  const total = races * chips

  for (let r = 0; r < races; r++) {
    const rng = mulberry32(7000 + r * 6151 + def.key.length * 97)
    const survivors = Array.from({ length: chips }, (_, i) => ({ id: `c${i}`, name: `P${i}`, color: '#fff' }))
    const core = new SimulationCore()
    core.init({
      width: WIDTH, height: def.worldHeight, worldHeight: def.worldHeight,
      wallStyle: def.wallStyle as any, mapItems: def.items, gimmickDensity: 50,
      isCustomMap: true,  // 저작 맵: 밀도 주입 우회(편집본 그대로 재현)
      layoutConfig: def.layoutConfig, survivors, targetCount: chips,
      mode: 'speed', customRank: 1, rng,
    })

    const finishFrame: Record<string, number> = {}
    while (core.frame < maxFrames && Object.keys(finishFrame).length < chips) {
      core.step(1.0)
      for (const ev of core.events) {
        if (ev.type === 'CHIP_FINISHED') {
          const id = ev.payload.survivor.id
          if (finishFrame[id] === undefined) finishFrame[id] = core.frame
        }
      }
    }
    const done = Object.keys(finishFrame).length
    finishedTotal += done
    if (done < chips) timedOutRaces++
    for (const f of Object.values(finishFrame)) finishTimes.push(f / 60)
    core.free()
  }

  const ft = [...finishTimes].sort((a, b) => a - b)
  const medianSec = quantile(ft, 0.5)
  const p90Sec = quantile(ft, 0.9)
  const completionRate = finishedTotal / total

  const checks = [
    { name: '전원 완주(타임아웃 0)', pass: timedOutRaces === 0 },
    { name: '완주율 100%', pass: completionRate >= 0.999 },
    { name: '완주시간 median ≤ 150s', pass: Number.isFinite(medianSec) && medianSec <= 150 },
  ]
  const pass = checks.every((c) => c.pass)

  return { key: def.key, name: def.name, races, chips, completionRate, timedOutRaces, medianSec, p90Sec, pass, checks }
}

export interface ValidationResult {
  summaries: Record<string, MapValidationSummary>
  allPass: boolean
}

export async function runValidation(races = 12, chips = 14, only?: string): Promise<ValidationResult> {
  await SimulationCore.ensureRapier()
  const maps = only ? ADMIN_MAPS.filter((m) => m.key === only) : ADMIN_MAPS
  const summaries: Record<string, MapValidationSummary> = {}
  let allPass = true
  for (const def of maps) {
    const s = validateMap(def, races, chips)
    summaries[def.key] = s
    if (!s.pass) allPass = false
  }
  return { summaries, allPass }
}

function report(res: ValidationResult) {
  console.log(`\n헤드리스 맵 검증 결과 (races/맵, 14칩)\n${'─'.repeat(72)}`)
  for (const s of Object.values(res.summaries)) {
    const flag = s.pass ? '✅' : '❌'
    const md = Number.isFinite(s.medianSec) ? s.medianSec.toFixed(1) : '  - '
    const p9 = Number.isFinite(s.p90Sec) ? s.p90Sec.toFixed(1) : '  - '
    console.log(`${flag} ${s.name.padEnd(12)} 완주율 ${(s.completionRate * 100).toFixed(1)}%  타임아웃 ${s.timedOutRaces}/${s.races}  median ${md}s  p90 ${p9}s`)
    if (!s.pass) {
      for (const c of s.checks.filter((c) => !c.pass)) console.log(`     └ 실패: ${c.name}`)
    }
  }
  console.log('─'.repeat(72))
  console.log(res.allPass ? '✅ 전체 맵 검증 통과' : '❌ 일부 맵 검증 실패 — 레이아웃 조정 필요')
}

const isMain = (process.argv[1] || '').includes('validateAdminMaps')
if (isMain) {
  const races = Number(process.argv[2]) || 12
  const only = process.argv[3] && process.argv[3] !== 'all' ? process.argv[3] : undefined
  runValidation(races, 14, only)
    .then((res) => { report(res); process.exit(res.allPass ? 0 : 1) })
    .catch((e) => { console.error(e); process.exit(1) })
}
