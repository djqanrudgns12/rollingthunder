import { create } from 'zustand';

interface ChipState {
  chips: number;
  totalEarnedChips: number;
  totalSpentChips: number;
  // 액션
  setChips: (chips: number) => void;
  addChipsLocally: (amount: number) => void;
  deductChipsLocally: (amount: number) => void;
  triggerJackpot: () => void;
  isJackpotActive: boolean;
  setJackpotActive: (active: boolean) => void;
}

export const useChipStore = create<ChipState>((set) => ({
  chips: 0,
  totalEarnedChips: 0,
  totalSpentChips: 0,
  isJackpotActive: false,

  setChips: (chips) => set({ chips }),

  addChipsLocally: (amount) => set((state) => {
    const newChips = state.chips + amount;
    // 임시 로컬 처리, DB 반영은 API 단에서 수행
    return {
      chips: newChips,
      totalEarnedChips: state.totalEarnedChips + amount
    };
  }),

  deductChipsLocally: (amount) => set((state) => {
    const newChips = Math.max(0, state.chips - amount);
    return {
      chips: newChips,
      totalSpentChips: state.totalSpentChips + amount
    };
  }),

  triggerJackpot: () => set({ isJackpotActive: true }),
  setJackpotActive: (active) => set({ isJackpotActive: active }),
}));
