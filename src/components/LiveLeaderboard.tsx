'use client'

import { useGameStore } from '@/store/gameStore'
import { ParticipantRank } from '@/engine/RankingTracker'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { Crown, Medal, Award } from 'lucide-react'
import SkillLogOverlay from './SkillLogOverlay'

interface LiveLeaderboardProps {
  rankings: ParticipantRank[]
  finishedFeed?: {rank: number, survivor: any}[]
}

export default function LiveLeaderboard({ rankings, finishedFeed = [] }: LiveLeaderboardProps) {
  const survivors = useGameStore(state => state.survivors)
  const skillCooldowns = useGameStore(state => state.skillCooldowns)
  
  // ── 순위 목록 구성 ──
  // 완주자(finished)를 맨 위에, 그 아래에 레이스 진행 중인 참가자를 현재 순위대로 표시한다.
  const finishedItems = finishedFeed.map(f => ({
    id: f.survivor.id,
    rank: f.rank,
    isFinished: true,
    survivor: f.survivor
  }))

  const finishedIds = new Set(finishedItems.map(f => f.id))

  let activeRankOffset = finishedItems.length + 1;
  const activeItems = rankings
    .filter(p => !finishedIds.has(p.id))
    .map(p => {
      const survivor = survivors.find(s => s.id === p.id)
      return {
        id: p.id,
        rank: activeRankOffset++,
        isFinished: false,
        survivor: survivor || { id: p.id, name: p.id, color: '#ffffff' }
      }
    })

  const combinedRankings = [...finishedItems, ...activeItems]

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-4 h-4 text-[#FFD700]" />
    if (rank === 2) return <Medal className="w-4 h-4 text-[#C0C0C0]" />
    if (rank === 3) return <Medal className="w-4 h-4 text-[#CD7F32]" />
    return <Award className="w-4 h-4 text-[#00ffcc]" />
  }

  const getRankGradient = (rank: number) => {
    if (rank === 1) return "from-[#FFD700] to-[#FFA500]"
    if (rank === 2) return "from-[#E0E0E0] to-[#A0A0A0]"
    if (rank === 3) return "from-[#CD7F32] to-[#A0522D]"
    return "from-[#00ffcc] to-[#00b3ff]"
  }

  // ── 등수 표시 로직 ──
  // 1~3등은 아이콘(왕관/메달)으로, 4등 이후는 숫자로 표시한다.
  // 왜 이렇게 분리하나: 숫자가 너무 작으면 큰 화면에서 안 보이고,
  // 너무 크면 2자리 수에서 잘린다. 따라서 아이콘 사용 시와 숫자 표기 시의
  // 최소 폭(min-width)을 다르게 설정하여 가독성을 보장한다.
  const getRankDisplay = (rank: number, isFinished: boolean) => {
    // 완주자 + 1~3등: 아이콘 표시
    if (isFinished && rank <= 3) {
      return (
        <div className="drop-shadow-[0_0_6px_currentColor]">
          {getRankIcon(rank)}
        </div>
      )
    }

    // 4등 이후 또는 진행 중: 숫자 표시
    // font-size를 고정(text-lg ≈ 18px)하여 큰 화면에서도 잘 보이면서
    // 2자리 수(10, 20)에도 잘리지 않도록 min-w를 넉넉히 잡는다.
    return (
      <span className={cn(
        // text-lg: 큰 화면에서도 충분히 읽히는 크기 (18px)
        // font-black: 두꺼운 폰트로 시인성 확보
        // tabular-nums: 숫자 폭을 고정해 등수 변동 시 레이아웃 흔들림 방지
        "text-lg font-black font-mono tabular-nums leading-none",
        isFinished 
          ? (rank === 1 ? "text-[#FFD700]" : rank === 2 ? "text-[#C0C0C0]" : rank === 3 ? "text-[#CD7F32]" : "text-[#00ffcc]")
          : "text-white/60"
      )}>
        {rank}
      </span>
    )
  }

  return (
    // 전체 우측 패널: 순위보드(상단 ~67%) + 스킬 로그(하단 ~33%)를 세로로 나눈다.
    <div className="absolute top-4 right-4 z-50 flex flex-col pointer-events-auto w-56 max-w-[35vw]"
      style={{ height: 'calc(100vh - 2rem)' }}
    >
      {/* ═══════════════ 순위보드 영역 (상단 67%) ═══════════════ */}
      <div className="flex-[2] min-h-0 bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-1.5 flex flex-col gap-[3px]">
          <AnimatePresence mode="popLayout">
            {combinedRankings.map((p) => {
              const isFinished = p.isFinished;
              const color = p.survivor.color || '#fff';
              // 쿨타임 진행률 (0.0 ~ 1.0). 키가 없으면 0(초기 상태)
              const cooldownProgress = skillCooldowns[p.id] ?? 0;

              return (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: 16, scale: 0.95 }}
                  animate={{ 
                    opacity: 1, 
                    x: 0, 
                    scale: 1, 
                  }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                  className={cn(
                    // ── 글자 잘림 및 2줄 방지 핵심 로직 ──
                    // overflow-hidden: 내부 요소가 박스를 넘어가는 것을 차단
                    // 높이(py-1.5): 기존 py-3에서 축소하여 컴팩트하게
                    "relative flex items-center gap-2 px-3 py-1.5 rounded-xl overflow-hidden",
                    "shadow-md border backdrop-blur-xl transition-all duration-300",
                    isFinished 
                      ? "bg-black/70 border-white/20 shadow-[0_2px_12px_rgba(0,0,0,0.5)] z-10" 
                      : "bg-black/30 border-white/5"
                  )}
                >
                  {/* 완주자 배경 그라데이션 글로우 */}
                  {isFinished && (
                    <div className={cn(
                      "absolute inset-0 opacity-10 bg-gradient-to-r",
                      getRankGradient(p.rank)
                    )} />
                  )}

                  {/* ── 쿨타임 게이지 (배경 로딩 바) ── */}
                  {/* 왜 배경 전체를 채우는가: 별도 선형 바보다 게임에서 훨씬 직관적이고
                      시각적으로 '에너지가 차오르는' 느낌을 줄 수 있다. */}
                  {!isFinished && cooldownProgress > 0 && (
                    <div 
                      className="absolute inset-0 rounded-xl transition-[width] duration-100 ease-linear"
                      style={{
                        width: `${cooldownProgress * 100}%`,
                        background: `linear-gradient(90deg, ${color}15, ${color}30)`,
                        // 쿨타임 90% 이상 시 더 밝게 빛나서 "곧 터진다!"는 시각적 힌트
                        boxShadow: cooldownProgress > 0.9 
                          ? `inset 0 0 20px ${color}40, 0 0 8px ${color}30`
                          : 'none',
                      }}
                    />
                  )}

                  {/* ── 등수 표시 영역 ── */}
                  {/* min-w-[2rem]: 2자리 수(10, 20 등)도 잘리지 않는 최소 폭 보장
                      shrink-0: Flex 축소 방지 → 이름이 아무리 길어도 등수 영역은 고정 */}
                  <div className="relative z-10 shrink-0 flex items-center justify-center min-w-[2rem]">
                    {getRankDisplay(p.rank, isFinished)}
                  </div>

                  {/* ── 이름 + 색상 도트 ── */}
                  {/* min-w-0: Flexbox에서 자식의 text-overflow가 작동하려면 필수.
                      없으면 텍스트가 부모를 밀어내서 레이아웃이 깨진다. */}
                  <div className="relative z-10 flex-1 flex items-center justify-between min-w-0">
                    <span className={cn(
                      // truncate = overflow-hidden + text-ellipsis + whitespace-nowrap 의 축약형
                      // → 어떤 길이의 이름이든 1줄로 표시하고 넘치면 "..." 처리
                      "font-bold text-[13px] truncate drop-shadow-sm flex-1",
                      isFinished ? "text-white" : "text-white/80"
                    )}>
                      {p.survivor.name}
                    </span>
                    
                    {/* 플레이어 고유 색상 도트 */}
                    <div 
                      className={cn(
                        "w-2.5 h-2.5 rounded-full shadow-[0_0_8px_currentColor] shrink-0 ml-2",
                        isFinished && "w-3 h-3 border border-white/50"
                      )}
                      style={{ backgroundColor: color, color: color }} 
                    />
                  </div>

                  {/* 완주자 우측 라인 강조 */}
                  {isFinished && p.rank > 3 && (
                    <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-[#00ffcc] shadow-[0_0_10px_#00ffcc]" />
                  )}
                  {isFinished && p.rank <= 3 && (
                    <div className={cn(
                      "absolute right-0 top-0 bottom-0 w-1 shadow-[0_0_10px_currentColor]",
                      p.rank === 1 ? "bg-[#FFD700]" : p.rank === 2 ? "bg-[#C0C0C0]" : "bg-[#CD7F32]"
                    )} />
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* 순위보드와 스킬로그 사이 간격 */}
      <div className="h-2 shrink-0" />

      {/* ═══════════════ 스킬 로그 영역 (하단 33%) ═══════════════ */}
      {/* 스타크래프트 대화창처럼 어두운 반투명 박스에 고정. 로그가 아래서부터 쌓인다. */}
      <div className="flex-[1] min-h-0 bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
        <SkillLogOverlay />
      </div>
    </div>
  )
}
