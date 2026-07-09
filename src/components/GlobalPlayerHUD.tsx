'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useChipStore } from '@/store/chipStore';
import { useUIStore } from '@/store/uiStore';
import { useGameStore } from '@/store/gameStore';
import { useRouter, usePathname } from 'next/navigation';
import { getProfileOverviewAction } from '@/presentation/actions/profileActions';
import { MOCK_ITEMS } from '@/data/shopData';
import { useInventoryStore } from '@/store/inventoryStore';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { fetchInventoryAction } from '@/app/actions/inventory';
import { ShoppingCart, Package, ArrowLeft, Store } from 'lucide-react';

export default function GlobalPlayerHUD() {
  const router = useRouter();
  const pathname = usePathname();
  const chips = useChipStore((state) => state.chips);
  const setActiveModal = useUIStore((state) => state.setActiveModal);
  const activeModal = useUIStore((state) => state.activeModal);
  const isLoggedIn = useUIStore((state) => state.isLoggedIn);
  const setIsLoggedIn = useUIStore((state) => state.setIsLoggedIn);
  const gameStage = useUIStore((state) => state.gameStage);
  const profile = useUIStore((state) => state.userProfile);
  const setUserProfile = useUIStore((state) => state.setUserProfile);
  const hasClaimableMissions = useUIStore((state) => state.hasClaimableMissions);
  const { shopViewMode, setShopViewMode } = useUIStore();
  
  // NOTE: `equipped_frame` will be supported by inventory sync. 
  // For now we map it from the generic equipped object.
  const { equipped } = useInventoryStore();
  
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());

  const [isAnimating, setIsAnimating] = useState(false);
  const [prevChips, setPrevChips] = useState(0);
  const [isClient, setIsClient] = useState(false);


  useEffect(() => {
    setIsClient(true);

    const initAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        const currentCachedUserId = useInventoryStore.getState().userId;
        if (currentCachedUserId && currentCachedUserId !== session.user.id) {
          useInventoryStore.getState().reset();
          setUserProfile(null);
        }
        
        const currentGameUserId = useGameStore.getState().userId;
        if (currentGameUserId && currentGameUserId !== session.user.id) {
          useGameStore.getState().resetSession();
        }
        useGameStore.getState().setUserId(session.user.id);

        setIsLoggedIn(true);
        const data = await getProfileOverviewAction();
        if (data) {
          setUserProfile(data);
          useChipStore.getState().setChips(data.chips_balance);
        }
        
        const invData = await fetchInventoryAction();
        if (invData?.success && invData.inventory && invData.equipped) {
          useInventoryStore.getState().hydrateFromServer(session.user.id, invData.inventory, invData.equipped);
        }
      } else {
        setIsLoggedIn(false);
        setUserProfile(null);
        useInventoryStore.getState().reset();
        
        if (useGameStore.getState().userId !== null) {
          useGameStore.getState().resetSession();
        }
      }
    };
    initAuth();

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false);
        setUserProfile(null);
        useInventoryStore.getState().reset();
        useGameStore.getState().resetSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setIsLoggedIn, setUserProfile]);

  useEffect(() => {
    if (!isClient) return;
    setIsAnimating(true);
    const controls = animate(count, chips, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1],
      onComplete: () => {
        setIsAnimating(false);
        setPrevChips(chips);
      }
    });
    return controls.stop;
  }, [chips, count, isClient]);

  const playClickSound = () => {
    import('@/engine/AudioEngine').then(({ soundManager }) => soundManager.playSfx('ui_click'));
  };

  const allowedPaths = ['/dashboard', '/shop', '/profile', '/gacha', '/sound-test', '/map-store'];
  const isAllowedPath = allowedPaths.some(p => pathname?.startsWith(p));

  if (!isClient || !isAllowedPath || gameStage === 'editor' || gameStage === 'playing' || activeModal === 'auth') return null;

  // 아바타 및 롤 세팅
  let avatarImage = '/avatars/avatar_guest.png';
  let roleTitle = 'GUEST';
  let roleBadgeColor = 'bg-gray-700/50 text-gray-300 border-gray-500/30';
  let glassPanelBorder = 'border-white/5';
  
  if (profile) {
    switch (profile.role) {
      case 'admin':
        avatarImage = '/avatars/avatar_admin.png';
        roleTitle = 'ADMIN';
        roleBadgeColor = 'bg-gradient-to-r from-red-600 to-red-900 text-white shadow-[0_0_10px_rgba(255,0,85,0.5)] border-red-400/50';
        glassPanelBorder = 'border-red-500/20';
        break;
      case 'premium':
        avatarImage = '/avatars/avatar_premium.png';
        roleTitle = 'PREMIUM';
        roleBadgeColor = 'bg-gradient-to-r from-amber-500 to-amber-700 text-white shadow-[0_0_10px_rgba(251,191,36,0.4)] border-amber-300/50';
        glassPanelBorder = 'border-amber-500/20';
        break;
      case 'user':
        avatarImage = '/avatars/avatar_normal.png';
        roleTitle = 'NORMAL';
        roleBadgeColor = 'bg-gray-700/50 text-gray-300 border-gray-500/30';
        glassPanelBorder = 'border-white/5';
        break;
    }
  }

  // 커스텀 아바타 아이템 착용 처리
  const activeAvatarId = equipped.avatar || profile?.avatar_id;
  if (activeAvatarId) {
    const customAvatar = MOCK_ITEMS.find(item => item.item_id === activeAvatarId);
    if (customAvatar && customAvatar.image) {
      avatarImage = customAvatar.image;
    }
  }

  // TODO: 상점에서 구입/장착한 테두리가 있다면 여기서 조회하여 클래스를 변경합니다.
  // 현재는 계정 등급(Role) 기반의 기본 제공 프레임을 할당합니다.
  const activeFrameId = (equipped as any).frame || null; // inventory 스키마 지원 시 활성화
  
  const renderAvatarFrame = () => {
    // 1. 커스텀 테두리를 장착한 경우 (예: 'cyberpunk')
    if (activeFrameId === 'cyberpunk') {
      return (
        <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml;utf8,<svg viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'><polygon points=\'50 3, 93 25, 93 75, 50 97, 7 75, 7 25\' fill=\'none\' stroke=\'%2300ffff\' stroke-width=\'4\'/><polygon points=\'50 8, 88 28, 88 72, 50 92, 12 72, 12 28\' fill=\'none\' stroke=\'%23ff00ff\' stroke-width=\'2\' stroke-dasharray=\'4,4\' opacity=\'0.8\'/></svg>')] bg-no-repeat bg-center bg-contain animate-[pulse_2s_infinite] drop-shadow-[0_0_10px_cyan]"></div>
      );
    }
    
    // 2. 미장착 시: 계정 등급에 따른 기본 프레임
    if (profile?.role === 'admin') {
      return <div className="absolute inset-0 z-0 rounded-full bg-[conic-gradient(from_0deg,transparent_70%,#ff0055_80%,transparent_100%)] animate-[spin_3s_linear_infinite]"></div>;
    }
    if (profile?.role === 'premium') {
      return <div className="absolute inset-0 z-0 rounded-full bg-[conic-gradient(from_0deg,transparent_40%,#fbbf24_80%,transparent_100%)] animate-[spin_4s_linear_infinite]"></div>;
    }
    // Guest/User Base Frame
    return <div className="absolute inset-[6px] z-0 rounded-full border-[3px] border-white/10"></div>;
  };

  const playerName = profile?.username || profile?.name || (isLoggedIn ? 'Player' : 'Guest');

  return (
    <>
      <style>{`
        .glass-panel {
          background: linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.6) 100%);
          backdrop-filter: blur(20px);
          box-shadow: inset 0 1px 1px rgba(255,255,255,0.1), inset 0 -1px 10px rgba(0,0,0,0.5), 0 15px 35px rgba(0,0,0,0.8);
        }
        @keyframes breathe-admin { 0%, 100% { box-shadow: 0 0 15px rgba(255,0,85,0.3); } 50% { box-shadow: 0 0 35px rgba(255,0,85,0.7); } }
        @keyframes breathe-premium { 0%, 100% { box-shadow: 0 0 15px rgba(251,191,36,0.3); } 50% { box-shadow: 0 0 35px rgba(251,191,36,0.6); } }
        @keyframes float-chip { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px) scale(1.05); } }
        .float-anim { animation: float-chip 3s ease-in-out infinite; }
        .nav-btn { position: relative; overflow: hidden; }
        .nav-btn::before {
          content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%); width: 0; height: 3px; background: currentColor; transition: width 0.3s ease;
        }
        .nav-btn:hover::before { width: 100%; }
      `}</style>
      
      {/* GLOBAL TOP HEADER (V12) */}
      <div className="fixed top-4 left-4 right-4 md:top-8 md:left-8 md:right-8 z-[9999] flex justify-between items-start pointer-events-none">
        
        {/* LEFT: Modular Profile Panel */}
        <div className="relative flex items-center w-[450px] pointer-events-auto scale-[0.7] sm:scale-[0.8] md:scale-90 xl:scale-100 origin-top-left transition-transform duration-300">
          
          {/* Glass Body */}
          <button 
            onClick={() => { playClickSound(); setActiveModal('profile'); }}
            className={`glass-panel-heavy ml-[55px] pl-[65px] pr-8 h-[72px] rounded-r-full border ${glassPanelBorder} flex items-center gap-6 relative border-l-0 flex-1 hover:brightness-110 transition-all text-left`}
          >
            <div className="flex flex-col items-start justify-center relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <div className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase border ${roleBadgeColor}`}>
                  {roleTitle}
                </div>
              </div>
              <span className={`text-xl font-black tracking-wide ${profile?.role === 'admin' || profile?.role === 'premium' ? 'text-white' : 'text-gray-200'}`}>
                {playerName}
              </span>
            </div>
            
            <div className="w-[1px] h-10 bg-white/10 ml-auto hidden sm:block"></div>
            
            {/* Chips Area */}
            <div className="flex items-center gap-3 relative z-10">
              <div className="relative w-12 h-12 rounded-full flex items-center justify-center bg-black/60 shadow-[inset_0_2px_10px_rgba(255,215,0,0.1),0_0_15px_rgba(0,0,0,0.8)] border border-yellow-500/30">
                <Image src="/images/assets/hud/luxury_chip_icon.png" alt="Chips" fill className="object-contain scale-125 float-anim drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[9px] font-black tracking-widest text-yellow-500/80 uppercase leading-none mb-1">CHIPS</span>
                <motion.span className={`text-2xl font-black leading-none tracking-tighter ${profile?.role === 'admin' || profile?.role === 'premium' ? 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-[0_2px_15px_rgba(251,191,36,0.3)]' : 'text-yellow-500'}`}>
                  {rounded}
                </motion.span>
              </div>
            </div>
          </button>

          {/* Modular Avatar & Frame Container (Absolute over the left edge) */}
          <button 
            onClick={() => { playClickSound(); setActiveModal('profile'); }}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[110px] h-[110px] z-20 flex items-center justify-center group cursor-pointer"
          >
            {renderAvatarFrame()}
            
            {/* Core Avatar (Fixed 90px size) */}
            <div className={`absolute w-[90px] h-[90px] rounded-full border-4 border-[#0b0d13] bg-zinc-900 overflow-hidden ${profile?.role === 'admin' ? 'animate-[breathe-admin_3s_infinite]' : profile?.role === 'premium' ? 'animate-[breathe-premium_4s_infinite]' : 'shadow-[0_0_15px_rgba(0,0,0,0.8)]'}`}>
              <Image src={avatarImage} alt="Avatar" fill className={`object-cover group-hover:scale-110 transition-transform duration-500 ${!profile || profile.role === 'user' ? 'grayscale opacity-80' : ''}`} />
            </div>

            {/* Role specific mini badge on avatar */}
            {profile?.role === 'admin' && (
              <div className="absolute -bottom-2 bg-red-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full border-2 border-[#0b0d13] shadow-[0_0_10px_rgba(255,0,85,0.8)] z-30">OWNER</div>
            )}
            {profile?.role === 'premium' && (
              <div className="absolute -bottom-2 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full border-2 border-[#0b0d13] shadow-[0_0_10px_rgba(251,191,36,0.6)] z-30">VIP</div>
            )}
          </button>
        </div>

        {/* RIGHT: Context-Aware Action Navigation */}
        <div className="glass-panel-heavy rounded-full flex items-center p-2 px-3 gap-2 pointer-events-auto border border-white/5 h-[72px] scale-[0.7] sm:scale-[0.8] md:scale-90 xl:scale-100 origin-top-right transition-transform duration-300">
          
          {pathname.startsWith('/shop') ? (
            <>
              {/* SHOP MODE NAVIGATION */}
              <button onClick={() => { playClickSound(); setShopViewMode(shopViewMode === 'mapstore' ? 'shop' : 'mapstore'); }} className={`nav-btn flex items-center gap-3 px-5 h-full rounded-full transition-all group ${shopViewMode === 'mapstore' ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 hover:bg-white/5'}`}>
                {shopViewMode === 'mapstore' ? <ShoppingCart size={22} /> : <Store size={22} />}
                <span className="text-[15px] font-black tracking-widest uppercase">{shopViewMode === 'mapstore' ? '상점으로 가기' : '맵 스토어'}</span>
              </button>

              <button onClick={() => { playClickSound(); setShopViewMode(shopViewMode === 'inventory' ? 'shop' : 'inventory'); }} className={`nav-btn flex items-center gap-3 px-5 h-full rounded-full transition-all group ${shopViewMode === 'inventory' ? 'text-amber-400 bg-amber-500/10' : 'text-cyan-400 hover:bg-white/5'}`}>
                {shopViewMode !== 'inventory' ? <Package size={22} /> : <ShoppingCart size={22} />}
                <span className="text-[15px] font-black tracking-widest uppercase">{shopViewMode !== 'inventory' ? '내 보관함' : '상점으로 가기'}</span>
              </button>

              <div className="w-[1px] h-8 bg-white/10 mx-2"></div>

              <button onClick={() => { playClickSound(); router.push('/dashboard'); }} className="nav-btn flex items-center gap-3 px-5 h-full rounded-full hover:bg-white/5 transition-all text-gray-400 hover:text-white group">
                <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-[15px] font-black tracking-widest uppercase">대기실 복귀</span>
              </button>
            </>
          ) : (
            <>
              {/* LOBBY MODE NAVIGATION */}
              <button onClick={() => { playClickSound(); router.push('/shop'); }} className="nav-btn flex items-center gap-3 px-6 h-full rounded-full hover:bg-white/5 transition-all text-gray-300 hover:text-amber-400 group">
                <div className="w-8 h-8 relative drop-shadow-[0_0_8px_rgba(251,191,36,0.2)] group-hover:drop-shadow-[0_0_12px_rgba(251,191,36,0.6)] transition-all">
                  <Image src="/images/assets/hud/clean_shop_icon.png" alt="Shop" fill className="object-contain" />
                </div>
                <span className="text-[15px] font-black tracking-widest uppercase">상점</span>
              </button>

              <button onClick={() => { playClickSound(); setActiveModal('stampBook'); }} className="nav-btn flex items-center gap-3 px-6 h-full rounded-full hover:bg-white/5 transition-all text-gray-300 hover:text-red-400 group relative">
                {hasClaimableMissions && <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full shadow-[0_0_10px_red] animate-pulse"></div>}
                <div className="w-8 h-8 relative drop-shadow-[0_0_8px_rgba(239,68,68,0.2)] group-hover:drop-shadow-[0_0_12px_rgba(239,68,68,0.6)] transition-all">
                  <Image src="/images/assets/hud/clean_mission_icon.png" alt="Mission" fill className="object-contain" />
                </div>
                <span className="text-[15px] font-black tracking-widest uppercase">미션</span>
              </button>

              {profile?.role === 'admin' && (
                <button onClick={() => { playClickSound(); router.push('/admin'); }} className="nav-btn flex items-center gap-3 px-6 h-full rounded-full hover:bg-white/5 transition-all text-gray-300 hover:text-cyan-400 group">
                  <div className="w-8 h-8 relative drop-shadow-[0_0_8px_rgba(6,182,212,0.2)] group-hover:drop-shadow-[0_0_12px_rgba(6,182,212,0.6)] transition-all">
                    <Image src="/images/assets/hud/clean_admin_icon.png" alt="Admin" fill className="object-contain" />
                  </div>
                  <span className="text-[15px] font-black tracking-widest uppercase">터미널</span>
                </button>
              )}
            </>
          )}

        </div>

      </div>
    </>
  );
}
