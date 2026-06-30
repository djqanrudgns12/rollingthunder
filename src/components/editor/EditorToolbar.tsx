'use client'

import React, { useState, useEffect } from 'react'
import { useEditorStore, WorkspaceTab } from '@/store/editorStore'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { Save, Undo, Redo, Magnet, Plus, Play, Pause, Loader2, Upload, X, History } from 'lucide-react'
import { MapPresets } from '@/engine/MapPresets'
import { saveMapAction, deployMapAction } from '@/presentation/actions/mapActions'
import { getUserRoleAction } from '@/presentation/actions/authActions'
import { logMapEditAction } from '@/presentation/actions/historyActions'
import UnsavedChangesModal from './UnsavedChangesModal'
import { toast } from 'sonner'

export default function EditorToolbar() {
  const { 
    undo, redo, items, historyIndex, history, gridSnap, setGridSnap, 
    mapId, setMapId, worldHeight, layoutConfig, wallStyle, bgImage, 
    previewAnimating, setPreviewAnimating,
    tabs, activeTabId, addTab, switchTab, closeTab, markSaved, reorderTabs
  } = useEditorStore()
  
  const mapDataCache = useGameStore(state => state.mapDataCache)
  const setGameStage = useUIStore(state => state.setGameStage)
  
  const [isSaving, setIsSaving] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  
  // Unsaved changes modal state
  const [closingTabId, setClosingTabId] = useState<string | null>(null)

  useEffect(() => {
    getUserRoleAction().then(({ role }) => setUserRole(role))
  }, [])

  const handleSave = async () => {
    if (!activeTabId) return;
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.type === 'history') return;

    setIsSaving(true)
    
    // mapId가 없으면 클라이언트 단에서 임시 생성 (저장 성공 시 Store에 반영)
    const targetMapId = mapId || crypto.randomUUID()
    
    // 기존 맵 데이터에서 불변 메타데이터 추출 (없으면 기본값)
    const gameStore = useGameStore.getState()
    const currentCache = gameStore.mapDataCache || { ...MapPresets }
    const existingMap = currentCache[targetMapId] || MapPresets[targetMapId]

    let finalMapName = activeTab.title.trim()
    if (finalMapName === '새 맵') finalMapName = '커스텀 맵'
    
    // 공식맵이 아닌 경우에만 [커스텀] 말머리 부착 (서버와 동일한 판별 로직)
    const isOfficial = existingMap?.isOfficial ?? (MapPresets[targetMapId] ? true : false)
    if (!isOfficial && !finalMapName.startsWith('[커스텀]')) {
      finalMapName = `[커스텀] ${finalMapName}`
    }

    try {
      const result = await saveMapAction({
        id: targetMapId,
        name: finalMapName,
        description: existingMap?.description,
        lengthType: existingMap?.lengthType,
        complexity: existingMap?.complexity,
        worldHeight,
        layoutConfig,
        wallStyle,
        bgImage: bgImage || existingMap?.bgImage,
        themeWeights: existingMap?.themeWeights,
        items
      })

      if (result.success) {
        // Update local mapDataCache
        const gameStore = useGameStore.getState()
        const currentCache = gameStore.mapDataCache || { ...MapPresets }
        gameStore.setMapDataCache({
          ...currentCache,
          [targetMapId]: {
            ...(existingMap || {}),
            name: finalMapName,
            worldHeight,
            layoutConfig,
            wallStyle,
            bgImage: bgImage || existingMap?.bgImage,
            items,
            isOfficial: existingMap?.isOfficial ?? false
          }
        })
        
        if (!mapId) setMapId(targetMapId) // 새 맵이었다면 Store에 확정
        markSaved(activeTabId, targetMapId, finalMapName)
        
        // SAVE_MAP 로깅 추가
        logMapEditAction(targetMapId, 'SAVE_MAP', { itemsCount: items.length });

        toast.success('맵이 성공적으로 저장되었습니다!')
      } else {
        toast.error(`저장 실패: ${result.error}`)
      }
    } catch (e: any) {
      toast.error(`오류 발생: ${e.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCloseTabClick = (e: React.MouseEvent, tab: WorkspaceTab) => {
    e.stopPropagation();
    if (tab.isUnsaved) {
      setClosingTabId(tab.id);
    } else {
      closeTab(tab.id);
    }
  }

  const handleCloseWithoutSaving = () => {
    if (closingTabId) {
      closeTab(closingTabId);
      setClosingTabId(null);
    }
  }

  const handleSaveAndClose = async () => {
    if (closingTabId) {
      // 닫으려는 탭이 활성 탭이 아니면 먼저 전환한 후 저장해야 함
      if (activeTabId !== closingTabId) {
        switchTab(closingTabId);
        // 전환 후 상태가 렌더링 사이클에 반영될 때까지 기다려야 하지만 간단히 꼼수 사용
        setTimeout(async () => {
          await handleSave();
          closeTab(closingTabId);
          setClosingTabId(null);
        }, 100);
      } else {
        await handleSave();
        closeTab(closingTabId);
        setClosingTabId(null);
      }
    }
  }

  // HTML5 Native Drag and Drop for Tabs
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
  }

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(sourceIndex) && sourceIndex !== targetIndex) {
      reorderTabs(sourceIndex, targetIndex);
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  const handleOpenHistory = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab || activeTab.type === 'history') return;
    
    const title = `[작업 내역] ${activeTab.title}`;
    addTab(activeTab.mapId, 'history', title);
  }

  return (
    <>
      <div className="absolute top-0 left-0 w-full h-14 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between z-20 shadow-md select-none">
        {/* 좌측: 작업 탭 영역 */}
        <div className="flex items-end h-full overflow-x-auto no-scrollbar flex-1 pt-2">
          {tabs.map((tab, index) => {
            const isActive = activeTabId === tab.id;
            const isHistory = tab.type === 'history';
            return (
              <div 
                key={tab.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragOver={handleDragOver}
                onClick={() => switchTab(tab.id)}
                className={`relative group flex items-center h-full min-w-[120px] max-w-[200px] px-4 cursor-pointer border-r border-[#333] border-t rounded-t-lg transition-colors ${
                  isActive 
                    ? 'bg-[#2a2a2a] text-white border-t-blue-500 border-x-[#333]' 
                    : 'bg-[#151515] text-gray-400 border-t-[#222] border-x-transparent hover:bg-[#1f1f1f]'
                }`}
              >
                {/* 탭 활성화 표시 줄 */}
                {isActive && <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500" />}
                
                {isHistory && <History className="w-3.5 h-3.5 mr-2 text-purple-400" />}
                
                <span className="truncate text-sm font-medium pr-6">
                  {tab.title} {tab.isUnsaved && <span className="text-orange-400 ml-1">*</span>}
                </span>
                
                {/* 닫기 버튼 (Hover 시 노출, Active 시 항상 노출) */}
                <button 
                  onClick={(e) => handleCloseTabClick(e, tab)}
                  className={`absolute right-2 p-1 rounded-full transition-opacity ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} hover:bg-[#444] text-gray-400 hover:text-white`}
                  title="탭 닫기"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
          
          <button 
            onClick={() => addTab(null, 'map')}
            className="flex items-center justify-center w-10 h-full hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors"
            title="새 맵 탭 열기"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* 우측: 도구 및 저장 */}
        <div className="flex items-center gap-2 px-4">
          <button 
            onClick={handleOpenHistory}
            className="flex items-center gap-1 bg-[#2a2a2a] hover:bg-[#333] text-sm text-gray-200 px-3 py-1.5 rounded border border-[#444] transition-colors shadow-sm mr-2"
            title="현재 맵의 작업 내역 보기"
          >
            <History className="w-4 h-4 text-purple-400" />
            <span>작업 내역</span>
          </button>

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
            <>
              {mapId && (mapDataCache || MapPresets)[mapId]?.isOfficial === false && (
                <button 
                  onClick={async () => {
                    if (!confirm('이 커스텀 맵을 기본맵으로 배포하시겠습니까?')) return;
                    const res = await deployMapAction(mapId);
                    if (res.success) {
                      const gameStore = useGameStore.getState();
                      const currentCache = gameStore.mapDataCache || { ...MapPresets };
                      gameStore.setMapDataCache({
                        ...currentCache,
                        [mapId]: { ...currentCache[mapId], isOfficial: true }
                      });
                      toast.success('서버 배포 완료! 이제 기본맵 탭에 표시됩니다.');
                    } else {
                      toast.error(`배포 실패: ${res.error}`);
                    }
                  }}
                  className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-1.5 rounded ml-2 transition-colors shadow-sm"
                  title="서버 배포"
                >
                  <Upload className="w-4 h-4" />
                  <span>서버 배포</span>
                </button>
              )}
              <button 
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-1.5 rounded ml-2 transition-colors shadow-sm"
                title="저장 (Ctrl+S)"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isSaving ? '저장중' : '저장'}</span>
              </button>
            </>
          )}

          <button 
            onClick={() => setGameStage('dashboard')}
            className="flex items-center gap-1 bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium px-4 py-1.5 rounded ml-2 transition-colors shadow-sm"
            title="대기화면으로 돌아가기"
          >
            로비 복귀
          </button>
        </div>
      </div>

      <UnsavedChangesModal 
        isOpen={!!closingTabId}
        tabTitle={tabs.find(t => t.id === closingTabId)?.title || ''}
        onClose={() => setClosingTabId(null)}
        onSaveAndClose={handleSaveAndClose}
        onCloseWithoutSaving={handleCloseWithoutSaving}
      />
    </>
  )
}
