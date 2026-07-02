import * as PIXI from 'pixi.js'
import type { RenderContext } from './RenderContext'

export const WORLD_WIDTH = 800
export const BG_PAD_TOP = 500
export const BG_PAD_BOTTOM = 800

export type WallStyle = 'straight' | 'zigzag' | 'narrow' | 'wide' | 'funnel' | 'hourglass' | 'diamond' | 'wave' | 'sawtooth' | 'asymmetric'

function getWallTransform(y: number, height: number, style: WallStyle) {
  let leftOffset = 0, rightOffset = 0, leftAngle = 0, rightAngle = 0;
  const progress = Math.max(0, Math.min(1, y / height));

  switch (style) {
    case 'narrow':
      leftOffset = 100; rightOffset = 100;
      break;
    case 'wide':
      leftOffset = -50; rightOffset = -50;
      break;
    case 'zigzag': {
      const isBump = Math.round(y / 100) % 2 === 0;
      leftOffset = isBump ? 20 : 0; rightOffset = isBump ? 20 : 0;
      break;
    }
    case 'funnel': {
      leftOffset = progress * 200; rightOffset = progress * 200;
      const dx = 200 / height;
      const angle = Math.atan(dx) * (180 / Math.PI);
      leftAngle = angle; rightAngle = -angle; 
      break;
    }
    case 'hourglass': {
      const dist = Math.abs(progress - 0.5);
      leftOffset = 150 - dist * 300; rightOffset = 150 - dist * 300;
      const dx = progress < 0.5 ? (300 / height) : (-300 / height);
      const angle = Math.atan(dx) * (180 / Math.PI);
      leftAngle = angle; rightAngle = -angle;
      break;
    }
    case 'diamond': {
      const dist = Math.abs(progress - 0.5);
      leftOffset = dist * 300 - 50; rightOffset = dist * 300 - 50;
      const dx = progress < 0.5 ? (-300 / height) : (300 / height);
      const angle = Math.atan(dx) * (180 / Math.PI);
      leftAngle = angle; rightAngle = -angle;
      break;
    }
    case 'wave': {
      const freq = (2 * Math.PI) / 800;
      leftOffset = Math.sin(y * freq) * 60 + 20;
      rightOffset = Math.sin(y * freq) * 60 + 20;
      const dx = Math.cos(y * freq) * 60 * freq;
      const angle = Math.atan(dx) * (180 / Math.PI);
      leftAngle = angle; rightAngle = -angle;
      break;
    }
    case 'sawtooth': {
      const localY = ((y % 400) + 400) % 400;
      if (localY < 300) {
        leftOffset = (localY / 300) * 120; rightOffset = (localY / 300) * 120;
        const angle = Math.atan(120 / 300) * (180 / Math.PI);
        leftAngle = angle; rightAngle = -angle;
      } else {
        leftOffset = 120 - ((localY - 300) / 100) * 120; rightOffset = 120 - ((localY - 300) / 100) * 120;
        const angle = Math.atan(-120 / 100) * (180 / Math.PI);
        leftAngle = angle; rightAngle = -angle;
      }
      break;
    }
    case 'asymmetric': {
      const freq = (2 * Math.PI) / 1000;
      const shift = Math.sin(y * freq) * 150;
      leftOffset = shift; rightOffset = -shift;
      const dx = Math.cos(y * freq) * 150 * freq;
      const angle = Math.atan(dx) * (180 / Math.PI);
      leftAngle = angle; rightAngle = angle; 
      break;
    }
  }
  return { leftOffset, rightOffset, leftAngle, rightAngle };
}

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
): PIXI.Sprite | null {
  if (!bgImage) return null
  const bgTex = ctx.getTexture(bgImage)
  if (!bgTex || !bgTex.width || bgTex.width <= 1) return null

  const wallStyle = opts.wallStyle || 'straight'
  let visibleWidth = 800
  let bgX = 0
  if (wallStyle === 'narrow') { visibleWidth = 600; bgX = 100 }
  else if (wallStyle === 'wide') { visibleWidth = 900; bgX = -50 }

  const totalHeight = BG_PAD_TOP + opts.worldHeight + BG_PAD_BOTTOM
  const bgSprite = new PIXI.Sprite(bgTex)
  bgSprite.width = visibleWidth
  bgSprite.height = totalHeight
  bgSprite.x = bgX
  bgSprite.y = -BG_PAD_TOP
  bgSprite.alpha = 0.28 // 배경 존재감 완화(시각 과부하 저감): 0.4 → 0.28
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
  startLine.fill({ color: 0x00FFD0, alpha: 0.20 })
  startLine.stroke({ width: 2, color: 0x00FFD0, alpha: 0.55 })
  for (let i = 0; i < WORLD_WIDTH; i += 40) {
    startLine.moveTo(i, startLineY - 10)
    startLine.lineTo(i + 20, startLineY + 10)
    startLine.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.30 })
  }
  container.addChild(startLine)

  const endLine = new PIXI.Graphics()
  endLine.rect(0, endLineY - 10, WORLD_WIDTH, 20)
  endLine.fill({ color: 0xFF00FF, alpha: 0.20 })
  endLine.stroke({ width: 2, color: 0xFF00FF, alpha: 0.55 })
  for (let i = 0; i < WORLD_WIDTH; i += 40) {
    endLine.moveTo(i, endLineY - 10)
    endLine.lineTo(i + 20, endLineY + 10)
    endLine.stroke({ width: 2, color: 0xFFFFFF, alpha: 0.30 })
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
  const top = -BG_PAD_TOP
  const bottom = opts.worldHeight + BG_PAD_BOTTOM
  const height = opts.worldHeight

  const leftBase = 0
  const rightBase = WORLD_WIDTH

  g.moveTo(leftBase + getWallTransform(top, height, style).leftOffset, top)
  for (let y = top; y <= bottom; y += 50) {
    g.lineTo(leftBase + getWallTransform(y, height, style).leftOffset, y)
  }

  g.moveTo(rightBase - getWallTransform(top, height, style).rightOffset, top)
  for (let y = top; y <= bottom; y += 50) {
    g.lineTo(rightBase - getWallTransform(y, height, style).rightOffset, y)
  }

  g.stroke({ width: 4, color: 0x00ffff, alpha: 0.55 })
  return g
}
