'use client'

import React, { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { useEditorStore, EditorItem } from '@/store/editorStore'
import { createAppRenderContext } from '@/lib/render/RenderContext'
import { createObstacleGraphic, ObstacleGraphic } from '@/lib/render/ObstacleRenderer'
import {
  createBackground,
  createStartEndLines,
  createWallGuide,
  WORLD_WIDTH,
  getStartLineY,
} from '@/lib/render/StageChrome'

// 에디터가 사용하는 기물 스프라이트(공유 ObstacleRenderer 와 동일 경로)
const OBSTACLE_TEXTURES = [
  'obstacle_pin', 'obstacle_bumper', 'obstacle_wall', 'obstacle_booster',
  'obstacle_windmill', 'obstacle_portal', 'obstacle_blackhole', 'obstacle_whitehole',
  'obstacle_hole', 'obstacle_piston', 'obstacle_blower',
  'obstacle_wall_neon', 'obstacle_wall_circuit', 'obstacle_wall_matrix', 'obstacle_wall_lava',
  'obstacle_wall_ice', 'obstacle_wall_toxic', 'obstacle_wall_crystal', 'obstacle_wall_grass',
  'obstacle_wall_gold', 'obstacle_wall_steampunk', 'obstacle_wall_gothic', 'obstacle_wall_space',
  'obstacle_wall_candy', 'obstacle_wall_arcade', 'obstacle_wall_plasma'
].map(n => `/images/assets/obstacles/${n}.png`)

const deg2rad = (d: number) => (d * Math.PI) / 180

// Pixi v8/v7 이벤트 호환: 로컬 좌표 변환
function getLocalPos(ev: any, layer: PIXI.Container) {
  if (typeof ev?.getLocalPosition === 'function') return ev.getLocalPosition(layer)
  return ev.data.getLocalPosition(layer)
}

// 원형으로 취급하여 비례 리사이즈하는 타입
const CIRCLE_TYPES = new Set(['pin', 'bumper', 'portal', 'blackhole', 'whitehole', 'hole'])

// x,y 를 제외한 "비주얼 시그니처". 동일하면 노드를 재생성하지 않고 위치만 갱신한다.
// (piston 은 애니메이션이 x,y/waypointB 기준이므로 위치도 시그니처에 포함)
function visualSignature(it: EditorItem, animated: boolean): string {
  const base = [
    it.type, it.w, it.h, it.radius, it.length, it.speed, it.power, it.force,
    it.color, it.windAngle, it.windForce, it.restAngle, it.swingAngle, it.side,
    it.hp, it.angle, it.rotation, animated ? 'a' : 's', JSON.stringify(it.vertices || null),
  ]
  if (it.type === 'piston') base.push(it.x, it.y, JSON.stringify(it.waypointB || null))
  return base.join('|')
}

function applyRotation(node: PIXI.Container, it: EditorItem) {
  node.rotation = it.angle != null ? deg2rad(it.angle) : (it.rotation || 0)
}

interface NodeEntry { gfx: ObstacleGraphic; sig: string }

export default function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const viewportRef = useRef<Viewport | null>(null)
  const chromeRef = useRef<PIXI.Container | null>(null)
  const itemsLayerRef = useRef<PIXI.Container | null>(null)
  const overlayRef = useRef<PIXI.Container | null>(null)
  const nodeMapRef = useRef<Map<string, NodeEntry>>(new Map())
  const readyRef = useRef(false)

  // 스토어는 명령형(subscribe)으로만 다루어 불필요한 React 리렌더를 피한다.
  const setSelectedItemId = (id: string | null) => useEditorStore.getState().setSelectedItemId(id)

  // ---- 메인 PIXI 초기화 (마운트 1회) ----
  useEffect(() => {
    if (!canvasRef.current) return
    let destroyed = false
    const unsubs: Array<() => void> = []

    // Delete 키 이벤트 추가
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 입력창 포커스 중이 아닐 때만
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
        useEditorStore.getState().deleteSelected()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    const init = async () => {
      const app = new PIXI.Application()
      await app.init({ canvas: canvasRef.current!, resizeTo: window, backgroundColor: 0x0a0a10, antialias: true, resolution: window.devicePixelRatio || 1, autoDensity: true })
      if (destroyed) { app.destroy(true, { children: true }); return }
      appRef.current = app

      // 전역 드래그/리사이즈용 stage 인터랙션 활성화
      app.stage.eventMode = 'static'
      app.stage.hitArea = new PIXI.Rectangle(-100000, -100000, 200000, 200000)

      const st = useEditorStore.getState()
      const worldHeight = st.worldHeight || 3300

      const viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        worldWidth: WORLD_WIDTH,
        worldHeight,
        events: app.renderer.events,
      })
      viewport.sortableChildren = true
      viewport.drag({ mouseButtons: 'right' }).pinch().wheel().decelerate()
        .clamp({ left: -300, right: WORLD_WIDTH + 300, top: -600, bottom: worldHeight + 400, underflow: 'center' })
      viewport.clampZoom({ minScale: 0.1, maxScale: 4 })
      app.stage.addChild(viewport)
      viewportRef.current = viewport
      // 시작선이 보이도록 상단 중심으로 이동
      viewport.moveCenter(WORLD_WIDTH / 2, getStartLineY({ worldHeight, layoutConfig: st.layoutConfig }) + 300)

      // 레이어: chrome(배경/벽/라인) → items(기물) → overlay(선택/핸들)
      const chrome = new PIXI.Container(); chrome.zIndex = -50; viewport.addChild(chrome); chromeRef.current = chrome
      const itemsLayer = new PIXI.Container(); itemsLayer.zIndex = 0; itemsLayer.sortableChildren = true; viewport.addChild(itemsLayer); itemsLayerRef.current = itemsLayer
      const overlay = new PIXI.Container(); overlay.zIndex = 100; viewport.addChild(overlay); overlayRef.current = overlay

      // 에셋 프리로드 (기물 + 배경)
      const toLoad = [...OBSTACLE_TEXTURES, ...(st.bgImage ? [st.bgImage] : [])]
      await Promise.all(toLoad.map(u => PIXI.Assets.load(u).catch(() => null)))
      if (destroyed) return

      // 빈 캔버스: 우클릭 드래그 = 패닝, 좌클릭 드래그 = 영역 선택(러버밴드)
      viewport.eventMode = 'static'
      viewport.on('pointerdown', (e: any) => {
        if (e.target !== viewport) return
        if (e.data.button === 0) {
          // 좌클릭: 영역 선택
          startRubberBand(e)
          const s = { x: e.global.x, y: e.global.y }
          const onUp = (ev: any) => {
            const dx = ev.global.x - s.x, dy = ev.global.y - s.y
            if (dx * dx + dy * dy < 25) {
              useEditorStore.getState().setSelectedItemIds([])
              useEditorStore.getState().setSelectedItemId(null)
            }
            appRef.current?.stage.off('pointerup', onUp)
            appRef.current?.stage.off('pointerupoutside', onUp)
          }
          appRef.current?.stage.on('pointerup', onUp)
          appRef.current?.stage.on('pointerupoutside', onUp)
        }
      })
      

      
      // 줌 시 선택 핸들 크기를 화면 고정으로 유지
      viewport.on('zoomed-end', () => buildOverlay())
      viewport.on('zoomed', () => buildOverlay())

      readyRef.current = true
      await buildChrome()
      syncItems()
      buildOverlay()

      // 스토어 구독: 변경 슬라이스별 부분 갱신
      const unsub = useEditorStore.subscribe((state, prev) => {
        if (!readyRef.current) return
        if (state.worldHeight !== prev.worldHeight || state.wallStyle !== prev.wallStyle || state.bgImage !== prev.bgImage || state.layoutConfig !== prev.layoutConfig) {
          updateClamp(); buildChrome()
        }
        if (state.previewAnimating !== prev.previewAnimating) {
          recreateAll(); buildOverlay()
        } else if (state.items !== prev.items) {
          syncItems(); buildOverlay()
        } else if (state.selectedItemIds !== prev.selectedItemIds) {
          buildOverlay()
        }
      })
      unsubs.push(unsub)
    }

    init()

    return () => {
      destroyed = true
      readyRef.current = false
      window.removeEventListener('keydown', handleKeyDown)
      unsubs.forEach(u => u())
      nodeMapRef.current.forEach(e => { e.gfx.dispose() })
      nodeMapRef.current.clear()
      if (viewportRef.current) { try { viewportRef.current.destroy() } catch {} viewportRef.current = null }
      if (appRef.current) { try { appRef.current.destroy(false, { children: true }) } catch {} appRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- chrome(배경/외벽/라인) 재구성 ----
  const buildChrome = async () => {
    const chrome = chromeRef.current; const app = appRef.current
    if (!chrome || !app) return
    const st = useEditorStore.getState()
    if (st.bgImage) { await PIXI.Assets.load(st.bgImage).catch(() => null) }
    if (!chromeRef.current) return
    chrome.removeChildren().forEach(c => c.destroy({ children: true }))
    const opts = { worldHeight: st.worldHeight || 3300, wallStyle: st.wallStyle, layoutConfig: st.layoutConfig }
    const ctx = createAppRenderContext(app)
    const bg = createBackground(ctx, st.bgImage || undefined, opts)
    if (bg) chrome.addChild(bg)
    const lines = createStartEndLines(opts); lines.zIndex = -1; chrome.addChild(lines)
    const wallGuide = createWallGuide(opts); chrome.addChild(wallGuide)
    chrome.sortableChildren = true
  }

  const updateClamp = () => {
    const vp = viewportRef.current; if (!vp) return
    const wh = useEditorStore.getState().worldHeight || 3300
    vp.clamp({ left: -300, right: WORLD_WIDTH + 300, top: -600, bottom: wh + 400, underflow: 'center' })
  }

  // ---- 기물 노드 동기화(재조정) ----
  const syncItems = () => {
    const itemsLayer = itemsLayerRef.current; const app = appRef.current
    if (!itemsLayer || !app) return
    const st = useEditorStore.getState()
    const animated = st.previewAnimating
    const ctx = createAppRenderContext(app, { animated, quality: 'full' })
    const map = nodeMapRef.current
    const seen = new Set<string>()

    for (const item of st.items) {
      // 시작/종료선은 layoutConfig 기반 chrome 으로 그리므로 기물로 렌더하지 않음
      if (item.type === 'startline' || item.type === 'endline') continue
      seen.add(item.id)
      const sig = visualSignature(item, animated)
      const prev = map.get(item.id)
      if (prev && prev.sig === sig) {
        prev.gfx.node.position.set(item.x, item.y)
        applyRotation(prev.gfx.node, item)
        continue
      }
      if (prev) { prev.gfx.dispose(); itemsLayer.removeChild(prev.gfx.node); prev.gfx.node.destroy({ children: true }) }
      const gfx = createObstacleGraphic(item, ctx)
      gfx.node.position.set(item.x, item.y)
      applyRotation(gfx.node, item)
      attachInteraction(gfx.node, item.id)
      itemsLayer.addChild(gfx.node)
      map.set(item.id, { gfx, sig })
    }
    // 삭제된 기물 정리
    for (const [id, e] of map) {
      if (!seen.has(id)) { e.gfx.dispose(); itemsLayer.removeChild(e.gfx.node); e.gfx.node.destroy({ children: true }); map.delete(id) }
    }
  }

  const recreateAll = () => {
    const itemsLayer = itemsLayerRef.current; if (!itemsLayer) return
    nodeMapRef.current.forEach(e => { e.gfx.dispose(); itemsLayer.removeChild(e.gfx.node); e.gfx.node.destroy({ children: true }) })
    nodeMapRef.current.clear()
    syncItems()
  }

  // ---- 기물 클릭/드래그 ----
  const attachInteraction = (node: PIXI.Container, id: string) => {
    node.eventMode = 'static'
    node.cursor = 'pointer'
    node.on('pointerdown', (e: any) => {
      e.stopPropagation()
      const vp = viewportRef.current; const itemsLayer = itemsLayerRef.current
      if (!vp || !itemsLayer) return
      const store = useEditorStore.getState()

      // Shift-클릭: 선택 토글 (드래그 없음)
      if (e.shiftKey) { store.toggleSelectedItem(id); return }

      // 이미 다중 선택에 포함된 기물을 누르면 그룹 전체를 이동, 아니면 단일 선택
      if (!store.selectedItemIds.includes(id)) setSelectedItemId(id)

      vp.plugins.pause('drag')
      const start = getLocalPos(e, itemsLayer)
      const primary = useEditorStore.getState().items.find(it => it.id === id)
      const px0 = primary?.x || 0, py0 = primary?.y || 0
      let lastDx = 0, lastDy = 0

      const onMove = (ev: any) => {
        const p = getLocalPos(ev, itemsLayer)
        let dx = p.x - start.x, dy = p.y - start.y
        if (useEditorStore.getState().gridSnap) {
          dx = Math.round((px0 + dx) / 10) * 10 - px0
          dy = Math.round((py0 + dy) / 10) * 10 - py0
        }
        const incDx = dx - lastDx, incDy = dy - lastDy
        lastDx = dx; lastDy = dy
        if (incDx || incDy) useEditorStore.getState().moveSelectedBy(incDx, incDy, false)
      }
      const onUp = () => {
        vp.plugins.resume('drag')
        useEditorStore.getState().commitHistory()
        appRef.current?.stage.off('pointermove', onMove)
        appRef.current?.stage.off('pointerup', onUp)
        appRef.current?.stage.off('pointerupoutside', onUp)
      }
      appRef.current?.stage.on('pointermove', onMove)
      appRef.current?.stage.on('pointerup', onUp)
      appRef.current?.stage.on('pointerupoutside', onUp)
    })
  }

  // ---- 러버밴드(영역) 선택 ----
  const startRubberBand = (e: any) => {
    const vp = viewportRef.current; const itemsLayer = itemsLayerRef.current; const overlay = overlayRef.current
    if (!vp || !itemsLayer || !overlay) return
    vp.plugins.pause('drag')
    const start = getLocalPos(e, itemsLayer)
    const rb = new PIXI.Graphics()
    overlay.addChild(rb)
    const draw = (p: any) => {
      const z = vp.scale.x || 1
      rb.clear()
      rb.rect(Math.min(start.x, p.x), Math.min(start.y, p.y), Math.abs(p.x - start.x), Math.abs(p.y - start.y))
      rb.fill({ color: 0x00aaff, alpha: 0.12 }).stroke({ width: 1 / z, color: 0x00aaff, alpha: 0.9 })
    }
    const onMove = (ev: any) => draw(getLocalPos(ev, itemsLayer))
    const onUp = (ev: any) => {
      const p = getLocalPos(ev, itemsLayer)
      const x0 = Math.min(start.x, p.x), x1 = Math.max(start.x, p.x), y0 = Math.min(start.y, p.y), y1 = Math.max(start.y, p.y)
      rb.destroy()
      const ids = useEditorStore.getState().items
        .filter(it => it.type !== 'startline' && it.type !== 'endline' && it.x >= x0 && it.x <= x1 && it.y >= y0 && it.y <= y1)
        .map(it => it.id)
      useEditorStore.getState().setSelectedItemIds(ids)
      vp.plugins.resume('drag')
      appRef.current?.stage.off('pointermove', onMove)
      appRef.current?.stage.off('pointerup', onUp)
      appRef.current?.stage.off('pointerupoutside', onUp)
    }
    appRef.current?.stage.on('pointermove', onMove)
    appRef.current?.stage.on('pointerup', onUp)
    appRef.current?.stage.on('pointerupoutside', onUp)
  }

  // ---- 선택 오버레이(테두리 + 리사이즈 핸들 + 폴리곤 정점) ----
  const buildOverlay = () => {
    const overlay = overlayRef.current; if (!overlay) return
    overlay.removeChildren().forEach(c => c.destroy({ children: true }))
    const st = useEditorStore.getState()
    const ids = st.selectedItemIds
    if (ids.length === 0) return

    const z = viewportRef.current?.scale.x || 1

    // 다중 선택: 각 기물에 링만 표시(편집 핸들 없음)
    if (ids.length > 1) {
      for (const sid of ids) {
        const it = st.items.find(i => i.id === sid); const en = nodeMapRef.current.get(sid)
        if (!it || !en) continue
        const bb = en.gfx.node.getLocalBounds()
        const ring = new PIXI.Graphics()
        ring.position.set(it.x, it.y)
        applyRotation(ring, it)
        ring.rect(bb.x - 2 / z, bb.y - 2 / z, bb.width + 4 / z, bb.height + 4 / z)
        ring.stroke({ width: 2 / z, color: 0x00ffcc, alpha: 0.9 })
        overlay.addChild(ring)
      }
      return
    }

    const id = ids[0]
    const item = st.items.find(it => it.id === id); if (!item) return
    const entry = nodeMapRef.current.get(id); if (!entry) return

    const sel = new PIXI.Container()
    sel.position.set(item.x, item.y)
    applyRotation(sel, item)
    overlay.addChild(sel)

    // 줌 무관 화면 고정 크기 (핸들/선 두께)
    const hs = 5 / z         // 핸들 반크기
    const sw = 2 / z         // 선 두께
    const pad = 3 / z        // 테두리 여백

    if (item.type === 'polygon') { buildPolygonHandles(sel, item, hs, sw); return }

    // 비주얼 경계 기반 선택 박스
    let hw, hh, cx, cy
    if (item.type === 'piston') {
      hw = Math.max(8, (item.w || 100) / 2)
      hh = Math.max(8, (item.h || 20) / 2)
      cx = 0
      cy = 0
    } else {
      const b = entry.gfx.node.getLocalBounds()
      hw = Math.max(8, b.width / 2)
      hh = Math.max(8, b.height / 2)
      cx = b.x + b.width / 2
      cy = b.y + b.height / 2
    }

    const ring = new PIXI.Graphics()
    ring.rect(cx - hw - pad, cy - hh - pad, hw * 2 + pad * 2, hh * 2 + pad * 2)
    ring.stroke({ width: sw, color: 0x00aaff, alpha: 0.95 })
    sel.addChild(ring)

    const isCircle = CIRCLE_TYPES.has(item.type)
    const handleDefs: Array<[string, number, number]> = [
      ['tl', cx - hw, cy - hh], ['tc', cx, cy - hh], ['tr', cx + hw, cy - hh],
      ['cl', cx - hw, cy], ['cr', cx + hw, cy],
      ['bl', cx - hw, cy + hh], ['bc', cx, cy + hh], ['br', cx + hw, cy + hh],
    ]
    for (const [type, hx, hy] of handleDefs) {
      const h = new PIXI.Graphics()
      h.rect(-hs, -hs, hs * 2, hs * 2).fill({ color: 0xffffff }).stroke({ width: sw, color: 0x00aaff })
      h.position.set(hx, hy)
      h.eventMode = 'static'
      if (type === 'tl' || type === 'br') h.cursor = 'nwse-resize'
      else if (type === 'tr' || type === 'bl') h.cursor = 'nesw-resize'
      else if (type === 'tc' || type === 'bc') h.cursor = 'ns-resize'
      else h.cursor = 'ew-resize'
      attachResize(h, item.id, type, isCircle)
      sel.addChild(h)
    }

    // 회전 핸들 (원형 타입 제외) — 우측 상단 모서리 바깥쪽 (버튼형)
    if (!isCircle) {
      const rx = cx + hw + 20 / z
      const ry = cy - hh - 20 / z
      const rot = new PIXI.Graphics()
      rot.circle(0, 0, hs * 1.8).fill({ color: 0x00ffcc, alpha: 0.9 }).stroke({ width: sw, color: 0xffffff })
      rot.circle(0, 0, hs * 0.7).fill({ color: 0xffffff }) // 내부에 흰색 점으로 아이콘 느낌 추가
      rot.position.set(rx, ry)
      rot.eventMode = 'static'; rot.cursor = 'grab'
      attachRotate(rot, item.id)
      sel.addChild(rot)
    }

    // 피스톤의 경우 waypointB 조절 전용 주황색 핸들 추가
    if (item.type === 'piston' && item.waypointB) {
      // item.waypointB는 절대좌표이므로 sel 내부의 로컬 좌표로 변환하기 위해 역회전을 적용한다.
      const dx = item.waypointB.x - item.x
      const dy = item.waypointB.y - item.y
      const rot = -(item.angle != null ? deg2rad(item.angle) : (item.rotation || 0))
      
      const localX = dx * Math.cos(rot) - dy * Math.sin(rot)
      const localY = dx * Math.sin(rot) + dy * Math.cos(rot)
      
      const wptHandle = new PIXI.Graphics()
      wptHandle.circle(0, 0, hs * 1.5).fill({ color: 0xffaa00 }).stroke({ width: sw, color: 0xffffff })
      wptHandle.position.set(localX, localY)
      wptHandle.eventMode = 'static'
      wptHandle.cursor = 'pointer'
      
      wptHandle.on('pointerdown', (e: any) => {
        e.stopPropagation()
        const vp = viewportRef.current; const itemsLayer = itemsLayerRef.current
        if (!vp || !itemsLayer) return
        vp.plugins.pause('drag')
        const start = getLocalPos(e, itemsLayer) // 월드 좌표계
        const startWp = { x: item.waypointB!.x, y: item.waypointB!.y }
        
        const onMove = (ev: any) => {
          const p = getLocalPos(ev, itemsLayer)
          let nx = startWp.x + (p.x - start.x)
          let ny = startWp.y + (p.y - start.y)
          if (useEditorStore.getState().gridSnap) {
            nx = Math.round(nx / 10) * 10
            ny = Math.round(ny / 10) * 10
          }
          useEditorStore.getState().updateItemSilent(item.id, { waypointB: { x: nx, y: ny } })
        }
        const onUp = () => {
          vp.plugins.resume('drag')
          useEditorStore.getState().commitHistory()
          appRef.current?.stage.off('pointermove', onMove)
          appRef.current?.stage.off('pointerup', onUp)
          appRef.current?.stage.off('pointerupoutside', onUp)
        }
        appRef.current?.stage.on('pointermove', onMove)
        appRef.current?.stage.on('pointerup', onUp)
        appRef.current?.stage.on('pointerupoutside', onUp)
      })
      
      sel.addChild(wptHandle)
    }
  }

  const attachRotate = (handle: PIXI.Graphics, id: string) => {
    handle.on('pointerdown', (e: any) => {
      e.stopPropagation()
      const vp = viewportRef.current; const itemsLayer = itemsLayerRef.current
      if (!vp || !itemsLayer) return
      vp.plugins.pause('drag')
      const onMove = (ev: any) => {
        const p = getLocalPos(ev, itemsLayer)
        const it = useEditorStore.getState().items.find(i => i.id === id)
        if (!it) return
        let deg = Math.atan2(p.y - it.y, p.x - it.x) * 180 / Math.PI + 90
        if (useEditorStore.getState().gridSnap) deg = Math.round(deg / 15) * 15
        deg = ((deg % 360) + 360) % 360
        useEditorStore.getState().updateItemSilent(id, { angle: Math.round(deg) })
      }
      const onUp = () => {
        vp.plugins.resume('drag')
        useEditorStore.getState().commitHistory()
        appRef.current?.stage.off('pointermove', onMove)
        appRef.current?.stage.off('pointerup', onUp)
        appRef.current?.stage.off('pointerupoutside', onUp)
      }
      appRef.current?.stage.on('pointermove', onMove)
      appRef.current?.stage.on('pointerup', onUp)
      appRef.current?.stage.on('pointerupoutside', onUp)
    })
  }

  const attachResize = (handle: PIXI.Graphics, id: string, type: string, isCircle: boolean) => {
    handle.on('pointerdown', (e: any) => {
      e.stopPropagation()
      const vp = viewportRef.current; const itemsLayer = itemsLayerRef.current
      if (!vp || !itemsLayer) return
      vp.plugins.pause('drag')
      const start = getLocalPos(e, itemsLayer)
      const cur = useEditorStore.getState().items.find(it => it.id === id)
      if (!cur) return
      const startW = cur.w || 40, startH = cur.h || 40, startR = cur.radius || startW / 2

      const onMove = (ev: any) => {
        const p = getLocalPos(ev, itemsLayer)
        const dx = p.x - start.x, dy = p.y - start.y
        const snap = useEditorStore.getState().gridSnap
        if (isCircle) {
          const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy
          const sign = (type === 'br' || type === 'cr' || type === 'bc' || type === 'tr') ? 1 : -1
          let nr = Math.max(5, startR + sign * delta)
          if (snap) nr = Math.round(nr / 5) * 5
          useEditorStore.getState().updateItemSilent(id, { radius: nr, w: nr * 2, h: nr * 2 })
        } else {
          let nw = startW, nh = startH
          if (type.includes('r')) nw = Math.max(10, startW + dx * 2)
          if (type.includes('l')) nw = Math.max(10, startW - dx * 2)
          if (type.includes('b')) nh = Math.max(10, startH + dy * 2)
          if (type.includes('t')) nh = Math.max(10, startH - dy * 2)
          if (snap) { nw = Math.round(nw / 10) * 10; nh = Math.round(nh / 10) * 10 }
          useEditorStore.getState().updateItemSilent(id, { w: Math.round(nw), h: Math.round(nh) })
        }
      }
      const onUp = () => {
        vp.plugins.resume('drag')
        useEditorStore.getState().commitHistory()
        appRef.current?.stage.off('pointermove', onMove)
        appRef.current?.stage.off('pointerup', onUp)
        appRef.current?.stage.off('pointerupoutside', onUp)
      }
      appRef.current?.stage.on('pointermove', onMove)
      appRef.current?.stage.on('pointerup', onUp)
      appRef.current?.stage.on('pointerupoutside', onUp)
    })
  }

  const buildPolygonHandles = (sel: PIXI.Container, item: EditorItem, hs = 5, sw = 2) => {
    const verts = item.vertices || []
    const outline = new PIXI.Graphics()
    if (verts.length > 0) {
      outline.moveTo(verts[0].x, verts[0].y)
      for (let i = 1; i < verts.length; i++) outline.lineTo(verts[i].x, verts[i].y)
      outline.closePath()
      outline.stroke({ width: sw, color: 0x00aaff, alpha: 0.95 })
    }
    sel.addChild(outline)

    // 폴리곤 회전 핸들 (우측 상단 모서리 바깥쪽)
    if (verts.length > 0) {
      const maxX = Math.max(...verts.map(v => v.x))
      const minY = Math.min(...verts.map(v => v.y))
      const rot = new PIXI.Graphics()
      rot.circle(0, 0, hs * 1.8).fill({ color: 0x00ffcc, alpha: 0.9 }).stroke({ width: sw, color: 0xffffff })
      rot.circle(0, 0, hs * 0.7).fill({ color: 0xffffff })
      rot.position.set(maxX + hs * 4, minY - hs * 4) // 대략 20 / z 만큼 이격
      rot.eventMode = 'static'; rot.cursor = 'grab'
      attachRotate(rot, item.id)
      sel.addChild(rot)
    }

    verts.forEach((v, idx) => {
      const h = new PIXI.Graphics()
      h.circle(0, 0, hs * 1.3).fill({ color: 0xffffff }).stroke({ width: sw, color: 0x00aaff })
      h.position.set(v.x, v.y)
      h.eventMode = 'static'; h.cursor = 'crosshair'
      h.on('pointerdown', (e: any) => {
        e.stopPropagation()
        const vp = viewportRef.current; const itemsLayer = itemsLayerRef.current
        if (!vp || !itemsLayer) return
        vp.plugins.pause('drag')
        const start = getLocalPos(e, itemsLayer)
        const cur = useEditorStore.getState().items.find(it => it.id === item.id)
        if (!cur?.vertices) return
        const startV = { x: cur.vertices[idx].x, y: cur.vertices[idx].y }
        const onMove = (ev: any) => {
          const p = getLocalPos(ev, itemsLayer)
          let nx = startV.x + (p.x - start.x), ny = startV.y + (p.y - start.y)
          if (useEditorStore.getState().gridSnap) { nx = Math.round(nx / 10) * 10; ny = Math.round(ny / 10) * 10 }
          const nv = [...(useEditorStore.getState().items.find(it => it.id === item.id)?.vertices || [])]
          nv[idx] = { x: nx, y: ny }
          useEditorStore.getState().updateItemSilent(item.id, { vertices: nv })
        }
        const onUp = () => {
          vp.plugins.resume('drag')
          useEditorStore.getState().commitHistory()
          appRef.current?.stage.off('pointermove', onMove)
          appRef.current?.stage.off('pointerup', onUp)
          appRef.current?.stage.off('pointerupoutside', onUp)
        }
        appRef.current?.stage.on('pointermove', onMove)
        appRef.current?.stage.on('pointerup', onUp)
        appRef.current?.stage.on('pointerupoutside', onUp)
      })
      sel.addChild(h)
    })
  }

  // ---- 키보드 단축키 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const ctrl = e.ctrlKey || e.metaKey
      const st = useEditorStore.getState()
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selectedItemIds.length || st.selectedItemId) st.deleteSelected()
      } else if ((st.selectedItemIds.length || st.selectedItemId) && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        st.moveSelectedBy(dx, dy, true)
      } else if (ctrl && e.key === 'z') {
        e.preventDefault(); e.shiftKey ? st.redo() : st.undo()
      } else if (ctrl && e.key === 'y') {
        e.preventDefault(); st.redo()
      } else if (ctrl && e.key === 'c') {
        if (st.selectedItemId) { const it = st.items.find(i => i.id === st.selectedItemId); if (it) st.setClipboard(it) }
      } else if (ctrl && (e.key === 'v' || e.key === 'd')) {
        e.preventDefault()
        const src = e.key === 'v' ? st.clipboard : st.items.find(i => i.id === st.selectedItemId)
        if (src) {
          const ni = { ...src, id: `${src.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, x: src.x + 20, y: src.y + 20 }
          st.addItem(ni); st.setSelectedItemId(ni.id)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- 팔레트 드래그&드롭 ----
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const rawData = e.dataTransfer.getData('application/x-editor-item')
    if (!rawData) return
    let type: any, variant: string | undefined
    try {
      const parsed = JSON.parse(rawData)
      type = parsed.type
      variant = parsed.variant
    } catch {
      type = rawData
    }
    if (!type || !viewportRef.current || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const world = viewportRef.current.toWorld(e.clientX - rect.left, e.clientY - rect.top)
    const ni: EditorItem = {
      id: `${type}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      type, variant, x: Math.round(world.x), y: Math.round(world.y),
      speed: 1.0, restitution: 0.5, friction: 0.1, flip: false,
    }
    switch (type) {
      case 'wall': case 'piston': case 'startline': case 'endline': ni.w = 100; ni.h = 20; break
      case 'iceblock': ni.w = 60; ni.h = 25; ni.hp = 3; ni.maxHp = 3; break
      case 'windcannon': ni.w = 120; ni.h = 120; ni.windAngle = 90; ni.windForce = 15; break
      case 'luckygate': ni.w = 140; ni.h = 20; break
      case 'flipper': ni.w = 90; ni.h = 20; ni.length = 90; ni.side = 'left'; ni.restAngle = 30; ni.swingAngle = -30; break
      case 'pin': case 'bumper': ni.radius = 15; break
      case 'blackhole': ni.radius = 150; ni.force = 5; break
      case 'whitehole': ni.radius = 120; ni.force = 5; break
      case 'hole': ni.radius = 30; break
      case 'portal': ni.radius = 40; ni.color = '#c084fc'; break
      case 'polygon':
        ni.w = 100; ni.h = 100
        ni.vertices = [{ x: -50, y: -50 }, { x: 50, y: -50 }, { x: 50, y: 50 }, { x: -50, y: 50 }]
        break
      default: ni.w = 40; ni.h = 40
    }
    if (type === 'piston') ni.waypointB = { x: ni.x + 150, y: ni.y }
    useEditorStore.getState().addItem(ni)
    setSelectedItemId(ni.id)
  }

  const zoomBy = (factor: number) => {
    const vp = viewportRef.current; if (!vp) return
    const ns = Math.min(4, Math.max(0.1, vp.scale.x * factor))
    vp.setZoom(ns, true)
    vp.emit('zoomed-end', vp as any)
  }
  const zoomReset = () => {
    const vp = viewportRef.current; if (!vp) return
    vp.setZoom(1, true); vp.emit('zoomed-end', vp as any)
  }
  const zoomFit = () => {
    const vp = viewportRef.current; if (!vp) return
    const wh = useEditorStore.getState().worldHeight || 3300
    vp.fit(true, WORLD_WIDTH, wh)
    vp.moveCenter(WORLD_WIDTH / 2, wh / 2)
    vp.emit('zoomed-end', vp as any)
  }

  return (
    <div
      className="absolute inset-0 w-full h-full"
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
    >
      <canvas ref={canvasRef} className="w-full h-full outline-none" tabIndex={0} />
      {/* 줌 컨트롤 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-[#1a1a1a]/90 border border-[#333] rounded-lg p-1 pointer-events-auto shadow-lg z-20">
        <button onClick={() => zoomBy(1 / 1.25)} className="w-8 h-8 rounded text-gray-300 hover:bg-[#333] text-lg" title="축소">−</button>
        <button onClick={zoomReset} className="px-2 h-8 rounded text-gray-300 hover:bg-[#333] text-xs font-mono" title="100%">1:1</button>
        <button onClick={zoomFit} className="px-2 h-8 rounded text-gray-300 hover:bg-[#333] text-xs" title="전체 보기">Fit</button>
        <button onClick={() => zoomBy(1.25)} className="w-8 h-8 rounded text-gray-300 hover:bg-[#333] text-lg" title="확대">+</button>
      </div>
    </div>
  )
}
