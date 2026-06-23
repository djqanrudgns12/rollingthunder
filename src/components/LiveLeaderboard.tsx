'use client'

import { useGameStore } from '@/store/gameStore'
import { ParticipantRank } from '@/engine/RankingTracker'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
// import removed
import { useEffect } from 'react'

interface LiveLeaderboardProps {
  rankings: ParticipantRank[]
}

export default function LiveLeaderboard({ rankings }: LiveLeaderboardProps) {
  const survivors = useGameStore(state => state.survivors)
  // 상위 5명만 표출하여 시야 확보 (화면 비율 원칙)
  const topRankings = rankings.slice(0, 5)

  return (
    <div className="absolute top-4 left-4 z-50 flex flex-col gap-2 pointer-events-none w-48 max-w-[40vw]">
      <AnimatePresence mode="popLayout">
        {topRankings.map((p) => (
          <motion.div
            key={p.id}
            layout
            initial={{ opacity: 0, x: -20, scale: 0.8 }}
            animate={{ 
              opacity: 1, 
              x: 0, 
              scale: p.rank === 1 ? 1.05 : 1, // 1st place is slightly larger
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className={cn(
              "px-4 py-2.5 flex items-center gap-3 shadow-lg rounded-xl backdrop-blur-md border",
              p.rank === 1 ? "bg-white/20 border-[#FFD700]/50" : "bg-black/40 border-white/10"
            )}
          >
            <span className={cn(
              "text-lg font-bold font-mono shrink-0 drop-shadow-md",
              p.rank === 1 ? "text-[#FFD700]" : 
              p.rank === 2 ? "text-[#C0C0C0]" : 
              p.rank === 3 ? "text-[#CD7F32]" : "text-[var(--text-secondary)]"
            )}>
              {p.rank}
            </span>
            <span className={cn(
              "font-medium text-sm truncate-1-line flex-1 drop-shadow-sm",
              p.rank === 1 ? "text-white font-bold" : "text-[var(--text-primary)]"
            )}>
              {survivors.find(s => s.id === p.id)?.name || p.id}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
