import * as PIXI from 'pixi.js'
import type { RenderContext } from './RenderContext'
import { itemRotationRad } from './rotation'

export interface ObstacleGraphic {
  /** 메인 캔버스에 추가할 시각 노드 (월드 좌표 item.x,item.y 에 배치됨) */
  node: PIXI.Container
  /** 미니맵에 추가할 그래픽 (scale 1.5 적용됨) */
  minimap: PIXI.Graphics
  /** ticker/gsap 등 자원 해제 (에디터의 빈번한 재생성 시 누수 방지) */
  dispose: () => void
}

const OBS = (name: string) => `/images/assets/obstacles/${name}.png`

/**
 * 얼음블록 균열 단계 수. scripts/genIceAssets.ts 의 N_STAGES 와 반드시 일치해야 한다.
 * (ice_block_crack_1..N.png)
 */
export const ICE_CRACK_STAGES = 4

/**
 * HP/maxHp → 균열 단계(0..N). 렌더러·런타임(PhysicsCanvas)이 동일 공식을 참조하도록 export.
 *   hp === maxHp → 0 (온전, 균열 없음)
 *   0 < hp < maxHp → 1..N (손상비율 d=1-hp/maxHp 를 반올림 매핑)
 *   hp <= 0 → N (파괴 직전 최대 균열; 실제 소멸은 ICE_DESTROY 가 처리)
 */
export function iceStage(hp: number, maxHp: number): number {
  if (!maxHp || maxHp <= 0) return 0
  if (hp <= 0) return ICE_CRACK_STAGES
  const d = 1 - hp / maxHp
  if (d <= 0) return 0
  return Math.min(ICE_CRACK_STAGES, Math.max(1, Math.round(d * ICE_CRACK_STAGES)))
}

/** 균열 단계 텍스처 이름 (stage 1..N) */
export const iceCrackTexName = (stage: number) => `ice_block_crack_${stage}`

/**
 * 단일 기물(EditorItem)을 게임과 동일한 비주얼로 렌더한다.
 * 기존 PhysicsCanvas.tsx 의 createEditorItemGraphic(L1094-1420) 로직을 그대로 이식하고
 * 환경 의존성을 RenderContext 로 분리했다.
 */
export function createObstacleGraphic(item: any, ctx: RenderContext): ObstacleGraphic {
  const g = new PIXI.Container()
  const mg = new PIXI.Graphics()
  const disposers: Array<() => void> = []
  const tweens: any[] = []

  const animated = ctx.animated
  const full = ctx.quality === 'full'

  // gsap 동적 import 후 트윈을 추적하여 dispose 시 kill (게임은 cleanup 시 1회 호출)
  const gsapTo = (target: any, vars: any) => {
    if (!animated) return
    import('gsap').then(({ gsap }) => {
      const t = gsap.to(target, vars)
      tweens.push(t)
    }).catch(() => {})
  }

  if (item.type === 'wall') {
    const texName = item.variant ? `obstacle_wall_${item.variant}` : 'obstacle_wall'
    const texture = ctx.getTexture(OBS(texName))
    const sprite = new PIXI.Sprite(texture)
    sprite.width = item.w || 100
    sprite.height = item.h || 20
    sprite.anchor.set(0.5)
    g.addChild(sprite)
    mg.rect(-item.w / 2, -item.h / 2, item.w, item.h)
    mg.fill({ color: 0x8888aa, alpha: 0.5 })
  } else if (item.type === 'pin') {
    const sprite = new PIXI.Sprite(ctx.getTexture(OBS('obstacle_pin')))
    sprite.anchor.set(0.5)
    sprite.width = (item.radius || 15) * 2.5
    sprite.height = (item.radius || 15) * 2.5
    g.addChild(sprite)
    mg.circle(0, 0, item.radius || 15)
    mg.fill({ color: 0x00ffcc, alpha: 0.7 })
  } else if (item.type === 'bumper') {
    const sprite = new PIXI.Sprite(ctx.getTexture(OBS('obstacle_bumper')))
    sprite.anchor.set(0.5)
    sprite.width = (item.radius || 15) * 2.5
    sprite.height = (item.radius || 15) * 2.5
    g.addChild(sprite)
    mg.circle(0, 0, item.radius || 15)
    mg.fill({ color: 0xffaa55, alpha: 0.8 })
  } else if (item.type === 'booster') {
    const sprite = new PIXI.Sprite(ctx.getTexture(OBS('obstacle_booster')))
    sprite.anchor.set(0.5)
    sprite.width = 60
    sprite.height = 60
    sprite.angle = 180 // 텍스처가 기본적으로 아래를 향하므로 180도 뒤집어서 기본(0도=UP)을 맞춤
    g.addChild(sprite)
    mg.rect(-25, -25, 50, 50)
    mg.fill({ color: 0x55ff55, alpha: 0.8 })
  } else if (item.type === 'windmill') {
    // 물리 콜라이더(MapBuilder: w×h 십자 cuboid)와 동일하게 w=날개 스팬, h=날개 두께를 반영.
    // (기존 110×110 고정 스프라이트는 에디터 리사이즈가 시각에 반영되지 않던 원인)
    const w = item.w || 100
    const h = item.h || 10
    const sprite = new PIXI.Sprite(ctx.getTexture(OBS('obstacle_windmill')))
    sprite.anchor.set(0.5)
    sprite.width = w * 1.1
    sprite.height = w * 1.1
    g.addChild(sprite)

    const speed = item.speed || 3
    if (ctx.physicsDriven) {
      // 게임: 물리가 매 프레임 g.rotation 을 구동(OBSTACLE_FRAME) → 로컬 회전 타이머 생략
    } else if (animated) {
      const windTick = (ticker: PIXI.Ticker) => {
        if (g.destroyed || mg.destroyed) return
        g.rotation += speed * (ticker.deltaMS / 1000)
        mg.rotation += speed * (ticker.deltaMS / 1000)
      }
      disposers.push(ctx.registerTicker(windTick))
    } else {
      drawRotationGuide(g, w * 0.55, speed)
    }
    mg.rect(-w / 2, -h / 2, w, h)
    mg.rect(-h / 2, -w / 2, h, w)
    mg.fill({ color: 0x00ffff, alpha: 0.6 })
  } else if (item.type === 'spinner') {
    const w = item.w || 200
    const h = item.h || 20
    const speed = item.speed || 5
    const isClockwise = speed > 0
    const baseColor = isClockwise ? 0xff3333 : 0xaa33ff
    const glowColor = isClockwise ? 0xff0000 : 0x8800ff

    // 0. Trails (Motion Blur)
    if (full && animated) {
      for (let i = 1; i <= 3; i++) {
        const trail = new PIXI.Graphics()
        trail.roundRect(-w / 2, -h / 2, w, h, h / 2)
        trail.fill({ color: baseColor, alpha: 0.18 - i * 0.05 })
        trail.rotation = -Math.sign(speed) * 0.15 * i
        g.addChild(trail)
      }
    }

    // 1. Draw the neon bar
    const bar = new PIXI.Graphics()
    bar.roundRect(-w / 2, -h / 2, w, h, h / 2)
    bar.fill({ color: 0xffffff, alpha: 1.0 })
    bar.stroke({ color: baseColor, width: 4, alpha: 0.8 })
    if (full) {
      // [성능 최적화] GlowFilter 동적 import 제거 → 밝은 외곽선으로 glow 효과 시뮬레이션
      // 왜: 기물마다 GPU 필터 패스가 추가되어 저사양에서 프레임 드롭 유발
      bar.stroke({ color: glowColor, width: 8, alpha: 0.35 })
    }
    g.addChild(bar)

    // 2. Core pulse & direction arrow
    const core = new PIXI.Graphics()
    core.circle(0, 0, h / 1.5)
    core.fill({ color: 0xffffff })
    core.stroke({ color: baseColor, width: 4 })
    const dirDir = isClockwise ? 1 : -1
    core.poly([
      { x: -dirDir * h / 4, y: -h / 3 },
      { x: dirDir * h / 3, y: 0 },
      { x: -dirDir * h / 4, y: h / 3 },
    ])
    core.fill({ color: baseColor })
    g.addChild(core)

    if (animated) {
      let time = 0
      const windTick = (ticker: PIXI.Ticker) => {
        if (g.destroyed || mg.destroyed) return
        const dt = ticker.deltaMS / 1000
        // 게임(physicsDriven): 회전은 물리(OBSTACLE_FRAME)가 구동 → 여기선 코어 펄스만.
        if (!ctx.physicsDriven) {
          g.rotation += speed * dt
          mg.rotation += speed * dt
        }
        time += dt
        core.scale.set(1 + Math.sin(time * 10) * 0.1)
      }
      disposers.push(ctx.registerTicker(windTick))
    } else {
      drawRotationGuide(g, Math.max(w, h) / 2 + 8, speed)
    }

    mg.roundRect(-w / 2, -h / 2, w, h, h / 2)
    mg.fill({ color: baseColor, alpha: 0.8 })
  } else if (item.type === 'blackhole' || item.type === 'whitehole') {
    const isWhite = item.type === 'whitehole'
    const r = item.radius || 100
    const sprite = new PIXI.Sprite(ctx.getTexture(isWhite ? OBS('obstacle_whitehole') : OBS('obstacle_blackhole')))
    sprite.anchor.set(0.5)
    sprite.width = r * 2.5
    sprite.height = r * 2.5
    if (isWhite) { sprite.blendMode = 'add'; sprite.alpha = 0.8 } // 가산 블렌드 광량 억제
    g.addChild(sprite)
    gsapTo(sprite, { rotation: Math.PI * 2 * (isWhite ? -1 : 1), duration: 6, repeat: -1, ease: 'none' })
    // 미니맵: 게임 동작과 동일하게 그리지 않음(원본 유지)
  } else if (item.type === 'portal') {
    const r = item.radius || 40
    const sprite = new PIXI.Sprite(ctx.getTexture(OBS('obstacle_portal')))
    sprite.anchor.set(0.5)
    sprite.width = r * 2.5
    sprite.height = r * 2.5
    if (item.color) sprite.tint = parseInt(item.color.replace('#', '0x'))
    sprite.blendMode = 'add'
    sprite.alpha = 0.8 // 가산 블렌드 광량 억제
    g.addChild(sprite)
    gsapTo(sprite, { rotation: Math.PI * 2, duration: 5, repeat: -1, ease: 'none' })
    gsapTo(sprite.scale, { x: 1.1, y: 1.1, duration: 1, yoyo: true, repeat: -1, ease: 'sine.inOut' })
    mg.circle(0, 0, r * 1.5)
    if (item.color) mg.fill({ color: parseInt(item.color.replace('#', '0x')), alpha: 0.6 })
    else mg.fill({ color: 0x8888ff, alpha: 0.6 })
  } else if (item.type === 'hole') {
    const r = item.radius || 30
    const sprite = new PIXI.Sprite(ctx.getTexture(OBS('obstacle_hole')))
    sprite.anchor.set(0.5)
    sprite.width = r * 2.5
    sprite.height = r * 2.5
    g.addChild(sprite)
    gsapTo(sprite, { rotation: Math.PI * 2, duration: 4, repeat: -1, ease: 'none' })
    mg.circle(0, 0, r)
    mg.fill({ color: 0xff2222, alpha: 0.7 })
  } else if (item.type === 'piston') {
    const w = item.w || 100
    const h = item.h || 20
    const texture = ctx.getTexture(OBS('obstacle_piston'))
    const sprite = new PIXI.TilingSprite({ texture, width: w, height: h })
    sprite.anchor.set(0.5)
    g.addChild(sprite)
    mg.rect(-w / 2, -h / 2, w, h)
    mg.fill({ color: 0xffcc00, alpha: 0.6 })
  } else if (item.type === 'iceblock') {
    const w = item.w || 60
    const h = item.h || 25
    
    // 1. 온전한 베이스 블록
    const baseTexture = ctx.getTexture(OBS('ice_block_base'))
    const block = new PIXI.Sprite(baseTexture)
    block.anchor.set(0.5)
    block.width = w
    block.height = h
    g.addChild(block)

    // 2. 균열 오버레이 — HP 단계에 따라 이산 텍스처 선택 (normal 블렌드; 밝은 얼음 위 "진짜 금")
    const maxHp = item.maxHp ?? item.hp ?? 0
    const curHp = item.hp ?? maxHp
    const stage = iceStage(curHp, maxHp)
    const crack = new PIXI.Sprite(
      stage > 0 ? ctx.getTexture(OBS(iceCrackTexName(stage))) : PIXI.Texture.EMPTY
    )
    crack.anchor.set(0.5)
    crack.width = w
    crack.height = h
    crack.label = 'crackOverlay'
    crack.blendMode = 'add'
    ;(crack as any).originalWidth = w
    ;(crack as any).originalHeight = h
    crack.visible = stage > 0
    g.addChild(crack)

    // 미니맵용
    mg.rect(-w / 2, -h / 2, w, h)
    mg.fill({ color: 0x88ccff, alpha: 0.8 })
  } else if (item.type === 'polygon' && item.vertices && item.vertices.length > 2) {
    const poly = new PIXI.Graphics()
    poly.moveTo(item.vertices[0].x, item.vertices[0].y)
    for (let i = 1; i < item.vertices.length; i++) poly.lineTo(item.vertices[i].x, item.vertices[i].y)
    poly.lineTo(item.vertices[0].x, item.vertices[0].y)
    const texName = item.variant ? `obstacle_wall_${item.variant}` : 'obstacle_wall'
    const texture = ctx.getTexture(OBS(texName))

    poly.stroke({ color: 0x555555, width: 4 })
    if (texture) {
      poly.fill({ texture, alpha: 1.0 })
    } else {
      poly.fill({ color: 0x8888aa, alpha: 0.4 })
    }
    g.addChild(poly)

    mg.moveTo(item.vertices[0].x, item.vertices[0].y)
    for (let i = 1; i < item.vertices.length; i++) mg.lineTo(item.vertices[i].x, item.vertices[i].y)
    mg.lineTo(item.vertices[0].x, item.vertices[0].y)
    mg.stroke({ color: 0xbbbbdd, width: 4 })
    mg.fill({ color: 0x8888aa, alpha: 0.6 })
  } else if (item.type === 'windcannon') {
    const w = item.w || 120
    const h = item.h || 120
    
    const sprite = new PIXI.Sprite(ctx.getTexture(OBS('obstacle_blower')))
    sprite.anchor.set(0.5)
    sprite.width = w
    sprite.height = h
    
    const angleRad = (item.windAngle || 90) * (Math.PI / 180)
    sprite.rotation = angleRad
    g.addChild(sprite)

    const dirX = Math.sin(angleRad)
    const dirY = -Math.cos(angleRad)

    if (animated) {
      for (let i = 0; i < 3; i++) {
        const arrow = new PIXI.Graphics()
        arrow.poly([{ x: -10, y: -10 }, { x: 0, y: -20 }, { x: 10, y: -10 }, { x: 0, y: -15 }])
        arrow.fill({ color: 0x00ffff, alpha: 0.8 })
        arrow.rotation = angleRad
        arrow.position.set(dirX * (i * 30), dirY * (i * 30))
        g.addChild(arrow)
        gsapTo(arrow.position, { x: dirX * (i * 30 + 50), y: dirY * (i * 30 + 50), alpha: 0, duration: 0.6, repeat: -1, ease: 'none' })
      }
    }

    mg.rect(-w / 2, -h / 2, w, h)
    mg.fill({ color: 0x55aaff, alpha: 0.5 })
  } else if (item.type === 'luckygate') {
    const w = item.w || 140
    const h = 15
    const gate = new PIXI.Graphics()
    gate.roundRect(-w / 2, -h / 2, w, h, h / 2)
    gate.fill({ color: 0xffd700, alpha: 0.8 })
    gate.stroke({ color: 0xffaa00, width: 3 })
    if (full) {
      gate.stroke({ color: 0xffaa00, width: 6, alpha: 0.4 })
    }
    g.addChild(gate)
    mg.rect(-w / 2, -h / 2, w, h)
    mg.fill({ color: 0xffd700, alpha: 0.8 })
  } else if (item.type === 'speedgate') {
    const w = item.w || 140
    const h = 15
    const gate = new PIXI.Graphics()
    gate.roundRect(-w / 2, -h / 2, w, h, h / 2)
    gate.fill({ color: 0x00ff88, alpha: 0.8 })
    gate.stroke({ color: 0x00ffff, width: 3 })
    if (full) {
      gate.stroke({ color: 0x00ffff, width: 6, alpha: 0.4 })
    }
    g.addChild(gate)
    mg.rect(-w / 2, -h / 2, w, h)
    mg.fill({ color: 0x00ff88, alpha: 0.8 })
  } else if (item.type === 'slowgate') {
    const w = item.w || 140
    const h = 15
    const gate = new PIXI.Graphics()
    gate.roundRect(-w / 2, -h / 2, w, h, h / 2)
    gate.fill({ color: 0xff0044, alpha: 0.8 })
    gate.stroke({ color: 0xff8800, width: 3 })
    if (full) {
      gate.stroke({ color: 0xff8800, width: 6, alpha: 0.4 })
    }
    g.addChild(gate)
    mg.rect(-w / 2, -h / 2, w, h)
    mg.fill({ color: 0xff0044, alpha: 0.8 })
  } else if (item.type === 'flipper') {
    const length = item.length || 90
    const thickness = item.h || 12
    const flip = new PIXI.Graphics()
    flip.roundRect(0, -thickness / 2, length, thickness, thickness / 2)
    flip.fill({ color: 0xff4444 })
    flip.stroke({ color: 0xffaaaa, width: 2 })
    g.addChild(flip)
    if (!animated) drawFlipperGuide(g, length, item.restAngle, item.swingAngle)
    mg.roundRect(0, -thickness / 2, length, thickness, thickness / 2)
    mg.fill({ color: 0xff4444, alpha: 0.8 })
  }

  // 피스톤 왕복 애니메이션 (waypointB 가 있을 때)
  if (item.type === 'piston' && item.waypointB) {
    const speed = item.speed || 2
    const ax = item.x, ay = item.y
    const bx = item.waypointB.x, by = item.waypointB.y
    if (ctx.physicsDriven) {
      // 게임: 물리가 매 프레임 g.position 을 구동(OBSTACLE_FRAME) → 로컬 왕복 타이머 생략
    } else if (animated) {
      let t = 0
      const pistonTick = (ticker: PIXI.Ticker) => {
        if (g.destroyed || mg.destroyed) return
        t += (ticker.deltaMS * 60 / 1000)
        const phase = (Math.sin(t * speed * 0.01) + 1) / 2
        g.x = ax + (bx - ax) * phase
        g.y = ay + (by - ay) * phase
        mg.x = ax + (bx - ax) * phase
        mg.y = ay + (by - ay) * phase
      }
      disposers.push(ctx.registerTicker(pistonTick))
    } else {
      // 정지 모드: A→B 궤적 가이드 + B 위치 고스트
      // 본체(g)가 회전하더라도 가이드가 월드 좌표상의 waypointB를 정확히 가리키도록 역회전 변환
      const dx = bx - ax
      const dy = by - ay
      const rot = itemRotationRad(item)
      const invRot = -rot
      const localX = dx * Math.cos(invRot) - dy * Math.sin(invRot)
      const localY = dx * Math.sin(invRot) + dy * Math.cos(invRot)

      const guide = new PIXI.Graphics()
      guide.moveTo(0, 0).lineTo(localX, localY)
      guide.stroke({ width: 2, color: 0xffcc00, alpha: 0.5 })
      const w = item.w || 100, h = item.h || 20
      guide.rect(localX - w / 2, localY - h / 2, w, h)
      guide.stroke({ width: 1, color: 0xffcc00, alpha: 0.4 })
      g.addChild(guide)
    }
    mg.fill({ color: 0xffffff })
  }

  g.position.set(item.x, item.y)
  mg.position.set(item.x, item.y)
  // 회전 단위 통일: item.angle/rotation 은 '도(degree)' 로 해석(→라디안). [rotation.ts]
  const finalRot = itemRotationRad(item)
  g.rotation = finalRot
  mg.rotation = finalRot
  mg.scale.set(1.5)

  const dispose = () => {
    tweens.forEach(t => { try { t.kill() } catch {} })
    disposers.forEach(d => { try { d() } catch {} })
  }

  return { node: g, minimap: mg, dispose }
}

/** 정지 모드용 회전 가이드(점선 원 + 회전 방향 화살표) */
function drawRotationGuide(parent: PIXI.Container, radius: number, speed: number) {
  const guide = new PIXI.Graphics()
  const segs = 32
  for (let i = 0; i < segs; i += 2) {
    const a0 = (i / segs) * Math.PI * 2
    const a1 = ((i + 1) / segs) * Math.PI * 2
    guide.moveTo(Math.cos(a0) * radius, Math.sin(a0) * radius)
    guide.lineTo(Math.cos(a1) * radius, Math.sin(a1) * radius)
  }
  guide.stroke({ width: 1.5, color: 0x00ffff, alpha: 0.5 })
  // 회전 방향 화살표
  const dir = Math.sign(speed) || 1
  guide.circle(0, 0, 3).fill({ color: 0x00ffff, alpha: 0.6 })
  parent.addChild(guide)
}

/** 정지 모드용 플리퍼 스윙 범위 호(rest↔swing) */
function drawFlipperGuide(parent: PIXI.Container, length: number, restAngle = 30, swingAngle = -30) {
  const guide = new PIXI.Graphics()
  const r0 = (restAngle * Math.PI) / 180
  const r1 = (swingAngle * Math.PI) / 180
  guide.moveTo(0, 0).lineTo(Math.cos(r0) * length, Math.sin(r0) * length)
  guide.moveTo(0, 0).lineTo(Math.cos(r1) * length, Math.sin(r1) * length)
  guide.stroke({ width: 1.5, color: 0xffaaaa, alpha: 0.5 })
  parent.addChild(guide)
}
