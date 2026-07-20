import { create } from 'zustand';

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

// ⚠️ 인벤토리/장착은 자체 persist하지 않는다 — 계정 간 잔여 데이터 방지.
// 새 창에서의 즉시 표시는 userId 스탬프 lobbyCache가 세션 확인 후 hydrateFromServer로 담당하고,
// 서버(user_inventory)가 단일 진실원이다([src/lib/lobbyCache.ts], GlobalPlayerHUD initAuth).
export const useInventoryStore = create<InventoryState>((set, get) => ({
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
}));
