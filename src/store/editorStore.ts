import { create } from 'zustand'

// 하이엔드 기믹 타입 추가
export type EditorItemType = 'pin' | 'bumper' | 'wall' | 'hole' | 'portal' | 'booster' | 'windmill' | 'piston' | 'blackhole' | 'whitehole' | 'spinner' | 'iceblock' | 'windcannon' | 'luckygate' | 'flipper';

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
  // --- 하이엔드 기믹 전용 속성들 ---
  rotation?: number;      // 회전각 (Booster, Windmill, Wall 등에 사용)
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
  selectedItemId: string | null; // 속성 패널(Inspector)용 선택된 아이템 ID
  addItem: (item: EditorItem) => void;
  updateItem: (id: string, updates: Partial<EditorItem>) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
  setSelectedItemId: (id: string | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  items: [],
  selectedItemId: null,
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((it) => (it.id === id ? { ...it, ...updates } : it))
  })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter((it) => it.id !== id),
    selectedItemId: state.selectedItemId === id ? null : state.selectedItemId
  })),
  clearItems: () => set({ items: [], selectedItemId: null }),
  setSelectedItemId: (id) => set({ selectedItemId: id }),
}))
