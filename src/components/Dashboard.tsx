'use client'

import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { useState } from 'react'
import { createSession } from '@/actions/db'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const { participants, addParticipant, removeParticipant, clearParticipants, setGimmickDensity, gimmickDensity, setSurvivors, setTargetSurvivalCount, setSessionId } = useGameStore()
  const { setGameStage, setCustomMapData, customMapData } = useUIStore()
  
  const [nameInput, setNameInput] = useState('')
  const [skinInput, setSkinInput] = useState('')
  const [mapCode, setMapCode] = useState('')
  const [survivalCount, setLocalSurvivalCount] = useState(1)
  const [title, setTitle] = useState('새로운 추첨')

  const handleAdd = () => {
    if (!nameInput.trim()) return
    const newId = `chip-${Date.now()}`
    addParticipant({ id: newId, name: nameInput.trim(), color: `hsl(${Math.random() * 360}, 80%, 50%)`, skinId: skinInput || undefined })
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

    try {
      // DB 세션 생성 (권한 오류 시 통과하여 게스트 모드 지원)
      let sid = null;
      try {
        const session = await createSession(title)
        if (session) sid = session.id
      } catch {
        console.log("Guest mode. Skipping DB session creation.")
      }
      
      setSessionId(sid)
      setSurvivors(participants) // 첫 스테이지 시작 전, 모든 참가자를 생존자로 취급
      setTargetSurvivalCount(survivalCount)
      setGameStage('playing')
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full max-w-2xl mx-auto p-4 z-10">
      <div className="glass-panel-heavy p-6 md:p-8 rounded-3xl w-full flex flex-col gap-6 shadow-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-outfit font-black text-glow-primary text-[var(--accent-primary)] uppercase tracking-wider mb-2 truncate-1-line">Rolling Thunder</h1>
          <p className="text-[var(--text-secondary)] text-sm truncate-1-line">무작위 생존 추첨 시뮬레이션</p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="추첨 방 제목" 
              className="flex-[2] bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors truncate-1-line"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          
          {/* 맵 공유 코드 불러오기 영역 */}
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="커스텀 맵 공유 코드 (선택)" 
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-[var(--accent-primary)] font-bold focus:outline-none focus:border-[var(--accent-primary)] transition-colors truncate-1-line uppercase"
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
              className="bg-purple-600/30 text-purple-300 border border-purple-500/50 font-bold px-6 py-3 rounded-xl hover:bg-purple-600/50 transition-colors truncate-1-line shrink-0"
            >
              {customMapData ? '맵 적용됨' : '맵 로드'}
            </button>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="참가자 이름 입력" 
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-secondary)] transition-colors truncate-1-line"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <select 
              className="bg-black/30 border border-white/10 rounded-xl px-2 py-3 text-[var(--text-primary)] focus:outline-none"
              value={skinInput}
              onChange={(e) => setSkinInput(e.target.value)}
            >
              <option value="">기본 스킨</option>
              <option value="UR_blackhole">[UR] 블랙홀</option>
              <option value="SR_cat">[SR] 야옹이</option>
            </select>
            <button onClick={handleAdd} className="bg-[var(--accent-secondary)] text-black font-bold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity truncate-1-line shrink-0">
              추가
            </button>
          </div>

          <div className="bg-black/20 rounded-xl border border-white/5 p-4 min-h-[120px] max-h-[200px] overflow-y-auto flex flex-wrap gap-2">
            {participants.length === 0 && <p className="text-white/30 text-sm m-auto">참가자가 없습니다.</p>}
            {participants.map(p => (
              <div key={p.id} className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 flex items-center gap-2 group relative">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }}></div>
                <span className="text-sm font-medium text-[var(--text-primary)] truncate-1-line max-w-[100px]">{p.name}</span>
                {p.skinId && <span className="text-[10px] text-yellow-400 font-bold ml-1">{p.skinId.split('_')[0]}</span>}
                <button onClick={() => removeParticipant(p.id)} className="text-white/30 hover:text-red-400 opacity-0 md:opacity-100 transition-opacity shrink-0">×</button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--text-secondary)] font-medium truncate-1-line">최종 생존자 수</label>
              <input 
                type="number" 
                min={1} 
                max={Math.max(1, participants.length - 1)}
                value={survivalCount}
                onChange={(e) => setLocalSurvivalCount(Number(e.target.value))}
                className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-[var(--text-primary)] focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[var(--text-secondary)] font-medium truncate-1-line">기믹 밀도 (난이도)</label>
              <input 
                type="range" 
                min={10} 
                max={90}
                value={gimmickDensity}
                onChange={(e) => setGimmickDensity(Number(e.target.value))}
                className="accent-[var(--accent-primary)] mt-2"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-4">
          <button onClick={clearParticipants} className="flex-1 bg-white/5 hover:bg-white/10 text-[var(--text-primary)] font-bold py-4 rounded-xl transition-colors border border-white/10 truncate-1-line">
            초기화
          </button>
          <button onClick={handleStart} className="flex-[2] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-black font-extrabold text-lg py-4 rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_20px_var(--accent-primary)] truncate-1-line">
            게임 시작
          </button>
        </div>
      </div>
    </div>
  )
}
