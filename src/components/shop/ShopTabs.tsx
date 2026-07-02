"use client";

import React from "react";

const TABS = [
  { id: "skin", label: "스킨", icon: "👕" },
  { id: "avatar", label: "아바타", icon: "👤" },
  { id: "border", label: "테두리", icon: "🖼️" },
  { id: "piece", label: "기물", icon: "♟️" },
  { id: "background", label: "배경", icon: "🌌" },
  { id: "frame", label: "프레임", icon: "🔳" },
];

interface ShopTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  viewMode?: 'shop' | 'inventory';
}

export default function ShopTabs({ activeTab, setActiveTab, viewMode = 'shop' }: ShopTabsProps) {
  // 테마에 따른 액티브 탭 스타일
  const activeStyle = viewMode === 'shop' 
    ? "bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-400 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
    : "bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-400 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]";

  return (
    <div className="flex space-x-2 bg-neutral-900/50 p-1 rounded-2xl backdrop-blur-md border border-neutral-800">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all duration-300 border ${
            activeTab === tab.id
              ? activeStyle
              : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 border-transparent"
          }`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span className="hidden sm:inline">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
