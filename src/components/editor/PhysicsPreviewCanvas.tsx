'use client'

import { useEffect, useRef, useState } from 'react'
import RAPIER from '@dimforge/rapier2d-compat'
import { RapierEngine } from '@/engine/RapierWorld'
import { MapBuilder } from '@/engine/MapBuilder'
import { ChipFactory } from '@/engine/ChipFactory'
import { useEditorStore } from '@/store/editorStore'
import { UserData } from '@/engine/types'

export default function PhysicsPreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const items = useEditorStore(state => state.items)
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    let animationId: number;
    let engine: RapierEngine;
    let isMounted = true;
    
    const initPhysics = async () => {
      engine = await RapierEngine.getInstance()
      if (!isMounted) return;
      
      // 테스트 모드 진입 시 기존 물리 월드 클리어
      engine.clear() 
      engine = await RapierEngine.getInstance()
      const world = engine.world!
      
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      const width = canvas.width
      const height = canvas.height
      
      // 맵 기본 벽면 생성
      MapBuilder.createWalls(world, width, height)
      
      // 1. [직렬화(Serialize)]: 스토어에 저장된 아이템 배열을 물리 객체로 동적 생성
      items.forEach(item => {
        if (item.type === 'pin') {
          MapBuilder.createPin(world, item.x, item.y, item.radius || 15, false, item.restitution, item.friction)
        } else if (item.type === 'bumper') {
          MapBuilder.createPin(world, item.x, item.y, item.radius || 15, true, item.restitution, item.friction)
        } else if (item.type === 'wall') {
          MapBuilder.createRect(world, item.x, item.y, item.w || 100, item.h || 20, 'wall', item.angle ?? item.rotation ?? 0, item.restitution, item.friction)
        }
      })

      // 2. [라이브 디버깅]: 테스트용 더미 칩 10개 상단 무작위 투하
      for (let i = 0; i < 10; i++) {
        ChipFactory.createChip(world, width/2 + (Math.random() * 200 - 100), Math.random() * -100, 12, `dummy-${i}`)
      }
      
      setIsRunning(true)

      const loop = () => {
        if (!isMounted) return;
        
        world.step() // 60fps 고정 물리 연산 진행

        // 모션 블러를 위한 잔상 처리 배경 렌더링
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
        ctx.fillRect(0, 0, width, height)
        
        world.forEachRigidBody((body) => {
          const t = body.translation()
          const r = body.rotation()
          const data = body.userData as UserData
          if (!data) return
          
          ctx.beginPath()
          if (data.type === 'chip') {
            ctx.fillStyle = 'hsl(170, 100%, 60%)'
            ctx.shadowColor = 'hsla(170, 100%, 60%, 0.8)'
            ctx.shadowBlur = 15
            ctx.arc(t.x, t.y, data.radius!, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0
          } else if (data.type === 'pin') {
            ctx.fillStyle = 'hsl(225, 10%, 40%)'
            ctx.arc(t.x, t.y, data.radius!, 0, Math.PI * 2)
            ctx.fill()
          } else if (data.type === 'bumper') {
            ctx.fillStyle = 'hsl(35, 100%, 60%)'
            ctx.shadowColor = 'hsla(35, 100%, 60%, 0.8)'
            ctx.shadowBlur = 15
            ctx.arc(t.x, t.y, data.radius!, 0, Math.PI * 2)
            ctx.fill()
            ctx.shadowBlur = 0
          } else if (data.type === 'wall') {
            ctx.save()
            ctx.translate(t.x, t.y)
            ctx.rotate(r) // 라디안 회전값 반영
            ctx.fillStyle = 'hsla(0,0%,100%,0.2)'
            ctx.strokeStyle = 'rgba(255,255,255,0.5)'
            ctx.lineWidth = 2
            ctx.fillRect(-data.w!/2, -data.h!/2, data.w!, data.h!)
            ctx.strokeRect(-data.w!/2, -data.h!/2, data.w!, data.h!)
            ctx.restore()
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
      // 모달이 닫힐 때 자원 해제 (메모리 누수 방지)
      RapierEngine.getInstance().then(engine => engine.clear())
    }
  }, [items])

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#0a0a0a] rounded-3xl overflow-hidden border border-[var(--accent-primary)]/30">
      {!isRunning && <div className="absolute z-10 text-[var(--accent-primary)] animate-pulse font-bold tracking-widest text-lg">Initializing Physics Engine...</div>}
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={1200} 
        className="w-full h-full max-w-[800px] max-h-[1200px] object-contain"
      />
    </div>
  )
}
