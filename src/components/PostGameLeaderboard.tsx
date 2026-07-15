'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { Crown, Trophy, ChevronRight, Sparkles } from 'lucide-react'
import { stampService } from '@/lib/stampService'

interface PostGameLeaderboardProps {
  finishedFeed: { rank: number, survivor: any }[];
}

export default function PostGameLeaderboard({ finishedFeed }: PostGameLeaderboardProps) {
  const { gameMode, targetWinnerCount, customWinningRank, randomWinningRanks, survivors, fontFamily } = useGameStore()
  const { setGameStage } = useUIStore()

  // Helper to determine if a rank is a winner rank
  const isWinnerRank = (rank: number): boolean => {
    if (rank < 1) return false;
    switch (gameMode) {
      case 'speed': return rank <= targetWinnerCount;
      case 'custom': return rank === customWinningRank;
      case 'random': return randomWinningRanks.includes(rank);
      case 'turtle': {
        const losers = Math.max(0, survivors.length - targetWinnerCount);
        return rank >= losers;
      }
      default: return rank <= targetWinnerCount;
    }
  };

  const getOrdinalSuffix = (n: number) => {
    return `${n}위`;
  };

  const { winners, others } = useMemo(() => {
    const w: any[] = [];
    const o: any[] = [];
    finishedFeed.forEach((feed) => {
      if (isWinnerRank(feed.rank)) w.push(feed);
      else o.push(feed);
    });
    return { winners: w, others: o };
  }, [finishedFeed, gameMode, targetWinnerCount, customWinningRank, randomWinningRanks, survivors.length]);

  const totalPlayers = finishedFeed.length;
  let gridCols = 'grid-cols-1 md:grid-cols-2';
  if (others.length >= 12) gridCols = 'grid-cols-2 md:grid-cols-4';
  else if (others.length >= 6) gridCols = 'grid-cols-2 md:grid-cols-3';

  const headerText = gameMode === 'speed' ? '스피드 레이스 결과' : 
                     gameMode === 'turtle' ? '거북이 레이스 결과' :
                     gameMode === 'custom' ? '커스텀 레이스 결과' : '랜덤 레이스 결과';

  const handleReturnToLobby = () => {
    if (stampService) stampService.flushPlayEvents();
    setGameStage('dashboard');
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center pointer-events-none">
      {/* Background Dim - Darker and richer */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl pointer-events-auto"
      />

      {/* Main Leaderboard Modal */}
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`relative flex flex-col items-center bg-[#0a0a0c] bg-cover bg-center bg-no-repeat border border-white/10 rounded-2xl sm:rounded-[2.5rem] p-4 sm:p-6 md:p-8 shadow-[0_20px_80px_rgba(0,0,0,0.9)] pointer-events-auto w-[98vw] sm:w-[95vw] max-w-7xl mx-auto overflow-hidden ${totalPlayers > 5 ? 'h-[85vh]' : 'h-auto max-h-[90vh]'}`}
        style={{ fontFamily: fontFamily || 'inherit', backgroundImage: 'url("/images/assets/ui/premium_leaderboard_bg.png")' }}
      >
        {/* Dark overlay over the image to ensure text readability */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-none" />

        {/* Subtle top glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-50" />

        <h2 className="relative z-10 text-xl sm:text-3xl md:text-5xl font-black text-white/90 mb-2 sm:mb-4 drop-shadow-md text-center uppercase tracking-widest shrink-0 font-['Inter',sans-serif]">
          {headerText}
        </h2>

        <div className="relative z-10 flex flex-col w-full h-full overflow-hidden">
          {/* Winners Section */}
          <div className={`flex w-full justify-center gap-2 sm:gap-4 md:gap-6 mb-2 sm:mb-3 shrink-0 ${winners.length > 3 ? 'flex-wrap' : ''}`}>
            {winners.map((w, idx) => (
              <motion.div 
                key={w.survivor.id}
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + (idx * 0.15), type: 'spring', stiffness: 150, damping: 20 }}
                className={`group relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl sm:rounded-3xl backdrop-blur-2xl overflow-hidden transition-all duration-500 hover:scale-[1.03] ${winners.length === 1 ? 'w-32 h-36 sm:w-48 sm:h-52' : winners.length <= 3 ? 'w-28 h-32 sm:w-40 sm:h-44' : 'w-24 h-28 sm:w-36 sm:h-40'}`}
                style={{ 
                  background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%)`,
                  boxShadow: `0 8px 32px 0 rgba(0, 0, 0, 0.4), inset 0 1px 1px 0 rgba(255, 255, 255, 0.2), inset 0 0 0 1px rgba(255, 255, 255, 0.05)`
                }}
              >
                {/* Dynamic animated glow sweep */}
                <div 
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" 
                  style={{ background: `radial-gradient(circle at 50% 0%, ${w.survivor.color}30 0%, transparent 70%)` }} 
                />
                
                {/* Soft gradient border top */}
                <div 
                  className="absolute top-0 left-0 w-full h-[2px]" 
                  style={{ background: `linear-gradient(90deg, transparent, ${w.survivor.color}, transparent)`, opacity: 0.8 }} 
                />
                
                <div 
                  className={`relative flex items-center justify-center rounded-full mb-1 sm:mb-2 z-10 ${winners.length <= 2 ? 'w-10 h-10 sm:w-16 sm:h-16' : 'w-8 h-8 sm:w-12 sm:h-12'}`}
                  style={{ 
                    background: `linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))`,
                    boxShadow: `inset 0 1px 1px 0 rgba(255,255,255,0.3), 0 8px 16px 0 rgba(0,0,0,0.4)`
                  }}
                >
                  <div className="absolute inset-0 rounded-full blur-md opacity-40 transition-opacity duration-500 group-hover:opacity-70" style={{ backgroundColor: w.survivor.color }} />
                  {winners.length <= 2 ? (
                    <Crown className="w-7 h-7 sm:w-10 sm:h-10 z-10" style={{ color: '#ffffff', filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.5))` }} />
                  ) : (
                    <Trophy className="w-5 h-5 sm:w-7 sm:h-7 z-10" style={{ color: '#ffffff', filter: `drop-shadow(0 2px 4px rgba(0,0,0,0.5))` }} />
                  )}
                </div>
                
                <span className={`font-extrabold text-transparent bg-clip-text z-10 truncate w-full text-center ${winners.length <= 2 ? 'text-lg sm:text-2xl mb-1 sm:mb-2' : 'text-base sm:text-xl mb-0.5 sm:mb-1.5'}`}
                      style={{ backgroundImage: `linear-gradient(to bottom, #ffffff, rgba(255,255,255,0.6))` }}>
                  {w.survivor.name}
                </span>
                
                <div 
                  className="px-4 py-1 rounded-full z-10 backdrop-blur-md border border-white/10"
                  style={{ backgroundColor: `${w.survivor.color}15` }}
                >
                  <span className={`font-bold tracking-[0.2em] ${winners.length <= 2 ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-xs'}`} style={{ color: w.survivor.color }}>
                    {getOrdinalSuffix(w.rank)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Others Section (Rankings) */}
          <div className="flex-1 overflow-hidden flex flex-col w-full mx-auto gap-4 relative">
            {others.length > 0 && (
              <div className="flex items-center gap-6 w-full shrink-0 mb-1">
                <div className="h-[1px] bg-white/10 flex-1" />
                <h3 className="text-white/30 text-sm font-semibold tracking-[0.2em] text-center">최종 순위</h3>
                <div className="h-[1px] bg-white/10 flex-1" />
              </div>
            )}
            
            <div className={`grid w-full gap-1 sm:gap-1.5 md:gap-2 ${gridCols} flex-1 overflow-y-auto pr-1 sm:pr-2 scrollbar-hide content-start pb-2`}>
              {others.map((o, idx) => (
                <motion.div
                  key={o.survivor.id}
                  initial={{ x: -30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.8 + (idx * 0.05) }}
                  className="group flex items-center w-full bg-white/[0.01] hover:bg-white/[0.04] rounded-lg sm:rounded-xl border border-white/5 hover:border-white/10 transition-all duration-300 py-1 sm:py-1.5 px-2 sm:px-3 relative overflow-hidden"
                >
                  <span 
                    className="font-black w-8 sm:w-12 shrink-0 text-base sm:text-xl md:text-2xl transition-all duration-300 group-hover:scale-110 italic"
                    style={{ 
                      color: o.rank <= 3 ? '#ffffff' : 'rgba(255,255,255,0.85)',
                      textShadow: `0 2px 4px rgba(0,0,0,0.8), 0 0 ${Math.max(4, 15 - o.rank)}px ${o.survivor.color}${o.rank <= 5 ? 'ff' : '80'}`
                    }}
                  >
                    {o.rank}
                  </span>
                  
                  <div className="shrink-0 rounded-full mr-2 sm:mr-3 md:mr-4 w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 opacity-80 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_currentColor]" style={{ backgroundColor: o.survivor.color, color: o.survivor.color }} />
                  
                  <span className="font-bold text-white/70 group-hover:text-white truncate flex-1 text-base sm:text-xl md:text-[22px] leading-none pb-[1px] transition-colors">
                    {o.survivor.name}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* Action Button */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.6 }}
            className="w-full flex justify-center mt-2 sm:mt-3 shrink-0 pb-[env(safe-area-inset-bottom)]"
          >
            <button 
              onClick={handleReturnToLobby}
              className="group relative flex items-center gap-3 px-8 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-white/80 hover:text-white transition-all hover:-translate-y-1 active:scale-95 border border-white/10 hover:border-white/20 shadow-lg"
            >
              
              <Sparkles className="w-5 h-5 opacity-50 group-hover:opacity-100 transition-opacity" />
              <span className="font-semibold text-lg tracking-widest">로비로 복귀</span>
              <ChevronRight className="w-5 h-5 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
