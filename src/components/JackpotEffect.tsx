'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useChipStore } from '@/store/chipStore';

export default function JackpotEffect() {
  const isJackpotActive = useChipStore((state) => state.isJackpotActive);
  const setJackpotActive = useChipStore((state) => state.setJackpotActive);

  useEffect(() => {
    if (isJackpotActive) {
      fireJackpot();
      
      // 약 3초 뒤에 상태를 리셋
      const timer = setTimeout(() => {
        setJackpotActive(false);
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [isJackpotActive, setJackpotActive]);

  const fireJackpot = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    // 카지노 칩 느낌을 주기 위해 골드, 네온 계열 색상 사용
    const colors = ['#FBBF24', '#F59E0B', '#D97706', '#10B981', '#34D399'];

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.8 },
        colors: colors,
        ticks: 200,
        gravity: 1.2,
        scalar: 1.2,
        shapes: ['circle'], // 칩 모양(원형) 위주로
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.8 },
        colors: colors,
        ticks: 200,
        gravity: 1.2,
        scalar: 1.2,
        shapes: ['circle'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  if (!isJackpotActive) return null;

  return (
    <div className="fixed inset-0 z-[9998] pointer-events-none flex items-center justify-center">
      {/* 잭팟 활성화 시 배경 살짝 어둡게 (Dim 처리)하여 파티클 돋보이게 함 */}
      <div className="absolute inset-0 bg-black/40 animate-fade-in-out" />
      <div className="relative z-10 font-black text-6xl md:text-8xl text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-yellow-400 to-yellow-600 drop-shadow-[0_0_30px_rgba(250,204,21,0.8)] animate-bounce">
        JACKPOT!
      </div>
    </div>
  );
}
