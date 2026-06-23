import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Participant {
  id: string
  name: string
  color: string
  iconUrl?: string
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
  targetSurvivalCount: number
  setTargetSurvivalCount: (count: number) => void
  sessionId: string | null
  setSessionId: (id: string | null) => void
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
      targetSurvivalCount: 1,
      setTargetSurvivalCount: (targetSurvivalCount) => set({ targetSurvivalCount }),
      sessionId: null,
      setSessionId: (sessionId) => set({ sessionId }),
    }),
    {
      name: 'rt-game-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
