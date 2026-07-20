import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

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

export const useChipStore = create<ChipState>()(
  persist(
    (set) => ({
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
    }),
    {
      name: 'rt-chip-storage',
      storage: createJSONStorage(() => localStorage),
      // 캐시퍼스트 페인트: 새 창에서 칩 카운터가 0부터가 아닌 마지막 값에서 시작.
      // 서버 부트스트랩의 setChips가 곧바로 진짜 값으로 덮어쓴다. 잭팟 상태는 비영속.
      partialize: (state) => ({
        chips: state.chips,
        totalEarnedChips: state.totalEarnedChips,
        totalSpentChips: state.totalSpentChips,
      }),
    }
  )
);
