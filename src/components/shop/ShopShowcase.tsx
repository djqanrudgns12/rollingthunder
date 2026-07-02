"use client";

import React, { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import Image from 'next/image';
import * as LucideIcons from 'lucide-react';

interface ShopShowcaseProps {
  selectedItem: any;
}

export default function ShopShowcase({ selectedItem }: ShopShowcaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Tilt Effect State
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const springConfig = { damping: 20, stiffness: 300 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [15, -15]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-15, 15]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // 모바일 기울임 지원
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        const xPct = Math.min(Math.max(e.gamma / 45, -0.5), 0.5);
        const yPct = Math.min(Math.max((e.beta - 45) / 45, -0.5), 0.5);
        x.set(xPct);
        y.set(yPct);
      }
    };
    
    if (typeof window !== 'undefined' && window.matchMedia("(pointer: coarse)").matches) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [x, y]);

  // 등급별 오라 및 반짝임 컬러 매핑
  const getRarityStyles = (rarity: string) => {
    switch (rarity) {
      case '신화': 
        return {
          glow: 'shadow-[0_0_60px_rgba(239,68,68,0.8)]',
          border: 'border-red-500/80',
          gradient: 'from-red-900/40 to-transparent',
          text: 'text-red-400'
        };
      case '전설': 
        return {
          glow: 'shadow-[0_0_60px_rgba(250,204,21,0.8)]',
          border: 'border-yellow-400/80',
          gradient: 'from-yellow-900/40 to-transparent',
          text: 'text-yellow-400'
        };
      case '에픽': 
        return {
          glow: 'shadow-[0_0_50px_rgba(168,85,247,0.7)]',
          border: 'border-purple-500/70',
          gradient: 'from-purple-900/40 to-transparent',
          text: 'text-purple-400'
        };
      case '레어': 
      case '희귀': 
        return {
          glow: 'shadow-[0_0_40px_rgba(59,130,246,0.6)]',
          border: 'border-blue-500/60',
          gradient: 'from-blue-900/40 to-transparent',
          text: 'text-blue-400'
        };
      case '노멀': 
      default: 
        return {
          glow: 'shadow-[0_0_30px_rgba(255,255,255,0.3)]',
          border: 'border-neutral-400/50',
          gradient: 'from-neutral-800/40 to-transparent',
          text: 'text-neutral-300'
        };
    }
  };

  const rarityStyle = getRarityStyles(selectedItem?.rarity);
  const IconComp = selectedItem?.iconName ? (LucideIcons as any)[selectedItem.iconName] : null;
  const isFullScreenAsset = selectedItem?.category === 'background' || selectedItem?.category === 'frame';

  return (
    <div className="w-full h-full absolute inset-0 flex items-center justify-center pt-12">
      {/* 앰비언트 라이트 배경 효과 */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center opacity-40">
        <div className={`w-[300px] h-[300px] rounded-full blur-[80px] bg-gradient-to-br ${rarityStyle.gradient}`} />
      </div>

      <motion.div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        // 공중에 둥둥 떠있는 애니메이션 (플로팅)
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="relative w-56 h-56 sm:w-64 sm:h-64 z-10 cursor-pointer"
      >
        <div className={`w-full h-full rounded-3xl border-2 ${rarityStyle.border} ${rarityStyle.glow} bg-black/60 backdrop-blur-md flex items-center justify-center relative transition-colors duration-500 overflow-hidden`}>
          
          {/* 컨텐츠 렌더링 (Image) - 가장 안쪽 레이어 */}
          <div className={`w-full h-full flex items-center justify-center absolute inset-0 z-0 ${isFullScreenAsset ? 'p-0' : 'p-6'}`}>
            {selectedItem?.image ? (
              <Image 
                src={selectedItem.image} 
                alt={selectedItem?.name || "아이템"} 
                fill
                className={`${isFullScreenAsset ? 'object-cover' : 'object-contain p-1 drop-shadow-2xl [clip-path:inset(2%_round_20%)]'}`}
                sizes="(max-width: 768px) 256px, 320px"
                priority
              />
            ) : IconComp ? (
              <IconComp className={`w-32 h-32 ${rarityStyle.text} drop-shadow-2xl`} />
            ) : (
              // 이미지가 없는 경우 표시될 고급스러운 플레이스홀더
              <div className="flex flex-col items-center justify-center text-center">
                <div className={`w-24 h-24 rounded-full border border-dashed ${rarityStyle.border} flex items-center justify-center mb-4`}>
                  <span className={`text-4xl ${rarityStyle.text}`}>✨</span>
                </div>
                <p className={`font-bold ${rarityStyle.text} uppercase tracking-widest text-sm opacity-80`}>
                  PREMIUM<br/>ASSET
                </p>
              </div>
            )}
          </div>

          {/* Hologram & Shine Layers - 유리 표면 (가장 바깥쪽 Z) */}
          <div className="absolute inset-0 z-10 pointer-events-none">
            <div className="absolute inset-0 opacity-20 mix-blend-overlay bg-gradient-to-br from-white/40 via-transparent to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
          </div>
        </div>
      </motion.div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
