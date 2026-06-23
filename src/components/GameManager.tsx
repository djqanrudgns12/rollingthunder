'use client'

import { useEffect, useState } from 'react'
import * as PIXI from 'pixi.js'
import { useUIStore } from '@/store/uiStore'
import Dashboard from './Dashboard'
import PhysicsCanvas from './PhysicsCanvas'

export default function GameManager() {
  const gameStage = useUIStore(state => state.gameStage)
  const [assetsLoaded, setAssetsLoaded] = useState(false)

  useEffect(() => {
    async function loadAssets() {
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
      setAssetsLoaded(true);
    }
    loadAssets();
  }, [])

  if (!assetsLoaded) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-screen bg-black text-white">
        <div className="w-16 h-16 border-4 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-xl font-bold tracking-widest animate-pulse text-[var(--accent-primary)]">LOADING MASTERPIECE ASSETS...</p>
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
