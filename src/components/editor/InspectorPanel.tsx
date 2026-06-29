'use client'

import React from 'react'
import { useEditorStore, EditorItem } from '@/store/editorStore'

export default function InspectorPanel() {
  const { items, selectedItemId, updateItem, worldHeight, setWorldHeight, wallStyle, setWallStyle, layoutConfig } = useEditorStore()

  const selectedItem = items.find(it => it.id === selectedItemId)

  if (!selectedItem) {
    const handleWorldHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value);
      if (!isNaN(value)) {
        setWorldHeight(value);
      }
    };

    // layoutConfig(시작/종료선) 갱신 헬퍼 — 시작/종료선은 layoutConfig 로 통합 관리한다.
    const lc = layoutConfig || {}
    const startLineY = lc.startLineY ?? (lc.startMarginPercent ? Math.round((worldHeight || 3300) * lc.startMarginPercent) : 70)
    const endMarginPct = Math.round(((lc.endMarginPercent ?? 0.02) * 100) * 10) / 10
    const setLayout = (patch: any) => useEditorStore.setState({ layoutConfig: { ...lc, ...patch } })

    return (
      <div className="absolute top-16 right-4 w-72 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl flex flex-col pointer-events-auto z-10 overflow-hidden">
        <div className="p-4 border-b border-[#333] bg-[#222]">
          <h2 className="font-bold text-white text-sm">스테이지 속성 (Stage)</h2>
          <p className="text-xs text-gray-500 mt-1">기물 미선택 시 맵 전체 설정</p>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">세로 길이 (World Height)</label>
            <input
              type="number" step={100} value={worldHeight}
              onChange={handleWorldHeightChange}
              className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[#00FFD0] uppercase tracking-wider">시작선 Y (Start Line)</label>
            <input
              type="number" step={10} value={startLineY}
              onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) setLayout({ startLineY: v, startMarginPercent: undefined }) }}
              className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-[#00FFD0] transition-colors font-mono"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider">종료 여백 % (End Margin)</label>
            <input
              type="number" step={0.5} value={endMarginPct}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setLayout({ endMarginPercent: v / 100 }) }}
              className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-fuchsia-500 transition-colors font-mono"
            />
            <p className="text-[10px] text-gray-600">종료선 Y ≈ {Math.round((worldHeight || 3300) * (1 - (lc.endMarginPercent ?? 0.02)))}</p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider">외벽 스타일 (Wall Style)</label>
            <select
              value={wallStyle}
              onChange={(e) => setWallStyle(e.target.value as any)}
              className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
            >
              <option value="straight">일자 (straight)</option>
              <option value="zigzag">지그재그 (zigzag)</option>
              <option value="narrow">좁게 (narrow 600px)</option>
              <option value="wide">넓게 (wide 900px)</option>
            </select>
          </div>

          <p className="text-gray-500 text-xs mt-2 text-center">기물을 선택하면 개별 속성이 표시됩니다.</p>
        </div>
      </div>
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof EditorItem) => {
    const value = parseFloat(e.target.value)
    if (!isNaN(value)) {
      updateItem(selectedItem.id, { [field]: value })
    }
  }

  const handleToggle = (field: keyof EditorItem) => {
    updateItem(selectedItem.id, { [field]: !selectedItem[field] })
  }

  const renderNumberField = (label: string, field: keyof EditorItem, step = 1) => {
    const val = selectedItem[field] as number | undefined
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
        <input
          type="number"
          step={step}
          value={val ?? 0}
          onChange={(e) => handleChange(e, field)}
          className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono"
        />
      </div>
    )
  }

  return (
    <div className="absolute top-16 right-4 w-72 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl flex flex-col pointer-events-auto max-h-[calc(100vh-5rem)] z-10 overflow-hidden">
      <div className="p-4 border-b border-[#333] bg-[#222]">
        <h2 className="font-bold text-white text-sm">Properties</h2>
        <p className="text-xs text-blue-400 mt-1 font-mono break-all">{selectedItem.id}</p>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-[#444] scrollbar-track-transparent">
        
        {/* Transform Group */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider border-b border-[#333] pb-1">변환 (Transform)</h3>
          <div className="grid grid-cols-2 gap-3">
            {renderNumberField('X좌표', 'x', 1)}
            {renderNumberField('Y좌표', 'y', 1)}
            {renderNumberField('너비(W)', 'w', 1)}
            {renderNumberField('높이(H)', 'h', 1)}
            {renderNumberField('각도', 'angle', 1)}
          </div>
        </div>

        {/* Physics / Dynamic Group */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider border-b border-[#333] pb-1">물리 / 동적 속성</h3>
          <div className="space-y-3">
            {renderNumberField('속도', 'speed', 0.1)}
            {renderNumberField('탄성력(Bounciness)', 'restitution', 0.1)}
            {renderNumberField('마찰력', 'friction', 0.1)}
            
            <div className="flex items-center justify-between bg-[#252525] border border-[#333] p-3 rounded-lg mt-2">
              <span className="text-sm font-semibold text-gray-300">좌우 반전 (Flip)</span>
              <button 
                onClick={() => handleToggle('flip')}
                className={`w-10 h-5 rounded-full relative transition-colors ${selectedItem.flip ? 'bg-blue-500' : 'bg-[#444]'}`}
              >
                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${selectedItem.flip ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Polygon Special Group */}
        {selectedItem.type === 'polygon' && (
          <div>
            <h3 className="text-xs font-bold text-fuchsia-400 mb-3 uppercase tracking-wider border-b border-[#333] pb-1">이미지 기반 자동 생성</h3>
            <div className="space-y-3">
              <input 
                type="file" 
                accept="image/*" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const { ImageTracer } = await import('@/lib/ImageTracer');
                    const vertices = await ImageTracer.traceImage(file, 5);
                    if (vertices && vertices.length > 2) {
                      updateItem(selectedItem.id, { vertices });
                    } else {
                      alert('윤곽선을 추출할 수 없습니다.');
                    }
                  } catch (err) {
                    console.error(err);
                    alert('이미지 처리 중 오류가 발생했습니다.');
                  }
                  e.target.value = '';
                }} 
                className="text-xs text-gray-400 w-full" 
              />
              <p className="text-[10px] text-gray-500 leading-tight">이미지를 업로드하면 윤곽선을 자동 추출하여 다각형을 변형합니다. (배경이 투명한 PNG 권장)</p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
