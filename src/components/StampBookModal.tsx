'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { stampService, UserMission } from '@/lib/stampService'
import { useChipStore } from '@/store/chipStore'
import { useUIStore } from '@/store/uiStore'

export default function StampBookModal() {
  const { activeModal, setActiveModal, setHasClaimableMissions } = useUIStore()
  const { addChipsLocally } = useChipStore()
  
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'achievement'>('daily')
  const [missions, setMissions] = useState<UserMission[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  
  // 탭별 알림 뱃지 상태
  const [hasClaimableDaily, setHasClaimableDaily] = useState(false)
  const [hasClaimableWeekly, setHasClaimableWeekly] = useState(false)
  const [hasClaimableAchiev, setHasClaimableAchiev] = useState(false)
  
  // 스탬프 이펙트용 상태
  const [stampEffect, setStampEffect] = useState<{ id: string, x: number, y: number } | null>(null)

  useEffect(() => {
    if (activeModal === 'listManager') {
        // We will repurpose activeModal, but maybe add a new modal type 'stampBook'
        // For now, if we use listManager or another, let's just render.
        // Wait, I should add 'stampBook' to UI store. Let's do that later. 
        // Assume activeModal === 'stampBook' is used.
    }
    
    const init = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        
        try {
          // 미션이 아직 할당되지 않았을 경우를 대비해 랜덤 미션 할당 호출
          await stampService.assignMissions(user.id);
          await loadMissions(user.id, activeTab);
          await updateTabBadges(user.id);
        } catch (err: any) {
          setErrorMsg('DB 연결 오류가 발생했습니다. 마이그레이션이 적용되었는지 확인해 주세요.');
          console.error(err);
        }
      } else {
        setErrorMsg('로그인이 필요한 기능입니다.');
      }
      setIsLoading(false);
    }
    init()
  }, [activeModal, activeTab])

  const updateTabBadges = async (uid: string) => {
    try {
      const [daily, weekly, achievements] = await Promise.all([
        stampService.getUserMissions(uid, 'daily'),
        stampService.getUserMissions(uid, 'weekly'),
        stampService.getUserAchievements(uid)
      ]);
      const dailyClaimable = daily.some(m => m.completed && !m.is_collected);
      const weeklyClaimable = weekly.some(m => m.completed && !m.is_collected);
      const achievClaimable = achievements.some(m => m.completed && !m.is_collected);
      
      setHasClaimableDaily(dailyClaimable);
      setHasClaimableWeekly(weeklyClaimable);
      setHasClaimableAchiev(achievClaimable);
      setHasClaimableMissions(dailyClaimable || weeklyClaimable || achievClaimable);
    } catch(e) {
      console.error(e)
    }
  }

  const loadMissions = async (uid: string, type: string) => {
    try {
      if (type === 'achievement') {
        const data = await stampService.getUserAchievements(uid)
        setMissions(data)
      } else {
        const data = await stampService.getUserMissions(uid, type as 'daily' | 'weekly')
        setMissions(data)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleClaim = async (mission: UserMission, event: React.MouseEvent) => {
    if (!userId || !mission.completed || mission.is_collected) return;
    
    // 이펙트 좌표 기록 (클릭한 버튼 중앙)
    const rect = (event.target as HTMLElement).getBoundingClientRect()
    setStampEffect({
      id: mission.id,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    })

    try {
      const tableType = (mission.mission.type === 'achievement' || mission.mission.type === 'hidden') 
                        ? 'achievement' : 'mission';
      const res = await stampService.claimReward(userId, tableType, mission.id);
      
      // 로컬 스토어 칩 업데이트 (안전성 검사 강화)
      if (res && typeof res.chips === 'number' && res.chips > 0) {
        addChipsLocally(res.chips);
      }
      
      // UI 업데이트
      setMissions(prev => prev.map(m => m.id === mission.id ? { ...m, is_collected: true } : m));
      
      // 다른 탭에 수령 가능한 보상이 남아있는지 확인하여 전역 알림 및 탭 알림 상태 갱신
      setTimeout(async () => {
        if (userId) {
          await updateTabBadges(userId);
        }
      }, 500);

      setTimeout(() => {
        setStampEffect(null)
      }, 1000)
    } catch (e) {
      console.error(e)
      setStampEffect(null)
    }
  }

  if (activeModal !== 'stampBook' as any) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-4xl h-[80vh] flex flex-col rounded-xl overflow-hidden shadow-2xl"
        style={{
          // 가죽 질감 느낌의 배경 (CSS 패턴)
          backgroundColor: '#3e2723',
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M20 20.5V18H0v-2h20v-2H0v-2h20v-2H0V8h20V6H0V4h20V2H0V0h22v20h2V0h2v20h2V0h2v20h2V0h2v20h2V0h2v20h2v2H20v-1.5zM0 20h2v20H0V20zm4 0h2v20H4V20zm4 0h2v20H8V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20zm4 0h2v20h-2V20z' fill='%232d1c19' fill-opacity='0.4' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          border: '4px solid #5d4037',
          boxShadow: 'inset 0 0 50px rgba(0,0,0,0.8), 0 20px 50px rgba(0,0,0,0.5)'
        }}
      >
        {/* 금박 로고 영역 */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-80 pointer-events-none">
           <div className="w-12 h-12 rounded-full border-2 border-[#d4af37] flex items-center justify-center mb-1 shadow-[0_0_10px_#d4af37]">
             <span className="text-[#d4af37] font-serif text-2xl">R</span>
           </div>
           <span className="text-[#d4af37] text-xs font-serif tracking-widest uppercase">Passport</span>
        </div>

        {/* 닫기 버튼 */}
        <button 
          onClick={() => setActiveModal('none')}
          className="absolute top-4 right-4 text-[#d4af37] hover:text-white transition-colors z-20 bg-black/40 rounded-full p-2"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 탭 헤더 */}
        <div className="flex z-10 mt-20 px-8 gap-4 border-b border-[#d4af37]/30">
          {(['daily', 'weekly', 'achievement'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative px-6 py-3 font-bold text-lg transition-all rounded-t-lg ${
                activeTab === tab 
                  ? 'bg-[#efefef] text-[#3e2723] shadow-[0_-5px_15px_rgba(0,0,0,0.3)]' 
                  : 'text-[#d4af37] hover:bg-white/10'
              }`}
            >
              {tab === 'daily' ? '일일 미션' : tab === 'weekly' ? '주간 미션' : '업적'}
              {/* 탭별 뱃지 */}
              {tab === 'daily' && hasClaimableDaily && (
                <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-[#efefef] animate-pulse"></span>
              )}
              {tab === 'weekly' && hasClaimableWeekly && (
                <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-[#efefef] animate-pulse"></span>
              )}
              {tab === 'achievement' && hasClaimableAchiev && (
                <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-[#efefef] animate-pulse"></span>
              )}
            </button>
          ))}
        </div>

        {/* 메인 콘텐츠 영역 (종이 질감) */}
        <div className="flex-1 bg-[#fdfbf7] m-4 mt-0 rounded-b-lg rounded-tr-lg p-6 overflow-y-auto shadow-inner relative"
             style={{ backgroundImage: 'radial-gradient(#e5e0d8 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          
          <div className="space-y-4 max-w-3xl mx-auto">
            {isLoading ? (
              <div className="text-center py-20 text-gray-400 font-bold">로딩 중...</div>
            ) : errorMsg ? (
              <div className="text-center py-20 text-red-400 font-bold">{errorMsg}</div>
            ) : missions.length === 0 ? (
              <div className="text-center py-20 text-gray-400 font-bold">진행 가능한 미션이 없습니다.</div>
            ) : (
              missions.map(m => (
                <div key={m.id} className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  m.is_collected ? 'bg-gray-100 border-gray-300 opacity-60' : 
                  m.completed ? 'bg-amber-50 border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.3)]' : 
                  'bg-white border-gray-200'
                }`}>
                  <div className="flex-1">
                    <h3 className={`text-xl font-black ${m.completed && !m.is_collected ? 'text-amber-700' : 'text-gray-800'}`}>
                      {m.mission.title}
                    </h3>
                    <p className="text-sm text-gray-600 font-medium">{m.mission.description}</p>
                    
                    {/* 네온 프로그레스 바 */}
                    <div className="mt-3 w-full max-w-md h-3 bg-gray-200 rounded-full overflow-hidden relative">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (m.progress / m.mission.goal_amount) * 100)}%` }}
                        className={`absolute top-0 left-0 h-full rounded-full ${
                          m.completed ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gradient-to-r from-blue-400 to-blue-600'
                        }`}
                        style={{
                          boxShadow: m.completed ? '0 0 10px rgba(251,191,36,0.8)' : '0 0 10px rgba(59,130,246,0.5)'
                        }}
                      />
                    </div>
                    <div className="text-xs font-bold text-gray-500 mt-1">
                      {m.progress} / {m.mission.goal_amount}
                    </div>
                  </div>

                  <div className="ml-4 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-1 font-black text-lg text-amber-600 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                      <span className="text-xl">💰</span> {m.mission.reward_chips.toLocaleString()}
                    </div>
                    {m.mission.reward_item_type && (
                       <div className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded">
                         +{m.mission.reward_item_type.toUpperCase()}
                       </div>
                    )}
                    
                    <button
                      disabled={!m.completed || m.is_collected}
                      onClick={(e) => handleClaim(m, e)}
                      className={`px-6 py-2 rounded-lg font-bold text-white transition-all ${
                        m.is_collected ? 'bg-gray-400 cursor-not-allowed' :
                        m.completed ? 'bg-amber-500 hover:bg-amber-600 hover:scale-105 shadow-md active:scale-95' :
                        'bg-gray-300 cursor-not-allowed text-gray-500'
                      }`}
                    >
                      {m.is_collected ? '수령 완료' : m.completed ? '보상 받기' : '진행 중'}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>

      {/* 스탬프 애니메이션 오버레이 */}
      <AnimatePresence>
        {stampEffect && (
          <motion.div
            initial={{ scale: 3, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: -5 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            className="fixed pointer-events-none z-[100] flex items-center justify-center"
            style={{ 
              left: stampEffect.x - 100, 
              top: stampEffect.y - 100,
              width: 200, height: 200
            }}
          >
            {/* 붉은색 스탬프 이미지 효과 */}
            <div className="relative">
              <div className="absolute inset-0 border-8 border-red-600 rounded-xl opacity-80" />
              <div className="absolute inset-2 border-4 border-red-600 rounded-lg opacity-80 flex items-center justify-center">
                <span className="text-red-600 font-black text-4xl uppercase tracking-widest transform -rotate-12 border-y-4 border-red-600 py-1">
                  CLEARED
                </span>
              </div>
              {/* 스탬프 텍스처(간단한 점무늬 그라데이션) */}
              <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_20%,#ffffff_20%,#ffffff_80%,transparent_80%,transparent)] bg-[length:4px_4px] opacity-20 mix-blend-screen" />
            </div>
            
            {/* 파티클 효과용 (CSS로 간단 구현) */}
            <motion.div 
               initial={{ scale: 0 }}
               animate={{ scale: [1, 2], opacity: [1, 0] }}
               transition={{ duration: 0.5 }}
               className="absolute inset-0 bg-amber-400 rounded-full mix-blend-overlay blur-xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
