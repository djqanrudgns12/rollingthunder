'use client'

import React, { useEffect } from 'react'
import EditorCanvas from './EditorCanvas'
import ToolboxPanel from './ToolboxPanel'
import InspectorPanel from './InspectorPanel'
import EditorToolbar from './EditorToolbar'
import MinimapOverlay from './MinimapOverlay'
import AlignToolbar from './AlignToolbar'
import ValidationPanel from './ValidationPanel'
import HistoryTimelinePanel from './HistoryTimelinePanel'
import { useEditorStore } from '@/store/editorStore'

export default function MapEditorManager() {
  const mapId = useEditorStore(state => state.mapId)
  const tabs = useEditorStore(state => state.tabs)
  const activeTabId = useEditorStore(state => state.activeTabId)
  const activeTab = tabs.find(t => t.id === activeTabId)
  const showHistoryPanel = useEditorStore(state => state.showHistoryPanel)
  const setShowHistoryPanel = useEditorStore(state => state.setShowHistoryPanel)
  const loadMapPreset = useEditorStore(state => state.loadMapPreset)
  const hasLoadedInitial = React.useRef(false);

  useEffect(() => {
    // 테스트 플레이 복귀 등으로 재마운트될 때 미저장 작업물을 프리셋으로 덮어쓰지 않도록
    // items 가 비어 있을 때만 초기 프리셋을 로드한다.
    if (!mapId && !hasLoadedInitial.current && useEditorStore.getState().items.length === 0) {
      loadMapPreset('neon_arcade')
    }
    hasLoadedInitial.current = true;
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

      {/* 5. 정렬/미러/배열 도구 (다중 선택 시) */}
      <AlignToolbar />

      {/* 5b. 맵 검증 + 히트맵 패널 */}
      <ValidationPanel />

      {/* 6. 작업 내역 타임라인 패널 */}
      {showHistoryPanel && (
        <HistoryTimelinePanel 
          mapId={activeTab?.mapId || null}
          mapTitle={activeTab?.title || ''}
          onClose={() => setShowHistoryPanel(false)}
        />
      )}
    </div>
  )
}
