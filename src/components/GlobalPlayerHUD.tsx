'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useChipStore } from '@/store/chipStore';
import { useUIStore } from '@/store/uiStore';
import { useRouter } from 'next/navigation';
import { ShoppingCart, User } from 'lucide-react';

export default function GlobalPlayerHUD() {
  const router = useRouter();
  const chips = useChipStore((state) => state.chips);
  const setActiveModal = useUIStore((state) => state.setActiveModal);
  const isLoggedIn = useUIStore((state) => state.isLoggedIn);
  
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());

  const [isAnimating, setIsAnimating] = useState(false);
  const [prevChips, setPrevChips] = useState(0);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;
    // 칩 변경 시 애니메이션 효과 실행
    setIsAnimating(true);
    const controls = animate(count, chips, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1], // 슬롯머신처럼 역동적인 ease-out
      onComplete: () => {
        setIsAnimating(false);
        setPrevChips(chips);
      }
    });
    return controls.stop;
  }, [chips, count, isClient]);

  // 오디오 매니저 클릭 사운드
  const playClickSound = () => {
    import('@/engine/AudioEngine').then(({ soundManager }) => soundManager.playSfx('ui_click'));
  };

  const glowColorClass = chips > prevChips ? 'bg-green-400' : 'bg-red-500';
  const textColorClass = isAnimating 
    ? (chips > prevChips ? 'text-green-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'text-red-300') 
    : 'text-white';

  if (!isClient) return null;

  return (
    <div className="fixed top-4 left-4 z-[9999] flex items-center gap-2">
      {/* 1. Glassmorphism 컨테이너 */}
      <div className="flex items-center bg-zinc-900/80 backdrop-blur-md border border-white/10 p-1.5 rounded-full shadow-2xl hover:shadow-[0_0_20px_rgba(255,255,255,0.1)] transition-shadow duration-300">
        
        {/* 프로필 영역 */}
        <button 
          onClick={() => { playClickSound(); router.push('/profile'); }}
          className="flex items-center gap-2 pr-3 pl-1 group cursor-pointer"
        >
          <div className="relative w-10 h-10 rounded-full border-2 border-white/20 bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center overflow-hidden group-hover:border-purple-400 transition-colors shadow-[0_0_10px_rgba(168,85,247,0)] group-hover:shadow-[0_0_15px_rgba(168,85,247,0.5)]">
            <User className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
            <div className="absolute inset-0 bg-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
          <div className="flex flex-col items-start hidden sm:flex">
            <span className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Level 1</span>
            <span className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors -mt-0.5">
              {isLoggedIn ? 'Player' : 'Guest'}
            </span>
          </div>
        </button>

        <div className="w-[1px] h-8 bg-white/10 mx-2 hidden sm:block"></div>

        {/* 칩 영역 */}
        <div className="flex items-center gap-2 pr-4 cursor-default group">
          <div className="relative w-10 h-10 flex-shrink-0">
            <div className={`absolute inset-0 rounded-full blur-md opacity-0 transition-opacity duration-300 ${isAnimating ? `opacity-50 ${glowColorClass}` : ''}`} />
            <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-2 border-yellow-200 flex items-center justify-center relative z-10 shadow-inner group-hover:scale-110 transition-transform">
               <span className="text-yellow-900 font-black text-lg mt-0.5">$</span>
            </div>
          </div>
          <div className="flex flex-col items-start">
             <span className="text-[10px] text-yellow-500/80 font-bold tracking-wider uppercase mb-[-4px]">
               Balance
             </span>
             <motion.span 
               className={`text-xl font-bold font-mono tracking-tight transition-all duration-300 ${textColorClass}`}
             >
               {rounded}
             </motion.span>
          </div>
        </div>

      </div>

      {/* 2. 상점 버튼 */}
      <button 
        onClick={() => { playClickSound(); router.push('/shop'); }}
        className="w-12 h-12 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 hover:border-amber-400 hover:bg-amber-500/10 transition-all flex items-center justify-center group relative shadow-lg hover:shadow-[0_0_15px_rgba(251,191,36,0.5)]"
        title="상점 (VIP Shop)"
      >
        <ShoppingCart className="w-5 h-5 text-amber-400 group-hover:text-amber-300 group-hover:scale-110 transition-all" />
        {/* Shimmer Effect를 위한 꼼수 (animate-pulse 활용) */}
        <div className="absolute inset-0 rounded-full bg-amber-500/20 opacity-0 group-hover:animate-pulse"></div>
      </button>

      {/* 3. 스탬프 북 버튼 */}
      <button 
        onClick={() => { playClickSound(); setActiveModal('stampBook'); }}
        className="w-12 h-12 rounded-full bg-zinc-900/80 backdrop-blur-md border border-white/10 hover:border-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center group relative shadow-lg hover:shadow-[0_0_15px_rgba(248,113,113,0.5)]"
        title="스탬프 북 (미션/업적)"
      >
        <span className="text-xl group-hover:scale-110 transition-transform drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]">📖</span>
        {/* 알림 뱃지 */}
        <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-zinc-900 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
      </button>

    </div>
  );
}
