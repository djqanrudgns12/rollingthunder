'use client'

import { useGameStore, Participant } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { useState, useEffect, useRef } from 'react'
import { createSession } from '@/actions/db'
import MapLoadModal, { DEFAULT_MAPS } from './MapLoadModal'
import ListManagerModal from './ListManagerModal'
import SettingsModal from './SettingsModal'
import { Tv, Shield, ShieldOff, Video, Map, Circle, Car, Rocket, Zap, Cat, Target, Volume2, VolumeX, Settings } from 'lucide-react'
import { toast } from 'sonner'

// Skin Preview Helper Component
function SkinPreviewIcon({ skinId }: { skinId: string }) {
  switch (skinId) {
    case 'horse': return <Zap className="w-5 h-5" />
    case 'spaceship': return <Rocket className="w-5 h-5" />
    case 'shuriken': return <Target className="w-5 h-5" />
    case 'car': return <Car className="w-5 h-5" />
    case 'blackhole': return <Circle className="w-5 h-5 animate-spin" />
    case 'cat': return <Cat className="w-5 h-5" />
    default: return <Circle className="w-5 h-5" />
  }
}

// Simple Anonymizer Helper
const ANIMAL_NAMES = ['사자', '호랑이', '토끼', '고양이', '강아지', '독수리', '돌고래', '상어', '거북이', '알파카', '기린', '코끼리']
function getRandomAnimal() {
  return ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)] + Math.floor(Math.random() * 999)
}

export default function Dashboard() {
  const { participants, addParticipant, removeParticipant, clearParticipants, setGimmickDensity, gimmickDensity, setSurvivors, targetWinnerCount, setTargetWinnerCount, setSessionId, gameMode, setGameMode, customWinningRank, setCustomWinningRank, globalSkin, setGlobalSkin, setParticipants, isSkillEnabled, setSkillEnabled, selectedMapPreset, setRandomWinningRanks, clearSkillLogs, isMuted, setMuted } = useGameStore()
  const { setGameStage, customMapData, customMapTitle, isBroadcasterMode, setBroadcasterMode, isAnonymized, setAnonymized, setGameTitle } = useUIStore()
  
  const [nameInput, setNameInput] = useState('')

  const [localWinnerCount, setLocalWinnerCount] = useState(targetWinnerCount || 1)
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)
  const [isListModalOpen, setIsListModalOpen] = useState(false)

  // Undo/Redo states
  const [undoStack, setUndoStack] = useState<{ participants: Participant[], nameInput: string }[]>([])
  const [redoStack, setRedoStack] = useState<{ participants: Participant[], nameInput: string }[]>([])
  const isTypingRef = useRef(false)
  
  const stateRef = useRef({ participants, nameInput, undoStack, redoStack })
  useEffect(() => {
    stateRef.current = { participants, nameInput, undoStack, redoStack }
  }, [participants, nameInput, undoStack, redoStack])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isZ = e.key.toLowerCase() === 'z'
      const isY = e.key.toLowerCase() === 'y'

      if (e.ctrlKey && (isZ || isY)) {
        // If the user is actively typing, let native browser undo handle text changes
        if (isTypingRef.current && document.activeElement?.tagName === 'INPUT') {
          return
        }

        if (isZ) {
          const { participants, nameInput, undoStack } = stateRef.current
          if (undoStack.length > 0) {
            e.preventDefault()
            const prevState = undoStack[undoStack.length - 1]
            setRedoStack(prev => [...prev, { participants, nameInput }])
            setUndoStack(prev => prev.slice(0, -1))
            
            setParticipants(prevState.participants)
            setNameInput(prevState.nameInput)
            isTypingRef.current = false
          }
        }

        if (isY) {
          const { participants, nameInput, redoStack } = stateRef.current
          if (redoStack.length > 0) {
            e.preventDefault()
            const nextState = redoStack[redoStack.length - 1]
            setUndoStack(prev => [...prev, { participants, nameInput }])
            setRedoStack(prev => prev.slice(0, -1))
            
            setParticipants(nextState.participants)
            setNameInput(nextState.nameInput)
            isTypingRef.current = false
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setParticipants])

  const saveStateForUndo = (currentParticipants: Participant[], currentNameInput: string) => {
    setUndoStack(prev => {
      const newStack = [...prev, { participants: currentParticipants, nameInput: currentNameInput }]
      return newStack.length > 50 ? newStack.slice(-50) : newStack
    })
    setRedoStack([])
  }

  // Sync local state when Zustand store hydrates from localStorage
  useEffect(() => {
    setLocalWinnerCount(targetWinnerCount || 1)
  }, [targetWinnerCount])

  const handleSkinChange = (newSkin: string) => {
    setGlobalSkin(newSkin)
    setParticipants(participants.map(p => ({
      ...p,
      skinId: newSkin === '' ? `chip_base_${Math.floor(Math.random() * 6) + 1}` : newSkin
    })))
  }

  const handleAdd = () => {
    if (!nameInput.trim()) return
    
    saveStateForUndo(participants, nameInput)
    isTypingRef.current = false

    // Support parsing multiple inputs separated by comma, newline, or spaces
    const names = nameInput.split(/[,\s]+/).map(n => n.trim()).filter(n => n !== '')
    const newParticipants = [...participants]
    names.forEach(name => {
      const newId = `chip-${crypto.randomUUID()}`
      const finalName = isAnonymized ? getRandomAnimal() : name
      
      // 스킨 일괄 설정에 따라 배정
      const finalSkinId = globalSkin === '' ? `chip_base_${Math.floor(Math.random() * 6) + 1}` : globalSkin
      
      newParticipants.push({ id: newId, name: finalName, color: `hsl(${Math.random() * 360}, 80%, 50%)`, skinId: finalSkinId })
    })
    setParticipants(newParticipants)
    setNameInput('')
  }

  const handleRemoveParticipant = (id: string) => {
    saveStateForUndo(participants, nameInput)
    isTypingRef.current = false
    removeParticipant(id)
  }

  const handleClearParticipants = () => {
    saveStateForUndo(participants, nameInput)
    isTypingRef.current = false
    clearParticipants()
  }

  const handleStart = async () => {
    if (participants.length < 2) {
      toast.error('최소 2명 이상의 참가자가 필요합니다.')
      return
    }
    if (gameMode !== 'custom' && localWinnerCount >= participants.length) {
      toast.error('당첨/생존자 수는 참가자 수보다 적어야 합니다.')
      return
    }

    // 랜덤 모드일 때: 1~참가자수 범위에서 겨치지 않는 등수를 당첨자수만큼 무작위 추출
    if (gameMode === 'random') {
      const totalParticipants = participants.length
      const count = localWinnerCount
      // Fisher-Yates 셔플로 1~N 중 count개 배열 추출
      const pool = Array.from({ length: totalParticipants }, (_, i) => i + 1)
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]]
      }
      const picked = pool.slice(0, count).sort((a, b) => a - b)
      setRandomWinningRanks(picked)
    }

    // Set Chroma Key background if Broadcaster Mode is on
    // We no longer set document.body.style here. 
    // It's handled per-component to prevent green-screen bleeding to Dashboard.

    try {
      // Optimistic UI - Start game instantly, save session in background
      clearSkillLogs()
      setSurvivors(participants)
      setTargetWinnerCount(localWinnerCount)
      setGameStage('playing')

      let sid = null;
      try {
        const finalTitle = '롤링 썬더!'
        setGameTitle(finalTitle)
        const session = await createSession(finalTitle)
        if (session) sid = session.id
        setSessionId(sid)
      } catch {
        console.log("Guest mode. Skipping DB session creation.")
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center w-full min-h-screen p-4 z-10 transition-colors duration-500 ${isBroadcasterMode ? 'bg-[#00ff00]' : 'bg-transparent'}`}>
      
      {/* 화면 우측 상단 전역 유틸리티 버튼 (BGM, 설정) */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8 flex gap-3 z-50">
        <button
          onClick={() => {
            const next = !isMuted;
            setMuted(next);
            import('@/engine/AudioEngine').then(({ soundManager }) => soundManager.setMuted(next));
          }}
          className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/20 transition-all hover:scale-110 shadow-lg group"
        >
          {isMuted ? <VolumeX className="w-6 h-6 text-white/50" /> : <Volume2 className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] group-hover:text-cyan-300" />}
        </button>
        <button
          onClick={() => useUIStore.getState().setActiveModal('settings')}
          className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/20 transition-all hover:scale-110 shadow-lg group"
        >
          <Settings className="w-6 h-6 text-white/70 group-hover:text-white" />
        </button>
      </div>

      <div className={`p-5 md:p-8 rounded-3xl w-full max-w-2xl flex flex-col gap-4 shadow-2xl transition-all duration-500 max-h-[calc(100vh-2rem)] overflow-hidden ${isBroadcasterMode ? 'bg-black border-2 border-green-500' : 'glass-panel-heavy'}`}>
        {/* Header (Text Logo) - 항상 고정 */}
        <div className="relative text-center flex flex-col items-center shrink-0 mb-6 animate-in fade-in slide-in-from-top-4 w-full">
          <div className="flex items-center justify-center gap-3 md:gap-4">
            <img 
              src="/custom-icon.png" 
              alt="Rolling Thunder Icon" 
              className="h-12 md:h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(0,255,255,0.5)] transition-transform duration-300 hover:rotate-6 hover:scale-110"
            />
            <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)] pr-2">
              ROLLING THUNDER
            </h1>
          </div>
          <p className="text-lg font-bold mt-2 text-cyan-300 text-shadow-sm animate-pulse">오늘 우리 자웅을 가리자!</p>
        </div>

        {/* Body (Forms) - 화면이 작을 때 스크롤 됨 */}
        <div className="flex flex-col gap-3 overflow-y-auto scrollbar-hide flex-1 pb-2">
          
          {/* 그룹 1: 기본 설정 (맵) */}
          <div className="flex gap-3 shrink-0 flex-col md:flex-row bg-black/20 p-4 rounded-2xl border border-white/5">
            <button 
              onClick={() => setIsMapModalOpen(true)} 
              className="relative w-full overflow-hidden bg-black/40 backdrop-blur-md border border-white/10 hover:border-[var(--accent-primary)] rounded-xl transition-all duration-300 group shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_var(--accent-primary)] hover:scale-[1.01]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/0 via-[var(--accent-primary)]/10 to-[var(--accent-primary)]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              <div className="relative px-4 py-3 flex items-center justify-between h-full">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[var(--accent-primary)] group-hover:bg-[var(--accent-primary)]/10 transition-colors shrink-0">
                    <Map className="w-4 h-4 text-white/70 group-hover:text-[var(--accent-primary)] transition-colors" />
                  </div>
                  <div className="flex flex-col items-start">
                    <h3 className="text-sm font-bold text-white group-hover:text-[var(--accent-primary)] transition-colors text-shadow-sm truncate max-w-[150px]">
                      {customMapData ? (customMapTitle || '이름 없는 커스텀 맵') : (DEFAULT_MAPS.find(m => m.id === selectedMapPreset)?.title || '랜덤 맵')}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-white/40 group-hover:text-[var(--accent-primary)] transition-colors">
                  <span className="text-xs font-bold uppercase tracking-wider hidden md:block whitespace-nowrap">변경</span>
                  <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[var(--accent-primary)]/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* 그룹 2: 게임 모드 설정 */}
          <div className="flex flex-col gap-4 bg-black/20 p-4 rounded-2xl border border-white/5 shrink-0">
            <div className="flex flex-col gap-3 pb-3 border-b border-white/5">
              <label className="text-xs text-white/50 font-bold tracking-widest uppercase whitespace-nowrap">게임 모드 (GAME MODE)</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setGameMode('speed')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${gameMode === 'speed' ? 'bg-[var(--accent-primary)] text-black shadow-[0_0_10px_var(--accent-primary)]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  스피드
                </button>
                <button 
                  onClick={() => setGameMode('turtle')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${gameMode === 'turtle' ? 'bg-[var(--accent-secondary)] text-black shadow-[0_0_10px_var(--accent-secondary)]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  거북이
                </button>
                <button 
                  onClick={() => setGameMode('custom')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${gameMode === 'custom' ? 'bg-purple-500 text-white shadow-[0_0_10px_#a855f7]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  커스텀
                </button>
                <button 
                  onClick={() => setGameMode('random')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${gameMode === 'random' ? 'bg-orange-500 text-white shadow-[0_0_10px_#f97316]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  랜덤
                </button>
              </div>
              
              <div className="animate-in fade-in slide-in-from-top-2 text-xs text-white/40 font-medium whitespace-nowrap mt-1">
                {gameMode === 'speed' && '💡 먼저 결승선을 통과한 참가자가 승리합니다.'}
                {gameMode === 'turtle' && '💡 가장 늦게 결승선을 통과한 참가자가 승리합니다.'}
                {gameMode === 'custom' && '💡 지정한 등수로 들어온 참가자가 당첨됩니다.'}
                {gameMode === 'random' && '💡 컴퓨터가 당첨 등수를 무작위로 결정합니다.'}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--accent-primary)] font-bold tracking-widest uppercase whitespace-nowrap">
                {gameMode === 'speed' ? '당첨자 수 (명)' : gameMode === 'turtle' ? '최후의 생존자 (명)' : gameMode === 'random' ? '당첨자 수 (명)' : '당첨 등수 (등)'}
              </label>
              {gameMode === 'custom' ? (
                <div className="flex items-center bg-black/50 rounded-xl overflow-hidden border border-white/10">
                  <button onClick={() => setCustomWinningRank(Math.max(1, customWinningRank - 1))} className="w-16 py-3 hover:bg-white/10 text-white/70 text-xl font-bold transition-colors">-</button>
                  <input 
                    type="number" 
                    value={customWinningRank}
                    onChange={(e) => setCustomWinningRank(Math.max(1, Number(e.target.value)))}
                    className="flex-1 bg-transparent text-center text-purple-300 font-mono text-xl py-2 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => setCustomWinningRank(customWinningRank + 1)} className="w-16 py-3 hover:bg-white/10 text-white/70 text-xl font-bold transition-colors">+</button>
                </div>
              ) : (
                <div className="flex items-center bg-black/50 rounded-xl overflow-hidden border border-white/10">
                  <button onClick={() => setLocalWinnerCount(Math.max(1, localWinnerCount - 1))} className="w-16 py-3 hover:bg-white/10 text-white/70 text-xl font-bold transition-colors">-</button>
                  <input 
                    type="number" 
                    min={1} 
                    max={Math.max(1, participants.length - 1)}
                    value={localWinnerCount}
                    onChange={(e) => setLocalWinnerCount(Number(e.target.value))}
                    className="flex-1 bg-transparent text-center text-[var(--text-primary)] font-mono text-xl py-2 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => setLocalWinnerCount(Math.min(Math.max(1, participants.length - 1), localWinnerCount + 1))} className="w-16 py-3 hover:bg-white/10 text-white/70 text-xl font-bold transition-colors">+</button>
                </div>
              )}
            </div>
          </div>

          {/* 그룹 3: 인게임 요소 (1줄 배치) */}
          <div className="flex flex-row items-center justify-between gap-4 bg-black/20 p-4 rounded-2xl border border-white/5 shrink-0 overflow-x-auto custom-scrollbar">
            
            {/* 스킬 */}
            <div className="flex flex-col gap-2 shrink-0 flex-1 min-w-[80px]">
              <label className="text-xs text-[var(--accent-secondary)] font-bold tracking-widest uppercase whitespace-nowrap">스킬 (SKILLS)</label>
              <div className="flex items-center h-[38px]">
                <button 
                  onClick={() => setSkillEnabled(!isSkillEnabled)}
                  className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${isSkillEnabled ? 'bg-[var(--accent-primary)]' : 'bg-white/20'}`}
                >
                  <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-black transition-transform duration-300 shadow-sm ${isSkillEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* 장애물 밀도 */}
            <div className="flex flex-col gap-2 shrink-0 flex-[2] min-w-[160px] px-4 border-l border-white/10">
              <div className="flex justify-between items-center">
                <label className="text-xs text-[var(--accent-secondary)] font-bold tracking-widest uppercase whitespace-nowrap">장애물 밀도 (OBSTACLES)</label>
                <span className="text-[10px] text-[var(--accent-secondary)] font-mono bg-black/50 px-2 py-0.5 rounded-lg border border-white/10 ml-2 whitespace-nowrap">{gimmickDensity}%</span>
              </div>
              <div className="flex items-center h-[38px] pt-1">
                <input 
                  type="range" 
                  min={10} 
                  max={90}
                  value={gimmickDensity}
                  onChange={(e) => setGimmickDensity(Number(e.target.value))}
                  className="w-full neon-slider"
                />
              </div>
            </div>

            {/* 참가자 스킨 */}
            <div className="flex flex-col gap-2 shrink-0 flex-[1.5] min-w-[160px] pl-4 border-l border-white/10">
              <label className="text-xs text-[var(--accent-primary)] font-bold tracking-widest uppercase whitespace-nowrap">참가자 스킨 (SKINS)</label>
              <div className="flex items-center gap-2 h-[38px]">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)] flex items-center justify-center shadow-[0_0_10px_var(--accent-primary)] text-[var(--accent-primary)] shrink-0">
                  <SkinPreviewIcon skinId={globalSkin} />
                </div>
                <select 
                  className="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-[var(--accent-primary)] text-[11px] font-bold tracking-wide transition-colors flex-1 min-w-0 h-[32px]"
                  value={globalSkin}
                  onChange={(e) => handleSkinChange(e.target.value)}
                >
                  <option value="">포커칩 (랜덤)</option>
                  <option value="horse">경주마</option>
                  <option value="spaceship">우주선</option>
                  <option value="shuriken">표창</option>
                  <option value="car">자동차</option>
                  <option value="blackhole">[UR] 블랙홀</option>
                  <option value="cat">[SR] 고양이</option>
                </select>
              </div>
            </div>

          </div>

          {/* 그룹 4: 참가자 입력 및 목록 */}
          <div className="flex flex-col gap-3 bg-black/20 p-4 rounded-2xl border border-white/5 shrink-0">
            <div className="flex gap-2 items-stretch">
              <textarea 
                placeholder="참가자 이름 (쉼표/공백/줄바꿈 다중입력)" 
                className="flex-[3] bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-secondary)] transition-colors text-sm resize-none scrollbar-hide h-[52px]"
                value={nameInput}
                onChange={(e) => {
                  setNameInput(e.target.value)
                  isTypingRef.current = true
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
              />
              <div className="flex gap-2 shrink-0">
                <button onClick={handleAdd} className="w-16 bg-[var(--accent-secondary)] text-black font-bold rounded-xl hover:opacity-90 transition-opacity text-sm shadow-[0_0_15px_rgba(0,255,204,0.3)] whitespace-nowrap">
                  추가
                </button>
                <button onClick={() => setIsListModalOpen(true)} className="w-16 bg-white/10 text-white/70 font-bold rounded-xl hover:bg-white/20 hover:text-white transition-colors text-xs border border-white/5 whitespace-nowrap" title="명단 관리">
                  명단
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {participants.length > 0 && (
                <div className="text-xs font-bold text-[var(--accent-primary)] px-1 whitespace-nowrap">
                  참가자 명단 (현재 {participants.length}명)
                </div>
              )}
              <div className="bg-black/40 rounded-xl border border-white/5 p-2.5 min-h-[80px] max-h-[160px] overflow-y-auto flex flex-wrap gap-1.5 shadow-inner content-start">
                {participants.length === 0 && <p className="text-white/30 text-sm m-auto">참가자가 없습니다.</p>}
                {participants.map(p => (
                  <div key={p.id} className="bg-white/5 hover:bg-white/15 border border-white/10 rounded-full px-2.5 py-1 flex items-center gap-1.5 group relative backdrop-blur-sm transition-colors cursor-default">
                    <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor] shrink-0" style={{ backgroundColor: p.color, color: p.color }}></div>
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[75px] leading-none mt-[1px] block">{p.name}</span>
                    <button onClick={() => handleRemoveParticipant(p.id)} className="text-white/30 hover:text-red-400 opacity-0 md:opacity-100 transition-opacity shrink-0 ml-0.5 text-[10px] leading-none w-3 h-3 flex items-center justify-center">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Footer (Buttons) - 항상 고정 */}
        <div className="flex gap-4 shrink-0 pt-2 border-t border-white/10">
          <button onClick={handleClearParticipants} className="flex-1 bg-white/5 hover:bg-white/10 text-white/50 font-bold py-4 rounded-xl transition-colors border border-white/10">
            초기화
          </button>
          <button onClick={handleStart} className="flex-[3] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-black font-extrabold text-xl tracking-widest py-4 rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_30px_var(--accent-primary)] flex items-center justify-center gap-3">
            <Video className="animate-pulse" />
            GAME START
          </button>
        </div>
      </div>
      <MapLoadModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} />
      <ListManagerModal 
        isOpen={isListModalOpen} 
        onClose={() => setIsListModalOpen(false)} 
        currentParticipants={participants}
        onLoadList={(names) => setNameInput(names)}
      />
      <SettingsModal />
    </div>
  )
}
