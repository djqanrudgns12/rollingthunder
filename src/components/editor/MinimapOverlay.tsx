'use client'

import React, { useRef } from 'react'
import { useEditorStore, EditorItem } from '@/store/editorStore'
import { motion, useDragControls } from 'framer-motion'
import { GripHorizontal } from 'lucide-react'

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
  const { items, worldHeight, wallStyle, selectedItemId, setSelectedItemId, layoutConfig } = useEditorStore()
  const constraintsRef = useRef<HTMLDivElement>(null)
  const dragControls = useDragControls()

  const MINIMAP_WIDTH = 150
  const scale = MINIMAP_WIDTH / WORLD_WIDTH
  const wh = worldHeight || 3300
  const MINIMAP_HEIGHT = Math.max(wh * scale, 300)

  // 외벽 안쪽 면(StageChrome.createWallGuide 와 동일 수식)
  const narrowInset = wallStyle === 'narrow' ? 100 : 0
  const wideOutset = wallStyle === 'wide' ? -50 : 0
  const leftWall = (narrowInset + wideOutset) * scale
  const rightWall = (WORLD_WIDTH - narrowInset - wideOutset) * scale

  // 시작/종료선 Y (게임과 동일 우선순위)
  const startY = (layoutConfig?.startLineY ?? (layoutConfig?.startMarginPercent ? wh * layoutConfig.startMarginPercent : 70)) * scale
  const endY = (wh * (1 - (layoutConfig?.endMarginPercent ?? 0.02))) * scale

  return (
    <motion.div
      drag
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      className="absolute right-72 top-20 bg-[#0a0a10] border border-[#00ffcc]/40 rounded-lg overflow-hidden shadow-2xl pointer-events-auto z-50 flex flex-col"
      style={{ width: MINIMAP_WIDTH }}
    >
      {/* Drag handle */}
      <div 
        className="h-6 bg-[#1a1a24] border-b border-[#00ffcc]/20 flex items-center justify-center cursor-move select-none hover:bg-[#2a2a34] transition-colors"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <GripHorizontal size={14} className="text-[#00ffcc]/60" />
      </div>
      
      <svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} className="block cursor-crosshair">
        {/* 플레이필드 배경 */}
        <rect x={0} y={0} width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} fill="#0a0a10" />
        {/* 외벽(좌/우) */}
        <line x1={leftWall} y1={0} x2={leftWall} y2={MINIMAP_HEIGHT} stroke="#00ffff" strokeWidth={1.5} strokeOpacity={0.5} />
        <line x1={rightWall} y1={0} x2={rightWall} y2={MINIMAP_HEIGHT} stroke="#00ffff" strokeWidth={1.5} strokeOpacity={0.5} />
        {/* 시작선 / 종료선 */}
        <line x1={0} y1={startY} x2={MINIMAP_WIDTH} y2={startY} stroke="#00FFD0" strokeWidth={2} strokeOpacity={0.8} />
        <line x1={0} y1={endY} x2={MINIMAP_WIDTH} y2={endY} stroke="#FF00FF" strokeWidth={2} strokeOpacity={0.8} />

        {items.map(item => {
          // 시작/종료선은 위에서 layoutConfig 로 이미 그림
          if (item.type === 'startline' || item.type === 'endline') return null
          const cx = (item.x || 0) * scale
          const cy = (item.y || 0) * scale
          const isSel = selectedItemId === item.id
          const fill = isSel ? '#ffffff' : itemColor(item.type, item)
          const onClick = (e: React.MouseEvent) => { e.stopPropagation(); setSelectedItemId(item.id) }

          if (item.type === 'flipper') {
            const len = (item.length || 90) * scale
            return <rect key={item.id} x={item.side === 'left' ? cx : cx - len} y={cy - 2} width={len} height={4} fill={fill} opacity={0.9} onClick={onClick} style={{ cursor: 'pointer' }} />
          }
          if (RECT_TYPES.has(item.type)) {
            const w = Math.max(2, (item.w || 40) * scale)
            const h = Math.max(2, (item.h || 40) * scale)
            return <rect key={item.id} x={cx - w / 2} y={cy - h / 2} width={w} height={h} fill={fill} opacity={0.9} onClick={onClick} style={{ cursor: 'pointer' }} />
          }
          if (CIRCLE_TYPES.has(item.type)) {
            const r = Math.max(1.5, (item.radius || 15) * scale)
            return <circle key={item.id} cx={cx} cy={cy} r={r} fill={fill} opacity={0.9} onClick={onClick} style={{ cursor: 'pointer' }} />
          }
          // windmill: 십자, spinner: 막대
          if (item.type === 'windmill') {
            return <g key={item.id} onClick={onClick} style={{ cursor: 'pointer' }}>
              <rect x={cx - 8 * scale} y={cy - 1.5} width={16 * scale} height={3} fill={fill} opacity={0.8} />
              <rect x={cx - 1.5} y={cy - 8 * scale} width={3} height={16 * scale} fill={fill} opacity={0.8} />
            </g>
          }
          if (item.type === 'spinner') {
            const w = Math.max(2, (item.w || 200) * scale)
            return <rect key={item.id} x={cx - w / 2} y={cy - 2} width={w} height={4} rx={2} fill={fill} opacity={0.9} onClick={onClick} style={{ cursor: 'pointer' }} />
          }
          // 기본: 작은 원
          const r = Math.max(1.5, (item.radius || (item.w ? item.w / 2 : 8)) * scale)
          return <circle key={item.id} cx={cx} cy={cy} r={r} fill={fill} opacity={0.85} onClick={onClick} style={{ cursor: 'pointer' }} />
        })}
      </svg>
    </motion.div>
  )
}
