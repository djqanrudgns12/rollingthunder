'use client'

import { useDroppable } from '@dnd-kit/core'
import { useEditorStore } from '@/store/editorStore'

export default function EditorCanvas() {
  const { isOver, setNodeRef } = useDroppable({
    id: 'editor-canvas',
  })
  const { items, selectedItemId, setSelectedItemId } = useEditorStore()

  return (
    <div className="flex-1 h-full relative p-2 md:p-4 flex items-center justify-center">
      <div 
        ref={setNodeRef}
        onClick={() => setSelectedItemId(null)}
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
            onClick={(e) => { e.stopPropagation(); setSelectedItemId(item.id); }}
            className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all group ${selectedItemId === item.id ? 'ring-4 ring-[var(--accent-primary)] ring-offset-2 ring-offset-black scale-110 z-50' : 'hover:scale-110 hover:brightness-125 z-10'}`}
            style={{ left: item.x, top: item.y }}
          >
            {item.type === 'pin' && <div className="w-[30px] h-[30px] bg-slate-500 rounded-full border-2 border-slate-300 shadow-lg"></div>}
            {item.type === 'bumper' && <div className="w-[30px] h-[30px] bg-orange-500 rounded-full border-2 border-yellow-300 shadow-[0_0_20px_rgba(255,165,0,0.6)]"></div>}
            {item.type === 'wall' && <div className="bg-white/20 border border-white/50 backdrop-blur-md rounded-md shadow-lg flex items-center justify-center text-[10px] text-white/50" style={{ width: item.w || 100, height: item.h || 20, transform: `rotate(${item.rotation || 0}deg)` }}>Wall</div>}
            {item.type === 'booster' && (
              <div className="w-[50px] h-[50px] bg-gradient-to-t from-[var(--accent-primary)] to-transparent opacity-80 border-2 border-[var(--accent-primary)] rounded-md shadow-[0_0_15px_var(--accent-primary)] flex items-center justify-center" style={{ transform: `rotate(${item.rotation || 0}deg)` }}>
                <span className="text-white font-black text-xl leading-none">↑</span>
              </div>
            )}
            {item.type === 'windmill' && (
              <div className="w-[100px] h-[100px] border-2 border-red-500/50 rounded-full flex items-center justify-center bg-red-500/10" style={{ transform: `rotate(${item.rotation || 0}deg)` }}>
                <div className="w-full h-[10px] bg-red-500 absolute shadow-[0_0_10px_red]"></div>
                <div className="w-[10px] h-full bg-red-500 absolute shadow-[0_0_10px_red]"></div>
              </div>
            )}
            {item.type === 'portal' && (
              <div className="w-[40px] h-[40px] rounded-full border-4 flex items-center justify-center animate-[spin_3s_linear_infinite]" style={{ borderColor: item.color || '#c084fc', boxShadow: `0 0 20px ${item.color || '#c084fc'}` }}>
                <div className="w-[20px] h-[20px] rounded-full" style={{ backgroundColor: item.color || '#c084fc' }}></div>
              </div>
            )}
            {item.type === 'blackhole' && (
              <div className="rounded-full border border-white/20 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-black via-black/80 to-transparent pointer-events-none" style={{ width: (item.radius || 150)*2, height: (item.radius || 150)*2, boxShadow: 'inset 0 0 20px rgba(0,0,0,1), 0 0 30px rgba(0,0,0,0.8)' }}>
                <div className="w-[20px] h-[20px] bg-black rounded-full shadow-[0_0_10px_white]"></div>
                <div className="absolute border border-white/10 rounded-full animate-[spin_10s_linear_infinite] border-dashed pointer-events-none" style={{ width: '80%', height: '80%' }}></div>
              </div>
            )}
            
            {/* 호버 시 좌표 표시 툴팁 */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap backdrop-blur-sm border border-white/10">
              {item.type} (x:{Math.round(item.x)}, y:{Math.round(item.y)})
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
