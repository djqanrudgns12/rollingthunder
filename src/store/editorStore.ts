import { create } from 'zustand'

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
  // --- 다중 선택 / 정렬 / 미러 (Phase 3) ---
  selectedItemIds: string[];
  setSelectedItemIds: (ids: string[]) => void;
  toggleSelectedItem: (id: string) => void;
  moveSelectedBy: (dx: number, dy: number, commit?: boolean) => void;
  alignSelected: (edge: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => void;
  distributeSelected: (axis: 'h' | 'v') => void;
  mirrorSelected: (duplicate: boolean) => void;
  arraySelected: (count: number, gapX: number, gapY: number) => void;
  deleteSelected: () => void;
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
  wallStyle: 'straight',
  previewAnimating: true,
  clipboard: null,
  gridSnap: false,
  selectedItemIds: [],

  setClipboard: (item) => set({ clipboard: item }),
  setGridSnap: (snap) => set({ gridSnap: snap }),
  setWorldHeight: (height) => set({ worldHeight: height }),
  setWallStyle: (style) => set({ wallStyle: style }),
  setPreviewAnimating: (on) => set({ previewAnimating: on }),

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
          wallStyle: (preset.wallStyle as EditorWallStyle) || 'straight',
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

  // 드래그/리사이즈 중에는 히스토리를 남기지 않고 items 만 갱신 (히스토리 스팸 방지)
  updateItemSilent: (id, updates) => set((state) => ({
    items: state.items.map((it) => (it.id === id ? { ...it, ...updates } : it)),
  })),

  // 드래그/리사이즈 종료 시 1회 호출하여 현재 상태를 히스토리에 커밋
  commitHistory: () => set((state) => {
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(state.items);
    if (newHistory.length > 50) newHistory.shift();
    return { history: newHistory, historyIndex: newHistory.length - 1 };
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

  deleteSelected: () => set((state) => {
    const sel = new Set(state.selectedItemIds.length ? state.selectedItemIds : (state.selectedItemId ? [state.selectedItemId] : []));
    if (!sel.size) return state;
    const items = state.items.filter((it) => !sel.has(it.id));
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(items); if (newHistory.length > 50) newHistory.shift();
    return { items, history: newHistory, historyIndex: newHistory.length - 1, selectedItemId: null, selectedItemIds: [] };
  }),

  setEditorMode: (isEditor) => set({ isEditorMode: isEditor }),
  setMapId: (id) => set({ mapId: id }),

  undo: () => set((state) => {
    if (state.historyIndex > 0) {
      const prevIndex = state.historyIndex - 1;
      return { historyIndex: prevIndex, items: state.history[prevIndex], selectedItemId: null, selectedItemIds: [] };
    }
    return state;
  }),

  redo: () => set((state) => {
    if (state.historyIndex < state.history.length - 1) {
      const nextIndex = state.historyIndex + 1;
      return { historyIndex: nextIndex, items: state.history[nextIndex], selectedItemId: null, selectedItemIds: [] };
    }
    return state;
  }),
}))
