"use client";

import React from "react";

const TABS = [
  { id: "avatar", label: "아바타", icon: "👤" },
  { id: "skin", label: "스킨", icon: "👕" },
  { id: "piece", label: "말", icon: "♟️" },
  { id: "frame", label: "액자", icon: "🖼️" },
  { id: "background", label: "배경", icon: "🌌" },
];

interface ShopTabsProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function ShopTabs({ activeTab, setActiveTab }: ShopTabsProps) {
  return (
    <div className="flex space-x-2 bg-neutral-900/50 p-1 rounded-2xl backdrop-blur-md border border-neutral-800">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all duration-300 ${
            activeTab === tab.id
              ? "bg-gradient-to-br from-amber-500/20 to-orange-600/20 text-amber-400 border border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
              : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 border border-transparent"
          }`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
