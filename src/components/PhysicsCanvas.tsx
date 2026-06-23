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
import { useUIStore } from '@/store/uiStore'
import LiveLeaderboard from './LiveLeaderboard'
import SkillEventOverlay from './SkillEventOverlay'
import { Hand } from 'lucide-react'

export default function PhysicsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [rankings, setRankings] = useState<ParticipantRank[]>([])
  const [activeSkill, setActiveSkill] = useState<{ chipId: string; skill: SkillType } | null>(null)
  
  const { survivors, setSurvivors, targetSurvivalCount, gimmickDensity } = useGameStore()
  const { setGameStage } = useUIStore()
  
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

      // 실제 서바이벌 생존자들을 물리 칩으로 생성
      survivors.forEach((s) => {
        ChipFactory.createChip(world, width/2 + (Math.random() * 80 - 40), Math.random() * -300, 12, s.id)
      })

      const finishedChips = new Set<string>()
      const finishOrder: string[] = []

      // 랜덤 스킬 발동 사이클
      const skillTimer = setInterval(() => {
        if (!isMounted || survivors.length === 0) return
        const randomSurvivor = survivors[Math.floor(Math.random() * survivors.length)]
        const randomChip = randomSurvivor.id
        const skills: SkillType[] = ['tank', 'booster']
        const randomSkill = skills[Math.floor(Math.random() * skills.length)]
        
        setActiveSkill({ chipId: randomChip, skill: randomSkill })
        dtMultiplier = 0.15 
        SkillSystem.triggerSkill(world, randomChip, randomSkill)
        
        setTimeout(() => {
          if (isMounted) {
            dtMultiplier = 1.0
            setActiveSkill(null)
          }
        }, 1500)
      }, 8000)

      let frameCounter = 0;

      const loop = () => {
        if (!isMounted) return;

        world.integrationParameters.dt = (1 / 60) * dtMultiplier;
        engine.step(eventQueue)
        
        frameCounter++;
        if (frameCounter % 5 === 0) {
          const newRanks = RankingTracker.updateRankings(world)
          setRankings(newRanks)
        }

        ctx.clearRect(0, 0, width, height)
        
        world.forEachRigidBody((body) => {
          const t = body.translation()
          const data = body.userData as UserData
          if (!data) return
          
          if (data.type === 'chip') {
            // Finish Line 로직 (바닥을 뚫고 지나가면 골인 처리)
            if (t.y > height + 20) {
              if (!finishedChips.has(data.id!)) {
                finishedChips.add(data.id!)
                finishOrder.push(data.id!)
              }
            }

            const participantInfo = survivors.find(s => s.id === data.id)
            ctx.beginPath()
            ctx.fillStyle = participantInfo ? participantInfo.color : 'hsl(170, 100%, 50%)'
            ctx.shadowColor = participantInfo ? participantInfo.color : 'hsla(170, 100%, 50%, 0.6)'
            ctx.shadowBlur = 10
            ctx.arc(t.x, t.y, data.radius!, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0
            ctx.closePath()
          } else {
            ctx.beginPath()
            if (data.type === 'pin') {
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
          }
        })
        
        // 서바이벌 스테이지 종료 판정
        // 선착순으로 목표 인원이 들어오면 바로 스테이지가 종료되며 결과 화면으로 이동
        if (finishedChips.size >= targetSurvivalCount) {
          const nextSurvivors = finishOrder.slice(0, targetSurvivalCount).map(id => survivors.find(s => s.id === id)!)
          setSurvivors(nextSurvivors)
          setGameStage('results')
          isMounted = false; // 물리 루프 즉시 종료
          return;
        }

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
      // 화면 전환 시 WASM 물리 메모리를 즉각 해제하여 메모리 누수 완벽 방지
      RapierEngine.getInstance().then(engine => engine.clear())
    }
  }, [survivors, targetSurvivalCount, gimmickDensity, setSurvivors, setGameStage])

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-[var(--bg-primary)]">
      <LiveLeaderboard rankings={rankings} />
      <SkillEventOverlay activeSkill={activeSkill} />
      
      <button 
        onClick={handleNudge}
        className="absolute bottom-6 right-6 z-50 glass-panel-heavy p-4 hover:bg-white/10 transition-colors flex items-center justify-center group active:scale-95"
      >
        <Hand className="w-8 h-8 text-[var(--text-primary)] group-hover:scale-110 transition-transform" />
      </button>

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
