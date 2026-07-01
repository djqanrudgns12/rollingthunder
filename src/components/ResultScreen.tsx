'use client'

import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import Confetti from 'react-confetti'
import { saveResults } from '@/actions/db'
import { stampService } from '@/lib/stampService'
import { useEffect, useState } from 'react'

export default function ResultScreen() {
  const { survivors, sessionId, gameMode } = useGameStore()
  const setGameStage = useUIStore(state => state.setGameStage)
  
  const [windowDim, setWindowDim] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 0, height: typeof window !== 'undefined' ? window.innerHeight : 0 })
  const [isSaved, setIsSaved] = useState(false)

  // Resize 렌더링 병목 완전히 제거됨 (초기 useState에서 처리)

  useEffect(() => {
    // 세션이 있고 생존자가 도출되었으며 아직 저장하지 않은 경우 DB에 최종 결과 기록
    if (sessionId && survivors.length > 0 && !isSaved) {
      saveResults(sessionId, survivors.map((s, idx) => ({ participantId: s.id, rank: idx + 1, score: 0 })))
        .then(() => {
          setIsSaved(true);
          stampService.flushPlayEvents();
        })
        .catch(e => console.error("Failed to save results", e))
    }
  }, [sessionId, survivors, isSaved])

  return (
    <div className="flex flex-col items-center justify-center w-full h-full max-w-3xl mx-auto p-4 z-10 relative">
      {windowDim.width > 0 && (
        <Confetti 
          width={windowDim.width} 
          height={windowDim.height} 
          colors={['#00e6b8', '#bf00ff', '#ffffff']} 
          recycle={true} 
          numberOfPieces={400} 
        />
      )}
      
      <div className="glass-panel-heavy p-8 md:p-12 rounded-3xl w-full flex flex-col items-center gap-6 shadow-2xl border-2 border-[#FFD700]/50 bg-black/60 backdrop-blur-md">
        <div className="flex flex-col items-center">
          <h1 className="text-6xl md:text-8xl font-outfit font-black italic uppercase tracking-widest text-center text-[#FFD700] drop-shadow-[0_0_15px_rgba(255,215,0,0.8)]" style={{ textShadow: '0 0 10px #FFD700, 0 0 20px #FFD700' }}>
            Victory!
          </h1>
          <span className="text-white/80 text-xl md:text-2xl font-bold mt-2 tracking-wider drop-shadow-md">
            {gameMode === 'speed' ? '스피드 레이스' : 
             gameMode === 'turtle' ? '거북이 레이스' : 
             gameMode === 'custom' ? '커스텀 레이스' : 
             gameMode === 'random' ? '랜덤 레이스' : gameMode}
          </span>
        </div>
        
        <div className="flex flex-wrap justify-center gap-4 my-4">
          {survivors.map(winner => (
            <div key={winner.id} className="flex items-center gap-3 bg-white/10 px-6 py-4 rounded-2xl border border-white/20 hover:scale-105 transition-transform">
              <div className="w-10 h-10 rounded-full border-[2px] border-white/50 shadow-[0_0_15px_currentColor]" style={{ backgroundColor: winner.color, color: winner.color }}></div>
              <span className="text-2xl font-black text-white drop-shadow-md truncate max-w-[200px]" style={{ color: winner.color || '#fff' }}>{winner.name}</span>
            </div>
          ))}
        </div>

        <button 
          onClick={() => setGameStage('dashboard')}
          className="bg-white/10 hover:bg-[var(--accent-primary)] hover:text-black text-[var(--text-primary)] font-bold px-8 py-4 rounded-xl transition-colors border border-white/20 truncate-1-line"
        >
          새로운 추첨 하러가기
        </button>
      </div>
    </div>
  )
}
