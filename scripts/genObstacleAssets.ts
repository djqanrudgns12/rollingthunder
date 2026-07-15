/**
 * 신규 장애물 히어로 에셋 절차적 생성기 (docs/PRD-new-obstacles.md)
 * ───────────────────────────────────────────────────────────────────────────
 * 실행:  npx tsx scripts/genObstacleAssets.ts
 *
 * 산출물 (public/images/assets/obstacles/):
 *   - obstacle_conveyor.png   256×64  컨베이어 벨트 (가로 타일링용 — TilingSprite)
 *   - obstacle_mine.png       256×256 지뢰 (구형 기뢰 + 스파이크 + 적색 경고등)
 *   - obstacle_cannon.png     256×256 캐논 (포신 위(0°=UP) 방향 — 부스터 규약과 동일)
 *   - obstacle_pendulum.png   256×256 진자 파괴추 (추 본체 — 사슬은 렌더러가 프로시저럴)
 *   - obstacle_supernova.png  256×256 초신성 펄사 코어
 *
 * 설계 원칙 (genIceAssets.ts 와 동일):
 *   1. 캔버스는 clearRect 로 시작 — 실루엣 밖은 진짜 투명(alpha 0). 가짜 체커보드/검은 박스 없음.
 *   2. 글로우는 shadowBlur 로 투명 여백에 자연 번짐.
 *   3. 시드 고정 RNG → 재현 가능.
 *   4. conveyor 는 가로 타일링을 위해 64px 셀 내부에만 셰브론 배치(경계 침범 없음).
 */
import { createCanvas, type SKRSContext2D, type Canvas } from '@napi-rs/canvas'
import * as fs from 'fs'
import * as path from 'path'

const OUT_DIR = path.resolve(__dirname, '../public/images/assets/obstacles')

function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function newCanvas(w: number, h: number) {
  const canvas = createCanvas(w, h)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, w, h) // 진짜 투명 배경
  return { canvas, ctx }
}

function save(canvas: Canvas, name: string) {
  const buf = canvas.toBuffer('image/png')
  fs.writeFileSync(path.join(OUT_DIR, name), buf)
  console.log(`  ✓ ${name}  (${(buf.length / 1024).toFixed(0)} KB)`)
}

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

// ── 1. 컨베이어 벨트 (256×64, 가로 타일링) ────────────────────────────────
function drawConveyor() {
  const W = 256, H = 64
  const { canvas, ctx } = newCanvas(W, H)

  // 벨트 본체 (상하 4px 여백 — 글로우 공간, 가로는 타일링 위해 edge-to-edge)
  const top = 6, bottom = H - 6
  const bodyGrad = ctx.createLinearGradient(0, top, 0, bottom)
  bodyGrad.addColorStop(0, '#3a3f4a')
  bodyGrad.addColorStop(0.5, '#20242c')
  bodyGrad.addColorStop(1, '#12141a')
  ctx.fillStyle = bodyGrad
  ctx.fillRect(0, top, W, bottom - top)

  // 상/하 레일 (금속 스트립)
  for (const y of [top, bottom - 7]) {
    const railGrad = ctx.createLinearGradient(0, y, 0, y + 7)
    railGrad.addColorStop(0, '#8a93a5')
    railGrad.addColorStop(1, '#454c5a')
    ctx.fillStyle = railGrad
    ctx.fillRect(0, y, W, 7)
  }

  // 롤러 (일정 간격 세로 하이라이트 — 타일링 주기 32px)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  for (let x = 0; x < W; x += 32) ctx.fillRect(x, top + 8, 2, bottom - top - 16)

  // 진행 방향 셰브론 (64px 셀 중앙 — 경계 침범 없음, 네온 앰버)
  ctx.save()
  ctx.shadowColor = 'rgba(255, 190, 60, 0.9)'
  ctx.shadowBlur = 8
  for (let cell = 0; cell < 4; cell++) {
    const cx = cell * 64 + 32
    const cy = H / 2
    ctx.beginPath()
    ctx.moveTo(cx - 10, cy - 12)
    ctx.lineTo(cx + 6, cy)
    ctx.lineTo(cx - 10, cy + 12)
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#ffc23d'
    ctx.stroke()
  }
  ctx.restore()

  // 상단 광택
  const sheen = ctx.createLinearGradient(0, top, 0, H / 2)
  sheen.addColorStop(0, 'rgba(255,255,255,0.18)')
  sheen.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = sheen
  ctx.fillRect(0, top, W, H / 2 - top)

  save(canvas, 'obstacle_conveyor.png')
}

// ── 2. 지뢰 (256×256) ─────────────────────────────────────────────────────
function drawMine() {
  const W = 256, H = 256
  const { canvas, ctx } = newCanvas(W, H)
  const cx = W / 2, cy = H / 2 + 6
  const R = 82

  // 스파이크 (8방향, 본체보다 먼저 — 뒤에 깔림)
  ctx.save()
  ctx.shadowColor = 'rgba(255, 90, 60, 0.5)'
  ctx.shadowBlur = 6
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const tipX = cx + Math.cos(a) * (R + 34)
    const tipY = cy + Math.sin(a) * (R + 34)
    const baseA = 0.16
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a - baseA) * (R - 6), cy + Math.sin(a - baseA) * (R - 6))
    ctx.lineTo(tipX, tipY)
    ctx.lineTo(cx + Math.cos(a + baseA) * (R - 6), cy + Math.sin(a + baseA) * (R - 6))
    ctx.closePath()
    const spikeGrad = ctx.createLinearGradient(cx, cy, tipX, tipY)
    spikeGrad.addColorStop(0, '#5a616e')
    spikeGrad.addColorStop(1, '#9aa3b2')
    ctx.fillStyle = spikeGrad
    ctx.fill()
  }
  ctx.restore()

  // 본체 구체
  const bodyGrad = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R)
  bodyGrad.addColorStop(0, '#525a68')
  bodyGrad.addColorStop(0.55, '#2a2f3a')
  bodyGrad.addColorStop(1, '#14161c')
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fillStyle = bodyGrad
  ctx.fill()

  // 적도 리벳 밴드
  ctx.strokeStyle = 'rgba(150,160,175,0.5)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.ellipse(cx, cy, R * 0.92, R * 0.34, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = 'rgba(190,200,215,0.75)'
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * R * 0.92, cy + Math.sin(a) * R * 0.34, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // 스펙큘러 하이라이트
  const spec = ctx.createRadialGradient(cx - R * 0.4, cy - R * 0.45, 2, cx - R * 0.4, cy - R * 0.45, R * 0.5)
  spec.addColorStop(0, 'rgba(255,255,255,0.5)')
  spec.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fillStyle = spec
  ctx.fill()

  // 상단 경고등 (적색 네온 글로우)
  ctx.save()
  ctx.shadowColor = 'rgba(255, 40, 40, 1)'
  ctx.shadowBlur = 22
  ctx.beginPath()
  ctx.arc(cx, cy - R - 6, 13, 0, Math.PI * 2)
  const lampGrad = ctx.createRadialGradient(cx - 3, cy - R - 10, 1, cx, cy - R - 6, 13)
  lampGrad.addColorStop(0, '#ffd0d0')
  lampGrad.addColorStop(0.4, '#ff4444')
  lampGrad.addColorStop(1, '#aa0000')
  ctx.fillStyle = lampGrad
  ctx.fill()
  ctx.restore()
  // 경고등 받침
  ctx.fillStyle = '#3a4050'
  ctx.fillRect(cx - 9, cy - R - 2, 18, 8)

  save(canvas, 'obstacle_mine.png')
}

// ── 3. 캐논 (256×256, 포신 위 방향 = 0°) ─────────────────────────────────
function drawCannon() {
  const W = 256, H = 256
  const { canvas, ctx } = newCanvas(W, H)
  const cx = W / 2, cy = H / 2

  // 포신 (중심 → 위)
  const barrelW = 56
  const barrelTop = 22
  const barrelGrad = ctx.createLinearGradient(cx - barrelW / 2, 0, cx + barrelW / 2, 0)
  barrelGrad.addColorStop(0, '#1c2028')
  barrelGrad.addColorStop(0.3, '#5c6575')
  barrelGrad.addColorStop(0.5, '#79839a')
  barrelGrad.addColorStop(0.7, '#5c6575')
  barrelGrad.addColorStop(1, '#1c2028')
  ctx.fillStyle = barrelGrad
  roundRectPath(ctx, cx - barrelW / 2, barrelTop, barrelW, cy - barrelTop + 10, 10)
  ctx.fill()

  // 머즐 링 (네온 시안)
  ctx.save()
  ctx.shadowColor = 'rgba(0, 230, 255, 0.9)'
  ctx.shadowBlur = 12
  ctx.strokeStyle = '#37e6ff'
  ctx.lineWidth = 6
  roundRectPath(ctx, cx - barrelW / 2 - 5, barrelTop, barrelW + 10, 18, 8)
  ctx.stroke()
  ctx.restore()

  // 포신 밴드 2개
  ctx.fillStyle = 'rgba(20,24,32,0.85)'
  ctx.fillRect(cx - barrelW / 2 - 4, barrelTop + 44, barrelW + 8, 10)
  ctx.fillRect(cx - barrelW / 2 - 4, barrelTop + 78, barrelW + 8, 10)

  // 본체 원형 베이스
  const R = 66
  const baseGrad = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R)
  baseGrad.addColorStop(0, '#4a5262')
  baseGrad.addColorStop(0.6, '#262b36')
  baseGrad.addColorStop(1, '#12151c')
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fillStyle = baseGrad
  ctx.fill()
  ctx.save()
  ctx.shadowColor = 'rgba(0, 230, 255, 0.6)'
  ctx.shadowBlur = 10
  ctx.strokeStyle = 'rgba(80, 220, 255, 0.85)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(cx, cy, R - 2, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // 포획 코어 (에너지 소용돌이 — 진입구)
  const coreGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 34)
  coreGrad.addColorStop(0, '#d8fbff')
  coreGrad.addColorStop(0.45, '#37e6ff')
  coreGrad.addColorStop(1, 'rgba(0, 60, 90, 0.0)')
  ctx.save()
  ctx.shadowColor = 'rgba(0, 230, 255, 0.9)'
  ctx.shadowBlur = 18
  ctx.beginPath()
  ctx.arc(cx, cy, 34, 0, Math.PI * 2)
  ctx.fillStyle = coreGrad
  ctx.fill()
  ctx.restore()

  // 리벳
  ctx.fillStyle = 'rgba(200,210,225,0.8)'
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    ctx.beginPath()
    ctx.arc(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12), 3.5, 0, Math.PI * 2)
    ctx.fill()
  }

  save(canvas, 'obstacle_cannon.png')
}

// ── 4. 진자 파괴추 (256×256, 추 본체) ─────────────────────────────────────
function drawPendulum() {
  const W = 256, H = 256
  const { canvas, ctx } = newCanvas(W, H)
  const cx = W / 2, cy = H / 2 + 14
  const R = 92

  // 상단 샤클(사슬 연결 고리)
  ctx.save()
  ctx.strokeStyle = '#6a7382'
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.arc(cx, cy - R - 12, 20, Math.PI * 0.9, Math.PI * 2.1)
  ctx.stroke()
  ctx.restore()

  // 추 본체 (강철 구)
  const bodyGrad = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.08, cx, cy, R)
  bodyGrad.addColorStop(0, '#8b95a8')
  bodyGrad.addColorStop(0.4, '#4c5563')
  bodyGrad.addColorStop(0.75, '#272c37')
  bodyGrad.addColorStop(1, '#13161d')
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fillStyle = bodyGrad
  ctx.fill()

  // 위험 표식 (네온 마젠타 밴드 + 해저드 스트라이프)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-Math.PI / 8)
  ctx.fillStyle = 'rgba(255, 60, 160, 0.28)'
  for (let i = -3; i <= 3; i += 2) ctx.fillRect(-R, i * 22, R * 2, 14)
  ctx.restore()
  ctx.restore()

  // 적도 링
  ctx.save()
  ctx.shadowColor = 'rgba(255, 60, 160, 0.8)'
  ctx.shadowBlur = 10
  ctx.strokeStyle = 'rgba(255, 90, 180, 0.9)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.ellipse(cx, cy, R * 0.94, R * 0.3, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // 스펙큘러 하이라이트
  const spec = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.48, 2, cx - R * 0.42, cy - R * 0.48, R * 0.55)
  spec.addColorStop(0, 'rgba(255,255,255,0.65)')
  spec.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fillStyle = spec
  ctx.fill()

  save(canvas, 'obstacle_pendulum.png')
}

// ── 5. 초신성 펄사 (256×256) ──────────────────────────────────────────────
function drawSupernova() {
  const W = 256, H = 256
  const { canvas, ctx } = newCanvas(W, H)
  const cx = W / 2, cy = H / 2
  const rnd = mulberry32(20260714)

  // 외곽 코로나 (마젠타 → 투명)
  const corona = ctx.createRadialGradient(cx, cy, 20, cx, cy, 124)
  corona.addColorStop(0, 'rgba(255, 120, 60, 0.55)')
  corona.addColorStop(0.5, 'rgba(255, 40, 140, 0.30)')
  corona.addColorStop(1, 'rgba(160, 0, 200, 0)')
  ctx.beginPath()
  ctx.arc(cx, cy, 124, 0, Math.PI * 2)
  ctx.fillStyle = corona
  ctx.fill()

  // 광선 스파이크 (12방향, 길이 랜덤)
  ctx.save()
  ctx.shadowColor = 'rgba(255, 200, 90, 0.9)'
  ctx.shadowBlur = 10
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rnd() * 0.2
    const len = 78 + rnd() * 44
    const wBase = 7 + rnd() * 5
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a - Math.PI / 2) * wBase * 0.5, cy + Math.sin(a - Math.PI / 2) * wBase * 0.5)
    ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len)
    ctx.lineTo(cx + Math.cos(a + Math.PI / 2) * wBase * 0.5, cy + Math.sin(a + Math.PI / 2) * wBase * 0.5)
    ctx.closePath()
    const rayGrad = ctx.createLinearGradient(cx, cy, cx + Math.cos(a) * len, cy + Math.sin(a) * len)
    rayGrad.addColorStop(0, 'rgba(255, 240, 200, 0.95)')
    rayGrad.addColorStop(0.6, 'rgba(255, 160, 70, 0.55)')
    rayGrad.addColorStop(1, 'rgba(255, 80, 160, 0)')
    ctx.fillStyle = rayGrad
    ctx.fill()
  }
  ctx.restore()

  // 에너지 링
  ctx.save()
  ctx.shadowColor = 'rgba(255, 170, 60, 0.9)'
  ctx.shadowBlur = 14
  ctx.strokeStyle = 'rgba(255, 210, 120, 0.8)'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.arc(cx, cy, 58, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()

  // 백열 코어
  const core = ctx.createRadialGradient(cx, cy, 2, cx, cy, 44)
  core.addColorStop(0, '#ffffff')
  core.addColorStop(0.35, '#ffe9b0')
  core.addColorStop(0.7, '#ff9440')
  core.addColorStop(1, 'rgba(255, 90, 60, 0)')
  ctx.save()
  ctx.shadowColor = 'rgba(255, 230, 160, 1)'
  ctx.shadowBlur = 24
  ctx.beginPath()
  ctx.arc(cx, cy, 44, 0, Math.PI * 2)
  ctx.fillStyle = core
  ctx.fill()
  ctx.restore()

  save(canvas, 'obstacle_supernova.png')
}

// ── 실행 ──────────────────────────────────────────────────────────────────
function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log('신규 장애물 히어로 에셋 생성 중...')
  drawConveyor()
  drawMine()
  drawCannon()
  drawPendulum()
  drawSupernova()
  console.log('완료. 총 5개 파일 →', OUT_DIR)
}

main()
