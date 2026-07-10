import { create } from 'zustand'
import { useGameStore } from './gameStore'
import type { Viewport } from 'pixi-viewport'
import type { MapPresetMeta } from '@/engine/MapPresets'

// 레이아웃 설정 (MapPresets.layoutConfig 와 동일 형태 — 에디터에서는 전 필드 선택적)
export interface EditorLayoutConfig {
  startLineY?: number;
  startMarginPercent?: number;
  endMarginPercent?: number;
  spawnGap?: number;
}

// 하이엔드 기믹 타입 추가
export type EditorItemType = 'pin' | 'bumper' | 'wall' | 'hole' | 'portal' | 'booster' | 'windmill' | 'piston' | 'blackhole' | 'whitehole' | 'spinner' | 'iceblock' | 'windcannon' | 'luckygate' | 'speedgate' | 'slowgate' | 'flipper' | 'startline' | 'endline' | 'polygon';

// 외벽 스타일 (MapPresets.WallStyle 과 동일 — 순환 import 회피 위해 로컬 정의)
export type EditorWallStyle = 'straight' | 'zigzag' | 'narrow' | 'wide' | 'funnel' | 'hourglass' | 'diamond' | 'wave' | 'sawtooth' | 'asymmetric';

export interface EditorItem {
  id: string;
  type: EditorItemType;
  variant?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  radius?: number;
  restitution?: number;
  friction?: number;
  angle?: number;         // 통합된 각도 속성
  rotation?: number;      // 기존 호환성 유지용
  flip?: boolean;         // 좌우/상하 반전
  vertices?: { x: number; y: number }[]; // 자유형 다각형(Polygon)의 정점 데이터
  // --- 하이엔드 기믹 전용 속성들 ---
  power?: number;         // 가속 강도 (Booster 전용: 1~5 등)
  speed?: number;         // 이동/회전 속도 (Windmill, Piston 전용)
  force?: number;         // 인력/척력 (Blackhole, Whitehole 전용)
  color?: string;         // 포탈 색상 짝맞춤용 (Portal 전용)
  waypointB?: { x: number, y: number }; // 피스톤 도착점 (Piston 전용)
  soundTag?: string;      // 특정 장애물 전용 오디오 태그 (예: 'funnel')
  hp?: number;            // 얼음블록 파괴 가능 횟수
  maxHp?: number;
  windAngle?: number;     // 송풍기 바람 방향 (degree)
  windForce?: number;     // 송풍기 바람 세기
  onFrames?: number;      // 주기적인 활성화 (프레임)
  offFrames?: number;
  length?: number;        // 플리퍼 길이
  restAngle?: number;     // 플리퍼 대기 각도
  swingAngle?: number;    // 플리퍼 스윙 각도
  swingSpeed?: number;    // 플리퍼 스윙 속도
  returnSpeed?: number;   // 플리퍼 복귀 속도
  side?: string;          // 플리퍼 방향 ('left' | 'right')
}

export type TabType = 'map' | 'history';

export interface WorkspaceTab {
  id: string;
  type: TabType;
  mapId: string | null;
  title: string;
  isUnsaved: boolean;
  stateSnapshot?: {
    items: EditorItem[];
    history: EditorItem[][];
    historyIndex: number;
    bgImage: string | null;
    worldHeight: number;
    layoutConfig: EditorLayoutConfig;
    wallStyle: EditorWallStyle;
  };
}

interface EditorState {
  // Tabs State
  tabs: WorkspaceTab[];
  activeTabId: string | null;

  addTab: (mapId: string | null, type: TabType, customTitle?: string) => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  reorderTabs: (startIndex: number, endIndex: number) => void;
  markUnsaved: () => void;
  markSaved: (tabId?: string, newMapId?: string, newTitle?: string) => void;
  updateTabTitle: (tabId: string, title: string) => void;

  // Current Active Map State
  items: EditorItem[];
  history: EditorItem[][];
  historyIndex: number;
  selectedItemId: string | null;
  isEditorMode: boolean;
  mapId: string | null;
  bgImage: string | null;
  worldHeight: number;
  layoutConfig: EditorLayoutConfig;
  wallStyle: EditorWallStyle;       // 외벽 스타일 (배경 너비/외벽 가이드에 사용)
  previewAnimating: boolean;        // 에디터 캔버스 기물 애니메이션 ON/OFF
  previewChipCount: number;         // 스폰 프리뷰/검증/테스트 플레이 공유 칩 수

  addItem: (item: EditorItem) => void;
  updateItem: (id: string, updates: Partial<EditorItem>) => void;
  updateItemSilent: (id: string, updates: Partial<EditorItem>) => void; // 히스토리 미기록(드래그/리사이즈 중)
  commitHistory: () => void;                                            // 현재 items 를 히스토리에 1회 커밋
  removeItem: (id: string) => void;
  clearItems: () => void;
  setItems: (items: EditorItem[]) => void;
  
  setSelectedItemId: (id: string | null) => void;
  // --- 다중 선택 / 정렬 / 미러 (Phase 3) ---
  selectedItemIds: string[];
  setSelectedItemIds: (ids: string[]) => void;
  toggleSelectedItem: (id: string) => void;
  moveSelectedBy: (dx: number, dy: number, commit?: boolean) => void;
  alignSelected: (edge: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => void;
  distributeSelected: (axis: 'h' | 'v') => void;
  mirrorSelected: (duplicate: boolean) => void;
  arraySelected: (count: number, gapX: number, gapY: number) => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  setEditorMode: (isEditor: boolean) => void;
  setMapId: (id: string | null) => void;
  setBgImage: (url: string | null) => void;
  setWorldHeight: (height: number) => void;
  setWallStyle: (style: EditorWallStyle) => void;
  setPreviewAnimating: (on: boolean) => void;
  setPreviewChipCount: (count: number) => void;
  loadMapPreset: (mapId: string) => void;
  loadMapFromData: (
    mapId: string | null,
    data: { items?: EditorItem[]; worldHeight?: number; wallStyle?: string; bgImage?: string | null; layoutConfig?: EditorLayoutConfig },
    title: string
  ) => void;
  
  clipboard: EditorItem | null;
  setClipboard: (item: EditorItem | null) => void;
  
  gridSnap: boolean;
  setGridSnap: (snap: boolean) => void;
  
  undo: () => void;
  redo: () => void;
  pushHistory: (newItems: EditorItem[]) => void;
  
  showHistoryPanel: boolean;
  setShowHistoryPanel: (show: boolean) => void;
  
  // 플로팅 패널 Z-Index 전역 관리 (패널 ID 배열 - 끝에 있을수록 맨 위)
  panelOrder: string[];
  bringToFront: (panelId: string) => void;

  editorViewport: Viewport | null;
  setEditorViewport: (viewport: Viewport | null) => void;
}

// 스냅샷 생성 유틸리티
const createSnapshot = (state: EditorState): NonNullable<WorkspaceTab['stateSnapshot']> => ({
  items: state.items,
  history: state.history,
  historyIndex: state.historyIndex,
  bgImage: state.bgImage,
  worldHeight: state.worldHeight,
  layoutConfig: state.layoutConfig,
  wallStyle: state.wallStyle
});

// 초기 상태값
const defaultMapState = {
  items: [],
  history: [[]],
  historyIndex: 0,
  bgImage: null,
  worldHeight: 3300,
  layoutConfig: { startLineY: 100, endMarginPercent: 0.02, spawnGap: 50 },
  wallStyle: 'straight' as EditorWallStyle,
  selectedItemId: null
};

export const useEditorStore = create<EditorState>((set, get) => ({
  // 탭 관련 초기 상태: 기본적으로 새 맵 탭 하나를 띄움
  tabs: [{
    id: 'tab-initial',
    type: 'map',
    mapId: null,
    title: '새 맵',
    isUnsaved: false
  }],
  activeTabId: 'tab-initial',

  showHistoryPanel: false,
  setShowHistoryPanel: (show) => set({ showHistoryPanel: show }),

  panelOrder: ['inspector', 'toolbox', 'history', 'minimap'],
  bringToFront: (panelId) => set((state) => {
    const newOrder = state.panelOrder.filter(id => id !== panelId);
    newOrder.push(panelId);
    return { panelOrder: newOrder };
  }),

  editorViewport: null,
  setEditorViewport: (viewport) => set({ editorViewport: viewport }),

  addTab: (mapId, type, customTitle) => set((state) => {
    // 이미 열려있는 맵 탭인지 확인
    if (type === 'map' && mapId) {
      const existingTab = state.tabs.find(t => t.type === 'map' && t.mapId === mapId);
      if (existingTab) {
        // Zustand set 내부에서는 다른 액션을 바로 호출하기 까다로우므로 setTimeout을 쓰거나 로직 복사
        setTimeout(() => get().switchTab(existingTab.id), 0);
        return {}; 
      }
    }

    const newTabId = `tab-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    
    let title = customTitle || '새 맵';
    if (!customTitle && mapId && type === 'map') {
      const source = useGameStore.getState().mapDataCache;
      if (source && source[mapId]) title = source[mapId].name;
    }

    const newTab: WorkspaceTab = {
      id: newTabId,
      type,
      mapId,
      title,
      isUnsaved: false,
      stateSnapshot: type === 'history' ? undefined : { ...defaultMapState }
    };

    // 현재 탭의 상태를 스냅샷으로 저장
    const currentTabId = state.activeTabId;
    const updatedTabs = [...state.tabs];
    if (currentTabId) {
      const currentTabIndex = updatedTabs.findIndex(t => t.id === currentTabId);
      if (currentTabIndex !== -1 && updatedTabs[currentTabIndex].type === 'map') {
        updatedTabs[currentTabIndex] = {
          ...updatedTabs[currentTabIndex],
          stateSnapshot: createSnapshot(state)
        };
      }
    }

    updatedTabs.push(newTab);
    
    // 만약 히스토리 탭이면 맵 상태를 덮어쓰지 않고 탭만 전환
    if (type === 'history') {
      return { tabs: updatedTabs, activeTabId: newTabId };
    }
    
    // 새 맵 탭이면 빈 맵 상태로 루트 상태 초기화
    return {
      tabs: updatedTabs,
      activeTabId: newTabId,
      mapId,
      ...defaultMapState
    };
  }),

  switchTab: (tabId) => set((state) => {
    if (state.activeTabId === tabId) return state;

    const currentTabIndex = state.tabs.findIndex(t => t.id === state.activeTabId);
    const targetTabIndex = state.tabs.findIndex(t => t.id === tabId);
    
    if (targetTabIndex === -1) return state;

    const updatedTabs = [...state.tabs];
    
    // 현재 탭 스냅샷 저장
    if (currentTabIndex !== -1 && state.tabs[currentTabIndex].type === 'map') {
      updatedTabs[currentTabIndex] = {
        ...updatedTabs[currentTabIndex],
        stateSnapshot: createSnapshot(state)
      };
    }

    const targetTab = updatedTabs[targetTabIndex];

    // 목표 탭이 맵이면 루트 상태 복원
    if (targetTab.type === 'map' && targetTab.stateSnapshot) {
      return {
        tabs: updatedTabs,
        activeTabId: tabId,
        mapId: targetTab.mapId,
        ...targetTab.stateSnapshot,
        selectedItemId: null // 탭 전환 시 선택 해제
      };
    }

    // 히스토리 등 맵이 아닌 탭으로 전환 시, 맵 관련 상태는 그대로 둠
    return {
      tabs: updatedTabs,
      activeTabId: tabId
    };
  }),

  closeTab: (tabId) => set((state) => {
    const targetIndex = state.tabs.findIndex(t => t.id === tabId);
    if (targetIndex === -1) return state;
    
    const newTabs = state.tabs.filter(t => t.id !== tabId);
    
    if (newTabs.length === 0) {
      // 마지막 탭을 닫으면 새 맵 탭을 열어줌
      const fallbackTabId = `tab-${Date.now()}`;
      newTabs.push({
        id: fallbackTabId,
        type: 'map',
        mapId: null,
        title: '새 맵',
        isUnsaved: false,
        stateSnapshot: { ...defaultMapState }
      });
      return {
        tabs: newTabs,
        activeTabId: fallbackTabId,
        mapId: null,
        ...defaultMapState
      };
    }
    
    if (state.activeTabId === tabId) {
      // 현재 열려있는 탭을 닫은 경우 근처 탭으로 전환
      const nextActiveIndex = Math.max(0, targetIndex - 1);
      const nextActiveTab = newTabs[nextActiveIndex];
      
      if (nextActiveTab.type === 'map' && nextActiveTab.stateSnapshot) {
        return {
          tabs: newTabs,
          activeTabId: nextActiveTab.id,
          mapId: nextActiveTab.mapId,
          ...nextActiveTab.stateSnapshot,
          selectedItemId: null
        };
      } else {
        return {
          tabs: newTabs,
          activeTabId: nextActiveTab.id
        };
      }
    }
    
    return { tabs: newTabs };
  }),

  reorderTabs: (startIndex, endIndex) => set((state) => {
    const result = Array.from(state.tabs);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    return { tabs: result };
  }),

  markUnsaved: () => set((state) => {
    if (!state.activeTabId) return state;
    const currentTab = state.tabs.find(t => t.id === state.activeTabId);
    if (currentTab && !currentTab.isUnsaved) {
      return {
        tabs: state.tabs.map(t => 
          t.id === state.activeTabId ? { ...t, isUnsaved: true } : t
        )
      };
    }
    return state;
  }),

  markSaved: (tabId, newMapId, newTitle) => set((state) => {
    const targetTabId = tabId || state.activeTabId;
    if (!targetTabId) return state;
    return {
      tabs: state.tabs.map(t => 
        t.id === targetTabId 
          ? { 
              ...t, 
              isUnsaved: false, 
              ...(newMapId !== undefined ? { mapId: newMapId } : {}),
              ...(newTitle !== undefined ? { title: newTitle } : {})
            } 
          : t
      )
    };
  }),

  updateTabTitle: (tabId, title) => set((state) => {
    return {
      tabs: state.tabs.map(t => t.id === tabId ? { ...t, title } : t)
    };
  }),

  // ============================================
  // Current Active Map State
  // ============================================
  items: defaultMapState.items,
  history: defaultMapState.history,
  historyIndex: defaultMapState.historyIndex,
  selectedItemId: defaultMapState.selectedItemId,
  isEditorMode: false,
  mapId: null,
  bgImage: defaultMapState.bgImage,
  worldHeight: defaultMapState.worldHeight,
  layoutConfig: defaultMapState.layoutConfig,
  wallStyle: defaultMapState.wallStyle,
  previewAnimating: true,
  previewChipCount: 10,
  clipboard: null,
  gridSnap: false,
  selectedItemIds: [],

  setClipboard: (item) => set({ clipboard: item }),
  setGridSnap: (snap) => set({ gridSnap: snap }),
  setBgImage: (url) => { set({ bgImage: url }); get().markUnsaved(); },
  setWorldHeight: (height) => { set({ worldHeight: height }); get().markUnsaved(); },
  setWallStyle: (style) => { set({ wallStyle: style }); get().markUnsaved(); },
  setPreviewAnimating: (on) => set({ previewAnimating: on }),
  setPreviewChipCount: (count) => set({ previewChipCount: Math.max(2, Math.min(20, Math.floor(count) || 2)) }),

  loadMapPreset: (mapId) => {
    const state = get();
    // 탭 추가(이미 있으면 해당 탭으로 전환)
    state.addTab(mapId, 'map');

    // addTab에서 스냅샷 초기화를 하지만, 최초 로딩 시엔 실제 데이터를 채워야 함
    setTimeout(() => {
      const applyPreset = (preset: MapPresetMeta | undefined) => {
        if (preset) {
          useEditorStore.setState({
            mapId,
            bgImage: preset.bgImage || null,
            worldHeight: preset.worldHeight || 3300,
            layoutConfig: preset.layoutConfig || defaultMapState.layoutConfig,
            wallStyle: (preset.wallStyle as EditorWallStyle) || 'straight',
            items: preset.items ? [...preset.items] : [],
            history: preset.items ? [[...preset.items]] : [[]],
            historyIndex: 0
          });
          get().markSaved(get().activeTabId || undefined, mapId, preset.name);
        }
      };

      const mapDataCache = useGameStore.getState().mapDataCache;
      if (mapDataCache && mapDataCache[mapId]) {
        applyPreset(mapDataCache[mapId]);
      } else {
        import('@/engine/MapPresets').then(({ MapPresets }) => {
          applyPreset(MapPresets[mapId]);
        });
      }
    }, 0);
  },

  // mapDataCache 를 거치지 않고 맵 데이터를 직접 주입 (개인 맵 user_maps / 기본맵 사본 로드용).
  // mapId=null 이면 "사본" — 저장 시 새 맵으로 생성되도록 미저장 상태로 연다.
  loadMapFromData: (mapId, data, title) => {
    const state = get();
    state.addTab(mapId, 'map', title);

    setTimeout(() => {
      useEditorStore.setState({
        mapId,
        bgImage: data.bgImage || null,
        worldHeight: data.worldHeight || 3300,
        layoutConfig: data.layoutConfig || defaultMapState.layoutConfig,
        wallStyle: (data.wallStyle as EditorWallStyle) || 'straight',
        items: data.items ? [...data.items] : [],
        history: data.items ? [[...data.items]] : [[]],
        historyIndex: 0
      });
      if (mapId) {
        get().markSaved(get().activeTabId || undefined, mapId, title);
      } else {
        get().markUnsaved();
      }
    }, 0);
  },

  pushHistory: (newItems) => set((state) => {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newItems);
    if (newHistory.length > 50) newHistory.shift();
    get().markUnsaved();
    return { history: newHistory, historyIndex: newHistory.length - 1, items: newItems };
  }),

  addItem: (item) => set((state) => {
    const newItems = [...state.items, item];
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newItems);
    if (newHistory.length > 50) newHistory.shift();
    get().markUnsaved();
    
    if (state.mapId) {
      import('@/presentation/actions/historyActions').then(({ logMapEditAction }) => {
        logMapEditAction(state.mapId!, 'ADD_ITEM', { type: item.type, x: item.x, y: item.y });
      });
    }

    return { items: newItems, history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  updateItem: (id, updates) => set((state) => {
    const newItems = state.items.map((it) => (it.id === id ? { ...it, ...updates } : it));
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newItems);
    if (newHistory.length > 50) newHistory.shift();
    get().markUnsaved();
    
    if (state.mapId) {
      import('@/presentation/actions/historyActions').then(({ logMapEditAction }) => {
        logMapEditAction(state.mapId!, 'UPDATE_ITEM', { id, updates });
      });
    }

    return { items: newItems, history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  // 드래그/리사이즈 중에는 히스토리를 남기지 않고 items 만 갱신 (히스토리 스팸 방지)
  updateItemSilent: (id, updates) => set((state) => {
    get().markUnsaved();
    return {
      items: state.items.map((it) => (it.id === id ? { ...it, ...updates } : it)),
    };
  }),

  // 드래그/리사이즈 종료 시 1회 호출하여 현재 상태를 히스토리에 커밋
  commitHistory: () => set((state) => {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(state.items);
    if (newHistory.length > 50) newHistory.shift();
    
    if (state.mapId && state.selectedItemId) {
      const updatedItem = state.items.find(i => i.id === state.selectedItemId);
      if (updatedItem) {
        import('@/presentation/actions/historyActions').then(({ logMapEditAction }) => {
          logMapEditAction(state.mapId!, 'MOVE_ITEM', { id: updatedItem.id, x: updatedItem.x, y: updatedItem.y });
        });
      }
    }

    return { history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  removeItem: (id) => set((state) => {
    const newItems = state.items.filter((it) => it.id !== id);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newItems);
    if (newHistory.length > 50) newHistory.shift();
    get().markUnsaved();
    
    if (state.mapId) {
      import('@/presentation/actions/historyActions').then(({ logMapEditAction }) => {
        logMapEditAction(state.mapId!, 'REMOVE_ITEM', { id });
      });
    }

    return {
      items: newItems,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      selectedItemId: state.selectedItemId === id ? null : state.selectedItemId
    };
  }),

  clearItems: () => set((state) => {
    const newItems: EditorItem[] = [];
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newItems);
    if (newHistory.length > 50) newHistory.shift();
    get().markUnsaved();
    return { items: newItems, history: newHistory, historyIndex: newHistory.length - 1, selectedItemId: null };
  }),

  setItems: (items) => set((state) => {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(items);
    if (newHistory.length > 50) newHistory.shift();
    get().markUnsaved();
    return { items, history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  setSelectedItemId: (id) => set({ selectedItemId: id, selectedItemIds: id ? [id] : [] }),
  setSelectedItemIds: (ids) => set({ selectedItemIds: ids, selectedItemId: ids.length ? ids[ids.length - 1] : null }),
  toggleSelectedItem: (id) => set((state) => {
    const has = state.selectedItemIds.includes(id);
    const ids = has ? state.selectedItemIds.filter((i) => i !== id) : [...state.selectedItemIds, id];
    return { selectedItemIds: ids, selectedItemId: ids.length ? ids[ids.length - 1] : null };
  }),

  // 선택된 모든 기물을 이동 (commit=false 면 히스토리 미기록 — 드래그 중)
  moveSelectedBy: (dx, dy, commit = true) => set((state) => {
    const sel = new Set(state.selectedItemIds.length ? state.selectedItemIds : (state.selectedItemId ? [state.selectedItemId] : []));
    if (!sel.size) return state;
    const items = state.items.map((it) => sel.has(it.id) ? {
      ...it, x: it.x + dx, y: it.y + dy,
      waypointB: it.waypointB ? { x: it.waypointB.x + dx, y: it.waypointB.y + dy } : it.waypointB,
    } : it);
    if (!commit) return { items };
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(items);
    if (newHistory.length > 50) newHistory.shift();
    return { items, history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  alignSelected: (edge) => set((state) => {
    const sel = state.selectedItemIds; if (sel.length < 2) return state;
    const chosen = state.items.filter((it) => sel.includes(it.id));
    const xs = chosen.map((c) => c.x), ys = chosen.map((c) => c.y);
    let target: number | null = null; let horizontal = true;
    if (edge === 'left') target = Math.min(...xs);
    else if (edge === 'right') target = Math.max(...xs);
    else if (edge === 'centerH') target = xs.reduce((a, b) => a + b, 0) / xs.length;
    else { horizontal = false; if (edge === 'top') target = Math.min(...ys); else if (edge === 'bottom') target = Math.max(...ys); else target = ys.reduce((a, b) => a + b, 0) / ys.length; }
    const items = state.items.map((it) => sel.includes(it.id) ? (horizontal ? { ...it, x: target! } : { ...it, y: target! }) : it);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(items); if (newHistory.length > 50) newHistory.shift();
    return { items, history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  distributeSelected: (axis) => set((state) => {
    const sel = state.selectedItemIds; if (sel.length < 3) return state;
    const chosen = state.items.filter((it) => sel.includes(it.id)).sort((a, b) => axis === 'h' ? a.x - b.x : a.y - b.y);
    const lo = axis === 'h' ? chosen[0].x : chosen[0].y;
    const hi = axis === 'h' ? chosen[chosen.length - 1].x : chosen[chosen.length - 1].y;
    const step = (hi - lo) / (chosen.length - 1);
    const pos = new Map<string, number>();
    chosen.forEach((c, i) => pos.set(c.id, lo + step * i));
    const items = state.items.map((it) => pos.has(it.id) ? (axis === 'h' ? { ...it, x: Math.round(pos.get(it.id)!) } : { ...it, y: Math.round(pos.get(it.id)!) }) : it);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(items); if (newHistory.length > 50) newHistory.shift();
    return { items, history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  // 세로축(x = WORLD_WIDTH/2) 기준 좌우 대칭. duplicate=true 면 미러 복제본 추가.
  mirrorSelected: (duplicate) => set((state) => {
    const W = 800;
    const sel = state.selectedItemIds.length ? state.selectedItemIds : (state.selectedItemId ? [state.selectedItemId] : []);
    if (!sel.length) return state;
    const mirror = (it: EditorItem): EditorItem => ({
      ...it,
      x: W - it.x,
      angle: it.angle != null ? ((180 - it.angle) % 360 + 360) % 360 : it.angle,
      windAngle: it.windAngle != null ? ((360 - it.windAngle) % 360) : it.windAngle,
      side: it.side === 'left' ? 'right' : it.side === 'right' ? 'left' : it.side,
      waypointB: it.waypointB ? { x: W - it.waypointB.x, y: it.waypointB.y } : it.waypointB,
      vertices: it.vertices ? it.vertices.map((v) => ({ x: -v.x, y: v.y })) : it.vertices,
    });
    let items: EditorItem[];
    let newSel: string[];
    if (duplicate) {
      const copies = state.items.filter((it) => sel.includes(it.id)).map((it) => ({ ...mirror(it), id: `${it.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }));
      items = [...state.items, ...copies];
      newSel = copies.map((c) => c.id);
    } else {
      const s = new Set(sel);
      items = state.items.map((it) => s.has(it.id) ? mirror(it) : it);
      newSel = sel;
    }
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(items); if (newHistory.length > 50) newHistory.shift();
    return { items, history: newHistory, historyIndex: newHistory.length - 1, selectedItemIds: newSel, selectedItemId: newSel[newSel.length - 1] || null };
  }),

  // 선택 묶음을 count 개로 선형 복제 (gapX, gapY 간격)
  arraySelected: (count, gapX, gapY) => set((state) => {
    const sel = state.selectedItemIds.length ? state.selectedItemIds : (state.selectedItemId ? [state.selectedItemId] : []);
    if (!sel.length || count < 1) return state;
    const src = state.items.filter((it) => sel.includes(it.id));
    const copies: EditorItem[] = [];
    for (let n = 1; n <= count; n++) {
      for (const it of src) {
        copies.push({ ...it, id: `${it.type}_${Date.now()}_${n}_${Math.random().toString(36).slice(2, 5)}`, x: it.x + gapX * n, y: it.y + gapY * n, waypointB: it.waypointB ? { x: it.waypointB.x + gapX * n, y: it.waypointB.y + gapY * n } : it.waypointB });
      }
    }
    const items = [...state.items, ...copies];
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(items); if (newHistory.length > 50) newHistory.shift();
    return { items, history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  // 다중 선택 일괄 복제
  duplicateSelected: () => set((state) => {
    const sel = state.selectedItemIds.length ? state.selectedItemIds : (state.selectedItemId ? [state.selectedItemId] : []);
    if (!sel.length) return state;
    const src = state.items.filter((it) => sel.includes(it.id));
    const copies = src.map((it) => ({ 
      ...it, 
      id: `${it.type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, 
      x: it.x + 30, 
      y: it.y + 30,
      waypointB: it.waypointB ? { x: it.waypointB.x + 30, y: it.waypointB.y + 30 } : it.waypointB
    }));
    const items = [...state.items, ...copies];
    const newSel = copies.map(c => c.id);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(items); if (newHistory.length > 50) newHistory.shift();
    return { items, history: newHistory, historyIndex: newHistory.length - 1, selectedItemIds: newSel, selectedItemId: newSel[newSel.length - 1] || null };
  }),

  deleteSelected: () => set((state) => {
    const sel = new Set(state.selectedItemIds.length ? state.selectedItemIds : (state.selectedItemId ? [state.selectedItemId] : []));
    if (!sel.size) return state;
    const items = state.items.filter((it) => !sel.has(it.id));
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(items); if (newHistory.length > 50) newHistory.shift();
    return { items, history: newHistory, historyIndex: newHistory.length - 1, selectedItemId: null, selectedItemIds: [] };
  }),

  setEditorMode: (isEditor) => set({ isEditorMode: isEditor }),
  setMapId: (id) => { set({ mapId: id }); get().markUnsaved(); },

  undo: () => set((state) => {
    if (state.historyIndex > 0) {
      const prevIndex = state.historyIndex - 1;
      get().markUnsaved();
      return { historyIndex: prevIndex, items: state.history[prevIndex], selectedItemId: null, selectedItemIds: [] };
    }
    return state;
  }),

  redo: () => set((state) => {
    if (state.historyIndex < state.history.length - 1) {
      const nextIndex = state.historyIndex + 1;
      get().markUnsaved();
      return { historyIndex: nextIndex, items: state.history[nextIndex], selectedItemId: null, selectedItemIds: [] };
    }
    return state;
  }),
}))
