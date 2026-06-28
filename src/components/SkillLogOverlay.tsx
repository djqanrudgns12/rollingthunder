'use client'

import { useRef, useEffect } from 'react'
import { useGameStore, SkillLogEntry } from '@/store/gameStore'
import { motion, AnimatePresence } from 'framer-motion'

// ── 스킬별 표시 설정 ──
// 각 스킬 종류에 대한 이름과 고유 색상. 로그에서 스킬 이름에 이 색상을 적용한다.
const SKILL_DISPLAY: Record<string, { name: string; color: string; twClasses: string }> = {
  tank:     { name: '탱크 모드',     color: '#FF8C00', twClasses: 'text-orange-400 border-orange-500/50 bg-orange-950/40 shadow-[0_0_8px_rgba(234,88,12,0.5)]' },
  booster:  { name: '슈퍼 부스터',   color: '#00FFD0', twClasses: 'text-cyan-400 border-cyan-500/50 bg-cyan-950/40 shadow-[0_0_8px_rgba(6,182,212,0.5)]' },
  slime:    { name: '슬라임화',      color: '#39FF14', twClasses: 'text-green-400 border-green-500/50 bg-green-950/40 shadow-[0_0_8px_rgba(34,197,94,0.5)]' },
  ghost:    { name: '유령화',        color: '#C084FC', twClasses: 'text-purple-400 border-purple-500/50 bg-purple-950/40 shadow-[0_0_8px_rgba(168,85,247,0.5)]' },
  magnet:   { name: '자석 모드',     color: '#FF4444', twClasses: 'text-red-400 border-red-500/50 bg-red-950/40 shadow-[0_0_8px_rgba(239,68,68,0.5)]' },
  teleport: { name: '순간 이동',     color: '#FF69B4', twClasses: 'text-pink-400 border-pink-500/50 bg-pink-950/40 shadow-[0_0_8px_rgba(236,72,153,0.5)]' },
}

// ── 다이내믹 문구 템플릿 ──
// 스킬 발동 시 무작위로 수식어를 붙여 박진감을 살린다.
// {name}은 플레이어 이름, {skill}은 스킬 이름으로 치환된다.
const MESSAGE_TEMPLATES: string[] = [
  '{name}님 {skill}!',
  '{name}님의 {skill}!',
  '{name}님, 폭주하는 {skill}!',
  '{name}님의 무시무시한 {skill}!',
  '{name}님의 기습적인 {skill}!',
  '{name}님, 빛나는 {skill} 발동!',
  '{name}님이 {skill}을(를) 시전!',
  '{name}님의 전격적인 {skill}!',
  '{name}님, 갑작스러운 {skill}!',
  '{name}님의 초고속 {skill}!',
]

// 무작위 문구 생성 함수
export function generateSkillMessage(playerName: string, skillKey: string): string {
  const template = MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)]
  // {skill} 부분은 UI에서 분할하여 뱃지 스타일을 입히기 위해 남겨두고 {name}만 치환합니다.
  return template.replace('{name}', playerName)
}

export default function SkillLogOverlay() {
  const skillLogs = useGameStore(state => state.skillLogs)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 새 로그가 추가될 때 자동으로 가장 아래로 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [skillLogs])

  return (
    <div className="flex flex-col h-full">
      {/* 헤더: 전투 로그 타이틀 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 shrink-0 bg-black/40">
        <span className="text-xs font-bold tracking-[0.2em] text-white/50 uppercase">⚔ Skill Log</span>
      </div>

      {/* 로그 본체: 스크롤 가능한 대화창 영역 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-2 custom-scrollbar"
        style={{
          // 스타크래프트 대화창처럼 하단부터 로그가 쌓이게끔 역방향 정렬
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
        }}
      >
        <AnimatePresence initial={false}>
          {skillLogs.map((log: SkillLogEntry) => {
            const skillInfo = SKILL_DISPLAY[log.skill]
            const skillColor = skillInfo?.color || '#ffffff'

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="py-1 text-base leading-snug whitespace-normal break-keep drop-shadow-md flex items-start gap-2"
                // 멀리서도 잘 보이도록 글씨를 키우고 줄바꿈(whitespace-normal)을 허용함
              >
                {/* 플레이어 아이콘 (순위보드와 동일한 색상 도트) */}
                <div 
                  className="w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor] shrink-0 mt-[6px]"
                  style={{ backgroundColor: log.playerColor, color: log.playerColor }} 
                />
                <div className="flex-1">
                  {/* 플레이어 이름: 플레이어 고유 색상 */}
                  <span
                    className="font-bold drop-shadow-[0_0_4px_currentColor]"
                    style={{ color: log.playerColor }}
                  >
                    {log.playerName}
                  </span>
                  {/* 스킬 관련 텍스트: 분할 렌더링 */}
                  <span className="text-white/80">
                    {(() => {
                      const msg = log.message.replace(log.playerName, '');
                      // 만약 이전 버전의 로그라서 {skill} 텍스트가 없다면 그대로 렌더링
                      if (!msg.includes('{skill}')) return msg;
                      
                      const parts = msg.split('{skill}');
                      return (
                        <>
                          {parts[0]}
                          <span className={`inline-flex items-center justify-center px-1.5 py-0.5 mx-1 border rounded text-[0.9em] font-black italic tracking-wide drop-shadow-md ${skillInfo?.twClasses || ''}`}>
                            {skillInfo?.name || log.skill}
                          </span>
                          {parts[1]}
                        </>
                      )
                    })()}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
