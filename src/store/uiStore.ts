import { create } from 'zustand'
import type { EditorItem } from './editorStore'

interface UIState {
  isSidebarOpen: boolean
  setSidebarOpen: (isOpen: boolean) => void
  toggleSidebar: () => void
  
  activeModal: 'none' | 'login' | 'settings' | 'preset'
  setActiveModal: (modal: 'none' | 'login' | 'settings' | 'preset') => void

  gameStage: 'dashboard' | 'playing' | 'results'
  setGameStage: (stage: 'dashboard' | 'playing' | 'results') => void
  
  customMapData: EditorItem[] | null
  setCustomMapData: (data: EditorItem[] | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  
  activeModal: 'none',
  setActiveModal: (activeModal) => set({ activeModal }),

  gameStage: 'dashboard',
  setGameStage: (gameStage) => set({ gameStage }),

  customMapData: null,
  setCustomMapData: (customMapData) => set({ customMapData }),
}))
