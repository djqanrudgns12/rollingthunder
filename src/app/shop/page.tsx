"use client";

import React, { useState, useMemo } from "react";
import ShopTabs from "@/components/shop/ShopTabs";
import ShopShowcase from "@/components/shop/ShopShowcase";
import BlackMarket from "@/components/shop/BlackMarket";
import LuckyRoulette from "@/components/shop/LuckyRoulette";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, ShoppingCart, Lock } from "lucide-react";

import { MOCK_ITEMS, ShopItem } from "@/data/shopData";

// 임시 유저 상태 (테스트용)
const MOCK_USER = {
  id: "test-user-id",
  role: "admin", // 'admin' | 'premium' | 'normal' | 'guest'
  inventory: ["skin_cat", "avatar_pet_1", "bg_cyberpunk"], // 소유한 아이템 ID 배열
  equipped: {
    avatar: "avatar_pet_1",
    border: null,
  }
};

const RARITY_ORDER: Record<string, number> = {
  'Mythic': 5,
  'Legendary': 4,
  'Epic': 3,
  'Rare': 2,
  'Normal': 1
};

export default function ShopPage() {
  const router = useRouter();
  
  // 상태 관리
  const [viewMode, setViewMode] = useState<'shop' | 'inventory'>('shop');
  const [activeTab, setActiveTab] = useState("avatar");
  
  // 유저 상태 (클라이언트 사이드에서 상태 변이 테스트를 위해 useState 사용)
  const [userState, setUserState] = useState(MOCK_USER);

  // 현재 선택된 아이템 (탭 변경 시 기본값 재설정)
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

  // 권한 및 소유 로직
  const isItemOwned = (item: ShopItem) => {
    if (userState.role === 'admin') return true;
    return userState.inventory.includes(item.item_id);
  };

  const hasAccessToTab = (tabId: string) => {
    if (userState.role === 'admin' || userState.role === 'premium') return true;
    return !['piece', 'background', 'frame'].includes(tabId);
  };

  // 렌더링용 리스트 구성 (필터링 + 정렬)
  const filteredItems = useMemo(() => {
    let items = MOCK_ITEMS.filter((item) => item.category === activeTab);
    
    // 보관함 모드면 소유한 아이템만
    if (viewMode === 'inventory') {
      items = items.filter(isItemOwned);
    }
    
    // 정렬: 보유 여부 (상점 모드일 때만, 소유한 것을 위로) -> 희귀도 높은 순 -> 이름 순
    items.sort((a, b) => {
      if (viewMode === 'shop') {
        const aOwned = isItemOwned(a) ? 1 : 0;
        const bOwned = isItemOwned(b) ? 1 : 0;
        if (aOwned !== bOwned) return bOwned - aOwned; // 소유한게 먼저 (내림차순)
      }
      
      const rA = RARITY_ORDER[a.rarity] || 0;
      const rB = RARITY_ORDER[b.rarity] || 0;
      if (rA !== rB) return rB - rA; // 등급 높은게 먼저
      
      return a.name.localeCompare(b.name);
    });

    return items;
  }, [activeTab, viewMode, userState]);

  // 탭 변경 시 selectedItem 초기화
  React.useEffect(() => {
    if (filteredItems.length > 0) {
      setSelectedItem(filteredItems[0]);
    } else {
      setSelectedItem(null);
    }
  }, [activeTab, viewMode]);


  const handleAction = async (item: ShopItem) => {
    if (!item) return;

    if (viewMode === 'shop') {
      // 구매 로직
      if (isItemOwned(item)) {
        toast.info("이미 보유한 아이템입니다.");
        return;
      }
      if (item.requiresPremium && !['admin', 'premium'].includes(userState.role)) {
        toast.error("프리미엄 등급 이상만 구매 가능합니다.");
        return;
      }
      // 구매 성공 처리 (목업)
      toast.success(`${item.name} 구매 완료!`);
      setUserState(prev => ({
        ...prev,
        inventory: [...prev.inventory, item.item_id]
      }));
    } else {
      // 장착 로직
      if (item.category === 'avatar' || item.category === 'border') {
        const currentEquipped = userState.equipped[item.category];
        if (currentEquipped === item.item_id) {
          // 장착 해제
          setUserState(prev => ({
            ...prev,
            equipped: { ...prev.equipped, [item.category]: null }
          }));
          toast.success(`${item.name} 장착을 해제했습니다.`);
        } else {
          // 장착
          setUserState(prev => ({
            ...prev,
            equipped: { ...prev.equipped, [item.category]: item.item_id }
          }));
          toast.success(`${item.name} 장착 완료!`);
        }
      }
    }
  };

  // 버튼 UI 동적 렌더링 로직
  const renderActionButton = (item: ShopItem) => {
    const isOwned = isItemOwned(item);
    const canAccess = hasAccessToTab(item.category);

    if (!canAccess) {
      return (
        <button disabled className="px-10 py-3.5 bg-neutral-800 text-neutral-500 font-extrabold text-lg rounded-full border border-neutral-700 flex items-center gap-2">
          <Lock size={20} />
          <span>프리미엄 전용</span>
        </button>
      );
    }

    if (viewMode === 'shop') {
      if (isOwned) {
        return (
          <button disabled className="px-10 py-3.5 bg-neutral-800 text-neutral-400 font-extrabold text-lg rounded-full border border-neutral-700">
            <span>보유 중</span>
          </button>
        );
      }
      return (
        <button 
          onClick={() => handleAction(item)}
          className="px-10 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold text-lg rounded-full shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.8)] hover:scale-105 transition-all active:scale-95 flex items-center gap-2 border border-yellow-400/50"
        >
          <span>{item.price.toLocaleString()} 칩 구매</span>
        </button>
      );
    } 
    
    // 보관함 모드
    if (item.category === 'avatar' || item.category === 'border') {
      const isEquipped = userState.equipped[item.category] === item.item_id;
      return (
        <button 
          onClick={() => handleAction(item)}
          className={`px-10 py-3.5 font-extrabold text-lg rounded-full transition-all active:scale-95 flex items-center gap-2 border ${
            isEquipped 
              ? "bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30" 
              : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.6)]"
          }`}
        >
          <span>{isEquipped ? '장착 해제' : '장착하기'}</span>
        </button>
      );
    }
    
    if (item.category === 'skin') {
      return (
        <div className="px-8 py-3 bg-neutral-800/80 text-cyan-400 font-bold rounded-full border border-cyan-900/50">
          참가자 목록에 추가됨
        </div>
      );
    }

    return (
      <div className="px-8 py-3 bg-neutral-800/80 text-cyan-400 font-bold rounded-full border border-cyan-900/50">
        맵 에디터에서 사용 가능
      </div>
    );
  };

  const isTabLocked = !hasAccessToTab(activeTab);
  
  // 테마별 클래스 적용
  const themeAccent = viewMode === 'shop' ? 'amber' : 'cyan';
  const themeBg = viewMode === 'shop' ? 'bg-neutral-950' : 'bg-[#050B14]';

  return (
    <div className={`min-h-screen text-white overflow-hidden transition-colors duration-700 ${themeBg}`}>
      <main className="max-w-7xl mx-auto pt-24 px-6 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* 상단 버튼 그룹 */}
        <div className="absolute top-8 right-6 z-50 flex gap-4">
          <button 
            onClick={() => setViewMode(viewMode === 'shop' ? 'inventory' : 'shop')}
            className={`flex items-center gap-2 px-5 py-2.5 backdrop-blur-md border rounded-full font-bold text-sm transition-all shadow-lg group ${
              viewMode === 'shop' 
                ? 'bg-cyan-900/40 border-cyan-500/30 text-cyan-300 hover:bg-cyan-800/60 hover:border-cyan-400' 
                : 'bg-amber-900/40 border-amber-500/30 text-amber-300 hover:bg-amber-800/60 hover:border-amber-400'
            }`}
          >
            {viewMode === 'shop' ? <Package size={16} /> : <ShoppingCart size={16} />}
            {viewMode === 'shop' ? '내 보관함' : '상점으로 가기'}
          </button>

          <button 
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900/80 backdrop-blur-md border border-white/10 hover:border-neutral-500 hover:bg-neutral-800 rounded-full text-neutral-300 transition-all shadow-lg group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            메인으로 돌아가기
          </button>
        </div>

        {/* 좌측: 3D 쇼케이스 및 기타 패널 */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className={`relative w-full aspect-square md:aspect-auto md:h-[480px] bg-neutral-900/50 border rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md flex flex-col transition-colors duration-500 ${
            viewMode === 'shop' ? 'border-amber-500/30 shadow-amber-900/20' : 'border-cyan-500/30 shadow-cyan-900/20'
          }`}>
            <div className="absolute top-4 left-4 z-20">
              <span className={`px-3 py-1 text-black border rounded-sm text-xs font-extrabold uppercase tracking-widest shadow-md ${
                viewMode === 'shop' 
                  ? 'bg-gradient-to-r from-amber-600 to-yellow-500 border-yellow-400' 
                  : 'bg-gradient-to-r from-cyan-600 to-blue-500 border-cyan-400 text-white'
              }`}>
                {viewMode === 'shop' ? '쇼케이스' : '보관함'}
              </span>
            </div>
            
            <div className="relative flex-1 w-full h-full min-h-[280px]">
              {selectedItem ? (
                <ShopShowcase selectedItem={selectedItem} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-600 font-bold">
                  선택된 아이템이 없습니다.
                </div>
              )}
            </div>

            {selectedItem && (
              <div className="relative z-20 flex flex-col items-center text-center px-6 py-6 bg-gradient-to-t from-black/90 via-black/80 to-transparent border-t border-white/5">
                <h2 className={`text-3xl md:text-4xl font-bold tracking-tight text-transparent bg-clip-text drop-shadow-md mb-2 bg-gradient-to-r ${
                  viewMode === 'shop' ? 'from-amber-200 via-yellow-400 to-amber-600' : 'from-cyan-200 via-blue-400 to-cyan-600'
                }`}>
                  {selectedItem.name}
                </h2>
                <p className="text-neutral-400 text-sm mb-4 max-w-sm leading-relaxed">{selectedItem.description}</p>
                {renderActionButton(selectedItem)}
              </div>
            )}
          </div>

          {/* 상점 모드일 때만 프로모션 표시 */}
          {viewMode === 'shop' && (
            <>
              <BlackMarket />
              <LuckyRoulette />
            </>
          )}
        </div>

        {/* 우측: 탭 및 리스트 */}
        <div className="lg:col-span-7 flex flex-col h-[calc(100vh-140px)] relative">
          <ShopTabs activeTab={activeTab} setActiveTab={setActiveTab} viewMode={viewMode} />
          
          <div className="flex-1 overflow-y-auto pr-2 mt-4 space-y-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
            {isTabLocked ? (
              // 잠긴 탭 화면 (게스트/노말 유저가 기물/배경/프레임 탭 클릭 시)
              <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900/40 rounded-2xl border border-neutral-800/50 backdrop-blur-sm p-8 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('/images/noise.png')] opacity-5 mix-blend-overlay"></div>
                <div className="w-24 h-24 bg-gradient-to-b from-amber-400/20 to-transparent rounded-full flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(245,158,11,0.1)]">
                  <Lock size={48} className="text-amber-500" />
                </div>
                <h3 className="text-2xl font-bold text-neutral-200 mb-2">프리미엄 전용 콘텐츠</h3>
                <p className="text-neutral-400 max-w-md mx-auto leading-relaxed">
                  이 카테고리의 아이템은 맵 에디터 전용 에셋입니다.<br/>
                  프리미엄 등급 이상의 유저만 접근 및 구매할 수 있습니다.
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-neutral-500">
                {viewMode === 'shop' ? '현재 카테고리에 상품이 없습니다.' : '보유 중인 아이템이 없습니다.'}
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = selectedItem?.item_id === item.item_id;
                const isOwned = isItemOwned(item);
                const isEquipped = item.category === 'avatar' || item.category === 'border' 
                  ? userState.equipped[item.category] === item.item_id 
                  : false;
                
                return (
                  <div 
                    key={item.item_id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${
                      isSelected 
                        ? (viewMode === 'shop' ? 'bg-neutral-800/80 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-blue-900/30 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]')
                        : 'bg-neutral-900/50 border-neutral-800 hover:bg-neutral-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-lg bg-black/50 border border-neutral-700 flex items-center justify-center overflow-hidden relative">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-contain p-1" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <h3 className={`font-bold text-lg transition-colors ${isSelected ? (viewMode === 'shop' ? 'text-amber-400' : 'text-cyan-400') : 'text-neutral-200 group-hover:text-white'}`}>
                            {item.name}
                          </h3>
                          {isEquipped && (
                            <span className="text-[10px] px-2 py-0.5 rounded border border-cyan-500 text-cyan-400 font-bold bg-cyan-900/30">장착됨</span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${
                            item.rarity === 'Mythic' ? 'border-red-500 text-red-500' :
                            item.rarity === 'Legendary' ? 'border-yellow-500 text-yellow-500' :
                            item.rarity === 'Epic' ? 'border-purple-500 text-purple-500' :
                            item.rarity === 'Rare' ? 'border-blue-500 text-blue-500' :
                            'border-gray-500 text-gray-500'
                          }`}>
                            {item.rarity}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {isOwned && viewMode === 'shop' ? (
                        <div className="font-bold text-neutral-500 text-sm">보유 중</div>
                      ) : (
                        viewMode === 'shop' && (
                          <div className="font-bold text-amber-500">{item.price.toLocaleString()} C</div>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
