'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { GripHorizontal, Minus, Maximize2, X } from 'lucide-react'
import { useEditorStore } from '@/store/editorStore'

interface FloatingPanelProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  defaultExpanded?: boolean;
  onClose?: () => void;
  initialWidth?: number;
  initialHeight?: number;
  style?: React.CSSProperties;
  panelId: string;
}

export default function FloatingPanel({ 
  title, 
  icon, 
  children, 
  defaultPosition = { x: 0, y: 0 },
  defaultExpanded = true,
  onClose,
  initialWidth = 320,
  initialHeight = 400,
  style,
  panelId
}: FloatingPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  
  const { panelOrder, bringToFront } = useEditorStore();
  const zIndex = 100 + panelOrder.indexOf(panelId);

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;
    
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      
      setSize({
        width: Math.max(200, startW + dx),
        height: Math.max(100, startH + dy)
      });
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
      dragMomentum={false}
      dragHandle=".drag-handle"
      initial={defaultPosition}
      dragConstraints={{ left: 0, top: 0, right: typeof window !== 'undefined' ? window.innerWidth - 100 : 1920, bottom: typeof window !== 'undefined' ? window.innerHeight - 100 : 1080 }}
      onPointerDownCapture={() => bringToFront(panelId)}
      className={`fixed flex flex-col bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden`}
      style={{ 
        touchAction: "none", 
        zIndex,
        width: size.width,
        height: isExpanded ? size.height : 'auto',
        ...style 
      }}
    >
      {/* Title Bar (Drag Handle) */}
      <div className="drag-handle flex items-center justify-between p-2.5 bg-black/40 border-b border-white/10 cursor-grab active:cursor-grabbing group select-none shrink-0">
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
          {icon && <span className="text-blue-400">{icon}</span>}
          <h3 className="font-bold text-sm text-gray-200 font-outfit tracking-wider uppercase truncate max-w-[150px]">
            {title}
          </h3>
        </div>
        
        <div className="flex items-center gap-1" onPointerDown={e => e.stopPropagation()}>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
            title={isExpanded ? "접기" : "펼치기"}
          >
            {isExpanded ? <Minus className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1 hover:bg-red-500/20 hover:text-red-400 rounded text-gray-400 transition-colors"
              title="닫기"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content Body (Foldable) */}
      {isExpanded && (
        <div className={`flex flex-col flex-1 overflow-y-auto no-scrollbar relative`}>
          {children}
        </div>
      )}

      {/* Resize Handle */}
      {isExpanded && (
        <div 
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize z-50 flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity"
          onPointerDown={handleResizeStart}
        >
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-current text-gray-300">
            <polygon points="10,0 10,10 0,10"/>
          </svg>
        </div>
      )}
    </motion.div>
  )
}
