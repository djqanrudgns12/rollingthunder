import { create } from 'zustand'

interface UIState {
  isSidebarOpen: boolean
  setSidebarOpen: (isOpen: boolean) => void
  toggleSidebar: () => void
  
  activeModal: 'none' | 'login' | 'settings' | 'preset'
  setActiveModal: (modal: 'none' | 'login' | 'settings' | 'preset') => void
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: false,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  
  activeModal: 'none',
  setActiveModal: (activeModal) => set({ activeModal }),
}))
