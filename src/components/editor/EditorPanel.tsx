'use client'

import React, { useState, useEffect } from 'react'
import { useEditorStore, EditorItem, EditorItemType } from '@/store/editorStore'
import { useUIStore } from '@/store/uiStore'
import { useGameStore } from '@/store/gameStore'
import { saveMapData } from '@/lib/supabase/mapFetcher'
import { Save, X, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import InspectorPanel from './InspectorPanel'

const ITEM_TYPES: { type: EditorItemType, label: string }[] = [
  { type: 'wall', label: '벽 (Wall)' },
  { type: 'pin', label: '핀 (Pin)' },
  { type: 'bumper', label: '범퍼 (Bumper)' },
  { type: 'booster', label: '부스터 (Booster)' },
  { type: 'windmill', label: '풍차 (Windmill)' },
  { type: 'piston', label: '피스톤 (Piston)' },
  { type: 'iceblock', label: '얼음블록 (IceBlock)' },
  { type: 'windcannon', label: '송풍기 (WindCannon)' },
  { type: 'luckygate', label: '럭키게이트 (LuckyGate)' },
  { type: 'flipper', label: '플리퍼 (Flipper)' }
]

export default function EditorPanel() {
  const { isEditorMode, setEditorMode, items, addItem, clearItems, mapId, setItems, selectedItemId, setSelectedItemId, removeItem } = useEditorStore()
  const { setGameStage } = useUIStore()
  const { mapDataCache, selectedMapPreset } = useGameStore()

  useEffect(() => {
    // 에디터 모드 진입 시, 현재 캐시된 맵 데이터(presetMeta.items)를 에디터 스토어에 복사
    if (isEditorMode && selectedMapPreset && selectedMapPreset !== 'random') {
      const presetMeta = mapDataCache[selectedMapPreset]
      if (presetMeta && presetMeta.items) {
        // 깊은 복사로 기존 객체 참조와 분리 (필요하다면)
        setItems(JSON.parse(JSON.stringify(presetMeta.items)))
      } else {
        setItems([])
      }
    }
  }, [isEditorMode, selectedMapPreset, mapDataCache, setItems])

  if (!isEditorMode) return null

  const handleClose = () => {
    setEditorMode(false)
    setGameStage('dashboard')
  }

  const handleSave = async () => {
    if (!selectedMapPreset || selectedMapPreset === 'random') {
      toast.error('저장할 맵이 명확하지 않습니다.')
      return
    }
    const presetMeta = mapDataCache[selectedMapPreset]
    if (!presetMeta) return

    const newMeta = { ...presetMeta, items }
    const success = await saveMapData(selectedMapPreset, newMeta)
    if (success) {
      toast.success('맵 데이터가 성공적으로 저장되었습니다.')
      // Update local cache
      useGameStore.getState().setMapDataCache({
        ...mapDataCache,
        [selectedMapPreset]: newMeta
      })
    } else {
      toast.error('맵 데이터 저장에 실패했습니다.')
    }
  }

  const handleAddItem = (type: EditorItemType) => {
    // 화면 중앙 즈음에 생성
    const newItem: EditorItem = {
      id: `${type}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      type,
      x: 400,
      y: 400
    }
    // 타입별 기본 속성 추가
    if (type === 'wall' || type === 'piston') { newItem.w = 100; newItem.h = 20; }
    if (type === 'iceblock') { newItem.w = 60; newItem.h = 25; newItem.hp = 3; newItem.maxHp = 3; }
    if (type === 'windcannon') { newItem.w = 120; newItem.h = 120; newItem.windAngle = 90; newItem.windForce = 15; }
    if (type === 'luckygate') { newItem.w = 140; }
    if (type === 'flipper') { newItem.length = 90; newItem.side = 'left'; newItem.restAngle = 30; newItem.swingAngle = -30; }

    addItem(newItem)
    setSelectedItemId(newItem.id)
  }

  const handleDeleteItem = () => {
    if (selectedItemId) {
      removeItem(selectedItemId)
    }
  }

  return (
    <>
      {/* Toolbox Panel */}
      <div className="absolute top-20 left-6 w-64 bg-black/80 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl z-[100] flex flex-col pointer-events-auto">
        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-2xl">
          <h2 className="font-bold text-white tracking-widest text-lg">TOOLBOX</h2>
          <button onClick={handleClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5 text-white/70 hover:text-white" />
          </button>
        </div>
        
        <div className="p-4 flex-1 overflow-y-auto max-h-[60vh] flex flex-col gap-2 scrollbar-hide">
          <div className="text-xs text-white/50 font-bold mb-1">기물 추가</div>
          {ITEM_TYPES.map(it => (
            <button
              key={it.type}
              onClick={() => handleAddItem(it.type)}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors text-sm font-bold text-gray-200 hover:text-white"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
              {it.label}
            </button>
          ))}
          
          <hr className="border-white/10 my-2" />
          
          <button
            onClick={handleDeleteItem}
            disabled={!selectedItemId}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-xl transition-colors text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30"
          >
            <Trash2 className="w-4 h-4" />
            선택된 아이템 삭제
          </button>
          
          <button
            onClick={clearItems}
            className="flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-sm font-bold text-gray-400 border border-white/10 mt-1"
          >
            전체 지우기
          </button>
        </div>

        <div className="p-4 border-t border-white/10 bg-white/5 rounded-b-2xl">
          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl shadow-lg transition-all shadow-purple-900/50 hover:shadow-purple-500/50"
          >
            <Save className="w-5 h-5" />
            변경사항 저장
          </button>
        </div>
      </div>

      {/* Inspector Panel */}
      <InspectorPanel />
    </>
  )
}
