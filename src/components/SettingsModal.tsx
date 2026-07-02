'use client'

import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { X, Moon, Sun, Type, Gauge, Zap, RotateCcw, Check } from 'lucide-react'
import { useEffect, useRef } from 'react'

const FONTS = [
  { id: 'pretendard', name: 'Pretendard (기본)' },
  { id: 'bmdohyeon', name: '배민 도현체' },
  { id: 'bmeuljiro', name: '배민 을지로체' },
  { id: 'bmjua', name: '배민 주아체' },
  { id: 'bmyeonsung', name: '배민 연성체' },
  { id: 'cafe24dongdong', name: '카페24 동동' },
  { id: 'cafe24ssukssuk', name: '카페24 쑥쑥' },
  { id: 'jnaughtyl', name: '장난꾸러기 Light' },
  { id: 'jnaughtym', name: '장난꾸러기 Medium' },
  { id: 'kccganpan', name: 'KCC 간판체' },
  { id: 'kccdodam', name: 'KCC 도담도담' },
  { id: 'maplestoryb', name: '메이플스토리 Bold' },
  { id: 'maplestoryl', name: '메이플스토리 Light' },
  { id: 'ownglyph2022', name: '온글잎 체' },
  { id: 'ridibatang', name: '리디바탕' },
  { id: 'schoolsafeb', name: '학교 안심 나들이 Bold' },
  { id: 'schoolsafel', name: '학교 안심 나들이 Light' },
]

export default function SettingsModal() {
  const { 
    gimmickDensity, setGimmickDensity,
    baseTimeScale, setBaseTimeScale,
    theme, setTheme,
    fontFamily, setFontFamily,
    bgmVolume, setBgmVolume,
    sfxVolume, setSfxVolume
  } = useGameStore()
  
  const { activeModal, setActiveModal } = useUIStore()

  // 상태 백업용 ref (취소 시 롤백을 위함)
  const snapshotRef = useRef<{
    gimmickDensity: number;
    baseTimeScale: number;
    theme: 'dark' | 'light';
    fontFamily: string;
    bgmVolume: number;
    sfxVolume: number;
  } | null>(null)

  // 모달이 열릴 때 초기 상태를 저장
  useEffect(() => {
    if (activeModal === 'settings') {
      snapshotRef.current = {
        gimmickDensity,
        baseTimeScale,
        theme,
        fontFamily,
        bgmVolume,
        sfxVolume
      }
    } else {
      snapshotRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal])

  if (activeModal !== 'settings') return null

  const handleCancel = () => {
    // 백업된 상태로 원복
    if (snapshotRef.current) {
      setGimmickDensity(snapshotRef.current.gimmickDensity)
      setBaseTimeScale(snapshotRef.current.baseTimeScale)
      setTheme(snapshotRef.current.theme)
      setFontFamily(snapshotRef.current.fontFamily)
      setBgmVolume(snapshotRef.current.bgmVolume)
      setSfxVolume(snapshotRef.current.sfxVolume)
    }
    setActiveModal('none')
  }

  const handleApply = () => {
    // 현재 상태를 유지하고 닫기만 함 (zustand가 이미 실시간 반영 중)
    setActiveModal('none')
  }

  const handleReset = () => {
    // 기획된 기본값 적용
    setTheme('dark')
    setFontFamily('pretendard')
    setBaseTimeScale(1.0)
    setBgmVolume(100)
    setSfxVolume(100)
    setGimmickDensity(50)
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[var(--bg-secondary)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-[var(--accent-primary)]" />
            환경설정
          </h2>
          <button 
            onClick={handleCancel}
            className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-6">
          
          {/* Theme */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-[var(--accent-primary)] font-bold tracking-widest uppercase flex items-center gap-2">
              <Sun className="w-4 h-4" /> 테마 (THEME)
            </label>
            <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${theme === 'dark' ? 'bg-white/10 text-white shadow-sm' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
              >
                <Moon className="w-4 h-4" /> 다크
              </button>
              <button
                onClick={() => setTheme('light')}
                className={`flex-1 flex justify-center items-center gap-2 py-2.5 rounded-lg font-bold text-sm transition-all ${theme === 'light' ? 'bg-white text-black shadow-sm' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
              >
                <Sun className="w-4 h-4" /> 라이트
              </button>
            </div>
          </div>

          {/* Font */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-[var(--accent-secondary)] font-bold tracking-widest uppercase flex items-center gap-2">
              <Type className="w-4 h-4" /> 폰트 (FONT)
            </label>
            <select
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[var(--accent-secondary)] transition-colors"
              style={{ fontFamily: `var(--font-${fontFamily})` }}
            >
              {FONTS.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
            <div 
              className="mt-2 p-3 bg-black/30 rounded-lg border border-white/5 text-center truncate text-sm"
              style={{ fontFamily: `var(--font-${fontFamily})` }}
            >
              가나다라마바사 ABCDE 12345
            </div>
          </div>

          {/* Speed */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-orange-400 font-bold tracking-widest uppercase flex items-center gap-2">
              <Gauge className="w-4 h-4" /> 게임 속도 (SPEED)
            </label>
            <div className="flex gap-2">
              {[0.5, 1.0, 1.5, 2.0].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setBaseTimeScale(speed)}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${baseTimeScale === speed ? 'bg-orange-500 text-white shadow-[0_0_10px_#f97316]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>

          {/* Audio Volumes */}
          <div className="flex flex-col gap-4">
            <label className="text-xs text-[var(--accent-primary)] font-bold tracking-widest uppercase flex items-center gap-2">
              음량 설정 (AUDIO)
            </label>
            
            <div className="flex flex-col gap-2 bg-black/20 p-3 rounded-xl border border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/70 font-medium">배경음악 (BGM)</span>
                <span className="text-[10px] text-white/50 font-mono bg-black/50 px-2 py-0.5 rounded-lg border border-white/10">{bgmVolume}%</span>
              </div>
              <input 
                type="range" 
                min={0} 
                max={100}
                value={bgmVolume}
                onChange={(e) => setBgmVolume(Number(e.target.value))}
                className="w-full neon-slider"
              />
            </div>

            <div className="flex flex-col gap-2 bg-black/20 p-3 rounded-xl border border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/70 font-medium">효과음 (SFX)</span>
                <span className="text-[10px] text-white/50 font-mono bg-black/50 px-2 py-0.5 rounded-lg border border-white/10">{sfxVolume}%</span>
              </div>
              <input 
                type="range" 
                min={0} 
                max={100}
                value={sfxVolume}
                onChange={(e) => setSfxVolume(Number(e.target.value))}
                className="w-full neon-slider"
              />
            </div>
          </div>

          {/* Obstacle Density */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs text-[var(--accent-secondary)] font-bold tracking-widest uppercase whitespace-nowrap">장애물 밀도 (OBSTACLES)</label>
              <span className="text-[10px] text-[var(--accent-secondary)] font-mono bg-black/50 px-2 py-0.5 rounded-lg border border-white/10 ml-2 whitespace-nowrap">{gimmickDensity}%</span>
            </div>
            <div className="flex items-center h-[38px] pt-1">
              <input 
                type="range" 
                min={10} 
                max={90}
                value={gimmickDensity}
                onChange={(e) => setGimmickDensity(Number(e.target.value))}
                className="w-full neon-slider"
              />
            </div>
          </div>

        </div>

        {/* Setting Actions */}
        <div className="p-6 pt-0 flex gap-2">
          <button
            onClick={handleReset}
            className="flex-1 py-3 px-2 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            초기화하기
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 py-3 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            취소하기
          </button>
          <button
            onClick={handleApply}
            className="flex-[1.5] py-3 px-2 bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            적용하기
          </button>
        </div>
      </div>
    </div>
  )
}
