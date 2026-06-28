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
import { Hand, Volume2, VolumeX, Maximize, Video } from 'lucide-react'
import gsap from 'gsap'
import { GlowFilter, MotionBlurFilter, ShockwaveFilter, ColorOverlayFilter } from 'pixi-filters'
import { getPresetMeta, MapPresets } from '@/engine/MapPresets'
import { CameraDirector } from './cameraDirector'
// 맵 가로 폭은 고정 (물리엔진·카메라·미니맵 공유)
const WORLD_WIDTH = 800;
// WORLD_HEIGHT는 맵 프리셋에 따라 동적으로 결정됨 (기본값 2400)

export default function PhysicsCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [rankings, setRankings] = useState<ParticipantRank[]>([])
  const [isMuted, setIsMuted] = useState(false)
  const [finishedFeed, setFinishedFeed] = useState<{ rank: number, survivor: any }[]>([])
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'finished'>('idle')
  const gameStateRef = useRef(gameState)
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);
  const [gameOverResult, setGameOverResult] = useState<{winners: any[], mode: string} | null>(null)
  const [showRandomPopup, setShowRandomPopup] = useState(false)
  
  const { survivors, setSurvivors, targetWinnerCount, gameMode, customWinningRank, gimmickDensity, selectedMapPreset, isSkillEnabled, addSkillLog, setSkillCooldowns, clearSkillLogs, randomWinningRanks } = useGameStore()
  const { setGameStage, customMapData, isBroadcasterMode, gameTitle } = useUIStore()
  const workerRef = useRef<Worker | null>(null)
  

  
  // WebGL Filters ref
  const shockwaveRef = useRef<any>(null)
  const triggerShockwave = useCallback(() => {
    if (shockwaveRef.current) {
      shockwaveRef.current.time = 0;
      shockwaveRef.current.enabled = true;
    }
  }, [])

  const handleNudge = useCallback(() => {
    if (workerRef.current && gameState === 'playing') {
      workerRef.current.postMessage({ type: 'NUDGE', payload: { force: 200 } });
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }, [gameState])

  const handleStart = useCallback(() => {
    if (workerRef.current && gameState === 'idle') {
      clearSkillLogs(); // 새 게임 시작 시 이전 스킬 로그 초기화
      workerRef.current.postMessage({ type: 'START' });
      setGameState('playing');
    }
  }, [gameState, clearSkillLogs])

  const handleShuffle = useCallback(() => {
    if (workerRef.current && gameState === 'idle') {
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
    let minimapScreenRect = { x: 20, y: 0, w: 0, h: 0, scale: 1 };
    
    // Skill VFX Map
    const activeVFXMap = new Map<string, { cleanup: () => void }>();
    let intervals: ReturnType<typeof setInterval>[] = [];
    let tickers: Array<(ticker: PIXI.Ticker) => void> = [];
    
    // 'random' 맵 처리 로직: 10개 맵 중 하나를 무작위로 선택
    const actualMapPreset = selectedMapPreset === 'random' ? 
      Object.keys(MapPresets)[Math.floor(Math.random() * Object.keys(MapPresets).length)] : 
      selectedMapPreset;
      
    // 맵 프리셋에 따른 동적 월드 높이 결정
    const presetMeta = actualMapPreset ? getPresetMeta(actualMapPreset) : null;
    const WORLD_HEIGHT = presetMeta ? presetMeta.worldHeight : 2400;
    let initPromise: Promise<void> | null = null;
    
    const initPixi = async () => {
      try {
        app = new PIXI.Application();
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

        // Preload Assets
        const texturesToLoad = [
          ...(presetMeta?.bgImage ? [presetMeta.bgImage] : []),
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

        app.stage.addChild(viewport);
        
        // 맵별 배경 이미지 렌더링 (viewport 내부에 붙여 스크롤/줌 연동)
        const bgUrl = presetMeta?.bgImage;
        if (bgUrl) {
          const bgTex = PIXI.Assets.get(bgUrl);
          if (bgTex) {
            // wallStyle에 따른 배경 배치 및 너비 결정
            const wallStyle = presetMeta?.wallStyle || 'straight';
            let visibleWidth = 800;
            let bgX = 0;
            
            if (wallStyle === 'narrow') {
              visibleWidth = 600;
              bgX = 100;
            } else if (wallStyle === 'wide') {
              visibleWidth = 900;
              bgX = -50;
            }
            
            // 카메라가 이동 가능한 전체 범위를 빈틈없이 커버
            const BG_PAD_TOP = 500;    // clamp top: -500
            const BG_PAD_BOTTOM = 200; // clamp bottom: WORLD_HEIGHT + 200
            const totalHeight = BG_PAD_TOP + WORLD_HEIGHT + BG_PAD_BOTTOM;

            // TilingSprite: 이미지를 원본 비율로 반복 배치 (늘어짐 없음)
            bgSprite = new PIXI.TilingSprite({
              texture: bgTex,
              width: visibleWidth,
              height: totalHeight,
            });

            // 가시 너비에 맞게 타일 스케일 설정 (가로=맵 너비, 세로=비율 유지)
            const scale = visibleWidth / bgTex.width;
            (bgSprite as PIXI.TilingSprite).tileScale.set(scale, scale);

            bgSprite.x = bgX;
            bgSprite.y = -BG_PAD_TOP; // 카메라 상단 한계점부터 시작
            bgSprite.alpha = 0.4;
            
            viewport.addChildAt(bgSprite, 0); // 제일 바닥에 렌더링
          }
        }
        viewport.drag().pinch().wheel().decelerate()
          .clamp({ left: -200, right: WORLD_WIDTH + 200, top: -500, bottom: WORLD_HEIGHT + 200, underflow: 'center' }); // clamp bounds
        
        // 사용자가 직접 화면을 조작하면 카메라 디렉터를 수동 모드로(잠시 후 자동 복귀)
        viewport.on('drag-start', () => cameraDirector?.notifyUserPan());
        viewport.on('wheel', () => cameraDirector?.notifyUserPan());
        viewport.on('pinch-start', () => cameraDirector?.notifyUserPan());

        // 줌 제어는 카메라 디렉터가 단독 소유(clampZoom 플러그인은 시네마틱 줌과 충돌하므로 미사용)
        viewport.moveCenter(400, 200);

        // 스마트 카메라 디렉터 생성 (뷰포트 + 화면/월드 크기 + 슬로모션 콜백)
        cameraDirector = new CameraDirector(viewport, {
          worldWidth: WORLD_WIDTH,
          worldHeight: WORLD_HEIGHT,
          screenW: window.innerWidth,
          screenH: window.innerHeight,
          setTimeScale: (scale: number) => workerRef.current?.postMessage({ type: 'SET_TIME_SCALE', payload: { scale } }),
        });

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
        minimapBg.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
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
          return { x: (sx - r.x) / r.scale, y: (sy - r.y) / r.scale };
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
          // Calculate max height to avoid overlapping with top-left Winner UI (approx 450px)
          const WINNER_UI_HEIGHT = 450;
          const BOTTOM_MARGIN = 120;
          const maxMinimapHeight = h - WINNER_UI_HEIGHT - BOTTOM_MARGIN;
          
          let currentMinimapHeight = baseMinimapHeight;
          let currentMinimapWidth = baseMinimapWidth;
          
          if (currentMinimapHeight > maxMinimapHeight) {
            currentMinimapHeight = Math.max(maxMinimapHeight, 200); // minimum 200px
            currentMinimapWidth = currentMinimapHeight * (WORLD_WIDTH / WORLD_HEIGHT);
          }

          const pipY = h - currentMinimapHeight - BOTTOM_MARGIN;
          
          pipViewport.resize(currentMinimapWidth, currentMinimapHeight, WORLD_WIDTH, WORLD_HEIGHT);
          pipViewport.scale.set(currentMinimapHeight / WORLD_HEIGHT);

          pipMask.clear();
          pipMask.roundRect(20, pipY, currentMinimapWidth, currentMinimapHeight, 16);
          pipMask.fill(0xffffff);
          
          pipBorder.clear();
          pipBorder.roundRect(20, pipY, currentMinimapWidth, currentMinimapHeight, 16);
          pipBorder.stroke({ width: 2, color: 0x00ffcc, alpha: 0.8 });
          
          pipViewport.position.set(20, pipY);
          // 윈도우 레벨 미니맵 클릭 처리를 위한 화면 사각형/스케일 저장
          minimapScreenRect = { x: 20, y: pipY, w: currentMinimapWidth, h: currentMinimapHeight, scale: currentMinimapHeight / WORLD_HEIGHT };
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

      const applySkillVFX = (chipId: string, skill: string) => {
        const container = graphicsMap.get(chipId);
        if (!container) return;

        // 기존 이펙트 정리
        removeSkillVFX(chipId);

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
          activeChipsCount = payload.activeChipsCount;

          // 랜덤 레이스: 게임 초기화 완료 시 당첨 등수 팝업을 3초간 표시
          if (gameMode === 'random' && randomWinningRanks.length > 0) {
            setShowRandomPopup(true);
            setTimeout(() => setShowRandomPopup(false), 3000);
          }
          
          if (payload.mapData) {
            const staticContainer = new PIXI.Container();
            viewport.addChildAt(staticContainer, 0);

            // Minimap static layer
            minimapStatic = new PIXI.Container();
            pipViewport.addChildAt(minimapStatic, 1);

            payload.mapData.forEach((item: any) => {
              const g = new PIXI.Container();
              const mg = new PIXI.Graphics(); // Minimap Graphic

              if (item.type === 'wall') {
                const texture = PIXI.Assets.get('/images/assets/obstacles/obstacle_wall.png') || PIXI.Texture.from('/images/assets/obstacles/obstacle_wall.png');
                const sprite = new PIXI.TilingSprite({
                  texture: texture,
                  width: item.w || 100,
                  height: item.h || 20,
                });
                sprite.anchor.set(0.5);
                g.addChild(sprite);

                mg.rect(-item.w / 2, -item.h / 2, item.w, item.h);
                mg.fill({ color: 0x8888aa, alpha: 0.5 });
              } else if (item.type === 'pin') {
                const sprite = PIXI.Sprite.from('/images/assets/obstacles/obstacle_pin.png');
                sprite.anchor.set(0.5);
                sprite.width = (item.radius || 15) * 2.5;
                sprite.height = (item.radius || 15) * 2.5;
                g.addChild(sprite);

                mg.circle(0, 0, item.radius || 15);
                mg.fill({ color: 0x00ffcc, alpha: 0.7 });
              } else if (item.type === 'bumper') {
                const sprite = PIXI.Sprite.from('/images/assets/obstacles/obstacle_bumper.png');
                sprite.anchor.set(0.5);
                sprite.width = (item.radius || 15) * 2.5;
                sprite.height = (item.radius || 15) * 2.5;
                g.addChild(sprite);

                mg.circle(0, 0, item.radius || 15);
                mg.fill({ color: 0xffaa55, alpha: 0.8 });
              } else if (item.type === 'booster') {
                const sprite = PIXI.Sprite.from('/images/assets/obstacles/obstacle_booster.png');
                sprite.anchor.set(0.5);
                sprite.width = 60;
                sprite.height = 60;
                g.addChild(sprite);

                mg.rect(-25, -25, 50, 50);
                mg.fill({ color: 0x55ff55, alpha: 0.8 });
              } else if (item.type === 'windmill') {
                const sprite = PIXI.Sprite.from('/images/assets/obstacles/obstacle_windmill.png');
                sprite.anchor.set(0.5);
                sprite.width = 110;
                sprite.height = 110;
                g.addChild(sprite);

                const speed = item.speed || 3;
                const windTick = (ticker: PIXI.Ticker) => {
                  if (g.destroyed || mg.destroyed) return;
                  g.rotation += speed * (ticker.deltaMS / 1000);
                  mg.rotation += speed * (ticker.deltaMS / 1000);
                };
                app.ticker.add(windTick);
                tickers.push(windTick);
                mg.rect(-50, -5, 100, 10);
                mg.rect(-5, -50, 10, 100);
                mg.fill({ color: 0x00ffff, alpha: 0.6 });
              } else if (item.type === 'blackhole' || item.type === 'whitehole') {
                const isWhite = item.type === 'whitehole';
                const r = item.radius || 100;
                const sprite = PIXI.Sprite.from(isWhite ? '/images/assets/obstacles/obstacle_whitehole.png' : '/images/assets/obstacles/obstacle_blackhole.png');
                sprite.anchor.set(0.5);
                sprite.width = r * 2.5;
                sprite.height = r * 2.5;
                if (isWhite) sprite.blendMode = 'add';
                g.addChild(sprite);

                import('gsap').then(({ gsap }) => {
                  gsap.to(sprite, { rotation: Math.PI * 2 * (isWhite ? -1 : 1), duration: 6, repeat: -1, ease: 'none' });
                });
              } else if (item.type === 'portal') {
                const r = item.radius || 40;
                const sprite = PIXI.Sprite.from('/images/assets/obstacles/obstacle_portal.png');
                sprite.anchor.set(0.5);
                sprite.width = r * 2.5;
                sprite.height = r * 2.5;
                if (item.color) sprite.tint = parseInt(item.color.replace('#', '0x'));
                sprite.blendMode = 'add';
                g.addChild(sprite);

                import('gsap').then(({ gsap }) => {
                  gsap.to(sprite, { rotation: Math.PI * 2, duration: 5, repeat: -1, ease: 'none' });
                  gsap.to(sprite.scale, { x: 1.1, y: 1.1, duration: 1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
                });

                mg.circle(0, 0, r * 1.5);
                if (item.color) mg.fill({ color: parseInt(item.color.replace('#', '0x')), alpha: 0.6 });
                else mg.fill({ color: 0x8888ff, alpha: 0.6 });
              } else if (item.type === 'hole') {
                const r = item.radius || 30;
                const sprite = PIXI.Sprite.from('/images/assets/obstacles/obstacle_hole.png');
                sprite.anchor.set(0.5);
                sprite.width = r * 2.5;
                sprite.height = r * 2.5;
                g.addChild(sprite);

                import('gsap').then(({ gsap }) => {
                  gsap.to(sprite, { rotation: Math.PI * 2, duration: 4, repeat: -1, ease: 'none' });
                });

                mg.circle(0, 0, r);
                mg.fill({ color: 0xff2222, alpha: 0.7 });
              } else if (item.type === 'piston') {
                const w = item.w || 100;
                const h = item.h || 20;
                const texture = PIXI.Assets.get('/images/assets/obstacles/obstacle_piston.png') || PIXI.Texture.from('/images/assets/obstacles/obstacle_piston.png');
                const sprite = new PIXI.TilingSprite({
                  texture: texture,
                  width: w,
                  height: h,
                });
                sprite.anchor.set(0.5);
                g.addChild(sprite);

                mg.rect(-w / 2, -h / 2, w, h);
                mg.fill({ color: 0xffcc00, alpha: 0.6 });
              }
              
              if (item.type === 'piston' && item.waypointB) {
                const speed = item.speed || 2;
                const ax = item.x, ay = item.y;
                const bx = item.waypointB.x, by = item.waypointB.y;
                let t = 0;
                const pistonTick = (ticker: PIXI.Ticker) => {
                  if (g.destroyed || mg.destroyed) return;
                  t += (ticker.deltaMS * 60 / 1000);
                  const phase = (Math.sin(t * speed * 0.01) + 1) / 2;
                  g.x = ax + (bx - ax) * phase;
                  g.y = ay + (by - ay) * phase;
                  mg.x = ax + (bx - ax) * phase;
                  mg.y = ay + (by - ay) * phase;
                };
                app.ticker.add(pistonTick);
                tickers.push(pistonTick);
              } else {
                g.position.set(item.x, item.y);
                mg.position.set(item.x, item.y);
              }
              
              g.rotation = item.rotation || 0;
              mg.rotation = item.rotation || 0;
              mg.scale.set(1.5);
              minimapStatic.addChild(mg);

              // Provide an ID to the graphic object for animations
              if (item.id) {
                g.label = item.id;
              }
              staticContainer.addChild(g);
            });
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
                const R = 12; // Physics radius
                
                const iconWrapper = new PIXI.Container();
                iconWrapper.label = 'icon';
                container.addChild(iconWrapper);
                
                try {
                  const tex = PIXI.Assets.get(textureUrl);
                  if (tex) {
                    // subtle drop shadow
                    const shadow = new PIXI.Sprite(tex);
                    shadow.anchor.set(0.5);
                    shadow.width = R * 2;
                    shadow.height = R * 2;
                    shadow.tint = 0x000000;
                    shadow.alpha = 0.5;
                    shadow.y = 3;
                    iconWrapper.addChild(shadow);

                    const sprite = new PIXI.Sprite(tex);
                    sprite.anchor.set(0.5); // 완벽한 무결성을 위한 중앙 앵커 정렬
                    sprite.width = R * 2;   // 물리 반경(12)과 스케일 완벽 동기화
                    sprite.height = R * 2;
                    sprite.tint = colNum;   // 참가자 고유 색상 무한 지원
                    iconWrapper.addChild(sprite);
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
                  style: { fill: 0xffffff, fontSize: 14, fontWeight: 'bold', dropShadow: { alpha: 0.8, color: 0x000000, blur: 3, distance: 0 } } 
                });
                text.anchor.set(0.5);
                text.y = -25;
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
                  mDot.circle(0,0, 40); // 1st place is huge and gold
                  mDot.fill(0xffd700);
                  // Add a subtle white outline to 1st place
                  mDot.stroke({ width: 10, color: 0xffffff, alpha: 1 });
                } else {
                  mDot.circle(0,0, 24);
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

          // Update Viewport Indicator — 월드 경계로 clamp 하여 트랙 폭 안의 깔끔한 밴드로 표시
          // (visibleW = innerWidth/zoom 가 트랙 폭 800을 넘쳐 "가로 꽉 찬 박스"가 되던 문제 해결)
          if (viewIndicator) {
            viewIndicator.clear();
            const currentZoom = viewport.scale.x;
            const visibleW = window.innerWidth / currentZoom;
            const visibleH = window.innerHeight / currentZoom;
            const cx = viewport.center.x;
            const cy = viewport.center.y;
            const x0 = Math.max(0, cx - visibleW / 2);
            const x1 = Math.min(WORLD_WIDTH, cx + visibleW / 2);
            const y0 = Math.max(0, cy - visibleH / 2);
            const y1 = Math.min(WORLD_HEIGHT, cy + visibleH / 2);
            const sw = Math.max(2, 8 / currentZoom);
            viewIndicator.rect(x0, y0, x1 - x0, y1 - y0);
            viewIndicator.fill({ color: 0x00ffcc, alpha: 0.12 });
            viewIndicator.stroke({ width: sw, color: 0x00ffcc, alpha: 0.9 });
          }

        } else if (type === 'SOUND_EFFECT') {
          if (payload.type === 'warp') soundManager.playFinish();
          else if (payload.type === 'finish') soundManager.playFinish();
          else if (payload.type === 'bumperHit') {
            soundManager.playBumperHit(payload.impulse, payload.x);
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
          }
          else if (payload.type === 'wallHit') soundManager.playWallHit(payload.impulse, payload.x);
        } else if (type === 'SKILL_FIRED') {
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
          // 가벼운 진동 피드백만 유지 (게임 흐름 방해 없음)
          if (navigator.vibrate) navigator.vibrate(50);
          
          // VFX 적용
          applySkillVFX(payload.chipId, payload.skill);
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
          // 개별 피니셔 포커싱 & 카메라 셰이크
          cameraDirector?.focusNextFinisher(payload.chipId);
          cameraDirector?.addShake(15);
          
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
                  gsap.to(particle, {
                    alpha: 0, scale: { x: 0, y: 0 }, duration: 0.6 + Math.random() * 0.4, ease: 'power2.in',
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
          setGameState('finished');
          setGameOverResult(payload);
          triggerShockwave();
          // 개별 피니셔 로직으로 대체되었으므로 GAME_OVER 시에는 추가 카메라 연출 없이 남은 연출 지속
        }
      };

      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'INIT',
          payload: {
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            customMapData,
            selectedMapPreset: actualMapPreset, // 여기서 실제 맵으로 치환된 값을 보냄
            gimmickDensity,
            survivors,
            targetCount: targetWinnerCount,
            mode: gameMode,
            customRank: customWinningRank,
            randomRanks: randomWinningRanks,
            isSkillEnabled
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

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden ${isBroadcasterMode ? 'bg-[#00ff00]' : 'bg-black'}`}>
      {/* Title Bar Overlay */}
      <div className="absolute top-6 left-6 z-[60] flex flex-col pointer-events-none animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <p className="text-white/60 text-[10px] font-bold tracking-widest uppercase mb-0.5 ml-1">Title</p>
          <h1 className="text-white font-extrabold text-xl tracking-wide drop-shadow-md">
            {gameTitle || '롤링 썬더!'}
          </h1>
        </div>
      </div>

      <LiveLeaderboard rankings={rankings} finishedFeed={finishedFeed} />

      <div className="absolute bottom-6 left-6 z-50 flex gap-4">
        <button 
          onClick={() => setGameStage('dashboard')}
          className={`glass-panel-heavy text-white font-bold px-6 py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group w-48 ${
            gameState === 'finished' 
              ? 'animate-bounce shadow-[0_0_25px_rgba(255,255,255,0.6)] border-2 border-white bg-white/20 hover:bg-white/30'
              : 'hover:bg-white/10 shadow-lg border border-white/10'
          }`}
        >
          <span className="group-hover:-translate-x-1 transition-transform">🚪</span> 로비로 복귀
        </button>
      </div>

      {gameState === 'finished' && gameOverResult && (
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
             (gameOverResult.winners.length === 1 ? 'The Winner!' : 'Top Survivors!')}
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
                <span className={`text-2xl font-black w-16 text-center ${idx === 0 ? 'text-[#FFD700]' : idx === 1 ? 'text-[#C0C0C0]' : idx === 2 ? 'text-[#CD7F32]' : 'text-white/50'}`}>
                  {idx + 1}{idx === 0 ? 'ST' : idx === 1 ? 'ND' : idx === 2 ? 'RD' : 'TH'}
                </span>
                <div className="w-10 h-10 rounded-full shadow-[0_0_15px_currentColor] border-[2px] border-white/40 shrink-0" style={{ backgroundColor: w.color, color: w.color }}></div>
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

      {gameState === 'idle' && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex gap-4 animate-in slide-in-from-bottom fade-in duration-500">
          <button 
            onClick={handleShuffle}
            className="bg-black/50 border border-white/20 hover:border-purple-400 text-purple-300 font-bold px-6 py-4 rounded-2xl transition-all shadow-[0_0_15px_rgba(168,85,247,0.2)] hover:shadow-[0_0_25px_rgba(168,85,247,0.4)] flex items-center gap-2 group backdrop-blur-md"
          >
            <span className="group-hover:rotate-180 transition-transform duration-500">🎲</span> 자리 섞기
          </button>
          <button 
            onClick={handleStart}
            className="bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-black font-extrabold text-xl tracking-widest px-10 py-4 rounded-2xl hover:opacity-90 transition-all shadow-[0_0_30px_var(--accent-primary)] hover:scale-105 flex items-center gap-3 animate-pulse hover:animate-none"
          >
            🚀 게임 시작
          </button>
        </div>
      )}



      {/* Main Render Target */}
      <div 
        ref={containerRef} 
        className="w-full h-full flex items-center justify-center pointer-events-auto"
      />
    </div>
  )
}
