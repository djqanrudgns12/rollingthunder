'use client'

import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { X, Moon, Sun, Type, Gauge, Zap, RotateCcw, Check, Activity, LogOut } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { logout } from '@/app/actions'

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
    comebackStrength, setComebackStrength,
    playTime, setPlayTime,
    isScreenShakeEnabled, setScreenShakeEnabled,
    calmMode, setCalmMode,
    theme, setTheme,
    fontFamily, setFontFamily,
    bgmVolume, setBgmVolume,
    sfxVolume, setSfxVolume
  } = useGameStore()
  
  const { activeModal, setActiveModal } = useUIStore()

  const snapshotRef = useRef<{
    gimmickDensity: number;
    baseTimeScale: number;
    comebackStrength: number;
    playTime: number;
    isScreenShakeEnabled: boolean;
    calmMode: boolean;
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
        comebackStrength,
        playTime,
        isScreenShakeEnabled,
        calmMode,
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
      setComebackStrength(snapshotRef.current.comebackStrength)
      setPlayTime(snapshotRef.current.playTime)
      setScreenShakeEnabled(snapshotRef.current.isScreenShakeEnabled)
      setCalmMode(snapshotRef.current.calmMode)
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

  const handleLogout = async () => {
    setActiveModal('none')
    useUIStore.getState().setIsLoggedIn(false)
    useUIStore.getState().setUserProfile(null)
    
    import('@/store/chipStore').then(({ useChipStore }) => {
      useChipStore.getState().setChips(0)
    })
    
    // 명시적 동기 호출 (만약 top에 import 안되어있다면 dynamic import 사용 유지하지만, race condition 방지를 위해 즉시 실행되는 구조 선호. 여기서는 GlobalPlayerHUD 쪽에 의존성 높임)
    import('@/store/inventoryStore').then(({ useInventoryStore }) => {
      useInventoryStore.getState().reset()
    })
    
    import('@/store/gameStore').then(({ useGameStore }) => {
      useGameStore.getState().resetSession()
    })
    
    await logout()
    window.location.replace('/')
  }

  const handleReset = () => {
    // 기획된 기본값 적용
    setTheme('dark')
    setFontFamily('pretendard')
    setBaseTimeScale(1.0)
    setScreenShakeEnabled(true)
    setCalmMode(false)
    setBgmVolume(100)
    setSfxVolume(100)
    setGimmickDensity(50)
    setComebackStrength(50)
    setPlayTime(50)
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md max-h-[90dvh] bg-[var(--bg-secondary)] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20 shrink-0">
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
        <div className="p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
          
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
              className="mt-2 p-2 sm:p-3 bg-black/30 rounded-lg border border-white/5 text-center truncate text-sm"
              style={{ fontFamily: `var(--font-${fontFamily})` }}
            >
              가나다라마바사 ABCDE 12345
            </div>
          </div>

          {/* Speed & Shake */}
          <div className="flex gap-3">
            {/* Speed */}
            <div className="flex flex-col gap-2 flex-[5]">
              <label className="text-xs text-orange-400 font-bold tracking-widest uppercase flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                <Gauge className="w-4 h-4 shrink-0" /> 게임 속도
              </label>
              <div className="flex gap-1">
                {[0.5, 1.0, 1.5, 2.0].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setBaseTimeScale(speed)}
                    className={`flex-1 py-1.5 sm:py-2 px-0.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${baseTimeScale === speed ? 'bg-orange-500 text-white shadow-[0_0_10px_#f97316]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
            </div>

            {/* Screen Shake */}
            <div className="flex flex-col gap-2 flex-[3]">
              <label className="text-xs text-orange-400 font-bold tracking-widest uppercase flex items-center gap-1.5 whitespace-nowrap overflow-hidden text-ellipsis">
                <Activity className="w-4 h-4 shrink-0" /> 화면 흔들림
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => setScreenShakeEnabled(true)}
                  className={`flex-1 py-1.5 sm:py-2 px-0.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${isScreenShakeEnabled ? 'bg-orange-500 text-white shadow-[0_0_10px_#f97316]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  ON
                </button>
                <button
                  onClick={() => setScreenShakeEnabled(false)}
                  className={`flex-1 py-1.5 sm:py-2 px-0.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${!isScreenShakeEnabled ? 'bg-black/80 text-white/80 border border-orange-500/50' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  OFF
                </button>
              </div>
            </div>
          </div>

          {/* Calm / Reduced Motion */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-cyan-400 font-bold tracking-widest uppercase flex items-center gap-1.5">
              <Activity className="w-4 h-4 shrink-0" /> 차분 모드 / 모션 줄이기
            </label>
            <div className="flex gap-1">
              <button
                onClick={() => setCalmMode(true)}
                className={`flex-1 py-1.5 sm:py-2 px-0.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${calmMode ? 'bg-cyan-500 text-white shadow-[0_0_10px_#06b6d4]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
              >
                ON
              </button>
              <button
                onClick={() => setCalmMode(false)}
                className={`flex-1 py-1.5 sm:py-2 px-0.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${!calmMode ? 'bg-black/80 text-white/80 border border-cyan-500/50' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
              >
                OFF
              </button>
            </div>
            <p className="text-[9px] sm:text-[10px] text-white/40 leading-tight">화면 채도·글로우·카메라 움직임을 더 줄여 눈피로/어지러움을 완화합니다. (장애물 글로우 제거는 다음 레이스부터 적용)</p>
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

          {/* Comeback Dynamics (역전 다이내믹스) */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs text-[var(--accent-secondary)] font-bold tracking-widest uppercase whitespace-nowrap">순위 역동성 (COMEBACK)</label>
              <span className="text-[10px] text-[var(--accent-secondary)] font-mono bg-black/50 px-2 py-0.5 rounded-lg border border-white/10 ml-2 whitespace-nowrap">{comebackStrength === 0 ? 'OFF' : `${comebackStrength}%`}</span>
            </div>
            <div className="flex items-center h-[38px] pt-1">
              <input
                type="range"
                min={0}
                max={100}
                value={comebackStrength}
                onChange={(e) => setComebackStrength(Number(e.target.value))}
                className="w-full neon-slider"
              />
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed -mt-1">
              하위권 추격·선두 접전을 유도하는 강도입니다. 0이면 순수 물리로만 진행되고, 높을수록 역전이 자주 일어납니다. 레이스 도중에도 즉시 반영됩니다.
            </p>
          </div>

          {/* Play Time (플레이 시간) — 엔드게임 페이싱 (PRD-endgame-pacing) */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <label className="text-xs text-[var(--accent-secondary)] font-bold tracking-widest uppercase whitespace-nowrap">플레이 시간 (PLAY TIME)</label>
              <span className="text-[10px] text-[var(--accent-secondary)] font-mono bg-black/50 px-2 py-0.5 rounded-lg border border-white/10 ml-2 whitespace-nowrap">
                {playTime < 50 ? `빠른 마무리 · ${playTime}` : playTime > 50 ? `느긋하게 · ${playTime}` : '기본 · 50'}
              </span>
            </div>
            <div className="flex items-center h-[38px] pt-1">
              <input
                type="range"
                min={0}
                max={100}
                value={playTime}
                onChange={(e) => setPlayTime(Number(e.target.value))}
                className="w-full neon-slider"
              />
            </div>
            <p className="text-[10px] text-white/40 leading-relaxed -mt-1">
              낮을수록 우승 확정 후 남은 경기가 자동으로 빨라지고 끼인 마블 구조가 빨라집니다. 우승자가 정해지기 전의 레이스에는 영향을 주지 않으며, 50이 기존 진행과 동일합니다. 레이스 도중에도 즉시 반영됩니다.
            </p>
          </div>

        </div>

        {/* Setting Actions */}
        <div className="p-4 sm:p-6 pt-3 flex gap-2 shrink-0 border-t border-white/10 bg-[var(--bg-secondary)]">
          <button
            onClick={handleLogout}
            title="로그아웃"
            className="w-11 h-11 flex-none bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all flex items-center justify-center border border-red-500/20"
          >
            <LogOut className="w-5 h-5" />
          </button>
          <button
            onClick={handleReset}
            className="flex-1 h-11 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            초기화
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 h-11 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            취소
          </button>
          <button
            onClick={handleApply}
            className="flex-[1.2] h-11 bg-[var(--accent-primary)]/10 hover:bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/20 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            반영
          </button>
        </div>
      </div>
    </div>
  )
}
