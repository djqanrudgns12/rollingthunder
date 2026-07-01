'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useChipStore } from '@/store/chipStore';
import { useUIStore } from '@/store/uiStore';

// TODO: public/images 폴더에 생성된 3D 칩 이미지를 배치해야 합니다.
// 임시 이미지 URL 또는 플레이스홀더를 사용합니다.
const CHIP_ICON_URL = '/images/3d_casino_chip_icon.png';

export default function ChipHeader() {
  const chips = useChipStore((state) => state.chips);
  const setActiveModal = useUIStore((state) => state.setActiveModal);
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());

  const [isAnimating, setIsAnimating] = useState(false);
  const [prevChips, setPrevChips] = useState(0);

  useEffect(() => {
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
  }, [chips, count]);

  // 증가/감소 여부에 따른 색상 이펙트
  const isIncreasing = chips > prevChips;
  const glowColorClass = isIncreasing ? 'bg-green-400' : 'bg-red-500';
  const textColorClass = isAnimating 
    ? (isIncreasing ? 'text-green-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'text-red-300') 
    : 'text-white';

  return (
    <div className="fixed top-4 right-4 z-[9999] flex items-center bg-zinc-900/80 backdrop-blur-md border border-white/10 p-2 pr-5 rounded-full shadow-2xl hover:shadow-[0_0_15px_rgba(250,204,21,0.2)] transition-shadow duration-300">
      <div className="relative w-10 h-10 mr-3 flex-shrink-0">
        {/* 애니메이션 중 칩 아이콘 뒤 글로우 이펙트 */}
        <div className={`absolute inset-0 rounded-full blur-md opacity-0 transition-opacity duration-300 ${isAnimating ? `opacity-50 ${glowColorClass}` : ''}`} />
        
        {/* Fallback으로 텍스트 기반 칩을 보여줍니다. 이미지가 없을 시 대비 */}
        <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 border-2 border-yellow-200 flex items-center justify-center relative z-10 shadow-inner">
           <span className="text-yellow-900 font-bold text-xs">◆</span>
        </div>
        {/* <img 
          src={CHIP_ICON_URL} 
          alt="Chip" 
          className="w-full h-full object-contain relative z-10"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        /> */}
      </div>
      <div className="flex flex-col pr-4 border-r border-white/20 mr-2">
        <span className="text-[10px] text-yellow-500/80 font-semibold tracking-wider uppercase mb-[-4px]">
          Balance
        </span>
        <motion.span 
          className={`text-xl font-bold font-mono tracking-tight transition-all duration-300 ${textColorClass}`}
        >
          {rounded}
        </motion.span>
      </div>
      
      {/* 스탬프 북 버튼 */}
      <button 
        onClick={() => setActiveModal('stampBook')}
        className="w-10 h-10 rounded-full bg-white/5 hover:bg-amber-500/20 transition-colors flex items-center justify-center border border-transparent hover:border-amber-500/50 group relative"
        title="스탬프 북 (미션/업적)"
      >
        <span className="text-xl group-hover:scale-110 transition-transform drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]">📖</span>
        {/* 알림 뱃지 예시 (추후 미수령 보상 개수 연동 가능) */}
        <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-zinc-900 animate-pulse"></span>
      </button>
    </div>
  );
}
