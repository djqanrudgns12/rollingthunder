/**
 * 얼음블록(iceblock) 비주얼 에셋 절차적 생성기
 * ───────────────────────────────────────────────────────────────────────────
 * 실행:  npx tsx scripts/genIceAssets.ts
 *
 * 산출물 (public/images/assets/obstacles/):
 *   - ice_block_base.png        온전한 얼음 블록 (실루엣 밖 투명, 안쪽 불투명 고체 얼음)
 *   - ice_block_crack_1..4.png  단계별 균열 오버레이 (밝은 네온 선, additive 합성용)
 *   - ice_block_shatter.png     파괴 순간 플래시 프레임
 *
 * 설계 원칙:
 *   1. base·crack 모두 동일 좌표계·동일 블록 외곽(BLOCK) → 렌더 시 단계 교체해도 외곽이 흔들리지 않음.
 *   2. base는 실루엣 밖을 투명(alpha 0)으로 두어 게임 월드 위 "검은 박스" 아티팩트 제거.
 *   3. 균열은 불투명 얼음 표면 위의 "밝은 선"만 존재(관통 구멍/배경 노출 없음) → R5.
 *   4. 시드 고정 RNG → 재현 가능. 균열은 단계가 오를수록 이전 단계의 상위집합(누적).
 *
 * 매핑 상수(N, 단계 공식)는 src/lib/render/ObstacleRenderer.ts 의 ICE_CRACK_STAGES 와 일치해야 한다.
 */
import { createCanvas, type SKRSContext2D, type Canvas } from '@napi-rs/canvas'
import * as fs from 'fs'
import * as path from 'path'

// ── 캔버스/블록 지오메트리 (종횡비 ≈ 2.4:1, 기본 블록 60×25) ─────────────────
const W = 480
const H = 200
const INSET_X = 18 // 좌우 여백(글로우 번짐 공간)
const INSET_Y = 16 // 상하 여백
const BLOCK = {
  x: INSET_X,
  y: INSET_Y,
  w: W - INSET_X * 2,
  h: H - INSET_Y * 2,
  r: 14, // 코너 반경
}
const N_STAGES = 4 // ICE_CRACK_STAGES 와 동일해야 함

const OUT_DIR = path.resolve(__dirname, '../public/images/assets/obstacles')

// ── 시드 RNG (mulberry32) ────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── 공용 헬퍼 ────────────────────────────────────────────────────────────
function roundRectPath(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function newCanvas() {
  const canvas = createCanvas(W, H)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, W, H)
  return { canvas, ctx }
}

function save(canvas: Canvas, name: string) {
  const buf = canvas.toBuffer('image/png')
  const p = path.join(OUT_DIR, name)
  fs.writeFileSync(p, buf)
  console.log(`  ✓ ${name}  (${(buf.length / 1024).toFixed(0)} KB)`)
}

// ── 1. base: 온전한 얼음 블록 ────────────────────────────────────────────
function drawBase() {
  const { canvas, ctx } = newCanvas()
  const { x, y, w, h, r } = BLOCK
  const rnd = mulberry32(20260703)

  // (a) 외곽 네온 글로우 — 투명 여백으로 번짐 (검은 박스 없음)
  ctx.save()
  ctx.shadowColor = 'rgba(120, 245, 255, 0.9)'
  for (let i = 0; i < 3; i++) {
    ctx.shadowBlur = 26 - i * 6
    roundRectPath(ctx, x, y, w, h, r)
    ctx.fillStyle = 'rgba(90, 230, 250, 0.35)'
    ctx.fill()
  }
  ctx.restore()

  // (b) 얼음 본체 그라디언트 (불투명 고체 얼음)
  ctx.save()
  roundRectPath(ctx, x, y, w, h, r)
  ctx.clip()
  const grad = ctx.createLinearGradient(0, y, 0, y + h)
  grad.addColorStop(0, '#d6fbff')
  grad.addColorStop(0.28, '#8fe9f7')
  grad.addColorStop(0.62, '#49cfe6')
  grad.addColorStop(1, '#22a6c8')
  ctx.fillStyle = grad
  ctx.fillRect(x, y, w, h)

  // (c) 상단 광택(sheen) — 유리질 하이라이트
  const sheen = ctx.createLinearGradient(0, y, 0, y + h * 0.5)
  sheen.addColorStop(0, 'rgba(255,255,255,0.55)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(x, y, w, h * 0.5)

  // (d) 얼음 결(내부 미세 선) — 질감
  ctx.strokeStyle = 'rgba(255,255,255,0.20)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 7; i++) {
    const sx = x + rnd() * w
    const sy = y + rnd() * h
    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(sx + (rnd() - 0.5) * 60, sy + (rnd() - 0.5) * 30)
    ctx.stroke()
  }

  // (e) 하단 그림자(깊이감)
  const shade = ctx.createLinearGradient(0, y + h * 0.6, 0, y + h)
  shade.addColorStop(0, 'rgba(10,60,90,0)')
  shade.addColorStop(1, 'rgba(10,60,90,0.35)')
  ctx.fillStyle = shade
  ctx.fillRect(x, y + h * 0.6, w, h * 0.4)
  ctx.restore()

  // (f) 네온 테두리 (밝은 시안 + 안쪽 하이라이트)
  ctx.save()
  ctx.shadowColor = 'rgba(150, 250, 255, 0.9)'
  ctx.shadowBlur = 10
  roundRectPath(ctx, x + 1.5, y + 1.5, w - 3, h - 3, r - 1)
  ctx.strokeStyle = 'rgba(210, 252, 255, 0.95)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.shadowBlur = 0
  roundRectPath(ctx, x + 4, y + 4, w - 8, h - 8, r - 3)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()

  save(canvas, 'ice_block_base.png')
}

// ── 균열 지오메트리 생성 (누적) ──────────────────────────────────────────
type Pt = { x: number; y: number }
type Crack = { pts: Pt[]; width: number }

/** 지그재그 폴리라인 (a→b, 중점 변위) */
function jagged(a: Pt, b: Pt, segs: number, jitter: number, rnd: () => number): Pt[] {
  const pts: Pt[] = [a]
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    const nx = -(b.y - a.y)
    const ny = b.x - a.x
    const len = Math.hypot(nx, ny) || 1
    const off = (rnd() - 0.5) * jitter
    pts.push({
      x: a.x + (b.x - a.x) * t + (nx / len) * off,
      y: a.y + (b.y - a.y) * t + (ny / len) * off,
    })
  }
  pts.push(b)
  return pts
}

/**
 * 균열망을 "심각도 순서"로 누적 생성. 앞쪽 = 약한 단계에 먼저 등장.
 * 반환 배열을 slice(0, count) 하면 각 단계 오버레이가 된다.
 */
function buildCrackNetwork(): Crack[] {
  const rnd = mulberry32(77713)
  const { x, y, w, h } = BLOCK
  const cx = x + w / 2
  const cy = y + h / 2
  const cracks: Crack[] = []
  const edgePt = (): Pt => {
    // 블록 가장자리 임의 지점
    const side = Math.floor(rnd() * 4)
    if (side === 0) return { x: x + rnd() * w, y: y + 4 }
    if (side === 1) return { x: x + w - 4, y: y + rnd() * h }
    if (side === 2) return { x: x + rnd() * w, y: y + h - 4 }
    return { x: x + 4, y: y + rnd() * h }
  }

  // 1차: 중앙 부근에서 가장자리로 뻗는 주 균열 (심각도 낮음→높음 순으로 나열)
  const origin: Pt = { x: cx + (rnd() - 0.5) * w * 0.2, y: cy + (rnd() - 0.5) * h * 0.2 }
  const mains = 6
  for (let i = 0; i < mains; i++) {
    const end = edgePt()
    const start = i < 2 ? { x: cx + (rnd() - 0.5) * 30, y: cy + (rnd() - 0.5) * 20 } : origin
    cracks.push({ pts: jagged(start, end, 5 + Math.floor(rnd() * 3), 10 + rnd() * 10, rnd), width: 2.6 })
  }

  // 2차: 주 균열에서 갈라지는 잔가지
  const branchCount = 9
  for (let i = 0; i < branchCount; i++) {
    const parent = cracks[Math.floor(rnd() * cracks.length)]
    const p = parent.pts[1 + Math.floor(rnd() * (parent.pts.length - 2))]
    const end: Pt = {
      x: Math.max(x + 3, Math.min(x + w - 3, p.x + (rnd() - 0.5) * w * 0.5)),
      y: Math.max(y + 3, Math.min(y + h - 3, p.y + (rnd() - 0.5) * h * 0.5)),
    }
    cracks.push({ pts: jagged(p, end, 3 + Math.floor(rnd() * 2), 6 + rnd() * 6, rnd), width: 1.6 })
  }

  return cracks
}

const NETWORK = buildCrackNetwork()

/** 단계별로 그릴 균열 개수 (누적). index 0 = stage1 */
function crackCountForStage(stage: number): number {
  const total = NETWORK.length
  // stage 1→약간, 4→전체
  const ratio = stage / N_STAGES
  return Math.max(1, Math.round(total * ratio * ratio)) // 후반에 급격히 조밀
}

function tracePath(ctx: SKRSContext2D, pts: Pt[]) {
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
}

/**
 * 밝은 얼음 위에 "진짜 금"처럼 보이도록 normal 블렌드로 그린다.
 *   1) 어두운 틈(fissure) : 균열 사이 그림자
 *   2) 흰 하이라이트       : 빛을 받는 파단면
 * (additive 아님 — 밝은 base 위에서 뭉개지지 않도록)
 */
function strokeCrack(ctx: SKRSContext2D, c: Crack, mul = 1) {
  ctx.save()
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // 1) 어두운 틈 (약간의 소프트 섀도로 깊이감)
  ctx.shadowColor = 'rgba(8, 34, 54, 0.5)'
  ctx.shadowBlur = 3
  ctx.strokeStyle = `rgba(14, 48, 74, ${0.55 * mul})`
  ctx.lineWidth = c.width + 1.2
  tracePath(ctx, c.pts)
  ctx.stroke()

  // 2) 흰/시안 하이라이트 코어
  ctx.shadowColor = 'rgba(200, 248, 255, 0.85)'
  ctx.shadowBlur = 4
  ctx.strokeStyle = `rgba(238, 253, 255, ${0.92 * mul})`
  ctx.lineWidth = Math.max(0.8, c.width - 0.8)
  tracePath(ctx, c.pts)
  ctx.stroke()
  ctx.restore()
}

// ── 2. crack_1..N: 단계별 균열 오버레이 ──────────────────────────────────
function drawCrackStage(stage: number) {
  const { canvas, ctx } = newCanvas()
  // 블록 외곽 안으로 클립 → 균열이 얼음 밖으로 새지 않음
  ctx.save()
  roundRectPath(ctx, BLOCK.x, BLOCK.y, BLOCK.w, BLOCK.h, BLOCK.r)
  ctx.clip()
  const count = crackCountForStage(stage)
  for (let i = 0; i < count; i++) {
    strokeCrack(ctx, NETWORK[i])
  }
  ctx.restore()
  save(canvas, `ice_block_crack_${stage}.png`)
}

// ── 3. shatter: 파괴 순간 플래시 ─────────────────────────────────────────
function drawShatter() {
  const { canvas, ctx } = newCanvas()
  const rnd = mulberry32(9001)
  const { x, y, w, h } = BLOCK
  const cx = x + w / 2
  const cy = y + h / 2

  ctx.save()
  roundRectPath(ctx, x, y, w, h, BLOCK.r)
  ctx.clip()
  // 전체 균열망을 강하게
  for (const c of NETWORK) strokeCrack(ctx, c, 1.15)
  // 중앙 방사형 파열 섬광
  ctx.save()
  ctx.shadowColor = 'rgba(220,255,255,1)'
  ctx.shadowBlur = 16
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 2
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rnd() * 0.3
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * w * 0.55, cy + Math.sin(a) * h * 0.7)
    ctx.stroke()
  }
  ctx.restore()
  ctx.restore()

  // 흩어지는 파편 조각(블록 밖으로 튐)
  ctx.save()
  ctx.shadowColor = 'rgba(150,240,255,0.9)'
  ctx.shadowBlur = 8
  ctx.fillStyle = 'rgba(180, 245, 255, 0.9)'
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2
    const dist = 20 + rnd() * 40
    const px = cx + Math.cos(a) * dist
    const py = cy + Math.sin(a) * dist
    const s = 3 + rnd() * 5
    ctx.beginPath()
    ctx.moveTo(px, py)
    ctx.lineTo(px + s, py + s * 0.4)
    ctx.lineTo(px + s * 0.3, py + s)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  save(canvas, 'ice_block_shatter.png')
}

// ── 실행 ─────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log('얼음블록 에셋 생성 중...')
  drawBase()
  for (let s = 1; s <= N_STAGES; s++) drawCrackStage(s)
  drawShatter()
  console.log('완료. 총', N_STAGES + 2, '개 파일 →', OUT_DIR)
}

main()
