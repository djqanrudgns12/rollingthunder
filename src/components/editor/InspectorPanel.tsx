'use client'

import React from 'react'
import { useEditorStore, EditorItem } from '@/store/editorStore'

export default function InspectorPanel() {
  const { isEditorMode, items, selectedItemId, updateItem } = useEditorStore()

  if (!isEditorMode) return null

  const selectedItem = items.find(it => it.id === selectedItemId)

  if (!selectedItem) {
    return (
      <div className="absolute top-20 right-6 w-72 bg-black/80 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl z-[100] p-6 flex items-center justify-center pointer-events-auto">
        <p className="text-white/50 text-sm font-bold">선택된 기물이 없습니다.</p>
      </div>
    )
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof EditorItem) => {
    const value = parseFloat(e.target.value)
    if (!isNaN(value)) {
      updateItem(selectedItem.id, { [field]: value })
    }
  }

  // 필드 렌더러
  const renderField = (label: string, field: keyof EditorItem, step = 1) => {
    const val = selectedItem[field]
    if (val === undefined) return null

    return (
      <div className="flex items-center justify-between gap-4">
        <label className="text-sm font-bold text-gray-300 w-16">{label}</label>
        <input
          type="number"
          step={step}
          value={val as number}
          onChange={(e) => handleChange(e, field)}
          className="flex-1 bg-black/50 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-purple-500"
        />
      </div>
    )
  }

  return (
    <div className="absolute top-20 right-6 w-72 bg-black/80 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl z-[100] flex flex-col pointer-events-auto">
      <div className="p-4 border-b border-white/10 bg-white/5 rounded-t-2xl">
        <h2 className="font-bold text-white tracking-widest text-lg">INSPECTOR</h2>
        <p className="text-xs text-white/50 mt-1">{selectedItem.type}</p>
      </div>
      
      <div className="p-4 flex flex-col gap-3 overflow-y-auto max-h-[70vh]">
        {renderField('X 좌표', 'x', 0.1)}
        {renderField('Y 좌표', 'y', 0.1)}
        
        {/* 선택적 속성들 */}
        {selectedItem.w !== undefined && renderField('너비 (W)', 'w', 0.1)}
        {selectedItem.h !== undefined && renderField('높이 (H)', 'h', 0.1)}
        {selectedItem.radius !== undefined && renderField('반경 (R)', 'radius', 0.1)}
        {selectedItem.rotation !== undefined && renderField('회전각', 'rotation', 0.1)}
        {selectedItem.restitution !== undefined && renderField('반발력', 'restitution', 0.05)}
        {selectedItem.friction !== undefined && renderField('마찰력', 'friction', 0.05)}
        
        {/* 특수 기믹 속성들 */}
        {selectedItem.power !== undefined && renderField('파워', 'power', 0.1)}
        {selectedItem.speed !== undefined && renderField('속도', 'speed', 0.1)}
        {selectedItem.force !== undefined && renderField('인력/척력', 'force', 0.1)}
        
        {selectedItem.hp !== undefined && renderField('현재 HP', 'hp')}
        {selectedItem.maxHp !== undefined && renderField('최대 HP', 'maxHp')}
        
        {selectedItem.windAngle !== undefined && renderField('바람 각도', 'windAngle')}
        {selectedItem.windForce !== undefined && renderField('바람 세기', 'windForce', 0.1)}
        
        {selectedItem.length !== undefined && renderField('길이', 'length', 0.1)}
        {selectedItem.restAngle !== undefined && renderField('대기 각도', 'restAngle', 0.1)}
        {selectedItem.swingAngle !== undefined && renderField('스윙 각도', 'swingAngle', 0.1)}

      </div>
    </div>
  )
}
