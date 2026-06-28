'use client'

import { useRef, useEffect } from 'react'
import { useGameStore, SkillLogEntry } from '@/store/gameStore'
import { motion, AnimatePresence } from 'framer-motion'

// ── 스킬별 표시 설정 ──
// 각 스킬 종류에 대한 이름과 고유 색상. 로그에서 스킬 이름에 이 색상을 적용한다.
const SKILL_DISPLAY: Record<string, { name: string; color: string }> = {
  tank:     { name: '탱크 모드',     color: '#FF8C00' },  // 주황 (무겁고 강한 느낌)
  booster:  { name: '슈퍼 부스터',   color: '#00FFD0' },  // 시안 (빠른 속도감)
  slime:    { name: '슬라임화',      color: '#39FF14' },  // 네온 그린 (끈적 변신)
  ghost:    { name: '유령화',        color: '#C084FC' },  // 보라 (신비로운 투명)
  magnet:   { name: '자석 모드',     color: '#FF4444' },  // 빨강 (자력 에너지)
  teleport: { name: '순간 이동',     color: '#FF69B4' },  // 핫핑크 (공간이동)
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
  const skillInfo = SKILL_DISPLAY[skillKey]
  const skillName = skillInfo ? skillInfo.name : skillKey
  const template = MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)]
  return template.replace('{name}', playerName).replace('{skill}', skillName)
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
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/10 shrink-0">
        <span className="text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase">⚔ Skill Log</span>
      </div>

      {/* 로그 본체: 스크롤 가능한 대화창 영역 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-1.5 custom-scrollbar"
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
                className="py-[3px] text-[11px] leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
                // 왜 whitespace-nowrap인가: 한 줄 표시를 보장해야 로그 밀도가 유지되고 가독성이 올라감
              >
                {/* 플레이어 이름: 플레이어 고유 색상 */}
                <span
                  className="font-bold drop-shadow-[0_0_4px_currentColor]"
                  style={{ color: log.playerColor }}
                >
                  {log.playerName}
                </span>
                {/* 스킬 관련 텍스트: 스킬 고유 색상 + 흰색 혼합 */}
                <span className="text-white/80">
                  {/* message에서 이름 부분을 제거하고 나머지만 표시 */}
                  {log.message.replace(log.playerName, '')}
                </span>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
