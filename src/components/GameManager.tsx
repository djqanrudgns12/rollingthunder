'use client'

import { useEffect, useState } from 'react'
import * as PIXI from 'pixi.js'
import { useUIStore } from '@/store/uiStore'
import Dashboard from './Dashboard'
import PhysicsCanvas from './PhysicsCanvas'

export default function GameManager() {
  const gameStage = useUIStore(state => state.gameStage)
  const [assetsLoaded, setAssetsLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    async function loadAssets() {
      try {
        timeoutId = setTimeout(() => {
          setLoadError(true);
        }, 10000); // 10 seconds timeout

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

  if (!assetsLoaded) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-screen bg-black text-white gap-4">
        <div className="w-16 h-16 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl font-bold tracking-widest animate-pulse text-[var(--accent-primary)]">LOADING MASTERPIECE ASSETS...</p>
        
        {loadError && (
          <div className="flex flex-col items-center gap-4 mt-8 animate-in fade-in slide-in-from-bottom">
            <p className="text-red-400 font-bold">⚠️ 에셋을 불러오는데 시간이 너무 오래 걸리거나 오류가 발생했습니다.</p>
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
    </>
  )
}
