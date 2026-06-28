import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Participant {
  id: string
  name: string
  color: string
  iconUrl?: string
  skinId?: string // 가챠로 획득한 커스텀 스킨 (예: 'UR_blackhole', 'SR_cat')
}

// 스킬 로그 한 줄에 해당하는 타입 (스킬 발동 기록)
export interface SkillLogEntry {
  id: string           // 고유 ID (중복 방지)
  chipId: string       // 발동한 마블의 ID
  playerName: string   // 표시될 플레이어 이름
  playerColor: string  // 플레이어 고유 색상
  skill: string        // 스킬 종류 (tank, booster, ghost 등)
  message: string      // 완성된 표시 문구 ("홍길동님의 무시무시한 탱크 모드!")
  timestamp: number    // 발동 시각 (Date.now())
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

  globalSkin: string
  setGlobalSkin: (skin: string) => void

  gameMode: 'speed' | 'turtle' | 'custom' | 'random'
  setGameMode: (mode: 'speed' | 'turtle' | 'custom' | 'random') => void
  customWinningRank: number
  setCustomWinningRank: (rank: number) => void

  // ── 랜덤 레이스 ──
  // 컴퓨터가 무작위로 뽑은 당첨 등수 배열 (예: [3, 7] → 3등과 7등이 우승)
  randomWinningRanks: number[]
  setRandomWinningRanks: (ranks: number[]) => void
  
  isSkillEnabled: boolean
  setSkillEnabled: (enabled: boolean) => void

  // ── 스킬 로그 ──
  // 스킬 발동 내역을 시간순으로 저장 (최대 30개, 초과분은 오래된 것부터 제거)
  skillLogs: SkillLogEntry[]
  addSkillLog: (entry: SkillLogEntry) => void
  clearSkillLogs: () => void

  // ── 개별 쿨타임 ──
  // 각 마블의 스킬 쿨타임 진행률 (0.0 ~ 1.0). 키는 chipId
  skillCooldowns: Record<string, number>
  setSkillCooldowns: (cooldowns: Record<string, number>) => void
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
      
      globalSkin: '',
      setGlobalSkin: (globalSkin) => set({ globalSkin }),
      
      gameMode: 'speed',
      setGameMode: (gameMode) => set({ gameMode }),
      customWinningRank: 1,
      setCustomWinningRank: (customWinningRank) => set({ customWinningRank }),

      // ── 랜덤 레이스: 컴퓨터가 뽑은 당첨 등수 목록 ──
      randomWinningRanks: [],
      setRandomWinningRanks: (randomWinningRanks) => set({ randomWinningRanks }),
      isSkillEnabled: true,
      setSkillEnabled: (isSkillEnabled) => set({ isSkillEnabled }),

      // ── 스킬 로그: 최대 30개까지 유지하며, 초과 시 오래된 것부터 자동 제거 ──
      skillLogs: [],
      addSkillLog: (entry) => set((state) => {
        const MAX_LOGS = 30
        const newLogs = [...state.skillLogs, entry]
        // 30개 초과 시 앞쪽(가장 오래된) 로그를 잘라냄
        return { skillLogs: newLogs.length > MAX_LOGS ? newLogs.slice(-MAX_LOGS) : newLogs }
      }),
      clearSkillLogs: () => set({ skillLogs: [] }),

      // ── 개별 쿨타임: 워커로부터 매 프레임 갱신되는 진행률 맵 ──
      skillCooldowns: {},
      setSkillCooldowns: (skillCooldowns) => set({ skillCooldowns }),
    }),
    {
      name: 'rt-game-storage',
    }
  )
)
