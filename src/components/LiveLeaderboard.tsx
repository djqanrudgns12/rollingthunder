'use client'

import { useGameStore } from '@/store/gameStore'
import { ParticipantRank } from '@/engine/RankingTracker'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { useSpring, animated } from '@react-spring/web'
import { useEffect } from 'react'

interface LiveLeaderboardProps {
  rankings: ParticipantRank[]
}

export default function LiveLeaderboard({ rankings }: LiveLeaderboardProps) {
  const survivors = useGameStore(state => state.survivors)
  // 상위 5명만 표출하여 시야 확보 (화면 비율 원칙)
  const topRankings = rankings.slice(0, 5)

  // 1등 변경 시 물리 기반 바운스 효과
  const [springs, api] = useSpring(() => ({
    scale: 1,
    x: 0,
    config: { tension: 400, friction: 15 }
  }))

  useEffect(() => {
    if (topRankings[0]?.id) {
      api.start({
        from: { scale: 1.15, x: -15 },
        to: { scale: 1, x: 0 }
      })
    }
  }, [topRankings[0]?.id, api])

  return (
    <animated.div style={springs} className="absolute top-4 left-4 z-50 flex flex-col gap-2 pointer-events-none w-48 max-w-[40vw]">
      <AnimatePresence>
        {topRankings.map((p) => (
          <motion.div
            key={p.id}
            layout
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="glass-panel px-4 py-2.5 flex items-center gap-3 shadow-lg"
          >
            <span className={cn(
              "text-lg font-bold font-mono text-glow-primary shrink-0",
              p.rank === 1 ? "text-[#FFD700]" : 
              p.rank === 2 ? "text-[#C0C0C0]" : 
              p.rank === 3 ? "text-[#CD7F32]" : "text-[var(--text-secondary)]"
            )}>
              {p.rank}
            </span>
            <span className="text-[var(--text-primary)] font-medium text-sm truncate-1-line flex-1">
              {survivors.find(s => s.id === p.id)?.name || p.id}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </animated.div>
  )
}
