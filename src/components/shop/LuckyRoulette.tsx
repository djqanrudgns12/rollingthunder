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
  { id: "high_card",    name: "하이카드",       icon: "💨", reward: 0,    multiplier: "0x",    rewardLabel: "꽝",       probability: 0.400, color: "#374151", glowColor: "rgba(55,65,81,0.5)", image: "/images/assets/roulette/high_card_v2.png" },
  { id: "one_pair",     name: "원페어",         icon: "🃏", reward: 150,  multiplier: "0.5x",  rewardLabel: "150C",     probability: 0.250, color: "#9ca3af", glowColor: "rgba(156,163,175,0.5)", image: "/images/assets/roulette/one_pair.png" },
  { id: "two_pair",     name: "투페어",         icon: "🃏", reward: 300,  multiplier: "1x",    rewardLabel: "300C",     probability: 0.200, color: "#22c55e", glowColor: "rgba(34,197,94,0.5)", image: "/images/assets/roulette/two_pair.png" },
  { id: "triple",       name: "트리플",         icon: "🔷", reward: 500,  multiplier: "1.7x",  rewardLabel: "500C",     probability: 0.080, color: "#3b82f6", glowColor: "rgba(59,130,246,0.5)", image: "/images/assets/roulette/triple.png" },
  { id: "straight",     name: "스트레이트",     icon: "⚡", reward: 1000, multiplier: "3.3x",  rewardLabel: "1,000C",   probability: 0.040, color: "#a855f7", glowColor: "rgba(168,85,247,0.5)", image: "/images/assets/roulette/straight.png" },
  { id: "full_house",   name: "풀하우스",       icon: "🏠", reward: 2000, multiplier: "6.7x",  rewardLabel: "2,000C",   probability: 0.018, color: "#f59e0b", glowColor: "rgba(245,158,11,0.5)", image: "/images/assets/roulette/full_house.png" },
  { id: "four_card",    name: "포카드",         icon: "🔥", reward: 3000, multiplier: "10x",   rewardLabel: "3,000C",   probability: 0.009, color: "#ef4444", glowColor: "rgba(239,68,68,0.5)", image: "/images/assets/roulette/four_card.png" },
  { id: "royal_flush",  name: "로얄 플러시",    icon: "👑", reward: 5000, multiplier: "16.7x", rewardLabel: "5,000C",   probability: 0.003, color: "#fbbf24", glowColor: "rgba(251,191,36,0.6)", image: "/images/assets/roulette/royal_flush.png" },
];

const SPIN_COST = 300;
const COOLDOWN = 1500;      // 1.5초 쿨다운

// ============================================================
// 물리 상수 — 실제 룰렛 물리와 유사하게 튜닝
// ============================================================
const PHYSICS = {
  FRICTION: 0.991,           // 매 프레임 속도 감쇠율. 낮을수록 빠리 멈춤
  STOP_THRESHOLD: 0.08,      // 이 속도(도/프레임) 이하면 정지 판정
  SPRING_K: 0.5,             // 핀 복원 스프링 강성 (Hooke의 법칙 k). 클수록 빠리 원위치
  DAMPING: 0.10,             // 핀 진동 감쇠 계수 (critical damping의 ~30%). 2~3회 진동 후 정지
  IMPULSE_BASE: -18,         // peg 충돌 시 핀에 가해지는 기본 토크
  MAX_PIN_ANGLE: -30,        // 핀 최대 기울기 제한 (도)
  MIN_ROTATIONS: 4,          // 최소 회전 횟수 (시각적 만족감)
  MAX_ROTATIONS: 7,          // 최대 회전 횟수
} as const;

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
  const [result, setResult] = useState<Segment | null>(null);
  const [lastResult, setLastResult] = useState<Segment | null>(null);
  const [showResultOverlay, setShowResultOverlay] = useState(false);

  // 창 크기에 따른 동적 휠 반경 계산 (반응형 텍스트 배치 위함)
  const [wheelRadius, setWheelRadius] = useState(135); 
  const wheelContainerRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // 물리 엔진 상태 및 DOM Ref
  // ============================================================
  const wheelDomRef = useRef<HTMLDivElement>(null);    // 휠 DOM 직접 조작용
  const pinDomRef = useRef<SVGSVGElement>(null);       // 핀 SVG DOM 직접 조작용
  const audioCtxRef = useRef<AudioContext | null>(null); // 싱글턴 AudioContext
  const rafIdRef = useRef<number>(0);                  // rAF ID (정리용)
  const wheelAngleRef = useRef(0);                     // 현재 휠 누적 각도

  // 물리 루프에서 사용하는 미세 상태들 (React re-render 불필요)
  const physicsRef = useRef({
    velocity: 0,          // 휠 각속도 (deg/frame)
    pinAngle: 0,          // 핀 현재 각도 (deg)
    pinVelocity: 0,       // 핀 각속도 (deg/frame)
    lastBoundary: -1,     // 마지막으로 지나간 peg 번호
    targetAngle: 0,       // 목표 정지 각도
    outcome: null as Segment | null, // 확정된 결과
  });

  useEffect(() => {
    if (showWheel && wheelContainerRef.current) {
      const updateRadius = () => {
        if (wheelContainerRef.current) {
          const width = wheelContainerRef.current.clientWidth;
          // 중심축에서의 라벨 배치 거리 (안정적인 위치인 38%)
          setWheelRadius(width * 0.38);
        }
      };
      updateRadius();
      window.addEventListener('resize', updateRadius);
      return () => window.removeEventListener('resize', updateRadius);
    }
  }, [showWheel]);

  // 컴포넌트 언마운트 시 rAF 정리
  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  // ============================================================
  // 사운드 시스템 — 싱글턴 AudioContext + 속도 연동 볼륨
  // ============================================================
  const playTickSound = useCallback((velocityRatio: number) => {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;

      // 싱글턴: 전체 세션에서 AudioContext 한 번만 생성
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // 나무 막대기가 peg에 부딯히는 느낌: 삼각파 → 낮은 주파수로 급감
      osc.type = "triangle";
      // 빠를수록 높은 음의 틱 사운드, 느릴수록 둔탁한 틱 사운드
      const baseFreq = 120 + velocityRatio * 180; // 120Hz ~ 300Hz
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.06);

      // 속도에 비례하는 볼륨 (0.1 ~ 0.6)
      const vol = 0.1 + velocityRatio * 0.5;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // 오디오 미지원 환경 무시
    }
  }, []);

  // ============================================================
  // 통합 물리 루프 (requestAnimationFrame)
  // 매 프레임마다: 휠 감속 → peg 충돌 감지 → 핀 스프링 물리 → 사운드 → DOM 반영
  // ============================================================
  const startPhysicsLoop = useCallback((onComplete: (outcome: Segment) => void) => {
    const p = physicsRef.current;
    // 초기 속도 기억 (볼륨 비율 계산용)
    const initialVelocity = p.velocity;

    const loop = () => {
      // 1. 마찰 감속 — 실제 베어링 마찰처럼 지수적 감소
      p.velocity *= PHYSICS.FRICTION;

      // 2. 휠 각도 누적 (시계 방향 회전 = 양수)
      wheelAngleRef.current += p.velocity;

      // 3. Peg 충돌 감지 — 45도 경계를 넘었는지 확인
      //    휠이 시계방향으로 돌면, 12시 위치의 핀은 휠 경계선(peg)을
      //    반시계 방향으로 만나므로, 휠 각도를 반전하여 계산
      const effectiveAngle = (360 - (wheelAngleRef.current % 360) + 360) % 360;
      const currentBoundary = Math.floor(effectiveAngle / 45);

      if (p.lastBoundary !== -1 && currentBoundary !== p.lastBoundary) {
        // 핀에 충격 토크 부여 — 휠 속도에 비례하는 충격량
        const velocityRatio = Math.min(1, p.velocity / initialVelocity);
        const impulse = PHYSICS.IMPULSE_BASE * Math.max(0.15, velocityRatio);
        p.pinVelocity += impulse;

        // 틱 사운드 재생 (속도 비율로 볼륨 조절)
        playTickSound(velocityRatio);
      }
      p.lastBoundary = currentBoundary;

      // 4. 핀 물리 — 감쇠 조화 진동자 (Damped Harmonic Oscillator)
      //    - 복원력(Hooke의 법칙): 핀을 0도(중립위치)로 되돌리려는 힘
      //    - 감쇠력: 진동을 줄여서 자연스럽게 멈춤
      const springForce = -PHYSICS.SPRING_K * p.pinAngle;
      const damperForce = -PHYSICS.DAMPING * p.pinVelocity;
      p.pinVelocity += springForce + damperForce;
      p.pinAngle += p.pinVelocity;

      // 핀 각도 제한 (과도한 회전 방지)
      if (p.pinAngle < PHYSICS.MAX_PIN_ANGLE) {
        p.pinAngle = PHYSICS.MAX_PIN_ANGLE;
        p.pinVelocity *= -0.3; // 바운스 반사
      }
      if (p.pinAngle > 5) {
        p.pinAngle = 5;
        p.pinVelocity *= -0.3;
      }

      // 5. DOM에 직접 반영 (React re-render 없이 60fps 보장)
      if (wheelDomRef.current) {
        wheelDomRef.current.style.transform = `rotate(${wheelAngleRef.current}deg)`;
      }
      if (pinDomRef.current) {
        pinDomRef.current.style.transform = `rotate(${p.pinAngle}deg)`;
      }

      // 6. 정지 판정 — 속도가 충분히 느려지면 루프 종료
      if (p.velocity < PHYSICS.STOP_THRESHOLD) {
        p.velocity = 0;
        // 핀 진동도 완전히 정지시키기 (잔여 진동 자연 감쇠)
        const settleLoop = () => {
          const sf = -PHYSICS.SPRING_K * p.pinAngle;
          const df = -PHYSICS.DAMPING * p.pinVelocity;
          p.pinVelocity += sf + df;
          p.pinAngle += p.pinVelocity;
          if (pinDomRef.current) {
            pinDomRef.current.style.transform = `rotate(${p.pinAngle}deg)`;
          }
          // 핀이 거의 멈췄을 때 결과 확정
          if (Math.abs(p.pinAngle) < 0.5 && Math.abs(p.pinVelocity) < 0.5) {
            p.pinAngle = 0;
            p.pinVelocity = 0;
            if (pinDomRef.current) pinDomRef.current.style.transform = 'rotate(0deg)';
            if (p.outcome) onComplete(p.outcome);
            return;
          }
          rafIdRef.current = requestAnimationFrame(settleLoop);
        };
        rafIdRef.current = requestAnimationFrame(settleLoop);
        return; // 메인 루프 종료
      }

      rafIdRef.current = requestAnimationFrame(loop);
    };

    rafIdRef.current = requestAnimationFrame(loop);
  }, [playTickSound]);

  // ============================================================
  // 3. 스핀 핸들러 — DB 트랜잭션 + 물리 루프 시작
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
      const { error: deductError } = await supabase.rpc("deduct_chips", {
        p_user_id: userId,
        p_amount: SPIN_COST,
        p_reason: "roulette_spin",
      });

      if (deductError) {
        toast.error("칩 차감에 실패했습니다. 다시 시도해주세요.");
        setIsSpinning(false);
        return;
      }

      deductChipsLocally(SPIN_COST);

      // 결과 선결정 (확률 기반)
      const outcome = weightedRandom(SEGMENTS);
      const segmentIndex = SEGMENTS.indexOf(outcome);

      // 목표 각도 계산: 해당 칸 중앙이 12시에 멈춰야 함
      // 휠은 시계방향으로 회전하므로, 12시 핀 위치에 해당 칸이 오려면:
      // targetStopAngle = 360 - (segmentIndex * 45 + 22.5)
      const segmentCenter = segmentIndex * 45 + 22.5;
      const targetStopAngle = (360 - segmentCenter + 360) % 360;

      // 현재 휠 위치에서 목표까지 이동해야 할 전체 각도
      const currentAngleMod = ((wheelAngleRef.current % 360) + 360) % 360;
      const angleDiff = ((targetStopAngle - currentAngleMod) + 360) % 360;
      const fullRotations = (PHYSICS.MIN_ROTATIONS + Math.floor(Math.random() * (PHYSICS.MAX_ROTATIONS - PHYSICS.MIN_ROTATIONS + 1))) * 360;
      // 약간의 랜덤 오프셋으로 멈춤 위치에 미세한 변화
      const randomOffset = (Math.random() - 0.5) * 15;
      const totalDistance = fullRotations + angleDiff + randomOffset;

      // 초기 속도 역산: 물리적으로 해당 거리를 이동하려면 필요한 초기 속도
      // 등비 감속: 총 이동거리 = v0 * f / (1 - f) → v0 = distance * (1 - f) / f
      const v0 = totalDistance * (1 - PHYSICS.FRICTION) / PHYSICS.FRICTION;

      // 물리 상태 초기화
      const p = physicsRef.current;
      p.velocity = v0;
      p.pinAngle = 0;
      p.pinVelocity = 0;
      p.lastBoundary = -1;
      p.targetAngle = targetStopAngle;
      p.outcome = outcome;

      // 물리 루프 시작 — 완료 시 결과 처리 콜백 전달
      startPhysicsLoop(async (finalOutcome) => {
        setResult(finalOutcome);
        setShowResultOverlay(true);
        setLastResult(finalOutcome);

        stampService.trackEvent("gacha_spin", 1);
        stampService.flushPlayEvents();

        if (finalOutcome.reward > 0) {
          const { error: rewardError } = await supabase.rpc("add_chips", {
            p_user_id: userId,
            p_amount: finalOutcome.reward,
            p_reason: `roulette_win_${finalOutcome.id}`,
          });

          if (!rewardError) {
            addChipsLocally(finalOutcome.reward);
          }
          if (finalOutcome.reward >= 3000) {
            triggerJackpotEffect(finalOutcome);
          }
        }

        setTimeout(() => {
          setIsSpinning(false);
          setShowResultOverlay(false);
        }, COOLDOWN);
      });

    } catch {
      toast.error("네트워크 오류가 발생했습니다.");
      setIsSpinning(false);
    }
  }, [isSpinning, isLoggedIn, userId, chips, addChipsLocally, deductChipsLocally, startPhysicsLoop]);

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
              
              {/* 프리미엄 시침 (물리 기반 튕김 애니메이션 적용) */}
              <div className="absolute top-[-24px] left-1/2 -translate-x-1/2 z-30 drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
                <svg 
                  ref={pinDomRef}
                  width="32" 
                  height="48" 
                  viewBox="0 0 24 36"
                  style={{ transformOrigin: '50% 15%' }}
                >
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
                ref={wheelDomRef}
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
                  transform: `rotate(${wheelAngleRef.current}deg)`,
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
                      {/* 추가된 항목별 프리미엄 이미지 - 크기 살짝 축소하여 겹침 방지 */}
                      <div className={`p-1 mb-0.5 rounded-full ${containerGlow} transition-all`}>
                        <img 
                          src={seg.image} 
                          alt={seg.name} 
                          className={`w-9 h-9 sm:w-11 sm:h-11 object-contain ${imageGlow} rounded-full`}
                        />
                      </div>
                      <div 
                        className="text-[10px] sm:text-[11px] font-black text-white leading-tight"
                        style={{ textShadow: customTextShadow }}
                      >
                        {seg.name}
                      </div>
                      <div 
                        className={`text-xs sm:text-sm font-black ${seg.reward === 0 ? "text-neutral-300" : "text-yellow-400"} drop-shadow-md leading-none mt-0.5`}
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
                  투자: <span className="text-white font-bold text-base">{SPIN_COST}C</span> &nbsp;&nbsp;|&nbsp;&nbsp; 기대값: <span className="text-emerald-400 font-bold text-base">~269C (RTP 89.7%)</span>
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
