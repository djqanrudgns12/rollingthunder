'use client'

import React, { useState, useEffect } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { Save, Undo, Redo, Magnet, Plus, Map as MapIcon, Play, Pause, Loader2 } from 'lucide-react'
import { MapPresets } from '@/engine/MapPresets'
import Link from 'next/link'
import { saveMapAction } from '@/presentation/actions/mapActions'
import { getUserRoleAction } from '@/presentation/actions/authActions'

export default function EditorToolbar() {
  const { undo, redo, items, historyIndex, history, gridSnap, setGridSnap, mapId, setMapId, worldHeight, layoutConfig, wallStyle, loadMapPreset, previewAnimating, setPreviewAnimating } = useEditorStore()
  const [mapName, setMapName] = useState('새 맵')
  const [isSaving, setIsSaving] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  useEffect(() => {
    getUserRoleAction().then(({ role }) => setUserRole(role))
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    
    // mapId가 없으면 클라이언트 단에서 임시 생성 (저장 성공 시 Store에 반영)
    const targetMapId = mapId || crypto.randomUUID()
    
    try {
      const result = await saveMapAction({
        id: targetMapId,
        name: mapName,
        worldHeight,
        layoutConfig,
        wallStyle,
        items
      })

      if (result.success) {
        if (!mapId) setMapId(targetMapId) // 새 맵이었다면 Store에 확정
        alert('맵이 성공적으로 저장되었습니다!')
      } else {
        alert(`저장 실패: ${result.error}`)
      }
    } catch (e: any) {
      alert(`오류 발생: ${e.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleNewMap = () => {
    // 시작/종료선은 layoutConfig 로 관리되므로 빈 맵 + 기본 레이아웃으로 초기화
    const st = useEditorStore.getState()
    st.setItems([])
    st.setWorldHeight(2400)
    st.setMapId(null) // 새 맵 생성 시 mapId 비움
    useEditorStore.setState({ layoutConfig: { startLineY: 100, endMarginPercent: 0.02, spawnGap: 50 } })
    setMapName('새 맵')
  }

  return (
    <div className="absolute top-0 left-0 w-full h-14 bg-[#1a1a1a] border-b border-[#333] flex items-center px-4 justify-between z-20 shadow-md">
      {/* 좌측: 맵 선택 및 추가 */}
      <div className="flex items-center gap-3">
        <MapIcon className="w-5 h-5 text-gray-400" />
        <select 
          value={mapId || ''} 
          onChange={(e) => {
            const newMapId = e.target.value;
            if (newMapId) {
              setMapName(MapPresets[newMapId]?.name || '새 맵');
              loadMapPreset(newMapId);
            }
          }}
          className="bg-[#2a2a2a] text-white text-sm rounded px-3 py-1.5 border border-[#444] focus:outline-none focus:border-blue-500"
        >
          <option value="" disabled>맵을 선택하세요</option>
          {Object.keys(MapPresets).map((key) => (
            <option key={key} value={key}>
              {MapPresets[key].name}
            </option>
          ))}
        </select>
        <button 
          onClick={handleNewMap}
          className="flex items-center gap-1 bg-[#2a2a2a] hover:bg-[#333] text-sm text-gray-200 px-3 py-1.5 rounded border border-[#444] transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>새 맵 추가</span>
        </button>
      </div>

      {/* 중앙: 맵 이름 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">맵 이름:</span>
        <input 
          type="text" 
          value={mapName}
          onChange={(e) => setMapName(e.target.value)}
          className="bg-transparent text-white text-base font-semibold border-b border-transparent focus:border-blue-500 focus:outline-none px-1 text-center w-40"
        />
      </div>

      {/* 우측: 도구 및 저장 */}
      <div className="flex items-center gap-2">
        <button 
          onClick={undo}
          disabled={historyIndex <= 0}
          className="p-1.5 rounded hover:bg-[#333] text-gray-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="실행 취소 (Ctrl+Z)"
        >
          <Undo className="w-5 h-5" />
        </button>
        <button 
          onClick={redo}
          disabled={historyIndex >= history.length - 1}
          className="p-1.5 rounded hover:bg-[#333] text-gray-400 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="다시 실행 (Ctrl+Y)"
        >
          <Redo className="w-5 h-5" />
        </button>
        
        <div className="w-px h-6 bg-[#444] mx-1"></div>
        
        <button
          onClick={() => setGridSnap(!gridSnap)}
          className={`p-1.5 rounded transition-colors ${gridSnap ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-[#333] text-gray-400'}`}
          title="자석 (Grid Snap 10px)"
        >
          <Magnet className="w-5 h-5" />
        </button>

        <button
          onClick={() => setPreviewAnimating(!previewAnimating)}
          className={`p-1.5 rounded transition-colors ${previewAnimating ? 'bg-[#00ffcc]/20 text-[#00ffcc]' : 'hover:bg-[#333] text-gray-400'}`}
          title={previewAnimating ? '기물 애니메이션 정지(정밀 편집)' : '기물 애니메이션 재생'}
        >
          {previewAnimating ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>

        {userRole === 'admin' && (
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded ml-2 transition-colors shadow-sm"
            title="저장 (Ctrl+S)"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{isSaving ? '저장중' : '저장'}</span>
          </button>
        )}

        <Link 
          href="/"
          className="flex items-center gap-1 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium px-4 py-1.5 rounded ml-2 transition-colors shadow-sm"
          title="대기화면으로 돌아가기"
        >
          로비 복귀
        </Link>
      </div>
    </div>
  )
}
