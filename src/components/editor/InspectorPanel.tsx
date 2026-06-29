'use client'

import React from 'react'
import { useEditorStore, EditorItem } from '@/store/editorStore'

export default function InspectorPanel() {
  const { items, selectedItemId, updateItem } = useEditorStore()

  const selectedItem = items.find(it => it.id === selectedItemId)

  if (!selectedItem) {
    return (
      <div className="absolute top-16 right-4 w-72 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl p-6 flex flex-col items-center justify-center pointer-events-auto h-32 z-10">
        <p className="text-gray-500 text-sm font-semibold">선택된 요소가 없습니다.</p>
        <p className="text-gray-600 text-xs mt-1">캔버스에서 항목을 선택하세요.</p>
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
          <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider border-b border-[#333] pb-1">Transform</h3>
          <div className="grid grid-cols-2 gap-3">
            {renderNumberField('X', 'x', 1)}
            {renderNumberField('Y', 'y', 1)}
            {renderNumberField('W', 'w', 1)}
            {renderNumberField('H', 'h', 1)}
            {renderNumberField('Angle', 'angle', 1)}
          </div>
        </div>

        {/* Physics / Dynamic Group */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider border-b border-[#333] pb-1">Physics / Dynamic</h3>
          <div className="space-y-3">
            {renderNumberField('Speed', 'speed', 0.1)}
            {renderNumberField('Bounciness', 'restitution', 0.1)}
            {renderNumberField('Friction', 'friction', 0.1)}
            
            <div className="flex items-center justify-between bg-[#252525] border border-[#333] p-3 rounded-lg mt-2">
              <span className="text-sm font-semibold text-gray-300">Flip (반전)</span>
              <button 
                onClick={() => handleToggle('flip')}
                className={`w-10 h-5 rounded-full relative transition-colors ${selectedItem.flip ? 'bg-blue-500' : 'bg-[#444]'}`}
              >
                <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${selectedItem.flip ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
