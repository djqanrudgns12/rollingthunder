import { create } from 'zustand'
import { useGameStore } from './gameStore'

// 하이엔드 기믹 타입 추가
export type EditorItemType = 'pin' | 'bumper' | 'wall' | 'hole' | 'portal' | 'booster' | 'windmill' | 'piston' | 'blackhole' | 'whitehole' | 'spinner' | 'iceblock' | 'windcannon' | 'luckygate' | 'flipper' | 'startline' | 'endline' | 'polygon';

// 외벽 스타일 (MapPresets.WallStyle 과 동일 — 순환 import 회피 위해 로컬 정의)
export type EditorWallStyle = 'straight' | 'zigzag' | 'narrow' | 'wide';

export interface EditorItem {
  id: string;
  type: EditorItemType;
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
    layoutConfig: any;
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
  layoutConfig: any;
  wallStyle: EditorWallStyle;       // 외벽 스타일 (배경 너비/외벽 가이드에 사용)
  previewAnimating: boolean;        // 에디터 캔버스 기물 애니메이션 ON/OFF

  addItem: (item: EditorItem) => void;
  updateItem: (id: string, updates: Partial<EditorItem>) => void;
  updateItemSilent: (id: string, updates: Partial<EditorItem>) => void; // 히스토리 미기록(드래그/리사이즈 중)
  commitHistory: () => void;                                            // 현재 items 를 히스토리에 1회 커밋
  removeItem: (id: string) => void;
  clearItems: () => void;
  setItems: (items: EditorItem[]) => void;
  
  setSelectedItemId: (id: string | null) => void;
  setEditorMode: (isEditor: boolean) => void;
  setMapId: (id: string | null) => void;
  setWorldHeight: (height: number) => void;
  setWallStyle: (style: EditorWallStyle) => void;
  setPreviewAnimating: (on: boolean) => void;
  loadMapPreset: (mapId: string) => void;
  
  clipboard: EditorItem | null;
  setClipboard: (item: EditorItem | null) => void;
  
  gridSnap: boolean;
  setGridSnap: (snap: boolean) => void;
  
  undo: () => void;
  redo: () => void;
  pushHistory: (newItems: EditorItem[]) => void;
}

// 스냅샷 생성 유틸리티
const createSnapshot = (state: any) => ({
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
    let updatedTabs = [...state.tabs];
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

    let updatedTabs = [...state.tabs];
    
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
  clipboard: null,
  gridSnap: false,

  setClipboard: (item) => set({ clipboard: item }),
  setGridSnap: (snap) => set({ gridSnap: snap }),
  setWorldHeight: (height) => { set({ worldHeight: height }); get().markUnsaved(); },
  setWallStyle: (style) => { set({ wallStyle: style }); get().markUnsaved(); },
  setPreviewAnimating: (on) => set({ previewAnimating: on }),

  loadMapPreset: (mapId) => {
    const state = get();
    // 탭 추가(이미 있으면 해당 탭으로 전환)
    state.addTab(mapId, 'map');

    // addTab에서 스냅샷 초기화를 하지만, 최초 로딩 시엔 실제 데이터를 채워야 함
    setTimeout(() => {
      const applyPreset = (preset: any) => {
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

  setSelectedItemId: (id) => set({ selectedItemId: id }),
  setEditorMode: (isEditor) => set({ isEditorMode: isEditor }),
  setMapId: (id) => { set({ mapId: id }); get().markUnsaved(); },

  undo: () => set((state) => {
    if (state.historyIndex > 0) {
      const prevIndex = state.historyIndex - 1;
      get().markUnsaved();
      return { historyIndex: prevIndex, items: state.history[prevIndex], selectedItemId: null };
    }
    return state;
  }),

  redo: () => set((state) => {
    if (state.historyIndex < state.history.length - 1) {
      const nextIndex = state.historyIndex + 1;
      get().markUnsaved();
      return { historyIndex: nextIndex, items: state.history[nextIndex], selectedItemId: null };
    }
    return state;
  }),
}))
