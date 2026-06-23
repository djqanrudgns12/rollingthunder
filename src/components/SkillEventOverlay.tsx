'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useGameStore } from '@/store/gameStore'

interface SkillEventOverlayProps {
  activeSkill: { chipId: string; skill: string } | null;
}

const SKILL_CONFIG: Record<string, { name: string; color: string; image: string }> = {
  tank: { name: '탱크 모드', color: 'hsl(35, 100%, 50%)', image: '/images/assets/skill_icon_ultimate_tank.png' },
  booster: { name: '슈퍼 부스터', color: 'hsl(170, 100%, 50%)', image: '/images/assets/skill_icon_ultimate_booster.png' },
  slime: { name: '슬라임 화', color: 'hsl(120, 100%, 40%)', image: '/images/assets/skill_icon_ultimate_slime.png' },
  ghost: { name: '유령화', color: 'hsl(280, 80%, 75%)', image: '/images/assets/skill_icon_ultimate_ghost.png' },
  magnet: { name: '자석 모드', color: 'hsl(0, 100%, 65%)', image: '/images/assets/skill_icon_ultimate_magnet.png' },
  teleport: { name: '순간 이동', color: 'hsl(300, 100%, 65%)', image: '/images/assets/skill_icon_ultimate_teleport.png' },
  none: { name: '', color: '', image: '' },
}

export default function SkillEventOverlay({ activeSkill }: SkillEventOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const topBarRef = useRef<HTMLDivElement>(null)
  const bottomBarRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const survivors = useGameStore(state => state.survivors)

  useEffect(() => {
    if (activeSkill && activeSkill.skill !== 'none') {
      const tl = gsap.timeline()
      
      // Reset
      gsap.set(containerRef.current, { display: 'flex', opacity: 1 })
      gsap.set(topBarRef.current, { y: '-100%' })
      gsap.set(bottomBarRef.current, { y: '100%' })
      gsap.set(contentRef.current, { scale: 0, opacity: 0, rotation: -45 })

      // Cinematic Letterbox in
      tl.to([topBarRef.current, bottomBarRef.current], {
        y: '0%',
        duration: 0.4,
        ease: 'power3.out'
      })
      
      // Icon and Text explosion in
      .to(contentRef.current, {
        scale: 1.2,
        opacity: 1,
        rotation: 0,
        duration: 0.5,
        ease: 'back.out(1.7)'
      }, "-=0.2")
      
      // Settle
      .to(contentRef.current, {
        scale: 1,
        duration: 1.5,
        ease: 'power2.out'
      })
      
      // Fade out
      .to(containerRef.current, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(containerRef.current, { display: 'none' })
        }
      })
    }
  }, [activeSkill])

  if (!activeSkill) return <div ref={containerRef} className="hidden" />;

  const config = SKILL_CONFIG[activeSkill.skill] || SKILL_CONFIG.none;

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 z-40 pointer-events-none hidden flex-col justify-between overflow-hidden"
    >
      {/* Cinematic Bars */}
      <div ref={topBarRef} className="w-full h-[15vh] bg-black/90 shadow-[0_10px_30px_rgba(0,0,0,0.8)] border-b border-white/10 backdrop-blur-md" />
      
      {/* Center Content */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Radial dark gradient for focus */}
        <div className="absolute inset-0 bg-radial-gradient from-black/20 to-black/80" />
        
        <div ref={contentRef} className="relative z-10 flex flex-col items-center justify-center">
          <img 
            src={config.image} 
            alt={config.name}
            className="w-48 h-48 md:w-64 md:h-64 object-contain filter drop-shadow-[0_0_40px_rgba(255,255,255,0.4)]"
          />
          <div className="mt-8 flex flex-col items-center">
            <span className="text-white/70 font-mono text-sm md:text-lg tracking-widest uppercase bg-black/50 px-4 py-1 rounded-full backdrop-blur-sm border border-white/10 mb-2">
              {survivors.find(s => s.id === activeSkill.chipId)?.name || activeSkill.chipId}
            </span>
            <span 
              className="text-5xl md:text-7xl font-black italic tracking-tighter uppercase text-transparent bg-clip-text"
              style={{ 
                backgroundImage: `linear-gradient(to bottom, #ffffff, ${config.color})`,
                filter: `drop-shadow(0 0 20px ${config.color})`
              }}
            >
              {config.name}
            </span>
          </div>
        </div>
      </div>

      <div ref={bottomBarRef} className="w-full h-[15vh] bg-black/90 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] border-t border-white/10 backdrop-blur-md" />
    </div>
  )
}
