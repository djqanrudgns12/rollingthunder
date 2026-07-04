'use client'

import { memo, useMemo } from 'react'
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

// memo: 부모(PhysicsCanvas) 재렌더 시 props(rankings/finishedFeed)가 같으면 스킵.
// (skillCooldowns 구독에 의한 자체 재렌더는 쿨타임 게이지 표시에 필요 — 유지)
function LiveLeaderboard({ rankings, finishedFeed = [] }: LiveLeaderboardProps) {
  const survivors = useGameStore(state => state.survivors)
  const skillCooldowns = useGameStore(state => state.skillCooldowns)

  const gameMode = useGameStore(state => state.gameMode)
  const targetWinnerCount = useGameStore(state => state.targetWinnerCount)
  const customWinningRank = useGameStore(state => state.customWinningRank)
  const randomWinningRanks = useGameStore(state => state.randomWinningRanks)
  const totalParticipantsCount = useGameStore(state => state.participants.length)

  // id → survivor 사전(참가자 수 n에 대해 기존 map 안 find의 O(n²) 스캔 제거)
  const survivorById = useMemo(() => new Map(survivors.map(s => [s.id, s])), [survivors])

  // ── 순위 목록 구성 (입력이 바뀔 때만 재계산) ──
  // 완주자(finished)를 맨 위에, 그 아래에 레이스 진행 중인 참가자를 현재 순위대로 표시한다.
  const combinedRankings = useMemo(() => {
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
        const survivor = survivorById.get(p.id)
        return {
          id: p.id,
          rank: activeRankOffset++,
          isFinished: false,
          survivor: survivor || { id: p.id, name: p.id, color: '#ffffff' }
        }
      })

    return [...finishedItems, ...activeItems]
  }, [rankings, finishedFeed, survivorById])

  const getOrdinalSuffix = (i: number) => {
    const j = i % 10, k = i % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  }

  const getRankDisplay = (rank: number, isFinished: boolean) => {
    const isTargetRank = isWinner(rank)
    return (
      <span className={cn(
        "text-lg font-black font-mono tabular-nums leading-none tracking-tighter whitespace-nowrap",
        isTargetRank ? "text-[#00ffcc] drop-shadow-[0_0_8px_rgba(0,255,204,0.8)]" : 
        isFinished ? "text-white/80" : "text-white/60"
      )}>
        {rank}<span className="text-[10px] ml-[1px] opacity-80">{getOrdinalSuffix(rank)}</span>
      </span>
    )
  }

  const isWinner = (rank: number) => {
    if (gameMode === 'speed') return rank <= targetWinnerCount;
    if (gameMode === 'custom') return rank === customWinningRank;
    if (gameMode === 'turtle') return rank > totalParticipantsCount - targetWinnerCount;
    if (gameMode === 'random') return randomWinningRanks.includes(rank);
    return false;
  }

  // 참가자 수에 따른 기본 패딩 조절
  const compactMode = totalParticipantsCount > 15;

  // 이름 길이에 따른 폰트 크기 계산 (동적 폰트 스케일링)
  const getDynamicFontSize = (name: string) => {
    const baseSize = compactMode ? 13 : 14;
    const lengthPenalty = Math.max(0, name.length - 4) * 0.7; // 4글자 초과시 크기 감소
    return Math.max(9, baseSize - lengthPenalty); // 최소 9px 보장
  }

  return (
    // 전체 우측 패널: 순위보드(상단 ~67%) + 스킬 로그(하단 ~33%)를 세로로 나눈다.
    <div className="absolute top-4 right-4 z-50 flex flex-col pointer-events-auto w-56 max-w-[30vw]"
      style={{ height: 'calc(100vh - 2rem)' }}
    >
      {/* ═══════════════ 순위보드 영역 (상단 67%) ═══════════════ */}
      <div className="flex-[2] min-h-0 bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-1.5 flex flex-col gap-[3px]">
          <AnimatePresence mode="popLayout">
            {combinedRankings.map((p, index) => {
              const isFinished = p.isFinished;
              const isTargetRank = isWinner(p.rank);
              const isWinFinished = isFinished && isTargetRank;
              const color = p.survivor.color || '#fff';
              const cooldownProgress = skillCooldowns[p.id] ?? 0;
              const prevRank = index > 0 ? combinedRankings[index - 1].rank : 0;
              
              // 컷오프 라인 (Danger Line) 로직: 커스텀은 단일 타겟이므로 제외
              const showCutoff = gameMode === 'speed'
                && prevRank === targetWinnerCount 
                && p.rank === prevRank + 1;

              return (
                <div key={p.id} className="relative">
                  {showCutoff && (
                    <motion.div 
                      initial={{ opacity: 0, scaleX: 0 }}
                      animate={{ opacity: 1, scaleX: 1 }}
                      className="absolute -top-[1.5px] left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_8px_#ef4444] z-20 origin-left" 
                    />
                  )}
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: 16, scale: 0.95 }}
                    animate={
                      isWinFinished ? { 
                        opacity: 1, x: 0, scale: [1, 1.05, 1],
                        transition: { scale: { duration: 0.4, ease: "easeOut" } } 
                      } : { 
                        opacity: 1, x: 0, scale: 1 
                      }
                    }
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                    className={cn(
                      "relative flex items-center gap-2 px-2 rounded-xl overflow-hidden shadow-md border transition-all duration-300",
                      compactMode ? "py-0.5" : "py-1",
                      isTargetRank ? "border-[#00ffcc] shadow-[0_0_15px_rgba(0,255,204,0.5)] z-10" :
                      isFinished ? "border-white/20 shadow-[0_2px_12px_rgba(0,0,0,0.5)] z-10" : 
                      "border-white/5 backdrop-blur-xl",
                      isWinFinished ? "bg-black/80" :
                      isFinished ? "bg-[#2a2a2a]/90" : "bg-black/30"
                    )}
                  >
                    {/* Light Sweep Effect for Winners ONLY WHEN FINISHED */}
                    {isWinFinished && (
                      <motion.div
                        initial={{ left: '-100%' }}
                        animate={{ left: '200%' }}
                        transition={{ duration: 1.2, ease: "easeInOut", delay: 0.1 }}
                        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] z-20 pointer-events-none"
                      />
                    )}
                    
                    {/* 완주자 배경 그라데이션 글로우 */}
                    {isFinished && (
                      <div className={cn(
                        "absolute inset-0 opacity-20 bg-gradient-to-r",
                        isTargetRank ? "from-[#00ffcc] to-[#00b3ff]" : "from-white/20 to-transparent"
                      )} />
                    )}

                  {/* ── 쿨타임 게이지 (하단 프로그레스 바) ── */}
                  {!isFinished && cooldownProgress > 0 && (
                    <div 
                      className="absolute bottom-0 left-0 h-1 rounded-bl-xl transition-[width] duration-100 ease-linear z-20"
                      style={{
                        width: `${cooldownProgress * 100}%`,
                        background: color,
                        boxShadow: cooldownProgress > 0.9 
                          ? `0 0 10px ${color}, 0 0 20px ${color}`
                          : `0 0 4px ${color}`,
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
                  <div className="relative z-10 flex-1 flex items-center justify-between min-w-0">
                    <span 
                      className={cn(
                        "font-bold drop-shadow-sm flex-1 whitespace-nowrap overflow-hidden",
                        isTargetRank ? "text-white" : isFinished ? "text-white/90" : "text-white/80"
                      )}
                      style={{ fontSize: `${getDynamicFontSize(p.survivor.name)}px` }}
                    >
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

                  {/* 우측 라인 강조 */}
                  {(isTargetRank || isFinished) && (
                    <div className={cn(
                      "absolute right-0 top-0 bottom-0 w-1 shadow-[0_0_10px_currentColor]",
                      isTargetRank ? "bg-[#00ffcc]" : "bg-white/30"
                    )} />
                  )}
                </motion.div>
                </div>
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

export default memo(LiveLeaderboard)
