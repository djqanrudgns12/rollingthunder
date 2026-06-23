'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import RAPIER from '@dimforge/rapier2d-compat'
import { RapierEngine } from '@/engine/RapierWorld'
import { MapBuilder } from '@/engine/MapBuilder'
import { ChipFactory } from '@/engine/ChipFactory'
import { RankingTracker, ParticipantRank } from '@/engine/RankingTracker'
import { SkillSystem, SkillType } from '@/engine/SkillSystem'
import { NudgeSystem } from '@/engine/NudgeSystem'
import { UserData } from '@/engine/types'
import { useGameStore } from '@/store/gameStore'
import LiveLeaderboard from './LiveLeaderboard'
import SkillEventOverlay from './SkillEventOverlay'
import { Hand } from 'lucide-react'

export default function PhysicsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [rankings, setRankings] = useState<ParticipantRank[]>([])
  const [activeSkill, setActiveSkill] = useState<{ chipId: string; skill: SkillType } | null>(null)
  
  const gimmickDensity = useGameStore(state => state.gimmickDensity)
  
  const handleNudge = useCallback(() => {
    RapierEngine.getInstance().then(engine => {
      if (engine.world) {
        NudgeSystem.applyNudge(engine.world, 150)
      }
    })
  }, [])

  useEffect(() => {
    let animationId: number;
    let engine: RapierEngine;
    let eventQueue: RAPIER.EventQueue;
    let isMounted = true;
    
    // 타임스케일(슬로모션) 구현용 배율기
    let dtMultiplier = 1.0;

    const initPhysics = async () => {
      engine = await RapierEngine.getInstance()
      if (!isMounted) return;
      
      engine.clear()
      engine = await RapierEngine.getInstance()
      const world = engine.world!
      eventQueue = new RAPIER.EventQueue(true)
      
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      const width = canvas.width
      const height = canvas.height
      
      MapBuilder.createWalls(world, width, height)
      MapBuilder.buildRandomMap(world, width, height, gimmickDensity)

      for(let i = 1; i <= 20; i++) {
        ChipFactory.createChip(world, width/2 + (Math.random() * 80 - 40), Math.random() * -300, 12, `chip-${i}`)
      }

      // 테스트용 6초마다 랜덤 스킬 발동 사이클
      const skillTimer = setInterval(() => {
        if (!isMounted) return
        const randomChip = `chip-${Math.floor(Math.random() * 20) + 1}`
        const skills: SkillType[] = ['tank', 'booster']
        const randomSkill = skills[Math.floor(Math.random() * skills.length)]
        
        setActiveSkill({ chipId: randomChip, skill: randomSkill })
        dtMultiplier = 0.15 // 물리 엔진 연산 속도를 극도로 늦춰 슬로모션 구현
        SkillSystem.triggerSkill(world, randomChip, randomSkill)
        
        // 1.5초 후 원상복구
        setTimeout(() => {
          if (isMounted) {
            dtMultiplier = 1.0
            setActiveSkill(null)
          }
        }, 1500)
      }, 6000)

      let frameCounter = 0;

      const loop = () => {
        if (!isMounted) return;

        // Custom time scale simulation (60fps 기준에 배율 적용)
        world.integrationParameters.dt = (1 / 60) * dtMultiplier;
        engine.step(eventQueue)
        
        frameCounter++;
        // 퍼포먼스를 위해 매 프레임이 아닌 5프레임마다 랭킹 산정 알고리즘 실행
        if (frameCounter % 5 === 0) {
          const newRanks = RankingTracker.updateRankings(world)
          setRankings(newRanks)
        }

        ctx.clearRect(0, 0, width, height)
        
        world.forEachRigidBody((body) => {
          const t = body.translation()
          const data = body.userData as UserData
          if (!data) return
          
          ctx.beginPath()
          if (data.type === 'chip') {
            ctx.fillStyle = 'hsl(170, 100%, 50%)'
            ctx.shadowColor = 'hsla(170, 100%, 50%, 0.6)'
            ctx.shadowBlur = 15
            ctx.arc(t.x, t.y, data.radius!, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0
          } else if (data.type === 'pin') {
            ctx.fillStyle = 'hsl(225, 10%, 30%)'
            ctx.arc(t.x, t.y, data.radius!, 0, Math.PI * 2)
            ctx.fill()
          } else if (data.type === 'bumper') {
            ctx.fillStyle = 'hsl(35, 100%, 55%)'
            ctx.shadowColor = 'hsla(35, 100%, 55%, 0.8)'
            ctx.shadowBlur = 10
            ctx.arc(t.x, t.y, data.radius!, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0
          } else if (data.type === 'wall') {
            ctx.fillStyle = 'hsla(0,0%,100%,0.03)'
            ctx.fillRect(t.x - data.w!/2, t.y - data.h!/2, data.w!, data.h!)
          }
          ctx.closePath()
        })
        
        animationId = requestAnimationFrame(loop)
      }
      
      animationId = requestAnimationFrame(loop)

      return () => clearInterval(skillTimer)
    }

    const cleanup = initPhysics()

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationId)
      cleanup.then(clean => clean && clean())
    }
  }, [gimmickDensity])

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-[var(--bg-primary)]">
      {/* 랭킹보드 (좌측 상단) */}
      <LiveLeaderboard rankings={rankings} />
      
      {/* 스킬 슬로모션 팝업 (중앙 오버레이) */}
      <SkillEventOverlay activeSkill={activeSkill} />
      
      {/* Nudge 판 흔들기 버튼 (우측 하단) */}
      <button 
        onClick={handleNudge}
        className="absolute bottom-6 right-6 z-50 glass-panel-heavy p-4 hover:bg-white/10 transition-colors flex items-center justify-center group active:scale-95"
      >
        <Hand className="w-8 h-8 text-[var(--text-primary)] group-hover:scale-110 transition-transform" />
      </button>

      {/* Physics Canvas (화면 전체 90% 이상을 차지하도록 object-contain 및 비율 조정) */}
      <div className="w-full h-full p-2 md:p-4 flex items-center justify-center pointer-events-none">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={1200} 
          className="w-full h-full max-w-4xl object-contain bg-black/40 rounded-3xl shadow-[0_0_50px_hsla(170,100%,50%,0.05)] border border-white/5 pointer-events-auto"
        />
      </div>
    </div>
  )
}
