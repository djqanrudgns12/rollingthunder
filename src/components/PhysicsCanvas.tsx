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
import SkillEventOverlay from './SkillEventOverlay'
import { Hand, Volume2, VolumeX, Maximize, Video } from 'lucide-react'
import confetti from 'canvas-confetti'
import { GlowFilter, MotionBlurFilter, ShockwaveFilter } from 'pixi-filters'
import { getPresetMeta } from '@/engine/MapPresets'
// 맵 가로 폭은 고정 (물리엔진·카메라·미니맵 공유)
const WORLD_WIDTH = 800;
// WORLD_HEIGHT는 맵 프리셋에 따라 동적으로 결정됨 (기본값 2400)

export default function PhysicsCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [rankings, setRankings] = useState<ParticipantRank[]>([])
  const [activeSkill, setActiveSkill] = useState<{ chipId: string; skill: string } | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [finishedFeed, setFinishedFeed] = useState<{ rank: number, survivor: any }[]>([])
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'finished'>('idle')
  const [gameOverResult, setGameOverResult] = useState<{winners: any[], mode: string} | null>(null)
  const [isAutoFollow, setIsAutoFollow] = useState(true)
  
  const { survivors, setSurvivors, targetWinnerCount, gameMode, customWinningRank, gimmickDensity, selectedMapPreset } = useGameStore()
  const { setGameStage, customMapData, isBroadcasterMode } = useUIStore()
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
      workerRef.current.postMessage({ type: 'START' });
      setGameState('playing');
    }
  }, [gameState])

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
    let bgSprite: PIXI.Sprite;
    let bgLayers: PIXI.Sprite[] = [];
    const graphicsMap = new Map<string, PIXI.Container>();
    const minimapDotsMap = new Map<string, PIXI.Graphics>();
    let minimapDynamic: PIXI.Container;
    let minimapStatic: PIXI.Container;
    let viewIndicator: PIXI.Graphics;
    let currentRankings: any[] = [];
    
    let activeChipsCount = 0;
    let targetManualPos: { x: number, y: number } | null = null;
    
    // 맵 프리셋에 따른 동적 월드 높이 결정
    const presetMeta = selectedMapPreset && selectedMapPreset !== 'random' ? getPresetMeta(selectedMapPreset) : null;
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

        // Preload Assets — 장애물·칩 모두 절차적 PIXI.Graphics로 렌더링하므로 전체화면 배경만 로드한다.
        const texturesToLoad = [
          '/images/assets/bg_neon_synthwave_ultra.png',
          '/images/assets/bg_abyssal_trench.png',
          '/images/assets/bg_celestial_clockwork.png',
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

        // Background Parallax Layers
        const bgTex1 = PIXI.Assets.get('/images/assets/bg_abyssal_trench.png') || PIXI.Assets.get('/images/assets/bg_neon_synthwave_ultra.png') || PIXI.Texture.WHITE;
        const bgTex2 = PIXI.Assets.get('/images/assets/bg_celestial_clockwork.png') || PIXI.Texture.WHITE;
        
        const layer1 = new PIXI.Sprite(bgTex1);
        layer1.anchor.set(0.5);
        layer1.x = 400; layer1.y = 600;
        layer1.alpha = 0.3;
        
        const layer2 = new PIXI.Sprite(bgTex2);
        layer2.anchor.set(0.5);
        layer2.x = 400; layer2.y = 600;
        layer2.alpha = 0.5;

        const updateBgScale = () => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const s1 = Math.max(w / (bgTex1.width || 1920), (h + 1000) / (bgTex1.height || 1080));
          const s2 = Math.max(w / (bgTex2.width || 1920), (h + 600) / (bgTex2.height || 1080));
          layer1.scale.set(s1);
          layer2.scale.set(s2);
        };
        updateBgScale();
        window.addEventListener('resize', updateBgScale);
        
        // Save cleanup func
        (app as any)._bgResizeHandler = updateBgScale;
        // Depth of field blur for far background
        const blurFilter = new PIXI.BlurFilter();
        blurFilter.blur = 4;
        layer1.filters = [blurFilter];

        app.stage.addChild(layer1);
        app.stage.addChild(layer2);

        // useEffect 스코프 변수에 할당 → 메시지(FRAME) 핸들러에서도 참조 가능
        bgLayers = [layer1, layer2];

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
        viewport.drag().pinch().wheel().decelerate()
          .clamp({ left: -200, right: WORLD_WIDTH + 200, top: -500, bottom: WORLD_HEIGHT + 200, underflow: 'center' }); // clamp bounds
        
        viewport.on('drag-start', () => setIsAutoFollow(false));
        viewport.on('wheel', () => setIsAutoFollow(false));
        viewport.on('pinch-start', () => setIsAutoFollow(false));

        // Clamp zoom
        viewport.clampZoom({ minWidth: 400, maxWidth: 1600 });
        viewport.moveCenter(400, 200);

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
        });

        // PiP Viewport (Minimap / Last place tracker)
        const minimapHeight = 300;
        const minimapWidth = minimapHeight * (WORLD_WIDTH / WORLD_HEIGHT);

        pipViewport = new Viewport({
          screenWidth: minimapWidth,
          screenHeight: minimapHeight,
          worldWidth: WORLD_WIDTH,
          worldHeight: WORLD_HEIGHT,
          events: app.renderer.events
        });
        // Set PiP mask
        const pipMask = new PIXI.Graphics();
        app.stage.addChild(pipMask);
        pipViewport.mask = pipMask;
        pipViewport.scale.set(minimapHeight / WORLD_HEIGHT); // 세로 트랙 전체가 미니맵에 들어오도록 스케일

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
        
        // Interaction (Click & Drag to pan)
        pipViewport.eventMode = 'static';
        const moveCameraTarget = (e: any) => {
          setIsAutoFollow(false);
          const localPos = pipViewport.toLocal(e.global);
          targetManualPos = { x: localPos.x, y: localPos.y };
        };
        pipViewport.on('pointerdown', (e) => {
          (pipViewport as any)._isDraggingMinimap = true;
          moveCameraTarget(e);
        });
        pipViewport.on('pointermove', (e) => {
          if ((pipViewport as any)._isDraggingMinimap) {
            moveCameraTarget(e);
          }
        });
        app.renderer.events.cursorStyles.default = 'auto';
        pipViewport.cursor = 'pointer';
        if (typeof window !== 'undefined') {
          window.addEventListener('pointerup', () => { (pipViewport as any)._isDraggingMinimap = false; });
        }

        // Draw border for PiP
        const pipBorder = new PIXI.Graphics();
        app.stage.addChild(pipBorder);
        app.stage.addChild(pipViewport);

        // Setup minimap resize logic to place it at bottom-left
        const updateMinimapPos = () => {
          const h = window.innerHeight;
          const pipY = h - minimapHeight - 100; // 100 is bottom margin
          
          pipMask.clear();
          pipMask.roundRect(20, pipY, minimapWidth, minimapHeight, 16);
          pipMask.fill(0xffffff);
          
          pipBorder.clear();
          pipBorder.roundRect(20, pipY, minimapWidth, minimapHeight, 16);
          pipBorder.stroke({ width: 2, color: 0x00ffcc, alpha: 0.8 });
          
          pipViewport.position.set(20, pipY);
        };
        updateMinimapPos();
        window.addEventListener('resize', updateMinimapPos);
        (app as any)._minimapResizeHandler = updateMinimapPos; // For cleanup

        // Web Worker Initialization
        workerRef.current = new Worker(new URL('../engine/physics.worker.ts', import.meta.url));
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
      workerRef.current!.onerror = (err) => {
        console.error("Worker error:", err.message, err.filename, err.lineno);
        const errDiv = document.createElement('div');
        errDiv.style.color = 'yellow';
        errDiv.style.position = 'absolute';
        errDiv.style.top = '100px';
        errDiv.style.zIndex = '9999';
        errDiv.innerText = "Worker Error: " + err.message;
        document.body.appendChild(errDiv);
      };

      workerRef.current!.onmessage = (e) => {
        if (!isMounted) return;
        const { type, payload } = e.data;
        
        if (type === 'INIT_DONE') {
          activeChipsCount = payload.activeChipsCount;
          
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
                // 절차적 금속 벽: 본체 + 안쪽 디테일 + 네온 시안 엣지
                const body = new PIXI.Graphics();
                body.rect(-item.w / 2, -item.h / 2, item.w, item.h);
                body.fill({ color: 0x22222a, alpha: 1.0 });
                body.stroke({ width: 3, color: 0x555566, alpha: 1.0 });

                const detail = new PIXI.Graphics();
                detail.rect(-item.w / 2 + 5, -item.h / 2 + 5, item.w - 10, item.h - 10);
                detail.stroke({ width: 1, color: 0x888899, alpha: 0.5 });
                body.addChild(detail);

                // 네온 시안 글로우 엣지(상/하단)
                const edge = new PIXI.Graphics();
                edge.moveTo(-item.w / 2, -item.h / 2); edge.lineTo(item.w / 2, -item.h / 2);
                edge.moveTo(-item.w / 2, item.h / 2); edge.lineTo(item.w / 2, item.h / 2);
                edge.stroke({ width: 2, color: 0x00e5ff, alpha: 0.9 });
                body.addChild(edge);

                g.addChild(body);

                mg.rect(-item.w / 2, -item.h / 2, item.w, item.h);
                mg.fill({ color: 0x8888aa, alpha: 0.5 });
                
                // Add drop shadow
                const shadow = new PIXI.Graphics();
                shadow.rect(-item.w / 2, -item.h / 2, item.w, item.h);
                shadow.fill({ color: 0x000000, alpha: 0.6 });
                shadow.position.set(8, 10);
                g.addChildAt(shadow, 0);
              } else if (item.type === 'pin') {
                // 절차적 핀: 외곽 시안 글로우 + 본체 + 하이라이트
                const glow = new PIXI.Graphics();
                glow.circle(0, 0, item.radius * 1.5);
                glow.fill({ color: 0x00ffcc, alpha: 0.18 });
                g.addChild(glow);

                const body = new PIXI.Graphics();
                body.circle(0, 0, item.radius);
                body.fill({ color: 0x2a2a3a, alpha: 1.0 });
                body.stroke({ width: 2, color: 0x00ffcc, alpha: 1.0 });
                body.circle(-item.radius * 0.3, -item.radius * 0.3, item.radius * 0.3);
                body.fill({ color: 0xaaffee, alpha: 0.5 });
                g.addChild(body);

                const shadow = new PIXI.Graphics();
                shadow.circle(0, 0, item.radius);
                shadow.fill({ color: 0x000000, alpha: 0.7 });
                shadow.position.set(4, 6);
                g.addChildAt(shadow, 0);

                mg.circle(0, 0, item.radius);
                mg.fill({ color: 0x00ffcc, alpha: 0.7 });
              } else if (item.type === 'bumper') {
                // 절차적 범퍼: 플라즈마 글로우 + 본체 + 이중 링(탄성 강조)
                const glow = new PIXI.Graphics();
                glow.circle(0, 0, item.radius * 1.8);
                glow.fill({ color: 0xffaa55, alpha: 0.2 });
                g.addChild(glow);

                const body = new PIXI.Graphics();
                body.circle(0, 0, item.radius);
                body.fill({ color: 0x3a1f1f, alpha: 1.0 });
                body.stroke({ width: 3, color: 0xffaa55, alpha: 1.0 });
                body.circle(0, 0, item.radius * 0.6);
                body.stroke({ width: 2, color: 0xffdd99, alpha: 0.8 });
                body.circle(-item.radius * 0.3, -item.radius * 0.3, item.radius * 0.25);
                body.fill({ color: 0xffeecc, alpha: 0.6 });
                g.addChild(body);

                const shadow = new PIXI.Graphics();
                shadow.circle(0, 0, item.radius * 1.25);
                shadow.fill({ color: 0x000000, alpha: 0.8 });
                shadow.position.set(5, 8);
                g.addChildAt(shadow, 0);

                mg.circle(0, 0, item.radius);
                mg.fill({ color: 0xffaa55, alpha: 0.8 });
              } else if (item.type === 'booster') {
                // 절차적 부스터 패드: 둥근 패드 + 진행방향(+y) 그린 네온 쉐브론 3개
                const half = 25;
                const glow = new PIXI.Graphics();
                glow.roundRect(-half - 4, -half - 4, (half + 4) * 2, (half + 4) * 2, 12);
                glow.fill({ color: 0x55ff55, alpha: 0.18 });
                g.addChild(glow);

                const pad = new PIXI.Graphics();
                pad.roundRect(-half, -half, half * 2, half * 2, 10);
                pad.fill({ color: 0x0d2a0d, alpha: 1.0 });
                pad.stroke({ width: 2, color: 0x55ff55, alpha: 0.9 });
                g.addChild(pad);

                const chevrons = new PIXI.Graphics();
                for (let c = 0; c < 3; c++) {
                  const oy = -14 + c * 13;
                  chevrons.moveTo(-12, oy);
                  chevrons.lineTo(0, oy + 9);
                  chevrons.lineTo(12, oy);
                }
                chevrons.stroke({ width: 3, color: 0x9dff9d, alpha: 0.95 });
                g.addChild(chevrons);

                mg.rect(-25, -25, 50, 50);
                mg.fill({ color: 0x55ff55, alpha: 0.8 });
              } else if (item.type === 'windmill') {
                // 절차적 풍차: 4날 블레이드 + 중심 허브
                const rotor = new PIXI.Graphics();
                for (let b = 0; b < 4; b++) {
                  const ang = (b / 4) * Math.PI * 2;
                  const cos = Math.cos(ang), sin = Math.sin(ang);
                  // 길쭉한 사다리꼴 날 (안쪽 좁고 바깥 넓게)
                  const inner = 8, outer = 50, wIn = 4, wOut = 12;
                  const px = (d: number, w: number) => cos * d - sin * w;
                  const py = (d: number, w: number) => sin * d + cos * w;
                  rotor.moveTo(px(inner, -wIn), py(inner, -wIn));
                  rotor.lineTo(px(outer, -wOut), py(outer, -wOut));
                  rotor.lineTo(px(outer, wOut), py(outer, wOut));
                  rotor.lineTo(px(inner, wIn), py(inner, wIn));
                  rotor.closePath();
                }
                rotor.fill({ color: 0x00ffff, alpha: 0.85 });
                rotor.stroke({ width: 2, color: 0xccffff, alpha: 0.9 });
                g.addChild(rotor);

                const hub = new PIXI.Graphics();
                hub.circle(0, 0, 10);
                hub.fill({ color: 0x114455, alpha: 1.0 });
                hub.stroke({ width: 2, color: 0x00ffff, alpha: 1.0 });
                g.addChild(hub);

                const speed = item.speed || 3;
                app.ticker.add((ticker) => {
                  g.rotation += speed * (ticker.deltaMS / 1000);
                  mg.rotation += speed * (ticker.deltaMS / 1000);
                });
                mg.rect(-50, -5, 100, 10);
                mg.rect(-5, -50, 10, 100);
                mg.fill({ color: 0x00ffff, alpha: 0.6 });
              } else if (item.type === 'blackhole' || item.type === 'whitehole') {
                // 절차적 렌더링: 깨진 JPEG 텍스처(체커보드 얼룩) 대신 PIXI.Graphics로 직접 그림
                const r = item.radius || 100;
                const isWhite = item.type === 'whitehole';
                const coreColor = isWhite ? 0xffe0ff : 0x140026;
                const ringColor = isWhite ? 0xff66ff : 0x9b30ff;

                // 외곽 헤일로(정적): 동심원으로 방사형 그라데이션 흉내
                const halo = new PIXI.Graphics();
                for (let i = 7; i >= 1; i--) {
                  halo.circle(0, 0, r * 1.1 * (i / 7));
                  halo.fill({ color: ringColor, alpha: 0.05 });
                }
                g.addChild(halo);

                // 회전하는 소용돌이 팔(나선)
                const swirl = new PIXI.Container();
                const arms = new PIXI.Graphics();
                const armCount = 5;
                for (let a = 0; a < armCount; a++) {
                  const baseAngle = (a / armCount) * Math.PI * 2;
                  for (let t = 0; t <= 1.0001; t += 0.05) {
                    const ang = baseAngle + t * Math.PI * 2.5;
                    const rad = t * r;
                    const px = Math.cos(ang) * rad;
                    const py = Math.sin(ang) * rad;
                    if (t === 0) arms.moveTo(px, py);
                    else arms.lineTo(px, py);
                  }
                }
                arms.stroke({ width: Math.max(2, r * 0.06), color: ringColor, alpha: 0.7 });
                swirl.addChild(arms);

                // 어두운(또는 밝은) 코어
                const core = new PIXI.Graphics();
                core.circle(0, 0, r * 0.45);
                core.fill({ color: coreColor, alpha: 0.95 });
                swirl.addChild(core);

                if (isWhite) swirl.blendMode = 'add';
                g.addChild(swirl);

                // GSAP rotation animation (블랙홀은 빨아들이듯, 화이트홀은 반대로)
                import('gsap').then(({ gsap }) => {
                  gsap.to(swirl, { rotation: Math.PI * 2 * (isWhite ? -1 : 1), duration: 6, repeat: -1, ease: 'none' });
                });
              } else if (item.type === 'portal') {
                // 절차적 포털: 동심 링(토러스) + 회전 + 맥동
                const r = item.radius || 40;
                const tint = item.color ? parseInt(item.color.replace('#', '0x')) : 0xcc66ff;
                const ring = new PIXI.Container();
                const rings = new PIXI.Graphics();
                for (let i = 0; i < 4; i++) {
                  rings.circle(0, 0, r * (1.4 - i * 0.28));
                  rings.stroke({ width: 3, color: tint, alpha: 0.35 + i * 0.18 });
                }
                rings.blendMode = 'add';
                ring.addChild(rings);
                g.addChild(ring);
                import('gsap').then(({ gsap }) => {
                  gsap.to(ring, { rotation: Math.PI * 2, duration: 5, repeat: -1, ease: 'none' });
                  gsap.to(ring.scale, { x: 1.1, y: 1.1, duration: 1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
                });

                mg.circle(0, 0, item.radius * 1.5);
                if (item.color) mg.fill({ color: parseInt(item.color.replace('#', '0x')), alpha: 0.6 });
                else mg.fill({ color: 0x8888ff, alpha: 0.6 });
              }
              g.position.set(item.x, item.y);
              g.rotation = item.rotation || 0;
              
              mg.position.set(item.x, item.y);
              mg.rotation = item.rotation || 0;
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
            
            let container = graphicsMap.get(bodyId);
            
            if (!container) {
              container = new PIXI.Container();
              viewport.addChild(container);
              
              if (isChip && survivor) {
                // 절차적 네온 구슬: 참가자 색상 기반 (JPEG 칩 텍스처 의존 제거)
                // 참가자 color는 'hsl(...)' CSS 문자열이므로 PIXI.Color로 파싱(hex/rgb/hsl 모두 지원).
                const R = 12;
                let colNum = 0x00ffcc;
                try { if (survivor.color) colNum = new PIXI.Color(survivor.color).toNumber(); } catch { colNum = 0x00ffcc; }
                const tier = survivor.skinId ? String(survivor.skinId).split('_')[0] : '';
                const rimColor = tier === 'UR' ? 0xffd700 : tier === 'SR' ? 0xff6ba0 : 0xffffff;

                // 컬러 오라 (가산 블렌드)
                const glow = new PIXI.Graphics();
                glow.circle(0, 0, R * 1.7);
                glow.fill({ color: colNum, alpha: 0.28 });
                glow.blendMode = 'add';
                container.addChild(glow);

                // 모션 블러 + 글로우 필터 (기존 유지, 글로우는 등급 색상으로)
                const mBlur = new MotionBlurFilter([0, 0], 15, 0);
                container.filters = [mBlur, new GlowFilter({ distance: 10, outerStrength: 1.5, innerStrength: 0, color: rimColor, quality: 0.2 })];
                (container as any).mBlur = mBlur; // save ref

                // 구슬 본체 + 하단 음영(구체감) + 림 + 글로시 하이라이트
                const marble = new PIXI.Graphics();
                marble.circle(0, 0, R);
                marble.fill({ color: colNum, alpha: 1 });
                marble.circle(R * 0.1, R * 0.25, R * 0.65);
                marble.fill({ color: 0x000000, alpha: 0.28 });
                marble.circle(0, 0, R);
                marble.stroke({ width: 2, color: rimColor, alpha: 0.9 });
                marble.circle(-R * 0.33, -R * 0.33, R * 0.3);
                marble.fill({ color: 0xffffff, alpha: 0.7 });
                marble.circle(-R * 0.42, -R * 0.42, R * 0.12);
                marble.fill({ color: 0xffffff, alpha: 0.95 });
                container.addChild(marble);

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
            container.rotation += (vx * 0.005);
            
            if ((container as any).mBlur) {
               (container as any).mBlur.velocity.x = (vx > 10 || vx < -10) ? vx * 0.15 : 0;
               (container as any).mBlur.velocity.y = (vy > 10 || vy < -10) ? vy * 0.15 : 0;
            }

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
                  mDot.stroke({ width: 8, color: 0xffffff, alpha: 1 });
                } else {
                  mDot.circle(0,0, 16);
                  mDot.fill(colorNum);
                }
              } else {
                mDot.circle(0,0, 12);
                mDot.fill(0x888888);
              }
            }

            if (y > firstY && y < WORLD_HEIGHT) {
              secondY = firstY;
              firstY = y;
              firstX = x;
            } else if (y > secondY && y < WORLD_HEIGHT) {
              secondY = y;
            }
          }
          
          // AI Camera Director
          // Follow the 1st place chip smoothly if auto follow is enabled
          if (firstY !== -Infinity) {
            const currentCenter = viewport.center;
            const targetY = firstY + 150; // Look ahead
            let targetZoom = 1;
            
            // Juiciness: Zoom in when 1st and 2nd are very close!
            if (secondY !== -Infinity && firstY - secondY < 40) {
              targetZoom = 1.4; // 박빙 줌인
            }
            
            setIsAutoFollow(prev => {
              if (prev) {
                viewport.moveCenter(
                  currentCenter.x + (firstX - currentCenter.x) * 0.05,
                  currentCenter.y + (targetY - currentCenter.y) * 0.05
                );
                viewport.scale.x += (targetZoom - viewport.scale.x) * 0.05;
                viewport.scale.y += (targetZoom - viewport.scale.y) * 0.05;
              } else if (targetManualPos) {
                // Smooth manual panning when clicking/dragging minimap
                viewport.moveCenter(
                  currentCenter.x + (targetManualPos.x - currentCenter.x) * 0.15,
                  currentCenter.y + (targetManualPos.y - currentCenter.y) * 0.15
                );
                // Clear target if close enough
                if (Math.abs(currentCenter.x - targetManualPos.x) < 2 && Math.abs(currentCenter.y - targetManualPos.y) < 2) {
                  targetManualPos = null;
                }
              }
              return prev;
            });
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

          // Update Viewport Indicator
          if (viewIndicator) {
             viewIndicator.clear();
             viewIndicator.rect(viewport.left, viewport.top, viewport.right - viewport.left, viewport.bottom - viewport.top);
             viewIndicator.stroke({ width: 8, color: 0xffffff, alpha: 0.8 }); // 8 world units -> 2px on screen
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
          setActiveSkill(payload);
          setTimeout(() => setActiveSkill(null), 2000);
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
          triggerShockwave(); // Cinematic shockwave on skill fire
        } else if (type === 'RANKINGS_UPDATE') {
          currentRankings = payload;
          setRankings(payload);
        } else if (type === 'CHIP_FINISHED') {
          setFinishedFeed(prev => [...prev, payload]);
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.8 },
            colors: ['#00ffcc', '#ff00ff', '#ffff00', '#ffffff']
          });
        } else if (type === 'GAME_OVER') {
          setGameState('finished');
          setGameOverResult(payload);
          triggerShockwave();
          confetti({
            particleCount: 200,
            spread: 100,
            origin: { y: 0.5 },
            colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff']
          });
        }
      };

      if (workerRef.current) {
        workerRef.current.postMessage({
          type: 'INIT',
          payload: {
            width: WORLD_WIDTH,
            height: WORLD_HEIGHT,
            customMapData,
            selectedMapPreset,
            gimmickDensity,
            survivors,
            targetCount: targetWinnerCount,
            mode: gameMode,
            customRank: customWinningRank
          }
        });
      }
    }

    initPromise = initPixi();

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined' && app && (app as any)._bgResizeHandler) {
        window.removeEventListener('resize', (app as any)._bgResizeHandler);
      }
      if (typeof window !== 'undefined' && app && (app as any)._minimapResizeHandler) {
        window.removeEventListener('resize', (app as any)._minimapResizeHandler);
      }
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'STOP' });
        workerRef.current.terminate();
      }
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
  }, [survivors, targetWinnerCount, gimmickDensity, setSurvivors, setGameStage, customMapData, gameMode, customWinningRank])

  return (
    <div className={`relative w-full h-full flex flex-col items-center justify-center overflow-hidden ${isBroadcasterMode ? 'bg-[#00ff00]' : 'bg-black'}`}>
      <LiveLeaderboard rankings={rankings} />
      <SkillEventOverlay activeSkill={activeSkill} />
      
      {/* Broadcaster / Streamer UI Layout */}
      <div className="absolute top-6 right-6 z-50 flex flex-col gap-2 pointer-events-none items-end">
        {finishedFeed.map((feed, idx) => (
          <div key={idx} className="bg-black/60 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-right fade-in duration-500 shadow-[0_0_20px_rgba(0,255,204,0.3)]">
            <span className="text-xl font-black text-[#00ffcc]">🎉 {feed.rank}등</span>
            <span className="text-white font-bold">{feed.survivor.name}</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-6 left-6 z-50 flex gap-4">
        <button 
          onClick={() => setGameStage('dashboard')}
          className="glass-panel-heavy hover:bg-white/10 text-white font-bold px-6 py-4 rounded-2xl transition-all shadow-lg flex items-center gap-2 group border border-white/10"
        >
          <span className="group-hover:-translate-x-1 transition-transform">🚪</span> 새로운 추첨으로 돌아가기
        </button>
      </div>

      {gameState === 'finished' && gameOverResult && (
        <div className="absolute bottom-[104px] right-6 z-50 flex flex-col items-end animate-in slide-in-from-right fade-in duration-700">
          <div className="bg-black/80 backdrop-blur-md border border-[#FFD700]/50 rounded-2xl p-6 flex flex-col items-end gap-4 shadow-[0_0_30px_rgba(255,215,0,0.3)]">
            <h3 className="text-[#FFD700] font-bold text-sm tracking-widest uppercase mb-1">
              🎉 {gameOverResult.mode === 'speed' && '스피드 챔피언'}
              {gameOverResult.mode === 'turtle' && '최후의 생존자'}
              {gameOverResult.mode === 'lucky' && '행운의 주인공'}
            </h3>
            <div className="flex flex-col gap-3">
              {gameOverResult.winners.map((w: any, idx: number) => (
                <div key={idx} className="flex items-center justify-end gap-3">
                  <span className="text-2xl font-black text-white">{w.name}</span>
                  <div className="w-8 h-8 rounded-full shadow-[0_0_15px_currentColor]" style={{ backgroundColor: w.color, color: w.color }}></div>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setGameStage('dashboard')}
              className="mt-2 w-full bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-extrabold text-sm tracking-widest px-6 py-3 rounded-xl hover:opacity-90 hover:scale-105 transition-all shadow-lg"
            >
              NEXT MATCH
            </button>
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

      <div className="absolute bottom-6 right-6 z-50 flex gap-4">
        <button 
          onClick={() => setIsAutoFollow(true)}
          className={`glass-panel-heavy p-4 transition-colors flex items-center justify-center group active:scale-95 rounded-2xl ${isAutoFollow ? 'bg-white/20 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'hover:bg-white/10'}`}
        >
          <Video className={`w-8 h-8 group-hover:scale-110 transition-transform ${isAutoFollow ? 'text-purple-400' : 'text-gray-400'}`} />
        </button>
        <button 
          onClick={() => setIsMuted(soundManager.toggleMute())}
          className="glass-panel-heavy p-4 hover:bg-white/10 transition-colors flex items-center justify-center group active:scale-95 rounded-2xl"
        >
          {isMuted ? <VolumeX className="w-8 h-8 text-red-400 group-hover:scale-110 transition-transform" /> : <Volume2 className="w-8 h-8 text-[#00ffcc] group-hover:scale-110 transition-transform" />}
        </button>
        <button 
          onClick={handleNudge}
          className="glass-panel-heavy p-4 hover:bg-white/10 transition-colors flex items-center justify-center group active:scale-95 rounded-2xl shadow-[0_0_20px_rgba(0,255,204,0.3)]"
        >
          <Hand className="w-8 h-8 text-[#00ffcc] group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Main Render Target */}
      <div 
        ref={containerRef} 
        className="w-full h-full flex items-center justify-center pointer-events-auto"
      />
    </div>
  )
}
