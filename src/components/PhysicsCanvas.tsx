'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import RAPIER from '@dimforge/rapier2d-compat'
import * as PIXI from 'pixi.js'
import { RapierEngine } from '@/engine/RapierWorld'
import { MapBuilder } from '@/engine/MapBuilder'
import { ChipFactory } from '@/engine/ChipFactory'
import { RankingTracker, ParticipantRank } from '@/engine/RankingTracker'
import { SkillSystem, SkillType } from '@/engine/SkillSystem'
import { NudgeSystem } from '@/engine/NudgeSystem'
import { UserData } from '@/engine/types'
import { soundManager } from '@/engine/AudioEngine'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import type { EditorItem } from '@/store/editorStore'
import LiveLeaderboard from './LiveLeaderboard'
import SkillEventOverlay from './SkillEventOverlay'
import { Hand, Volume2, VolumeX } from 'lucide-react'

export default function PhysicsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [rankings, setRankings] = useState<ParticipantRank[]>([])
  const [activeSkill, setActiveSkill] = useState<{ chipId: string; skill: SkillType } | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  
  const { survivors, setSurvivors, targetSurvivalCount, gimmickDensity } = useGameStore()
  const { setGameStage, customMapData } = useUIStore()
  
  const handleNudge = useCallback(() => {
    RapierEngine.getInstance().then(engine => {
      if (engine.world) {
        NudgeSystem.applyNudge(engine.world, 150)
      }
    })
  }, [])

  useEffect(() => {
    let engine: RapierEngine;
    let eventQueue: RAPIER.EventQueue;
    let isMounted = true;
    let dtMultiplier = 1.0;
    
    const app = new PIXI.Application();
    const graphicsMap = new Map<string, PIXI.Container>();
    let skillTimer: NodeJS.Timeout;

    const initPhysics = async () => {
      engine = await RapierEngine.getInstance()
      if (!isMounted) return;
      
      engine.clear()
      engine = await RapierEngine.getInstance()
      const world = engine.world!
      eventQueue = new RAPIER.EventQueue(true)
      
      const canvas = canvasRef.current
      if (!canvas) return
      
      // Phase 8.2: PixiJS v8 WebGL 엔진 초기화
      await app.init({
        canvas: canvas,
        width: 800,
        height: 1200,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true
      })
      
      const width = app.canvas.width
      const height = app.canvas.height
      
      MapBuilder.createWalls(world, width, height)
      
      // Phase 7.6 통합 맵 로드
      if (customMapData && customMapData.length > 0) {
        customMapData.forEach((item: EditorItem) => {
          if (item.type === 'pin') {
            MapBuilder.createPin(world, item.x, item.y, item.radius || 15, false, item.restitution, item.friction)
          } else if (item.type === 'bumper') {
            MapBuilder.createPin(world, item.x, item.y, item.radius || 15, true, item.restitution, item.friction)
          } else if (item.type === 'wall') {
            MapBuilder.createRect(world, item.x, item.y, item.w || 100, item.h || 20, 'wall', item.rotation || 0, item.restitution, item.friction)
          } else if (item.type === 'windmill') {
            MapBuilder.createKinematic(world, item)
          } else if (item.type === 'portal' || item.type === 'booster' || item.type === 'blackhole' || item.type === 'whitehole') {
            MapBuilder.createSensor(world, item)
          }
        })
      } else {
        MapBuilder.buildRandomMap(world, width, height, gimmickDensity)
      }

      survivors.forEach((s) => {
        ChipFactory.createChip(world, width/2 + (Math.random() * 80 - 40), Math.random() * -300, 12, s.id)
      })

      const finishedChips = new Set<string>()
      const finishOrder: string[] = []

      skillTimer = setInterval(() => {
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
      const lastWarpTime = new Map<string, number>()

      // PixiJS Game Loop (GPU 렌더링 파이프라인)
      app.ticker.add(() => {
        if (!isMounted) return;

        world.integrationParameters.dt = (1 / 60) * dtMultiplier;
        engine.step(eventQueue)

        // 센서 교차 이벤트 처리 (포탈, 부스터)
        eventQueue.drainCollisionEvents((handle1, handle2, intersecting) => {
          if (!intersecting) return
          const b1 = world.getCollider(handle1).parent()
          const b2 = world.getCollider(handle2).parent()
          if (!b1 || !b2) return
          
          const d1 = b1.userData as UserData
          const d2 = b2.userData as UserData
          
          let chipBody: RAPIER.RigidBody | null = null
          let sensorBody: RAPIER.RigidBody | null = null
          
          if (d1?.type === 'chip' && ['portal', 'booster'].includes(d2?.type)) { chipBody = b1; sensorBody = b2; }
          if (d2?.type === 'chip' && ['portal', 'booster'].includes(d1?.type)) { chipBody = b2; sensorBody = b1; }
          
          if (chipBody && sensorBody) {
            const chipData = chipBody.userData as UserData
            const sensorData = sensorBody.userData as UserData
            
            if (sensorData.type === 'portal') {
              const now = Date.now()
              const lastWarp = lastWarpTime.get(chipData.id!) || 0
              if (now - lastWarp > 1000) { // 쿨다운 1초 (무한 루프 방지)
                // 같은 색상의 다른 포탈 찾기
                let targetPortal: any = null
                world.forEachRigidBody(b => {
                  const d = b.userData as UserData
                  if (d?.type === 'portal' && d.color === sensorData.color && b.handle !== sensorBody!.handle) {
                    targetPortal = b
                  }
                })
                
                if (targetPortal) {
                  const tPos = targetPortal.translation()
                  // 칩 이동 (Rapier 속도는 유지되어 물리적 벡터 보존됨)
                  chipBody.setTranslation({ x: tPos.x, y: tPos.y }, true)
                  lastWarpTime.set(chipData.id!, now)
                  soundManager.playFinish() // warp 효과음 대체
                }
              }
            } else if (sensorData.type === 'booster') {
              // 지향성 Impulse 적용
              const angle = (sensorData.rotation || 0) * (Math.PI / 180)
              const power = (sensorData.power || 3) * 500
              const impulse = {
                x: Math.sin(angle) * power,
                y: -Math.cos(angle) * power
              }
              chipBody.applyImpulse(impulse, true)
            }
          }
        })

        // 블랙홀 중력장 (Continuous Force)
        const blackholes: RAPIER.RigidBody[] = []
        const chips: RAPIER.RigidBody[] = []
        world.forEachRigidBody(b => {
          const d = b.userData as UserData
          if (d?.type === 'blackhole') blackholes.push(b)
          if (d?.type === 'chip') chips.push(b)
        })
        
        blackholes.forEach(bh => {
          const bhData = bh.userData as UserData
          const bhPos = bh.translation()
          const radius = bhData.radius || 150
          const forceMult = bhData.force || 5
          
          chips.forEach(chip => {
            const cPos = chip.translation()
            const dx = bhPos.x - cPos.x
            const dy = bhPos.y - cPos.y
            const dist = Math.sqrt(dx * dx + dy * dy)
            
            if (dist < radius && dist > 10) {
              // 거리가 가까울수록 더 강한 인력
              const pull = (1 - dist / radius) * forceMult * 10
              chip.applyImpulse({ x: (dx/dist) * pull, y: (dy/dist) * pull }, true)
            }
          })
        })
        
        frameCounter++;
        if (frameCounter % 5 === 0) {
          const newRanks = RankingTracker.updateRankings(world)
          setRankings(newRanks)
        }

        // Scene Graph 객체 풀링 동기화
        world.forEachRigidBody((body) => {
          const t = body.translation()
          const data = body.userData as UserData
          if (!data) return
          
          // 고유 Handle ID를 기반으로 렌더링 객체 탐색
          const bodyId = body.handle.toString()
          let container = graphicsMap.get(bodyId)
          
          // [초기화] 렌더링 노드가 없다면 단 1회만 생성하여 메모리에 올림
          if (!container) {
            container = new PIXI.Container()
            app.stage.addChild(container)
            graphicsMap.set(bodyId, container)
            
            const g = new PIXI.Graphics()
            container.addChild(g)
            
            if (data.type === 'chip') {
              const participantInfo = survivors.find(s => s.id === data.id)
              const color = participantInfo ? participantInfo.color : 'hsl(170, 100%, 50%)'
              const skinId = participantInfo?.skinId

              if (skinId === 'UR_blackhole') {
                // [UR 등급 스킨] 자체 발광 블룸(Bloom) 및 셰이더 대체 효과
                g.circle(0, 0, data.radius!)
                g.fill(color)
                
                const glow = new PIXI.Graphics()
                glow.circle(0, 0, data.radius! * 2.5)
                glow.fill({ color: 0xd946ef, alpha: 0.4 })
                glow.blendMode = 'add'
                container.addChild(glow)
                
                // 회전하는 입자 궤도 링
                const ring = new PIXI.Graphics()
                ring.circle(0, 0, data.radius! * 1.5)
                ring.stroke({ width: 2, color: 0xffffff, alpha: 0.8 })
                container.addChild(ring);
                
                // 추후 Ticker에서 회전시키기 위해 참조 할당
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (container as any).ring = ring;
                
              } else if (skinId === 'SR_cat') {
                // [SR 등급 스킨] 고양이 모양 벡터 렌더링
                g.circle(0, 0, data.radius!)
                g.fill(color)
                
                const ear1 = new PIXI.Graphics()
                ear1.moveTo(-8, -5).lineTo(-12, -15).lineTo(-2, -10)
                ear1.fill('#b45309')
                const ear2 = new PIXI.Graphics()
                ear2.moveTo(8, -5).lineTo(12, -15).lineTo(2, -10)
                ear2.fill('#b45309')
                container.addChild(ear1, ear2)
              } else {
                // [기본 스킨]
                g.circle(0, 0, data.radius!)
                g.fill(color)
                
                if (skinId?.startsWith('R_')) {
                  const glow = new PIXI.Graphics()
                  glow.circle(0, 0, data.radius! * 1.5)
                  glow.fill({ color, alpha: 0.3 })
                  glow.blendMode = 'add'
                  container.addChild(glow)
                }
              }
            } else if (data.type === 'pin') {
              g.circle(0, 0, data.radius!)
              g.fill('hsl(225, 10%, 30%)')
            } else if (data.type === 'bumper') {
              g.circle(0, 0, data.radius!)
              g.fill('hsl(35, 100%, 55%)')
              
              const glow = new PIXI.Graphics()
              glow.circle(0, 0, data.radius! * 1.5)
              glow.fill({ color: 0xffa500, alpha: 0.3 })
              glow.blendMode = 'add'
              container.addChild(glow)
            } else if (data.type === 'wall') {
              g.rect(-data.w!/2, -data.h!/2, data.w!, data.h!)
              g.fill({ color: 0xffffff, alpha: 0.1 })
              g.stroke({ width: 1, color: 0xffffff, alpha: 0.3 })
            } else if (data.type === 'booster') {
              g.rect(-25, -25, 50, 50)
              g.fill({ color: 0x00ffcc, alpha: 0.2 })
              g.stroke({ width: 2, color: 0x00ffcc, alpha: 0.8 })
            } else if (data.type === 'windmill') {
              g.rect(-50, -2.5, 100, 5)
              g.rect(-2.5, -50, 5, 100)
              g.fill({ color: 0xef4444, alpha: 0.8 })
            } else if (data.type === 'portal') {
              g.circle(0, 0, 20)
              g.stroke({ width: 4, color: data.color || '#c084fc' })
              const core = new PIXI.Graphics()
              core.circle(0, 0, 10)
              core.fill(data.color || '#c084fc')
              container.addChild(core)
            } else if (data.type === 'blackhole') {
              g.circle(0, 0, data.radius || 150)
              g.fill({ color: 0x000000, alpha: 0.5 })
              g.stroke({ width: 1, color: 0xffffff, alpha: 0.2 })
              const core = new PIXI.Graphics()
              core.circle(0, 0, 10)
              core.fill('#000000')
              core.stroke({ width: 2, color: '#ffffff' })
              container.addChild(core)
            }
          }
          
          // [동기화] 프레임마다 GPU 메모리에 위치/회전값만 주입
          container.position.set(t.x, t.y)
          container.rotation = body.rotation()
          
          // UR 커스텀 애니메이션 구동
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((container as any).ring) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (container as any).ring.rotation += 0.1
          }

          // 물리적 충돌 사운드 (속도 변화량 Pseudo-Impulse 감지)
          if (data.type === 'chip') {
            const vel = body.linvel()
            const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const lastSpeed = (body as any).lastSpeed || speed
            const delta = Math.abs(lastSpeed - speed)
            
            if (delta > 250) {
              soundManager.playBumperHit(delta) // 강한 충격 (범퍼 튕김 등)
            } else if (delta > 100) {
              soundManager.playWallHit(delta)   // 약한 충격 (벽/핀 부딪힘)
            }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (body as any).lastSpeed = speed
          }

          // 피니시 라인 판별 (결승선)
          if (data.type === 'chip' && t.y > height + 20) {
            if (!finishedChips.has(data.id!)) {
              finishedChips.add(data.id!)
              finishOrder.push(data.id!)
              soundManager.playFinish()
            }
          }
        })
        
        if (finishedChips.size >= targetSurvivalCount) {
          const nextSurvivors = finishOrder.slice(0, targetSurvivalCount).map(id => survivors.find(s => s.id === id)!)
          setSurvivors(nextSurvivors)
          setGameStage('results')
          isMounted = false;
        }
      })
    }

    const cleanupPromise = initPhysics()

    return () => {
      isMounted = false;
      clearInterval(skillTimer);
      cleanupPromise.then(() => {
        // Ticker 자동 종료 및 WebGL 메모리(VRAM) 즉각 강제 해제
        app.destroy(true, { children: true, texture: true, baseTexture: true })
        RapierEngine.getInstance().then(engine => engine.clear())
      })
    }
  }, [survivors, targetSurvivalCount, gimmickDensity, setSurvivors, setGameStage, customMapData])

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-[var(--bg-primary)]">
      <LiveLeaderboard rankings={rankings} />
      <SkillEventOverlay activeSkill={activeSkill} />
      
      <div className="absolute bottom-6 right-6 z-50 flex gap-4">
        <button 
          onClick={() => setIsMuted(soundManager.toggleMute())}
          className="glass-panel-heavy p-4 hover:bg-white/10 transition-colors flex items-center justify-center group active:scale-95"
        >
          {isMuted ? <VolumeX className="w-8 h-8 text-red-400 group-hover:scale-110 transition-transform" /> : <Volume2 className="w-8 h-8 text-[var(--text-primary)] group-hover:scale-110 transition-transform" />}
        </button>
        <button 
          onClick={handleNudge}
          className="glass-panel-heavy p-4 hover:bg-white/10 transition-colors flex items-center justify-center group active:scale-95"
        >
          <Hand className="w-8 h-8 text-[var(--text-primary)] group-hover:scale-110 transition-transform" />
        </button>
      </div>

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
