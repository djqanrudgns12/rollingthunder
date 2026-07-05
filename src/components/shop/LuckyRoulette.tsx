"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { Sparkles, X, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { createClient } from "@/lib/supabase/client";
import { useChipStore } from "@/store/chipStore";
import { useUIStore } from "@/store/uiStore";
import { stampService } from "@/lib/stampService";

// ============================================================
// 1. 포커 족보 세그먼트 상수 정의
// ============================================================
interface Segment {
  id: string;
  name: string;       // 족보 이름
  icon: string;       // 이모지 아이콘
  reward: number;     // 보상 칩
  multiplier: string; // 배율 표시용
  rewardLabel: string;// 보상 라벨 (룰렛 칸에 표시)
  probability: number;// 확률 (0~1)
  color: string;      // 칸 색상
  glowColor: string;  // 글로우 효과 색상
  image: string;      // 생성된 프리미엄 이미지 경로
}

const SEGMENTS: Segment[] = [
  { id: "high_card",    name: "하이카드",       icon: "💨", reward: 0,    multiplier: "0x",    rewardLabel: "꽝",       probability: 0.15, color: "#374151", glowColor: "rgba(55,65,81,0.5)", image: "/images/assets/roulette/high_card_v2.png" },
  { id: "one_pair",     name: "원페어",         icon: "🃏", reward: 150,  multiplier: "0.5x",  rewardLabel: "150C",     probability: 0.20, color: "#9ca3af", glowColor: "rgba(156,163,175,0.5)", image: "/images/assets/roulette/one_pair.png" },
  { id: "two_pair",     name: "투페어",         icon: "🃏", reward: 300,  multiplier: "1x",    rewardLabel: "300C",     probability: 0.25, color: "#22c55e", glowColor: "rgba(34,197,94,0.5)", image: "/images/assets/roulette/two_pair.png" },
  { id: "triple",       name: "트리플",         icon: "🔷", reward: 500,  multiplier: "1.7x",  rewardLabel: "500C",     probability: 0.18, color: "#3b82f6", glowColor: "rgba(59,130,246,0.5)", image: "/images/assets/roulette/triple.png" },
  { id: "straight",     name: "스트레이트",     icon: "⚡", reward: 1000, multiplier: "3.3x",  rewardLabel: "1,000C",   probability: 0.10, color: "#a855f7", glowColor: "rgba(168,85,247,0.5)", image: "/images/assets/roulette/straight.png" },
  { id: "full_house",   name: "풀하우스",       icon: "🏠", reward: 2000, multiplier: "6.7x",  rewardLabel: "2,000C",   probability: 0.07, color: "#f59e0b", glowColor: "rgba(245,158,11,0.5)", image: "/images/assets/roulette/full_house.png" },
  { id: "four_card",    name: "포카드",         icon: "🔥", reward: 3000, multiplier: "10x",   rewardLabel: "3,000C",   probability: 0.04, color: "#ef4444", glowColor: "rgba(239,68,68,0.5)", image: "/images/assets/roulette/four_card.png" },
  { id: "royal_flush",  name: "로얄 플러시",    icon: "👑", reward: 5000, multiplier: "16.7x", rewardLabel: "5,000C",   probability: 0.01, color: "#fbbf24", glowColor: "rgba(251,191,36,0.6)", image: "/images/assets/roulette/royal_flush.png" },
];

const SPIN_COST = 300;
const SPIN_DURATION = 4000; // 4초 회전
const COOLDOWN = 1500;      // 1.5초 쿨다운

// ============================================================
// 2. 가중 확률 랜덤 함수
// ============================================================
function weightedRandom(segments: Segment[]): Segment {
  const rand = Math.random();
  let cumulative = 0;
  for (const seg of segments) {
    cumulative += seg.probability;
    if (rand <= cumulative) return seg;
  }
  return segments[segments.length - 1];
}

// ============================================================
// 메인 컴포넌트
// ============================================================
export default function LuckyRoulette() {
  const { chips, addChipsLocally, deductChipsLocally } = useChipStore();
  const { userProfile, isLoggedIn } = useUIStore();
  const userId = userProfile?.id;

  const [showWheel, setShowWheel] = useState(false);
  const [showOdds, setShowOdds] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Segment | null>(null);
  const [lastResult, setLastResult] = useState<Segment | null>(null);
  const [showResultOverlay, setShowResultOverlay] = useState(false);

  // 창 크기에 따른 동적 휠 반경 계산 (반응형 텍스트 배치 위함)
  const [wheelRadius, setWheelRadius] = useState(135); 
  const wheelContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showWheel && wheelContainerRef.current) {
      const updateRadius = () => {
        if (wheelContainerRef.current) {
          const width = wheelContainerRef.current.clientWidth;
          // 중심축에서의 라벨 배치 거리 (바깥쪽 테두리에 초밀착)
          setWheelRadius(width * 0.43);
        }
      };
      updateRadius();
      window.addEventListener('resize', updateRadius);
      return () => window.removeEventListener('resize', updateRadius);
    }
  }, [showWheel]);

  // ============================================================
  // 3. 스핀 핸들러 — DB 트랜잭션 포함
  // ============================================================
  const handleSpin = useCallback(async () => {
    if (isSpinning) return;
    if (!isLoggedIn || !userId) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    if (chips < SPIN_COST) {
      toast.error(`칩이 부족합니다! (보유: ${chips.toLocaleString()}C / 필요: ${SPIN_COST}C)`);
      return;
    }

    setIsSpinning(true);
    setResult(null);
    setShowResultOverlay(false);

    try {
      const supabase = createClient();
      const { error: deductError } = await supabase.rpc("add_chips", {
        p_user_id: userId,
        p_amount: -SPIN_COST,
        p_reason: "roulette_spin",
      });

      if (deductError) {
        toast.error("칩 차감에 실패했습니다. 다시 시도해주세요.");
        setIsSpinning(false);
        return;
      }

      deductChipsLocally(SPIN_COST);

      const outcome = weightedRandom(SEGMENTS);
      const segmentIndex = SEGMENTS.indexOf(outcome);

      const targetAngle = segmentIndex * 45 + 22.5;
      const fullRotations = (3 + Math.floor(Math.random() * 3)) * 360; 
      const randomOffset = (Math.random() - 0.5) * 20; 
      const newRotation = rotation + fullRotations + (360 - targetAngle) + randomOffset;
      setRotation(newRotation);

      setTimeout(async () => {
        setResult(outcome);
        setShowResultOverlay(true);
        setLastResult(outcome);

        stampService.trackEvent("gacha_spin", 1);
        stampService.flushPlayEvents();

        if (outcome.reward > 0) {
          const { error: rewardError } = await supabase.rpc("add_chips", {
            p_user_id: userId,
            p_amount: outcome.reward,
            p_reason: `roulette_win_${outcome.id}`,
          });

          if (!rewardError) {
            addChipsLocally(outcome.reward);
          }
          if (outcome.reward >= 3000) {
            triggerJackpotEffect(outcome);
          }
        }

        setTimeout(() => {
          setIsSpinning(false);
          setShowResultOverlay(false);
        }, COOLDOWN);
      }, SPIN_DURATION);

    } catch {
      toast.error("네트워크 오류가 발생했습니다.");
      setIsSpinning(false);
    }
  }, [isSpinning, isLoggedIn, userId, chips, rotation, addChipsLocally, deductChipsLocally]);

  // ============================================================
  // 4. 잭팟 연출 효과
  // ============================================================
  const triggerJackpotEffect = (outcome: Segment) => {
    const isRoyal = outcome.id === "royal_flush";
    const isFourCard = outcome.id === "four_card";

    confetti({
      particleCount: isRoyal ? 250 : isFourCard ? 120 : 50,
      spread: isRoyal ? 200 : 120,
      origin: { y: 0.6 },
      colors: ["#fbbf24", "#f59e0b", "#ef4444", "#a855f7", "#22c55e"],
      zIndex: 10000,
    });

    if (isRoyal) {
      setTimeout(() => confetti({ particleCount: 150, angle: 60, spread: 80, origin: { x: 0, y: 0.6 }, zIndex: 10000 }), 300);
      setTimeout(() => confetti({ particleCount: 150, angle: 120, spread: 80, origin: { x: 1, y: 0.6 }, zIndex: 10000 }), 600);
    }
  };

  const getResultMessage = (seg: Segment) => {
    switch (seg.id) {
      case "high_card":   return { text: "다시 도전해보세요!", sub: "아쉽지만 다음 기회를!" };
      case "one_pair":    return { text: "아쉽네요...", sub: `${seg.reward.toLocaleString()}C 획득` };
      case "two_pair":    return { text: "본전!", sub: `${seg.reward.toLocaleString()}C 획득` };
      case "triple":      return { text: "좋아요!", sub: `+${seg.reward.toLocaleString()}C 획득!` };
      case "straight":    return { text: "대박!", sub: `+${seg.reward.toLocaleString()}C 획득!!` };
      case "full_house":  return { text: "🔥 풀하우스!", sub: `+${seg.reward.toLocaleString()}C 대당첨!` };
      case "four_card":   return { text: "🔥🔥 포카드!!!", sub: `+${seg.reward.toLocaleString()}C 잭팟!!` };
      case "royal_flush": return { text: "👑 로얄 플러시!!!", sub: `+${seg.reward.toLocaleString()}C 메가잭팟!!!` };
      default:            return { text: "", sub: "" };
    }
  };

  const getResultStyle = (seg: Segment) => {
    switch (seg.id) {
      case "high_card":   return "text-neutral-400 animate-pulse";
      case "one_pair":    return "text-neutral-300";
      case "two_pair":    return "text-green-400";
      case "triple":      return "text-blue-400";
      case "straight":    return "text-purple-400 animate-bounce";
      case "full_house":  return "text-orange-400 animate-bounce";
      case "four_card":   return "text-red-400 animate-bounce";
      case "royal_flush": return "text-yellow-400 animate-bounce";
      default:            return "";
    }
  };

  return (
    <>
      {/* ========== 배너 (확장된 프리미엄 카드) ========== */}
      <div className="relative rounded-2xl border border-emerald-900/50 bg-gradient-to-br from-emerald-950/80 via-neutral-900 to-black overflow-hidden group shrink-0">
        <div className="relative w-full h-[120px] sm:h-[140px] overflow-hidden">
          <Image
            src="/images/assets/roulette_banner.png"
            alt="행운의 룰렛 배너"
            fill
            className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/95" />
        </div>

        <div className="relative px-5 pb-5 -mt-8 sm:-mt-10 z-10">
          <h3 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 drop-shadow-sm flex items-center gap-2 mb-2 sm:mb-3">
            🎰 행운의 룰렛 — 포커 족보 <Sparkles size={18} className="text-yellow-400" />
          </h3>

          <p className="text-neutral-400 text-sm sm:text-base leading-relaxed mb-5">
            지금 이 순간, 당신의 족보가 결정됩니다.{" "}
            {/* 줄바꿈 방지 적용 */}
            <span className="whitespace-nowrap inline-block">
              <span className="text-yellow-400 font-bold">단 300칩</span>으로 최대{" "}
              <span className="text-yellow-400 font-bold">5,000칩 로얄 플러시!</span>
            </span>
            <br />
            돌리지 않으면, 잭팟도 없습니다.
          </p>

          {lastResult && (
            <div className="mb-4 px-4 py-2.5 bg-neutral-800/80 rounded-xl border border-neutral-700/60 text-xs sm:text-sm shadow-inner">
              <span className="text-neutral-500">최근 결과: </span>
              <span className={`font-bold ${lastResult.reward > 0 ? "text-green-400" : "text-neutral-400"}`}>
                {lastResult.icon} {lastResult.name}
                {lastResult.reward > 0 ? ` → +${lastResult.reward.toLocaleString()}C 획득!` : " → 꽝"}
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setShowWheel(true)}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 sm:py-5 bg-gradient-to-r from-emerald-600 to-green-700 text-white font-extrabold text-sm sm:text-base rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-[1.02] transition-all active:scale-95 border border-emerald-400/30"
            >
              🎰 {SPIN_COST}C 돌리기!
            </button>
            <button
              onClick={() => setShowOdds(true)}
              className="flex items-center gap-2 px-5 py-4 sm:py-5 bg-neutral-800/80 text-neutral-300 font-bold text-sm sm:text-base rounded-xl border border-neutral-700 hover:border-yellow-600/50 hover:text-yellow-400 hover:bg-neutral-800 transition-all shadow-lg"
            >
              <BarChart3 size={18} />
              확률표
            </button>
          </div>
        </div>
      </div>

      {/* ========== 룰렛 게임 모달 (대형화 및 프리미엄 디자인 적용) ========== */}
      {showWheel && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-md" onClick={() => !isSpinning && setShowWheel(false)}>
          <div className="relative w-[95vw] max-w-[540px] bg-gradient-to-b from-neutral-900 to-black rounded-[2rem] border border-neutral-800 shadow-[0_0_50px_rgba(0,0,0,0.8)] p-6 sm:p-8 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* 닫기 버튼 */}
            {!isSpinning && (
              <button onClick={() => setShowWheel(false)} className="absolute top-4 right-4 z-50 text-neutral-500 hover:text-white hover:bg-neutral-700 transition-all bg-neutral-800/80 w-10 h-10 flex items-center justify-center rounded-full shadow-md cursor-pointer">
                <X size={24} />
              </button>
            )}

            <h2 className="text-center text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 mb-8 sm:mb-10 drop-shadow-sm">
              🎰 행운의 룰렛
            </h2>

            {/* 대형 룰렛 휠 영역 */}
            <div className="relative w-[85vw] max-w-[400px] h-[85vw] max-h-[400px] mx-auto mb-8 sm:mb-10" ref={wheelContainerRef}>
              
              {/* 프리미엄 시침 (크기 확대) */}
              <div className="absolute top-[-24px] left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                <svg width="32" height="48" viewBox="0 0 24 36">
                  <defs>
                    <linearGradient id="chromeGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#ffffff"/>
                      <stop offset="30%" stopColor="#e5e7eb"/>
                      <stop offset="70%" stopColor="#9ca3af"/>
                      <stop offset="100%" stopColor="#4b5563"/>
                    </linearGradient>
                    <filter id="pointerGlow">
                      <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#ef4444" floodOpacity="1"/>
                    </filter>
                  </defs>
                  <polygon points="12,36 4,18 12,0 20,18" fill="url(#chromeGrad)" stroke="#4b5563" strokeWidth="0.5" />
                  <circle cx="12" cy="31" r="3.5" fill="#ef4444" filter="url(#pointerGlow)" />
                </svg>
              </div>

              {/* 휠 외곽 메탈 프레임 (두께 증가, 그림자 강화) */}
              <div className="absolute inset-[-12px] rounded-full border-[6px] border-neutral-700 shadow-[0_0_40px_rgba(250,204,21,0.2),inset_0_0_30px_rgba(0,0,0,0.8)] bg-neutral-800" />
              
              {/* 이너 골드 링 */}
              <div className="absolute inset-[-4px] rounded-full border-2 border-yellow-600/60 z-10 pointer-events-none" />

              <div
                className="w-full h-full rounded-full relative overflow-hidden"
                style={{
                  background: `conic-gradient(
                    ${SEGMENTS[0].color} 0deg 45deg,
                    ${SEGMENTS[1].color} 45deg 90deg,
                    ${SEGMENTS[2].color} 90deg 135deg,
                    ${SEGMENTS[3].color} 135deg 180deg,
                    ${SEGMENTS[4].color} 180deg 225deg,
                    ${SEGMENTS[5].color} 225deg 270deg,
                    ${SEGMENTS[6].color} 270deg 315deg,
                    ${SEGMENTS[7].color} 315deg 360deg
                  )`,
                  transform: `rotate(${rotation}deg)`,
                  transition: isSpinning
                    ? `transform ${SPIN_DURATION}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
                    : "none",
                  boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
                }}
              >
                {SEGMENTS.map((_, i) => (
                  <div
                    key={`line-${i}`}
                    className="absolute top-0 left-1/2 w-[2px] h-1/2 bg-black/40 origin-bottom"
                    style={{ transform: `rotate(${i * 45}deg)` }}
                  />
                ))}

                {/* 가독성 극대화된 라벨 */}
                {SEGMENTS.map((seg, i) => {
                  const angle = i * 45 + 22.5;
                  const rad = (angle - 90) * (Math.PI / 180);
                  const x = Math.cos(rad) * wheelRadius;
                  const y = Math.sin(rad) * wheelRadius;
                  
                  // 등급별 점진적 프리미엄 하이라이트 효과
                  let imageGlow = "drop-shadow-md";
                  let containerGlow = "bg-black/30 ring-1 ring-white/10";
                  let behindAura = null;
                  let customTextShadow = "0 2px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,0.8)";
                  
                  switch(seg.id) {
                    case "royal_flush":
                      imageGlow = "drop-shadow-[0_0_15px_rgba(250,204,21,1)]";
                      containerGlow = "bg-yellow-500/20 ring-2 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.8)] scale-110"; // 독보적 크기 및 광원
                      behindAura = <div className="absolute inset-[-40px] bg-yellow-400/40 blur-2xl rounded-full z-[-1] animate-pulse" />;
                      customTextShadow = "0 2px 4px rgba(0,0,0,1), 0 0 10px rgba(0,0,0,1), 0 0 15px rgba(0,0,0,1), 0 0 2px rgba(0,0,0,1), 0 -1px 2px rgba(0,0,0,1)"; // 가독성 극강화
                      break;
                    case "four_card":
                      imageGlow = "drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]";
                      containerGlow = "bg-red-500/10 ring-2 ring-red-400 shadow-[0_0_15px_rgba(239,68,68,0.6)]";
                      behindAura = <div className="absolute inset-[-20px] bg-red-500/30 blur-xl rounded-full z-[-1]" />;
                      break;
                    case "full_house":
                      imageGlow = "drop-shadow-[0_0_10px_rgba(234,88,12,0.8)]";
                      containerGlow = "bg-orange-500/10 ring-1 ring-orange-500 shadow-[0_0_12px_rgba(234,88,12,0.5)]";
                      behindAura = <div className="absolute inset-[-10px] bg-orange-500/20 blur-lg rounded-full z-[-1]" />;
                      break;
                    case "straight":
                      imageGlow = "drop-shadow-[0_0_8px_rgba(168,85,247,0.8)]";
                      containerGlow = "bg-purple-500/10 ring-1 ring-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.4)]";
                      break;
                  }

                  return (
                    <div
                      key={seg.id}
                      className="absolute pointer-events-none flex flex-col items-center justify-center w-[90px]"
                      style={{
                        left: `calc(50% + ${x}px)`,
                        top: `calc(50% + ${y}px)`,
                        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                      }}
                    >
                      {behindAura}
                      {/* 추가된 항목별 프리미엄 이미지 - 크기 확대 */}
                      <div className={`p-1 mb-0.5 rounded-full ${containerGlow} transition-all`}>
                        <img 
                          src={seg.image} 
                          alt={seg.name} 
                          className={`w-10 h-10 sm:w-12 sm:h-12 object-contain ${imageGlow} rounded-full`}
                        />
                      </div>
                      <div 
                        className="text-[10px] sm:text-[11px] font-black text-white leading-tight mt-0.5"
                        style={{ textShadow: customTextShadow }}
                      >
                        {seg.name}
                      </div>
                      <div 
                        className={`text-xs sm:text-sm font-black ${seg.reward === 0 ? "text-neutral-300" : "text-yellow-400"} drop-shadow-md leading-tight mt-0.5`}
                        style={{ textShadow: customTextShadow }}
                      >
                        {seg.rewardLabel}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 확대된 중앙 원 (고급화) */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-neutral-800 via-neutral-900 to-black border-4 border-yellow-600 shadow-[0_0_30px_rgba(0,0,0,0.9),inset_0_2px_10px_rgba(255,255,255,0.1)] flex items-center justify-center z-10">
                <div className="text-center drop-shadow-md">
                  <div className="text-yellow-400 text-sm sm:text-base font-black">{SPIN_COST}C</div>
                  <div className="text-neutral-500 text-[9px] sm:text-[10px] tracking-widest font-bold mt-0.5">SPIN</div>
                </div>
              </div>
            </div>

            {showResultOverlay && result && (
              <div className={`text-center mb-6 py-4 px-5 rounded-2xl border-2 shadow-xl ${
                result.reward >= 3000
                  ? "bg-yellow-950/40 border-yellow-500/60 animate-pulse"
                  : result.reward > 0
                    ? "bg-emerald-950/40 border-emerald-500/40"
                    : "bg-neutral-900 border-neutral-700"
              }`}>
                <div className={`text-2xl sm:text-3xl font-black ${getResultStyle(result)}`}>
                  {result.icon} {getResultMessage(result).text}
                </div>
                <div className="text-base sm:text-lg text-white font-bold mt-2">
                  {getResultMessage(result).sub}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center text-sm text-neutral-400 mb-4 px-4 bg-black/40 py-3 rounded-xl border border-neutral-800">
              <span>💰 보유: <span className="text-white font-bold text-base">{chips.toLocaleString()}C</span></span>
              <span>비용: <span className="text-yellow-400 font-bold text-base">{SPIN_COST}C</span></span>
            </div>

            <button
              onClick={handleSpin}
              disabled={isSpinning || chips < SPIN_COST}
              className={`w-full py-4 sm:py-5 rounded-2xl font-black text-lg transition-all shadow-xl ${
                isSpinning
                  ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
                  : chips < SPIN_COST
                    ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
                    : "bg-gradient-to-r from-emerald-600 to-green-700 text-white hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:scale-[1.02] active:scale-95 border border-emerald-400/50"
              }`}
            >
              {isSpinning ? "🎰 결과 확인 중..." : chips < SPIN_COST ? `칩 부족 (${chips.toLocaleString()}C)` : `🎰 ${SPIN_COST}C 족보 뽑기!`}
            </button>
          </div>
        </div>
      )}

      {/* ========== 확률표 팝업 (박스 디자인 초고도화) ========== */}
      {showOdds && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md" onClick={() => setShowOdds(false)}>
          <div
            className="relative w-[95vw] max-w-[540px] rounded-[2rem] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(145deg, rgba(20,20,20,0.95) 0%, rgba(10,10,10,0.98) 100%)",
              border: "1px solid rgba(250, 204, 21, 0.3)",
              boxShadow: "0 0 80px rgba(250, 204, 21, 0.1), 0 30px 60px rgba(0,0,0,0.9)",
            }}
          >
            <div className="h-1.5 w-full bg-gradient-to-r from-yellow-700 via-yellow-400 to-yellow-700" />

            <div className="p-6 sm:p-8 max-h-[85vh] overflow-y-auto custom-scrollbar">
              <button onClick={() => setShowOdds(false)} className="absolute top-4 right-4 z-50 text-neutral-500 hover:text-white hover:bg-neutral-700 transition-all bg-neutral-800/80 w-10 h-10 flex items-center justify-center rounded-full shadow-md cursor-pointer">
                <X size={20} />
              </button>

              <h2 className="text-center text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-600 mb-6 sm:mb-8 drop-shadow-sm">
                🎰 룰렛 등급별 확률표
              </h2>

              {/* 통합 박스형 프리미엄 확률표 리스트 */}
              <div className="bg-neutral-900/60 border border-neutral-700/50 rounded-2xl overflow-hidden shadow-inner backdrop-blur-sm">
                {SEGMENTS.map((seg, index) => {
                  const isLast = index === SEGMENTS.length - 1;
                  
                  // 프리미엄 하이라이트 스타일 (스트레이트 이상)
                  let highlightStyle = "hover:bg-neutral-800/40";
                  let textStyle = "text-white/90";
                  let rewardStyle = "text-yellow-400";
                  let percentStyle = "text-neutral-400";

                  switch(seg.id) {
                    case "royal_flush":
                      // 주변을 은은하게 감싸는 아웃라인 및 인너 섀도우 극대화
                      highlightStyle = "bg-gradient-to-r from-yellow-500/20 via-yellow-400/5 to-yellow-500/10 shadow-[0_0_20px_rgba(250,204,21,0.2),inset_0_0_15px_rgba(250,204,21,0.2)] border-y border-yellow-500/30";
                      textStyle = "text-yellow-100 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)] font-black text-sm sm:text-base"; // 이름 더 크고 밝게
                      rewardStyle = "text-yellow-300 drop-shadow-[0_0_10px_rgba(250,204,21,1)] text-sm sm:text-base"; // 보상도 밝게
                      percentStyle = "text-yellow-300 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]";
                      break;
                    case "four_card":
                      highlightStyle = "bg-gradient-to-r from-red-950/40 to-transparent shadow-[inset_4px_0_0_rgba(239,68,68,0.6)]";
                      textStyle = "text-red-100";
                      rewardStyle = "text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]";
                      percentStyle = "text-red-400";
                      break;
                    case "full_house":
                      // 풀하우스는 오렌지/브론즈 톤으로 내려서 로얄플러시(퓨어 골드)와 확연히 구분
                      highlightStyle = "bg-gradient-to-r from-orange-950/60 to-transparent shadow-[inset_4px_0_0_rgba(234,88,12,0.6)]";
                      textStyle = "text-orange-200";
                      rewardStyle = "text-orange-500 drop-shadow-[0_0_5px_rgba(234,88,12,0.5)]";
                      percentStyle = "text-orange-500";
                      break;
                    case "straight":
                      highlightStyle = "bg-gradient-to-r from-purple-950/40 to-transparent shadow-[inset_4px_0_0_rgba(168,85,247,0.6)]";
                      textStyle = "text-purple-100";
                      rewardStyle = "text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]";
                      percentStyle = "text-purple-400";
                      break;
                  }
                  
                  return (
                    <div
                      key={seg.id}
                      className={`flex items-center justify-between p-3 sm:p-3.5 transition-all ${
                        !isLast ? "border-b border-neutral-800/80" : ""
                      } ${highlightStyle}`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div
                          className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: seg.color, boxShadow: `0 0 8px ${seg.glowColor}` }}
                        />
                        <span className={`text-xs sm:text-sm font-bold ${textStyle}`}>
                          <span className="mr-1.5 sm:mr-2 text-base sm:text-lg">{seg.icon}</span> 
                          {seg.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4">
                        <span className={`flex items-center justify-end gap-1 text-xs sm:text-sm font-black w-24 sm:w-28 ${seg.reward === 0 ? "text-neutral-500" : rewardStyle}`}>
                          {seg.reward === 0 ? (
                            "꽝"
                          ) : (
                            <>
                              <span className="text-[10px] sm:text-xs">🪙</span>
                              {seg.reward.toLocaleString()}
                            </>
                          )}
                        </span>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <div className="w-12 sm:w-16 h-1.5 bg-black/60 rounded-full overflow-hidden border border-neutral-800">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${seg.probability * 100 * 4}%`,
                                backgroundColor: seg.color,
                                boxShadow: `0 0 4px ${seg.glowColor}`,
                              }}
                            />
                          </div>
                          <span className={`text-[10px] sm:text-xs w-7 sm:w-8 text-right font-mono font-bold ${percentStyle}`}>
                            {(seg.probability * 100).toFixed(seg.probability < 0.1 ? 0 : 0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-5 border-t border-neutral-800 text-center bg-black/20 rounded-xl p-4">
                <span className="text-sm text-neutral-400">
                  투자: <span className="text-white font-bold text-base">{SPIN_COST}C</span> &nbsp;&nbsp;|&nbsp;&nbsp; 기대값: <span className="text-emerald-400 font-bold text-base">~605C (2.02배)</span>
                </span>
              </div>

              <button
                onClick={() => setShowOdds(false)}
                className="w-full mt-6 py-4 rounded-xl bg-neutral-800/80 text-white font-bold text-base border border-neutral-700 hover:bg-neutral-700 transition-all shadow-lg"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
