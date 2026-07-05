'use client';

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useChipStore } from '@/store/chipStore';
import { useUIStore } from '@/store/uiStore';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingCart, User } from 'lucide-react';
import { getProfileOverviewAction } from '@/presentation/actions/profileActions';
import { UserProfile } from '@/types/user';
import { MOCK_ITEMS } from '@/data/shopData';
import { useInventoryStore } from '@/store/inventoryStore';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

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
  const { equipped } = useInventoryStore();
  
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest).toLocaleString());

  const [isAnimating, setIsAnimating] = useState(false);
  const [prevChips, setPrevChips] = useState(0);
  const [isClient, setIsClient] = useState(false);
  const hasClaimableMissions = useUIStore((state) => state.hasClaimableMissions);

  useEffect(() => {
    setIsClient(true);

    // [최적화] 서버 사이드(layout.tsx)에서 블로킹하던 프로필/인증 정보를 클라이언트 마운트 시 즉시 비동기로 가져옵니다.
    const initAuth = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsLoggedIn(true);
        const data = await getProfileOverviewAction();
        if (data) {
          setUserProfile(data);
          useChipStore.getState().setChips(data.chips_balance);
        }
      } else {
        setIsLoggedIn(false);
        setUserProfile(null);
      }
    };
    initAuth();
  }, [setIsLoggedIn, setUserProfile]);

  useEffect(() => {
    if (!isClient) return;
    // 칩 변경 시 애니메이션 효과 실행
    setIsAnimating(true);
    const controls = animate(count, chips, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1], // 슬롯머신처럼 역동적인 ease-out
      onComplete: () => {
        setIsAnimating(false);
        setPrevChips(chips);
      }
    });
    return controls.stop;
  }, [chips, count, isClient]);

  // 오디오 매니저 클릭 사운드
  const playClickSound = () => {
    import('@/engine/AudioEngine').then(({ soundManager }) => soundManager.playSfx('ui_click'));
  };

  // 허용된 경로(대시보드 등)에서만 렌더링되도록 방어 로직 추가 (화이트리스트 방식)
  const allowedPaths = ['/dashboard', '/shop', '/profile', '/gacha', '/sound-test'];
  const isAllowedPath = allowedPaths.some(p => pathname?.startsWith(p));

  if (!isClient || !isAllowedPath || gameStage === 'editor' || gameStage === 'playing' || activeModal === 'auth') return null;

  const glowColorClass = chips > prevChips ? 'bg-green-400' : 'bg-red-500';
  const textColorClass = isAnimating 
    ? (chips > prevChips ? 'text-green-300 drop-shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'text-red-300') 
    : 'text-white';

  // 아바타 및 등급 설정
  let avatarImage = '/avatars/avatar_guest.png';
  let roleTitle = 'GUEST';
  let avatarBorder = 'border-white/20 shadow-[0_0_10px_rgba(255,255,255,0.1)]';
  let textGlow = 'text-white/70 group-hover:text-white';
  let roleColor = 'text-white/50';

  if (profile) {
    switch (profile.role) {
      case 'admin':
        avatarImage = '/avatars/avatar_admin.png';
        roleTitle = 'ADMIN';
        avatarBorder = 'border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.5)]';
        textGlow = 'text-red-100 group-hover:text-white drop-shadow-[0_0_5px_rgba(255,0,0,0.8)]';
        roleColor = 'text-red-400';
        break;
      case 'premium':
        avatarImage = '/avatars/avatar_premium.png';
        roleTitle = 'PREMIUM';
        avatarBorder = 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]';
        textGlow = 'text-amber-100 group-hover:text-white drop-shadow-[0_0_5px_rgba(251,191,36,0.8)]';
        roleColor = 'text-amber-400';
        break;
      case 'user':
        avatarImage = '/avatars/avatar_normal.png';
        roleTitle = 'NORMAL';
        avatarBorder = 'border-slate-400 shadow-[0_0_10px_rgba(148,163,184,0.3)]';
        textGlow = 'text-slate-200 group-hover:text-white';
        roleColor = 'text-slate-400';
        break;
      default:
        break;
    }
  }

  // 최우선으로 장착된 아바타 확인 (보관함 연동)
  const activeAvatarId = equipped.avatar || profile?.avatar_id;
  
  if (activeAvatarId) {
    const customAvatar = MOCK_ITEMS.find(item => item.item_id === activeAvatarId);
    if (customAvatar && customAvatar.image) {
      avatarImage = customAvatar.image;
    }
  }

  const playerName = profile?.username || profile?.name || (isLoggedIn ? 'Player' : 'Guest');

  return (
    <div className="fixed top-4 left-4 z-[9999] flex items-center gap-3">
      {/* 1. 프리미엄 Glassmorphism 컨테이너 */}
      <div className="flex items-center bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-white/20 transition-all duration-300">
        
        {/* 프로필 영역 */}
        <button 
          onClick={() => { playClickSound(); setActiveModal('profile'); }}
          className="flex items-center gap-3 pr-4 pl-1 group cursor-pointer"
        >
          <div className={`relative w-12 h-12 rounded-full overflow-hidden bg-zinc-900 shrink-0 border-2 transition-all duration-300 ${avatarBorder} group-hover:scale-105 flex items-center justify-center`}>
             <Image 
               src={avatarImage}
               alt="Avatar"
               fill
               className="object-cover object-center scale-[1.15]"
               sizes="48px"
             />
             {(!profile && !avatarImage) && <User className="absolute inset-0 m-auto w-6 h-6 text-white/50" />}
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300 z-10 pointer-events-none"></div>
          </div>
          
          <div className="flex flex-col items-start hidden sm:flex justify-center h-full">
            <span className={`text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${roleColor}`}>
              {roleTitle}
            </span>
            <span className={`text-base font-bold whitespace-nowrap transition-colors -mt-0.5 ${textGlow}`}>
              {playerName}
            </span>
          </div>
        </button>

        <div className="w-[1px] h-10 bg-white/10 mx-1 hidden sm:block"></div>

        {/* 칩 영역 */}
        <div className="flex items-center gap-3 pr-5 pl-2 cursor-default group relative">
          <div className="relative w-11 h-11 flex-shrink-0">
            <div className={`absolute inset-0 rounded-full blur-md opacity-0 transition-opacity duration-300 ${isAnimating ? `opacity-60 ${glowColorClass}` : 'group-hover:opacity-40 group-hover:bg-yellow-500'}`} />
            <div className="w-full h-full rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 border-2 border-yellow-200 flex items-center justify-center relative z-10 shadow-[inset_0_-2px_6px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform duration-300">
               <span className="text-yellow-950 font-black text-xl mt-0.5 drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]">$</span>
               <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          </div>
          <div className="flex flex-col items-start justify-center h-full">
             <span className="text-[10px] text-yellow-500 font-black tracking-widest uppercase mb-[-4px] whitespace-nowrap drop-shadow-[0_0_2px_rgba(234,179,8,0.3)]">
               CHIPS
             </span>
             <motion.span 
               className={`text-xl sm:text-2xl font-black tracking-tight transition-all duration-300 whitespace-nowrap ${textColorClass}`}
             >
               {rounded}
             </motion.span>
          </div>
        </div>

      </div>

      {/* 2. 상점 버튼 */}
      <button 
        onClick={() => { playClickSound(); router.push('/shop'); }}
        className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 hover:border-amber-400/80 hover:bg-amber-900/40 transition-all duration-300 flex items-center justify-center group relative shadow-[0_8px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_0_20px_rgba(251,191,36,0.4)]"
        title="VIP Shop"
      >
        <ShoppingCart className="w-6 h-6 text-amber-400 group-hover:text-amber-300 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)]" />
        <div className="absolute inset-0 rounded-full bg-amber-500/0 group-hover:bg-amber-500/10 transition-colors duration-300"></div>
      </button>

      {/* 3. 스탬프 북 버튼 */}
      <button 
        onClick={() => { playClickSound(); setActiveModal('stampBook'); }}
        className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-xl border border-white/10 hover:border-red-400/80 hover:bg-red-900/40 transition-all duration-300 flex items-center justify-center group relative shadow-[0_8px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_0_20px_rgba(248,113,113,0.4)]"
        title="Stamp Book (Missions)"
      >
        <span className="text-2xl group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_8px_rgba(248,113,113,0.6)]">📖</span>
        {hasClaimableMissions && (
          <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-black animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.9)]"></span>
        )}
      </button>

    </div>
  );
}
