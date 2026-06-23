'use client'

import { useEffect, useRef, useState } from 'react'
import RAPIER from '@dimforge/rapier2d-compat'
import { RapierEngine } from '@/engine/RapierWorld'
import { MapBuilder } from '@/engine/MapBuilder'
import { ChipFactory } from '@/engine/ChipFactory'
import { UserData } from '@/engine/types'

export default function PhysicsTestHarness() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fps, setFps] = useState(0)
  const [chipCount, setChipCount] = useState(0)
  const [isReady, setIsReady] = useState(false)
  
  useEffect(() => {
    let animationId: number;
    let engine: RapierEngine;
    let eventQueue: RAPIER.EventQueue;
    let isMounted = true;
    
    let lastTime = performance.now();
    let frames = 0;

    const initPhysics = async () => {
      engine = await RapierEngine.getInstance()
      if (!isMounted) return;
      
      engine.clear() // Hot-reload 대비 초기화
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
      MapBuilder.buildRandomMap(world, width, height, 50) 

      // 성능 검증용 100개 칩 스폰
      for(let i = 0; i < 100; i++) {
        ChipFactory.createChip(world, width/2 + (Math.random() * 40 - 20), Math.random() * -1000, 8, `chip-${i}`)
      }
      setChipCount(100)
      setIsReady(true)

      const loop = (time: number) => {
        if (!isMounted) return;

        frames++
        if (time - lastTime >= 1000) {
          setFps(Math.round((frames * 1000) / (time - lastTime)))
          frames = 0
          lastTime = time
        }

        // 60fps Physics Step
        engine.step(eventQueue)
        
        ctx.clearRect(0, 0, width, height)
        
        // Render 
        world.forEachRigidBody((body) => {
          const t = body.translation()
          const data = body.userData as UserData
          
          if (!data) return
          
          ctx.beginPath()
          if (data.type === 'chip') {
            ctx.fillStyle = 'hsl(170, 100%, 50%)'
            ctx.shadowColor = 'hsla(170, 100%, 50%, 0.8)'
            ctx.shadowBlur = 10
            ctx.arc(t.x, t.y, data.radius!, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0 // 초기화
          } else if (data.type === 'pin') {
            ctx.fillStyle = 'hsl(225, 10%, 40%)'
            ctx.arc(t.x, t.y, data.radius!, 0, Math.PI * 2)
            ctx.fill()
          } else if (data.type === 'bumper') {
            ctx.fillStyle = 'hsl(35, 100%, 55%)'
            ctx.shadowColor = 'hsla(35, 100%, 55%, 0.8)'
            ctx.shadowBlur = 8
            ctx.arc(t.x, t.y, data.radius!, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0
          } else if (data.type === 'wall') {
            ctx.fillStyle = 'hsla(0,0%,100%,0.05)'
            ctx.fillRect(t.x - data.w!/2, t.y - data.h!/2, data.w!, data.h!)
          }
          ctx.closePath()
        })
        
        animationId = requestAnimationFrame(loop)
      }
      
      animationId = requestAnimationFrame(loop)
    }

    initPhysics()

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4">
      <div className="flex gap-4 text-sm font-mono text-[var(--text-primary)]">
        <div className="bg-black/40 px-4 py-2 rounded-lg border border-white/10 truncate-1-line glass-panel flex items-center gap-2">
          <span className="text-[var(--text-secondary)]">FPS</span> 
          <span className="text-[var(--accent-primary)] font-bold">{isReady ? fps : '...'}</span>
        </div>
        <div className="bg-black/40 px-4 py-2 rounded-lg border border-white/10 truncate-1-line glass-panel flex items-center gap-2">
          <span className="text-[var(--text-secondary)]">CHIPS</span> 
          <span className="text-[var(--accent-secondary)] font-bold">{chipCount}</span>
        </div>
      </div>
      
      <div className="glass-panel-heavy p-2 md:p-4 rounded-2xl flex items-center justify-center">
        {/* 기기 반응성을 위해 부모 컨테이너 비율에 맞춰 유동적으로 조절됨 */}
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={650} 
          className="w-full max-w-[400px] h-auto bg-[var(--bg-secondary)] rounded-xl shadow-inner border border-white/5"
          style={{ aspectRatio: '400/650' }}
        />
      </div>
    </div>
  )
}
