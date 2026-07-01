/**
 * 인-에디터 맵 검증 (scripts/simulate.ts 의 지표 로직을 브라우저용으로 이식).
 * 현재 에디터 items 로 SimulationCore 를 N회 헤드리스 실행하여 품질 지표 + 칩 이동 히트맵을 산출한다.
 * 메인 스레드에서 레이스마다 yield 하여 UI 프리즈를 완화한다(수동 "검증 실행" 액션).
 */
import type { EditorItem } from '@/store/editorStore'

const WIDTH = 800
const MAX_FRAMES = 240 * 60
const SAMPLE_EVERY = 4 // 히트맵/속도 샘플링 프레임 간격

export interface HeatmapData { cols: number; rows: number; cell: number; grid: number[]; max: number }
export interface CheckRow { label: string; ok: boolean; value: string; target: string }
export interface ValidationResult {
  races: number; chips: number
  medianFinish: number; p10: number; p90: number; avgSpeed: number
  fairness: number; edgePct: number
  gravityStorms: number; timedOutRaces: number; avgLeadChanges: number
  avgGimmickRate: number; deadGimmicks: { type: string; count: number }[]
  stuckSamples: { x: number; y: number }[]
  heatmap: HeatmapData
  checks: CheckRow[]
}
export interface ValidationConfig {
  items: EditorItem[]; worldHeight: number; wallStyle: string
  layoutConfig?: any; races?: number; chips?: number
}

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
  const pos = (sorted.length - 1) * q, base = Math.floor(pos), rest = pos - base
  return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base]
}
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length; if (n === 0) return NaN
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; syy += ys[i] * ys[i]; sxy += xs[i] * ys[i] }
  const cov = sxy - (sx * sy) / n, vx = sxx - (sx * sx) / n, vy = syy - (sy * sy) / n
  const d = Math.sqrt(vx * vy); return d === 0 ? 0 : cov / d
}
function innerBounds(style: string): [number, number] {
  if (style === 'narrow') return [100, WIDTH - 100]
  if (style === 'wide') return [-50, WIDTH + 50]
  return [0, WIDTH]
}
const MAIN_TYPES = new Set(['windmill', 'blackhole', 'whitehole', 'booster', 'portal', 'hole', 'piston'])
function interactionRadius(item: any): number {
  switch (item.type) {
    case 'windmill': return 62
    case 'blackhole': case 'whitehole': return item.radius || 150
    case 'booster': return 40
    case 'portal': return 35
    case 'hole': return (item.radius || 30) + 12
    case 'piston': return (item.w || 100) / 2 + 18
    default: return 0
  }
}

export async function runValidation(cfg: ValidationConfig, onProgress?: (p: number) => void): Promise<ValidationResult> {
  const races = cfg.races ?? 8
  const chips = cfg.chips ?? 10
  const wh = cfg.worldHeight || 3300
  const style = cfg.wallStyle || 'straight'
  const [innerL, innerR] = innerBounds(style)
  const edgeNear = 45

  const { SimulationCore } = await import('@/engine/SimulationCore')
  await SimulationCore.ensureRapier()

  const cell = 40
  const cols = Math.ceil(WIDTH / cell)
  const rows = Math.ceil(wh / cell)
  const grid = new Array(cols * rows).fill(0)

  const finishTimes: number[] = []
  const spawnXs: number[] = []
  const rankNorms: number[] = []
  const leadChangesArr: number[] = []
  const stuckSamples: { x: number; y: number }[] = []
  let gravityStorms = 0, timedOutRaces = 0, edgeHuggers = 0, totalChips = 0
  let speedSum = 0, speedSamples = 0

  const mainGimmicks = cfg.items
    .filter((it: any) => MAIN_TYPES.has(it.type))
    .map((it: any, idx: number) => ({ id: it.id || `${it.type}_${idx}`, type: it.type, x: it.x, y: it.y, r: interactionRadius(it) }))
  const gimmickHits = new Map<string, { type: string; hit: number; total: number }>()
  for (const g of mainGimmicks) gimmickHits.set(g.id, { type: g.type, hit: 0, total: 0 })

  for (let r = 0; r < races; r++) {
    const rng = mulberry32(1000 + r * 7919 + (cfg.items.length + 1) * 31)
    const survivors = Array.from({ length: chips }, (_, i) => ({ id: `c${i}`, name: `P${i}`, color: '#fff' }))
    const core = new SimulationCore()
    core.init({
      width: WIDTH, height: wh, worldHeight: wh, wallStyle: style as any,
      mapItems: cfg.items, gimmickDensity: 50, survivors, targetCount: chips,
      mode: 'speed', customRank: 1, rng, isCustomMap: true, layoutConfig: cfg.layoutConfig,
    } as any)

    const spawn: Record<string, number> = {}
    core.activeChips.forEach((c: any) => { spawn[(c.userData as any).id] = c.translation().x })

    const finishFrame: Record<string, number> = {}
    const gimmickSeen: Record<string, Set<string>> = {}
    for (const g of mainGimmicks) gimmickSeen[g.id] = new Set()
    const edgeFrames: Record<string, number> = {}
    let aliveFrames = 0
    let leadId: string | null = null, leadChanges = 0

    while (core.frame < MAX_FRAMES && Object.keys(finishFrame).length < chips) {
      core.step(1.0)
      aliveFrames++
      for (const ev of core.events as any[]) {
        if (ev.type === 'CHIP_FINISHED') { const id = ev.payload.survivor.id; if (finishFrame[id] === undefined) finishFrame[id] = core.frame }
        else if (ev.type === 'GRAVITY_STORM') gravityStorms++
        else if (ev.type === 'RANKINGS_UPDATE') { const top = ev.payload[0]; if (top && top.id !== leadId) { if (leadId !== null) leadChanges++; leadId = top.id } }
      }
      const sample = core.frame % SAMPLE_EVERY === 0
      for (const c of core.activeChips as any[]) {
        const id = (c.userData as any).id
        if (finishFrame[id] !== undefined) continue
        const t = c.translation()
        if (sample) {
          const v = c.linvel(); speedSum += Math.sqrt(v.x * v.x + v.y * v.y); speedSamples++
          const gx = Math.floor(t.x / cell), gy = Math.floor(t.y / cell)
          if (gx >= 0 && gx < cols && gy >= 0 && gy < rows) grid[gy * cols + gx] += 1
        }
        if (t.x - innerL < edgeNear || innerR - t.x < edgeNear) edgeFrames[id] = (edgeFrames[id] || 0) + 1
        for (const g of mainGimmicks) { const dx = t.x - g.x, dy = t.y - g.y; if (dx * dx + dy * dy < g.r * g.r) gimmickSeen[g.id].add(id) }
      }
    }

    if (Object.keys(finishFrame).length < chips) {
      timedOutRaces++
      for (const c of core.activeChips as any[]) {
        const id = (c.userData as any).id
        if (finishFrame[id] === undefined) { const t = c.translation(); stuckSamples.push({ x: Math.round(t.x), y: Math.round(t.y) }) }
      }
    }
    leadChangesArr.push(leadChanges)

    const order = survivors.map(s => s.id).sort((a, b) => (finishFrame[a] ?? Infinity) - (finishFrame[b] ?? Infinity))
    order.forEach((id, idx) => {
      spawnXs.push(spawn[id]); rankNorms.push(chips > 1 ? idx / (chips - 1) : 0)
      if (finishFrame[id] !== undefined) finishTimes.push(finishFrame[id] / 60)
      totalChips++
      if ((edgeFrames[id] || 0) / Math.max(1, aliveFrames) > 0.5) edgeHuggers++
    })
    for (const g of mainGimmicks) { const rec = gimmickHits.get(g.id)!; rec.hit += gimmickSeen[g.id].size; rec.total += chips }

    core.free()
    onProgress?.((r + 1) / races)
    await new Promise(res => setTimeout(res, 0))
  }

  const ft = [...finishTimes].sort((a, b) => a - b)
  const med = quantile(ft, 0.5), p10 = quantile(ft, 0.1), p90 = quantile(ft, 0.9)
  const fairness = Math.abs(pearson(spawnXs, rankNorms))
  const edgePct = totalChips ? (edgeHuggers / totalChips) * 100 : 0
  const avgLead = leadChangesArr.length ? leadChangesArr.reduce((a, b) => a + b, 0) / leadChangesArr.length : 0
  const rates: { type: string; rate: number }[] = []
  gimmickHits.forEach(rec => rates.push({ type: rec.type, rate: rec.total ? rec.hit / rec.total : 0 }))
  const dead = rates.filter(g => g.rate < 0.15)
  const deadByType: Record<string, number> = {}
  dead.forEach(d => { deadByType[d.type] = (deadByType[d.type] || 0) + 1 })
  const avgGimmick = rates.length ? rates.reduce((a, b) => a + b.rate, 0) / rates.length : NaN
  const avgSpeed = speedSamples ? speedSum / speedSamples : NaN
  const max = grid.reduce((a, b) => Math.max(a, b), 0)

  const fmt = (n: number, d = 1) => Number.isFinite(n) ? n.toFixed(d) : '-'
  const checks: CheckRow[] = [
    { label: '완주시간(중앙)', ok: med >= 45 && med <= 70, value: `${fmt(med)}s`, target: '45~70s' },
    { label: '공정성', ok: fairness < 0.25, value: fmt(fairness, 2), target: '<0.25' },
    { label: '엣지허깅', ok: edgePct < 12, value: `${fmt(edgePct)}%`, target: '<12%' },
    { label: '정체(스톰/미완주)', ok: gravityStorms === 0 && timedOutRaces === 0, value: `${gravityStorms}/${timedOutRaces}`, target: '0/0' },
    { label: '박진감(선두교체)', ok: avgLead >= 3, value: fmt(avgLead), target: '≥3' },
    { label: '기믹적중', ok: dead.length === 0, value: `${fmt(avgGimmick * 100)}% (죽은 ${dead.length})`, target: '죽은 0' },
  ]

  return {
    races, chips, medianFinish: med, p10, p90, avgSpeed, fairness, edgePct,
    gravityStorms, timedOutRaces, avgLeadChanges: avgLead, avgGimmickRate: avgGimmick,
    deadGimmicks: Object.entries(deadByType).map(([type, count]) => ({ type, count })),
    stuckSamples: stuckSamples.slice(0, 30),
    heatmap: { cols, rows, cell, grid, max },
    checks,
  }
}
