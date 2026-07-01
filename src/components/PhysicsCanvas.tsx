'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { RankingTracker, ParticipantRank } from '@/engine/RankingTracker'
import { soundManager } from '@/engine/AudioEngine'
import { useGameStore } from '@/store/gameStore'
import { useUIStore } from '@/store/uiStore'
import type { EditorItem } from '@/store/editorStore'
import LiveLeaderboard from './LiveLeaderboard'
import { generateSkillMessage } from './SkillLogOverlay'
import { Hand, Maximize, Video, Map as MapIcon, Dices, Rocket, Music4, Pause, FastForward, ChevronUp, Play, VolumeX } from 'lucide-react'
import gsap from 'gsap'
import { GlowFilter, MotionBlurFilter, ShockwaveFilter, ColorOverlayFilter } from 'pixi-filters'
import { getPresetMeta, MapPresets } from '@/engine/MapPresets'
import { CameraDirector } from './cameraDirector'
import { useEditorStore } from '@/store/editorStore'
import { createAppRenderContext } from '@/lib/render/RenderContext'
import { createObstacleGraphic } from '@/lib/render/ObstacleRenderer'
import { createBackground, createStartEndLines } from '@/lib/render/StageChrome'
// 맵 가로 폭은 고정 (물리엔진·카메라·미니맵 공유)
const WORLD_WIDTH = 800;
// WORLD_HEIGHT는 맵 프리셋에 따라 동적으로 결정됨 (기본값 2400)

export default function PhysicsCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [rankings, setRankings] = useState<ParticipantRank[]>([])

  const [finishedFeed, setFinishedFeed] = useState<{ rank: number, survivor: any }[]>([])
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'winner_declared' | 'all_finished'>('idle')
  const [isWorkerReady, setIsWorkerReady] = useState(false)
  const gameStateRef = useRef(gameState)
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  const [gameOverResult, setGameOverResult] = useState<{winners: any[], mode: string} | null>(null)
  const [showRandomPopup, setShowRandomPopup] = useState(false)

  // finishedFeed의 최신값을 참조하기 위한 ref (워커 이벤트 핸들러 클로저에서 사용)
  const finishedFeedRef = useRef(finishedFeed);
  useEffect(() => { finishedFeedRef.current = finishedFeed; }, [finishedFeed]);
  
  const { survivors, setSurvivors, targetWinnerCount, gameMode, customWinningRank, gimmickDensity, selectedMapPreset, setSelectedMapPreset, isSkillEnabled, addSkillLog, setSkillCooldowns, clearSkillLogs, randomWinningRanks, baseTimeScale, isMuted, setMuted, mapDataCache } = useGameStore()
  const { setGameStage, customMapData, customMapMeta, isBroadcasterMode, gameTitle } = useUIStore()
  const workerRef = useRef<Worker | null>(null)
  
  const appRef = useRef<PIXI.Application | null>(null);
  const cameraDirectorRef = useRef<any>(null);
  const [isFastForward, setIsFastForward] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isMapMenuOpen, setIsMapMenuOpen] = useState(false);



  useEffect(() => {
    soundManager.setMuted(isMuted);
  }, [isMuted]);

  const handleToggleBgm = () => {
    soundManager.playSfx('ui_click');
    const nextMuted = !isMuted;
    setMuted(nextMuted);
    soundManager.setMuted(nextMuted);
  };

  const handleTogglePause = () => {
    soundManager.playSfx('ui_click');
    setIsPaused(prev => !prev);
  };

  const handleToggleFastForward = () => {
    soundManager.playSfx('ui_click');
    setIsFastForward(prev => {
      const next = !prev;
      cameraDirectorRef.current?.setFastForward(next);
      if (workerRef.current) workerRef.current.postMessage({ type: 'SET_TIME_SCALE', payload: { scale: next ? 2.0 : 1.0 } });
      return next;
    });
  };

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 2) { // Right click
        setIsFastForward(true);
        cameraDirectorRef.current?.setFastForward(true);
        if (workerRef.current) workerRef.current.postMessage({ type: 'SET_TIME_SCALE', payload: { scale: 2.0 } });
      }
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (e.button === 2) {
        setIsFastForward(false);
        cameraDirectorRef.current?.setFastForward(false);
        if (workerRef.current) workerRef.current.postMessage({ type: 'SET_TIME_SCALE', payload: { scale: 1.0 } });
      }
    };
    const handlePointerCancel = () => {
      setIsFastForward(false);
      cameraDirectorRef.current?.setFastForward(false);
      if (workerRef.current) workerRef.current.postMessage({ type: 'SET_TIME_SCALE', payload: { scale: 1.0 } });
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        setIsPaused(prev => !prev);
      }
    };

    // capture: true 를 사용하여 Pixi나 다른 DOM 요소가 이벤트를 삼키기 전에 강제로 가로챔
    window.addEventListener('contextmenu', handleContextMenu, { capture: true });
    window.addEventListener('pointerdown', handlePointerDown, { capture: true });
    window.addEventListener('pointerup', handlePointerUp, { capture: true });
    window.addEventListener('pointercancel', handlePointerCancel, { capture: true });
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu, { capture: true });
      window.removeEventListener('pointerdown', handlePointerDown, { capture: true });
      window.removeEventListener('pointerup', handlePointerUp, { capture: true });
      window.removeEventListener('pointercancel', handlePointerCancel, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (isPaused) {
      gsap.globalTimeline.pause();
      appRef.current?.ticker?.stop();
    } else {
      gsap.globalTimeline.play();
      appRef.current?.ticker?.start();
    }
  }, [isPaused]);

  useEffect(() => {
    if (workerRef.current && isWorkerReady) {
      workerRef.current.postMessage({ type: 'SET_BASE_TIME_SCALE', payload: { scale: baseTimeScale } });
    }
  }, [baseTimeScale, isWorkerReady]);

  // WebGL Filters ref
  const shockwaveRef = useRef<any>(null)
  const triggerShockwave = useCallback(() => {
    if (shockwaveRef.current) {
      shockwaveRef.current.time = 0;
      shockwaveRef.current.enabled = true;
    }
  }, [])

  const handleNudge = useCallback(() => {
    if (workerRef.current && (gameState === 'playing' || gameState === 'winner_declared')) {
      workerRef.current.postMessage({ type: 'NUDGE', payload: { force: 200 } });
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }, [gameState])

  const handleStart = useCallback(() => {
    if (workerRef.current && gameState === 'idle' && isWorkerReady) {
      clearSkillLogs(); // 새 게임 시작 시 이전 스킬 로그 초기화
      soundManager.playSfx('sys_start');
      workerRef.current.postMessage({ type: 'START' });
      setGameState('playing');
    }
  }, [gameState, isWorkerReady, clearSkillLogs])

  const handleShuffle = useCallback(() => {
    if (workerRef.current && gameState === 'idle') {
      soundManager.playSfx('ui_click');
      workerRef.current.postMessage({ type: 'SHUFFLE', payload: { width: WORLD_WIDTH } });
    }
  }, [gameState])

  useEffect(() => {
    let isMounted = true;
    let app: PIXI.Application;
    let viewport: Viewport;
    let pipViewport: Viewport;
    let bgSprite: PIXI.Sprite | PIXI.TilingSprite;
    let bgLayers: PIXI.Sprite[] = [];
    const graphicsMap = new Map<string, PIXI.Container>();
    const minimapDotsMap = new Map<string, PIXI.Graphics>();
    let minimapDynamic: PIXI.Container;
    let minimapStatic: PIXI.Container;
    let viewIndicator: PIXI.Graphics;
    let currentRankings: any[] = [];
    
    let activeChipsCount = 0;
    const chipPositions = new Map<string, { x: number, y: number }>();

    // 스마트 카메라 디렉터(단일 두뇌). lastCamMs: 프레임 간 dt 계산용.
    let cameraDirector: CameraDirector | null = null;
    let lastCamMs = performance.now();

    // 미니맵 인터랙션 상태(탭/드래그를 이동거리로 구분). 화면상 미니맵 사각형을 저장해
    // 윈도우 레벨 포인터 이벤트로 직접 처리(Pixi 히트테스트 의존 제거).
    let minimapPointerActive = false;
    let minimapMoved = false;
    let minimapDownScreen = { x: 0, y: 0 };
    let minimapScreenRect = { x: 20, y: 0, w: 0, h: 0, scale: 1, offsetX: 0, offsetY: 0 };
    
    // Skill VFX Map
    const activeVFXMap = new Map<string, { cleanup: () => void }>();
    let intervals: ReturnType<typeof setInterval>[] = [];
    let tickers: Array<(ticker: PIXI.Ticker) => void> = [];
    // 공유 ObstacleRenderer 가 등록한 ticker/gsap 해제자 (cleanup 시 호출)
    const itemDisposers: Array<() => void> = [];

    // 완주 등수가 "우승/드라마 슬롯"인지 모드별로 판정 → 카메라 결승 연출(슬로우/락온) 게이팅용.
    // 게임 로직(모드·목표 등수)을 아는 메인 스레드가 계산해, CameraDirector에는 boolean만 넘긴다.
    const isWinnerRank = (rank: number): boolean => {
      if (rank < 1) return false;
      switch (gameMode) {
        case 'speed': return rank <= targetWinnerCount;
        case 'custom': return rank === customWinningRank;
        case 'random': return randomWinningRanks.includes(rank);
        case 'turtle': {
          // 거북이: 마지막 targetWinnerCount명이 우승(완주 X). 결정적 순간 = 패자들의 마지막 완주.
          const losers = Math.max(0, survivors.length - targetWinnerCount);
          return rank >= losers;
        }
        default: return rank <= targetWinnerCount;
      }
    };

    // 'random' 맵 처리 로직
    const safeMapDataCache = mapDataCache || MapPresets;
    const actualMapPreset = selectedMapPreset === 'random' ? 
      Object.keys(safeMapDataCache)[Math.floor(Math.random() * Object.keys(safeMapDataCache).length)] : 
      selectedMapPreset;
      
    // 맵 프리셋에 따른 동적 월드 높이 결정
    const presetMeta = actualMapPreset ? (safeMapDataCache[actualMapPreset] || getPresetMeta(actualMapPreset)) : null;
    const isCustomMap = !!(customMapData && customMapData.length > 0);
    const WORLD_HEIGHT = isCustomMap && customMapMeta?.worldHeight 
      ? customMapMeta.worldHeight 
      : (presetMeta ? presetMeta.worldHeight : 2400);
    let initPromise: Promise<void> | null = null;
    
    const initPixi = async () => {
      try {
        app = new PIXI.Application();
        appRef.current = app;
        (app as any)._cancelResize = () => {}; // Hotfix for Pixi v8 / pixi-viewport compatibility crash
        await app.init({
          width: window.innerWidth,
          height: window.innerHeight,
          backgroundAlpha: isBroadcasterMode ? 0 : 1,
          backgroundColor: 0x0a0a10, // Dark background
          antialias: true,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true, // 캔버스 CSS 크기를 DPR에 맞춰 자동 보정 → 고DPI 화면 텍스처 찢어짐 방지
          powerPreference: 'high-performance',
        });

        if (containerRef.current) {
          containerRef.current.appendChild(app.canvas);
        }

        const bgImageToUse = isCustomMap && customMapMeta?.bgImage ? customMapMeta.bgImage : presetMeta?.bgImage;

        // Preload Assets
        const texturesToLoad = [
          ...(bgImageToUse ? [bgImageToUse] : []),
          '/images/assets/skins/chip_base_1.png',
          '/images/assets/skins/chip_base_2.png',
          '/images/assets/skins/chip_base_3.png',
          '/images/assets/skins/chip_base_4.png',
          '/images/assets/skins/chip_base_5.png',
          '/images/assets/skins/chip_base_6.png',
          '/images/assets/skins/horse.png',
          '/images/assets/skins/spaceship.png',
          '/images/assets/skins/shuriken.png',
          '/images/assets/skins/car.png',
          '/images/assets/skins/cat.png',
          '/images/assets/skins/blackhole.png',
          '/images/assets/obstacles/obstacle_pin.png',
          '/images/assets/obstacles/obstacle_bumper.png',
          '/images/assets/obstacles/obstacle_wall.png',
          '/images/assets/obstacles/obstacle_booster.png',
          '/images/assets/obstacles/obstacle_windmill.png',
          '/images/assets/obstacles/obstacle_portal.png',
          '/images/assets/obstacles/obstacle_blackhole.png',
          '/images/assets/obstacles/obstacle_whitehole.png',
          '/images/assets/obstacles/obstacle_hole.png',
          '/images/assets/obstacles/obstacle_piston.png',
          '/images/assets/obstacles/windmill_rotor.png',
          '/images/assets/skins/pr_dragon.png',
          '/images/assets/skins/pr_unicorn.png',
          '/images/assets/skins/pr_dino.png',
          '/images/assets/skins/pr_slime.png',
          '/images/assets/skins/pr_robot.png',
          '/images/assets/skins/pr_phoenix.png',
          '/images/assets/skins/pr_alien.png',
          '/images/assets/skins/pr_gummy.png',
          '/images/assets/skins/pr_astronaut.png',
          '/images/assets/skins/pr_ghost.png',
          '/images/assets/skins/pr_hamster.png',
          '/images/assets/skins/pr_hotairballoon.png',
          '/images/assets/skins/pr_pirateship.png',
          '/images/assets/skins/pr_magiccarpet.png',
        ];
        let loadedAssets: any = {};
        try {
          loadedAssets = await PIXI.Assets.load(texturesToLoad);
        } catch (err) {
          console.error("Asset load error:", err);
        }

        // 모든 텍스처에 linear 스케일 모드 강제 → 확대/축소 시 샘플링 아티팩트(찢어짐) 완화
        for (const url of texturesToLoad) {
          const tex = PIXI.Assets.get(url);
          if (tex && tex.source) tex.source.scaleMode = 'linear';
        }

        if (!isMounted) {
          // We do not destroy here because the cleanup function's initPromise.then() will destroy it.
          return;
        }

        // PixiJS v8 compatibility patch for pixi-viewport v6
        const dummyInteraction = { on: () => {}, off: () => {} };
        const patchedEvents = { ...app.renderer.events, interaction: dummyInteraction } as any;

        viewport = new Viewport({
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
          worldWidth: WORLD_WIDTH,
          worldHeight: WORLD_HEIGHT,
          events: patchedEvents
        });
        viewport.sortableChildren = true;

        app.stage.addChild(viewport);
        
        const wallStyleToUse = isCustomMap && customMapMeta?.wallStyle ? customMapMeta.wallStyle : presetMeta?.wallStyle;

        // 맵별 배경 이미지 렌더링 (viewport 내부에 붙여 스크롤/줌 연동)
        // 공유 모듈(StageChrome)로 게임/에디터 동일 배경 렌더
        const bg = createBackground(
          createAppRenderContext(app),
          bgImageToUse,
          { worldHeight: WORLD_HEIGHT, wallStyle: wallStyleToUse }
        );
        if (bg) {
          bgSprite = bg;
          viewport.addChild(bgSprite); // 제일 바닥에 렌더링
        }
        // 줌(wheel/pinch)은 CameraDirector가 단독 소유 — pixi-viewport 플러그인은 drag/decelerate만 사용
        viewport.drag().decelerate()
          .clamp({ left: -200, right: WORLD_WIDTH + 200, top: -500, bottom: WORLD_HEIGHT + 200, underflow: 'center' }); // clamp bounds
        
        // 드래그 시 카메라 디렉터를 수동 모드로(잠시 후 자동 복귀)
        viewport.on('drag-start', () => cameraDirector?.notifyUserInteraction());

        viewport.moveCenter(400, 200);

        // 스마트 카메라 디렉터 생성 (뷰포트 + 화면/월드 크기 + 슬로모션 콜백)
        cameraDirector = new CameraDirector(viewport, {
          worldWidth: WORLD_WIDTH,
          worldHeight: WORLD_HEIGHT,
          screenW: window.innerWidth,
          screenH: window.innerHeight,
          setTimeScale: (scale: number) => workerRef.current?.postMessage({ type: 'SET_TIME_SCALE', payload: { scale } }),
          endMarginPercent: isCustomMap && customMapMeta?.layoutConfig?.endMarginPercent !== undefined 
            ? customMapMeta.layoutConfig.endMarginPercent 
            : presetMeta?.layoutConfig?.endMarginPercent, // PRD v6.0: 종료선 전달
        });
        cameraDirectorRef.current = cameraDirector;

        // ── 마우스 휠 줌 (데스크톱) ──
        const WHEEL_ZOOM_SPEED = 0.001; // deltaY 1px당 줌 변화율
        const onCanvasWheel = (e: WheelEvent) => {
          e.preventDefault(); // 페이지 스크롤 방지
          if (!cameraDirector) return;
          // deltaY: 양수=아래(축소), 음수=위(확대)
          const delta = -e.deltaY * WHEEL_ZOOM_SPEED;
          cameraDirector.applyUserZoom(delta, e.clientX, e.clientY);
        };
        app.canvas.addEventListener('wheel', onCanvasWheel, { passive: false });

        // ── 핀치 줌 (모바일/터치) ──
        let pinchStartDist = 0;
        let pinchStartZoom = 1;
        let pinchActive = false;

        const getTouchDist = (t1: Touch, t2: Touch) =>
          Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

        const getTouchCenter = (t1: Touch, t2: Touch) => ({
          x: (t1.clientX + t2.clientX) / 2,
          y: (t1.clientY + t2.clientY) / 2,
        });

        const onTouchStart = (e: TouchEvent) => {
          if (e.touches.length === 2) {
            pinchActive = true;
            pinchStartDist = getTouchDist(e.touches[0], e.touches[1]);
            pinchStartZoom = cameraDirector?.getZoom() ?? 1;
          }
        };

        const onTouchMove = (e: TouchEvent) => {
          if (!pinchActive || e.touches.length !== 2 || !cameraDirector) return;
          e.preventDefault(); // 기본 핀치 줌(브라우저 줌) 방지

          const currentDist = getTouchDist(e.touches[0], e.touches[1]);
          const scale = currentDist / pinchStartDist;
          const targetZoom = pinchStartZoom * scale;
          const currentZoom = cameraDirector.getZoom();
          const delta = (targetZoom - currentZoom) / currentZoom; // 상대 변화율

          const center = getTouchCenter(e.touches[0], e.touches[1]);
          cameraDirector.applyUserZoom(delta, center.x, center.y);
        };

        const onTouchEnd = (e: TouchEvent) => {
          if (e.touches.length < 2) {
            pinchActive = false;
          }
        };

        app.canvas.addEventListener('touchstart', onTouchStart, { passive: true });
        app.canvas.addEventListener('touchmove', onTouchMove, { passive: false });
        app.canvas.addEventListener('touchend', onTouchEnd, { passive: true });

        // cleanup 등록
        (app as any)._zoomInputCleanup = () => {
          app.canvas.removeEventListener('wheel', onCanvasWheel);
          app.canvas.removeEventListener('touchstart', onTouchStart);
          app.canvas.removeEventListener('touchmove', onTouchMove);
          app.canvas.removeEventListener('touchend', onTouchEnd);
        };

        // Filters
        const shockwave = new ShockwaveFilter();
        shockwave.center = [window.innerWidth / 2, window.innerHeight / 2];
        shockwave.amplitude = 40;
        shockwave.wavelength = 200;
        shockwave.speed = 600;
        shockwave.brightness = 1.2;
        shockwaveRef.current = shockwave;
        shockwaveRef.current.enabled = false;
        
        app.stage.filters = [shockwave];
        
        app.ticker.add((ticker) => {
          // ═══════════════════════════════════════════════════════════════════
          // ██ PROTECTED: 우승자 판정 후에도 물리 시뮬레이션 계속 진행 ██
          // 이 조건을 'playing'으로만 제한하면 우승자 확정 시 경기가 멈춥니다.
          // 'winner_declared' 상태에서도 STEP을 계속 전송하여 남은 참가자가
          // 결승선까지 도달할 수 있도록 합니다.
          // 'all_finished' 상태에서만 STEP 전송을 중단합니다.
          // ⚠️ DO NOT MODIFY: 사용자 요청에 의해 영구 고정된 로직입니다.
          // ═══════════════════════════════════════════════════════════════════
          const gs = gameStateRef.current;
          if ((gs === 'playing' || gs === 'winner_declared') && workerRef.current) {
            workerRef.current.postMessage({ type: 'STEP' });
          }

          if (shockwaveRef.current && shockwaveRef.current.enabled) {
            shockwaveRef.current.time += ticker.deltaTime * 0.02;
            if (shockwaveRef.current.time > 2.5) {
              shockwaveRef.current.enabled = false;
              shockwaveRef.current.time = 0;
            }
          }

          // ── 스마트 카메라 디렉터: 단일 목표 + 단일 지수 댐핑 ──
          if (cameraDirector) {
            cameraDirector.setGameState(gameStateRef.current);
            const nowMs = performance.now();
            const dtSec = (nowMs - lastCamMs) / 1000;
            lastCamMs = nowMs;
            cameraDirector.update(dtSec, chipPositions, currentRankings[0]?.id ?? null);
          }

          // Update Viewport Indicator — 월드 경계로 clamp 하여 트랙 폭 안의 깔끔한 밴드로 표시
          // (visibleW = innerWidth/zoom 가 트랙 폭 800을 넘쳐 "가로 꽉 찬 박스"가 되던 문제 해결)
          if (viewIndicator) {
            viewIndicator.clear();
            const currentZoom = viewport.scale.x;
            const visibleW = window.innerWidth / currentZoom;
            const visibleH = window.innerHeight / currentZoom;
            const cx = viewport.center.x;
            const cy = viewport.center.y;
            const x0 = Math.max(-200, cx - visibleW / 2);
            const x1 = Math.min(WORLD_WIDTH + 200, cx + visibleW / 2);
            // PRD v4: 미니맵 표시 박스(viewIndicator)가 데드존에서 멈추지 않고 
            // 뷰포트 전체 스크롤 범위(-500 ~ WORLD_HEIGHT + 200)를 정확히 담아내도록 수정
            const y0 = Math.max(-500, cy - visibleH / 2);
            const y1 = Math.min(WORLD_HEIGHT + 200, cy + visibleH / 2);
            const sw = Math.max(2, 8 / currentZoom);
            viewIndicator.rect(x0, y0, x1 - x0, y1 - y0);
            viewIndicator.fill({ color: 0x00ffcc, alpha: 0.12 });
            viewIndicator.stroke({ width: sw, color: 0x00ffcc, alpha: 0.9 });
          }
        });

        // PiP Viewport (Minimap / Last place tracker)
        const baseMinimapWidth = 192;
        const baseMinimapHeight = baseMinimapWidth * (WORLD_HEIGHT / WORLD_WIDTH);

        pipViewport = new Viewport({
          screenWidth: baseMinimapWidth,
          screenHeight: baseMinimapHeight,
          worldWidth: WORLD_WIDTH,
          worldHeight: WORLD_HEIGHT,
          events: app.renderer.events
        });
        // Set PiP mask
        const pipMask = new PIXI.Graphics();
        app.stage.addChild(pipMask);
        pipViewport.mask = pipMask;
        pipViewport.scale.set(baseMinimapHeight / WORLD_HEIGHT); // 세로 트랙 전체가 미니맵에 들어오도록 스케일

        // Add minimap background
        const minimapBg = new PIXI.Graphics();
        // PRD v4: 미니맵 영역 전체(데드존 포함)를 커버하도록 수정
        minimapBg.rect(-200, -500, WORLD_WIDTH + 400, WORLD_HEIGHT + 700);
        minimapBg.fill({ color: 0x000000, alpha: 0.7 });
        pipViewport.addChild(minimapBg);

        // Add container for dynamic minimap dots
        minimapDynamic = new PIXI.Container();
        pipViewport.addChild(minimapDynamic);
        
        // View indicator
        viewIndicator = new PIXI.Graphics();
        pipViewport.addChild(viewIndicator);
        
        pipViewport.eventMode = 'static';

        // 탭으로 누른 지점 근처의 칩(반경 60px)을 찾는다(있으면 락온 추적).
        const findChipNear = (lx: number, ly: number): string | null => {
          let best: string | null = null;
          let minDistSq = 60 * 60;
          for (const [id, pos] of chipPositions.entries()) {
            const dx = pos.x - lx, dy = pos.y - ly;
            const d = dx * dx + dy * dy;
            if (d < minDistSq) { minDistSq = d; best = id; }
          }
          return best;
        };

        // 화면 좌표가 미니맵 안인지 + 월드 좌표로 변환
        const inMinimap = (sx: number, sy: number) => {
          const r = minimapScreenRect;
          return sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;
        };
        const minimapToWorld = (sx: number, sy: number) => {
          const r = minimapScreenRect;
          // PRD v4: 미니맵이 데드존 클램프 영역까지 모두 포함하므로 오프셋 보정
          return { x: (sx - r.x) / r.scale - (r.offsetX || 0), y: (sy - r.y) / r.scale - (r.offsetY || 0) };
        };

        // 미니맵 인터랙션은 윈도우 레벨에서 처리(아래 전체화면 메인 뷰포트가 Pixi 히트테스트를
        // 가로채 클릭이 안 먹던 문제를 우회). 미니맵 위 조작 동안은 메인 드래그를 일시정지.
        if (typeof window !== 'undefined') {
          const onDown = (ev: PointerEvent) => {
            if (!inMinimap(ev.clientX, ev.clientY)) return;
            minimapPointerActive = true;
            minimapMoved = false;
            minimapDownScreen = { x: ev.clientX, y: ev.clientY };
            try { viewport.plugins.pause('drag'); } catch {}
          };
          const onMove = (ev: PointerEvent) => {
            if (!minimapPointerActive) return;
            const dx = ev.clientX - minimapDownScreen.x;
            const dy = ev.clientY - minimapDownScreen.y;
            if (!minimapMoved && dx * dx + dy * dy > 36) {
              minimapMoved = true;
              cameraDirector?.minimapScrubStart();
            }
            if (minimapMoved) {
              const w = minimapToWorld(ev.clientX, ev.clientY);
              cameraDirector?.minimapScrub(w.x, w.y);
            }
          };
          const onUp = () => {
            if (!minimapPointerActive) return;
            minimapPointerActive = false;
            try { viewport.plugins.resume('drag'); } catch {}
            if (minimapMoved) {
              cameraDirector?.minimapScrubEnd();
            } else {
              const w = minimapToWorld(minimapDownScreen.x, minimapDownScreen.y);
              cameraDirector?.minimapJump(w.x, w.y, findChipNear(w.x, w.y));
            }
          };
          window.addEventListener('pointerdown', onDown);
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
          (app as any)._minimapInputCleanup = () => {
            window.removeEventListener('pointerdown', onDown);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
          };
        }

        // Draw border for PiP
        const pipBorder = new PIXI.Graphics();
        app.stage.addChild(pipBorder);
        app.stage.addChild(pipViewport);

        // Setup minimap resize logic to place it at bottom-left
        const updateMinimapPos = () => {
          const h = window.innerHeight;
          
          // PRD v4: 미니맵에 데드존까지 포함한 전체 클램프 영역 매핑
          const BOUND_W = WORLD_WIDTH + 400; // left -200, right 200
          const BOUND_H = WORLD_HEIGHT + 700; // top -500, bottom 200
          
          // 미니맵 가로 폭 고정 (로비 버튼과 동기화)
          const currentMinimapWidth = 192;
          // 맵 실제 비율에 맞춰 세로 크기 동적 할당
          const currentMinimapHeight = currentMinimapWidth * (BOUND_H / BOUND_W);
          
          // 하단 간격 최적화
          const BOTTOM_MARGIN = 90;
          const pipY = h - currentMinimapHeight - BOTTOM_MARGIN;
          
          // 버튼의 좌측 정렬(24px)에 완벽하게 일치
          const MINIMAP_X = 24;
          
          pipViewport.resize(currentMinimapWidth, currentMinimapHeight, BOUND_W, BOUND_H);
          const pipScale = currentMinimapHeight / BOUND_H;
          pipViewport.scale.set(pipScale);
          // 실제 월드의 (0,0) 위치가 데드존 오프셋(-200, -500)만큼 미뤄져 렌더링되게 pivot 설정
          pipViewport.pivot.set(-200, -500);

          pipMask.clear();
          pipMask.roundRect(MINIMAP_X, pipY, currentMinimapWidth, currentMinimapHeight, 16);
          pipMask.fill(0xffffff);
          
          pipBorder.clear();
          pipBorder.roundRect(MINIMAP_X, pipY, currentMinimapWidth, currentMinimapHeight, 16);
          pipBorder.stroke({ width: 2, color: 0x00ffcc, alpha: 0.8 });
          
          pipViewport.position.set(MINIMAP_X, pipY);
          // 윈도우 레벨 미니맵 클릭 처리를 위한 화면 사각형/스케일 저장 (y 오프셋 보정 필요)
          minimapScreenRect = { 
            x: MINIMAP_X, 
            y: pipY, 
            w: currentMinimapWidth, 
            h: currentMinimapHeight, 
            scale: pipScale,
            offsetX: 200,
            offsetY: 500
          };
          cameraDirector?.resize(window.innerWidth, window.innerHeight);
        };
        updateMinimapPos();
        window.addEventListener('resize', updateMinimapPos);
        (app as any)._minimapResizeHandler = updateMinimapPos; // For cleanup

        // Web Worker Initialization
        workerRef.current = new Worker(new URL('../engine/physics.worker.ts', import.meta.url));
        workerRef.current.onerror = (err) => {
          console.error("Worker error:", err.message, err.filename, err.lineno);
          const errDiv = document.createElement('div');
          errDiv.style.color = 'yellow';
          errDiv.style.position = 'absolute';
          errDiv.style.top = '100px';
          errDiv.style.zIndex = '9999';
          errDiv.innerText = "Worker Error: " + err.message;
          document.body.appendChild(errDiv);
        };
      } catch (e: any) {
        console.error("DEBUG CRASH:", e.stack);
        const errDiv = document.createElement('div');
        errDiv.style.position = 'absolute';
        errDiv.style.top = '0';
        errDiv.style.left = '0';
        errDiv.style.color = 'red';
        errDiv.style.zIndex = '9999';
        errDiv.innerText = e.stack || e.message;
        document.body.appendChild(errDiv);
      }

      // 스킬별 대표 색상(각 스킬 VFX의 주 색상과 일치). 발동 버스트/링에 사용.
      const SKILL_COLORS: Record<string, number> = {
        tank: 0xFF8C00, booster: 0x00FFD0, ghost: 0xC084FC,
        slime: 0x39FF14, magnet: 0x3B82F6, teleport: 0xFACC15,
      };

      const applySkillVFX = (chipId: string, skill: string) => {
        const container = graphicsMap.get(chipId);
        if (!container) return;

        // 기존 이펙트 정리
        removeSkillVFX(chipId);

        // ── 공통 활성화 버스트: 발동 순간을 분명히 보이게 (모든 스킬) ──
        // 확장·페이드되는 링 + 방사형 파티클 1회. 자체 정리되므로 cleanupTasks 불필요.
        const burstColor = SKILL_COLORS[skill] ?? 0xffffff;
        const ring = new PIXI.Graphics();
        ring.circle(0, 0, 14);
        ring.stroke({ color: burstColor, width: 3, alpha: 0.9 });
        ring.position.copyFrom(container.position);
        viewport.addChild(ring);
        gsap.fromTo(ring.scale, { x: 0.4, y: 0.4 }, { x: 3.2, y: 3.2, duration: 0.45, ease: 'power2.out' });
        gsap.to(ring, { alpha: 0, duration: 0.45, ease: 'power2.out', onComplete: () => ring.destroy() });

        for (let i = 0; i < 10; i++) {
          const ang = (Math.PI * 2 * i) / 10 + Math.random() * 0.4;
          const dist = 36 + Math.random() * 24;
          const p = new PIXI.Graphics();
          p.circle(0, 0, 2 + Math.random() * 2.5);
          p.fill({ color: burstColor, alpha: 0.95 });
          p.position.copyFrom(container.position);
          viewport.addChild(p);
          gsap.to(p.position, {
            x: container.position.x + Math.cos(ang) * dist,
            y: container.position.y + Math.sin(ang) * dist,
            duration: 0.4 + Math.random() * 0.2, ease: 'power2.out',
          });
          gsap.to(p, { alpha: 0, duration: 0.4 + Math.random() * 0.2, ease: 'power2.in', onComplete: () => p.destroy() });
        }

        const iconWrapper = container.getChildByLabel('icon');
        const cleanupTasks: (() => void)[] = [];

        switch (skill) {
          case 'tank': {
            const glow = new GlowFilter({ color: 0xFF8C00, outerStrength: 3, innerStrength: 1, quality: 0.5 });
            if (iconWrapper) {
              iconWrapper.filters = [...(iconWrapper.filters || []), glow];
              gsap.to(iconWrapper.scale, { x: 1.3, y: 1.3, duration: 0.3 });
            }
            
            let frameCount = 0;
            const trailTicker = () => {
              frameCount++;
              if (frameCount % 5 === 0) {
                const trail = new PIXI.Graphics();
                trail.circle(0, 0, 10);
                trail.fill({ color: 0xFF8C00, alpha: 0.4 });
                trail.position.copyFrom(container.position);
                viewport.addChildAt(trail, 0); // 배경 위에
                
                gsap.to(trail, {
                  alpha: 0,
                  duration: 0.4,
                  onComplete: () => trail.destroy()
                });
              }
            };
            app.ticker.add(trailTicker);

            cleanupTasks.push(() => {
              app.ticker.remove(trailTicker);
              if (iconWrapper) {
                iconWrapper.filters = (iconWrapper.filters as any[])?.filter(f => f !== glow) || null;
                gsap.to(iconWrapper.scale, { x: 1.0, y: 1.0, duration: 0.3 });
              }
            });
            break;
          }
          case 'booster': {
            const glow = new GlowFilter({ color: 0x00FFD0, outerStrength: 3, quality: 0.5 });
            if (iconWrapper) {
              iconWrapper.filters = [...(iconWrapper.filters || []), glow];
            }

            // 스피드라인 2개
            const lines: PIXI.Graphics[] = [];
            [-15, 15].forEach(xOff => {
              const line = new PIXI.Graphics();
              line.rect(-0.5, -10, 1, 20);
              line.fill({ color: 0x00FFD0, alpha: 0.8 });
              line.position.set(xOff, 0);
              container.addChild(line);
              lines.push(line);

              gsap.fromTo(line.position, 
                { y: 30 }, 
                { y: -30, duration: 0.2 + Math.random() * 0.1, repeat: -1, ease: 'none' }
              );
            });

            let frameCount = 0;
            const trailTicker = () => {
              frameCount++;
              if (frameCount % 5 === 0) {
                const trail = new PIXI.Graphics();
                trail.circle(0, 0, 4 + Math.random() * 4);
                trail.fill({ color: 0x00FFD0, alpha: 0.5 });
                // 진행 방향 반대(위쪽)에 불꽃
                trail.position.set(container.position.x + (Math.random() * 10 - 5), container.position.y - 15 - Math.random() * 10);
                viewport.addChildAt(trail, 0);
                
                gsap.to(trail, {
                  y: trail.position.y - 20,
                  alpha: 0,
                  duration: 0.3,
                  onComplete: () => trail.destroy()
                });
                // 스케일은 Point(x/y) 라 별도 트윈으로 축소(타입/런타임 모두 정상)
                gsap.to(trail.scale, { x: 0.5, y: 0.5, duration: 0.3 });
              }
            };
            app.ticker.add(trailTicker);

            cleanupTasks.push(() => {
              app.ticker.remove(trailTicker);
              if (iconWrapper) iconWrapper.filters = (iconWrapper.filters as any[])?.filter(f => f !== glow) || null;
              lines.forEach(l => {
                gsap.killTweensOf(l.position);
                l.destroy();
              });
            });
            break;
          }
          case 'ghost': {
            const glow = new GlowFilter({ color: 0xC084FC, outerStrength: 2, quality: 0.5 });
            if (iconWrapper) {
              iconWrapper.filters = [...(iconWrapper.filters || []), glow];
            }
            gsap.to(container, { alpha: 0.35, duration: 0.3 });
            const pulse = gsap.to(glow, { outerStrength: 4, duration: 0.8, yoyo: true, repeat: -1 });
            cleanupTasks.push(() => {
              if (iconWrapper) iconWrapper.filters = (iconWrapper.filters as any[])?.filter(f => f !== glow) || null;
              gsap.to(container, { alpha: 1.0, duration: 0.3 });
              pulse.kill();
            });
            break;
          }
          case 'slime': {
            const colorOverlay = new ColorOverlayFilter({ color: [0.22, 1.0, 0.08], alpha: 0.35 });
            let pulse: any;
            if (iconWrapper) {
              iconWrapper.filters = [...(iconWrapper.filters || []), colorOverlay];
              pulse = gsap.to(iconWrapper.scale, { x: 1.15, y: 0.85, duration: 0.6, yoyo: true, repeat: -1 });
            }
            
            // 슬라임 방울 4개
            const drops: PIXI.Graphics[] = [];
            const dropOffsets = [{x: 10, y: 10}, {x: -10, y: 10}, {x: 10, y: -10}, {x: -10, y: -10}];
            dropOffsets.forEach(off => {
              const drop = new PIXI.Graphics();
              drop.circle(0, 0, 2 + Math.random() * 2);
              drop.fill({ color: 0x39FF14, alpha: 0.8 });
              drop.position.set(off.x, off.y);
              container.addChild(drop);
              drops.push(drop);
              
              gsap.to(drop.position, {
                y: off.y + (Math.random() * 6 - 3),
                duration: 0.5 + Math.random() * 0.5,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut'
              });
            });

            cleanupTasks.push(() => {
              if (iconWrapper) iconWrapper.filters = (iconWrapper.filters as any[])?.filter(f => f !== colorOverlay) || null;
              if (pulse) pulse.kill();
              if (iconWrapper) gsap.to(iconWrapper.scale, { x: 1.0, y: 1.0, duration: 0.3 });
              drops.forEach(d => {
                gsap.killTweensOf(d.position);
                d.destroy();
              });
            });
            break;
          }
          case 'magnet': {
            const glow = new GlowFilter({ color: 0x3B82F6, outerStrength: 3, quality: 0.5 });
            if (iconWrapper) {
              iconWrapper.filters = [...(iconWrapper.filters || []), glow];
            }

            // 동심원 (자기장 범위) — 물리 엔진 MAGNET_RADIUS=400과 동일
            const MAGNET_VFX_RADIUS = 400;
            const field = new PIXI.Graphics();
            field.circle(0, 0, MAGNET_VFX_RADIUS);
            field.stroke({ width: 2, color: 0x3B82F6, alpha: 0.5 });
            field.fill({ color: 0x3B82F6, alpha: 0.05 });
            container.addChildAt(field, 0);

            const fieldPulse = gsap.to(field, { alpha: 0.5, duration: 1, yoyo: true, repeat: -1 });

            // 인력선 (단일 Graphics 재사용)
            const attractionLines = new PIXI.Graphics();
            viewport.addChild(attractionLines);

            let frameCount = 0;
            const lineTicker = () => {
              frameCount++;
              // 성능 최적화: 10프레임마다 갱신
              if (frameCount % 10 !== 0) return;
              
              attractionLines.clear();
              const myPos = container.position;
              let drawnCount = 0;
              
              // 최대 4개까지만 선을 그음 (물리 범위와 동일한 400px)
              const MAGNET_LINE_RADIUS_SQ = MAGNET_VFX_RADIUS * MAGNET_VFX_RADIUS;
              for (const [otherId, pos] of chipPositions.entries()) {
                if (otherId === chipId) continue;
                const dx = pos.x - myPos.x;
                const dy = pos.y - myPos.y;
                const distSq = dx * dx + dy * dy;
                if (distSq < MAGNET_LINE_RADIUS_SQ) {
                  // 점선 효과 (점선은 stroke 텍스처나 dash를 써야하지만 기본 그래픽스는 지원이 빈약하므로 알파로 느낌만 줌)
                  attractionLines.moveTo(myPos.x, myPos.y);
                  attractionLines.lineTo(pos.x, pos.y);
                  drawnCount++;
                  if (drawnCount >= 4) break;
                }
              }
              if (drawnCount > 0) {
                attractionLines.stroke({ width: 1.5, color: 0x3B82F6, alpha: 0.6 });
              }
            };
            app.ticker.add(lineTicker);

            cleanupTasks.push(() => {
              app.ticker.remove(lineTicker);
              attractionLines.destroy();
              if (iconWrapper) iconWrapper.filters = (iconWrapper.filters as any[])?.filter(f => f !== glow) || null;
              fieldPulse.kill();
              field.destroy();
            });
            break;
          }
          case 'teleport': {
            // 잔상 폭발
            if (iconWrapper) {
              const ghost = new PIXI.Container();
              // iconWrapper의 자식(스프라이트)들을 복제하여 잔상 생성
              iconWrapper.children.forEach(child => {
                if (child instanceof PIXI.Sprite) {
                  const clone = new PIXI.Sprite(child.texture);
                  clone.anchor.copyFrom(child.anchor);
                  clone.width = child.width;
                  clone.height = child.height;
                  clone.tint = child.tint;
                  ghost.addChild(clone);
                }
              });
              ghost.position.copyFrom(container.position);
              viewport.addChild(ghost);
              gsap.to(ghost.scale, { x: 2, y: 2, duration: 0.3 });
              gsap.to(ghost, { alpha: 0, duration: 0.3, onComplete: () => ghost.destroy() });
            }

            // 번개선 이펙트 (지그재그 8~12 세그먼트)
            const lightning = new PIXI.Graphics();
            viewport.addChild(lightning);
            
            // 순간이동은 이동 전/후 위치가 필요하지만, SKILL_FIRED 발생 시점엔 이미 목적지에 도착해 있음.
            // 위쪽(y - 300)에서 떨어지는 듯한 번개를 그림
            const startX = container.position.x + (Math.random() * 100 - 50);
            const startY = container.position.y - 300;
            const endX = container.position.x;
            const endY = container.position.y;
            
            const drawLightning = () => {
              lightning.clear();
              lightning.moveTo(startX, startY);
              let currX = startX;
              let currY = startY;
              const segments = 8 + Math.floor(Math.random() * 4);
              for (let i = 1; i <= segments; i++) {
                const targetX = startX + (endX - startX) * (i / segments);
                const targetY = startY + (endY - startY) * (i / segments);
                currX = targetX + (Math.random() * 40 - 20);
                currY = targetY + (Math.random() * 40 - 20);
                if (i === segments) {
                  currX = endX;
                  currY = endY;
                }
                lightning.lineTo(currX, currY);
              }
              lightning.stroke({ width: 3, color: 0xFACC15, alpha: 0.8 });
              lightning.stroke({ width: 6, color: 0xFACC15, alpha: 0.4 });
            };
            
            // 번개 번쩍임 (0.08초 간격으로 3번)
            let flashes = 0;
            const flashInterval = setInterval(() => {
              drawLightning();
              flashes++;
              if (flashes >= 3) {
                clearInterval(flashInterval);
                lightning.destroy();
              }
            }, 80);
            intervals.push(flashInterval);

            // 목적지 쇼크웨이브
            if (shockwaveRef.current) {
              const globalPos = viewport.toGlobal(container.position);
              shockwaveRef.current.center = [globalPos.x, globalPos.y];
              shockwaveRef.current.time = 0;
              shockwaveRef.current.enabled = true;
            }

            // teleport는 duration이 없으므로 자동 정리
            // 경합 방지: setTimeout 실행 시점에 activeVFXMap에 남아있는 VFX가
            // 여전히 teleport 전용인지 확인 후에만 제거
            const teleportVfxRef = {}; // 고유 참조 토큰
            cleanupTasks.push(() => { /* teleport cleanup은 이미 위에서 처리됨 */ });
            const currentVfx = { cleanup: () => cleanupTasks.forEach(fn => fn()), _token: teleportVfxRef };
            activeVFXMap.set(chipId, currentVfx as any);
            setTimeout(() => {
              const existing = activeVFXMap.get(chipId) as any;
              // 같은 토큰일 때만 제거 (다른 스킬이 이미 덮어썼으면 무시)
              if (existing && existing._token === teleportVfxRef) {
                activeVFXMap.delete(chipId);
              }
            }, 500);
            return; // teleport는 아래 activeVFXMap.set을 건너뜀 (위에서 직접 등록)
          }
        }

        activeVFXMap.set(chipId, {
          cleanup: () => {
            cleanupTasks.forEach(fn => fn());
          }
        });
      };

      const removeSkillVFX = (chipId: string) => {
        const container = graphicsMap.get(chipId);
        if (container && !container.destroyed) {
          const vfx = activeVFXMap.get(chipId);
          if (vfx) vfx.cleanup();
          activeVFXMap.delete(chipId);
        }
      };

      workerRef.current!.onmessage = (e) => {
        if (!isMounted) return;
        const { type, payload } = e.data;
        
        if (type === 'INIT_DONE') {
          setIsWorkerReady(true);
          activeChipsCount = payload.activeChipsCount;
          // 첫 완주자가 우승 슬롯인지 알려 결승 직전 슬로우 연출 게이팅을 무장
          cameraDirector?.setDrama(isWinnerRank(1));

          // 랜덤 레이스: 게임 초기화 완료 시 당첨 등수 팝업을 3초간 표시
          if (gameMode === 'random' && randomWinningRanks.length > 0) {
            setShowRandomPopup(true);
            setTimeout(() => setShowRandomPopup(false), 3000);
          }
          
          if (payload.mapData) {
            const staticContainer = new PIXI.Container();
            staticContainer.zIndex = -10;
            viewport.addChild(staticContainer);

            // PRD v4: Floor 레이어 추가 (라인 렌더링)
            const floorContainer = new PIXI.Container();
            floorContainer.zIndex = -20; // staticContainer보다 더 아래에(배경(-100) 바로 위)
            viewport.addChild(floorContainer);
            
            // 시작선/종료선: 공유 모듈(StageChrome)로 게임/에디터 동일 렌더
            const layoutConfigToUse = isCustomMap && customMapMeta?.layoutConfig ? customMapMeta.layoutConfig : presetMeta?.layoutConfig;
            floorContainer.addChild(createStartEndLines({
              worldHeight: WORLD_HEIGHT,
              layoutConfig: layoutConfigToUse,
            }));

            // Minimap static layer
            minimapStatic = new PIXI.Container();
            pipViewport.addChildAt(minimapStatic, 1);

            const obsCtx = createAppRenderContext(app, { animated: true, quality: 'full' });
            const createEditorItemGraphic = (item: any) => {
              const r = createObstacleGraphic(item, obsCtx);
              itemDisposers.push(r.dispose);
              minimapStatic.addChild(r.minimap);
              if (item.id) { r.node.label = item.id; graphicsMap.set(item.id, r.node); }
              staticContainer.addChild(r.node);
            };

            if (Array.isArray(payload.mapData) && payload.mapData.length > 0) {
              payload.mapData.forEach((item: any) => createEditorItemGraphic(item));
            }


            
          }

          // NOTE: 자동 시작 제거. 칩은 출발선(y=50)에 정지 상태로 렌더링되며,
          // 사용자가 "게임 시작" 버튼(handleStart)을 눌러야 워커에 START가 전송된다.
          // 그 전까지는 "자리 섞기"(SHUFFLE)로 위치를 재배치할 수 있다.
        } else if (type === 'FRAME') {
          const buffer = new Float32Array(payload);
          
          let firstY = -Infinity;
          let secondY = -Infinity;
          let firstX = 400;
          let firstChipId: string | null = null;

          // Buffer format: [id, x, y, vx, vy]
          for (let i = 0; i < buffer.length; i += 5) {
            const rawId = buffer[i];
            const dataIndex = Math.floor(i / 5);
            const x = buffer[i + 1];
            const y = buffer[i + 2];
            const vx = buffer[i + 3];
            const vy = buffer[i + 4];

            const isChip = dataIndex < survivors.length;
            const survivor = isChip ? survivors[dataIndex] : null;
            
            // 절대적으로 고유한 식별자 부여: 칩인 경우 survivor.id 사용, 그 외의 경우 고유 entity ID 사용
            const bodyId = survivor ? survivor.id : `entity_${rawId}_${dataIndex}`;
            
            if (isChip && survivor) {
              chipPositions.set(survivor.id, { x, y });
            }

            let container = graphicsMap.get(bodyId);
            
            if (!container) {
              container = new PIXI.Container();
              viewport.addChild(container);
              
              if (isChip && survivor) {
                let colNum = 0x00ffcc;
                try { if (survivor.color) colNum = new PIXI.Color(survivor.color).toNumber(); } catch { colNum = 0x00ffcc; }
                
                let skinKey = survivor.skinId || 'chip_base_1';
                // Remove UR_ and SR_ prefix for asset loading
                if (skinKey === 'UR_blackhole') skinKey = 'blackhole';
                if (skinKey === 'SR_cat') skinKey = 'cat';
                
                const textureUrl = `/images/assets/skins/${skinKey}.png`;
                const R = 18; // Physics radius
                
                // 에셋별 렌더링 스케일 조정 (시각적 밸런스 패치)
                let renderDiameter = R * 2;
                const isLargeAsset = skinKey.startsWith('chip_base_') || 
                                     skinKey.startsWith('pr_') ||
                                     skinKey === 'blackhole' || 
                                     skinKey === 'shuriken';
                if (isLargeAsset) {
                  renderDiameter = R * 1.3;
                }
                
                const iconWrapper = new PIXI.Container();
                iconWrapper.label = 'icon';
                container.addChild(iconWrapper);
                
                try {
                  const tex = PIXI.Assets.get(textureUrl);
                  if (tex) {
                    if (skinKey.startsWith('pr_')) {
                      // 둥근 그림자
                      const shadow = new PIXI.Graphics();
                      shadow.circle(0, 0, renderDiameter / 2);
                      shadow.fill({ color: 0x000000, alpha: 0.5 });
                      shadow.y = 3;
                      iconWrapper.addChild(shadow);

                      // 스프라이트 (원본 컬러 유지)
                      const sprite = new PIXI.Sprite(tex);
                      sprite.anchor.set(0.5);
                      sprite.width = renderDiameter;
                      sprite.height = renderDiameter;
                      sprite.tint = 0xFFFFFF; // 틴트 초기화

                      // 원형 마스크
                      const mask = new PIXI.Graphics();
                      mask.circle(0, 0, renderDiameter / 2);
                      mask.fill({ color: 0xffffff, alpha: 1.0 });
                      iconWrapper.addChild(mask);
                      sprite.mask = mask;
                      
                      iconWrapper.addChild(sprite);

                      // 칩 식별을 위한 테두리 색상 처리
                      const border = new PIXI.Graphics();
                      border.circle(0, 0, renderDiameter / 2);
                      border.stroke({ width: 3, color: colNum, alpha: 1.0 });
                      iconWrapper.addChild(border);
                    } else {
                      // subtle drop shadow
                      const shadow = new PIXI.Sprite(tex);
                      shadow.anchor.set(0.5);
                      shadow.width = renderDiameter;
                      shadow.height = renderDiameter;
                      shadow.tint = 0x000000;
                      shadow.alpha = 0.5;
                      shadow.y = 3;
                      iconWrapper.addChild(shadow);

                      const sprite = new PIXI.Sprite(tex);
                      sprite.anchor.set(0.5); // 완벽한 무결성을 위한 중앙 앵커 정렬
                      sprite.width = renderDiameter;   // 시각적 사이즈 조정 적용
                      sprite.height = renderDiameter;
                      sprite.tint = colNum;   // 참가자 고유 색상 무한 지원
                      iconWrapper.addChild(sprite);
                    }
                  } else {
                    throw new Error("Texture not preloaded");
                  }
                } catch (e) {
                  // 로드 실패 시 무결성 보장을 위한 Fallback (예외 상황 처리)
                  const fallback = new PIXI.Graphics();
                  fallback.circle(0, 0, R);
                  fallback.fill({ color: colNum, alpha: 1.0 });
                  fallback.stroke({ width: 2, color: 0xffffff, alpha: 0.8 });
                  iconWrapper.addChild(fallback);
                }

                const text = new PIXI.Text({ 
                  text: survivor.name, 
                  style: { 
                    fill: colNum, 
                    fontSize: 14, 
                    fontWeight: 'bold', 
                    dropShadow: { alpha: 0.9, color: 0x000000, blur: 4, distance: 1 },
                    stroke: { color: 0x000000, width: 3, join: 'round' }
                  } 
                });
                text.anchor.set(0.5);
                text.y = -40;
                container.addChild(text);
              } else {
                // Dynamic kinematics like windmill rotor
                const tex = PIXI.Assets.get('/images/assets/obstacles/windmill_rotor.png');
                if (tex) {
                  const sprite = new PIXI.Sprite(tex);
                  sprite.anchor.set(0.5);
                  sprite.width = 100;
                  sprite.height = 100;
                  container.addChild(sprite);
                } else {
                  const g = new PIXI.Graphics();
                  g.circle(0,0, 10);
                  g.fill(0xffffff);
                  container.addChild(g);
                }
              }
              
              graphicsMap.set(bodyId, container);
            }
            
            container.position.set(x, y);
            // approximate rolling rotation
            if (isChip && survivor) {
              const iconWrapper = container.getChildByLabel('icon');
              if (iconWrapper) {
                iconWrapper.rotation += (vx * 0.005);
              }
            } else {
              container.rotation += (vx * 0.005);
            }
            
            // mBlur 로직 완전히 제거 (에셋 성능 최적화)

            // Minimap Dot Logic
            if (minimapDynamic) {
              let mDot = minimapDotsMap.get(bodyId);
              if (!mDot) {
                mDot = new PIXI.Graphics();
                minimapDynamic.addChild(mDot);
                minimapDotsMap.set(bodyId, mDot);
              }
              mDot.position.set(x, y);

              // Update color and size
              mDot.clear();
              if (isChip && survivor) {
                const colorNum = parseInt(survivor.color.replace('#', '0x')) || 0xffffff;
                if (currentRankings.length > 0 && currentRankings[0].id === survivor.id) {
                  mDot.circle(0,0, 30); // 1st place is huge and gold
                  mDot.fill(0xffd700);
                  // Add a subtle white outline to 1st place
                  mDot.stroke({ width: 10, color: 0xffffff, alpha: 1 });
                } else {
                  mDot.circle(0,0, 18);
                  mDot.fill(colorNum);
                  mDot.stroke({ width: 4, color: 0xffffff, alpha: 0.8 });
                }
              } else {
                mDot.circle(0,0, 18);
                mDot.fill(0x888888);
              }
            }

            if (y > firstY && y < WORLD_HEIGHT) {
              secondY = firstY;
              firstY = y;
              firstX = x;
              if (isChip && survivor) firstChipId = survivor.id;
            } else if (y > secondY && y < WORLD_HEIGHT) {
              secondY = y;
            }
          }
          
          // Background Parallax & Theme Zone Color
          if (bgLayers.length >= 2) {
            bgLayers[0].y = 600 - (viewport.center.y - 600) * 0.1; // Slowest (far)
            bgLayers[1].y = 600 - (viewport.center.y - 600) * 0.3; // Faster (mid)

            // Theme Tint (월드 높이에 비례한 깊이 구간)
            if (viewport.center.y > WORLD_HEIGHT * 0.66) {
              bgLayers[0].tint = 0xff7777; // Reddish Void
            } else if (viewport.center.y > WORLD_HEIGHT * 0.33) {
              bgLayers[0].tint = 0x77ff77; // Greenish Factory
            } else {
              bgLayers[0].tint = 0xffffff; // Neon
            }
          }

          if (payload && payload.byteLength) {
            workerRef.current?.postMessage({ type: 'RECYCLE_BUFFER', payload }, [payload]);
          }

        } else if (type === 'SOUND_EFFECT') {
          // 🎧 [스마트 오디오] 무의미한 충돌음 배제 로직
          if (payload.type === 'wallHit') {
            // 의도적으로 음소거(Mute) 처리하여 소음 방지
          } else if (payload.type === 'warp') {
            soundManager.playSfx('env_wormhole', 0, payload.x || 400);
          } else if (payload.type === 'finish') {
            soundManager.playSfx('ui_fanfare', 0, payload.x || 400);
          } else if (payload.type === 'bumperHit') {
            soundManager.playSfx('gimmick_domino', payload.impulse, payload.x);
            // Visual Shake on Bumper Hit
            if (payload.targetId) {
              const target = viewport.getChildAt(0).children.find(c => c.label === payload.targetId);
              if (target) {
                import('gsap').then(({ gsap }) => {
                  gsap.fromTo(target.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.3, ease: 'elastic.out(1, 0.3)' });
                  gsap.fromTo(target, { alpha: 2 }, { alpha: 1, duration: 0.2 });
                });
              }
            }
          } else if (payload.type === 'funnel') {
            soundManager.playSfx('gimmick_funnel', payload.impulse, payload.x);
          } else if (payload.type === 'pipe') {
            soundManager.playSfx('gimmick_pipe', payload.impulse, payload.x);
          } else if (payload.type === 'holeTrapped') {
            soundManager.playSfx('env_wormhole', 0, 400);
          } else if (payload.type === 'spinner_whoosh') {
            soundManager.playSfx('spinner_whoosh', payload.impulse, payload.x);
          }
        } else if (type === 'FLIPPER_SWING') {
          const target = viewport.getChildAt(0).children.find(c => (c as any).label === payload.id);
          if (target) {
            import('gsap').then(({ gsap }) => {
              gsap.fromTo(target.scale as any, { x: 1.2, y: 1.2 }, { x: 1, y: 1, duration: 0.3, ease: 'elastic.out(1, 0.3)' });
            });
          }
          // 무거운 둔탁한 소리로 매핑
          soundManager.playSfx('ui_nudge', 50, payload.x);
        } else if (type === 'ICE_CRACK') {
          soundManager.playSfx('gimmick_domino', 30, payload.x);
          const target = viewport.getChildAt(0).children.find(c => (c as any).label === payload.id);
          if (target) {
            import('gsap').then(({ gsap }) => {
              gsap.fromTo(target, { alpha: 1 }, { alpha: 0.5 + payload.remainingHp * 0.15, duration: 0.1 });
              gsap.fromTo(target.scale, { x: 1.1, y: 1.1 }, { x: 1, y: 1, duration: 0.2 });
            });
            for(let i=0; i<3; i++) {
              const p = new PIXI.Graphics();
              p.circle(0, 0, 3);
              p.fill({ color: 0xffffff, alpha: 0.8 });
              p.position.set(payload.x, payload.y);
              viewport.addChild(p);
              import('gsap').then(({ gsap }) => {
                gsap.to(p.position, { x: payload.x + (Math.random()-0.5)*40, y: payload.y + (Math.random()-0.5)*40, duration: 0.3 });
                gsap.to(p, { alpha: 0, duration: 0.3, onComplete: () => p.destroy() });
              });
            }
          }
        } else if (type === 'ICE_DESTROY') {
          // 얼음 파괴 파티클 및 짧은 금속성/유리 깨짐 효과음
          soundManager.playSfx('ui_door_slam', 0, payload.x);
          const target = viewport.getChildAt(0).children.find(c => (c as any).label === payload.id);
          if (target) {
            import('gsap').then(({ gsap }) => {
              gsap.to(target.scale, { x: 0, y: 0, duration: 0.2, ease: 'back.in(1.5)', onComplete: () => target.destroy() });
            });
          }
          for(let i=0; i<15; i++) {
            const p = new PIXI.Graphics();
            p.circle(0, 0, Math.random()*4+2);
            p.fill({ color: 0x88ccff, alpha: 0.9 });
            p.position.set(payload.x, payload.y);
            viewport.addChild(p);
            import('gsap').then(({ gsap }) => {
              gsap.to(p.position, { x: payload.x + (Math.random()-0.5)*100, y: payload.y + (Math.random()-0.5)*100, duration: 0.5 + Math.random()*0.3, ease: 'power2.out' });
              gsap.to(p, { alpha: 0, duration: 0.5, delay: 0.2, onComplete: () => p.destroy() });
            });
          }
        } else if (type === 'LUCKY_EFFECT') {
          soundManager.playSfx('env_wormhole', 0, payload.x);
          const colorMap: any = { boost: 0xff0000, bounce: 0x00ff00, stun: 0x888888, repel: 0x0000ff };
          const c = colorMap[payload.effect] || 0xffffff;
          for(let i=0; i<20; i++) {
            const p = new PIXI.Graphics();
            p.star(0, 0, 5, 6, 3);
            p.fill({ color: c, alpha: 1 });
            p.position.set(payload.x, payload.y);
            viewport.addChild(p);
            import('gsap').then(({ gsap }) => {
              gsap.to(p.position, { x: payload.x + (Math.random()-0.5)*150, y: payload.y - Math.random()*150, duration: 0.6, ease: 'power2.out' });
              gsap.to(p.scale, { x: 0, y: 0, duration: 0.6 });
              gsap.to(p, { rotation: Math.random()*Math.PI*4, duration: 0.6, onComplete: () => p.destroy() });
            });
          }
          const gate = viewport.getChildAt(0).children.find(c => (c as any).label === payload.gateId);
          if (gate) {
            import('gsap').then(({ gsap }) => {
              gsap.fromTo(gate.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.4, ease: 'bounce.out' });
            });
          }
        } else if (type === 'WIND_ON' || type === 'WIND_OFF') {
          // Not strictly required since graphics loop handles it
        } else if (type === 'SKILL_FIRED') {
          // ═══════════════════════════════════════════════════════════════════
          // ██ PROTECTED: 완주자의 스킬 발동은 UI에서도 이중 차단 ██
          // 워커에서 1차 필터링하지만, 타이밍 이슈 대비 UI에서도 확인합니다.
          // finishedFeedRef에 해당 chipId가 있으면 이미 완주한 사람이므로 무시합니다.
          // ⚠️ DO NOT MODIFY: 사용자 요청에 의해 영구 고정된 로직입니다.
          // ═══════════════════════════════════════════════════════════════════
          const isAlreadyFinished = finishedFeedRef.current.some((f: any) => f.survivor?.id === payload.chipId);
          if (isAlreadyFinished) {
            // 완주자 스킬은 로그에 기록하지 않음
          } else {
          // ── 스킬 발동 → 로그에 기록 (중앙 팝업/슬로모션 없음) ──
          const firedSurvivor = survivors.find(s => s.id === payload.chipId);
          const playerName = firedSurvivor?.name || payload.chipId;
          const playerColor = firedSurvivor?.color || '#ffffff';
          const message = generateSkillMessage(playerName, payload.skill);
          addSkillLog({
            id: `${payload.chipId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            chipId: payload.chipId,
            playerName,
            playerColor,
            skill: payload.skill,
            message,
            timestamp: Date.now(),
          });
          // ── 발동 연출: 스킬별 사운드 + 카메라 셰이크 + 진동 ──
          const skillX = graphicsMap.get(payload.chipId)?.position.x ?? 400;
          // 🎧 스킬 사운드 트리거 (isSkill = true 로 더킹 효과 발생)
          soundManager.playSfx(`skill_${payload.skill}`, 0, skillX, true);

          // 임팩트 차등 셰이크. teleport는 위치 점프를 "연출"로 가리는 보정 역할도 겸함.
          const SKILL_SHAKE: Record<string, number> = {
            teleport: 12, tank: 11, booster: 8, magnet: 6, ghost: 4, slime: 4,
          };
          cameraDirector?.addShake(SKILL_SHAKE[payload.skill] ?? 6);

          // 스킬별 진동 패턴
          const SKILL_VIBE: Record<string, number[]> = {
            teleport: [30, 40, 30], tank: [80], booster: [20, 20, 20],
            magnet: [50], ghost: [15, 30], slime: [60],
          };
          if (navigator.vibrate) navigator.vibrate(SKILL_VIBE[payload.skill] ?? 50);

          // VFX 적용
          applySkillVFX(payload.chipId, payload.skill);
          }
        } else if (type === 'SKILL_EXPIRED') {
          // VFX 해제
          removeSkillVFX(payload.chipId);
        } else if (type === 'COOLDOWN_UPDATE') {
          // ── 워커에서 보내온 개별 쿨타임 진행률을 store에 반영 ──
          setSkillCooldowns(payload);
        } else if (type === 'RANKINGS_UPDATE') {
          currentRankings = payload;
          setRankings(payload);
        } else if (type === 'CHIP_FINISHED') {
          // 개별 피니셔 포커싱 & 카메라 셰이크 ("핵심 순간만" 슬로우/락온; 그 외엔 가벼운 펀치)
          const finishRank: number = payload.rank;
          cameraDirector?.focusNextFinisher(payload.chipId, isWinnerRank(finishRank));
          cameraDirector?.addShake(15);
          // 다음 완주자가 우승 슬롯인지 갱신 → 결승 직전 슬로우 연출 재무장 여부 결정
          cameraDirector?.setDrama(isWinnerRank(finishRank + 1));
          
          setFinishedFeed(prev => {
            const currentCount = prev.length + 1; // 현재 들어온 사람의 등수 (대략적 추정)
            
            // 실제 등수 확인 시도 (currentRankings 우선)
            let rank = currentRankings.findIndex(r => r.id === payload.chipId) + 1;
            if (rank === 0) rank = currentCount;

            // 시각 효과 연출 (GSAP, PIXI)
            if (viewport && app && payload.position) {
              // 1. 파티클 폭발 효과
              for (let i = 0; i < 12; i++) {
                const particle = new PIXI.Graphics();
                particle.circle(0, 0, Math.random() * 8 + 4);
                
                let pColor = 0xffffff;
                if (rank === 1) pColor = 0xFFD700;
                else if (rank === 2) pColor = 0xC0C0C0;
                else if (rank === 3) pColor = 0xCD7F32;
                else pColor = payload.survivor?.color || 0xffffff;
                
                particle.fill({ color: pColor, alpha: 1 });
                particle.position.set(payload.position.x, payload.position.y);
                viewport.addChild(particle);

                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 150 + 50;
                const tx = payload.position.x + Math.cos(angle) * speed;
                const ty = payload.position.y + Math.sin(angle) * speed;

                import('gsap').then(({ gsap }) => {
                  gsap.to(particle.position, {
                    x: tx, y: ty, duration: 0.6 + Math.random() * 0.4, ease: 'power2.out'
                  });
                  gsap.to(particle.scale, {
                    x: 0, y: 0, duration: 0.6 + Math.random() * 0.4, ease: 'power2.in'
                  });
                  gsap.to(particle, {
                    alpha: 0, duration: 0.6 + Math.random() * 0.4, ease: 'power2.in',
                    onComplete: () => particle.destroy()
                  });
                });
              }

              // 2. 순위 타이포그래피 (텍스트 팝업)
              let rankText = `${rank}th`;
              if (rank === 1) rankText = '1st!';
              else if (rank === 2) rankText = '2nd!';
              else if (rank === 3) rankText = '3rd!';

              let textColor = '#ffffff';
              if (rank === 1) textColor = '#FFD700'; // 금
              else if (rank === 2) textColor = '#C0C0C0'; // 은
              else if (rank === 3) textColor = '#CD7F32'; // 동

              import('pixi.js').then((PIXI) => {
                const textObj = new PIXI.Text({
                  text: rankText,
                  style: {
                    fontFamily: 'Impact, sans-serif',
                    fontSize: 64,
                    fill: textColor,
                    stroke: { color: '#000000', width: 6 },
                    dropShadow: { alpha: 0.5, angle: Math.PI / 6, blur: 4, color: 0x000000, distance: 6 }
                  }
                });
                textObj.anchor.set(0.5);
                textObj.position.set(payload.position.x, payload.position.y - 40);
                textObj.scale.set(0);
                viewport.addChild(textObj);

                import('gsap').then(({ gsap }) => {
                  gsap.to(textObj.scale, {
                    x: 1, y: 1, duration: 0.4, ease: 'back.out(1.7)'
                  });
                  gsap.to(textObj.position, {
                    y: payload.position.y - 150, duration: 1.5, ease: 'power1.out'
                  });
                  gsap.to(textObj, {
                    alpha: 0, duration: 0.5, delay: 1.0, onComplete: () => textObj.destroy()
                  });
                });
              });
            }
            
            return [...prev, payload];
          });
        } else if (type === 'GAME_OVER') {
          // ═══════════════════════════════════════════════════════════════════
          // ██ PROTECTED: 우승자 판정 ≠ 경기 종료 ██
          // GAME_OVER는 "우승자 확정"이지 "경기 종료"가 아닙니다.
          // 'winner_declared' 상태로 전환하여 Victory 배너를 표시하되,
          // 물리 시뮬레이션과 스킬 시스템은 계속 동작합니다.
          // 'all_finished'로의 전환은 전원 완주(ALL_FINISHED) 시에만 발생합니다.
          // ⚠️ DO NOT MODIFY: 사용자 요청에 의해 영구 고정된 로직입니다.
          // ═══════════════════════════════════════════════════════════════════
          setGameState('winner_declared');
          setGameOverResult(payload);
          triggerShockwave();
        } else if (type === 'ALL_FINISHED') {
          // ═══════════════════════════════════════════════════════════════════
          // ██ PROTECTED: 전원 완주 → 경기 최종 종료 ██
          // 모든 참가자가 결승선을 통과한 후에만 'all_finished' 상태로 전환합니다.
          // 화면은 그대로 유지되며, 단지 물리 STEP 전송이 중단될 뿐입니다.
          // 스킬 로그와 Victory 배너는 유지되며, 움직이는 요소만 없어집니다.
          // ⚠️ DO NOT MODIFY: 사용자 요청에 의해 영구 고정된 로직입니다.
          // ═══════════════════════════════════════════════════════════════════
          setGameState('all_finished');
        }
      };

      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'INIT',
          payload: {
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            customMapData,
            customMapMeta, // PRD v6.0: Share code custom map meta
            presetMeta, // DB에서 Fetch된 실제 맵 메타데이터를 통째로 전달
            gimmickDensity,
            survivors,
            targetCount: targetWinnerCount,
            mode: gameMode,
            customRank: customWinningRank,
            randomRanks: randomWinningRanks,
            isSkillEnabled,
            selectedMapPreset
          }
        });
      }
    }

    initPromise = initPixi();

    return () => {
      isMounted = false;
      // VFX 자원 정리: gsap 트윈, ticker 콜백 등 GC 불가 자원 해제
      activeVFXMap.forEach((vfx) => { try { vfx.cleanup(); } catch {} });
      activeVFXMap.clear();

      // editorStore 실시간 구독 해제
      if (app && (app as any)._editorUnsub) {
        (app as any)._editorUnsub();
      }

      if (typeof window !== 'undefined' && app) {
        if ((app as any)._bgResizeHandler) {
          window.removeEventListener('resize', (app as any)._bgResizeHandler);
        }
        if ((app as any)._minimapResizeHandler) {
          window.removeEventListener('resize', (app as any)._minimapResizeHandler);
        }
        if ((app as any)._minimapInputCleanup) {
          (app as any)._minimapInputCleanup();
        }
        if ((app as any)._zoomInputCleanup) {
          (app as any)._zoomInputCleanup();
        }
        if ((app as any)._pointerUpHandler) {
          window.removeEventListener('pointerup', (app as any)._pointerUpHandler);
        }
      }
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'STOP' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      intervals.forEach(i => clearInterval(i));
      tickers.forEach(t => app.ticker.remove(t));
      itemDisposers.forEach(d => { try { d() } catch {} });
      if (initPromise) {
        initPromise.then(() => {
          if (viewport) viewport.destroy();
          if (pipViewport) pipViewport.destroy();
          if (app) {
            try {
              if (app.canvas && app.canvas.parentNode) {
                app.canvas.parentNode.removeChild(app.canvas);
              }
              app.destroy(true);
            } catch (e) {
              console.error("PIXI destroy error:", e);
            }
          }
        });
      }
    }
  }, [survivors, targetWinnerCount, gimmickDensity, setSurvivors, setGameStage, customMapData, gameMode, customWinningRank, isSkillEnabled, randomWinningRanks])
  const getOrdinalSuffix = (n: number) => {
    const v = n % 100;
    if (v >= 11 && v <= 13) return `${n}TH`;
    const lastDigit = n % 10;
    if (lastDigit === 1) return `${n}ST`;
    if (lastDigit === 2) return `${n}ND`;
    if (lastDigit === 3) return `${n}RD`;
    return `${n}TH`;
  };

  const getRankText = (mode: string, idx: number) => {
    if (mode === 'custom') {
      return getOrdinalSuffix(customWinningRank);
    }
    if (mode === 'random') {
      const sortedRanks = [...randomWinningRanks].sort((a, b) => a - b);
      const rank = sortedRanks[idx] || (idx + 1);
      return getOrdinalSuffix(rank);
    }
    if (mode === 'turtle') {
      return '꼴등!';
    }
    return getOrdinalSuffix(idx + 1);
  };

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden ${isBroadcasterMode ? 'bg-[#00ff00]' : 'bg-black'}`}>

      <LiveLeaderboard rankings={rankings} finishedFeed={finishedFeed} />

      <div className="absolute bottom-6 left-6 z-50 flex gap-4">
        <button 
          onClick={() => setGameStage('dashboard')}
          className={`glass-panel-heavy text-white font-bold px-6 py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group w-48 ${
            (gameState === 'winner_declared' || gameState === 'all_finished')
              ? 'animate-bounce shadow-[0_0_25px_rgba(255,255,255,0.6)] border-2 border-white bg-white/20 hover:bg-white/30'
              : 'hover:bg-white/10 shadow-lg border border-white/10'
          }`}
        >
          <span className="group-hover:-translate-x-1 transition-transform">🚪</span> 로비로 복귀
        </button>
      </div>

      {(gameState === 'winner_declared' || gameState === 'all_finished') && gameOverResult && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-in slide-in-from-top fade-in duration-700 pointer-events-none w-full max-w-md">
          {/* Stardust Particles (Phase 3) */}
          <div className="absolute inset-0 pointer-events-none overflow-visible z-[-1]">
            {[...Array(15)].map((_, i) => (
              <div 
                key={i} 
                className="stardust-particle" 
                style={{ 
                  left: `${Math.random() * 120 - 10}%`, 
                  top: `${100 + Math.random() * 50}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2.5 + Math.random() * 2}s`
                }} 
              />
            ))}
          </div>
          <h2 className="animate-victory-pulse font-black text-6xl tracking-tighter text-[#FFD700] mb-2 drop-shadow-[0_0_15px_rgba(255,215,0,0.5)] text-center">
            {gameMode === 'random' ? (gameOverResult.winners.length === 1 ? 'Lucky Winner!' : 'Lucky Winners!') :
             (gameOverResult.winners.length === 1 ? 'Victory!' : 'Top Survivors!')}
          </h2>
          <span className="text-white/90 text-xl font-bold mb-6 tracking-widest drop-shadow-md bg-black/40 px-4 py-1 rounded-full border border-white/20">
            {gameMode === 'speed' ? '스피드 레이스' : 
             gameMode === 'turtle' ? '거북이 레이스' : 
             gameMode === 'custom' ? '커스텀 레이스' : 
             gameMode === 'random' ? '랜덤 레이스' : gameMode}
          </span>
          <div className="flex flex-col items-center gap-3 w-full bg-black/60 backdrop-blur-md px-6 py-6 rounded-3xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.8)] pointer-events-auto">
            {gameOverResult.winners.map((w: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between w-full gap-4 px-2 py-2 border-b border-white/5 last:border-0">
                <span className={`text-2xl font-black w-20 text-center whitespace-nowrap ${idx === 0 ? 'text-[#FFD700]' : idx === 1 ? 'text-[#C0C0C0]' : idx === 2 ? 'text-[#CD7F32]' : 'text-white/50'}`}>
                  {getRankText(gameMode, idx)}
                </span>
                <div className="w-8 h-8 rounded-full shadow-[0_0_15px_currentColor] border-[2px] border-white/40 shrink-0" style={{ backgroundColor: w.color, color: w.color }}></div>
                <span className="text-2xl font-black truncate flex-1 text-left" style={{ color: w.color || '#fff' }}>
                  {w.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 랜덤 레이스: 게임 시작 직후 당첨 등수를 화면 중앙에 팝업으로 공개 */}
      {showRandomPopup && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="bg-black/80 backdrop-blur-md px-12 py-8 rounded-3xl border border-orange-500/30 shadow-[0_0_40px_rgba(249,115,22,0.3)] animate-in zoom-in fade-in duration-500 text-center">
            <p className="text-white/80 text-2xl font-bold mb-3">🎲 이번 레이스 승자는</p>
            <p className="text-[#FFD700] text-5xl font-black drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]" style={{ textShadow: '0 0 10px #FFD700' }}>
              {randomWinningRanks.map(r => `${r}등`).join(', ')}
            </p>
            <p className="text-white/80 text-2xl font-bold mt-3">입니다</p>
          </div>
        </div>
      )}

      {/* 실시간 타겟 랭크 상시 안내 (Custom / Random Mode) */}
      {gameState === 'playing' && (gameMode === 'custom' || gameMode === 'random') && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-1000 delay-1000 fill-mode-both">
          <div className="bg-black/50 backdrop-blur-md px-6 py-2 rounded-full border border-[#00ffcc]/20 shadow-[0_0_20px_rgba(0,255,204,0.15)] flex items-center gap-3">
            <span className="text-white/70 text-sm font-bold tracking-widest uppercase">Target Rank</span>
            <span className="text-[#00ffcc] text-xl font-black drop-shadow-[0_0_10px_rgba(0,255,204,0.8)] tabular-nums">
              {gameMode === 'custom' ? `${customWinningRank}TH` : randomWinningRanks.map(r => `${r}TH`).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* 2배속 안내 오버레이 */}
      {isFastForward && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex flex-col items-center animate-in slide-in-from-top-4 fade-in duration-200">
          <div className="flex items-center gap-2 bg-[#ff0055]/20 backdrop-blur-md px-6 py-2 rounded-full border-2 border-[#ff0055] shadow-[0_0_20px_rgba(255,0,85,0.8)]">
            <span className="text-[#ff0055] font-black text-2xl tracking-widest drop-shadow-[0_0_8px_rgba(255,0,85,1)]">
              2배속
            </span>
            <span className="text-[#ff0055] font-black text-2xl tracking-tighter drop-shadow-[0_0_8px_rgba(255,0,85,1)] animate-pulse">
              {">>>"}
            </span>
          </div>
        </div>
      )}

      {/* 일시정지 오버레이 */}
      {isPaused && (
        <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex flex-col items-center justify-center bg-black/40 px-12 py-8 rounded-3xl border border-white/20 shadow-[0_0_40px_rgba(255,255,255,0.1)]">
            <div className="flex gap-4 mb-4">
              <div className="w-4 h-16 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]"></div>
              <div className="w-4 h-16 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]"></div>
            </div>
            <h2 className="text-white font-black text-4xl tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
              PAUSED
            </h2>
            <p className="text-white/60 font-bold mt-4 animate-pulse">
              스페이스바를 눌러 재개합니다
            </p>
          </div>
        </div>
      )}

      {/* 메인 하단 독 (Dock) - PRD 반영 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-black/40 backdrop-blur-xl border border-white/10 px-4 py-3 rounded-[2rem] shadow-[0_4px_30px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all duration-700 ease-in-out">
        
        {/* 그룹 1: 게임 설정 (게임 시작 시 숨김 처리) */}
        <div className={`flex items-center gap-3 overflow-hidden transition-all duration-700 ease-in-out origin-left ${gameState !== 'idle' ? 'max-w-[0px] opacity-0 m-0 p-0 !gap-0' : 'max-w-[600px] opacity-100'}`}>
          
          {/* 맵 교체 버튼 및 드롭업 */}
          <div className="relative">
            {/* Click-away backdrop */}
            {isMapMenuOpen && (
              <div 
                className="fixed inset-0 z-[90] cursor-default" 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMapMenuOpen(false);
                }}
              ></div>
            )}

            <button 
              onClick={() => setIsMapMenuOpen(!isMapMenuOpen)}
              className="relative z-[95] flex items-center gap-2 px-5 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:-translate-y-[2px] hover:shadow-[0_10px_20px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all group"
            >
              <MapIcon className="w-[18px] h-[18px] text-blue-400 group-hover:text-blue-300 transition-colors" />
              <span className="font-bold text-sm tracking-wide text-gray-200 group-hover:text-white transition-colors">
                {selectedMapPreset === 'random' ? '랜덤 맵' : ((mapDataCache && mapDataCache[selectedMapPreset])?.name || getPresetMeta(selectedMapPreset)?.name || '맵 선택')}
              </span>
              <ChevronUp className={`w-[18px] h-[18px] text-gray-500 group-hover:text-white ml-1 transition-transform ${isMapMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* 드롭업 (팝오버) 메뉴 */}
            {isMapMenuOpen && (
              <div className="absolute bottom-[110%] left-0 mb-2 w-56 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-in slide-in-from-bottom-4 fade-in duration-300 z-[100]">
                <div className="flex flex-col gap-1 max-h-[350px] overflow-y-auto scrollbar-hide">
                  {Object.keys(mapDataCache || MapPresets).map((presetKey) => {
                    const isSelected = selectedMapPreset === presetKey;
                    const meta = (mapDataCache && mapDataCache[presetKey]) || getPresetMeta(presetKey);
                    if (!meta) return null;
                    return (
                      <button
                        key={presetKey}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMapPreset(presetKey);
                          setIsMapMenuOpen(false);
                        }}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${isSelected ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-gray-300 hover:bg-white/10 hover:text-white border border-transparent'}`}
                      >
                        {meta.name}
                        {isSelected && <span className="text-blue-400 text-xs text-shadow-glow">✓</span>}
                      </button>
                    )
                  })}
                  <div className="h-px bg-white/10 my-1 mx-2"></div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMapPreset('random');
                      setIsMapMenuOpen(false);
                    }}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${selectedMapPreset === 'random' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-gray-300 hover:bg-white/10 hover:text-white border border-transparent'}`}
                  >
                    🎲 랜덤 맵
                    {selectedMapPreset === 'random' && <span className="text-purple-400 text-xs text-shadow-glow">✓</span>}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 자리 섞기 버튼 */}
          <button 
            onClick={handleShuffle}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:-translate-y-[2px] hover:shadow-[0_10px_20px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.1)] transition-all group"
          >
            <Dices className="w-[18px] h-[18px] text-pink-400 group-hover:text-pink-300 group-hover:rotate-180 transition-all duration-500" />
            <span className="font-bold text-sm tracking-wide text-gray-200 group-hover:text-white transition-colors">자리 섞기</span>
          </button>

          {/* 게임 시작 버튼 */}
          <button 
            onClick={handleStart}
            disabled={!isWorkerReady}
            className={`flex items-center gap-2 px-8 py-3 rounded-full ml-1 bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all group ${!isWorkerReady ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-[2px] hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.6),inset_0_1px_0_rgba(255,255,255,0.3)]'}`}
          >
            {isWorkerReady ? (
              <>
                <Rocket className="w-[18px] h-[18px] text-white group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                <span className="font-bold tracking-widest text-sm text-white drop-shadow-md">게임 시작</span>
              </>
            ) : (
              <span className="font-bold tracking-widest text-sm text-white drop-shadow-md">엔진 로딩중...</span>
            )}
          </button>
          
          {/* 구분선 */}
          <div className="w-px h-8 bg-white/10 mx-1 rounded-full"></div>
        </div>

        {/* 그룹 2: 게임 진행 컨트롤 (항상 노출됨) */}
        <div className="flex items-center gap-2">
          {/* BGM 토글 */}
          <button 
            onClick={handleToggleBgm}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:-translate-y-[2px] hover:shadow-[0_10px_20px_rgba(0,0,0,0.2)] transition-all group"
            title="BGM 끄기/켜기"
          >
            {!isMuted ? 
              <Music4 className="w-[22px] h-[22px] text-emerald-400 group-hover:text-emerald-300 transition-colors" /> :
              <VolumeX className="w-[22px] h-[22px] text-gray-500 group-hover:text-gray-400 transition-colors" />
            }
          </button>

          {/* 일시정지 / 재생 */}
          <button 
            onClick={handleTogglePause}
            className="w-12 h-12 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 hover:-translate-y-[2px] hover:shadow-[0_10px_20px_rgba(0,0,0,0.2)] transition-all group"
            title="일시정지/재생"
          >
            {isPaused ? 
              <Play className="w-[22px] h-[22px] text-amber-400 group-hover:text-amber-300 transition-colors ml-1" /> :
              <Pause className="w-[22px] h-[22px] text-amber-400 group-hover:text-amber-300 transition-colors" />
            }
          </button>

          {/* 2배속 */}
          <button 
            onClick={handleToggleFastForward}
            className={`w-12 h-12 flex items-center justify-center rounded-full border transition-all group ${isFastForward ? 'bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'bg-white/5 border-white/10 hover:bg-white/10 hover:-translate-y-[2px] hover:shadow-[0_10px_20px_rgba(0,0,0,0.2)]'}`}
            title="2배속 설정"
          >
            <FastForward className={`w-[22px] h-[22px] transition-colors ${isFastForward ? 'text-cyan-300' : 'text-cyan-400 group-hover:text-cyan-300'}`} />
          </button>
        </div>

      </div>



      {/* Main Render Target */}
      <div 
        ref={containerRef} 
        className="w-full h-full flex items-center justify-center pointer-events-auto"
      />
    </div>
  )
}
