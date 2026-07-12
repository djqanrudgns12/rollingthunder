import React from 'react';
import { motion } from 'framer-motion';

interface AvatarBorderProps {
  borderId?: string | null;
  children: React.ReactNode;
  className?: string; // 컨테이너 커스텀용
}

export default function AvatarBorder({ borderId, children, className = '' }: AvatarBorderProps) {
  // 테두리 미장착 또는 알 수 없는 ID일 경우, 기본 형태만 렌더링
  if (!borderId || !borderId.startsWith('border_')) {
    return (
      <div className={`relative ${className}`}>
        {children}
      </div>
    );
  }

  // 테두리 종류별 렌더링 함수
  const renderBorder = () => {
    switch (borderId) {
      // ================= Normal =================
      case 'border_n_silver':
        return (
          <div className="absolute inset-[-4px] rounded-[inherit] border-4 border-gray-300 shadow-[0_0_10px_rgba(209,213,219,0.5)] pointer-events-none z-10" />
        );
      case 'border_n_bronze':
        return (
          <div className="absolute inset-[-4px] rounded-[inherit] border-4 border-amber-700 shadow-[0_0_10px_rgba(180,83,9,0.5)] pointer-events-none z-10" />
        );
      case 'border_n_wood':
        return (
          <div className="absolute inset-[-6px] rounded-[inherit] border-[6px] border-amber-900 border-opacity-90 shadow-inner pointer-events-none z-10" />
        );
      case 'border_n_stone':
        return (
          <div className="absolute inset-[-6px] rounded-[inherit] border-[6px] border-stone-600 shadow-md pointer-events-none z-10" />
        );
      case 'border_n_leather':
        return (
          <div className="absolute inset-[-4px] rounded-[inherit] border-4 border-orange-900 outline-dashed outline-2 outline-orange-300 outline-offset-[-2px] pointer-events-none z-10" />
        );

      // ================= Rare =================
      case 'border_r_neon_blue':
        return (
          <div className="absolute inset-[-2px] rounded-[inherit] border-[3px] border-cyan-400 shadow-[0_0_15px_#22d3ee,inset_0_0_15px_#22d3ee] pointer-events-none z-10" />
        );
      case 'border_r_neon_pink':
        return (
          <div className="absolute inset-[-2px] rounded-[inherit] border-[3px] border-pink-500 shadow-[0_0_15px_#ec4899,inset_0_0_15px_#ec4899] pointer-events-none z-10" />
        );
      case 'border_r_golden_wire':
        return (
          <>
            <div className="absolute inset-[-4px] rounded-[inherit] border-2 border-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.8)] pointer-events-none z-10" />
            <div className="absolute inset-[-8px] rounded-[inherit] border border-yellow-400/50 pointer-events-none z-10" />
          </>
        );
      case 'border_r_holo':
        return (
          <motion.div 
            animate={{ backgroundPosition: ['0% 0%', '200% 0%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-[-4px] rounded-[inherit] p-[4px] z-10 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, rgba(255,0,0,0.5), rgba(0,255,0,0.5), rgba(0,0,255,0.5), rgba(255,0,0,0.5))',
              backgroundSize: '200% 100%',
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude'
            }}
          />
        );
      case 'border_r_firefly':
        return (
          <div className="absolute inset-[-6px] rounded-[inherit] border-4 border-green-400/30 shadow-[0_0_20px_rgba(74,222,128,0.4)] pointer-events-none z-10 overflow-visible">
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }} className="absolute -top-2 -left-2 w-3 h-3 bg-green-300 rounded-full blur-[2px]" />
            <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="absolute -bottom-1 -right-2 w-2 h-2 bg-green-200 rounded-full blur-[1px]" />
          </div>
        );

      // ================= Epic =================
      case 'border_e_plasma':
        return (
          <>
            <div className="absolute inset-[-5px] rounded-[inherit] z-10 pointer-events-none" style={{
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '5px'
            }}>
              <motion.div 
                animate={{ rotate: 360 }} 
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,transparent_0_340deg,#a855f7_360deg)]"
              />
              <div className="absolute inset-0 rounded-[inherit] border-2 border-purple-500/50 shadow-[0_0_25px_#a855f7]" />
            </div>
            {/* Center soft glow */}
            <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_0_15px_rgba(168,85,247,0.3)] pointer-events-none z-10" />
          </>
        );
      case 'border_e_cyber_circuit':
        return (
          <div className="absolute inset-[-6px] rounded-[inherit] border-[4px] border-cyan-500 outline outline-2 outline-offset-2 outline-cyan-900 pointer-events-none z-10 shadow-[0_0_20px_#06b6d4] overflow-hidden">
            <motion.div 
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "steps(3)" }}
              className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI4IiBoZWlnaHQ9IjgiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAyOGQ5OCIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] opacity-50 mix-blend-screen"
              style={{
                maskImage: 'radial-gradient(circle at center, transparent 40%, black 100%)',
                WebkitMaskImage: 'radial-gradient(circle at center, transparent 40%, black 100%)'
              }}
            />
          </div>
        );
      case 'border_e_lava_flow':
        return (
          <>
            <div className="absolute inset-[-6px] rounded-[inherit] border-[6px] border-orange-600 shadow-[0_0_30px_#ea580c] pointer-events-none z-10 overflow-hidden" style={{
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '6px'
            }}>
               <motion.div 
                 animate={{ y: [0, -20] }}
                 transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                 className="absolute inset-[-20px] bg-gradient-to-t from-red-600 via-orange-500 to-yellow-400"
               />
            </div>
            {/* Subtle center overlay */}
            <div className="absolute inset-0 rounded-[inherit] bg-orange-500/10 mix-blend-overlay pointer-events-none z-10 shadow-[inset_0_0_15px_rgba(234,88,12,0.3)]" />
          </>
        );
      case 'border_e_toxic_spill':
        return (
          <div className="absolute inset-[-5px] rounded-[inherit] border-[5px] border-lime-500 shadow-[0_0_25px_#84cc16,inset_0_0_15px_#84cc16] pointer-events-none z-10">
            <motion.div 
               animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
               transition={{ duration: 2, repeat: Infinity }}
               className="absolute inset-0 rounded-[inherit] border-[3px] border-lime-400 blur-sm"
            />
          </div>
        );
      case 'border_e_galaxy_spin':
        return (
          <>
            <div className="absolute inset-[-6px] rounded-[inherit] z-10 pointer-events-none shadow-[0_0_30px_rgba(99,102,241,0.6)]" style={{
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              maskComposite: 'exclude',
              padding: '6px'
            }}>
               <motion.div 
                animate={{ rotate: -360 }} 
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-50%] bg-[conic-gradient(from_0deg,#312e81,#4338ca,#312e81,#4338ca,#312e81)]"
              />
            </div>
            <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_0_20px_rgba(67,56,202,0.4)] pointer-events-none z-10" />
          </>
        );

      // ================= Legendary =================
      case 'border_l_dragon_scale':
        return (
          <div className="absolute inset-[-8px] rounded-[inherit] border-[8px] border-red-800 shadow-[0_0_40px_#991b1b,inset_0_0_20px_#991b1b] pointer-events-none z-10 overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSI1LDAgMTAsNSA1LDEwIDAsNSIgZmlsbD0iI2Y4NzE3MSIgb3BhY2l0eT0iMC4zIi8+PC9zdmc+')] opacity-80" 
              style={{
                maskImage: 'radial-gradient(circle at center, transparent 50%, black 100%)',
                WebkitMaskImage: 'radial-gradient(circle at center, transparent 50%, black 100%)'
              }}
            />
            <motion.div 
               animate={{ opacity: [0.4, 0.8, 0.4] }}
               transition={{ duration: 3, repeat: Infinity }}
               className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-transparent mix-blend-overlay"
            />
          </div>
        );
      case 'border_l_phoenix_flame':
        return (
          <div className="absolute inset-[-6px] rounded-[inherit] p-[6px] pointer-events-none z-10 shadow-[0_0_50px_#f97316]">
             <motion.div 
              animate={{ opacity: [0.7, 1, 0.7], scale: [0.98, 1.02, 0.98] }} 
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute inset-0 rounded-[inherit] border-[4px] border-orange-500 shadow-[0_0_20px_#fb923c,inset_0_0_20px_#fb923c]"
            />
            <motion.div 
              animate={{ opacity: [0.4, 0, 0.4], scale: [1, 1.1, 1] }} 
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute inset-[-4px] rounded-[inherit] border-[2px] border-yellow-300"
            />
          </div>
        );
      case 'border_l_void_abyss':
        return (
          <div className="absolute inset-[-10px] rounded-[inherit] pointer-events-none z-10">
             <motion.div 
              animate={{ scale: [1, 0.95, 1], rotate: [0, 5, 0] }} 
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-0 rounded-[inherit] border-[10px] border-black shadow-[0_0_40px_#4c1d95_inset,0_0_40px_#4c1d95]"
            />
            <div className="absolute inset-0 rounded-[inherit] border-[2px] border-purple-900 mix-blend-overlay" />
          </div>
        );

      // ================= Mythic =================
      case 'border_m_god_halo':
        return (
          <div className="absolute inset-[-12px] rounded-[inherit] pointer-events-none z-10">
             <motion.div 
              animate={{ rotate: 360 }} 
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-[inherit] border-[4px] border-dashed border-yellow-300 opacity-80"
            />
            <motion.div 
              animate={{ scale: [1, 1.05, 1], opacity: [0.5, 1, 0.5] }} 
              transition={{ duration: 3, repeat: Infinity }}
              className="absolute inset-[4px] rounded-[inherit] border-[8px] border-yellow-500 shadow-[0_0_60px_#fde047,inset_0_0_30px_#fde047]"
            />
            <div className="absolute inset-[12px] rounded-[inherit] border-2 border-white shadow-[0_0_10px_white]" />
          </div>
        );
      case 'border_m_matrix_glitch':
        return (
          <div className="absolute inset-[-8px] rounded-[inherit] pointer-events-none z-10 overflow-hidden">
             <motion.div 
              animate={{ x: [-2, 2, -1, 3, 0], y: [1, -1, 2, -2, 0] }} 
              transition={{ duration: 0.2, repeat: Infinity, repeatType: "mirror" }}
              className="absolute inset-0 rounded-[inherit] border-[4px] border-green-500 shadow-[0_0_30px_#22c55e]"
            />
            <motion.div 
              animate={{ opacity: [0, 1, 0, 1] }} 
              transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              className="absolute inset-[-2px] rounded-[inherit] border-[2px] border-white mix-blend-difference"
            />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzE2YTM0YSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9zdmc+')] opacity-30" 
              style={{
                maskImage: 'radial-gradient(circle at center, transparent 40%, black 100%)',
                WebkitMaskImage: 'radial-gradient(circle at center, transparent 40%, black 100%)'
              }}
            />
            <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0_0_20px_rgba(34,197,94,0.2)]" />
          </div>
        );
      case 'border_m_time_warp':
        return (
          <div className="absolute inset-[-10px] rounded-[inherit] pointer-events-none z-10">
             <motion.div 
              animate={{ scale: [1, 1.2, 0.8, 1], rotate: [0, 90, 180, 360] }} 
              transition={{ duration: 5, repeat: Infinity, ease: "circInOut" }}
              className="absolute inset-0 rounded-[inherit] border-[3px] border-cyan-300 opacity-50 blur-[2px]"
            />
            <motion.div 
              animate={{ scale: [1, 0.9, 1.1, 1], rotate: [360, 180, 90, 0] }} 
              transition={{ duration: 4, repeat: Infinity, ease: "backInOut" }}
              className="absolute inset-[4px] rounded-[inherit] border-[5px] border-indigo-500 shadow-[0_0_40px_#6366f1]"
            />
            <div className="absolute inset-[8px] rounded-[inherit] border-[2px] border-white shadow-[0_0_15px_#fff]" />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`relative ${className}`}>
      {children}
      {renderBorder()}
    </div>
  );
}
