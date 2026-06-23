'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { SkillType } from '@/engine/SkillSystem'

interface SkillEventOverlayProps {
  activeSkill: { chipId: string; skill: SkillType } | null;
}

const SKILL_CONFIG: Record<SkillType, { name: string; color: string; icon: string }> = {
  tank: { name: '탱크 모드', color: 'hsl(35, 100%, 50%)', icon: '🛡️' },
  booster: { name: '슈퍼 부스터', color: 'hsl(170, 100%, 50%)', icon: '🚀' },
  slime: { name: '슬라임 화', color: 'hsl(120, 100%, 40%)', icon: '🟢' },
  ghost: { name: '유령화', color: 'hsl(280, 80%, 75%)', icon: '👻' },
  magnet: { name: '자석 모드', color: 'hsl(0, 100%, 65%)', icon: '🧲' },
  teleport: { name: '순간 이동', color: 'hsl(300, 100%, 65%)', icon: '⚡' },
  none: { name: '', color: '', icon: '' },
}

export default function SkillEventOverlay({ activeSkill }: SkillEventOverlayProps) {
  if (!activeSkill || activeSkill.skill === 'none') return null;
  const config = SKILL_CONFIG[activeSkill.skill];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center bg-black/50 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.2, y: 50, rotate: -15 }}
          animate={{ scale: 1, y: 0, rotate: 0 }}
          exit={{ scale: 1.5, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 15 }}
          className="flex flex-col items-center justify-center gap-5"
        >
          <div 
            className="text-8xl md:text-9xl filter drop-shadow-2xl"
            style={{ textShadow: `0 0 50px ${config.color}` }}
          >
            {config.icon}
          </div>
          <div className="glass-panel-heavy px-10 py-4 flex flex-col items-center border-t-4" style={{ borderTopColor: config.color }}>
            <span className="text-[var(--text-primary)] font-mono text-sm md:text-base font-medium mb-1 truncate-1-line max-w-[200px]">
              {activeSkill.chipId.replace('chip-', '참가자 ')}
            </span>
            <span 
              className="text-3xl md:text-5xl font-black italic tracking-widest uppercase"
              style={{ color: config.color, textShadow: `0 0 20px ${config.color}` }}
            >
              {config.name}
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
