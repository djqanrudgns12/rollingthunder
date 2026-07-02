'use client'

import { useEffect, useState, useRef } from 'react'

import { useUIStore } from '@/store/uiStore'
import { useGameStore } from '@/store/gameStore'
import { getMapsAction } from '@/presentation/actions/mapActions'
import { createClient } from '@/lib/supabase/client'
import Dashboard from './Dashboard'
import { useRosterSync } from '@/hooks/useRosterSync'
import dynamic from 'next/dynamic';
const PhysicsCanvas = dynamic(() => import('./PhysicsCanvas'), { ssr: false });
const MapEditorManager = dynamic(() => import('./editor/MapEditorManager'), { ssr: false });

export default function GameManager() {
  useRosterSync() // Roster Realtime Sync 훅 호출

  const gameStage = useUIStore(state => state.gameStage)
  const isMuted = useGameStore(state => state.isMuted)
  const setMapDataCache = useGameStore(state => state.setMapDataCache)
  const { setIsAdmin, setIsLoggedIn } = useUIStore()
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  
  // 사운드 매니저 동기 호출용 캐시
  const soundManagerRef = useRef<any>(null)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    async function loadAssets() {
      try {
        timeoutId = setTimeout(() => {
          setLoadError(true);
        }, 10000); // 10 seconds timeout

        // 병렬 로딩: PIXI 라이브러리 및 Supabase 맵 데이터 페칭, 그리고 세션 확인
        const supabase = createClient();
        const [PIXI, dynamicMaps, { data: { session } }] = await Promise.all([
          import('pixi.js'),
          getMapsAction(),
          supabase.auth.getSession()
        ]);
        
        // 개발자 여부 세팅 및 로그인 상태 세팅 (단일 닉네임 의존성 제거, DB 권한 기반 적용)
        let isAdminRole = false;
        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          if (profile?.role === 'admin') {
            isAdminRole = true;
          }
        }
        setIsAdmin(isAdminRole);
        setIsLoggedIn(!!session);
        
        // 캐시에 저장
        setMapDataCache(dynamicMaps);
        await PIXI.Assets.load([
          '/images/assets/chip_obsidian_gold.png',
          '/images/assets/chip_neon_plasma.png',
          '/images/assets/chip_cyber_hologram.png',
          '/images/assets/chip_liquid_mercury.png',
          '/images/assets/chip_crystal_prism.png',
          '/images/assets/skill_icon_ultimate_tank.png',
          '/images/assets/skill_icon_ultimate_slime.png',
          '/images/assets/skill_icon_ultimate_ghost.png',
          '/images/assets/skill_icon_ultimate_magnet.png',
          '/images/assets/skill_icon_ultimate_teleport.png',
          '/images/assets/skill_icon_ultimate_booster.png',
          '/images/assets/bg_neon_synthwave_ultra.png',
          '/images/assets/bg_abyssal_trench.png',
          '/images/assets/bg_celestial_clockwork.png',
          '/images/assets/bg_cyber_dystopia.png',
          '/images/assets/brand_logo_masterpiece.png'
        ]);
        clearTimeout(timeoutId);
        setAssetsLoaded(true);
      } catch (e) {
        clearTimeout(timeoutId);
        setLoadError(true);
      }
    }
    loadAssets();

    return () => clearTimeout(timeoutId);
  }, [])

  // 🎧 BGM 제어 연동
  // ⚠️ 왜 여기에 있는가: React의 "Rules of Hooks" 규칙 상, 모든 Hook은 
  // 조건부 return 문보다 반드시 앞에 위치해야 합니다. 그렇지 않으면 
  // 렌더링마다 Hook 호출 횟수가 달라져 React 310 에러가 발생합니다.
  useEffect(() => {
    // 미리 사운드 매니저를 로드해 둠 (클릭 시 동기 호출을 위해)
    import('@/engine/AudioEngine').then(({ soundManager }) => {
      soundManagerRef.current = soundManager;
      
      // 에셋 로딩이 완료되었을 때만 BGM 실행
      if (assetsLoaded) {
        soundManager.setMuted(isMuted);
        if (gameStage === 'dashboard') {
          soundManager.playStandbyBgm();
        } else if (gameStage === 'playing') {
          soundManager.playGameBgm();
        } else if (gameStage === 'editor') {
          soundManager.playMapEditorBgm();
        }
      }
    });
  }, [gameStage, isMuted, assetsLoaded]);



  // 에셋이 아직 로딩 중이면 로딩 화면 표시 (모든 Hook 선언 이후에 조기 return)
  if (!assetsLoaded) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-screen bg-black text-white gap-4">
        <div className="w-16 h-16 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl font-bold tracking-widest animate-pulse text-[var(--accent-primary)]">LOADING MASTERPIECE ASSETS...</p>
        
        {loadError && (
          <div className="flex flex-col items-center gap-4 mt-8 animate-in fade-in slide-in-from-bottom">
            <p className="text-red-400 font-bold">⚠️ 에셋을 불러오는데 시간이 너무 오래 걸리거나 오류가 발생했습니다.</p>
            <p className="text-red-300 text-sm mt-1 mb-2">강제 시작 시 일부 텍스쳐가 깨지거나 투명하게 보일 수 있습니다.</p>
            <div className="flex gap-4">
              <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors font-bold border border-white/20">새로고침</button>
              <button onClick={() => setAssetsLoaded(true)} className="px-6 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded-xl transition-colors font-bold border border-red-500/50">강제 시작</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {gameStage === 'dashboard' && <Dashboard />}
      {gameStage === 'playing' && <PhysicsCanvas />}
      {gameStage === 'editor' && <MapEditorManager />}
    </>
  )
}
