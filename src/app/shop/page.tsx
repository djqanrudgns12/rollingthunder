"use client";

import React, { useState } from "react";
import ShopTabs from "@/components/shop/ShopTabs";
import ShopShowcase from "@/components/shop/ShopShowcase";
import BlackMarket from "@/components/shop/BlackMarket";
import LuckyRoulette from "@/components/shop/LuckyRoulette";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { MOCK_ITEMS } from "@/data/shopData";

export default function ShopPage() {
  const router = useRouter();
  const user = { id: "test-user-id" }; // 더미 유저
  const defaultAvatar = MOCK_ITEMS.find(i => i.category === 'avatar') || MOCK_ITEMS[0];
  const [selectedItem, setSelectedItem] = useState(defaultAvatar);
  const [activeTab, setActiveTab] = useState("avatar");

  // 현재 탭에 맞는 아이템 필터링
  const filteredItems = MOCK_ITEMS.filter((item) => item.category === activeTab);

  const handleBuy = async (item: any) => {
    // TODO: Supabase RPC 호출 로직 (buy_shop_item)
    // 현재는 목업 UI만 제공
    toast.success(`${item.name} 구매 완료!`);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white overflow-hidden">
      <main className="max-w-7xl mx-auto pt-24 px-6 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* 상단: 메인으로 돌아가기 버튼 */}
        <div className="absolute top-8 right-6 z-50">
          <button 
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900/80 backdrop-blur-md border border-white/10 hover:border-amber-500/50 hover:bg-amber-500/10 rounded-full text-neutral-300 hover:text-amber-400 font-bold text-sm transition-all shadow-lg group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            메인으로 돌아가기
          </button>
        </div>

        {/* 좌측: 3D 쇼케이스 및 암시장/룰렛 배너 */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* 3D 쇼케이스 뷰 */}
          <div className="relative w-full aspect-square md:aspect-auto md:h-[480px] bg-neutral-900/50 border border-amber-500/30 rounded-2xl overflow-hidden shadow-2xl shadow-amber-900/20 backdrop-blur-md flex flex-col">
            <div className="absolute top-4 left-4 z-20">
              <span className="px-3 py-1 bg-gradient-to-r from-amber-600 to-yellow-500 text-black border border-yellow-400 rounded-sm text-xs font-extrabold uppercase tracking-widest shadow-md">
                쇼케이스
              </span>
            </div>
            
            {/* 상단: 이미지 플로팅 영역 (Flex 1) */}
            <div className="relative flex-1 w-full h-full min-h-[280px]">
              <ShopShowcase selectedItem={selectedItem} />
            </div>

            {/* 하단: 고급 정보 패널 영역 */}
            <div className="relative z-20 flex flex-col items-center text-center px-6 py-6 bg-gradient-to-t from-black/90 via-black/80 to-transparent border-t border-white/5">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-600 drop-shadow-md mb-2">
                {selectedItem.name}
              </h2>
              <p className="text-neutral-400 text-sm mb-4 max-w-sm leading-relaxed">{selectedItem.description}</p>
              
              <button 
                onClick={() => handleBuy(selectedItem)}
                className="px-10 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold text-lg rounded-full shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.8)] hover:scale-105 transition-all active:scale-95 flex items-center gap-2 border border-yellow-400/50"
              >
                <span>{selectedItem.price.toLocaleString()} 칩 구매</span>
              </button>
            </div>
          </div>

          {/* 일일 한정 딜 (암시장) */}
          <BlackMarket />
          
          {/* 럭키 룰렛 배너 */}
          <LuckyRoulette />
        </div>

        {/* 우측: 상점 탭 및 리스트 */}
        <div className="lg:col-span-7 flex flex-col h-[calc(100vh-140px)]">
          <ShopTabs activeTab={activeTab} setActiveTab={setActiveTab} />
          
          <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
            {filteredItems.map((item) => (
              <div 
                key={item.item_id}
                onClick={() => setSelectedItem(item)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedItem.item_id === item.item_id 
                    ? 'bg-neutral-800/80 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
                    : 'bg-neutral-900/50 border-neutral-800 hover:bg-neutral-800/50'
                } flex items-center justify-between group`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-black/50 border border-neutral-700 flex items-center justify-center overflow-hidden relative">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-neutral-200 group-hover:text-amber-400 transition-colors">{item.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${
                      item.rarity === 'Legendary' ? 'border-yellow-500 text-yellow-500' :
                      item.rarity === 'Epic' ? 'border-purple-500 text-purple-500' :
                      item.rarity === 'Rare' ? 'border-blue-500 text-blue-500' :
                      'border-gray-500 text-gray-500'
                    }`}>
                      {item.rarity}
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-bold text-amber-500">{item.price.toLocaleString()} C</div>
                </div>
              </div>
            ))}
            
            {filteredItems.length === 0 && (
              <div className="flex items-center justify-center h-48 text-neutral-500">
                현재 카테고리에 상품이 없습니다.
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
