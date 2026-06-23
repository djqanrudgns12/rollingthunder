'use client'

import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { useState } from 'react'
import { createSession } from '@/actions/db'
import MapLoadModal from './MapLoadModal'
import { Tv, Shield, ShieldOff, Video, Map } from 'lucide-react'

// Simple Anonymizer Helper
const ANIMAL_NAMES = ['사자', '호랑이', '토끼', '고양이', '강아지', '독수리', '돌고래', '상어', '거북이', '알파카', '기린', '코끼리']
function getRandomAnimal() {
  return ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)] + Math.floor(Math.random() * 999)
}

export default function Dashboard() {
  const { participants, addParticipant, removeParticipant, clearParticipants, setGimmickDensity, gimmickDensity, setSurvivors, targetWinnerCount, setTargetWinnerCount, setSessionId, gameMode, setGameMode, customWinningRank, setCustomWinningRank } = useGameStore()
  const { setGameStage, customMapData, isBroadcasterMode, setBroadcasterMode, isAnonymized, setAnonymized } = useUIStore()
  
  const [nameInput, setNameInput] = useState('')
  const [skinInput, setSkinInput] = useState('')
  const [localWinnerCount, setLocalWinnerCount] = useState(targetWinnerCount || 1)
  const [title, setTitle] = useState('새로운 추첨')
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)

  const handleAdd = () => {
    if (!nameInput.trim()) return
    // Support parsing multiple inputs separated by comma or newline
    const names = nameInput.split(/[,\n]+/).map(n => n.trim()).filter(n => n !== '')
    names.forEach(name => {
      const newId = `chip-${Date.now()}-${Math.floor(Math.random()*1000)}`
      const finalName = isAnonymized ? getRandomAnimal() : name
      addParticipant({ id: newId, name: finalName, color: `hsl(${Math.random() * 360}, 80%, 50%)`, skinId: skinInput || undefined })
    })
    setNameInput('')
  }

  const handleStart = async () => {
    if (participants.length < 2) {
      alert('최소 2명 이상의 참가자가 필요합니다.')
      return
    }
    if (gameMode !== 'lucky' && localWinnerCount >= participants.length) {
      alert('당첨/생존자 수는 참가자 수보다 적어야 합니다.')
      return
    }

    // Set Chroma Key background if Broadcaster Mode is on
    // We no longer set document.body.style here. 
    // It's handled per-component to prevent green-screen bleeding to Dashboard.

    try {
      // Optimistic UI - Start game instantly, save session in background
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
      
      {/* Broadcaster Quick Actions */}
      <div className="absolute top-4 left-4 flex gap-2">
        <button 
          onClick={() => setBroadcasterMode(!isBroadcasterMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${isBroadcasterMode ? 'bg-green-500 text-black shadow-[0_0_20px_#00ff00]' : 'bg-black/50 text-white/50 hover:bg-black/80 hover:text-white'}`}
        >
          <Tv size={18} />
          <span>스트리머 모드 {isBroadcasterMode ? 'ON' : 'OFF'}</span>
        </button>
        <button 
          onClick={() => setAnonymized(!isAnonymized)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${isAnonymized ? 'bg-purple-500 text-white shadow-[0_0_20px_#a855f7]' : 'bg-black/50 text-white/50 hover:bg-black/80 hover:text-white'}`}
        >
          {isAnonymized ? <Shield size={18} /> : <ShieldOff size={18} />}
          <span>익명화 {isAnonymized ? 'ON' : 'OFF'}</span>
        </button>
      </div>

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
          
          <div className="flex gap-2 shrink-0">
            <button 
              onClick={() => setIsMapModalOpen(true)} 
              className="w-full bg-black/50 border border-white/10 hover:border-[var(--accent-primary)] text-white/80 font-bold px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2 group shadow-inner"
            >
              <Map className="w-5 h-5 group-hover:text-[var(--accent-primary)] transition-colors" />
              {customMapData ? '커스텀/기본 맵 적용됨 (클릭하여 변경)' : '맵 로드 (기본/커스텀)'}
            </button>
          </div>

          <div className="flex gap-2 shrink-0">
            <input 
              type="text" 
              placeholder="참가자 이름 (쉼표/공백 다중입력)" 
              className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-secondary)] transition-colors text-sm"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <select 
              className="bg-black/50 border border-white/10 rounded-xl px-2 py-3 text-[var(--text-primary)] focus:outline-none text-sm"
              value={skinInput}
              onChange={(e) => setSkinInput(e.target.value)}
            >
              <option value="">기본 스킨</option>
              <option value="UR_blackhole">[UR] 블랙홀</option>
              <option value="SR_cat">[SR] 야옹이</option>
            </select>
            <button onClick={handleAdd} className="bg-[var(--accent-secondary)] text-black font-bold px-5 py-3 rounded-xl hover:opacity-90 transition-opacity shrink-0">
              추가
            </button>
          </div>

          <div className="bg-black/40 rounded-xl border border-white/5 p-3 min-h-[80px] shrink-0 overflow-y-auto flex flex-wrap gap-2 shadow-inner">
            {participants.length === 0 && <p className="text-white/30 text-sm m-auto">참가자가 없습니다.</p>}
            {participants.map(p => (
              <div key={p.id} className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2 group relative backdrop-blur-sm">
                <div className="w-3 h-3 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: p.color, color: p.color }}></div>
                <span className="text-sm font-medium text-[var(--text-primary)] truncate-1-line max-w-[100px]">{p.name}</span>
                {p.skinId && <span className="text-[10px] text-yellow-400 font-bold ml-1">{p.skinId.split('_')[0]}</span>}
                <button onClick={() => removeParticipant(p.id)} className="text-white/30 hover:text-red-400 opacity-0 md:opacity-100 transition-opacity shrink-0 ml-1">×</button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4 mt-2 bg-black/20 p-4 rounded-xl border border-white/5 shrink-0">
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
                  onClick={() => setGameMode('lucky')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${gameMode === 'lucky' ? 'bg-purple-500 text-white shadow-[0_0_10px_#a855f7]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  행운의 등수
                </button>
              </div>
              
              {gameMode === 'lucky' && (
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
            </div>

            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-[var(--accent-primary)] font-bold tracking-widest uppercase">
                  {gameMode === 'speed' ? '당첨자 수 (명)' : gameMode === 'turtle' ? '최후의 생존자 수 (명)' : '당첨 등수 (등)'}
                </label>
                {gameMode === 'lucky' ? (
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
          <button onClick={clearParticipants} className="flex-1 bg-white/5 hover:bg-white/10 text-white/50 font-bold py-4 rounded-xl transition-colors border border-white/10">
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
