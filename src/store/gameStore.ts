import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Participant {
  id: string
  name: string
  color: string
  iconUrl?: string
  skinId?: string // 가챠로 획득한 커스텀 스킨 (예: 'UR_blackhole', 'SR_cat')
}

interface GameState {
  participants: Participant[]
  setParticipants: (participants: Participant[]) => void
  addParticipant: (participant: Participant) => void
  removeParticipant: (id: string) => void
  clearParticipants: () => void
  
  gimmickDensity: number
  setGimmickDensity: (density: number) => void

  survivors: Participant[]
  setSurvivors: (survivors: Participant[]) => void
  targetWinnerCount: number
  setTargetWinnerCount: (count: number) => void
  sessionId: string | null
  setSessionId: (id: string | null) => void
  
  selectedMapPreset: string
  setSelectedMapPreset: (preset: string) => void

  gameMode: 'speed' | 'turtle' | 'lucky'
  setGameMode: (mode: 'speed' | 'turtle' | 'lucky') => void
  customWinningRank: number
  setCustomWinningRank: (rank: number) => void
}

export const useGameStore = create<GameState>()(
  persist(
    (set) => ({
      participants: [],
      setParticipants: (participants) => set({ participants }),
      addParticipant: (participant) => set((state) => ({ participants: [...state.participants, participant] })),
      removeParticipant: (id) => set((state) => ({ participants: state.participants.filter(p => p.id !== id) })),
      clearParticipants: () => set({ participants: [] }),
      
      gimmickDensity: 50,
      setGimmickDensity: (gimmickDensity) => set({ gimmickDensity }),

      survivors: [],
      setSurvivors: (survivors) => set({ survivors }),
      targetWinnerCount: 1,
      setTargetWinnerCount: (targetWinnerCount) => set({ targetWinnerCount }),
      sessionId: null,
      setSessionId: (sessionId) => set({ sessionId }),
      
      selectedMapPreset: 'random',
      setSelectedMapPreset: (selectedMapPreset) => set({ selectedMapPreset }),
      
      gameMode: 'speed',
      setGameMode: (gameMode) => set({ gameMode }),
      customWinningRank: 1,
      setCustomWinningRank: (customWinningRank) => set({ customWinningRank }),
    }),
    {
      name: 'rt-game-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
