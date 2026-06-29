import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { EditorItem } from './editorStore'

interface UIState {
  isSidebarOpen: boolean
  setSidebarOpen: (isOpen: boolean) => void
  toggleSidebar: () => void
  
  activeModal: 'none' | 'mapLoad' | 'listManager' | 'settings'
  setActiveModal: (modal: 'none' | 'mapLoad' | 'listManager' | 'settings') => void

  gameStage: 'dashboard' | 'playing' | 'winner_declared' | 'all_finished'
  setGameStage: (stage: 'dashboard' | 'playing' | 'winner_declared' | 'all_finished') => void
  
  customMapData: EditorItem[] | null
  setCustomMapData: (data: any[] | null) => void
  customMapTitle: string | null
  setCustomMapTitle: (title: string | null) => void

  isBroadcasterMode: boolean
  setBroadcasterMode: (isBroadcaster: boolean) => void
  isAnonymized: boolean
  setAnonymized: (isAnonymized: boolean) => void
  
  gameTitle: string | null
  setGameTitle: (title: string) => void

  isAdmin: boolean
  setIsAdmin: (isAdmin: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: false,
      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      
      customMapData: null,
      customMapTitle: null,
      isBroadcasterMode: false,
      isAnonymized: false,
      gameTitle: '롤링 썬더!',
      activeModal: 'none',
      isAdmin: false,
      gameStage: 'dashboard',
      setGameStage: (stage) => set({ gameStage: stage }),
      setCustomMapData: (data) => set({ customMapData: data }),
      setCustomMapTitle: (title) => set({ customMapTitle: title }),
      setBroadcasterMode: (isBroadcaster) => set({ isBroadcasterMode: isBroadcaster }),
      setAnonymized: (isAnonymized) => set({ isAnonymized: isAnonymized }),
      setGameTitle: (title) => set({ gameTitle: title }),
      setActiveModal: (modal) => set({ activeModal: modal }),
      setIsAdmin: (isAdmin) => set({ isAdmin: isAdmin }),
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
