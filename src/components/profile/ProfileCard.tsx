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
      themeClasses = 'bg-gradient-to-br from-neutral-900 via-red-950/40 to-black border-red-500/60 text-red-500 shadow-[0_0_60px_rgba(220,38,38,0.3)]';
      neonGlow = 'drop-shadow-[0_0_12px_rgba(255,0,0,0.8)] text-red-500';
      avatarImage = '/avatars/avatar_admin.png';
      roleTitle = 'SYSTEM.ADMIN';
      avatarBorder = 'border-red-500 shadow-[0_0_25px_rgba(255,0,0,0.6)]';
      break;
    case 'premium':
      themeClasses = 'bg-gradient-to-br from-yellow-900/80 via-amber-700/50 to-black border-amber-400/80 text-amber-100 shadow-[0_0_60px_rgba(251,191,36,0.35)]';
      neonGlow = 'drop-shadow-[0_0_12px_rgba(251,191,36,0.7)] text-amber-300';
      avatarImage = '/avatars/avatar_premium.png';
      roleTitle = 'VVIP MEMBERSHIP';
      avatarBorder = 'border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.6)]';
      break;
    case 'user':
      themeClasses = 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 border-slate-400 text-slate-900 shadow-2xl';
      neonGlow = 'drop-shadow-[0_0_3px_rgba(255,255,255,0.9)] text-slate-900';
      avatarImage = '/avatars/avatar_normal.png';
      roleTitle = 'CASINO VIP MEMBER';
      avatarBorder = 'border-slate-500 shadow-lg';
      break;
    case 'guest':
    default:
      themeClasses = 'bg-white/5 backdrop-blur-3xl border-white/20 text-white/90 shadow-[0_8px_32px_rgba(0,0,0,0.4)]';
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

  // 실데이터 적용 (날짜 포맷 변경)
  const dateObj = new Date(profile.created_at);
  const joinDate = isNaN(dateObj.getTime()) ? '알 수 없음' : `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일`;
  
  const formatChips = (num: number) => {
    if (isNaN(num)) return '0';
    return new Intl.NumberFormat().format(num);
  };
  
  const achievementsCompleted = profile.achievements_completed ?? 0;
  const totalAchievements = profile.total_achievements ?? 50;

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[100dvh] bg-black bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900 to-black p-4 overflow-hidden relative">
      
      {/* 앰비언트 라이트 배경 효과 */}
      <div className="absolute inset-0 pointer-events-none flex justify-center items-center opacity-40">
        <div className={`w-[800px] h-[800px] rounded-full blur-[150px] ${profile.role === 'admin' ? 'bg-red-900' : profile.role === 'premium' ? 'bg-amber-700' : profile.role === 'user' ? 'bg-slate-700' : 'bg-gray-700'}`} />
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
        className={`relative w-full max-w-[700px] rounded-[2.5rem] border-[3px] p-8 sm:p-10 flex flex-col justify-between overflow-hidden cursor-pointer transition-colors duration-500 ${themeClasses} z-10 min-h-[400px]`}
      >
        {/* Hologram Layer */}
        {profile.role !== 'guest' && (
          <motion.div
            className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none"
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
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_4s_infinite] pointer-events-none" />
        )}

        {/* 컨텐츠 영역 (2단 분리 레이아웃) */}
        <div className="relative z-10 flex flex-col sm:flex-row gap-8 sm:gap-10 items-center sm:items-stretch h-full">
          
          {/* 아바타 영역 (좌측) */}
          <div 
            style={{ transform: "translateZ(60px)" }} 
            className="flex-shrink-0 flex items-center justify-center"
          >
            {/* 아바타 크기를 대폭 확대하고 모서리가 둥근 사각형(Squircle) 형태로 변경 */}
            <div className={`relative w-40 h-40 sm:w-56 sm:h-56 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden border-[4px] bg-black/60 ${avatarBorder} group`}>
              {/* 내부 글로우 효과 */}
              <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] z-10 pointer-events-none" />
              <Image 
                src={avatarImage}
                alt="Player Avatar"
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-110"
                sizes="(max-width: 640px) 160px, 224px"
                priority
              />
            </div>
          </div>

          {/* 인포메이션 영역 (우측) */}
          <div className="flex-1 flex flex-col justify-between min-w-0 py-2 w-full">
            
            {/* 상단: 타이틀 및 가입일 */}
            <div style={{ transform: "translateZ(50px)" }} className="flex flex-col items-center sm:items-start text-center sm:text-left">
              <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-black uppercase tracking-[0.2em] whitespace-nowrap overflow-visible ${neonGlow} ${profile.role === 'user' ? 'mix-blend-color-burn' : ''}`}>
                {roleTitle}
              </h1>
              <p className="text-sm opacity-80 uppercase tracking-widest mt-2 whitespace-nowrap">
                가입일: {joinDate}
              </p>
            </div>

            {/* 중단: 플레이어 이름 */}
            <div style={{ transform: "translateZ(70px)" }} className="mt-8 flex flex-col items-center sm:items-start text-center sm:text-left">
              <p className="text-xs opacity-70 uppercase tracking-widest mb-1">플레이어 이름</p>
              <p className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-wider truncate w-full ${neonGlow}`}>
                {profile.username || profile.name || 'ANONYMOUS'}
              </p>
            </div>

            {/* 하단: 통계 데이터 그리드 */}
            <div style={{ transform: "translateZ(40px)" }} className="mt-10 grid grid-cols-2 gap-4 border-t border-white/20 pt-6">
              
              {/* 보유 칩 */}
              <div className="flex flex-col">
                <p className="text-[10px] sm:text-xs opacity-70 uppercase tracking-widest whitespace-nowrap">보유 칩 (Chips)</p>
                <p className={`text-xl sm:text-2xl lg:text-3xl font-bold mt-1 flex items-center gap-2 truncate ${neonGlow}`}>
                  {formatChips(profile.chips_balance)} <span className="text-xl lg:text-2xl">💳</span>
                </p>
              </div>

              {/* 달성한 업적 */}
              <div className="flex flex-col items-end sm:items-start">
                <p className="text-[10px] sm:text-xs opacity-70 uppercase tracking-widest whitespace-nowrap">달성한 업적</p>
                <p className="text-xl sm:text-2xl lg:text-3xl font-bold mt-1 flex items-center gap-1">
                  <span className={neonGlow}>{achievementsCompleted}</span>
                  <span className="opacity-60 text-base lg:text-lg">/ {totalAchievements}</span>
                </p>
              </div>

              {/* 플레이 횟수 */}
              <div className="flex flex-col col-span-2 mt-2">
                <p className="text-[10px] sm:text-xs opacity-70 uppercase tracking-widest whitespace-nowrap">플레이 횟수</p>
                <p className="text-lg sm:text-xl font-semibold mt-1">
                  {formatChips(profile.total_games_played)} 회
                </p>
              </div>
            </div>

          </div>
        </div>
      </motion.div>

      {/* 하단 버튼 영역 (Glassmorphism & 호버 효과 강화) */}
      <div className="mt-12 flex flex-wrap justify-center gap-5 z-10 relative">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-full font-medium transition-all duration-300 backdrop-blur-md border border-white/10 shadow-lg hover:shadow-white/10 whitespace-nowrap"
        >
          비밀번호 변경
        </button>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="px-8 py-4 bg-indigo-600/90 hover:bg-indigo-500 text-white rounded-full font-bold transition-all duration-300 backdrop-blur-md border border-indigo-400/40 shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:shadow-[0_0_35px_rgba(79,70,229,0.7)] whitespace-nowrap hover:-translate-y-1"
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
