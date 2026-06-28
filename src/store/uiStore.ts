import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
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
  customMapTitle: string | null
  setCustomMapTitle: (title: string | null) => void

  isBroadcasterMode: boolean
  setBroadcasterMode: (isMode: boolean) => void
  isAnonymized: boolean
  setAnonymized: (isAnon: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: false,
      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      
      activeModal: 'none',
      setActiveModal: (activeModal) => set({ activeModal }),

      gameStage: 'dashboard',
      setGameStage: (gameStage) => set({ gameStage }),

      customMapData: null,
      setCustomMapData: (customMapData) => set({ customMapData }),
      customMapTitle: null,
      setCustomMapTitle: (customMapTitle) => set({ customMapTitle }),

      isBroadcasterMode: false,
      setBroadcasterMode: (isBroadcasterMode) => set({ isBroadcasterMode }),
      
      isAnonymized: false,
      setAnonymized: (isAnonymized) => set({ isAnonymized })
    }),
    {
      name: 'rt-ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        isBroadcasterMode: state.isBroadcasterMode, 
        isAnonymized: state.isAnonymized,
        customMapData: state.customMapData,
        customMapTitle: state.customMapTitle
      }),
    }
  )
)
