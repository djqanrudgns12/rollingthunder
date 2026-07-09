import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { EditorItem } from './editorStore'
import type { Participant } from './gameStore'

interface UIState {
  isSidebarOpen: boolean
  setSidebarOpen: (isOpen: boolean) => void
  toggleSidebar: () => void
  
  activeModal: 'none' | 'mapLoad' | 'listManager' | 'settings' | 'auth' | 'stampBook' | 'profile' | 'premiumUpgrade'
  setActiveModal: (modal: 'none' | 'mapLoad' | 'listManager' | 'settings' | 'auth' | 'stampBook' | 'profile' | 'premiumUpgrade') => void
  authMode: 'login' | 'signup'
  setAuthMode: (mode: 'login' | 'signup') => void

  gameStage: 'dashboard' | 'playing' | 'winner_declared' | 'all_finished' | 'editor'
  setGameStage: (stage: 'dashboard' | 'playing' | 'winner_declared' | 'all_finished' | 'editor') => void
  
  shopViewMode: 'shop' | 'inventory' | 'mapstore'
  setShopViewMode: (mode: 'shop' | 'inventory' | 'mapstore') => void
  
  customMapData: EditorItem[] | null
  setCustomMapData: (data: any[] | null) => void
  customMapMeta: { worldHeight?: number, wallStyle?: string, bgImage?: string | null, layoutConfig?: any } | null
  setCustomMapMeta: (meta: any | null) => void
  customMapTitle: string | null
  setCustomMapTitle: (title: string | null) => void

  // 인-에디터 테스트 플레이 세션 (비영속 — partialize 화이트리스트 제외).
  // 실제 게임 브리지(customMapData)를 재사용하지 않아 localStorage 오염을 방지한다.
  testPlaySession: {
    items: EditorItem[]
    meta: { worldHeight?: number; wallStyle?: string; bgImage?: string | null; layoutConfig?: any }
    survivors: Participant[]
  } | null
  startTestPlay: (session: NonNullable<UIState['testPlaySession']>) => void
  endTestPlay: () => void

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
  userProfile: any | null // We use 'any' to avoid circular dependency or import issues, or we can import UserProfile
  setUserProfile: (profile: any | null) => void
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
      shopViewMode: 'shop',
      setShopViewMode: (mode) => set({ shopViewMode: mode }),
      setCustomMapData: (data) => set({ customMapData: data }),
      setCustomMapMeta: (meta) => set({ customMapMeta: meta }),
      setCustomMapTitle: (title) => set({ customMapTitle: title }),
      testPlaySession: null,
      startTestPlay: (session) => set({ testPlaySession: session, gameStage: 'playing' }),
      endTestPlay: () => set({ testPlaySession: null }),
      setBroadcasterMode: (isBroadcaster) => set({ isBroadcasterMode: isBroadcaster }),
      setAnonymized: (isAnonymized) => set({ isAnonymized: isAnonymized }),
      setGameTitle: (title) => set({ gameTitle: title }),
      setActiveModal: (modal) => set({ activeModal: modal }),
      setAuthMode: (mode) => set({ authMode: mode }),
      setIsAdmin: (isAdmin) => set({ isAdmin: isAdmin }),
      setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn: isLoggedIn }),
      setHasClaimableMissions: (hasClaimable) => set({ hasClaimableMissions: hasClaimable }),
      userProfile: null,
      setUserProfile: (profile) => set({ userProfile: profile }),
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
