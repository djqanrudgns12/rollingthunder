'use client'

import React, { useRef, useEffect, useState } from 'react'
import { useEditorStore, EditorItem } from '@/store/editorStore'
import { motion, useDragControls } from 'framer-motion'
import { GripHorizontal } from 'lucide-react'
import { computeWallSegments, WallStyle } from '@/engine/wallGeometry'
import { itemRotationDeg } from '@/lib/render/rotation'

const WORLD_WIDTH = 800

// 게임 미니맵(PhysicsCanvas createObstacleGraphic 의 mg)과 동일한 색/모양 매핑
function itemColor(type: string, item: EditorItem): string {
  switch (type) {
    case 'pin': return '#00ffcc'
    case 'bumper': return '#ffaa55'
    case 'booster': return '#55ff55'
    case 'windmill': return '#00ffff'
    case 'spinner': return (item.speed ?? 5) > 0 ? '#ff3333' : '#aa33ff'
    case 'portal': return item.color || '#8888ff'
    case 'hole': return '#ff2222'
    case 'piston': return '#ffcc00'
    case 'iceblock': return '#88ccff'
    case 'wall': return '#8888aa'
    case 'windcannon': return '#55aaff'
    case 'luckygate': return '#ffd700'
    case 'flipper': return '#ff4444'
    case 'blackhole': return '#222233'
    case 'whitehole': return '#ffccee'
    case 'polygon': return '#bbbbdd'
    default: return '#aaaaaa'
  }
}

const RECT_TYPES = new Set(['wall', 'piston', 'iceblock', 'luckygate', 'windcannon', 'booster'])
const CIRCLE_TYPES = new Set(['pin', 'bumper', 'portal', 'hole', 'blackhole', 'whitehole'])

export default function MinimapOverlay() {
  const { items, worldHeight, wallStyle, selectedItemId, setSelectedItemId, layoutConfig, panelOrder, bringToFront } = useEditorStore()
  const constraintsRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()
  const svgRef = useRef<SVGSVGElement>(null)
  const indicatorRef = useRef<SVGRectElement>(null)

  const [minimapWidth, setMinimapWidth] = useState(150)
  const scale = minimapWidth / WORLD_WIDTH
  const wh = worldHeight || 3300
  const MINIMAP_HEIGHT = Math.max(wh * scale, 300)

  // 게임과 동일한 외벽 지오메트리(단일 소스). 미니맵도 실제 외벽 세그먼트를 그린다.
  const wallSegments = computeWallSegments(WORLD_WIDTH, wh, 100, (wallStyle as WallStyle) || 'straight')

  // 시작/종료선 Y (게임과 동일 우선순위)
  const startY = (layoutConfig?.startLineY ?? (layoutConfig?.startMarginPercent ? wh * layoutConfig.startMarginPercent : 70)) * scale
  const endY = (wh * (1 - (layoutConfig?.endMarginPercent ?? 0.02))) * scale

  const zIndex = 100 + panelOrder.indexOf('minimap')

  useEffect(() => {
    let frameId: number
    const loop = () => {
      const vp = useEditorStore.getState().editorViewport
      if (vp && indicatorRef.current) {
        const vpScale = vp.scale.x
        if (vpScale > 0) {
          const visibleW = window.innerWidth / vpScale
          const visibleH = window.innerHeight / vpScale
          const cx = vp.center.x
          const cy = vp.center.y
          
          const x0 = cx - visibleW / 2
          const y0 = cy - visibleH / 2
          
          const scaledX0 = x0 * scale
          const scaledY0 = y0 * scale
          const scaledW = visibleW * scale
          const scaledH = visibleH * scale
          
          indicatorRef.current.setAttribute('x', scaledX0.toString())
          indicatorRef.current.setAttribute('y', scaledY0.toString())
          indicatorRef.current.setAttribute('width', scaledW.toString())
          indicatorRef.current.setAttribute('height', scaledH.toString())
        }
      }
      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameId)
  }, [scale])

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    
    const target = e.target as Element
    if (target.id !== 'minimap-bg' && target.tagName.toLowerCase() !== 'svg') return;

    const vp = useEditorStore.getState().editorViewport
    if (!vp || !svgRef.current) return
    
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    vp.moveCenter(x / scale, y / scale)
    
    const onMove = (ev: PointerEvent) => {
      const nx = ev.clientX - rect.left
      const ny = ev.clientY - rect.top
      vp.moveCenter(nx / scale, ny / scale)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startW = minimapWidth;
    
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      setMinimapWidth(Math.max(100, Math.min(600, startW + dx)));
    };
    
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      initial={{ x: typeof window !== 'undefined' ? window.innerWidth - 320 - minimapWidth - 20 : 1000, y: 80 }}
      onPointerDownCapture={() => bringToFront('minimap')}
      className="absolute bg-[#0a0a10] border border-[#00ffcc]/40 rounded-lg overflow-hidden shadow-2xl pointer-events-auto flex flex-col"
      style={{ width: minimapWidth, zIndex }}
    >
      {/* Drag handle */}
      <div 
        className="h-6 bg-[#1a1a24] border-b border-[#00ffcc]/20 flex items-center justify-center cursor-move select-none hover:bg-[#2a2a34] transition-colors"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <GripHorizontal size={14} className="text-[#00ffcc]/60" />
      </div>
      
      <svg ref={svgRef} width={minimapWidth} height={MINIMAP_HEIGHT} className="block cursor-crosshair" onPointerDown={handlePointerDown}>
        {/* 플레이필드 배경 */}
        <rect id="minimap-bg" x={0} y={0} width={minimapWidth} height={MINIMAP_HEIGHT} fill="#0a0a10" />
        
        {/* 인디케이터 (배경 바로 위, 라인들 아래에 렌더링) */}
        <rect ref={indicatorRef} fill="#00ffcc" fillOpacity={0.15} stroke="#00ffcc" strokeWidth={1.5} style={{ pointerEvents: 'none' }} />
        {/* 외벽: 게임 미니맵과 동일하게 실제 외벽 세그먼트를 회색 사각형으로 렌더 */}
        {wallSegments.map(seg => {
          const cx = seg.x * scale
          const cy = seg.y * scale
          const w = Math.max(1, seg.w * scale)
          const h = Math.max(1, seg.h * scale)
          const t = seg.rotation ? `rotate(${seg.rotation}, ${cx}, ${cy})` : undefined
          return <rect key={seg.id} x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill="#8888aa" opacity={0.5} transform={t} style={{ pointerEvents: 'none' }} />
        })}
        {/* 시작선 / 종료선 */}
        <line x1={0} y1={startY} x2={minimapWidth} y2={startY} stroke="#00FFD0" strokeWidth={2} strokeOpacity={0.8} />
        <line x1={0} y1={endY} x2={minimapWidth} y2={endY} stroke="#FF00FF" strokeWidth={2} strokeOpacity={0.8} />

        {items.map(item => {
          // 시작/종료선은 위에서 layoutConfig 로 이미 그림
          if (item.type === 'startline' || item.type === 'endline') return null
          const cx = (item.x || 0) * scale
          const cy = (item.y || 0) * scale
          const isSel = selectedItemId === item.id
          const fill = isSel ? '#ffffff' : itemColor(item.type, item)
          const onClick = (e: React.MouseEvent) => { e.stopPropagation(); setSelectedItemId(item.id) }
          const rotationDeg = itemRotationDeg(item)
          const transform = rotationDeg ? `rotate(${rotationDeg}, ${cx}, ${cy})` : undefined

          if (item.type === 'flipper') {
            const len = (item.length || 90) * scale
            return <rect key={item.id} x={item.side === 'left' ? cx : cx - len} y={cy - 2} width={len} height={4} fill={fill} opacity={0.9} onClick={onClick} transform={transform} style={{ cursor: 'pointer' }} />
          }
          if (item.type === 'polygon' && item.vertices && item.vertices.length > 2) {
            const points = item.vertices.map(v => `${cx + v.x * scale},${cy + v.y * scale}`).join(' ')
            return <polygon key={item.id} points={points} fill={fill} opacity={0.9} onClick={onClick} transform={transform} style={{ cursor: 'pointer' }} />
          }
          if (item.type === 'windcannon') {
            const w = Math.max(2, (item.w || 120) * scale)
            const h = Math.max(2, (item.h || 120) * scale)
            const wcTransform = `rotate(${item.windAngle || 90}, ${cx}, ${cy})`
            return <rect key={item.id} x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill={fill} opacity={0.9} onClick={onClick} transform={wcTransform} style={{ cursor: 'pointer' }} />
          }
          if (RECT_TYPES.has(item.type)) {
            const w = Math.max(2, (item.w || 40) * scale)
            const h = Math.max(2, (item.h || 40) * scale)
            return <rect key={item.id} x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill={fill} opacity={0.9} onClick={onClick} transform={transform} style={{ cursor: 'pointer' }} />
          }
          if (CIRCLE_TYPES.has(item.type)) {
            const r = Math.max(1.5, (item.radius || 15) * scale)
            return <circle key={item.id} cx={cx} cy={cy} r={r} fill={fill} opacity={0.9} onClick={onClick} transform={transform} style={{ cursor: 'pointer' }} />
          }
          // windmill: 십자, spinner: 막대
          if (item.type === 'windmill') {
            return <g key={item.id} onClick={onClick} transform={transform} style={{ cursor: 'pointer' }}>
              <rect x={cx - 8 * scale} y={cy - 1.5} width={16 * scale} height={3} fill={fill} opacity={0.8} />
              <rect x={cx - 1.5} y={cy - 8 * scale} width={3} height={16 * scale} fill={fill} opacity={0.8} />
            </g>
          }
          if (item.type === 'spinner') {
            const w = Math.max(2, (item.w || 200) * scale)
            return <rect key={item.id} x={cx - w / 2} y={cy - 2} width={w} height={4} rx={2} fill={fill} opacity={0.9} onClick={onClick} transform={transform} style={{ cursor: 'pointer' }} />
          }
          // 기본: 작은 원
          const r = Math.max(1.5, (item.radius || (item.w ? item.w / 2 : 8)) * scale)
          return <circle key={item.id} cx={cx} cy={cy} r={r} fill={fill} opacity={0.85} onClick={onClick} style={{ cursor: 'pointer' }} />
        })}
      </svg>
      {/* Resize Handle */}
      <div 
        className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-50 flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity"
        onPointerDown={handleResizeStart}
      >
        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-current text-[#00ffcc]">
          <polygon points="10,0 10,10 0,10"/>
        </svg>
      </div>
    </motion.div>
  )
}
