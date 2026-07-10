import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface EquippedItems {
  skin: string | null;
  avatar: string | null;
  border: string | null;
  piece: string | null;
  background: string | null;
  frame: string | null;
}

interface InventoryState {
  userId: string | null;
  inventory: string[];
  equipped: EquippedItems;
  
  // Actions
  buyItem: (itemId: string) => void;
  equipItem: (category: keyof EquippedItems, itemId: string) => void;
  unequipItem: (category: keyof EquippedItems) => void;
  hasItem: (itemId: string) => boolean;
  reset: () => void;
  hydrateFromServer: (userId: string, inventory: string[], equipped: EquippedItems) => void;
}

export const useInventoryStore = create<InventoryState>()(
  persist(
    (set, get) => ({
      userId: null,
      inventory: [],
      equipped: {
        skin: null,
        avatar: null,
        border: null,
        piece: null,
        background: null,
        frame: null,
      },

      buyItem: (itemId) => set((state) => ({
        inventory: [...new Set([...state.inventory, itemId])]
      })),

      equipItem: (category, itemId) => set((state) => ({
        equipped: {
          ...state.equipped,
          [category]: itemId
        }
      })),

      unequipItem: (category) => set((state) => ({
        equipped: {
          ...state.equipped,
          [category]: null
        }
      })),

      hasItem: (itemId) => get().inventory.includes(itemId),
      
      reset: () => set({
        userId: null,
        inventory: [],
        equipped: {
          skin: null,
          avatar: null,
          border: null,
          piece: null,
          background: null,
          frame: null,
        }
      }),

      hydrateFromServer: (userId, inventory, equipped) => set({
        userId,
        inventory,
        equipped,
      }),
    }),
    {
      name: 'rt-inventory-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // 서버(user_inventory + hydrateFromServer)가 단일 진실원.
      // 로컬은 "해당 userId 전용 캐시"임을 명시하고 저장 범위를 화이트리스트로 고정한다.
      partialize: (state) => ({
        userId: state.userId,
        inventory: state.inventory,
        equipped: state.equipped,
      }),
      // v1 이전(버전 미표기) 캐시는 계정 전환 오염 이력이 있으므로 1회 폐기 → 기본값에서 서버 재하이드레이션
      migrate: (persistedState, version) =>
        (version < 1 ? {} : persistedState) as InventoryState,
    }
  )
);
