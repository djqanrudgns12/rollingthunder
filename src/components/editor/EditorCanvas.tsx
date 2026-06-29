'use client'

import React, { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { useEditorStore, EditorItem } from '@/store/editorStore'
import { Viewport } from 'pixi-viewport'

// 에셋 맵핑
const ASSET_MAP: Record<string, string> = {
  pin: '/images/assets/obstacles/obstacle_pin.png',
  bumper: '/images/assets/obstacles/obstacle_bumper.png',
  wall: '/images/assets/obstacles/obstacle_wall.png',
  booster: '/images/assets/obstacles/obstacle_booster.png',
  windmill: '/images/assets/obstacles/obstacle_windmill.png',
  piston: '/images/assets/obstacles/obstacle_piston.png',
  hole: '/images/assets/obstacles/obstacle_hole.png',
  portal: '/images/assets/obstacles/obstacle_portal.png',
  blackhole: '/images/assets/obstacles/obstacle_blackhole.png',
  whitehole: '/images/assets/obstacles/obstacle_whitehole.png'
};

export default function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const viewportRef = useRef<Viewport | null>(null)
  const containerRef = useRef<PIXI.Container | null>(null)
  const containerMapRef = useRef<Map<string, PIXI.Container>>(new Map())
  const bgSpriteRef = useRef<PIXI.TilingSprite | null>(null)

  const { items, selectedItemId, setSelectedItemId, updateItem, gridSnap, bgImage, worldHeight } = useEditorStore()

  useEffect(() => {
    if (!canvasRef.current) return
    let isDestroyed = false;

    const initPixi = async () => {
      const app = new PIXI.Application()
      ;(app as any)._cancelResize = () => {};

      await app.init({
        canvas: canvasRef.current!,
        resizeTo: window,
        backgroundColor: 0x111111,
        antialias: true
      })
      
      if (isDestroyed) {
        app.destroy(true, { children: true });
        return;
      }
      appRef.current = app

      const viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        worldWidth: 1600,
        worldHeight: 3000,
        events: app.renderer.events
      })
      
      viewport.drag().pinch().wheel().decelerate()
      app.stage.addChild(viewport)
      viewportRef.current = viewport

      viewport.moveCenter(400, 400)

      // Background
      const bgSprite = new PIXI.TilingSprite(PIXI.Texture.WHITE, 1600, 4000)
      bgSprite.tint = 0x111111;
      bgSprite.position.set(-400, -1000)
      viewport.addChild(bgSprite)
      bgSpriteRef.current = bgSprite

      const container = new PIXI.Container()
      viewport.addChild(container)
      containerRef.current = container

      // Background grid
      const grid = new PIXI.Graphics()
      grid.lineStyle(1, 0x333333, 0.5)
      for (let i = -1000; i <= 2000; i += 50) {
        grid.moveTo(i, -1000).lineTo(i, 4000)
      }
      for (let i = -1000; i <= 4000; i += 50) {
        grid.moveTo(-1000, i).lineTo(2000, i)
      }
      viewport.addChild(grid)

      // Preload assets
      const assetsToLoad = Object.values(ASSET_MAP);
      await Promise.all(assetsToLoad.map(url => PIXI.Assets.load(url).catch(() => null)));
    }

    initPixi()

    return () => {
      isDestroyed = true;
      if (viewportRef.current) {
        viewportRef.current.destroy();
        viewportRef.current = null;
      }
      if (appRef.current) {
        try {
          appRef.current.destroy(false, { children: true });
        } catch (e) {}
        appRef.current = null;
      }
    }
  }, [])

  // 배경 업데이트
  useEffect(() => {
    if (bgSpriteRef.current && bgImage) {
      PIXI.Assets.load(bgImage).then(tex => {
        if (bgSpriteRef.current) {
          bgSpriteRef.current.texture = tex;
          bgSpriteRef.current.tint = 0xffffff;
        }
      }).catch(() => {});
    }
  }, [bgImage])

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const ctrlCmd = e.ctrlKey || e.metaKey
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useEditorStore.getState()
        if (state.selectedItemId) state.removeItem(state.selectedItemId)
      }
      else if (ctrlCmd && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) useEditorStore.getState().redo()
        else useEditorStore.getState().undo()
      }
      else if (ctrlCmd && e.key === 'y') {
        e.preventDefault()
        useEditorStore.getState().redo()
      }
      else if (ctrlCmd && e.key === 'c') {
        const state = useEditorStore.getState()
        if (state.selectedItemId) {
          const item = state.items.find(it => it.id === state.selectedItemId)
          if (item) state.setClipboard(item)
        }
      }
      else if (ctrlCmd && e.key === 'v') {
        const state = useEditorStore.getState()
        if (state.clipboard) {
          const newItem = { ...state.clipboard, id: `${state.clipboard.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, x: state.clipboard.x + 20, y: state.clipboard.y + 20 }
          state.addItem(newItem)
          state.setSelectedItemId(newItem.id)
        }
      }
      else if (ctrlCmd && e.key === 'd') {
        e.preventDefault()
        const state = useEditorStore.getState()
        if (state.selectedItemId) {
          const item = state.items.find(it => it.id === state.selectedItemId)
          if (item) {
            const newItem = { ...item, id: `${item.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, x: item.x + 20, y: item.y + 20 }
            state.addItem(newItem)
            state.setSelectedItemId(newItem.id)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 아이템 렌더링
  useEffect(() => {
    if (!containerRef.current || !viewportRef.current) return

    const container = containerRef.current
    const currentIds = new Set(items.map(it => it.id))

    for (const [id, c] of containerMapRef.current.entries()) {
      if (!currentIds.has(id)) {
        container.removeChild(c)
        c.destroy({ children: true })
        containerMapRef.current.delete(id)
      }
    }

    items.forEach(item => {
      let c = containerMapRef.current.get(item.id)
      let sprite: PIXI.Sprite | PIXI.Graphics | null = null;
      let selectionG: PIXI.Graphics | null = null;

      if (!c) {
        c = new PIXI.Container()
        c.eventMode = 'dynamic'
        c.cursor = 'pointer'
        
        let isDragging = false
        let offset = { x: 0, y: 0 }

        c.on('pointerdown', (e) => {
          e.stopPropagation()
          setSelectedItemId(item.id)
          if (viewportRef.current) viewportRef.current.pause = true
          isDragging = true
          const pos = e.data.getLocalPosition(container)
          offset = { x: c!.x - pos.x, y: c!.y - pos.y }
        })

        const onUp = () => {
          isDragging = false
          if (viewportRef.current) viewportRef.current.pause = false
        }
        c.on('pointerup', onUp)
        c.on('pointerupoutside', onUp)

        c.on('pointermove', (e) => {
          if (isDragging) {
            const pos = e.data.getLocalPosition(container)
            let newX = pos.x + offset.x
            let newY = pos.y + offset.y
            
            const snap = useEditorStore.getState().gridSnap
            if (snap) {
              newX = Math.round(newX / 10) * 10
              newY = Math.round(newY / 10) * 10
            }

            c!.position.set(newX, newY)
            updateItem(item.id, { x: newX, y: newY })
          }
        })

        // Create inner sprite or graphics
        if (ASSET_MAP[item.type]) {
          const tex = PIXI.Assets.get(ASSET_MAP[item.type]) || PIXI.Texture.from(ASSET_MAP[item.type]);
          sprite = new PIXI.Sprite(tex);
          sprite.anchor.set(0.5);
          sprite.name = 'sprite';
          c.addChild(sprite);
        } else {
          sprite = new PIXI.Graphics();
          sprite.name = 'sprite';
          c.addChild(sprite);
        }

        // Selection graphic
        selectionG = new PIXI.Graphics();
        selectionG.name = 'selection';
        c.addChild(selectionG);

        container.addChild(c)
        containerMapRef.current.set(item.id, c)
      } else {
        sprite = c.getChildByName('sprite') as any;
        selectionG = c.getChildByName('selection') as any;
      }

      const isSelected = selectedItemId === item.id
      c.alpha = item.flip ? 0.8 : 1

      c.position.set(item.x, item.y)
      c.rotation = (item.angle || 0) * Math.PI / 180

      let drawW = item.w || 40
      let drawH = item.h || 40

      if (sprite instanceof PIXI.Sprite) {
        sprite.width = drawW;
        sprite.height = item.radius ? drawW : drawH;
        if (item.type === 'pin' || item.type === 'bumper' || item.type === 'portal') {
            sprite.width = sprite.height = (item.radius || drawW/2) * 2;
        }
      } else if (sprite instanceof PIXI.Graphics) {
        sprite.clear();
        sprite.beginFill(0x444444, 0.8)
        if (item.type === 'startline') {
          sprite.lineStyle(2, 0x00ff00)
          sprite.drawRect(-drawW/2, -drawH/2, drawW, drawH)
        } else if (item.type === 'endline') {
          sprite.lineStyle(2, 0xff0000)
          sprite.drawRect(-drawW/2, -drawH/2, drawW, drawH)
        } else if (item.type === 'iceblock' || item.type === 'luckygate') {
          sprite.drawRect(-drawW/2, -drawH/2, drawW, drawH)
        } else if (item.type === 'flipper') {
          const len = item.length || 90
          sprite.drawRect(item.side === 'left' ? 0 : -len, -10, len, 20)
        } else {
          const r = item.radius || drawW/2
          sprite.drawCircle(0, 0, r)
        }
        sprite.endFill()
      }

      selectionG!.clear();
      if (isSelected) {
        selectionG!.lineStyle(2, 0x00ffff, 1);
        if (item.type === 'pin' || item.type === 'bumper' || item.type === 'portal') {
            selectionG!.drawCircle(0, 0, (item.radius || drawW/2) + 2);
        } else {
            selectionG!.drawRect(-drawW/2 - 2, -drawH/2 - 2, drawW + 4, drawH + 4);
        }
      }
    })
  }, [items, selectedItemId, setSelectedItemId, updateItem])

  useEffect(() => {
    if (!viewportRef.current) return
    const vp = viewportRef.current
    const onPointerDown = (e: any) => {
      if (e.target === vp) {
        setSelectedItemId(null)
      }
    }
    vp.on('pointerdown', onPointerDown)
    return () => {
      vp.off('pointerdown', onPointerDown)
    }
  }, [setSelectedItemId])

  return (
    <div className="absolute inset-0 w-full h-full bg-[#111]">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
