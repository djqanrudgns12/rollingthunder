import { create } from 'zustand'

// 하이엔드 기믹 타입 추가
export type EditorItemType = 'pin' | 'bumper' | 'wall' | 'hole' | 'portal' | 'booster' | 'windmill' | 'piston' | 'blackhole' | 'whitehole' | 'spinner' | 'iceblock' | 'windcannon' | 'luckygate' | 'flipper' | 'startline' | 'endline' | 'polygon';

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

interface EditorState {
  items: EditorItem[];
  history: EditorItem[][];
  historyIndex: number;
  selectedItemId: string | null;
  isEditorMode: boolean;
  mapId: string | null;
  bgImage: string | null;
  worldHeight: number;
  layoutConfig: any;
  
  addItem: (item: EditorItem) => void;
  updateItem: (id: string, updates: Partial<EditorItem>) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  setItems: (items: EditorItem[]) => void;
  
  setSelectedItemId: (id: string | null) => void;
  setEditorMode: (isEditor: boolean) => void;
  setMapId: (id: string | null) => void;
  setWorldHeight: (height: number) => void;
  loadMapPreset: (mapId: string) => void;
  
  clipboard: EditorItem | null;
  setClipboard: (item: EditorItem | null) => void;
  
  gridSnap: boolean;
  setGridSnap: (snap: boolean) => void;
  
  undo: () => void;
  redo: () => void;
  pushHistory: (newItems: EditorItem[]) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  items: [],
  history: [[]],
  historyIndex: 0,
  selectedItemId: null,
  isEditorMode: false,
  mapId: null,
  bgImage: null,
  worldHeight: 3300,
  layoutConfig: null,
  clipboard: null,
  gridSnap: false,

  setClipboard: (item) => set({ clipboard: item }),
  setGridSnap: (snap) => set({ gridSnap: snap }),
  setWorldHeight: (height) => set({ worldHeight: height }),

  loadMapPreset: (mapId) => set((state) => {
    // 동적 임포트로 MapPresets를 가져와서 적용
    import('@/engine/MapPresets').then(({ MapPresets }) => {
      const preset = MapPresets[mapId];
      if (preset) {
        useEditorStore.setState({
          mapId,
          bgImage: preset.bgImage || null,
          worldHeight: preset.worldHeight || 3300,
          layoutConfig: preset.layoutConfig || null,
          items: preset.items ? [...preset.items] : [],
          history: preset.items ? [[...preset.items]] : [[]],
          historyIndex: 0
        });
      }
    });
    return {};
  }),

  pushHistory: (newItems) => set((state) => {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newItems);
    // 최대 50개의 히스토리만 유지
    if (newHistory.length > 50) newHistory.shift();
    return { history: newHistory, historyIndex: newHistory.length - 1, items: newItems };
  }),

  addItem: (item) => set((state) => {
    const newItems = [...state.items, item];
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newItems);
    if (newHistory.length > 50) newHistory.shift();
    return { items: newItems, history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  updateItem: (id, updates) => set((state) => {
    const newItems = state.items.map((it) => (it.id === id ? { ...it, ...updates } : it));
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newItems);
    if (newHistory.length > 50) newHistory.shift();
    return { items: newItems, history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  removeItem: (id) => set((state) => {
    const newItems = state.items.filter((it) => it.id !== id);
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(newItems);
    if (newHistory.length > 50) newHistory.shift();
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
    return { items: newItems, history: newHistory, historyIndex: newHistory.length - 1, selectedItemId: null };
  }),

  setItems: (items) => set((state) => {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(items);
    if (newHistory.length > 50) newHistory.shift();
    return { items, history: newHistory, historyIndex: newHistory.length - 1 };
  }),

  setSelectedItemId: (id) => set({ selectedItemId: id }),
  setEditorMode: (isEditor) => set({ isEditorMode: isEditor }),
  setMapId: (id) => set({ mapId: id }),

  undo: () => set((state) => {
    if (state.historyIndex > 0) {
      const prevIndex = state.historyIndex - 1;
      return { historyIndex: prevIndex, items: state.history[prevIndex], selectedItemId: null };
    }
    return state;
  }),

  redo: () => set((state) => {
    if (state.historyIndex < state.history.length - 1) {
      const nextIndex = state.historyIndex + 1;
      return { historyIndex: nextIndex, items: state.history[nextIndex], selectedItemId: null };
    }
    return state;
  }),
}))
