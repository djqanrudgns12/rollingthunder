import * as PIXI from 'pixi.js'
import type { RenderContext } from './RenderContext'

export const WORLD_WIDTH = 800
export const BG_PAD_TOP = 500
export const BG_PAD_BOTTOM = 200

export type WallStyle = 'straight' | 'zigzag' | 'narrow' | 'wide'

interface StageOpts {
  worldHeight: number
  wallStyle?: WallStyle
  layoutConfig?: {
    startLineY?: number
    startMarginPercent?: number
    endMarginPercent?: number
  } | null
}

/**
 * 맵별 배경 TilingSprite 생성. PhysicsCanvas.tsx(L309-350)와 동일 로직.
 * 텍스처는 ctx.getTexture 로 조회하므로 호출 전 PIXI.Assets.load(bgImage) 가 선행되어야 한다.
 */
export function createBackground(
  ctx: RenderContext,
  bgImage: string | undefined,
  opts: StageOpts
): PIXI.TilingSprite | null {
  if (!bgImage) return null
  const bgTex = ctx.getTexture(bgImage)
  if (!bgTex || !bgTex.width || bgTex.width <= 1) return null

  const wallStyle = opts.wallStyle || 'straight'
  let visibleWidth = 800
  let bgX = 0
  if (wallStyle === 'narrow') { visibleWidth = 600; bgX = 100 }
  else if (wallStyle === 'wide') { visibleWidth = 900; bgX = -50 }

  const totalHeight = BG_PAD_TOP + opts.worldHeight + BG_PAD_BOTTOM
  const bgSprite = new PIXI.TilingSprite({ texture: bgTex, width: visibleWidth, height: totalHeight })
  const scale = visibleWidth / bgTex.width
  bgSprite.tileScale.set(scale, scale)
  bgSprite.x = bgX
  bgSprite.y = -BG_PAD_TOP
  bgSprite.alpha = 0.4
  bgSprite.zIndex = -100
  return bgSprite
}

/** layoutConfig 기반 시작선 Y 좌표 (게임 렌더와 동일 우선순위) */
export function getStartLineY(opts: StageOpts): number {
  const lc = opts.layoutConfig
  return lc?.startLineY ?? (lc?.startMarginPercent ? opts.worldHeight * lc.startMarginPercent : 70)
}

/** layoutConfig 기반 종료선 Y 좌표 (게임 렌더와 동일) */
export function getEndLineY(opts: StageOpts): number {
  const endMargin = opts.layoutConfig?.endMarginPercent ?? 0.02
  return opts.worldHeight * (1 - endMargin)
}

/**
 * 시작선/종료선(네온 + 체크무늬) 그래픽. PhysicsCanvas.tsx(L1060-1088)와 동일.
 * 반환 컨테이너를 floor 레이어(zIndex -20)에 추가하면 게임과 동일하게 렌더된다.
 */
export function createStartEndLines(opts: StageOpts): PIXI.Container {
  const container = new PIXI.Container()
  const startLineY = getStartLineY(opts)
  const endLineY = getEndLineY(opts)

  const startLine = new PIXI.Graphics()
  startLine.rect(0, startLineY - 10, WORLD_WIDTH, 20)
  startLine.fill({ color: 0x00FFD0, alpha: 0.3 })
  startLine.stroke({ width: 2, color: 0x00FFD0, alpha: 0.8 })
  for (let i = 0; i < WORLD_WIDTH; i += 40) {
    startLine.moveTo(i, startLineY - 10)
    startLine.lineTo(i + 20, startLineY + 10)
    startLine.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.5 })
  }
  container.addChild(startLine)

  const endLine = new PIXI.Graphics()
  endLine.rect(0, endLineY - 10, WORLD_WIDTH, 20)
  endLine.fill({ color: 0xFF00FF, alpha: 0.3 })
  endLine.stroke({ width: 2, color: 0xFF00FF, alpha: 0.8 })
  for (let i = 0; i < WORLD_WIDTH; i += 40) {
    endLine.moveTo(i, endLineY - 10)
    endLine.lineTo(i + 20, endLineY + 10)
    endLine.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.5 })
  }
  container.addChild(endLine)

  return container
}

/**
 * 에디터 전용: 실제 물리 외벽(MapBuilder.createWalls)의 안쪽 면을 시각화.
 * 게임은 외벽을 그래픽으로 그리지 않으므로(콜라이더 전용) 이 함수는 에디터에서만 사용한다.
 * createWalls 의 inset 수식과 동일: 안쪽 면 = bump + narrowInset + wideOutset.
 */
export function createWallGuide(opts: StageOpts): PIXI.Graphics {
  const g = new PIXI.Graphics()
  const style = opts.wallStyle || 'straight'
  const narrowInset = style === 'narrow' ? 100 : 0
  const wideOutset = style === 'wide' ? -50 : 0
  const useBump = style === 'zigzag'
  const top = -BG_PAD_TOP
  const bottom = opts.worldHeight + BG_PAD_BOTTOM

  const leftBase = narrowInset + wideOutset
  const rightBase = WORLD_WIDTH - narrowInset - wideOutset

  if (useBump) {
    // 지그재그: 100px 세그먼트마다 20px 돌출
    g.moveTo(leftBase, top)
    for (let y = top; y <= bottom; y += 100) {
      const bump = (Math.round((y + BG_PAD_TOP) / 100) % 2 === 0) ? 20 : 0
      g.lineTo(leftBase + bump, y)
    }
    g.moveTo(rightBase, top)
    for (let y = top; y <= bottom; y += 100) {
      const bump = (Math.round((y + BG_PAD_TOP) / 100) % 2 === 0) ? 20 : 0
      g.lineTo(rightBase - bump, y)
    }
  } else {
    g.moveTo(leftBase, top).lineTo(leftBase, bottom)
    g.moveTo(rightBase, top).lineTo(rightBase, bottom)
  }
  g.stroke({ width: 4, color: 0x00ffff, alpha: 0.55 })
  return g
}
