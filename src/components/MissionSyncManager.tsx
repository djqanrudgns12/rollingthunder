'use client'

import { useEffect, useRef } from 'react'
import { stampService } from '@/lib/stampService'
import { useUIStore } from '@/store/uiStore'
import { useChipStore } from '@/store/chipStore'
import { createClient } from '@/lib/supabase/client'

export default function MissionSyncManager() {
  const isSynced = useRef(false)
  const setHasClaimableMissions = useUIStore(state => state.setHasClaimableMissions)
  const userId = useUIStore(state => state.userProfile?.id)
  const addChipsLocally = useChipStore(state => state.addChipsLocally)

  useEffect(() => {
    if (!userId || isSynced.current) return;

    const syncMissions = async () => {
      isSynced.current = true;
      try {
        // 1. 일일/주간 미션 할당 및 로그인 이벤트 기록
        await stampService.assignMissions(userId);
        stampService.trackEvent('login', 1);
        await stampService.flushPlayEvents();

        // 2. 로그인 100칩 자동 지급 (하루 1회)
        const supabase = createClient();
        const today = new Date().toISOString().split('T')[0];
        const { data: existingLog } = await supabase
          .from('chip_logs')
          .select('log_id')
          .eq('user_id', userId)
          .eq('reason', 'Daily Login Reward')
          .gte('created_at', `${today}T00:00:00Z`)
          .limit(1);

        if (!existingLog || existingLog.length === 0) {
          const { error: chipError } = await supabase.rpc('add_chips', {
            p_user_id: userId,
            p_amount: 100,
            p_reason: 'Daily Login Reward'
          });
          if (!chipError) {
            addChipsLocally(100);
          }
        }

        // 3. 수령 가능한 미션/업적이 있는지 확인
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

    // 대기실 첫 페인트 경로에서 비켜서도록 유휴 시점에 실행(최대 2.5초 내 보장).
    // 일일 로그인 보상·미션 할당 로직 자체는 변경 없음 — 실행 시점만 지연.
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === 'function') {
      idleId = w.requestIdleCallback(() => { syncMissions(); }, { timeout: 2500 });
    } else {
      timerId = setTimeout(() => { syncMissions(); }, 1200);
    }

    return () => {
      if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, [userId, setHasClaimableMissions, addChipsLocally]);

  return null;
}
