"use client";

import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

export default function BlackMarket() {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
      const diff = endOfDay.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("00:00:00");
        return;
      }

      const h = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, "0");
      const m = String(Math.floor((diff / 1000 / 60) % 60)).padStart(2, "0");
      const s = String(Math.floor((diff / 1000) % 60)).padStart(2, "0");
      setTimeLeft(`${h}:${m}:${s}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative rounded-2xl border border-purple-900/50 bg-gradient-to-br from-neutral-900 to-black p-6 overflow-hidden group cursor-pointer">
      {/* Neon Glow Effects */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-600/30 blur-[50px] rounded-full group-hover:bg-purple-500/40 transition-colors" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-pink-600/20 blur-[50px] rounded-full group-hover:bg-pink-500/30 transition-colors" />

      <div className="relative z-10 flex flex-col items-center text-center">
        <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 tracking-widest uppercase mb-2">
          Black Market
        </h3>
        
        <div className="flex items-center gap-2 text-red-500 font-mono font-bold bg-black/50 px-4 py-1.5 rounded-full border border-red-900/50 mb-4">
          <Clock size={16} className="animate-pulse" />
          <span>{timeLeft}</span>
        </div>

        <div className="w-full flex items-center justify-between bg-neutral-900/80 rounded-xl p-3 border border-neutral-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-900/50 rounded-lg flex items-center justify-center border border-purple-500/30">
              <span className="text-2xl">🎩</span>
            </div>
            <div className="text-left">
              <div className="font-bold text-neutral-200 text-sm">Mystic Top Hat</div>
              <div className="text-xs text-purple-400">Epic Skin</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-neutral-500 line-through">15,000 C</div>
            <div className="font-bold text-pink-500 text-lg">7,500 C</div>
          </div>
        </div>
      </div>
    </div>
  );
}
