'use client'

import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import Confetti from 'react-confetti'
import { saveResults } from '@/actions/db'
import { useEffect, useState } from 'react'

export default function ResultScreen() {
  const { survivors, sessionId } = useGameStore()
  const setGameStage = useUIStore(state => state.setGameStage)
  
  const [windowDim, setWindowDim] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 0, height: typeof window !== 'undefined' ? window.innerHeight : 0 })
  const [isSaved, setIsSaved] = useState(false)

  // Resize 렌더링 병목 완전히 제거됨 (초기 useState에서 처리)

  useEffect(() => {
    // 세션이 있고 생존자가 도출되었으며 아직 저장하지 않은 경우 DB에 최종 결과 기록
    if (sessionId && survivors.length > 0 && !isSaved) {
      saveResults(sessionId, survivors.map((s, idx) => ({ participantId: s.id, rank: idx + 1, score: 0 })))
        .then(() => setIsSaved(true))
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
      
      <div className="glass-panel-heavy p-8 md:p-12 rounded-3xl w-full flex flex-col items-center gap-8 shadow-2xl border-2 border-[var(--accent-primary)]/50 bg-black/60 backdrop-blur-md">
        <h1 className="text-5xl md:text-7xl font-outfit font-black italic text-glow-primary text-[var(--accent-primary)] uppercase tracking-widest text-center">
          Winner!
        </h1>
        
        <div className="flex flex-wrap justify-center gap-4 my-6">
          {survivors.map(winner => (
            <div key={winner.id} className="flex flex-col items-center gap-3 bg-white/10 px-8 py-6 rounded-2xl border border-white/20 hover:scale-105 transition-transform">
              <div className="w-16 h-16 rounded-full border-4 border-white shadow-[0_0_20px_rgba(255,255,255,0.5)]" style={{ backgroundColor: winner.color }}></div>
              <span className="text-2xl font-bold text-[var(--text-primary)] truncate-1-line max-w-[150px]">{winner.name}</span>
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
