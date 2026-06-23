'use client'

import { useDroppable } from '@dnd-kit/core'
import { useEditorStore } from '@/store/editorStore'

export default function EditorCanvas() {
  const { isOver, setNodeRef } = useDroppable({
    id: 'editor-canvas',
  })
  const items = useEditorStore(state => state.items)

  return (
    <div className="flex-1 h-full relative p-2 md:p-4 flex items-center justify-center">
      <div 
        ref={setNodeRef}
        className={`w-full max-w-[800px] h-full max-h-[1200px] bg-black/50 rounded-3xl border transition-all duration-300 relative overflow-hidden
          ${isOver ? 'border-[var(--accent-primary)] shadow-[0_0_40px_rgba(0,255,204,0.1)] scale-[1.01]' : 'border-white/10 shadow-2xl'}
        `}
        style={{
          // 16x16 그리드 배경 패턴 (스냅 효과 시각화)
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          backgroundPosition: 'center'
        }}
      >
        {items.map(item => (
          <div 
            key={item.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 hover:brightness-125 transition-all group"
            style={{ left: item.x, top: item.y }}
          >
            {item.type === 'pin' && <div className="w-[30px] h-[30px] bg-slate-500 rounded-full border-2 border-slate-300 shadow-lg"></div>}
            {item.type === 'bumper' && <div className="w-[30px] h-[30px] bg-orange-500 rounded-full border-2 border-yellow-300 shadow-[0_0_20px_rgba(255,165,0,0.6)]"></div>}
            {item.type === 'wall' && <div className="w-[100px] h-[20px] bg-white/20 border border-white/50 backdrop-blur-md rounded-md shadow-lg" style={{ transform: `rotate(${item.rotation || 0}deg)` }}></div>}
            
            {/* 호버 시 좌표 표시 툴팁 */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap backdrop-blur-sm border border-white/10">
              x:{item.x} y:{item.y}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
