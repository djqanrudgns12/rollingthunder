'use client'

import { memo, useMemo } from 'react'
import { useGameStore } from '@/store/gameStore'
import { ParticipantRank } from '@/engine/RankingTracker'
import { cn } from '@/lib/utils'
// [성능 최적화] framer-motion 제거 → CSS 애니메이션 마이그레이션
// 왜: framer-motion의 layout 애니메이션은 매 프레임 JS 기반 FLIP 계산 + React re-render를 발생시킴.
// CSS transition으로 순위 재정렬 시 부드러운 위치 전환을 구현하되 메인 스레드 부하 0.
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

  const totalCount = combinedRankings.length;
  const sizes = useMemo(() => {
    const count = totalCount;
    if (count <= 5) return { name: 26, rank: 30, py: 'py-2', gap: 'gap-[3px]' };
    if (count <= 10) return { name: 22, rank: 26, py: 'py-1.5', gap: 'gap-[2px]' };
    if (count >= 28) return { name: 15, rank: 18, py: 'py-0', gap: 'gap-0' };
    
    // Smooth linear interpolation between 10 and 28 participants
    const ratio = (count - 10) / (28 - 10);
    const name = Math.round(22 - (7 * ratio)); // Scales 22 down to 15
    const rank = Math.round(26 - (8 * ratio)); // Scales 26 down to 18
    
    const py = count <= 15 ? 'py-1' : count <= 20 ? 'py-0.5' : 'py-0';
    const gap = count <= 20 ? 'gap-[1px]' : 'gap-0';
    
    return { name, rank, py, gap };
  }, [totalCount]);

  const getRankDisplay = (rank: number, isFinished: boolean) => {
    const isTargetRank = isWinner(rank)
    return (
      <span className={cn(
        "font-black font-mono tabular-nums leading-none tracking-tighter whitespace-nowrap",
        isTargetRank ? "text-[#00ffcc] drop-shadow-[0_0_8px_rgba(0,255,204,0.8)]" : 
        isFinished ? "text-white/80" : "text-white/60"
      )}
      style={{ fontSize: `${sizes.rank}px` }}
      >
        {rank}<span className="ml-[1px] opacity-80" style={{ fontSize: `${Math.max(10, sizes.rank * 0.45)}px` }}>{getOrdinalSuffix(rank)}</span>
      </span>
    )
  }

  const isWinner = (rank: number) => {
    switch (gameMode) {
      case 'speed': return rank <= targetWinnerCount;
      case 'custom': return rank === customWinningRank;
      case 'random': return randomWinningRanks.includes(rank);
      case 'turtle': {
        const eliminated = totalParticipantsCount - targetWinnerCount;
        return rank > eliminated;
      }
      default: return false;
    }
  }

  const getDynamicFontSize = (name: string) => {
    if (name.length > 8) return Math.max(sizes.name - 3, 13)
    return sizes.name
  }

  return (
    <div className="absolute top-4 right-4 z-50 flex flex-col pointer-events-auto w-64 max-w-[30vw]"
      style={{ height: 'calc(100vh - 2rem)' }}
    >
      {/* ═══════════════ 순위보드 영역 (상단 80%) ═══════════════ */}
      <div className="flex-[4] min-h-0 bg-black/30 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden flex flex-col">
        <div className={cn("flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-1 flex flex-col", sizes.gap)}>
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
                  // [성능 최적화] CSS 애니메이션으로 교체 — framer-motion의 scaleX 대체
                  <div 
                    className="absolute -top-[1.5px] left-0 right-0 h-[2px] bg-red-500 shadow-[0_0_8px_#ef4444] z-20 origin-left"
                    style={{ animation: 'cutoffExpand 0.3s ease-out forwards' }}
                  />
                )}
                <div
                  className={cn(
                    "relative flex items-center gap-2 px-2 rounded-xl overflow-hidden shadow-md border transition-all duration-300",
                    sizes.py,
                    isTargetRank ? "border-[#00ffcc] shadow-[0_0_15px_rgba(0,255,204,0.5)] z-10" :
                    isFinished ? "border-white/20 shadow-[0_2px_12px_rgba(0,0,0,0.5)] z-10" : 
                    "border-white/5 backdrop-blur-xl",
                    isWinFinished ? "bg-black/80" :
                    isFinished ? "bg-[#2a2a2a]/90" : "bg-black/30"
                  )}
                  style={{
                    animation: isWinFinished 
                      ? 'leaderboardWinPop 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards'
                      : 'leaderboardSlideIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
                  }}
                >
                  {/* Light Sweep Effect for Winners ONLY WHEN FINISHED */}
                  {isWinFinished && (
                    <div 
                      className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-20deg] z-20 pointer-events-none"
                      style={{ animation: 'lightSweep 1.2s ease-in-out 0.1s forwards' }}
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
              </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 순위보드와 스킬로그 사이 간격 */}
      <div className="h-2 shrink-0" />

      {/* ═══════════════ 스킬 로그 영역 (하단 20%) ═══════════════ */}
      {/* 스타크래프트 대화창처럼 어두운 반투명 박스에 고정. 로그가 아래서부터 쌓인다. */}
      <div className="flex-1 min-h-0 bg-black/60 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
        <SkillLogOverlay />
      </div>
    </div>
  )
}

export default memo(LiveLeaderboard)
