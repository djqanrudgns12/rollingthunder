import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { EditorItem } from './editorStore'

interface UIState {
  isSidebarOpen: boolean
  setSidebarOpen: (isOpen: boolean) => void
  toggleSidebar: () => void
  
  activeModal: 'none' | 'mapLoad' | 'listManager' | 'settings' | 'auth'
  setActiveModal: (modal: 'none' | 'mapLoad' | 'listManager' | 'settings' | 'auth') => void

  gameStage: 'dashboard' | 'playing' | 'winner_declared' | 'all_finished' | 'editor'
  setGameStage: (stage: 'dashboard' | 'playing' | 'winner_declared' | 'all_finished' | 'editor') => void
  
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
  isLoggedIn: boolean
  setIsLoggedIn: (isLoggedIn: boolean) => void
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
      isLoggedIn: false,
      gameStage: 'dashboard',
      setGameStage: (stage) => set({ gameStage: stage }),
      setCustomMapData: (data) => set({ customMapData: data }),
      setCustomMapTitle: (title) => set({ customMapTitle: title }),
      setBroadcasterMode: (isBroadcaster) => set({ isBroadcasterMode: isBroadcaster }),
      setAnonymized: (isAnonymized) => set({ isAnonymized: isAnonymized }),
      setGameTitle: (title) => set({ gameTitle: title }),
      setActiveModal: (modal) => set({ activeModal: modal }),
      setIsAdmin: (isAdmin) => set({ isAdmin: isAdmin }),
      setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn: isLoggedIn }),
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
