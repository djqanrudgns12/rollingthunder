'use client'

import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'

export default function GachaPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ tier: string; itemId: string } | null>(null)
  const [isShaking, setIsShaking] = useState(false)

  const handlePullGacha = async () => {
    setLoading(true)
    setResult(null)
    setIsShaking(true)

    try {
      const res = await fetch('/api/gacha', { method: 'POST' })
      const data = await res.json()
      
      if (data.success) {
        // 서버 응답 후 캡슐 쉐이킹 연출 유지 (1.5초 딜레이)
        setTimeout(() => {
          setIsShaking(false)
          setResult(data.reward)
          setLoading(false)
          
          // 폭발 이펙트 분기 처리
          if (data.reward.tier === 'UR') {
            fireConfetti(['#facc15', '#f59e0b', '#b45309']) // Gold
          } else if (data.reward.tier === 'SR') {
            fireConfetti(['#fb7185', '#e11d48', '#9f1239']) // Red/Rose
          } else if (data.reward.tier === 'R') {
            fireConfetti(['#60a5fa', '#2563eb', '#1e3a8a']) // Blue
          }
        }, 1500)
      } else {
        toast.error('가챠 실패: ' + data.error)
        setIsShaking(false)
        setLoading(false)
      }
    } catch (err) {
      console.error(err)
      setIsShaking(false)
      setLoading(false)
    }
  }

  const fireConfetti = (colors: string[]) => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: colors,
      zIndex: 100
    })
  }

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'UR': return 'text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,1)]'
      case 'SR': return 'text-rose-400 drop-shadow-[0_0_30px_rgba(251,113,133,1)]'
      case 'R': return 'text-blue-400 drop-shadow-[0_0_30px_rgba(96,165,250,1)]'
      default: return 'text-slate-300 drop-shadow-[0_0_15px_rgba(203,213,225,0.6)]'
    }
  }

  const getTierBg = (tier: string) => {
    switch (tier) {
      case 'UR': return 'bg-yellow-500/10 border-yellow-500/50 shadow-[inset_0_0_50px_rgba(250,204,21,0.2)]'
      case 'SR': return 'bg-rose-500/10 border-rose-500/50 shadow-[inset_0_0_50px_rgba(251,113,133,0.2)]'
      case 'R': return 'bg-blue-500/10 border-blue-500/50 shadow-[inset_0_0_50px_rgba(96,165,250,0.2)]'
      default: return 'bg-slate-500/10 border-slate-500/50 shadow-[inset_0_0_50px_rgba(203,213,225,0.1)]'
    }
  }

  return (
    <main className="flex-1 w-full h-[100dvh] overflow-hidden bg-[#050505] flex flex-col items-center justify-center p-4 relative">
      <Link href="/" className="absolute top-6 left-6 text-white/50 hover:text-white transition-colors flex items-center gap-2 z-50">
        <ArrowLeft className="w-5 h-5" /> 메인으로
      </Link>
      
      {/* 동적 앰비언트 백그라운드 블러 효과 */}
      <motion.div 
        animate={{ 
          scale: result ? 1.2 : 1,
          opacity: result ? 0.3 : 0.1,
          backgroundColor: result?.tier === 'UR' ? '#eab308' : result?.tier === 'SR' ? '#e11d48' : '#9333ea'
        }}
        transition={{ duration: 1 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] blur-[150px] rounded-full pointer-events-none" 
      />

      <div className="glass-panel-heavy p-8 md:p-12 flex flex-col items-center gap-8 border border-[var(--accent-primary)]/20 rounded-3xl z-10 backdrop-blur-3xl max-w-md w-full shadow-[0_0_50px_rgba(147,51,234,0.1)]">
        
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-outfit text-glow-primary text-[var(--accent-primary)] mb-2 uppercase font-black tracking-widest italic flex items-center justify-center gap-2">
            GACHA <Sparkles className="w-8 h-8 text-yellow-400" />
          </h1>
          <p className="text-[var(--text-secondary)] text-sm tracking-widest">
            SERVER-SIDE RNG SECURED
          </p>
        </div>

        {/* 결과 표시 스크린 (언박싱 영역) */}
        <div className="w-full h-64 bg-black/80 rounded-3xl border border-white/5 flex items-center justify-center relative overflow-hidden shadow-inner">
          <AnimatePresence mode="wait">
            {isShaking ? (
              <motion.div
                key="shaking"
                animate={{
                  x: [0, -10, 10, -10, 10, -5, 5, 0],
                  y: [0, -5, 5, -5, 5, -2, 2, 0],
                  scale: [1, 0.95, 1.05, 1],
                  filter: ['brightness(1)', 'brightness(1.5)', 'brightness(1)'],
                }}
                transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 shadow-[0_0_40px_rgba(168,85,247,0.8)] border-4 border-white/50 flex items-center justify-center relative"
              >
                <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
                <Sparkles className="w-10 h-10 text-white animate-spin-slow" />
              </motion.div>
            ) : result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.2, rotate: -45 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", damping: 12, stiffness: 100 }}
                className={`flex flex-col items-center justify-center w-full h-full ${getTierBg(result.tier)} transition-colors duration-500`}
              >
                <motion.span 
                  initial={{ y: 20 }}
                  animate={{ y: 0 }}
                  className={`text-7xl font-black mb-4 font-outfit italic ${getTierColor(result.tier)}`}
                >
                  {result.tier}
                </motion.span>
                <motion.span 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-white text-xl font-bold bg-white/10 px-8 py-3 rounded-full border border-white/30 tracking-widest backdrop-blur-md shadow-lg"
                >
                  {result.itemId}
                </motion.span>
              </motion.div>
            ) : (
              <motion.div 
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] border border-white/10 flex items-center justify-center"
              >
                <span className="text-white/20 font-bold tracking-widest text-sm">INSERT COIN</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 뽑기 버튼 */}
        <button 
          onClick={handlePullGacha}
          disabled={loading}
          className="w-full py-5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xl hover:scale-[1.03] hover:shadow-[0_0_30px_rgba(147,51,234,0.6)] active:scale-95 transition-all disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100 flex items-center justify-center gap-2"
        >
          {loading ? 'ANALYZING RNG...' : 'PULL 1x (100 COIN)'}
        </button>
      </div>
    </main>
  )
}
