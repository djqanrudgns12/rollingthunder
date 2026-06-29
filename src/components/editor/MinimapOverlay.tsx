'use client'

import React from 'react'
import { useEditorStore } from '@/store/editorStore'

export default function MinimapOverlay() {
  const { items, worldHeight, selectedItemId, setSelectedItemId, bgImage } = useEditorStore()

  const WORLD_WIDTH = 800;
  // Minimap sizes
  const MINIMAP_WIDTH = 150;
  const scale = MINIMAP_WIDTH / WORLD_WIDTH;
  const MINIMAP_HEIGHT = Math.max((worldHeight || 3300) * scale, 300);

  return (
    <div className="absolute right-72 top-20 bg-[#1a1a1a] border border-[#333] rounded overflow-hidden shadow-2xl opacity-90 pointer-events-auto" style={{ width: MINIMAP_WIDTH, height: MINIMAP_HEIGHT }}>
      <svg width={MINIMAP_WIDTH} height={MINIMAP_HEIGHT} className="relative z-10" onClick={(e) => {
          // Minimap click to select or scroll could be added later
      }}>
        {items.map(item => {
          const cx = (item.x || 0) * scale;
          const cy = (item.y || 0) * scale;
          const isSelected = selectedItemId === item.id;
          const color = isSelected ? '#00ffff' : '#888888';
          
          if (item.type === 'startline' || item.type === 'endline' || item.type === 'wall' || item.type === 'iceblock' || item.type === 'luckygate' || item.type === 'piston') {
            const w = (item.w || 40) * scale;
            const h = (item.h || 40) * scale;
            return (
              <rect 
                key={item.id} 
                x={cx - w/2} 
                y={cy - h/2} 
                width={w} 
                height={h} 
                fill={color} 
                opacity={0.8}
                style={{ cursor: 'pointer' }}
                onClick={(e) => { e.stopPropagation(); setSelectedItemId(item.id); }}
              />
            )
          } else if (item.type === 'flipper') {
            const len = (item.length || 90) * scale;
            return (
              <rect 
                key={item.id} 
                x={item.side === 'left' ? cx : cx - len} 
                y={cy - 5*scale} 
                width={len} 
                height={10*scale} 
                fill={color} 
                opacity={0.8}
                onClick={(e) => { e.stopPropagation(); setSelectedItemId(item.id); }}
              />
            )
          } else {
            const r = (item.radius || (item.w ? item.w/2 : 20)) * scale;
            return (
              <circle 
                key={item.id} 
                cx={cx} 
                cy={cy} 
                r={r} 
                fill={color} 
                opacity={0.8}
                onClick={(e) => { e.stopPropagation(); setSelectedItemId(item.id); }}
              />
            )
          }
        })}
      </svg>
      {/* Viewport indicator can be added here */}
    </div>
  )
}
