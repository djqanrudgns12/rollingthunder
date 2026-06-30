'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { GripHorizontal, Minus, Maximize2, X } from 'lucide-react'

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
  style
}: FloatingPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragHandle=".drag-handle"
      initial={defaultPosition}
      className={`fixed z-[80] flex flex-col ${width} bg-black/60 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl overflow-hidden`}
      style={{ touchAction: "none", ...style }}
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
        <div className={`flex flex-col ${maxHeight} overflow-y-auto no-scrollbar`}>
          {children}
        </div>
      )}
    </motion.div>
  )
}
