'use client'

import { useEffect, useImperativeHandle, useRef, useSyncExternalStore } from 'react'
import { Field, Label, Switch } from '@headlessui/react'
import { useGameStore } from '@/store/gameStore'

export type HeroPhysicsHandle = {
  /** 데모 입력창에서 받은 이름들을 라벨 칩으로 투하 */
  spawnNames: (names: string[]) => void
}

type Chip = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  color: string
  label?: string
  /** 스폰 팝인 연출 기준 시각 (0이면 연출 생략) */
  born: number
}

type Ripple = { x: number; y: number; born: number }

const PALETTE = [
  'hsl(170, 100%, 50%)', // cyan (accent-primary)
  'hsl(280, 80%, 65%)', // purple (accent-secondary)
  'hsl(35, 100%, 55%)', // amber
  'hsl(330, 90%, 62%)', // pink
  'hsl(200, 95%, 60%)', // blue
  'hsl(90, 75%, 55%)', // lime
]

const MAX_CHIPS = 48
const GRAVITY = 2000 // px/s²
const POINTER_RADIUS = 130
const POINTER_FORCE = 2600
const SHOCKWAVE_RADIUS = 240
const SHOCKWAVE_FORCE = 900
const RIPPLE_LIFE_MS = 650
/** 사용자가 토글로 직접 정한 값이 모션 저감 감지보다 우선한다 */
const MOTION_STORAGE_KEY = 'rt-hero-motion'
const MOTION_CHANGE_EVENT = 'rt-hero-motion-change'

// ── 모션 선호를 외부 스토어로 구독 (useSyncExternalStore) ──
// SSR에서는 'unknown'을 반환해 하이드레이션 불일치 없이, 마운트 직후 클라이언트 값으로 갱신된다.
function subscribeMotionPref(callback: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  window.addEventListener(MOTION_CHANGE_EVENT, callback)
  window.addEventListener('storage', callback)
  mq.addEventListener('change', callback)
  return () => {
    window.removeEventListener(MOTION_CHANGE_EVENT, callback)
    window.removeEventListener('storage', callback)
    mq.removeEventListener('change', callback)
  }
}

function getMotionSnapshot(): 'on' | 'off' {
  // 사용자 저장값이 있으면 그것을 존중, 없으면 기본 ON
  const saved = localStorage.getItem(MOTION_STORAGE_KEY)
  if (saved === 'on' || saved === 'off') return saved
  return 'on'
}

const getMotionServerSnapshot = () => 'unknown' as const

function makeChip(x: number, y: number, label?: string): Chip {
  return {
    x,
    y,
    vx: (Math.random() - 0.5) * 160,
    vy: 0,
    r: label ? 22 + Math.random() * 4 : 13 + Math.random() * 9,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    label,
    born: performance.now(),
  }
}

/** 물리 1스텝 — 애니메이션 루프와 정적 모드의 빨리감기(fast-forward)가 공유한다 */
function stepPhysics(chips: Chip[], dt: number, w: number, h: number, px: number, py: number) {
  for (const c of chips) {
    c.vy += GRAVITY * dt

    // 포인터 반발력
    const dx = c.x - px
    const dy = c.y - py
    const d2 = dx * dx + dy * dy
    if (d2 > 1 && d2 < POINTER_RADIUS * POINTER_RADIUS) {
      const d = Math.sqrt(d2)
      const f = (1 - d / POINTER_RADIUS) * POINTER_FORCE
      c.vx += (dx / d) * f * dt
      c.vy += (dy / d) * f * dt
    }

    c.x += c.vx * dt
    c.y += c.vy * dt

    // 벽/바닥 반발
    if (c.x < c.r) { c.x = c.r; c.vx = Math.abs(c.vx) * 0.5 }
    if (c.x > w - c.r) { c.x = w - c.r; c.vx = -Math.abs(c.vx) * 0.5 }
    if (c.y > h - c.r) {
      c.y = h - c.r
      c.vy = -Math.abs(c.vy) * 0.42
      c.vx *= 0.94
    }
  }

  // 칩끼리 충돌 (동일 질량 탄성 충돌 근사, n≤48이라 O(n²)로 충분 — 2회 반복으로 안정화)
  for (let iter = 0; iter < 2; iter++) {
    for (let i = 0; i < chips.length; i++) {
      for (let j = i + 1; j < chips.length; j++) {
        const a = chips[i]
        const b = chips[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const minDist = a.r + b.r
        const d2 = dx * dx + dy * dy
        if (d2 > 0.0001 && d2 < minDist * minDist) {
          const d = Math.sqrt(d2)
          const nx = dx / d
          const ny = dy / d
          const overlap = (minDist - d) / 2
          a.x -= nx * overlap
          a.y -= ny * overlap
          b.x += nx * overlap
          b.y += ny * overlap
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
          if (rel < 0) {
            const impulse = -rel * 0.72
            a.vx -= nx * impulse
            a.vy -= ny * impulse
            b.vx += nx * impulse
            b.vy += ny * impulse
          }
        }
      }
    }
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function drawScene(ctx: CanvasRenderingContext2D, chips: Chip[], ripples: Ripple[], w: number, h: number, now: number) {
  ctx.clearRect(0, 0, w, h)

  // 클릭 충격파 링
  for (const rp of ripples) {
    const age = (now - rp.born) / RIPPLE_LIFE_MS
    if (age >= 1) continue
    ctx.beginPath()
    ctx.arc(rp.x, rp.y, 20 + age * SHOCKWAVE_RADIUS, 0, Math.PI * 2)
    ctx.strokeStyle = `hsla(170, 100%, 50%, ${(1 - age) * 0.35})`
    ctx.lineWidth = 2
    ctx.stroke()
  }

  for (const c of chips) {
    // 스폰 팝인: 280ms 동안 easeOutBack으로 커진다 (born=0이면 생략)
    const pop = c.born === 0 ? 1 : Math.min(1, (now - c.born) / 280)
    const r = c.r * (pop >= 1 ? 1 : Math.max(0.1, easeOutBack(pop)))

    ctx.beginPath()
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
    const grad = ctx.createRadialGradient(c.x - r * 0.35, c.y - r * 0.4, r * 0.15, c.x, c.y, r)
    grad.addColorStop(0, 'rgba(255,255,255,0.85)')
    grad.addColorStop(0.3, c.color)
    grad.addColorStop(1, 'rgba(10,12,20,0.55)')
    ctx.fillStyle = grad
    ctx.shadowColor = c.color
    ctx.shadowBlur = 14
    ctx.fill()
    ctx.shadowBlur = 0

    // 림 하이라이트
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    if (c.label) {
      ctx.font = '700 11px "Pretendard Variable", Pretendard, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineWidth = 3
      ctx.strokeStyle = 'rgba(0,0,0,0.65)'
      ctx.strokeText(c.label, c.x, c.y + 1)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(c.label, c.x, c.y + 1)
    }
  }
}

/**
 * 히어로 배경 인터랙티브 물리 캔버스.
 * - 마우스/터치 포인터가 칩을 밀어내고, 클릭하면 충격파가 퍼진다.
 * - 모션 저감(prefers-reduced-motion)·차분 모드에서는 루프 대신 물리를 오프스크린으로
 *   빨리감기해 "정착된 칩"을 정적으로 그린다 — 어떤 환경에서도 히어로가 비어 보이지 않는다.
 * - 우하단 Headless UI Switch로 사용자가 직접 모션을 켜고 끌 수 있다(localStorage 저장,
 *   자동 감지보다 우선).
 * - LCP 보호를 위해 유휴 시점에 시작하고, 화면 밖에서는 시뮬레이션을 멈춘다.
 */
export default function HeroPhysics({
  className,
  ref,
}: {
  className?: string
  ref?: React.Ref<HeroPhysicsHandle>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chipsRef = useRef<Chip[]>([])
  const ripplesRef = useRef<Ripple[]>([])
  // 정적 모드에서 spawnNames가 즉시 다시 그릴 수 있도록 노출되는 훅
  const staticRedrawRef = useRef<(() => void) | null>(null)

  // 'on' | 'off' | 'unknown'(SSR/하이드레이션 직전) — 상태 없이 외부 스토어 구독으로 판정
  const motionPref = useSyncExternalStore(subscribeMotionPref, getMotionSnapshot, getMotionServerSnapshot)
  const motionOn = motionPref === 'unknown' ? null : motionPref === 'on'

  const toggleMotion = (on: boolean) => {
    localStorage.setItem(MOTION_STORAGE_KEY, on ? 'on' : 'off')
    window.dispatchEvent(new Event(MOTION_CHANGE_EVENT))
  }

  useImperativeHandle(ref, () => ({
    spawnNames(names: string[]) {
      const canvas = canvasRef.current
      if (!canvas) return
      const w = canvas.clientWidth || 360
      const chips = chipsRef.current
      names.slice(0, 12).forEach((name, i) => {
        // 칩 수 상한 초과 시 라벨 없는 오래된 칩부터 퇴장
        if (chips.length >= MAX_CHIPS) {
          const idx = chips.findIndex((c) => !c.label)
          chips.splice(idx === -1 ? 0 : idx, 1)
        }
        const label = name.length > 5 ? `${name.slice(0, 5)}…` : name
        chips.push(makeChip(w * 0.2 + Math.random() * w * 0.6, -40 - i * 56, label))
      })
      // 정적 모드면 즉시 정착시켜 다시 그린다 (애니메이션 모드는 루프가 처리)
      staticRedrawRef.current?.()
    },
  }), [])

  useEffect(() => {
    if (motionOn === null) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, canvas.clientWidth * dpr)
      canvas.height = Math.max(1, canvas.clientHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resizeCanvas()

    const initialCount = (canvas.clientWidth || 360) < 640 ? 12 : 18

    // ── 정적 모드: 물리를 오프스크린으로 빨리감기해 정착 상태 1프레임만 그린다 ──
    if (!motionOn) {
      const settleAndDraw = () => {
        const w = canvas.clientWidth
        const h = canvas.clientHeight
        if (w === 0 || h === 0) return
        const chips = chipsRef.current
        if (chips.length === 0) {
          for (let i = 0; i < initialCount; i++) {
            chips.push(makeChip(Math.random() * w, -20 - i * 46))
          }
        }
        // 4초 분량 시뮬레이션으로 바닥에 정착 (포인터 없음)
        for (let s = 0; s < 240; s++) {
          stepPhysics(chips, 1 / 60, w, h, -9999, -9999)
        }
        for (const c of chips) c.born = 0 // 팝인 연출 생략
        drawScene(ctx, chips, [], w, h, performance.now())
      }

      settleAndDraw()
      staticRedrawRef.current = settleAndDraw

      const ro = new ResizeObserver(() => {
        resizeCanvas()
        settleAndDraw()
      })
      ro.observe(canvas)

      return () => {
        ro.disconnect()
        staticRedrawRef.current = null
      }
    }

    // ── 애니메이션 모드 ──
    staticRedrawRef.current = null
    let raf = 0
    let last = 0
    let spawnTimer = 0
    // 모드 전환/재마운트로 이미 칩이 있으면 초기 투하를 건너뛴다
    let spawned = chipsRef.current.length > 0 ? initialCount : 0
    let visible = true
    let pointerX = -9999
    let pointerY = -9999

    const ro = new ResizeObserver(resizeCanvas)
    ro.observe(canvas)

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(canvas)

    // 캔버스 위에 콘텐츠가 겹쳐 있으므로 window 레벨에서 포인터를 추적한다
    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top, inside: e.clientY >= rect.top && e.clientY <= rect.bottom }
    }
    const onPointerMove = (e: PointerEvent) => {
      const p = toLocal(e)
      pointerX = p.x
      pointerY = p.y
    }
    const onPointerDown = (e: PointerEvent) => {
      const p = toLocal(e)
      if (!p.inside) return
      // 클릭 충격파: 주변 칩을 밀어내고 링을 그린다
      ripplesRef.current.push({ x: p.x, y: p.y, born: performance.now() })
      for (const c of chipsRef.current) {
        const dx = c.x - p.x
        const dy = c.y - p.y
        const d2 = dx * dx + dy * dy
        if (d2 > 1 && d2 < SHOCKWAVE_RADIUS * SHOCKWAVE_RADIUS) {
          const d = Math.sqrt(d2)
          const f = (1 - d / SHOCKWAVE_RADIUS) * SHOCKWAVE_FORCE
          c.vx += (dx / d) * f
          c.vy += (dy / d) * f - 120 // 살짝 띄워서 더 극적으로
        }
      }
    }
    const onPointerLeave = () => {
      pointerX = -9999
      pointerY = -9999
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerdown', onPointerDown, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)

    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      if (!last) last = now
      const dt = Math.min((now - last) / 1000, 0.032)
      last = now
      if (!visible || dt <= 0) return

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const chips = chipsRef.current

      // 초기 칩을 시간차 투하 (한꺼번에 쏟지 않기)
      spawnTimer += dt
      if (spawned < initialCount && spawnTimer > 0.14) {
        spawnTimer = 0
        spawned++
        chips.push(makeChip(Math.random() * w, -30))
      }

      stepPhysics(chips, dt, w, h, pointerX, pointerY)

      // 수명이 다한 충격파 링 정리
      ripplesRef.current = ripplesRef.current.filter((rp) => now - rp.born < RIPPLE_LIFE_MS)

      drawScene(ctx, chips, ripplesRef.current, w, h, now)
    }

    // LCP 보호: 브라우저가 한가해진 뒤 시뮬레이션 시작
    const start = () => {
      last = 0
      raf = requestAnimationFrame(step)
    }
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const idleId = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 1500 }) : window.setTimeout(start, 300)

    return () => {
      cancelAnimationFrame(raf)
      if (w.cancelIdleCallback) w.cancelIdleCallback(idleId as number)
      else clearTimeout(idleId as number)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('pointerleave', onPointerLeave)
      ro.disconnect()
      io.disconnect()
    }
  }, [motionOn])

  return (
    <>
      {/* touch-action 기본값(canvas { touch-action: none })이 히어로 스크롤을 막지 않도록 재정의 */}
      <canvas ref={canvasRef} aria-hidden="true" className={className} style={{ touchAction: 'pan-y' }} />

      {/* 배경 모션 수동 토글 — 모션 저감/차분 모드 자동 감지보다 우선 */}
      {motionOn !== null && (
        <Field className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
          <Label className="text-[11px] font-medium text-[var(--text-faint)] select-none cursor-pointer">
            배경 모션
          </Label>
          <Switch
            checked={motionOn}
            onChange={toggleMotion}
            className="group relative flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-white/10 bg-white/10 p-0.5 transition-colors focus:outline-none data-[focus]:ring-1 data-[focus]:ring-[var(--accent-primary)]/50 data-[checked]:bg-[var(--accent-primary)]/80"
          >
            <span className="size-[14px] rounded-full bg-white/85 shadow transition-transform duration-200 group-data-[checked]:translate-x-4" />
          </Switch>
        </Field>
      )}
    </>
  )
}
