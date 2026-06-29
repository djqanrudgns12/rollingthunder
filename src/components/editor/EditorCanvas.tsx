'use client'

import React, { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { useEditorStore } from '@/store/editorStore'
import { Viewport } from 'pixi-viewport'

export default function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const viewportRef = useRef<Viewport | null>(null)
  const containerRef = useRef<PIXI.Container | null>(null)
  const graphicsMapRef = useRef<Map<string, PIXI.Graphics>>(new Map())

  const { items, selectedItemId, setSelectedItemId, updateItem } = useEditorStore()

  useEffect(() => {
    if (!canvasRef.current) return

    let isDestroyed = false;

    const initPixi = async () => {
      const app = new PIXI.Application()
      
      // Fix for Strict mode early destroy error:
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
        worldWidth: 800,
        worldHeight: 3000,
        events: app.renderer.events
      })
      
      viewport.drag().pinch().wheel().decelerate()
      app.stage.addChild(viewport)
      viewportRef.current = viewport

      // 중앙 정렬
      viewport.moveCenter(400, 400)

      const container = new PIXI.Container()
      viewport.addChild(container)
      containerRef.current = container

      // Background grid
      const grid = new PIXI.Graphics()
      grid.lineStyle(1, 0x333333, 0.5)
      for (let i = 0; i <= 800; i += 50) {
        grid.moveTo(i, 0).lineTo(i, 3000)
      }
      for (let i = 0; i <= 3000; i += 50) {
        grid.moveTo(0, i).lineTo(800, i)
      }
      viewport.addChildAt(grid, 0)
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

  // 아이템 렌더링 동기화
  useEffect(() => {
    if (!containerRef.current || !viewportRef.current) return

    const container = containerRef.current
    const currentIds = new Set(items.map(it => it.id))

    // 삭제된 아이템 제거
    for (const [id, g] of graphicsMapRef.current.entries()) {
      if (!currentIds.has(id)) {
        container.removeChild(g)
        g.destroy()
        graphicsMapRef.current.delete(id)
      }
    }

    // 아이템 추가 및 업데이트
    items.forEach(item => {
      let g = graphicsMapRef.current.get(item.id)
      if (!g) {
        g = new PIXI.Graphics()
        g.eventMode = 'dynamic'
        g.cursor = 'pointer'
        
        // 드래그 로직
        let isDragging = false
        let offset = { x: 0, y: 0 }

        g.on('pointerdown', (e) => {
          e.stopPropagation()
          setSelectedItemId(item.id)
          
          if (viewportRef.current) {
             viewportRef.current.pause = true // 드래그 시 뷰포트 이동 방지
          }
          isDragging = true
          const pos = e.data.getLocalPosition(container)
          offset = { x: g!.x - pos.x, y: g!.y - pos.y }
        })

        g.on('pointerup', () => {
          isDragging = false
          if (viewportRef.current) viewportRef.current.pause = false
        })
        g.on('pointerupoutside', () => {
          isDragging = false
          if (viewportRef.current) viewportRef.current.pause = false
        })

        g.on('pointermove', (e) => {
          if (isDragging) {
            const pos = e.data.getLocalPosition(container)
            // 소수점 스냅 방지 (자유로운 움직임)
            const newX = pos.x + offset.x
            const newY = pos.y + offset.y
            g!.position.set(newX, newY)
            updateItem(item.id, { x: newX, y: newY })
          }
        })

        container.addChild(g)
        graphicsMapRef.current.set(item.id, g)
      }

      // 렌더링 업데이트
      g.clear()
      const isSelected = selectedItemId === item.id

      g.lineStyle(isSelected ? 3 : 1, isSelected ? 0x00ff00 : 0xffffff, 1)
      g.beginFill(0x444444, 0.8)

      // 타입별 그리기
      if (item.type === 'wall' || item.type === 'iceblock' || item.type === 'luckygate') {
        const w = item.w || 100
        const h = item.h || 20
        g.drawRect(-w/2, -h/2, w, h)
      } else if (item.type === 'pin' || item.type === 'bumper' || item.type === 'windmill' || item.type === 'windcannon') {
        const r = item.radius || (item.w ? item.w/2 : 20)
        g.drawCircle(0, 0, r)
      } else if (item.type === 'piston') {
        const w = item.w || 100
        const h = item.h || 20
        g.drawRect(-w/2, -h/2, w, h)
      } else if (item.type === 'flipper') {
        const len = item.length || 90
        g.drawRect(item.side === 'left' ? 0 : -len, -10, len, 20)
      } else {
        g.drawRect(-25, -25, 50, 50)
      }
      
      g.endFill()

      // 텍스트 라벨
      g.removeChildren()
      const label = new PIXI.Text(item.type, { fill: 0xffffff, fontSize: 12 })
      label.anchor.set(0.5)
      g.addChild(label)

      g.position.set(item.x, item.y)
      g.rotation = item.angle || 0

    })

  }, [items, selectedItemId, setSelectedItemId, updateItem])

  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  )
}
