'use client'

import React, { useState } from 'react'
import { useEditorStore } from '@/store/editorStore'

export default function AlignToolbar() {
  const selectedItemIds = useEditorStore(s => s.selectedItemIds)
  const alignSelected = useEditorStore(s => s.alignSelected)
  const distributeSelected = useEditorStore(s => s.distributeSelected)
  const mirrorSelected = useEditorStore(s => s.mirrorSelected)
  const arraySelected = useEditorStore(s => s.arraySelected)

  const [count, setCount] = useState(2)
  const [gapX, setGapX] = useState(60)
  const [gapY, setGapY] = useState(0)

  const n = selectedItemIds.length
  if (n < 1) return null

  const Btn = ({ onClick, disabled, children, title }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="px-2 py-1 rounded text-xs text-gray-200 bg-[#252525] hover:bg-[#333] border border-[#444] disabled:opacity-30 disabled:hover:bg-[#252525] transition-colors"
    >
      {children}
    </button>
  )

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-auto">
      <div className="flex items-center gap-1 bg-[#1a1a1a]/95 border border-[#333] rounded-lg p-1.5 shadow-xl">
        <span className="text-[10px] text-gray-500 px-1">{n}개 선택</span>
        <div className="w-px h-5 bg-[#444] mx-0.5" />
        {/* 정렬 (>=2) */}
        <Btn title="좌측 정렬" disabled={n < 2} onClick={() => alignSelected('left')}>좌</Btn>
        <Btn title="가로 중앙 정렬" disabled={n < 2} onClick={() => alignSelected('centerH')}>↔중</Btn>
        <Btn title="우측 정렬" disabled={n < 2} onClick={() => alignSelected('right')}>우</Btn>
        <Btn title="상단 정렬" disabled={n < 2} onClick={() => alignSelected('top')}>상</Btn>
        <Btn title="세로 중앙 정렬" disabled={n < 2} onClick={() => alignSelected('centerV')}>↕중</Btn>
        <Btn title="하단 정렬" disabled={n < 2} onClick={() => alignSelected('bottom')}>하</Btn>
        <div className="w-px h-5 bg-[#444] mx-0.5" />
        {/* 분포 (>=3) */}
        <Btn title="가로 균등 분포" disabled={n < 3} onClick={() => distributeSelected('h')}>↔분포</Btn>
        <Btn title="세로 균등 분포" disabled={n < 3} onClick={() => distributeSelected('v')}>↕분포</Btn>
        <div className="w-px h-5 bg-[#444] mx-0.5" />
        {/* 미러 (>=1) */}
        <Btn title="좌우 대칭(제자리)" onClick={() => mirrorSelected(false)}>미러</Btn>
        <Btn title="좌우 대칭 복제" onClick={() => mirrorSelected(true)}>미러복제</Btn>
      </div>

      {/* 배열 복제 */}
      <div className="flex items-center gap-1 bg-[#1a1a1a]/95 border border-[#333] rounded-lg p-1.5 shadow-xl text-xs text-gray-300">
        <span className="text-[10px] text-gray-500 px-1">배열</span>
        <label className="flex items-center gap-1">수
          <input type="number" min={1} value={count} onChange={e => setCount(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 bg-[#252525] border border-[#444] rounded px-1 py-0.5 font-mono" />
        </label>
        <label className="flex items-center gap-1">ΔX
          <input type="number" value={gapX} onChange={e => setGapX(parseInt(e.target.value) || 0)}
            className="w-14 bg-[#252525] border border-[#444] rounded px-1 py-0.5 font-mono" />
        </label>
        <label className="flex items-center gap-1">ΔY
          <input type="number" value={gapY} onChange={e => setGapY(parseInt(e.target.value) || 0)}
            className="w-14 bg-[#252525] border border-[#444] rounded px-1 py-0.5 font-mono" />
        </label>
        <button onClick={() => arraySelected(count, gapX, gapY)}
          className="px-2 py-1 rounded text-xs text-black bg-[#00ffcc] hover:bg-[#00e6b8] font-bold transition-colors">생성</button>
      </div>
    </div>
  )
}
