"use client";

import React from "react";
import { Sparkles } from "lucide-react";
import { stampService } from '@/lib/stampService';

export default function LuckyRoulette() {
  const handleSpin = () => {
    // 미션 이벤트: 가챠 스핀
    stampService.trackEvent('gacha_spin', 1);
    stampService.flushPlayEvents();
  };

  return (
    <div className="relative rounded-2xl border border-green-900/50 bg-gradient-to-br from-green-950 via-neutral-900 to-black p-6 overflow-hidden group cursor-pointer">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
      
      {/* Light sweep effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] skew-x-12" />

      <div className="relative z-10 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-green-300 to-emerald-600 drop-shadow-sm flex items-center gap-2">
            행운의 룰렛 <Sparkles size={20} className="text-yellow-400" />
          </h3>
          <p className="text-neutral-400 text-sm mt-1">룰렛을 돌려 전설 아이템이나 잭팟을 노려보세요!</p>
        </div>
        
        <button 
          onClick={handleSpin}
          className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-800 text-white font-bold rounded-full shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all"
        >
          300 C
        </button>
      </div>
    </div>
  );
}
