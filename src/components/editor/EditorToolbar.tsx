'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useEditorStore, WorkspaceTab } from '@/store/editorStore'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { Save, Undo, Redo, Magnet, Plus, Play, Pause, Loader2, Upload, X, History, ChevronDown, ChevronRight, Clock, Store } from 'lucide-react'
import { MapPresets, DEFAULT_THEME_WEIGHTS } from '@/engine/MapPresets'
import { saveMapAction, deployMapAction, getMapsAction } from '@/presentation/actions/mapActions'
import { saveUserMapAction, getMyUserMapsAction } from '@/presentation/actions/userMapActions'
import { UserMapEntity, USER_MAP_SLOT_LIMIT } from '@/core/entities/UserMap'
import { stampService } from '@/lib/stampService'
import { getUserRoleAction } from '@/presentation/actions/authActions'
import { logMapEditAction } from '@/presentation/actions/historyActions'
import { launchTestPlay } from '@/lib/editor/testPlay'
import UnsavedChangesModal from './UnsavedChangesModal'
import SaveMapModal, { SaveMapMeta, SaveTarget } from './SaveMapModal'
import PublishMapModal from './PublishMapModal'
import { toast } from 'sonner'

export default function EditorToolbar() {
  const {
    undo, redo, items, historyIndex, history, gridSnap, setGridSnap,
    mapId, setMapId, worldHeight, layoutConfig, wallStyle, bgImage,
    previewAnimating, setPreviewAnimating,
    tabs, activeTabId, addTab, switchTab, closeTab, markSaved, reorderTabs, updateTabTitle,
    showHistoryPanel, setShowHistoryPanel
  } = useEditorStore()

  const mapDataCache = useGameStore(state => state.mapDataCache)
  const setGameStage = useUIStore(state => state.setGameStage)

  const [isSaving, setIsSaving] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)

  // 내 커스텀 맵 (user_maps) — premium/admin 의 개인 맵 목록
  const [myMaps, setMyMaps] = useState<UserMapEntity[]>([])

  // Unsaved changes modal state
  const [closingTabId, setClosingTabId] = useState<string | null>(null)

  // 저장/배포 모달
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [pendingCloseTabId, setPendingCloseTabId] = useState<string | null>(null)

  // Dropdown menu & Title editing state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isOfficialExpanded, setIsOfficialExpanded] = useState(true);
  const [isMyMapsExpanded, setIsMyMapsExpanded] = useState(false);
  const [isCustomExpanded, setIsCustomExpanded] = useState(false);

  const isAdmin = userRole === 'admin'
  const canEdit = userRole === 'admin' || userRole === 'premium'
  const activeTab = tabs.find(t => t.id === activeTabId)
  // 현재 탭의 맵이 내 개인 맵(user_maps)이면 해당 엔트리
  const currentPersonalMap = mapId ? myMaps.find(m => m.id === mapId) : undefined

  const refreshMyMaps = useCallback(async () => {
    const res = await getMyUserMapsAction()
    if (res.success) setMyMaps(res.maps)
  }, [])

  useEffect(() => {
    getUserRoleAction().then(({ role }) => {
      setUserRole(role)
      if (role === 'admin' || role === 'premium') refreshMyMaps()
    })
  }, [refreshMyMaps])

  useEffect(() => {
    const handleOutsideClick = () => setShowAddMenu(false);
    if (showAddMenu) document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showAddMenu]);

  // ────────────────────────────────────────────────────────────
  // 저장 (SaveMapModal → doSave)
  // ────────────────────────────────────────────────────────────

  const buildInitialMeta = (): SaveMapMeta => {
    const title = (activeTab?.title || '새 맵').replace(/^\[사본\]\s*/, '')
    if (currentPersonalMap) {
      return {
        name: currentPersonalMap.name,
        description: currentPersonalMap.description,
        lengthType: currentPersonalMap.lengthType,
        complexity: currentPersonalMap.complexity,
      }
    }
    const existing = mapId ? (mapDataCache?.[mapId] || MapPresets[mapId]) : undefined
    return {
      name: title === '새 맵' ? '' : title,
      description: existing?.description || '',
      lengthType: (existing?.lengthType as SaveMapMeta['lengthType']) || 'Middle',
      complexity: (existing?.complexity as SaveMapMeta['complexity']) || 'Medium',
    }
  }

  const handleSaveClick = () => {
    if (!activeTabId) return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab || tab.type === 'history') return;
    setShowSaveModal(true)
  }

  /** 개인 커스텀 맵 저장 (premium 기본 경로, admin 은 선택 시) */
  const savePersonal = async (meta: SaveMapMeta): Promise<boolean> => {
    const result = await saveUserMapAction({
      id: currentPersonalMap?.id,
      name: meta.name,
      description: meta.description,
      lengthType: meta.lengthType,
      complexity: meta.complexity,
      worldHeight,
      wallStyle,
      bgImage: bgImage || undefined,
      themeWeights: currentPersonalMap?.themeWeights,
      layoutConfig,
      items,
    })

    if (!result.success) {
      toast.error(`저장 실패: ${result.error}`)
      return false
    }

    setMapId(result.mapId)
    markSaved(activeTabId || undefined, result.mapId, meta.name)
    await refreshMyMaps()
    toast.success('맵이 성공적으로 저장되었습니다!')
    stampService.trackEvent('save_map', 1);
    stampService.flushPlayEvents();
    return true
  }

  /** 공식 맵 카탈로그(maps) 저장 — admin 전용 기존 경로 */
  const saveOfficial = async (meta: SaveMapMeta): Promise<boolean> => {
    // mapId가 없으면 클라이언트 단에서 임시 생성 (저장 성공 시 Store에 반영)
    const targetMapId = mapId || crypto.randomUUID()

    const gameStore = useGameStore.getState()
    const currentCache = gameStore.mapDataCache || { ...MapPresets }
    const existingMap = currentCache[targetMapId] || MapPresets[targetMapId]

    let finalMapName = meta.name || '커스텀 맵'

    // 서버(SaveMapUseCase)와 동일 판별: 기본 프리셋 id 는 항상 공식맵.
    const isOfficial = MapPresets[targetMapId] ? true : (existingMap?.isOfficial ?? false)
    if (MapPresets[targetMapId]) {
      // 기본 프리셋: [커스텀] 말머리 금지 (오염 자동 제거)
      finalMapName = finalMapName.replace(/^\[커스텀\]\s*/, '')
    } else if (!finalMapName.startsWith('[커스텀]')) {
      finalMapName = `[커스텀] ${finalMapName}`
    }

    const result = await saveMapAction({
      id: targetMapId,
      name: finalMapName,
      description: meta.description || existingMap?.description,
      lengthType: meta.lengthType,
      complexity: meta.complexity,
      worldHeight,
      layoutConfig,
      wallStyle,
      bgImage: bgImage || existingMap?.bgImage,
      themeWeights: { ...DEFAULT_THEME_WEIGHTS, ...existingMap?.themeWeights } as Record<string, number>,
      items
    })

    if (!result.success) {
      toast.error(`저장 실패: ${result.error}`)
      return false
    }

    // Update local mapDataCache
    gameStore.setMapDataCache({
      ...currentCache,
      [targetMapId]: {
        ...(existingMap || {}),
        name: finalMapName,
        description: meta.description || existingMap?.description || '',
        lengthType: meta.lengthType,
        complexity: meta.complexity,
        worldHeight,
        layoutConfig,
        wallStyle,
        bgImage: bgImage || existingMap?.bgImage,
        themeWeights: existingMap?.themeWeights ?? DEFAULT_THEME_WEIGHTS,
        items,
        isOfficial   // 프리셋이면 true 유지 → 캐시 오염 방지
      }
    })

    if (!mapId) setMapId(targetMapId)
    markSaved(activeTabId || undefined, targetMapId, finalMapName)

    // SAVE_MAP 로깅 (전체 스냅샷 저장)
    logMapEditAction(targetMapId, 'SAVE_MAP', {
      itemsCount: items.length,
      snapshot: {
        items,
        worldHeight,
        layoutConfig,
        wallStyle,
        bgImage: bgImage || existingMap?.bgImage
      }
    });

    toast.success('맵이 성공적으로 저장되었습니다!')
    stampService.trackEvent('save_map', 1);
    stampService.flushPlayEvents();
    return true
  }

  const doSave = async (meta: SaveMapMeta, target: SaveTarget) => {
    setIsSaving(true)
    try {
      const ok = target === 'personal' ? await savePersonal(meta) : await saveOfficial(meta)
      if (ok) {
        setShowSaveModal(false)
        // '저장 후 닫기' 흐름이었다면 탭 닫기 마무리
        if (pendingCloseTabId) {
          closeTab(pendingCloseTabId)
          setPendingCloseTabId(null)
        }
      }
    } catch (e: any) {
      toast.error(`오류 발생: ${e.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // ────────────────────────────────────────────────────────────
  // 스토어 배포
  // ────────────────────────────────────────────────────────────

  const handlePublishClick = () => {
    if (!activeTab || activeTab.type === 'history') return
    // 저장 먼저 → 배포 (요구사항: 저장을 먼저 하고 배포하는 구조)
    if (!currentPersonalMap || activeTab.isUnsaved) {
      toast.info('배포하려면 먼저 내 커스텀 맵으로 저장해 주세요.')
      setShowSaveModal(true)
      return
    }
    setShowPublishModal(true)
  }

  // ────────────────────────────────────────────────────────────
  // 맵 로드 (기본맵 사본 / 내 맵)
  // ────────────────────────────────────────────────────────────

  /** 기본맵 로드: admin 은 원본 편집, premium 은 사본으로 로드 (원본 수정 불가) */
  const handleLoadPreset = (key: string) => {
    if (isAdmin) {
      useEditorStore.getState().loadMapPreset(key)
    } else {
      const preset = mapDataCache?.[key] || MapPresets[key]
      if (!preset) return
      useEditorStore.getState().loadMapFromData(
        null,
        {
          items: preset.items,
          worldHeight: preset.worldHeight,
          wallStyle: preset.wallStyle,
          bgImage: preset.bgImage,
          layoutConfig: preset.layoutConfig,
        },
        `[사본] ${preset.name}`
      )
    }
    setShowAddMenu(false)
  }

  const handleLoadMyMap = (map: UserMapEntity) => {
    useEditorStore.getState().loadMapFromData(
      map.id,
      {
        items: map.items,
        worldHeight: map.worldHeight,
        wallStyle: map.wallStyle,
        bgImage: map.bgImage,
        layoutConfig: map.layoutConfig,
      },
      map.name
    )
    setShowAddMenu(false)
  }

  // ────────────────────────────────────────────────────────────
  // 탭 닫기 / 드래그
  // ────────────────────────────────────────────────────────────

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

  const handleSaveAndClose = () => {
    if (!closingTabId) return;
    const targetId = closingTabId;
    setClosingTabId(null);
    setPendingCloseTabId(targetId);
    // 닫으려는 탭이 활성 탭이 아니면 먼저 전환한 후 저장 모달을 연다
    if (activeTabId !== targetId) {
      switchTab(targetId);
      setTimeout(() => setShowSaveModal(true), 100);
    } else {
      setShowSaveModal(true);
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


  return (
    <>
      <div className="absolute top-0 left-0 w-full h-14 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between z-[200] shadow-md select-none">
        {/* 좌측: 작업 탭 영역 */}
        <div className="flex items-end h-full overflow-x-auto no-scrollbar flex-1 pt-2">
          {tabs.map((tab, index) => {
            const isActive = activeTabId === tab.id;
            const isHistory = tab.type === 'history';
            return (
              <div
                key={tab.id}
                draggable={editingTabId !== tab.id}
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

                <span
                  className="truncate text-sm font-medium pr-6"
                  onDoubleClick={() => {
                    if (isActive && !isHistory) {
                      setEditingTabId(tab.id);
                      setEditingTitle(tab.title);
                    }
                  }}
                  title={isActive && !isHistory ? "더블클릭하여 맵 이름 변경" : ""}
                >
                  {editingTabId === tab.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => {
                        updateTabTitle(tab.id, editingTitle || '새 맵');
                        setEditingTabId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateTabTitle(tab.id, editingTitle || '새 맵');
                          setEditingTabId(null);
                        } else if (e.key === 'Escape') {
                          setEditingTabId(null);
                        }
                      }}
                      autoFocus
                      className="bg-[#111] text-white px-1 py-0.5 rounded outline-none border border-blue-500 w-full"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>{tab.title} {tab.isUnsaved && <span className="text-orange-400 ml-1">*</span>}</>
                  )}
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
          {/* 탭 매핑 종료 (스크롤 영역) */}
        </div>

        {/* 맵 추가 버튼 (스크롤 밖으로 분리하여 Clipping 버그 해결) */}
        <div className="relative h-full flex items-center border-l border-[#333]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAddMenu(!showAddMenu);
            }}
            className="flex items-center justify-center w-12 h-full bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-400 hover:text-white transition-colors"
            title="새 맵 / 불러오기"
          >
            <Plus className="w-5 h-5" />
          </button>

          {showAddMenu && (
            <div className="absolute top-14 left-0 mt-0 w-64 bg-[#222] border border-[#333] rounded-b-lg shadow-xl z-[250] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
              <button
                onClick={() => { addTab(null, 'map'); setShowAddMenu(false); }}
                className="w-full text-left px-4 py-3 hover:bg-[#333] text-white text-sm font-bold border-b border-[#333] flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4 text-blue-400" />
                새 커스텀 맵 추가하기
              </button>

              <div className="flex-1 overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-[#444]">
                {/* 기본맵 섹션 (아코디언) — premium 은 사본으로 로드 */}
                <button
                  onClick={() => setIsOfficialExpanded(!isOfficialExpanded)}
                  className="w-full flex items-center justify-between px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-xs font-bold text-gray-300 uppercase tracking-wider sticky top-0 z-10 transition-colors border-b border-[#333]"
                >
                  <span className="flex items-center gap-1">기본 맵 (Engine Presets){!isAdmin && <span className="text-gray-500 normal-case">· 사본 로드</span>}</span>
                  {isOfficialExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                {isOfficialExpanded && Object.entries(MapPresets).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => handleLoadPreset(key)}
                    className="w-full text-left px-8 py-2.5 hover:bg-[#333] text-gray-200 text-sm truncate block border-l-2 border-transparent hover:border-blue-500 transition-colors"
                  >
                    {preset.name}
                  </button>
                ))}

                {/* 내 맵 섹션 (user_maps 아코디언) — premium/admin */}
                {canEdit && (
                  <>
                    <button
                      onClick={() => setIsMyMapsExpanded(!isMyMapsExpanded)}
                      className="w-full flex items-center justify-between px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-xs font-bold text-emerald-300 uppercase tracking-wider sticky top-0 z-10 border-t border-b border-[#333] transition-colors"
                    >
                      <span className="flex items-center gap-1">
                        내 맵{!isAdmin && ` (${myMaps.length}/${USER_MAP_SLOT_LIMIT})`}
                      </span>
                      {isMyMapsExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    {isMyMapsExpanded && (
                      myMaps.length === 0 ? (
                        <div className="px-8 py-3 text-xs text-gray-500 italic">저장된 맵이 없습니다.</div>
                      ) : (
                        myMaps.map((map) => (
                          <button
                            key={map.id}
                            onClick={() => handleLoadMyMap(map)}
                            className="w-full text-left px-8 py-2.5 hover:bg-[#333] text-gray-200 text-sm truncate block border-l-2 border-transparent hover:border-emerald-500 transition-colors"
                          >
                            {map.name}
                            {map.isPublished && <span className="ml-1.5 text-[10px] text-emerald-400">배포됨</span>}
                          </button>
                        ))
                      )
                    )}
                  </>
                )}

                {/* 서버 커스텀맵 섹션 (maps 테이블, admin 전용) */}
                {isAdmin && (
                  <>
                    <button
                      onClick={() => setIsCustomExpanded(!isCustomExpanded)}
                      className="w-full flex items-center justify-between px-4 py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-xs font-bold text-gray-300 uppercase tracking-wider sticky top-0 z-10 border-t border-b border-[#333] transition-colors"
                    >
                      <span className="flex items-center gap-1">커스텀 맵 (서버)</span>
                      {isCustomExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                    {isCustomExpanded && (
                      Object.entries(mapDataCache || {}).filter(([k, m]) => !m.isOfficial && !MapPresets[k]).length === 0 ? (
                        <div className="px-8 py-3 text-xs text-gray-500 italic">저장된 맵이 없습니다.</div>
                      ) : (
                        Object.entries(mapDataCache || {})
                          .filter(([k, m]) => !m.isOfficial && !MapPresets[k])
                          .map(([key, map]) => (
                            <button
                              key={key}
                              onClick={() => { useEditorStore.getState().loadMapPreset(key); setShowAddMenu(false); }}
                              className="w-full text-left px-8 py-2.5 hover:bg-[#333] text-gray-200 text-sm truncate block border-l-2 border-transparent hover:border-purple-500 transition-colors"
                            >
                              {map.name}
                            </button>
                          ))
                      )
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 우측: 도구 및 저장 */}
        <div className="flex items-center gap-2 px-4">
          <button
            onClick={() => setShowHistoryPanel(!showHistoryPanel)}
            className={`flex items-center gap-1 text-sm px-3 py-1.5 rounded border transition-colors shadow-sm mr-2 ${
              showHistoryPanel
                ? 'bg-purple-500/20 text-purple-400 border-purple-500/50'
                : 'bg-[#2a2a2a] hover:bg-[#333] text-gray-200 border-[#444]'
            }`}
            title="작업 내역 타임라인 토글"
          >
            <Clock className="w-4 h-4 text-purple-400" />
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

          <div className="w-px h-6 bg-[#444] mx-1"></div>

          <button
            onClick={() => launchTestPlay()}
            className="flex items-center gap-1 bg-[#00ffcc]/15 hover:bg-[#00ffcc]/25 text-[#00ffcc] border border-[#00ffcc]/40 text-sm font-medium px-3 py-1.5 rounded transition-colors shadow-sm"
            title="현재 맵을 실제 레이스 환경으로 테스트 플레이 (결과 비기록)"
          >
            <Play className="w-4 h-4" />
            <span>테스트 플레이</span>
          </button>

          {isAdmin && mapId && (mapDataCache || MapPresets)[mapId]?.isOfficial === false && (
            <button
              onClick={async () => {
                if (!confirm('이 커스텀 맵을 기본맵으로 배포하시겠습니까?')) return;
                // 1) 최종 편집본을 먼저 영속화 — 여러 번 수정했더라도 마지막 상태가 배포되도록 보장.
                const meta = buildInitialMeta();
                const saved = await saveOfficial({ ...meta, name: meta.name || activeTab?.title || '커스텀 맵' });
                if (!saved) return;
                // 2) 공식 배포(is_official=true) 설정.
                const res = await deployMapAction(mapId);
                if (res.success) {
                  // 3) 서버 권위 상태로 캐시 동기화 → 실행 중 클라이언트가 배포 결과를 즉시·정확히 반영.
                  try {
                    const fresh = await getMapsAction();
                    useGameStore.getState().setMapDataCache(fresh);
                  } catch {
                    const gameStore = useGameStore.getState();
                    const currentCache = gameStore.mapDataCache || { ...MapPresets };
                    gameStore.setMapDataCache({
                      ...currentCache,
                      [mapId]: { ...currentCache[mapId], isOfficial: true }
                    });
                  }
                  toast.success('서버 배포 완료! 이제 기본맵 탭에 표시됩니다.');
                  // 미션 이벤트: 맵 배포
                  stampService.trackEvent('publish_map', 1);
                  stampService.flushPlayEvents();
                } else {
                  toast.error(`배포 실패: ${res.error}`);
                }
              }}
              className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white text-sm font-medium px-4 py-1.5 rounded ml-2 transition-colors shadow-sm"
              title="서버 배포 (공식맵 승격)"
            >
              <Upload className="w-4 h-4" />
              <span>서버 배포</span>
            </button>
          )}

          {canEdit && (
            <>
              {/* 스토어 배포: premium 은 항상 노출(미저장 시 저장 유도), admin 은 개인 맵 활성 시 노출 */}
              {(userRole === 'premium' || currentPersonalMap) && (
                <button
                  onClick={handlePublishClick}
                  className="flex items-center gap-1 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-white text-sm font-medium px-4 py-1.5 rounded ml-2 transition-colors shadow-sm"
                  title="커스텀 맵 스토어에 배포 (검증 통과 시 공개 · 다운로드당 100칩 지급)"
                >
                  <Store className="w-4 h-4" />
                  <span>{currentPersonalMap?.isPublished ? '업데이트 배포' : '배포'}</span>
                </button>
              )}
              <button
                onClick={handleSaveClick}
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

      <SaveMapModal
        isOpen={showSaveModal}
        onClose={() => { setShowSaveModal(false); setPendingCloseTabId(null); }}
        initialMeta={buildInitialMeta()}
        canChooseTarget={isAdmin}
        defaultTarget={isAdmin && !currentPersonalMap ? 'official' : 'personal'}
        slotUsed={!isAdmin && !currentPersonalMap ? myMaps.length : null}
        isPublished={!!currentPersonalMap?.isPublished}
        isSaving={isSaving}
        onSubmit={doSave}
      />

      {currentPersonalMap && (
        <PublishMapModal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          mapId={currentPersonalMap.id}
          mapName={currentPersonalMap.name}
          isRepublish={currentPersonalMap.isPublished}
          onPublished={refreshMyMaps}
        />
      )}
    </>
  )
}
