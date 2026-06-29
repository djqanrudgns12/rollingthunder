'use client'

import React, { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { useEditorStore, EditorItem } from '@/store/editorStore'
import { Viewport } from 'pixi-viewport'

export default function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const viewportRef = useRef<Viewport | null>(null)
  const containerRef = useRef<PIXI.Container | null>(null)
  const graphicsMapRef = useRef<Map<string, PIXI.Graphics>>(new Map())
  const gizmoRef = useRef<PIXI.Graphics | null>(null)

  const { items, selectedItemId, setSelectedItemId, updateItem, gridSnap, undo, redo, removeItem, clipboard, setClipboard, addItem } = useEditorStore()

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
      viewport.addChildAt(grid, 0)

      // Gizmo Container
      const gizmo = new PIXI.Graphics()
      viewport.addChild(gizmo)
      gizmoRef.current = gizmo
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

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Input 창에서는 무시
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

  // 아이템 렌더링 동기화
  useEffect(() => {
    if (!containerRef.current || !viewportRef.current) return

    const container = containerRef.current
    const currentIds = new Set(items.map(it => it.id))

    for (const [id, g] of graphicsMapRef.current.entries()) {
      if (!currentIds.has(id)) {
        container.removeChild(g)
        g.destroy()
        graphicsMapRef.current.delete(id)
      }
    }

    items.forEach(item => {
      let g = graphicsMapRef.current.get(item.id)
      if (!g) {
        g = new PIXI.Graphics()
        g.eventMode = 'dynamic'
        g.cursor = 'pointer'
        
        let isDragging = false
        let offset = { x: 0, y: 0 }

        g.on('pointerdown', (e) => {
          e.stopPropagation()
          setSelectedItemId(item.id)
          
          if (viewportRef.current) {
             viewportRef.current.pause = true
          }
          isDragging = true
          const pos = e.data.getLocalPosition(container)
          offset = { x: g!.x - pos.x, y: g!.y - pos.y }
        })

        const onUp = () => {
          isDragging = false
          if (viewportRef.current) viewportRef.current.pause = false
        }
        g.on('pointerup', onUp)
        g.on('pointerupoutside', onUp)

        g.on('pointermove', (e) => {
          if (isDragging) {
            const pos = e.data.getLocalPosition(container)
            let newX = pos.x + offset.x
            let newY = pos.y + offset.y
            
            // Grid Snap 및 Shift 고정 처리는 useEditorStore.getState().gridSnap 참조
            const snap = useEditorStore.getState().gridSnap
            if (snap) {
              newX = Math.round(newX / 10) * 10
              newY = Math.round(newY / 10) * 10
            }

            // Shift키를 누르면 수평/수직 고정 (시작점 기준 - 여기서는 단순화하여 생략하거나 별도 구현 가능)
            if (e.shiftKey) {
              // 수평 수직 고정 로직 (옵션)
            }

            g!.position.set(newX, newY)
            updateItem(item.id, { x: newX, y: newY })
          }
        })

        container.addChild(g)
        graphicsMapRef.current.set(item.id, g)
      }

      g.clear()
      const isSelected = selectedItemId === item.id
      g.alpha = item.flip ? 0.8 : 1 // 반전 시각적 표시 (임시)

      // 그리기 로직
      g.lineStyle(2, isSelected ? 0x00ffff : 0xffffff, 1)
      g.beginFill(0x444444, 0.8)

      let drawW = item.w || 40
      let drawH = item.h || 40

      if (item.type === 'startline') {
        g.lineStyle(2, 0x00ff00)
        g.drawRect(-drawW/2, -drawH/2, drawW, drawH)
      } else if (item.type === 'endline') {
        g.lineStyle(2, 0xff0000)
        g.drawRect(-drawW/2, -drawH/2, drawW, drawH)
      } else if (item.type === 'wall' || item.type === 'iceblock' || item.type === 'luckygate' || item.type === 'piston') {
        g.drawRect(-drawW/2, -drawH/2, drawW, drawH)
      } else if (item.type === 'flipper') {
        const len = item.length || 90
        g.drawRect(item.side === 'left' ? 0 : -len, -10, len, 20)
      } else {
        const r = item.radius || drawW/2
        g.drawCircle(0, 0, r)
      }
      
      g.endFill()

      g.removeChildren()
      const label = new PIXI.Text(item.type, { fill: 0xffffff, fontSize: 10 })
      label.anchor.set(0.5)
      label.rotation = -(item.angle || 0) * Math.PI / 180 // 글자는 항상 정면을 보게 할 수도 있음
      g.addChild(label)

      g.position.set(item.x, item.y)
      g.rotation = (item.angle || 0) * Math.PI / 180

    })
  }, [items, selectedItemId, setSelectedItemId, updateItem])

  // 바탕 클릭 시 선택 해제
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
