import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { EditorItem } from './editorStore'

interface UIState {
  isSidebarOpen: boolean
  setSidebarOpen: (isOpen: boolean) => void
  toggleSidebar: () => void
  
  activeModal: 'none' | 'mapLoad' | 'listManager' | 'settings' | 'auth' | 'stampBook'
  setActiveModal: (modal: 'none' | 'mapLoad' | 'listManager' | 'settings' | 'auth' | 'stampBook') => void
  authMode: 'login' | 'signup'
  setAuthMode: (mode: 'login' | 'signup') => void

  gameStage: 'dashboard' | 'playing' | 'winner_declared' | 'all_finished' | 'editor'
  setGameStage: (stage: 'dashboard' | 'playing' | 'winner_declared' | 'all_finished' | 'editor') => void
  
  customMapData: EditorItem[] | null
  setCustomMapData: (data: any[] | null) => void
  customMapMeta: { worldHeight?: number, wallStyle?: string, bgImage?: string | null, layoutConfig?: any } | null
  setCustomMapMeta: (meta: any | null) => void
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
  hasClaimableMissions: boolean
  setHasClaimableMissions: (hasClaimable: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: false,
      setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      
      customMapData: null,
      customMapMeta: null,
      customMapTitle: null,
      isBroadcasterMode: false,
      isAnonymized: false,
      gameTitle: '롤링 썬더!',
      activeModal: 'none',
      authMode: 'login',
      isAdmin: false,
      isLoggedIn: false,
      hasClaimableMissions: false,
      gameStage: 'dashboard',
      setGameStage: (stage) => set({ gameStage: stage }),
      setCustomMapData: (data) => set({ customMapData: data }),
      setCustomMapMeta: (meta) => set({ customMapMeta: meta }),
      setCustomMapTitle: (title) => set({ customMapTitle: title }),
      setBroadcasterMode: (isBroadcaster) => set({ isBroadcasterMode: isBroadcaster }),
      setAnonymized: (isAnonymized) => set({ isAnonymized: isAnonymized }),
      setGameTitle: (title) => set({ gameTitle: title }),
      setActiveModal: (modal) => set({ activeModal: modal }),
      setAuthMode: (mode) => set({ authMode: mode }),
      setIsAdmin: (isAdmin) => set({ isAdmin: isAdmin }),
      setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn: isLoggedIn }),
      setHasClaimableMissions: (hasClaimable) => set({ hasClaimableMissions: hasClaimable }),
    }),
    {
      name: 'rt-ui-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        isBroadcasterMode: state.isBroadcasterMode, 
        isAnonymized: state.isAnonymized,
        customMapData: state.customMapData,
        customMapMeta: state.customMapMeta,
        customMapTitle: state.customMapTitle
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        ...persistedState,
        activeModal: 'none', // 로컬 스토리지의 이전 상태를 무시하고 항상 모달 닫힘 상태로 초기화
      }),
    }
  )
)
