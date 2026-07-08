"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import ShopTabs from "@/components/shop/ShopTabs";
import ShopShowcase from "@/components/shop/ShopShowcase";
import LuckyRoulette from "@/components/shop/LuckyRoulette";
import SkinCanvasPreview from "@/components/shop/SkinCanvasPreview";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, Package, ShoppingCart, Lock, Store } from "lucide-react";
import * as LucideIcons from "lucide-react";
import MapStorePanel from "@/components/shop/MapStorePanel";

import { MOCK_ITEMS, ShopItem } from "@/data/shopData";
import { SKIN_DEFINITIONS } from "@/data/skinDefinitions";

import { useUIStore } from "@/store/uiStore";
import { useInventoryStore } from "@/store/inventoryStore";
import { stampService } from '@/lib/stampService';
import { useChipStore } from "@/store/chipStore";
import { purchaseShopItem } from "@/app/actions/shop";

const RARITY_ORDER: Record<string, number> = {
  'Mythic': 5,
  'Legendary': 4,
  'Epic': 3,
  'Rare': 2,
  'Normal': 1
};

/**
 * 아이템 희귀도(Rarity)별 구매에 필요한 최소 유저 등급 매핑
 *
 * 왜 이렇게 분리했는가:
 * - 서버 액션(actions/shop.ts)에도 같은 로직이 있지만,
 *   클라이언트에서는 '구매 버튼을 보여줄지 말지'를 빠르게 판단하기 위해 필요
 * - 서버 액션은 실제 결제 시 한 번 더 검증하는 이중 안전장치 역할
 */
const RARITY_MIN_ROLE_LEVEL: Record<string, number> = {
  'Normal': 0,     // 게스트(guest)도 구매 가능
  'Rare': 1,       // user(노말 회원) 이상
  'Epic': 2,       // premium 이상
  'Legendary': 2,  // premium 이상
  'Mythic': 2,     // premium 이상
};

export default function ShopPage() {
  const router = useRouter();
  
  // Zustand store
  const { userProfile, isLoggedIn } = useUIStore();
  const { inventory, equipped, buyItem, equipItem, unequipItem, hasItem } = useInventoryStore();
  const { chips, deductChipsLocally } = useChipStore();
  
  // 상태 관리 ('mapstore' = 커스텀 맵 스토어, 에메랄드 테마)
  const [viewMode, setViewMode] = useState<'shop' | 'inventory' | 'mapstore'>('shop');
  const [activeTab, setActiveTab] = useState("skin");

  // 딥링크: /shop?view=mapstore (useSearchParams 의 Suspense 요구를 피해 직접 파싱)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'mapstore') setViewMode('mapstore');
  }, []);
  
  const role = userProfile?.role || (isLoggedIn ? "user" : "guest");

  /**
   * 벡터 스킨 여부 판별 + skinKey 추출
   * item_id에서 'skin_' 접두사를 제거하고 SKIN_DEFINITIONS에 등록된 키인지 확인
   */
  const getVectorSkinKey = useCallback((item: ShopItem): string | null => {
    if (item.category !== 'skin') return null;
    let key = item.item_id.replace(/^skin_/, '');
    if (key === 'chip_base') key = 'chip_base_1';
    return SKIN_DEFINITIONS[key] ? key : null;
  }, []);

  // 미션 이벤트 및 상점 BGM 재생
  useEffect(() => {
    import('@/engine/AudioEngine').then(({ soundManager }) => {
      soundManager.playShopBgm();
    });
    stampService.trackEvent('visit_shop', 1);
    stampService.flushPlayEvents();
  }, []);

  // 현재 선택된 아이템 (탭 변경 시 기본값 재설정)
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);

  /**
   * 등급 위계 상수 — 숫자가 클수록 높은 등급
   * 왜 이렇게 하는가: requiredRole과 현재 사용자 role을 숫자로 비교하면
   * 등급 추가/변경 시 한 곳만 수정하면 됨
   */
  const ROLE_HIERARCHY: Record<string, number> = {
    'guest': 0,
    'user': 1,
    'premium': 2,
    'admin': 3,
  };

  /**
   * 현재 유저 등급으로 해당 아이템을 구매할 수 있는지 판별
   * - skin, avatar 카테고리에만 적용 (piece/background/frame은 기존 hasAccessToTab으로 제어)
   * - 서버에서도 동일 로직을 한 번 더 검증하므로 UI 가이드 용도
   */
  const canPurchaseItem = (item: ShopItem): boolean => {
    // admin은 모든 아이템 구매 가능
    if (role === 'admin') return true;
    // skin, avatar 카테고리에만 등급 제한 적용
    if (item.category !== 'skin' && item.category !== 'avatar') return true;
    const userLevel = ROLE_HIERARCHY[role] ?? 0;
    const requiredLevel = RARITY_MIN_ROLE_LEVEL[item.rarity] ?? 2;
    return userLevel >= requiredLevel;
  };

  /** 현재 사용자 등급이 요구 등급 이상인지 판별 */
  const meetsRoleRequirement = (requiredRole: string): boolean => {
    return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
  };

  // 권한 및 소유 로직
  const isItemOwned = (item: ShopItem) => {
    // requiredRole이 있는 아이템: 등급 기반 자동 소유 판별
    if (item.requiredRole) {
      return meetsRoleRequirement(item.requiredRole);
    }
    // 기존 로직: isDefault는 무조건 소유, admin은 전부 소유
    if (item.isDefault) return true;
    if (role === 'admin') return true;
    return hasItem(item.item_id);
  };

  const hasAccessToTab = (tabId: string) => {
    if (role === 'admin' || role === 'premium') return true;
    return !['piece', 'background', 'frame'].includes(tabId);
  };

  // 렌더링용 리스트 구성 (필터링 + 정렬)
  const filteredItems = useMemo(() => {
    let items = MOCK_ITEMS.filter((item) => item.category === activeTab);
    
    // 보관함 모드면 소유한 아이템만
    if (viewMode === 'inventory') {
      items = items.filter(isItemOwned);
    }
    
    // 정렬: 기본 보유 맨 위 (모든 카테고리 공통) → 소유 아이템 → 미소유
    // 왜 이 순서인가: 모든 탭에서 기본 보유 항목을 가장 먼저 보고 선택할 수 있게
    const DEFAULT_ORDER: Record<string, number> = {
      // 스킨 순서
      'skin_chip_base': 1,
      'horse': 2,
      'spaceship': 3,
      // 아바타 등급별 순서 (게스트 → 노말 → 프리미엄 → 관리자)
      'avatar_guest': 1,
      'avatar_normal': 2,
      'avatar_premium': 3,
      'avatar_admin': 4,
    };

    items.sort((a, b) => {
      // 1순위: 기본 보유 아이템을 항상 맨 위로 (모든 카테고리 공통)
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;

      // 기본 보유 간 고정 순서 (스킨: 포커칩 → 경주마 → 우주선, 그 외는 등록 순)
      if (a.isDefault && b.isDefault) {
        const orderA = DEFAULT_ORDER[a.item_id] ?? 99;
        const orderB = DEFAULT_ORDER[b.item_id] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
      }

      // 2순위: 상점 모드에서 소유 아이템 우선
      if (viewMode === 'shop') {
        const aOwned = isItemOwned(a) ? 1 : 0;
        const bOwned = isItemOwned(b) ? 1 : 0;
        if (aOwned !== bOwned) return bOwned - aOwned;
      }
      
      if (a.price !== b.price) return a.price - b.price; // 가격 싼게 먼저
      
      return a.name.localeCompare(b.name);
    });

    return items;
  }, [activeTab, viewMode, inventory, role]);

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
      // ── 구매 로직 (Server Action 기반) ──
      if (!isLoggedIn || !userProfile?.id) {
        toast.error("로그인이 필요합니다.");
        return;
      }
      if (isItemOwned(item)) {
        toast.info("이미 보유한 아이템입니다.");
        return;
      }

      // 클라이언트 단 사전 검증 (빠른 피드백용, 서버에서 한 번 더 검증됨)
      if (!canPurchaseItem(item)) {
        toast.error("프리미엄 전용 상품입니다. 등급을 업그레이드해주세요.");
        return;
      }
      if (item.requiresPremium && !['admin', 'premium'].includes(role)) {
        toast.error("프리미엄 등급 이상만 구매 가능합니다.");
        return;
      }
      if (chips < item.price) {
        toast.error(`칩이 부족합니다! (보유: ${chips.toLocaleString()}C / 필요: ${item.price.toLocaleString()}C)`);
        return;
      }

      try {
        // 서버 액션 호출: 서버에서 유저 role, rarity 권한, 칩 잔액을 모두 검증 후 차감
        const result = await purchaseShopItem(item.item_id);

        if (!result.success) {
          toast.error(result.error || "구매 중 오류가 발생했습니다.");
          return;
        }

        // 구매 성공: 클라이언트 상태 동기화
        deductChipsLocally(item.price);
        buyItem(item.item_id);
        toast.success(`${item.name} 구매 완료! (-${item.price.toLocaleString()}C)`);
        
        // 미션 이벤트: 아이템 구매
        stampService.trackEvent('buy_item', 1);
        stampService.flushPlayEvents();
      } catch (error) {
        toast.error("네트워크 오류가 발생했습니다.");
      }
    } else {
      // ── 장착 로직 (기존 클라이언트 상태 즉시 반영 + 서버 비동기 동기화) ──
      if (item.category === 'avatar' || item.category === 'border' || item.category === 'skin' || item.category === 'piece' || item.category === 'background' || item.category === 'frame') {
        const currentEquipped = equipped[item.category];
        const isUnequip = currentEquipped === item.item_id;
        
        if (isUnequip) {
          unequipItem(item.category);
          toast.success(`${item.name} 장착을 해제했습니다.`);
        } else {
          equipItem(item.category, item.item_id);
          toast.success(`${item.name} 장착 완료!`);
        }

        // 서버 DB 프로필에 장착 상태 저장 (백그라운드 비동기 처리)
        // 로그인 상태인 경우에만 DB 동기화가 동작하므로 에러 발생 시 무시하거나 경고만 띄움
        import('@/app/actions/inventory').then(({ equipItemAction }) => {
          equipItemAction(item.category as keyof typeof equipped, isUnequip ? null : item.item_id).catch(err => {
            console.error('Failed to sync equipped status to server', err);
          });
        });
      }
    }
  };

  // 버튼 UI 동적 렌더링 로직
  const renderActionButton = (item: ShopItem) => {
    const isOwned = isItemOwned(item);
    const canAccess = hasAccessToTab(item.category);

    // 탭 자체가 잠긴 경우 (piece/background/frame → premium 전용)
    if (!canAccess) {
      return (
        <button disabled className="px-8 py-2.5 bg-neutral-800 text-neutral-500 font-extrabold text-base rounded-full border border-neutral-700 flex items-center gap-2">
          <Lock size={18} />
          <span>프리미엄 전용</span>
        </button>
      );
    }

    if (viewMode === 'shop') {
      // 등급 기반 아이템: 등급 부족 시 '등급 상승 시 획득' (구매 불가)
      if (item.requiredRole && !meetsRoleRequirement(item.requiredRole)) {
        return (
          <button disabled className="px-8 py-2.5 bg-neutral-800 text-neutral-500 font-extrabold text-base rounded-full border border-neutral-700 flex items-center gap-2">
            <Lock size={18} />
            <span>등급 상승 시 획득</span>
          </button>
        );
      }
      // 등급 기반 아이템: 등급 충분 시 '기본 보유'
      if (item.requiredRole && meetsRoleRequirement(item.requiredRole)) {
        return (
          <button disabled className="px-8 py-2.5 bg-neutral-800 text-neutral-400 font-extrabold text-base rounded-full border border-neutral-700">
            <span>기본 보유</span>
          </button>
        );
      }
      if (item.isDefault) {
        return (
          <button disabled className="px-8 py-2.5 bg-neutral-800 text-neutral-400 font-extrabold text-base rounded-full border border-neutral-700">
            <span>기본 보유</span>
          </button>
        );
      }
      if (isOwned) {
        return (
          <button disabled className="px-8 py-2.5 bg-neutral-800 text-neutral-400 font-extrabold text-base rounded-full border border-neutral-700">
            <span>보유 중</span>
          </button>
        );
      }

      // ★ 핵심: 등급(role)별 희귀도(rarity) 구매 제한 검사
      // 열람은 가능하지만, 구매 권한이 없으면 "프리미엄 전용 상품"으로 표시
      if (!canPurchaseItem(item)) {
        return (
          <button disabled className="px-8 py-2.5 bg-neutral-800 text-neutral-500 font-extrabold text-base rounded-full border border-neutral-700 flex items-center gap-2">
            <Lock size={18} />
            <span>프리미엄 전용 상품</span>
          </button>
        );
      }

      return (
        <button 
          onClick={() => handleAction(item)}
          className="px-8 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-black font-extrabold text-base rounded-full shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:shadow-[0_0_30px_rgba(245,158,11,0.8)] hover:scale-105 transition-all active:scale-95 flex items-center gap-2 border border-yellow-400/50"
        >
          <span>{item.price.toLocaleString()} 칩 구매</span>
        </button>
      );
    } 
    
    // 보관함 모드
    // 스킨은 대기실에서 직접 선택하는 구조이므로 장착 버튼 불필요
    if (item.category === 'skin') {
      return (
        <div className="px-8 py-2.5 bg-neutral-800/80 text-neutral-400 font-extrabold text-base rounded-full border border-neutral-700">
          참가자 스킨 보유중
        </div>
      );
    }

    if (item.category === 'avatar' || item.category === 'border') {
      const isEquipped = equipped[item.category as keyof typeof equipped] === item.item_id;
      return (
        <button 
          onClick={() => handleAction(item)}
          className={`px-8 py-2.5 font-extrabold text-base rounded-full transition-all active:scale-95 flex items-center gap-2 border ${
            isEquipped 
              ? "bg-red-500/20 text-red-400 border-red-500/50 hover:bg-red-500/30" 
              : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.6)]"
          }`}
        >
          <span>{isEquipped ? '장착 해제' : '장착하기'}</span>
        </button>
      );
    }

    return (
      <div className="px-8 py-3 bg-neutral-800/80 text-cyan-400 font-bold rounded-full border border-cyan-900/50">
        맵 에디터에서 사용 가능
      </div>
    );
  };

  const isTabLocked = !hasAccessToTab(activeTab);
  
  // 테마별 클래스 적용 (상점=앰버, 보관함=시안, 맵스토어=딥그린)
  const themeAccent = viewMode === 'shop' ? 'amber' : viewMode === 'inventory' ? 'cyan' : 'emerald';
  const themeBg = viewMode === 'shop' ? 'bg-neutral-950' : viewMode === 'inventory' ? 'bg-[#050B14]' : 'bg-[#04110A]';

  return (
    <div className={`min-h-screen text-white overflow-hidden transition-colors duration-700 ${themeBg}`}>
      <main className="max-w-7xl mx-auto pt-24 px-6 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* 상단 버튼 그룹 */}
        <div className="absolute top-8 right-6 z-50 flex gap-4">
          {/* 커스텀 맵 스토어 진입 버튼 — '내 보관함' 왼쪽, 에메랄드(그린) 박스 */}
          <button
            onClick={() => setViewMode(viewMode === 'mapstore' ? 'shop' : 'mapstore')}
            className={`flex items-center gap-2 px-5 py-2.5 backdrop-blur-md border rounded-full font-bold text-sm transition-all shadow-lg group ${
              viewMode === 'mapstore'
                ? 'bg-amber-900/40 border-amber-500/30 text-amber-300 hover:bg-amber-800/60 hover:border-amber-400'
                : 'bg-emerald-900/40 border-emerald-500/30 text-emerald-300 hover:bg-emerald-800/60 hover:border-emerald-400 shadow-emerald-900/30'
            }`}
          >
            {viewMode === 'mapstore' ? <ShoppingCart size={16} /> : <Store size={16} />}
            {viewMode === 'mapstore' ? '상점으로 가기' : '커스텀 맵 스토어'}
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'inventory' ? 'shop' : 'inventory')}
            className={`flex items-center gap-2 px-5 py-2.5 backdrop-blur-md border rounded-full font-bold text-sm transition-all shadow-lg group ${
              viewMode !== 'inventory'
                ? 'bg-cyan-900/40 border-cyan-500/30 text-cyan-300 hover:bg-cyan-800/60 hover:border-cyan-400'
                : 'bg-amber-900/40 border-amber-500/30 text-amber-300 hover:bg-amber-800/60 hover:border-amber-400'
            }`}
          >
            {viewMode !== 'inventory' ? <Package size={16} /> : <ShoppingCart size={16} />}
            {viewMode !== 'inventory' ? '내 보관함' : '상점으로 가기'}
          </button>

          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900/80 backdrop-blur-md border border-white/10 hover:border-neutral-500 hover:bg-neutral-800 rounded-full text-neutral-300 transition-all shadow-lg group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            메인으로 돌아가기
          </button>
        </div>

        {viewMode === 'mapstore' ? (
          /* 커스텀 맵 스토어 모드: 쇼케이스+리스트 그리드를 통째로 대체 */
          <MapStorePanel />
        ) : (
        <>
        {/* 좌측: 3D 쇼케이스 및 기타 패널 */}
        <div className="lg:col-span-5 flex flex-col gap-6 h-[calc(100vh-140px)] overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-transparent">
          <div className={`relative w-full shrink-0 aspect-square md:aspect-auto md:h-[420px] bg-neutral-900/50 border rounded-2xl overflow-hidden shadow-2xl backdrop-blur-md flex flex-col transition-colors duration-500 ${
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
              <div className="relative z-20 flex flex-col items-center text-center px-4 py-4 bg-gradient-to-t from-black/95 via-black/80 to-transparent">
                <h2 className={`text-2xl md:text-3xl font-bold tracking-tight text-transparent bg-clip-text drop-shadow-md mb-1 bg-gradient-to-r ${
                  viewMode === 'shop' ? 'from-amber-200 via-yellow-400 to-amber-600' : 'from-cyan-200 via-blue-400 to-cyan-600'
                }`}>
                  {selectedItem.name}
                </h2>
                <p className="text-neutral-400 text-xs mb-3 max-w-sm leading-relaxed">{selectedItem.description}</p>
                {renderActionButton(selectedItem)}
              </div>
            )}
          </div>

          {/* 상점 모드일 때만 행운의 룰렛 표시 */}
          {viewMode === 'shop' && (
            <LuckyRoulette />
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
                const isEquipped = ['avatar', 'border', 'skin'].includes(item.category)
                  ? equipped[item.category as keyof typeof equipped] === item.item_id 
                  : false;
                
                const IconComp = item.iconName ? (LucideIcons as any)[item.iconName] : null;
                
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
                        {/* 벡터 스킨이면 Canvas로 렌더링, 아니면 기존 img/Icon */}
                        {getVectorSkinKey(item) ? (
                          <SkinCanvasPreview 
                            skinKey={getVectorSkinKey(item)!}
                            size={48}
                            color={
                              item.rarity === 'Mythic' ? '#ef4444' :
                              item.rarity === 'Legendary' ? '#facc15' :
                              item.rarity === 'Epic' ? '#a855f7' :
                              item.rarity === 'Rare' ? '#3b82f6' :
                              '#a3a3a3'
                            }
                          />
                        ) : item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-contain p-0.5 [clip-path:inset(2%_round_20%)]" />
                        ) : IconComp ? (
                          <IconComp className="w-8 h-8 text-neutral-300" />
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
                        <div className="font-bold text-neutral-500 text-sm">{item.isDefault ? '기본 보유' : '보유 중'}</div>
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
        </>
        )}

      </main>
    </div>
  );
}
