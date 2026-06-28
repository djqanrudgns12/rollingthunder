'use client'

import { useGameStore, Participant } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { useState, useEffect, useRef } from 'react'
import { createSession } from '@/actions/db'
import MapLoadModal, { DEFAULT_MAPS } from './MapLoadModal'
import { Tv, Shield, ShieldOff, Video, Map } from 'lucide-react'
import { toast } from 'sonner'

// Simple Anonymizer Helper
const ANIMAL_NAMES = ['사자', '호랑이', '토끼', '고양이', '강아지', '독수리', '돌고래', '상어', '거북이', '알파카', '기린', '코끼리']
function getRandomAnimal() {
  return ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)] + Math.floor(Math.random() * 999)
}

export default function Dashboard() {
  const { participants, addParticipant, removeParticipant, clearParticipants, setGimmickDensity, gimmickDensity, setSurvivors, targetWinnerCount, setTargetWinnerCount, setSessionId, gameMode, setGameMode, customWinningRank, setCustomWinningRank, globalSkin, setGlobalSkin, setParticipants, isSkillEnabled, setSkillEnabled, selectedMapPreset, setRandomWinningRanks, clearSkillLogs } = useGameStore()
  const { setGameStage, customMapData, customMapTitle, isBroadcasterMode, setBroadcasterMode, isAnonymized, setAnonymized } = useUIStore()
  
  const [nameInput, setNameInput] = useState('')

  const [localWinnerCount, setLocalWinnerCount] = useState(targetWinnerCount || 1)
  const [title, setTitle] = useState('새로운 추첨')
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)

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

  const handleSaveList = () => {
    if (participants.length === 0) {
      toast.error('저장할 참가자가 없습니다.')
      return
    }
    const names = participants.map(p => p.name).join(', ')
    localStorage.setItem('rt-saved-list', names)
    toast.success('현재 참가자 명단이 로컬에 저장되었습니다.')
  }

  const handleLoadList = () => {
    const saved = localStorage.getItem('rt-saved-list')
    if (!saved) {
      toast.error('저장된 명단이 없습니다.')
      return
    }
    setNameInput(saved)
    toast.success('저장된 명단을 불러왔습니다. 추가 버튼을 눌러주세요.')
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
        const session = await createSession(title)
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
      


      <div className={`p-5 md:p-8 rounded-3xl w-full max-w-2xl flex flex-col gap-4 shadow-2xl transition-all duration-500 max-h-[calc(100vh-2rem)] overflow-hidden ${isBroadcasterMode ? 'bg-black border-2 border-green-500' : 'glass-panel-heavy'}`}>
        {/* Header (Logo) - 항상 고정 */}
        <div className="text-center flex flex-col items-center shrink-0">
          <img src="/images/assets/brand_logo_masterpiece.png" alt="Rolling Thunder" className="w-48 mb-2 filter drop-shadow-[0_0_20px_rgba(0,255,204,0.3)] animate-pulse" />
          <p className="text-[var(--text-secondary)] text-sm">무작위 생존 추첨 시뮬레이션 - 마스터피스 에디션</p>
        </div>

        {/* Body (Forms) - 화면이 작을 때 스크롤 됨 */}
        <div className="flex flex-col gap-3 overflow-y-auto scrollbar-hide flex-1 pb-2">
          <div className="flex gap-2 shrink-0">
            <input 
              type="text" 
              placeholder="추첨 방 제목" 
              className="flex-[2] bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors truncate-1-line"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col gap-2 shrink-0">
            <button 
              onClick={() => setIsMapModalOpen(true)} 
              className="relative w-full overflow-hidden bg-black/40 backdrop-blur-md border border-white/10 hover:border-[var(--accent-primary)] rounded-xl transition-all duration-300 group shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_var(--accent-primary)] hover:scale-[1.01]"
            >
              {/* Animated gradient background on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/0 via-[var(--accent-primary)]/10 to-[var(--accent-primary)]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              
              <div className="relative p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[var(--accent-primary)] group-hover:bg-[var(--accent-primary)]/10 transition-colors">
                    <Map className="w-6 h-6 text-white/70 group-hover:text-[var(--accent-primary)] transition-colors" />
                  </div>
                  <div className="flex flex-col items-start">
                    <div className="flex items-center gap-2 mb-1">
                      {customMapData ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">커스텀 맵</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">기본 맵</span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white group-hover:text-[var(--accent-primary)] transition-colors text-shadow-sm truncate max-w-[200px] md:max-w-[300px]">
                      {customMapData ? (customMapTitle || '이름 없는 커스텀 맵') : (DEFAULT_MAPS.find(m => m.id === selectedMapPreset)?.title || '랜덤 맵')}
                    </h3>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-white/40 group-hover:text-[var(--accent-primary)] transition-colors">
                  <span className="text-xs font-bold uppercase tracking-wider hidden md:block">변경하기</span>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[var(--accent-primary)]/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="flex gap-2 shrink-0 items-stretch">
            <textarea 
              placeholder="참가자 이름 (쉼표/공백/줄바꿈 다중입력)" 
              className="flex-[3] bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-secondary)] transition-colors text-sm resize-none scrollbar-hide"
              rows={2}
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
            <div className="flex flex-col gap-2 shrink-0 w-28">
              <button onClick={handleAdd} className="flex-[2] bg-[var(--accent-secondary)] text-black font-bold rounded-xl hover:opacity-90 transition-opacity text-sm shadow-[0_0_15px_rgba(0,255,204,0.3)] min-h-[40px]">
                추가
              </button>
              <div className="flex gap-1 flex-1 min-h-[24px]">
                <button onClick={handleSaveList} className="flex-1 bg-white/10 text-white/70 font-bold rounded-lg hover:bg-white/20 hover:text-white transition-colors text-[10px] border border-white/5" title="현재 참가자 명단을 저장합니다">
                  저장
                </button>
                <button onClick={handleLoadList} className="flex-1 bg-white/10 text-white/70 font-bold rounded-lg hover:bg-white/20 hover:text-white transition-colors text-[10px] border border-white/5" title="저장된 명단을 입력창으로 불러옵니다">
                  불러오기
                </button>
              </div>
            </div>
          </div>

          <div className="bg-black/40 rounded-xl border border-white/5 p-3 min-h-[80px] shrink-0 overflow-y-auto flex flex-wrap gap-2 shadow-inner">
            {participants.length === 0 && <p className="text-white/30 text-sm m-auto">참가자가 없습니다.</p>}
            {participants.map(p => (
              <div key={p.id} className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2 group relative backdrop-blur-sm">
                <div className="w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: p.color, color: p.color }}></div>
                <span className="text-sm font-medium text-[var(--text-primary)] truncate-1-line max-w-[100px]">{p.name}</span>
                {p.skinId && !p.skinId.startsWith('chip_base') && <span className="text-[10px] text-yellow-400 font-bold ml-1">{p.skinId.replace('UR_', '').replace('SR_', '')}</span>}
                <button onClick={() => handleRemoveParticipant(p.id)} className="text-white/30 hover:text-red-400 opacity-0 md:opacity-100 transition-opacity shrink-0 ml-1">×</button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 mt-2 bg-black/20 p-4 rounded-xl border border-white/5 shrink-0">
            {/* 스킨 일괄 설정 및 스킬 사용 여부 */}
            <div className="flex flex-col gap-3 border-b border-white/5 pb-4">
              <div className="flex justify-between items-center">
                <label className="text-xs text-white/50 font-bold tracking-widest uppercase">참가자 스킨 일괄 적용 (Skin Settings)</label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50 font-bold tracking-widest uppercase">스킬 (Skills)</span>
                  <button 
                    onClick={() => setSkillEnabled(!isSkillEnabled)}
                    className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${isSkillEnabled ? 'bg-[var(--accent-primary)]' : 'bg-white/20'}`}
                  >
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black transition-transform duration-300 ${isSkillEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
              <select 
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none text-sm w-full"
                value={globalSkin}
                onChange={(e) => handleSkinChange(e.target.value)}
              >
                <option value="">기본 포커칩 (무작위 6종)</option>
                <option value="horse">경주마</option>
                <option value="spaceship">우주선</option>
                <option value="shuriken">표창</option>
                <option value="car">자동차</option>
                <option value="blackhole">[UR] 블랙홀</option>
                <option value="cat">[SR] 야옹이</option>
              </select>
            </div>

            {/* 게임 모드 설정 */}
            <div className="flex flex-col gap-3 border-b border-white/5 pb-4">
              <label className="text-xs text-white/50 font-bold tracking-widest uppercase">게임 모드 (Game Mode)</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setGameMode('speed')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${gameMode === 'speed' ? 'bg-[var(--accent-primary)] text-black shadow-[0_0_10px_var(--accent-primary)]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  스피드 레이스
                </button>
                <button 
                  onClick={() => setGameMode('turtle')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${gameMode === 'turtle' ? 'bg-[var(--accent-secondary)] text-black shadow-[0_0_10px_var(--accent-secondary)]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  거북이 레이스
                </button>
                <button 
                  onClick={() => setGameMode('custom')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${gameMode === 'custom' ? 'bg-purple-500 text-white shadow-[0_0_10px_#a855f7]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  커스텀 레이스
                </button>
                <button 
                  onClick={() => setGameMode('random')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${gameMode === 'random' ? 'bg-orange-500 text-white shadow-[0_0_10px_#f97316]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  랜덤 레이스
                </button>
              </div>
              
              {gameMode === 'custom' && (
                <div className="flex items-center gap-3 bg-black/40 p-3 rounded-lg border border-purple-500/30 animate-in fade-in slide-in-from-top-2">
                  <span className="text-sm text-purple-300 font-bold">몇 번째로 들어온 사람을 당첨시킬까요?</span>
                  <div className="flex items-center bg-black rounded-lg overflow-hidden border border-white/10 ml-auto">
                    <button onClick={() => setCustomWinningRank(Math.max(1, customWinningRank - 1))} className="px-3 py-1 hover:bg-white/10 text-white/70">-</button>
                    <input 
                      type="number" 
                      value={customWinningRank}
                      onChange={(e) => setCustomWinningRank(Math.max(1, Number(e.target.value)))}
                      className="w-12 bg-transparent text-center text-white font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button onClick={() => setCustomWinningRank(customWinningRank + 1)} className="px-3 py-1 hover:bg-white/10 text-white/70">+</button>
                  </div>
                </div>
              )}

              {gameMode === 'random' && (
                <div className="flex items-center gap-3 bg-black/40 p-3 rounded-lg border border-orange-500/30 animate-in fade-in slide-in-from-top-2">
                  <span className="text-sm text-orange-300 font-bold">🎲 컴퓨터가 당첨 등수를 랜덤으로 결정합니다</span>
                  <span className="text-xs text-orange-400/60 ml-auto">(시작 시 공개)</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[var(--accent-primary)] font-bold tracking-widest uppercase">
                  {gameMode === 'speed' ? '당첨자 수 (명)' : gameMode === 'turtle' ? '최후의 생존자 수 (명)' : gameMode === 'random' ? '당첨자 수 (명)' : '당첨 등수 (등)'}
                </label>
                {gameMode === 'custom' ? (
                  <div className="flex items-center bg-black/50 rounded-xl overflow-hidden border border-white/10 mt-1">
                    <input 
                      type="number" 
                      value={customWinningRank}
                      readOnly
                      className="w-full bg-transparent text-center text-purple-300 font-mono text-xl py-3 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div className="flex items-center bg-black/50 rounded-xl overflow-hidden border border-white/10 mt-1">
                    <button onClick={() => setLocalWinnerCount(Math.max(1, localWinnerCount - 1))} className="flex-1 py-3 hover:bg-white/10 text-white/70 text-xl font-bold transition-colors">-</button>
                    <input 
                      type="number" 
                      min={1} 
                      max={Math.max(1, participants.length - 1)}
                      value={localWinnerCount}
                      onChange={(e) => setLocalWinnerCount(Number(e.target.value))}
                      className="w-16 bg-transparent text-center text-[var(--text-primary)] font-mono text-xl focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button onClick={() => setLocalWinnerCount(Math.min(Math.max(1, participants.length - 1), localWinnerCount + 1))} className="flex-1 py-3 hover:bg-white/10 text-white/70 text-xl font-bold transition-colors">+</button>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs text-[var(--accent-secondary)] font-bold tracking-widest uppercase">Gimmick Density (기믹 밀도)</label>
                  <span className="text-xs text-white/70 font-mono bg-white/10 px-2 py-0.5 rounded-md">{gimmickDensity}%</span>
                </div>
                <input 
                  type="range" 
                  min={10} 
                  max={90}
                  value={gimmickDensity}
                  onChange={(e) => setGimmickDensity(Number(e.target.value))}
                  className="accent-[var(--accent-secondary)] mt-3 cursor-pointer"
                />
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
    </div>
  )
}
