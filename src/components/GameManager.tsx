'use client'

import { useUIStore } from '@/store/uiStore'
import Dashboard from './Dashboard'
import PhysicsCanvas from './PhysicsCanvas'
import ResultScreen from './ResultScreen'

export default function GameManager() {
  const gameStage = useUIStore(state => state.gameStage)

  return (
    <>
      {gameStage === 'dashboard' && <Dashboard />}
      {gameStage === 'playing' && <PhysicsCanvas />}
      {gameStage === 'results' && <ResultScreen />}
    </>
  )
}
