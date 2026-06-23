import { create } from 'zustand'

export type EditorItemType = 'pin' | 'bumper' | 'wall' | 'hole' | 'portal';

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
  rotation?: number;
}

interface EditorState {
  items: EditorItem[];
  addItem: (item: EditorItem) => void;
  updateItem: (id: string, updates: Partial<EditorItem>) => void;
  removeItem: (id: string) => void;
  clearItems: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((it) => (it.id === id ? { ...it, ...updates } : it))
  })),
  removeItem: (id) => set((state) => ({
    items: state.items.filter((it) => it.id !== id)
  })),
  clearItems: () => set({ items: [] }),
}))
