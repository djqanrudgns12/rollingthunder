'use client'

import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { useState } from 'react'
import { createSession } from '@/actions/db'
import { supabase } from '@/lib/supabase'
import { Tv, Shield, ShieldOff, Video } from 'lucide-react'

// Simple Anonymizer Helper
const ANIMAL_NAMES = ['사자', '호랑이', '토끼', '고양이', '강아지', '독수리', '돌고래', '상어', '거북이', '알파카', '기린', '코끼리']
function getRandomAnimal() {
  return ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)] + Math.floor(Math.random() * 999)
}

export default function Dashboard() {
  const { participants, addParticipant, removeParticipant, clearParticipants, setGimmickDensity, gimmickDensity, setSurvivors, setTargetSurvivalCount, setSessionId } = useGameStore()
  const { setGameStage, setCustomMapData, customMapData, isBroadcasterMode, setBroadcasterMode, isAnonymized, setAnonymized } = useUIStore()
  
  const [nameInput, setNameInput] = useState('')
  const [skinInput, setSkinInput] = useState('')
  const [mapCode, setMapCode] = useState('')
  const [survivalCount, setLocalSurvivalCount] = useState(1)
  const [title, setTitle] = useState('새로운 추첨')

  const handleAdd = () => {
    if (!nameInput.trim()) return
    // Support parsing multiple inputs separated by comma or space
    const names = nameInput.split(/[, \n]+/).filter(n => n.trim() !== '')
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
    if (survivalCount >= participants.length) {
      alert('생존자 수는 참가자 수보다 적어야 합니다.')
      return
    }

    // Set Chroma Key background if Broadcaster Mode is on
    if (isBroadcasterMode) {
      document.body.style.backgroundColor = '#00ff00'
      document.body.style.backgroundImage = 'none'
    }

    try {
      // Optimistic UI - Start game instantly, save session in background
      setSurvivors(participants)
      setTargetSurvivalCount(survivalCount)
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

      <div className={`p-6 md:p-8 rounded-3xl w-full max-w-2xl flex flex-col gap-6 shadow-2xl transition-all duration-500 ${isBroadcasterMode ? 'bg-black border-2 border-green-500' : 'glass-panel-heavy'}`}>
        <div className="text-center flex flex-col items-center">
          <img src="/images/assets/brand_logo_masterpiece.png" alt="Rolling Thunder" className="w-64 mb-2 filter drop-shadow-[0_0_20px_rgba(0,255,204,0.3)] animate-pulse" />
          <p className="text-[var(--text-secondary)] text-sm">무작위 생존 추첨 시뮬레이션 - 마스터피스 에디션</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="추첨 방 제목" 
              className="flex-[2] bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors truncate-1-line"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="커스텀 맵 공유 코드 (선택)" 
              className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[var(--accent-primary)] font-bold focus:outline-none focus:border-[var(--accent-primary)] transition-colors uppercase"
              value={mapCode}
              onChange={(e) => setMapCode(e.target.value)}
              maxLength={6}
            />
            <button 
              onClick={async () => {
                if(!mapCode.trim()) return;
                const { data, error } = await supabase.from('map_presets').select('map_data, title').eq('share_code', mapCode.toUpperCase()).single()
                if(error || !data) {
                  alert('유효하지 않은 맵 코드입니다.')
                  return
                }
                setCustomMapData(data.map_data)
                alert(`[${data.title}] 맵을 성공적으로 적용했습니다!`)
              }} 
              className="bg-purple-600/30 text-purple-300 border border-purple-500/50 font-bold px-6 py-3 rounded-xl hover:bg-purple-600/50 transition-colors shrink-0"
            >
              {customMapData ? '맵 적용됨' : '맵 로드'}
            </button>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="참가자 이름 (쉼표나 공백으로 다중 입력 가능)" 
              className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-secondary)] transition-colors"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <select 
              className="bg-black/50 border border-white/10 rounded-xl px-2 py-3 text-[var(--text-primary)] focus:outline-none"
              value={skinInput}
              onChange={(e) => setSkinInput(e.target.value)}
            >
              <option value="">기본 스킨</option>
              <option value="UR_blackhole">[UR] 블랙홀</option>
              <option value="SR_cat">[SR] 야옹이</option>
            </select>
            <button onClick={handleAdd} className="bg-[var(--accent-secondary)] text-black font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity shrink-0">
              추가
            </button>
          </div>

          <div className="bg-black/40 rounded-xl border border-white/5 p-4 min-h-[120px] max-h-[200px] overflow-y-auto flex flex-wrap gap-2 shadow-inner">
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

          <div className="grid grid-cols-2 gap-6 mt-2 bg-black/20 p-4 rounded-xl border border-white/5">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--accent-primary)] font-bold tracking-widest uppercase">Target Survivors</label>
              <input 
                type="number" 
                min={1} 
                max={Math.max(1, participants.length - 1)}
                value={survivalCount}
                onChange={(e) => setLocalSurvivalCount(Number(e.target.value))}
                className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-[var(--text-primary)] font-mono text-xl focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--accent-secondary)] font-bold tracking-widest uppercase">Gimmick Density</label>
              <input 
                type="range" 
                min={10} 
                max={90}
                value={gimmickDensity}
                onChange={(e) => setGimmickDensity(Number(e.target.value))}
                className="accent-[var(--accent-secondary)] mt-3"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-2">
          <button onClick={clearParticipants} className="flex-1 bg-white/5 hover:bg-white/10 text-white/50 font-bold py-4 rounded-xl transition-colors border border-white/10">
            초기화
          </button>
          <button onClick={handleStart} className="flex-[3] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-black font-extrabold text-xl tracking-widest py-4 rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_30px_var(--accent-primary)] flex items-center justify-center gap-3">
            <Video className="animate-pulse" />
            GAME START
          </button>
        </div>
      </div>
    </div>
  )
}
