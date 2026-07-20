'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useChipStore } from '@/store/chipStore';
import { useUIStore } from '@/store/uiStore';
import { useGameStore } from '@/store/gameStore';
import { useRouter, usePathname } from 'next/navigation';
import { getLobbyBootstrapAction } from '@/presentation/actions/bootstrapActions';
import { readLobbyCache, writeLobbyCache, clearLobbyCache } from '@/lib/lobbyCache';
import { MOCK_ITEMS } from '@/data/shopData';
import { useInventoryStore } from '@/store/inventoryStore';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import { ShoppingCart, Package, ArrowLeft, Store } from 'lucide-react';
import AvatarBorder from '@/components/profile/AvatarBorder';

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
        const uid = session.user.id;

        // 계정 전환 가드 — 라이브 세션에서 계정이 바뀐 경우 이전 데이터 즉시 폐기
        const currentGameUserId = useGameStore.getState().userId;
        if (currentGameUserId && currentGameUserId !== uid) {
          useInventoryStore.getState().reset();
          setUserProfile(null);
          useChipStore.getState().setChips(0);
          useUIStore.getState().setIsAdmin(false);
          useGameStore.getState().resetSession();
        }
        useGameStore.getState().setUserId(uid);
        setIsLoggedIn(true);

        // 1) 캐시퍼스트 즉시 페인트 — userId가 정확히 일치하는 캐시만 사용(잔여 데이터 원천 차단).
        //    게스트/타계정에서는 readLobbyCache가 null을 반환하므로 아무것도 뜨지 않는다.
        const cached = readLobbyCache(uid);
        if (cached) {
          setUserProfile(cached.profile);
          useUIStore.getState().setIsAdmin(cached.profile.role === 'admin');
          useChipStore.getState().setChips(cached.chips);
          useInventoryStore.getState().hydrateFromServer(uid, cached.inventory, cached.equipped);
        }

        // 2) 서버 단일 부트스트랩 왕복으로 최신본 갱신 + 캐시 재기록
        //    (프로필+동의여부+인벤토리+업적통계를 한 번에 — 기존 3액션 워터폴 대체)
        const data = await getLobbyBootstrapAction();

        // 현재 시행 버전 약관에 동의 이력이 없는 회원은 재동의 게이트를 띄운다.
        // /terms, /privacy에서는 문서 열람을 막지 않도록 생략(링크는 새 탭으로 열리지만 직접 방문 보호).
        const path = window.location.pathname;
        if (data?.needsReconsent && !path.startsWith('/terms') && !path.startsWith('/privacy')) {
          useUIStore.getState().setActiveModal('reconsent');
        }

        if (data) {
          setUserProfile(data.profile);
          // isAdmin은 이 프로필이 단일 소스(기존 GameManager의 별도 role 쿼리 제거됨)
          useUIStore.getState().setIsAdmin(data.profile.role === 'admin');
          useChipStore.getState().setChips(data.profile.chips_balance);

          const settings = data.profile.settings;
          if (settings && Object.keys(settings).length > 0) {
            const state = useGameStore.getState();
            if (settings.gimmickDensity !== undefined) state.setGimmickDensity(settings.gimmickDensity);
            if (settings.baseTimeScale !== undefined) state.setBaseTimeScale(settings.baseTimeScale);
            if (settings.comebackStrength !== undefined) state.setComebackStrength(settings.comebackStrength);
            if (settings.playTime !== undefined) state.setPlayTime(settings.playTime);
            if (settings.isScreenShakeEnabled !== undefined) state.setScreenShakeEnabled(settings.isScreenShakeEnabled);
            if (settings.calmMode !== undefined) state.setCalmMode(settings.calmMode);
            if (settings.theme !== undefined) state.setTheme(settings.theme);
            if (settings.fontFamily !== undefined) state.setFontFamily(settings.fontFamily);
            if (settings.bgmVolume !== undefined) state.setBgmVolume(settings.bgmVolume);
            if (settings.sfxVolume !== undefined) state.setSfxVolume(settings.sfxVolume);
          }

          useInventoryStore.getState().hydrateFromServer(uid, data.inventory, data.equipped);

          // 다음 접속의 즉시 페인트용 캐시 갱신(userId 스탬프)
          writeLobbyCache({
            userId: uid,
            profile: data.profile,
            chips: data.profile.chips_balance,
            inventory: data.inventory,
            equipped: data.equipped,
          });
        }
      } else {
        // 게스트 — 모든 계정 데이터 + 캐시 완전 제거
        setIsLoggedIn(false);
        setUserProfile(null);
        useUIStore.getState().setIsAdmin(false);
        useChipStore.getState().setChips(0);
        useInventoryStore.getState().reset();
        clearLobbyCache();

        if (useGameStore.getState().userId !== null) {
          useGameStore.getState().resetSession();
        }
      }
    };
    initAuth();

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false);
        setUserProfile(null);
        useUIStore.getState().setIsAdmin(false);
        useChipStore.getState().setChips(0);
        useInventoryStore.getState().reset();
        clearLobbyCache();
        useGameStore.getState().resetSession();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setIsLoggedIn, setUserProfile]);

  // ── 주요 경로 프리페치 (페이지 전환 속도 향상) ──
  useEffect(() => {
    if (!isClient) return;
    // 현재 로비에 있으면 상점을, 상점에 있으면 로비를 미리 로드
    if (pathname?.startsWith('/shop')) {
      router.prefetch('/dashboard');
    } else {
      router.prefetch('/shop');
    }
  }, [isClient, pathname, router]);

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
  let roleBadgeColor = 'bg-gray-700/50 text-[var(--text-primary)] border-gray-500/30';
  let glassPanelBorder = 'border-[var(--panel-border)]';
  
  if (profile) {
    switch (profile.role) {
      case 'admin':
        avatarImage = '/avatars/avatar_admin.png';
        roleTitle = 'ADMIN';
        roleBadgeColor = 'bg-gradient-to-r from-red-600 to-red-900 text-[var(--text-primary)] shadow-[0_0_10px_rgba(255,0,85,0.5)] border-red-400/50';
        glassPanelBorder = 'border-red-500/20';
        break;
      case 'premium':
        avatarImage = '/avatars/avatar_premium.png';
        roleTitle = 'PREMIUM';
        roleBadgeColor = 'bg-gradient-to-r from-amber-500 to-amber-700 text-[var(--text-primary)] shadow-[0_0_10px_rgba(251,191,36,0.4)] border-amber-300/50';
        glassPanelBorder = 'border-amber-500/20';
        break;
      case 'user':
        avatarImage = '/avatars/avatar_normal.png';
        roleTitle = 'NORMAL';
        roleBadgeColor = 'bg-gray-700/50 text-[var(--text-primary)] border-gray-500/30';
        glassPanelBorder = 'border-[var(--panel-border)]';
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

  const activeBorderId = equipped.border;
  const activeFrameId = equipped.frame || null;
  
  const renderAvatarFrame = () => {
    if (activeBorderId && activeBorderId.startsWith('border_')) {
      return null; // AvatarBorder 컴포넌트가 대신 렌더링
    }
    
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
    return <div className="absolute inset-[6px] z-0 rounded-full border-[3px] border-[var(--panel-border-hover)]"></div>;
  };

  const playerName = profile?.nickname || profile?.name || (isLoggedIn ? 'Player' : 'Guest');

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
      <div className="fixed top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 md:top-8 md:left-8 md:right-8 z-[9999] flex justify-between items-start pointer-events-none">
        
        {/* LEFT: Modular Profile Panel */}
        <div className="relative flex items-center w-auto max-w-[75vw] sm:max-w-none sm:w-[380px] md:w-[450px] pointer-events-auto scale-[0.65] sm:scale-[0.8] md:scale-90 xl:scale-100 origin-top-left transition-transform duration-300">
          
          {/* Glass Body */}
          <button 
            onClick={() => { playClickSound(); setActiveModal('profile'); }}
            className={`glass-panel-heavy ml-[45px] sm:ml-[55px] pl-[50px] sm:pl-[65px] pr-4 sm:pr-8 h-[60px] sm:h-[72px] rounded-r-full border ${glassPanelBorder} flex items-center gap-3 sm:gap-6 relative border-l-0 flex-1 hover:brightness-110 transition-all text-left`}
          >
            <div className="flex flex-col items-start justify-center relative z-10">
              <div className="flex items-center gap-2 mb-1">
                <div className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase border ${roleBadgeColor}`}>
                  {roleTitle}
                </div>
              </div>
              <span className={`text-base sm:text-xl font-black tracking-wide ${profile?.role === 'admin' || profile?.role === 'premium' ? 'text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                {playerName}
              </span>
            </div>
            
            <div className="w-[1px] h-8 sm:h-10 bg-[var(--btn-bg-hover)] ml-auto hidden sm:block"></div>
            
            {/* Chips Area */}
            <div className="flex items-center gap-3 relative z-10">
              <div className="relative w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center bg-[var(--panel-bg-heavy)] shadow-[inset_0_2px_10px_rgba(255,215,0,0.1),0_0_15px_rgba(0,0,0,0.8)] border border-yellow-500/30">
                <Image src="/images/assets/hud/luxury_chip_icon.png" alt="Chips" fill className="object-contain scale-125 float-anim drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)]" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[9px] font-black tracking-widest text-yellow-500/80 uppercase leading-none mb-1">CHIPS</span>
                <motion.span className={`text-lg sm:text-2xl font-black leading-none tracking-tighter ${profile?.role === 'admin' || profile?.role === 'premium' ? 'text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 to-yellow-500 drop-shadow-[0_2px_15px_rgba(251,191,36,0.3)]' : 'text-yellow-500'}`}>
                  {rounded}
                </motion.span>
              </div>
            </div>
          </button>

          {/* Modular Avatar & Frame Container (Absolute over the left edge) */}
          <button 
            onClick={() => { playClickSound(); setActiveModal('profile'); }}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[85px] h-[85px] sm:w-[110px] sm:h-[110px] z-20 flex items-center justify-center group cursor-pointer"
          >
            {renderAvatarFrame()}
            
            {/* Core Avatar (Fixed 90px size) */}
            <AvatarBorder borderId={activeBorderId} className={`absolute w-[68px] h-[68px] sm:w-[90px] sm:h-[90px] rounded-full bg-zinc-900 ${!activeBorderId ? 'border-4 border-[#0b0d13] ' + (profile?.role === 'admin' ? 'animate-[breathe-admin_3s_infinite]' : profile?.role === 'premium' ? 'animate-[breathe-premium_4s_infinite]' : 'shadow-[0_0_15px_rgba(0,0,0,0.8)]') : ''}`}>
              <div className="absolute inset-0 rounded-[inherit] overflow-hidden">
                <Image src={avatarImage} alt="Avatar" fill className={`object-cover group-hover:scale-110 transition-transform duration-500 ${!profile || profile.role === 'user' ? 'grayscale opacity-80' : ''}`} />
              </div>
            </AvatarBorder>

            {/* Role specific mini badge on avatar */}
            {profile?.role === 'admin' && (
              <div className="absolute -bottom-2 bg-red-600 text-[var(--text-primary)] text-[9px] font-black px-2 py-0.5 rounded-full border-2 border-[#0b0d13] shadow-[0_0_10px_rgba(255,0,85,0.8)] z-30">OWNER</div>
            )}
            {profile?.role === 'premium' && (
              <div className="absolute -bottom-2 bg-amber-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full border-2 border-[#0b0d13] shadow-[0_0_10px_rgba(251,191,36,0.6)] z-30">VIP</div>
            )}
          </button>
        </div>

        {/* RIGHT: Context-Aware Action Navigation */}
        <div className="glass-panel-heavy rounded-full flex items-center p-1.5 px-2 sm:p-2 sm:px-3 gap-1 sm:gap-2 pointer-events-auto border border-[var(--panel-border)] h-[52px] sm:h-[64px] md:h-[72px] scale-[0.65] sm:scale-[0.8] md:scale-90 xl:scale-100 origin-top-right transition-transform duration-300">
          
          {pathname.startsWith('/shop') ? (
            <>
              {/* SHOP MODE NAVIGATION */}
              <button onClick={() => { playClickSound(); setShopViewMode(shopViewMode === 'mapstore' ? 'shop' : 'mapstore'); }} className={`nav-btn flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-full rounded-full transition-all group ${shopViewMode === 'mapstore' ? 'text-amber-400 bg-amber-500/10' : 'text-emerald-400 hover:bg-[var(--btn-bg)]'}`}>
                {shopViewMode === 'mapstore' ? <ShoppingCart size={20} /> : <Store size={20} />}
                <span className="text-[13px] sm:text-[15px] font-black tracking-widest uppercase hidden sm:inline">{shopViewMode === 'mapstore' ? '상점으로 가기' : '맵 스토어'}</span>
              </button>

              <button onClick={() => { playClickSound(); setShopViewMode(shopViewMode === 'inventory' ? 'shop' : 'inventory'); }} className={`nav-btn flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-full rounded-full transition-all group ${shopViewMode === 'inventory' ? 'text-amber-400 bg-amber-500/10' : 'text-cyan-400 hover:bg-[var(--btn-bg)]'}`}>
                {shopViewMode !== 'inventory' ? <Package size={20} /> : <ShoppingCart size={20} />}
                <span className="text-[13px] sm:text-[15px] font-black tracking-widest uppercase hidden sm:inline">{shopViewMode !== 'inventory' ? '내 보관함' : '상점으로 가기'}</span>
              </button>

              <div className="w-[1px] h-6 sm:h-8 bg-[var(--btn-bg-hover)] mx-1 sm:mx-2"></div>

              <button onClick={() => {
                playClickSound();
                // BFCache 활용: 브라우저 히스토리가 있으면 뒤로가기(즉시 복원),
                // 없으면(직접 URL 진입 등) push로 폴백
                if (window.history.length > 1) {
                  router.back();
                } else {
                  router.push('/dashboard');
                }
              }} className="nav-btn flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-full rounded-full hover:bg-[var(--btn-bg)] transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)] group">
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                <span className="text-[13px] sm:text-[15px] font-black tracking-widest uppercase hidden sm:inline">대기실 복귀</span>
              </button>
            </>
          ) : (
            <>
              {/* LOBBY MODE NAVIGATION */}
              <button onClick={() => { playClickSound(); router.push('/shop'); }} className="nav-btn flex items-center gap-2 sm:gap-3 px-3 sm:px-6 h-full rounded-full hover:bg-[var(--btn-bg)] transition-all text-[var(--text-primary)] hover:text-amber-400 group">
                <div className="w-8 h-8 sm:w-11 sm:h-11 relative drop-shadow-[0_0_8px_rgba(251,191,36,0.2)] group-hover:drop-shadow-[0_0_12px_rgba(251,191,36,0.6)] transition-all">
                  <Image src="/images/assets/hud/clean_shop_icon.png" alt="Shop" fill className="object-contain" />
                </div>
                <span className="text-[13px] sm:text-[18px] font-black tracking-widest uppercase hidden sm:inline">상점</span>
              </button>

              <button onClick={() => { playClickSound(); setActiveModal('stampBook'); }} className="nav-btn flex items-center gap-2 sm:gap-3 px-3 sm:px-6 h-full rounded-full hover:bg-[var(--btn-bg)] transition-all text-[var(--text-primary)] hover:text-red-400 group relative">
                {hasClaimableMissions && <div className="absolute top-1 right-1 sm:top-2 sm:right-2 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full shadow-[0_0_10px_red] animate-pulse"></div>}
                <div className="w-8 h-8 sm:w-11 sm:h-11 relative drop-shadow-[0_0_8px_rgba(239,68,68,0.2)] group-hover:drop-shadow-[0_0_12px_rgba(239,68,68,0.6)] transition-all">
                  <Image src="/images/assets/hud/clean_mission_icon.png" alt="Mission" fill className="object-contain" />
                </div>
                <span className="text-[13px] sm:text-[18px] font-black tracking-widest uppercase hidden sm:inline">미션</span>
              </button>

              {profile?.role === 'admin' && (
                <button onClick={() => { playClickSound(); router.push('/admin'); }} className="nav-btn flex items-center gap-2 sm:gap-3 px-3 sm:px-6 h-full rounded-full hover:bg-[var(--btn-bg)] transition-all text-[var(--text-primary)] hover:text-cyan-400 group">
                  <div className="w-8 h-8 sm:w-11 sm:h-11 relative drop-shadow-[0_0_8px_rgba(6,182,212,0.2)] group-hover:drop-shadow-[0_0_12px_rgba(6,182,212,0.6)] transition-all">
                    <Image src="/images/assets/hud/clean_admin_icon.png" alt="Admin" fill className="object-contain" />
                  </div>
                  <span className="text-[13px] sm:text-[18px] font-black tracking-widest uppercase hidden sm:inline">터미널</span>
                </button>
              )}
            </>
          )}

        </div>

      </div>
    </>
  );
}
