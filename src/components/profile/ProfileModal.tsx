'use client'

import { useUIStore } from '@/store/uiStore'
import ProfileCard from './ProfileCard'
import { UserProfile } from '@/types/user'
import { motion, AnimatePresence } from 'framer-motion'

export default function ProfileModal() {
  const activeModal = useUIStore((state) => state.activeModal)
  const userProfile = useUIStore((state) => state.userProfile) as UserProfile | null

  if (activeModal !== 'profile') return null;

  // 널이거나 비로그인 상태일 때 사용할 게스트 프로필 생성
  const profile: UserProfile = userProfile || {
    id: 'guest',
    role: 'guest',
    username: 'GUEST',
    chips_balance: 0,
    created_at: new Date().toISOString(),
    total_games_played: 0,
    achievements_completed: 0,
    total_achievements: 0,
    avatar_id: null,
  } as any

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm overflow-y-auto"
      >
        <div className="min-h-full flex items-center justify-center">
          <ProfileCard profile={profile} />
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
