'use client'

import { useGameStore } from '@/store/gameStore'
import { ParticipantRank } from '@/engine/RankingTracker'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, Medal, Award } from 'lucide-react'

interface LiveLeaderboardProps {
  rankings: ParticipantRank[]
  finishedFeed?: {rank: number, survivor: any}[]
}

export default function LiveLeaderboard({ rankings, finishedFeed = [] }: LiveLeaderboardProps) {
  const survivors = useGameStore(state => state.survivors)
  
  // Create a combined list
  // 1. Finished participants
  const finishedItems = finishedFeed.map(f => ({
    id: f.survivor.id,
    rank: f.rank,
    isFinished: true,
    survivor: f.survivor
  }))

  // Set to track who has finished
  const finishedIds = new Set(finishedItems.map(f => f.id))

  // 2. Active participants (filter out finished ones)
  // We re-calculate the display rank for active ones starting from finishedFeed.length + 1
  let activeRankOffset = finishedItems.length + 1;
  const activeItems = rankings
    .filter(p => !finishedIds.has(p.id))
    .map(p => {
      const survivor = survivors.find(s => s.id === p.id)
      return {
        id: p.id,
        rank: activeRankOffset++,
        isFinished: false,
        survivor: survivor || { id: p.id, name: p.id, color: '#ffffff' }
      }
    })

  const combinedRankings = [...finishedItems, ...activeItems]

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-[#FFD700]" />
    if (rank === 2) return <Medal className="w-5 h-5 text-[#C0C0C0]" />
    if (rank === 3) return <Medal className="w-5 h-5 text-[#CD7F32]" />
    return <Award className="w-5 h-5 text-[#00ffcc]" />
  }

  const getRankGradient = (rank: number) => {
    if (rank === 1) return "from-[#FFD700] to-[#FFA500]"
    if (rank === 2) return "from-[#E0E0E0] to-[#A0A0A0]"
    if (rank === 3) return "from-[#CD7F32] to-[#A0522D]"
    return "from-[#00ffcc] to-[#00b3ff]"
  }

  return (
    <div className="absolute top-6 right-6 z-50 flex flex-col gap-2 pointer-events-auto w-64 max-w-[40vw]">
      <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden custom-scrollbar pr-2 py-2 flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {combinedRankings.map((p) => {
            const isFinished = p.isFinished;
            const rankStr = isFinished ? `${p.rank}등` : p.rank;
            const color = p.survivor.color || '#fff';

            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                animate={{ 
                  opacity: 1, 
                  x: 0, 
                  scale: isFinished ? 1.02 : 1, 
                }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className={cn(
                  "relative flex items-center gap-4 px-5 py-3 rounded-2xl overflow-hidden shadow-lg border backdrop-blur-xl transition-all duration-300",
                  isFinished 
                    ? "bg-black/80 border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.5)] z-10" 
                    : "bg-black/40 border-white/10"
                )}
              >
                {/* Subtle Gradient Glow for Finished */}
                {isFinished && (
                  <div className={cn(
                    "absolute inset-0 opacity-10 bg-gradient-to-r",
                    getRankGradient(p.rank)
                  )} />
                )}

                {/* Left side: Icon or Rank Number */}
                <div className="shrink-0 flex items-center justify-center w-8">
                  {isFinished && p.rank <= 3 ? (
                    <div className={cn("drop-shadow-[0_0_8px_currentColor]")}>
                      {getRankIcon(p.rank)}
                    </div>
                  ) : (
                    <span className={cn(
                      "text-2xl font-black font-mono tracking-tighter drop-shadow-md",
                      isFinished 
                        ? (p.rank === 1 ? "text-[#FFD700]" : p.rank === 2 ? "text-[#C0C0C0]" : p.rank === 3 ? "text-[#CD7F32]" : "text-[#00ffcc]")
                        : "text-white/60"
                    )}>
                      {rankStr}
                    </span>
                  )}
                </div>

                {/* Right side: Name and Dot */}
                <div className="flex-1 flex items-center justify-between min-w-0">
                  <span className={cn(
                    "font-bold text-base truncate drop-shadow-sm flex-1 tracking-wide",
                    isFinished ? "text-white" : "text-white/80"
                  )}>
                    {p.survivor.name}
                  </span>
                  
                  {/* Player Color Dot */}
                  <div 
                    className={cn(
                      "w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] shrink-0 ml-3",
                      isFinished && "w-4 h-4 border-[1px] border-white/50"
                    )}
                    style={{ backgroundColor: color, color: color }} 
                  />
                </div>

                {/* Sleek locked badge */}
                {isFinished && p.rank > 3 && (
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-[#00ffcc] shadow-[0_0_15px_#00ffcc]" />
                )}
                {isFinished && p.rank <= 3 && (
                  <div className={cn(
                    "absolute right-0 top-0 bottom-0 w-1.5 shadow-[0_0_15px_currentColor]",
                    p.rank === 1 ? "bg-[#FFD700]" : p.rank === 2 ? "bg-[#C0C0C0]" : "bg-[#CD7F32]"
                  )} />
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
