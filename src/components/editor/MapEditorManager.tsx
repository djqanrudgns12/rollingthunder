'use client'

import React, { useEffect } from 'react'
import EditorCanvas from './EditorCanvas'
import ToolboxPanel from './ToolboxPanel'
import InspectorPanel from './InspectorPanel'
import EditorToolbar from './EditorToolbar'
import MinimapOverlay from './MinimapOverlay'
import { useEditorStore } from '@/store/editorStore'

export default function MapEditorManager() {
  const mapId = useEditorStore(state => state.mapId)
  const loadMapPreset = useEditorStore(state => state.loadMapPreset)

  useEffect(() => {
    // 맵 에디터 첫 진입 시 mapId가 없으면 'NeonArcade' (네온 아케이드) 맵을 기본으로 로드
    if (!mapId) {
      loadMapPreset('NeonArcade')
    }
  }, [mapId, loadMapPreset])

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black text-white pt-14">
      {/* 0. 상단 툴바 */}
      <EditorToolbar />

      {/* 1. 순수 PIXI.js 에디터 캔버스 */}
      <EditorCanvas />

      {/* 2. 좌측 툴박스 패널 */}
      <ToolboxPanel />

      {/* 3. 우측 인스펙터 패널 */}
      <InspectorPanel />

      {/* 4. 미니맵 오버레이 */}
      <MinimapOverlay />
    </div>
  )
}
