'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { UserProfile } from '@/types/user';
import PasswordChangeModal from './PasswordChangeModal';

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

  // Device orientation (mobile)
  useEffect(() => {
    const handleOrientation = (e: DeviceOrientationEvent) => {
      // Very basic gyro support
      if (e.gamma !== null && e.beta !== null) {
        const xPct = Math.min(Math.max(e.gamma / 45, -0.5), 0.5);
        const yPct = Math.min(Math.max((e.beta - 45) / 45, -0.5), 0.5);
        x.set(xPct);
        y.set(yPct);
      }
    };
    
    // Only add if not on desktop (simple check, normally better with media queries)
    if (typeof window !== 'undefined' && window.matchMedia("(pointer: coarse)").matches) {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [x, y]);

  // Determine card style based on role
  let themeClasses = '';
  let neonGlow = '';
  if (profile.role === 'admin') {
    themeClasses = 'bg-gradient-to-br from-gray-900 via-gray-800 to-black border-red-500/50 text-red-500 font-mono shadow-[0_0_30px_rgba(255,0,0,0.2)]';
    neonGlow = 'drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]';
  } else if (profile.role === 'premium') {
    themeClasses = 'bg-gradient-to-br from-yellow-700 via-yellow-500 to-yellow-900 border-yellow-400 shadow-[0_0_30px_rgba(252,211,77,0.3)] text-yellow-100';
    neonGlow = 'drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]';
  } else {
    // Normal
    themeClasses = 'bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 border-gray-400 text-gray-900 shadow-xl';
  }

  const joinDate = new Date(profile.created_at).getFullYear();
  const formatChips = (num: number) => new Intl.NumberFormat().format(num);

  return (
    <div className="flex flex-col items-center justify-center w-full min-h-[100dvh] bg-black bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 to-black p-4">
      
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className={`relative w-full max-w-[480px] aspect-[1.6/1] rounded-2xl border-2 p-6 flex flex-col justify-between overflow-hidden cursor-pointer transition-colors duration-500 ${themeClasses}`}
      >
        {/* Hologram Layer */}
        <motion.div
          className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%), 
                              linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet)`,
            backgroundSize: '200% 200%',
            backgroundPosition,
          }}
        />

        {/* Shine Sweep Layer (Premium) */}
        {profile.role === 'premium' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_3s_infinite] pointer-events-none" />
        )}

        {/* Content (Embossed style) */}
        <div style={{ transform: "translateZ(30px)" }} className="relative z-10 flex justify-between items-start">
          <div>
            <h1 className={`text-3xl font-black uppercase tracking-widest ${neonGlow} ${profile.role === 'admin' ? '' : 'mix-blend-color-burn'}`}>
              {profile.role === 'admin' ? 'SYSTEM.ADMIN' : 'VVIP MEMBERSHIP'}
            </h1>
            <p className="text-sm opacity-80 uppercase tracking-widest mt-1">MEMBER SINCE {joinDate}</p>
          </div>
          <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center ${profile.role === 'admin' ? 'border-red-500' : 'border-current'}`}>
            <span className="text-2xl font-bold">{profile.role.charAt(0).toUpperCase()}</span>
          </div>
        </div>

        <div style={{ transform: "translateZ(40px)" }} className="relative z-10 space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-xs opacity-70 uppercase">Cardholder</p>
              <p className={`text-2xl font-bold tracking-wider ${neonGlow}`}>
                {profile.username || profile.name || 'ANONYMOUS'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-70 uppercase">Chips Balance</p>
              <p className={`text-2xl font-bold ${neonGlow}`}>
                {formatChips(profile.chips_balance)} 💳
              </p>
            </div>
          </div>

          <div className="flex justify-between border-t border-gray-500/30 pt-4">
            <div>
              <p className="text-[10px] opacity-70 uppercase">Games Played</p>
              <p className="text-lg font-semibold">{formatChips(profile.total_games_played)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] opacity-70 uppercase">Login Count</p>
              <p className="text-lg font-semibold">{formatChips(profile.login_count)}</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-12 flex gap-4">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-medium transition backdrop-blur-md border border-white/10"
        >
          비밀번호 변경
        </button>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full font-medium transition shadow-lg shadow-indigo-500/30"
        >
          메인으로 돌아가기
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
