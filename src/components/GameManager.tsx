'use client'

import { useEffect, useRef } from 'react'

import { useUIStore } from '@/store/uiStore'
import { useGameStore } from '@/store/gameStore'
import { getMapsAction } from '@/presentation/actions/mapActions'
import { createClient } from '@/lib/supabase/client'
import { warmupGameAssets } from '@/lib/pixiWarmup'
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
  const { setIsLoggedIn } = useUIStore()

  // 사운드 매니저 동기 호출용 캐시
  const soundManagerRef = useRef<any>(null)

  // 대기실은 즉시 렌더한다 — 인게임 텍스처(≈8MB)·pixi 임포트·맵 데이터는 대기실 UI에
  // 필요하지 않으므로 전부 백그라운드로 옮겼다(기존에는 이 로딩이 화면 전체를 가렸음).
  // 맵 데이터는 persist된 mapDataCache가 즉시 페인트를 담당하고(stale-while-revalidate),
  // 아래 fetch가 매 마운트마다 최신본으로 갱신한다. 캐시가 아직 없으면 소비자들이
  // MapPresets 폴백을 쓰므로 기능 저하 없음.
  useEffect(() => {
    // 1) 로그인 상태(로컬 쿠키 조회 — 저렴)
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }: { data: { session: unknown } }) => {
      setIsLoggedIn(!!data.session);
      // isAdmin은 GlobalPlayerHUD의 부트스트랩(getLobbyBootstrapAction)이 프로필과 함께 설정한다.
      // (기존의 별도 profiles.role 왕복 제거 — 중복 쿼리였음)
    });

    // 2) 맵 데이터 갱신 (백그라운드)
    getMapsAction().then((dynamicMaps) => {
      if (dynamicMaps) setMapDataCache(dynamicMaps);
    }).catch(() => { /* 오프라인 등 실패 시 persist 캐시/MapPresets 폴백 유지 */ });

    // 3) 인게임 텍스처 워밍업 (백그라운드, 창당 1회)
    warmupGameAssets();
  }, [setIsLoggedIn, setMapDataCache])

  // 🎧 BGM 제어 연동
  useEffect(() => {
    // 미리 사운드 매니저를 로드해 둠 (클릭 시 동기 호출을 위해)
    import('@/engine/AudioEngine').then(({ soundManager }) => {
      soundManagerRef.current = soundManager;

      soundManager.setMuted(isMuted);
      if (gameStage === 'dashboard') {
        soundManager.playStandbyBgm();
      } else if (gameStage === 'playing') {
        soundManager.playGameBgm();
      } else if (gameStage === 'editor') {
        soundManager.playMapEditorBgm();
      }
    });
  }, [gameStage, isMuted]);

  return (
    <>
      {gameStage === 'dashboard' && <Dashboard />}
      {gameStage === 'playing' && <PhysicsCanvas />}
      {gameStage === 'editor' && <MapEditorManager />}
    </>
  )
}
