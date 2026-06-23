import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface Participant {
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
  
  // Game config
  gimmickDensity: number
  setGimmickDensity: (density: number) => void
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
    }),
    {
      name: 'rt-game-storage', // 로컬스토리지에 저장될 키 이름
      storage: createJSONStorage(() => localStorage), // 앱 재시작 시 데이터 영속화 보장
    }
  )
)
