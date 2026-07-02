'use client'

import { useEffect, useRef } from 'react'
import { stampService } from '@/lib/stampService'
import { useUIStore } from '@/store/uiStore'

interface Props {
  userId?: string | null
}

export default function MissionSyncManager({ userId }: Props) {
  const isSynced = useRef(false)
  const setHasClaimableMissions = useUIStore(state => state.setHasClaimableMissions)

  useEffect(() => {
    if (!userId || isSynced.current) return;
    
    const syncMissions = async () => {
      isSynced.current = true;
      try {
        // 1. 일일/주간 미션 할당 및 로그인 이벤트 기록
        await stampService.assignMissions(userId);
        stampService.trackEvent('login', 1);
        await stampService.flushPlayEvents();

        // 2. 수령 가능한 미션/업적이 있는지 확인
        const [daily, weekly, achievements] = await Promise.all([
          stampService.getUserMissions(userId, 'daily'),
          stampService.getUserMissions(userId, 'weekly'),
          stampService.getUserAchievements(userId)
        ]);

        const allMissions = [...daily, ...weekly, ...achievements];
        const hasClaimable = allMissions.some(m => m.completed && !m.is_collected);
        
        setHasClaimableMissions(hasClaimable);
      } catch (err) {
        console.error('Mission sync failed:', err);
        // 에러 발생 시 재시도 할 수 있도록 락 해제
        isSynced.current = false;
      }
    };

    syncMissions();
  }, [userId, setHasClaimableMissions]);

  return null;
}
