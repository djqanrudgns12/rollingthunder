'use client'

import { useGameStore, Participant } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import { useState, useEffect, useRef } from 'react'
import { createSession } from '@/actions/db'
import MapLoadModal, { DEFAULT_MAPS } from './MapLoadModal'
import ListManagerModal from './ListManagerModal'
import { Video, Map, Circle, Car, Rocket, Zap, Cat, Target, Volume2, VolumeX, Settings, Ghost, Bot, Flame, Star, Smile, Cloud, Anchor, Wind, Dog, Bird, Diamond, Clover, Cherry, Rabbit, Turtle, CircleDashed, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import PremiumUpgradeModal from './profile/PremiumUpgradeModal'
import { useEditorStore } from '@/store/editorStore'
import { useInventoryStore } from '@/store/inventoryStore'
import { MOCK_ITEMS } from '@/data/shopData'
import { stampService } from '@/lib/stampService'
import SkinCanvasPreview from './shop/SkinCanvasPreview'
import { SKIN_DEFINITIONS } from '@/data/skinDefinitions'

// Skin Preview Helper Component
function SkinPreviewIcon({ skinId }: { skinId: string }) {
  // shopData의 item_id가 "skin_"으로 시작할 수 있으므로 제거
  const cleanId = skinId.replace(/^skin_/, '');
  
  switch (cleanId) {
    case 'chip_base': return <Circle className="w-5 h-5" />
    case 'horse': return <Zap className="w-5 h-5" />
    case 'spaceship': return <Rocket className="w-5 h-5" />
    case 'shuriken': return <Target className="w-5 h-5" />
    case 'car': return <Car className="w-5 h-5" />
    case 'blackhole': return <Circle className="w-5 h-5 animate-spin" />
    case 'cat': return <Cat className="w-5 h-5" />
    case 'dog': return <Dog className="w-5 h-5" />
    case 'soccerball': return <CircleDashed className="w-5 h-5" />
    case 'bird': return <Bird className="w-5 h-5" />
    case 'diamond': return <Diamond className="w-5 h-5" />
    case 'clover': return <Clover className="w-5 h-5" />
    case 'cherry': return <Cherry className="w-5 h-5" />
    case 'rabbit': return <Rabbit className="w-5 h-5" />
    case 'turtle': return <Turtle className="w-5 h-5" />
    case 'pr_dragon': return <Flame className="w-5 h-5 text-red-500" />
    case 'pr_unicorn': return <Star className="w-5 h-5 text-pink-400" />
    case 'pr_dino': return <Smile className="w-5 h-5 text-green-500" />
    case 'pr_slime': return <Circle className="w-5 h-5 text-blue-400" />
    case 'pr_robot': return <Bot className="w-5 h-5 text-gray-400" />
    case 'pr_phoenix': return <Flame className="w-5 h-5 text-orange-500" />
    case 'pr_alien': return <Smile className="w-5 h-5 text-green-400" />
    case 'pr_gummy': return <Smile className="w-5 h-5 text-yellow-500" />
    case 'pr_astronaut': return <Rocket className="w-5 h-5 text-white" />
    case 'pr_ghost': return <Ghost className="w-5 h-5 text-white" />
    case 'pr_hamster': return <Smile className="w-5 h-5 text-orange-300" />
    case 'pr_hotairballoon': return <Cloud className="w-5 h-5 text-red-400" />
    case 'pr_pirateship': return <Anchor className="w-5 h-5 text-gray-400" />
    case 'pr_magiccarpet': return <Wind className="w-5 h-5 text-purple-400" />
    default: return <Circle className="w-5 h-5" />
  }
}

// 선택된 스킨의 실제 이미지를 비동기로 렌더링 (벡터 → PNG → 아이콘 3단 폴백)
function SkinSelectorPreview({ skinId, size = 20 }: { skinId: string; size?: number }) {
  // 테마 accent 색상을 마운트 시 1회 해석 (라이트/다크 대응, SSR 안전)
  const [accent, setAccent] = useState('#00ffdd')
  useEffect(() => {
    const c = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim()
    if (c) setAccent(c)
  }, [])

  // 1) 벡터 스킨: 'skin_' 제거 + 'chip_base' → 'chip_base_1' 정규화 (상점 getVectorSkinKey와 동일)
  let key = skinId.replace(/^skin_/, '')
  if (key === 'chip_base') key = 'chip_base_1'
  if (SKIN_DEFINITIONS[key]) {
    return <SkinCanvasPreview skinKey={key} size={size} color={accent} />
  }

  // 2) 프리미엄 스킨 등 벡터가 없는 경우: shopData의 PNG 이미지 사용
  const item = MOCK_ITEMS.find(i => i.item_id === skinId)
  if (item?.image) {
    return <img src={item.image} alt={item.name} style={{ width: size, height: size, objectFit: 'contain' }} />
  }

  // 3) 최종 폴백: 기존 Lucide 아이콘
  return <SkinPreviewIcon skinId={skinId} />
}

// Simple Anonymizer Helper
const ANIMAL_NAMES = ['사자', '호랑이', '토끼', '고양이', '강아지', '독수리', '돌고래', '상어', '거북이', '알파카', '기린', '코끼리']
function getRandomAnimal() {
  return ANIMAL_NAMES[Math.floor(Math.random() * ANIMAL_NAMES.length)] + Math.floor(Math.random() * 999)
}

export default function Dashboard() {
  const { participants, addParticipant, removeParticipant, clearParticipants, setGimmickDensity, gimmickDensity, setSurvivors, targetWinnerCount, setTargetWinnerCount, setSessionId, gameMode, setGameMode, customWinningRank, setCustomWinningRank, globalSkin, setGlobalSkin, setParticipants, isSkillEnabled, setSkillEnabled, selectedMapPreset, setRandomWinningRanks, clearSkillLogs, isMuted, setMuted } = useGameStore()
  const { setGameStage, customMapData, customMapTitle, isBroadcasterMode, setBroadcasterMode, isAnonymized, setAnonymized, setGameTitle, isAdmin, userProfile, activeModal, setActiveModal } = useUIStore()
  const setEditorMode = useEditorStore(state => state.setEditorMode)
  const { hasItem } = useInventoryStore()
  
  const [nameInput, setNameInput] = useState('')

  const [localWinnerCount, setLocalWinnerCount] = useState(targetWinnerCount || 1)
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)
  const [isListModalOpen, setIsListModalOpen] = useState(false)

  const playClickSound = () => {
    import('@/engine/AudioEngine').then(({ soundManager }) => soundManager.playSfx('ui_click'));
  }

  // Undo/Redo states
  const [undoStack, setUndoStack] = useState<{ participants: Participant[], nameInput: string }[]>([])
  const [redoStack, setRedoStack] = useState<{ participants: Participant[], nameInput: string }[]>([])
  const isTypingRef = useRef(false)
  
  const stateRef = useRef({ participants, nameInput, undoStack, redoStack })
  useEffect(() => {
    stateRef.current = { participants, nameInput, undoStack, redoStack }
  }, [participants, nameInput, undoStack, redoStack])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isZ = e.key.toLowerCase() === 'z'
      const isY = e.key.toLowerCase() === 'y'

      if (e.ctrlKey && (isZ || isY)) {
        // If the user is actively typing, let native browser undo handle text changes
        if (isTypingRef.current && document.activeElement?.tagName === 'INPUT') {
          return
        }

        if (isZ) {
          const { participants, nameInput, undoStack } = stateRef.current
          if (undoStack.length > 0) {
            e.preventDefault()
            const prevState = undoStack[undoStack.length - 1]
            setRedoStack(prev => [...prev, { participants, nameInput }])
            setUndoStack(prev => prev.slice(0, -1))
            
            setParticipants(prevState.participants)
            setNameInput(prevState.nameInput)
            isTypingRef.current = false
          }
        }

        if (isY) {
          const { participants, nameInput, redoStack } = stateRef.current
          if (redoStack.length > 0) {
            e.preventDefault()
            const nextState = redoStack[redoStack.length - 1]
            setUndoStack(prev => [...prev, { participants, nameInput }])
            setRedoStack(prev => prev.slice(0, -1))
            
            setParticipants(nextState.participants)
            setNameInput(nextState.nameInput)
            isTypingRef.current = false
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setParticipants])

  const saveStateForUndo = (currentParticipants: Participant[], currentNameInput: string) => {
    setUndoStack(prev => {
      const newStack = [...prev, { participants: currentParticipants, nameInput: currentNameInput }]
      return newStack.length > 50 ? newStack.slice(-50) : newStack
    })
    setRedoStack([])
  }

  // Sync local state when Zustand store hydrates from localStorage
  useEffect(() => {
    setLocalWinnerCount(targetWinnerCount || 1)
  }, [targetWinnerCount])

  const handleSkinChange = (newSkin: string) => {
    setGlobalSkin(newSkin)
    
    // 포커칩(랜덤)인 경우 chip_base_* 로 할당
    const cleanId = newSkin.replace(/^skin_/, '');
    
    setParticipants(participants.map(p => ({
      ...p,
      skinId: cleanId === 'chip_base' ? `chip_base_${Math.floor(Math.random() * 5) + 1}` : cleanId
    })))
  }

  const handleAdd = (customInput?: string) => {
    playClickSound();
    const textToProcess = customInput !== undefined ? customInput : nameInput
    if (!textToProcess.trim()) return
    
    saveStateForUndo(participants, textToProcess)
    isTypingRef.current = false

    // Support parsing multiple inputs separated by comma, newline, or spaces
    const names = textToProcess.split(/[,\s]+/).map(n => n.trim()).filter(n => n !== '')
    const newParticipants = [...participants]
    names.forEach(name => {
      const newId = `chip-${crypto.randomUUID()}`
      const finalName = isAnonymized ? getRandomAnimal() : name
      
      // 스킨 일괄 설정에 따라 배정
      const effectiveGlobalSkin = globalSkin || 'skin_chip_base';
      const cleanSkinId = effectiveGlobalSkin.replace(/^skin_/, '');
      const finalSkinId = cleanSkinId === 'chip_base' ? `chip_base_${Math.floor(Math.random() * 5) + 1}` : cleanSkinId
      // [버그 수정] HSL → HEX 변환하여 저장
      // 왜: PIXI.Color가 소수점 hue가 포함된 HSL 문자열을 잘못 파싱하여 0(검은색) 반환.
      // ⚠️ 중요: Canvas를 루프 내에서 생성하면 브라우저 GPU 컨텍스트 한도(16개) 초과로
      // WebGL Context Lost (PixiJS 크래시)가 발생하므로 순수 JS 수식으로 변환.
      const hue = Math.random() * 360;
      const s = 0.8;
      const l = 0.5;
      const a = s * Math.min(l, 1 - l);
      const f = (n: number) => {
        const k = (n + hue / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
      };
      const hexColor = `#${f(0)}${f(8)}${f(4)}`;

      newParticipants.push({ id: newId, name: finalName, color: hexColor, skinId: finalSkinId })
    })
    setParticipants(newParticipants)
    // 미션: 참가자 5명 이상 등록 시 추적
    if (newParticipants.length >= 5) {
      stampService.trackEvent('add_5_participants', 1);
    }
    if (customInput === undefined || customInput === nameInput) {
      setNameInput('')
    }
  }

  const handleRemoveParticipant = (id: string) => {
    playClickSound();
    saveStateForUndo(participants, nameInput)
    isTypingRef.current = false
    removeParticipant(id)
  }

  const handleClearParticipants = () => {
    playClickSound();
    saveStateForUndo(participants, nameInput)
    isTypingRef.current = false
    clearParticipants()
  }

  const handleStart = async () => {
    playClickSound();
    if (participants.length < 2) {
      toast.error('최소 2명 이상의 참가자가 필요합니다.')
      return
    }
    if (gameMode !== 'custom' && localWinnerCount >= participants.length) {
      toast.error('당첨/생존자 수는 참가자 수보다 적어야 합니다.')
      return
    }

    // 랜덤 모드일 때: 1~참가자수 범위에서 겨치지 않는 등수를 당첨자수만큼 무작위 추출
    if (gameMode === 'random') {
      const totalParticipants = participants.length
      const count = localWinnerCount
      // Fisher-Yates 셔플로 1~N 중 count개 배열 추출
      const pool = Array.from({ length: totalParticipants }, (_, i) => i + 1)
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]]
      }
      const picked = pool.slice(0, count).sort((a, b) => a - b)
      setRandomWinningRanks(picked)
    }

    // Set Chroma Key background if Broadcaster Mode is on
    // We no longer set document.body.style here. 
    // It's handled per-component to prevent green-screen bleeding to Dashboard.

    try {
      // 미션 이벤트 추적: 게임 시작
      stampService.trackEvent('play_game', 1);
      if (participants.length >= 10) stampService.trackEvent('play_10plus', 1);
      if (participants.length >= 100) stampService.trackEvent('play_100plus', 1);
      stampService.flushPlayEvents();

      // Optimistic UI - Start game instantly, save session in background
      clearSkillLogs()
      
      // [버그 수정] 게임 시작 직전, 모든 참가자의 skinId를 현재 globalSkin 기준으로 재배정.
      // 서버 로스터(user_current_roster)에는 이전 환경에서 박제된 skinId가 담겨 올 수 있어,
      // 빈 값만 채우면 드롭다운 표시 스킨과 실제 렌더 스킨이 어긋난다.
      const effectiveSkin = globalSkin || 'skin_chip_base';
      const cleanSkin = effectiveSkin.replace(/^skin_/, '');
      const sanitizedParticipants = participants.map((p, idx) => {
        if (cleanSkin === 'chip_base') {
          // 포커칩(랜덤): 이미 chip_base 변형이면 유지, 아니면 변형 배정
          if (p.skinId && /^chip_base_\d+$/.test(p.skinId)) return p;
          return { ...p, skinId: `chip_base_${(idx % 5) + 1}` };
        }
        if (p.skinId === cleanSkin) return p;
        return { ...p, skinId: cleanSkin };
      });
      
      if (JSON.stringify(sanitizedParticipants) !== JSON.stringify(participants)) {
        setParticipants(sanitizedParticipants)
      }
      setSurvivors(sanitizedParticipants)
      setTargetWinnerCount(localWinnerCount)
      setGameStage('playing')

      let sid = null;
      try {
        const finalTitle = '롤링 썬더!'
        setGameTitle(finalTitle)
        const session = await createSession(finalTitle)
        if (session) sid = session.id
        setSessionId(sid)
      } catch {

      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className={`flex flex-col items-center justify-center w-full min-h-screen p-4 z-10 transition-colors duration-500 ${isBroadcasterMode ? 'bg-[#00ff00]' : 'bg-transparent'}`}>
      
      {/* 화면 우측 상단 전역 유틸리티 버튼 (BGM, 설정) */}
      <div className="absolute top-4 right-4 md:top-8 md:right-8 flex gap-3 z-50 items-center">
        {/* Role-Based Promotional Features */}
        {(!userProfile || userProfile.role === 'guest') && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => setActiveModal('auth')}
            className="mr-2 px-3 py-2 md:px-4 rounded-full bg-black/60 backdrop-blur-md border border-pink-500/50 flex items-center gap-2 shadow-[0_0_15px_rgba(236,72,153,0.3)] hover:shadow-[0_0_25px_rgba(236,72,153,0.6)] hover:border-cyan-400 transition-all group"
          >
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-[10px] md:text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-400 whitespace-nowrap hidden sm:block">
              가입하고 혜택받기!
            </span>
          </motion.button>
        )}
        
        {userProfile?.role === 'user' && (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => setActiveModal('premiumUpgrade')}
            className="mr-2 px-3 py-2 md:px-4 rounded-full bg-black/60 backdrop-blur-md border border-amber-500/50 flex items-center gap-2 shadow-[0_0_15px_rgba(251,191,36,0.3)] hover:shadow-[0_0_25px_rgba(251,191,36,0.6)] hover:border-purple-400 transition-all group"
          >
            <Rocket className="w-4 h-4 text-amber-400 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
            <span className="text-[10px] md:text-xs font-bold text-amber-300 drop-shadow-[0_0_5px_rgba(251,191,36,0.5)] whitespace-nowrap hidden sm:block">
              Premium 등급 UP
            </span>
          </motion.button>
        )}

        <button
          onClick={() => {
            const next = !isMuted;
            setMuted(next);
            import('@/engine/AudioEngine').then(({ soundManager }) => soundManager.setMuted(next));
          }}
          className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/20 transition-all hover:scale-110 shadow-lg group"
        >
          {isMuted ? <VolumeX className="w-6 h-6 text-white/50" /> : <Volume2 className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)] group-hover:text-cyan-300" />}
        </button>
        <button
          onClick={() => {
            playClickSound();
            useUIStore.getState().setActiveModal('settings');
          }}
          className="w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-white/20 transition-all hover:scale-110 shadow-lg group"
        >
          <Settings className="w-6 h-6 text-white/70 group-hover:text-white" />
        </button>
      </div>

      <div className={`p-5 md:p-8 rounded-3xl w-full max-w-2xl flex flex-col gap-4 shadow-2xl transition-all duration-500 max-h-[calc(100dvh-2rem)] overflow-y-auto custom-scrollbar ${isBroadcasterMode ? 'bg-black border-2 border-green-500' : 'glass-panel-heavy'}`}>
        {/* Header (Text Logo) - 항상 고정 */}
        <div className="relative text-center flex flex-col items-center shrink-0 mb-6 animate-in fade-in slide-in-from-top-4 w-full">
          <div className="flex items-center justify-center gap-3 md:gap-4">
            <img 
              src="/icon.png" 
              alt="Rolling Thunder Icon" 
              className="h-12 md:h-16 w-auto object-contain drop-shadow-[0_0_15px_rgba(0,255,255,0.5)] transition-transform duration-300 hover:rotate-6 hover:scale-110"
            />
            <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 drop-shadow-[0_0_15px_rgba(0,255,255,0.5)] pr-2">
              ROLLING THUNDER
            </h1>
          </div>
          <p className="text-lg font-bold mt-2 text-cyan-300 text-shadow-sm animate-pulse">오늘 우리 자웅을 가리자!</p>
        </div>

        {/* Body (Forms) - 화면이 작을 때 스크롤 됨 */}
        <div className="flex flex-col gap-3 overflow-y-auto scrollbar-hide flex-1 pb-2">
          
          {/* 그룹 1: 기본 설정 (맵) */}
          <div className="flex gap-3 shrink-0 flex-col md:flex-row bg-black/20 p-4 rounded-2xl border border-white/5">
            <button 
              onClick={() => {
                playClickSound();
                setIsMapModalOpen(true);
              }} 
              className="relative w-full overflow-hidden bg-black/40 backdrop-blur-md border border-white/10 hover:border-[var(--accent-primary)] rounded-xl transition-all duration-300 group shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_var(--accent-primary)] hover:scale-[1.01]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent-primary)]/0 via-[var(--accent-primary)]/10 to-[var(--accent-primary)]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              <div className="relative px-4 py-3 flex items-center justify-between h-full">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-[var(--accent-primary)] group-hover:bg-[var(--accent-primary)]/10 transition-colors shrink-0">
                    <Map className="w-4 h-4 text-white/70 group-hover:text-[var(--accent-primary)] transition-colors" />
                  </div>
                  <div className="flex flex-col items-start">
                    <h3 className="text-sm font-bold text-white group-hover:text-[var(--accent-primary)] transition-colors text-shadow-sm truncate max-w-[150px]">
                      {customMapData ? (customMapTitle || '이름 없는 커스텀 맵') : (DEFAULT_MAPS.find(m => m.id === selectedMapPreset)?.title || '랜덤 맵')}
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-white/40 group-hover:text-[var(--accent-primary)] transition-colors">
                  <span className="text-xs font-bold uppercase tracking-wider hidden md:block whitespace-nowrap">변경</span>
                  <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-[var(--accent-primary)]/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </div>
              </div>
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  playClickSound();
                  setEditorMode(true)
                  setGameStage('editor')
                }}
                className="relative shrink-0 w-full md:w-auto bg-black/40 backdrop-blur-md border border-white/10 hover:border-purple-500 rounded-xl px-4 py-3 flex items-center justify-center gap-2 transition-all duration-300 group shadow-[0_4px_20px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:scale-[1.01]"
              >
                <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-purple-500 group-hover:bg-purple-500/10 transition-colors shrink-0">
                  <Settings className="w-4 h-4 text-white/70 group-hover:text-purple-400 transition-colors" />
                </div>
                <span className="text-sm font-bold text-white group-hover:text-purple-400 transition-colors whitespace-nowrap">맵 에디터 열기</span>
              </button>
            )}
          </div>

          {/* 그룹 2: 게임 모드 설정 */}
          <div className="flex flex-col gap-4 bg-black/20 p-4 rounded-2xl border border-white/5 shrink-0">
            <div className="flex flex-col gap-3 pb-3 border-b border-white/5">
              <label className="text-xs text-white/50 font-bold tracking-widest uppercase whitespace-nowrap">게임 모드 (GAME MODE)</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => { playClickSound(); setGameMode('speed'); }}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${gameMode === 'speed' ? 'bg-[var(--accent-primary)] text-black shadow-[0_0_10px_var(--accent-primary)]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  스피드
                </button>
                <button 
                  onClick={() => { playClickSound(); setGameMode('turtle'); }}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${gameMode === 'turtle' ? 'bg-[var(--accent-secondary)] text-black shadow-[0_0_10px_var(--accent-secondary)]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  거북이
                </button>
                <button 
                  onClick={() => { playClickSound(); setGameMode('custom'); }}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${gameMode === 'custom' ? 'bg-purple-500 text-white shadow-[0_0_10px_#a855f7]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  커스텀
                </button>
                <button 
                  onClick={() => { playClickSound(); setGameMode('random'); }}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${gameMode === 'random' ? 'bg-orange-500 text-white shadow-[0_0_10px_#f97316]' : 'bg-black/50 text-white/50 hover:bg-white/10'}`}
                >
                  랜덤
                </button>
              </div>
              
              <div className="animate-in fade-in slide-in-from-top-2 text-xs text-white/40 font-medium whitespace-nowrap mt-1">
                {gameMode === 'speed' && '💡 먼저 결승선을 통과한 참가자가 승리합니다.'}
                {gameMode === 'turtle' && '💡 가장 늦게 결승선을 통과한 참가자가 승리합니다.'}
                {gameMode === 'custom' && '💡 지정한 등수로 들어온 참가자가 당첨됩니다.'}
                {gameMode === 'random' && '💡 컴퓨터가 당첨 등수를 무작위로 결정합니다.'}
              </div>
            </div>

            <div className="flex flex-row gap-4 mt-1">
              {/* 참가자 스킨 (SKINS) */}
              <div className="flex flex-col gap-2 flex-1 bg-black/30 p-3 rounded-xl border border-white/5">
                <label className="text-xs text-[var(--accent-primary)] font-bold tracking-widest uppercase whitespace-nowrap">참가자 스킨 (SKINS)</label>
                <div className="flex items-center gap-2 flex-1 h-[36px]">
                  <div className="w-8 h-8 rounded-full bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)] flex items-center justify-center shadow-[0_0_10px_var(--accent-primary)] text-[var(--accent-primary)] shrink-0 overflow-hidden">
                    <SkinSelectorPreview skinId={globalSkin} size={20} />
                  </div>
                  <select 
                    className="bg-black/50 border border-white/10 rounded-lg px-2 text-white focus:outline-none focus:border-[var(--accent-primary)] text-[11px] font-bold tracking-wide transition-colors flex-1 min-w-0 h-full"
                    value={globalSkin || "skin_chip_base"}
                    onChange={(e) => handleSkinChange(e.target.value)}
                  >
                    {MOCK_ITEMS
                      .filter(item => item.category === 'skin')
                      .filter(item => item.isDefault || isAdmin || hasItem(item.item_id))
                      .map(item => (
                        <option key={item.item_id} value={item.item_id}>
                          {item.name} {item.item_id === 'skin_chip_base' && '(랜덤)'}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* 당첨자 수 */}
              <div className="flex flex-col gap-2 flex-1 bg-black/30 p-3 rounded-xl border border-white/5">
                <label className="text-xs text-[var(--accent-primary)] font-bold tracking-widest uppercase whitespace-nowrap">
                  {gameMode === 'speed' ? '당첨자 수 (명)' : gameMode === 'turtle' ? '최후의 생존자 (명)' : gameMode === 'random' ? '당첨자 수 (명)' : '당첨 등수 (등)'}
                </label>
                {gameMode === 'custom' ? (
                  <div className="flex items-center bg-black/50 rounded-lg overflow-hidden border border-white/10 h-[36px]">
                    <button onClick={() => setCustomWinningRank(Math.max(1, customWinningRank - 1))} className="w-12 hover:bg-white/10 text-white/70 text-xl font-bold transition-colors h-full flex items-center justify-center">-</button>
                    <input 
                      type="number" 
                      value={customWinningRank}
                      onChange={(e) => setCustomWinningRank(Math.max(1, Number(e.target.value)))}
                      className="flex-1 bg-transparent text-center text-purple-300 font-mono text-xl h-full focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full"
                    />
                    <button onClick={() => setCustomWinningRank(customWinningRank + 1)} className="w-12 hover:bg-white/10 text-white/70 text-xl font-bold transition-colors h-full flex items-center justify-center">+</button>
                  </div>
                ) : (
                  <div className="flex items-center bg-black/50 rounded-lg overflow-hidden border border-white/10 h-[36px]">
                    <button onClick={() => setLocalWinnerCount(Math.max(1, localWinnerCount - 1))} className="w-12 hover:bg-white/10 text-white/70 text-xl font-bold transition-colors h-full flex items-center justify-center">-</button>
                    <input 
                      type="number" 
                      min={1} 
                      max={Math.max(1, participants.length - 1)}
                      value={localWinnerCount}
                      onChange={(e) => setLocalWinnerCount(Number(e.target.value))}
                      className="flex-1 bg-transparent text-center text-[var(--text-primary)] font-mono text-xl h-full focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full"
                    />
                    <button onClick={() => setLocalWinnerCount(Math.min(Math.max(1, participants.length - 1), localWinnerCount + 1))} className="w-12 hover:bg-white/10 text-white/70 text-xl font-bold transition-colors h-full flex items-center justify-center">+</button>
                  </div>
                )}
              </div>
            </div>
          </div>



          {/* 그룹 4: 참가자 입력 및 목록 */}
          <div className="flex flex-col gap-3 bg-black/20 p-4 rounded-2xl border border-white/5 shrink-0">
            <div className="flex flex-col gap-1">
              <div className="flex gap-2 items-stretch">
                
                {/* 스킬 토글 (왼쪽 배치) */}
                <div 
                  className="flex flex-col justify-center items-center gap-1.5 shrink-0 bg-black/40 px-3 rounded-xl border border-white/5 h-[52px] cursor-pointer hover:bg-black/50 transition-colors shadow-inner" 
                  onClick={() => { playClickSound(); setSkillEnabled(!isSkillEnabled); }}
                  title="스킬 사용 여부"
                >
                  <label className="text-[10px] text-[var(--accent-secondary)] font-bold tracking-wider uppercase cursor-pointer pointer-events-none">스킬</label>
                  <div className={`w-[36px] h-[18px] rounded-full relative transition-colors duration-300 ${isSkillEnabled ? 'bg-[var(--accent-primary)] shadow-[0_0_8px_rgba(0,255,204,0.4)]' : 'bg-white/20'}`}>
                    <div className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-black transition-transform duration-300 shadow-sm ${isSkillEnabled ? 'translate-x-[18px]' : 'translate-x-0'}`} />
                  </div>
                </div>

                <textarea 
                  placeholder="참가자 이름 (쉼표/공백/줄바꿈 다중입력)" 
                  className="flex-[3] bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-secondary)] transition-colors text-sm resize-none scrollbar-hide h-[52px]"
                  value={nameInput}
                  onChange={(e) => {
                    setNameInput(e.target.value)
                    isTypingRef.current = true
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAdd()
                    }
                  }}
                  onPaste={(e) => {
                    const pastedText = e.clipboardData.getData('text');
                    // 여러 명이 포함된 데이터(탭, 줄바꿈, 쉼표 등)인지 확인
                    if (pastedText && /[\n\t,]/.test(pastedText)) {
                      e.preventDefault();
                      handleAdd(nameInput + " " + pastedText);
                      setNameInput('');
                    }
                  }}
                />
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleAdd()} className="w-16 bg-[var(--accent-secondary)] text-black font-bold rounded-xl hover:opacity-90 transition-opacity text-sm shadow-[0_0_15px_rgba(0,255,204,0.3)] whitespace-nowrap">
                    추가
                  </button>
                  <button onClick={() => { playClickSound(); setIsListModalOpen(true); }} className="w-16 bg-white/10 text-white/70 font-bold rounded-xl hover:bg-white/20 hover:text-white transition-colors text-xs border border-white/5 whitespace-nowrap" title="명단 관리">
                    명단
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-white/40 ml-1 mt-0.5">💡 엑셀, 한글 등 표에서 여러 이름을 복사하여 붙여넣어 보세요!</p>
            </div>

            <div className="flex flex-col gap-2">
              {participants.length > 0 && (
                <div className="flex justify-between items-center px-1">
                  <div className="text-xs font-bold text-[var(--accent-primary)] whitespace-nowrap">
                    참가자 명단 (현재 {participants.length}명)
                  </div>
                  <button 
                    onClick={() => {
                      if (window.confirm('등록된 모든 참가자를 삭제하시겠습니까?')) {
                        clearParticipants()
                      }
                    }}
                    className="text-[10px] font-bold bg-red-500/10 text-red-400 hover:bg-red-500/30 hover:text-red-300 px-2.5 py-1 rounded-md border border-red-500/20 transition-all duration-200"
                  >
                    전체 삭제
                  </button>
                </div>
              )}
              <div className="bg-black/40 rounded-xl border border-white/5 p-2.5 min-h-[80px] max-h-[160px] overflow-y-auto flex flex-wrap gap-1.5 shadow-inner content-start">
                {participants.length === 0 && <p className="text-white/30 text-sm m-auto">참가자가 없습니다.</p>}
                {participants.map(p => (
                  <div key={p.id} className="bg-white/5 hover:bg-white/15 border border-white/10 rounded-full px-2.5 py-1 flex items-center gap-1.5 group relative backdrop-blur-sm transition-colors cursor-default">
                    <div className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor] shrink-0" style={{ backgroundColor: p.color, color: p.color }}></div>
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[75px] leading-none mt-[1px] block">{p.name}</span>
                    <button onClick={() => handleRemoveParticipant(p.id)} className="text-white/30 hover:text-red-400 opacity-0 md:opacity-100 transition-opacity shrink-0 ml-0.5 text-[10px] leading-none w-3 h-3 flex items-center justify-center">×</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* Footer (Buttons) - 항상 고정 */}
        <div className="flex gap-4 shrink-0 pt-2 border-t border-white/10">
          <button onClick={handleClearParticipants} className="flex-1 bg-white/5 hover:bg-white/10 text-white/50 font-bold py-4 rounded-xl transition-colors border border-white/10">
            초기화
          </button>
          <button onClick={handleStart} className="flex-[3] bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-black font-extrabold text-xl tracking-widest py-4 rounded-xl hover:opacity-90 transition-opacity shadow-[0_0_30px_var(--accent-primary)] flex items-center justify-center gap-3">
            <Video className="animate-pulse" />
            GAME START
          </button>
        </div>
        <div className="w-full text-left mt-1 shrink-0 -mb-2 md:-mb-4">
          <div className="flex items-center text-[10px] text-white/30 font-medium tracking-wide ml-1">
            © Copyright
            <img src="/images/assets/chaltteok.png" alt="찰떡쌤" className="w-4 h-4 mx-1 object-contain" />
            찰떡쌤. 단순한 뽑기도 즐거움을 누려 보세요!
          </div>
        </div>
      </div>
      <MapLoadModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} />
      <ListManagerModal 
        isOpen={isListModalOpen} 
        onClose={() => setIsListModalOpen(false)} 
        currentParticipants={participants}
        onLoadList={(names) => setNameInput(names)}
      />
      <PremiumUpgradeModal 
        isOpen={activeModal === 'premiumUpgrade'} 
        onClose={() => setActiveModal('none')} 
      />
    </div>
  )
}
