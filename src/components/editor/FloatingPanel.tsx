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
  width?: string;
  maxHeight?: string;
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
  width = "w-80",
  maxHeight = "max-h-[600px]",
  style,
  panelId
}: FloatingPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [scale, setScale] = useState(1);
  
  const { panelOrder, bringToFront } = useEditorStore();
  const zIndex = 100 + panelOrder.indexOf(panelId);

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startScale = scale;
    
    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      // 기준 패널 너비를 대략 300px로 가정하고 스케일 조정 (비율 유지)
      const newScale = Math.min(Math.max(startScale + dx / 300, 0.5), 2.0);
      setScale(newScale);
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
      className={`fixed flex flex-col ${width} bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden`}
      style={{ 
        touchAction: "none", 
        zIndex,
        scale,
        transformOrigin: "top left",
        backfaceVisibility: "hidden",
        willChange: "transform",
        ...style 
      }}
    >
      {/* Title Bar (Drag Handle) */}
      <div className="drag-handle flex items-center justify-between p-2.5 bg-black/40 border-b border-white/10 cursor-grab active:cursor-grabbing group select-none">
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
          {icon && <span className="text-blue-400">{icon}</span>}
          <h3 className="font-bold text-sm text-gray-200 font-outfit tracking-wider uppercase">
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
        <div className={`flex flex-col ${maxHeight} overflow-y-auto no-scrollbar relative`}>
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
