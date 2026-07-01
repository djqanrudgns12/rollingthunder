'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { UserProfile } from '@/types/user';
import PasswordChangeModal from './PasswordChangeModal';
import Image from 'next/image';
import { MOCK_ITEMS } from '@/data/shopData';

interface Props {
  profile: UserProfile;
}

export default function ProfileCard({ profile }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Tilt Effect State
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const springConfig = { damping: 20, stiffness: 300 };
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [15, -15]), springConfig);
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-15, 15]), springConfig);
  
  // Hologram positioning
  const backgroundPosition = useTransform(
    [x, y],
    ([latestX, latestY]) => `${(latestX as number + 0.5) * 100}% ${(latestY as number + 0.5) * 100}%`
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma !== null && e.beta !== null) {
        const xPct = Math.min(Math.max(e.gamma / 45, -0.5), 0.5);
        const yPct = Math.min(Math.max((e.beta - 45) / 45, -0.5), 0.5);
        x.set(xPct);
        y.set(yPct);
      }
    };
    
    if (typeof window !== 'undefined' && window.matchMedia("(pointer: coarse)").matches) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [x, y]);

  // Determine card style based on role
  let themeClasses = '';
  let neonGlow = '';
  let avatarImage = '';
  let roleTitle = '';
  let avatarBorder = '';

  switch (profile.role) {
    case 'admin':
      themeClasses = 'bg-gradient-to-br from-neutral-900 via-red-950 to-black border-red-500/50 text-red-500 shadow-[0_0_40px_rgba(255,0,0,0.25)]';
      neonGlow = 'drop-shadow-[0_0_8px_rgba(255,0,0,0.8)] text-red-500';
      avatarImage = '/avatars/avatar_admin.png';
      roleTitle = 'SYSTEM.ADMIN';
      avatarBorder = 'border-red-500 shadow-[0_0_15px_rgba(255,0,0,0.5)]';
      break;
    case 'premium':
      themeClasses = 'bg-gradient-to-br from-yellow-900 via-amber-700 to-black border-amber-400/80 text-amber-100 shadow-[0_0_40px_rgba(251,191,36,0.3)]';
      neonGlow = 'drop-shadow-[0_0_8px_rgba(251,191,36,0.6)] text-amber-300';
      avatarImage = '/avatars/avatar_premium.png';
      roleTitle = 'VVIP MEMBERSHIP';
      avatarBorder = 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]';
      break;
    case 'user':
      themeClasses = 'bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 border-gray-400 text-slate-900 shadow-2xl';
      neonGlow = 'drop-shadow-[0_0_2px_rgba(255,255,255,0.8)] text-slate-900';
      avatarImage = '/avatars/avatar_normal.png';
      roleTitle = 'CASINO VIP MEMBER';
      avatarBorder = 'border-slate-500 shadow-md';
      break;
    case 'guest':
    default:
      themeClasses = 'bg-white/10 backdrop-blur-xl border-white/20 text-white/90 shadow-[0_8px_32px_rgba(0,0,0,0.3)]';
      neonGlow = 'text-white/90';
      avatarImage = '/avatars/avatar_guest.png';
      roleTitle = 'GUEST ACCESS';
      avatarBorder = 'border-white/30';
      break;
  }

  if (profile.avatar_id) {
    const customAvatar = MOCK_ITEMS.find(item => item.item_id === profile.avatar_id);
    if (customAvatar && customAvatar.image) {
      avatarImage = customAvatar.image;
    }
  }

  // 실데이터 적용 (더미 데이터 방어코드 포함)
  const joinDate = new Date(profile.created_at).getFullYear();
  const formatChips = (num: number) => new Intl.NumberFormat().format(num);
  const achievementsCompleted = profile.achievements_completed ?? 0;
  const totalAchievements = profile.total_achievements ?? 50;

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[100dvh] bg-black bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 to-black p-4 overflow-hidden relative">
      
      {/* 앰비언트 라이트 배경 효과 */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center opacity-30">
        <div className={`w-[600px] h-[600px] rounded-full blur-[120px] ${profile.role === 'admin' ? 'bg-red-900' : profile.role === 'premium' ? 'bg-amber-700' : profile.role === 'user' ? 'bg-slate-700' : 'bg-gray-700'}`} />
      </div>

      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className={`relative w-full max-w-[500px] aspect-[1.6/1] rounded-2xl border-2 p-6 flex flex-col justify-between overflow-hidden cursor-pointer transition-colors duration-500 ${themeClasses} z-10`}
      >
        {/* Hologram Layer */}
        {profile.role !== 'guest' && (
          <motion.div
            className="absolute inset-0 opacity-30 mix-blend-overlay pointer-events-none"
            style={{
              backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%), 
                                linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)`,
              backgroundSize: '200% 200%',
              backgroundPosition,
            }}
          />
        )}

        {/* Shine Sweep Layer */}
        {['premium', 'admin'].includes(profile.role) && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_3s_infinite] pointer-events-none" />
        )}

        {/* 상단: 아바타 및 타이틀 */}
        <div style={{ transform: "translateZ(30px)" }} className="relative z-10 flex justify-between items-start">
          
          {/* 아바타 영역 */}
          <div className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 bg-black/50 shrink-0 ${avatarBorder}`}>
            <Image 
              src={avatarImage}
              alt="Player Avatar"
              fill
              className="object-cover"
              sizes="80px"
              priority
            />
          </div>

          {/* 타이틀 영역 (우측 정렬, 줄바꿈 방지) */}
          <div className="flex flex-col items-end min-w-0 flex-1 ml-4">
            <h1 className={`text-2xl sm:text-3xl font-black uppercase tracking-widest whitespace-nowrap overflow-visible ${neonGlow} ${profile.role === 'user' ? 'mix-blend-color-burn' : ''}`}>
              {roleTitle}
            </h1>
            <p className="text-sm opacity-80 uppercase tracking-widest mt-1 whitespace-nowrap">
              가입 연도: {joinDate || 'N/A'}
            </p>
          </div>
        </div>

        {/* 중단: 플레이어 이름 & 칩 */}
        <div style={{ transform: "translateZ(40px)" }} className="relative z-10 flex justify-between items-end mt-4">
          <div className="min-w-0 flex-1 pr-4">
            <p className="text-[11px] opacity-70 uppercase tracking-wider whitespace-nowrap">플레이어 이름</p>
            <p className={`text-2xl sm:text-3xl font-bold tracking-wider whitespace-nowrap overflow-visible ${neonGlow}`}>
              {profile.username || profile.name || 'ANONYMOUS'}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[11px] opacity-70 uppercase tracking-wider whitespace-nowrap">보유 칩 (Chips)</p>
            <p className={`text-2xl sm:text-3xl font-bold whitespace-nowrap overflow-visible flex items-center gap-2 justify-end ${neonGlow}`}>
              {formatChips(profile.chips_balance)} <span className="text-xl">💳</span>
            </p>
          </div>
        </div>

        {/* 하단: 통계 데이터 */}
        <div style={{ transform: "translateZ(40px)" }} className="relative z-10 flex justify-between border-t border-white/20 pt-4 mt-2">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] opacity-70 uppercase tracking-wider whitespace-nowrap">플레이 횟수</p>
            <p className="text-lg sm:text-xl font-semibold whitespace-nowrap">
              {formatChips(profile.total_games_played)} 회
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] opacity-70 uppercase tracking-wider whitespace-nowrap">달성한 업적</p>
            <p className="text-lg sm:text-xl font-semibold whitespace-nowrap flex items-center gap-1 justify-end">
              <span className={neonGlow}>{achievementsCompleted}</span>
              <span className="opacity-60 text-sm">/ {totalAchievements}</span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* 하단 버튼 영역 (Glassmorphism 스타일 업그레이드) */}
      <div className="mt-12 flex flex-wrap justify-center gap-4 z-10 relative">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-full font-medium transition backdrop-blur-md border border-white/10 shadow-lg hover:shadow-white/5 whitespace-nowrap"
        >
          비밀번호 변경
        </button>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="px-6 py-3 bg-indigo-600/80 hover:bg-indigo-500/90 text-white rounded-full font-medium transition backdrop-blur-md border border-indigo-400/30 shadow-[0_0_20px_rgba(79,70,229,0.4)] hover:shadow-[0_0_30px_rgba(79,70,229,0.6)] whitespace-nowrap"
        >
          ⬅ 메인으로 돌아가기
        </button>
      </div>

      <PasswordChangeModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}
