'use client'

import { useDraggable } from '@dnd-kit/core'
import { EditorItemType } from '@/store/editorStore'

const tools: { id: string; type: EditorItemType; label: string; color: string }[] = [
  { id: 'tool-pin', type: 'pin', label: '일반 핀', color: 'bg-slate-500' },
  { id: 'tool-bumper', type: 'bumper', label: '고탄성 범퍼', color: 'bg-orange-500' },
  { id: 'tool-wall', type: 'wall', label: '가변형 벽돌', color: 'bg-white/20' },
]

function PaletteItem({ tool }: { tool: typeof tools[0] }) {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: tool.id,
    data: { type: tool.type, fromPalette: true },
  })

  return (
    <div 
      ref={setNodeRef} 
      {...listeners} 
      {...attributes}
      className="flex flex-col items-center justify-center gap-3 p-4 bg-black/40 rounded-2xl border border-white/10 hover:border-white/30 hover:bg-white/5 transition-all cursor-grab active:cursor-grabbing touch-none group"
    >
      <div className={`rounded-full shadow-[0_0_15px_rgba(255,255,255,0.1)] group-hover:scale-110 transition-transform ${tool.color} ${tool.type === 'wall' ? 'w-16 h-4 rounded-md' : 'w-10 h-10'}`}></div>
      <span className="text-xs text-[var(--text-secondary)] font-medium whitespace-nowrap">{tool.label}</span>
    </div>
  )
}

export default function ToolPalette() {
  return (
    <div className="w-24 md:w-48 h-full glass-panel-heavy rounded-3xl p-3 md:p-4 flex flex-col gap-4 border border-[var(--accent-secondary)]/30 shrink-0 z-20">
      <h2 className="text-sm md:text-lg font-outfit text-[var(--accent-secondary)] font-bold text-center border-b border-white/10 pb-4 tracking-widest">TOOLS</h2>
      <div className="flex flex-col gap-3 flex-1 overflow-y-auto custom-scrollbar">
        {tools.map(tool => (
          <PaletteItem key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  )
}
