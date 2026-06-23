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
// Texture Map
const CHIP_TEXTURES = [
  'chip_obsidian_gold.png',
  'chip_neon_plasma.png',
  'chip_cyber_hologram.png',
  'chip_liquid_mercury.png',
  'chip_crystal_prism.png'
];

export default function PhysicsCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [rankings, setRankings] = useState<ParticipantRank[]>([])
  const [activeSkill, setActiveSkill] = useState<{ chipId: string; skill: string } | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [finishedFeed, setFinishedFeed] = useState<{ rank: number, survivor: any }[]>([])
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'finished'>('idle')
  const [gameOverResult, setGameOverResult] = useState<{winners: any[], mode: string} | null>(null)
  const [isAutoFollow, setIsAutoFollow] = useState(true)
  
  const { survivors, setSurvivors, targetWinnerCount, gameMode, customWinningRank, gimmickDensity } = useGameStore()
  const { setGameStage, customMapData, isBroadcasterMode } = useUIStore()
  const workerRef = useRef<Worker | null>(null)
  

  
  // WebGL Filters ref
  const shockwaveRef = useRef<any>(null)
  const triggerShockwave = useCallback(() => {
    if (shockwaveRef.current) {
      shockwaveRef.current.time = 0;
      shockwaveRef.current.active = true;
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
      workerRef.current.postMessage({ type: 'SHUFFLE', payload: { width: 800 } });
    }
  }, [gameState])

  useEffect(() => {
    let isMounted = true;
    let app: PIXI.Application;
    let viewport: Viewport;
    let pipViewport: Viewport;
    let bgSprite: PIXI.Sprite;
    const graphicsMap = new Map<string, PIXI.Container>();
    
    let activeChipsCount = 0;
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
        });

        if (containerRef.current) {
          containerRef.current.appendChild(app.canvas);
        }

        // Preload Assets
        const texturesToLoad = [
          '/images/assets/bg_neon_synthwave_ultra.png',
          '/images/assets/bg_abyssal_trench.png',
          '/images/assets/bg_celestial_clockwork.png',
          '/images/assets/obstacles/pin_neon.png',
          '/images/assets/obstacles/bumper_plasma.png',
          '/images/assets/obstacles/wall_cyber.png',
          '/images/assets/obstacles/booster_pad.png',
          '/images/assets/obstacles/blackhole.png',
          '/images/assets/obstacles/portal_gate.png',
          '/images/assets/obstacles/windmill_rotor.png',
          '/images/assets/chip_mythic_dragon.png',
          ...CHIP_TEXTURES.map(t => `/images/assets/${t}`)
        ];
        let loadedAssets: any = {};
        try {
          loadedAssets = await PIXI.Assets.load(texturesToLoad);
        } catch (err) {
          console.error("Asset load error:", err);
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
        
        const bgSprites = [layer1, layer2];

        // PixiJS v8 compatibility patch for pixi-viewport v6
        const dummyInteraction = { on: () => {}, off: () => {} };
        const patchedEvents = { ...app.renderer.events, interaction: dummyInteraction } as any;

        viewport = new Viewport({
          screenWidth: window.innerWidth,
          screenHeight: window.innerHeight,
          worldWidth: 800,
          worldHeight: 1200,
          events: patchedEvents
        });

        app.stage.addChild(viewport);
        viewport.drag().pinch().wheel().decelerate()
          .clamp({ left: -200, right: 1000, top: -500, bottom: 2000, underflow: 'center' }); // clamp bounds
        
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
        shockwaveRef.current.active = false;
        
        app.stage.filters = [shockwave];
        
        app.ticker.add((ticker) => {
          if (shockwaveRef.current && shockwaveRef.current.active) {
            shockwaveRef.current.time += ticker.deltaTime * 0.02;
            if (shockwaveRef.current.time > 2.5) {
              shockwaveRef.current.active = false;
              shockwaveRef.current.time = 0;
            }
          }
        });

        // PiP Viewport (Minimap / Last place tracker)
        pipViewport = new Viewport({
          screenWidth: 200,
          screenHeight: 300,
          worldWidth: 800,
          worldHeight: 1200,
          events: app.renderer.events
        });
        // Set PiP mask to bottom left
        const pipMask = new PIXI.Graphics();
        pipMask.roundRect(20, window.innerHeight - 320, 200, 300, 16);
        pipMask.fill(0xffffff);
        app.stage.addChild(pipMask);
        pipViewport.mask = pipMask;
        pipViewport.position.set(20, window.innerHeight - 320);
        pipViewport.scale.set(0.25); // Scale down
        
        // Draw border for PiP
        const pipBorder = new PIXI.Graphics();
        pipBorder.roundRect(20, window.innerHeight - 320, 200, 300, 16);
        pipBorder.stroke({ width: 2, color: 0x00ffcc, alpha: 0.8 });
        app.stage.addChild(pipBorder);
        app.stage.addChild(pipViewport);

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

            payload.mapData.forEach((item: any) => {
              const g = new PIXI.Container();
              if (item.type === 'wall') {
                const tex = PIXI.Assets.get('/images/assets/obstacles/wall_cyber.png');
                if (tex) {
                  const sprite = new PIXI.Sprite(tex);
                  sprite.anchor.set(0.5);
                  sprite.width = item.w;
                  sprite.height = item.h;
                  g.addChild(sprite);
                } else {
                  // Solid metallic wall fallback
                  const fallback = new PIXI.Graphics();
                  fallback.rect(-item.w / 2, -item.h / 2, item.w, item.h);
                  fallback.fill({ color: 0x22222a, alpha: 1.0 });
                  fallback.stroke({ width: 3, color: 0x555566, alpha: 1.0 });
                  
                  // Add inner detail (pipe look)
                  const detail = new PIXI.Graphics();
                  detail.rect(-item.w / 2 + 5, -item.h / 2 + 5, item.w - 10, item.h - 10);
                  detail.stroke({ width: 1, color: 0x888899, alpha: 0.5 });
                  fallback.addChild(detail);
                  
                  g.addChild(fallback);
                }
                
                // Add drop shadow
                const shadow = new PIXI.Graphics();
                shadow.rect(-item.w / 2, -item.h / 2, item.w, item.h);
                shadow.fill({ color: 0x000000, alpha: 0.6 });
                shadow.position.set(8, 10);
                g.addChildAt(shadow, 0);
              } else if (item.type === 'pin') {
                const tex = PIXI.Assets.get('/images/assets/obstacles/pin_neon.png');
                if (tex) {
                  const sprite = new PIXI.Sprite(tex);
                  sprite.anchor.set(0.5);
                  sprite.width = item.radius * 2;
                  sprite.height = item.radius * 2;
                  g.addChild(sprite);
                } else {
                  const fallback = new PIXI.Graphics();
                  fallback.circle(0, 0, item.radius);
                  fallback.fill({ color: 0x333344, alpha: 1.0 });
                  fallback.stroke({ width: 2, color: 0x888899, alpha: 1.0 });
                  g.addChild(fallback);
                }
                // Solid shadow instead of glow
                const shadow = new PIXI.Graphics();
                shadow.circle(0, 0, item.radius);
                shadow.fill({ color: 0x000000, alpha: 0.7 });
                shadow.position.set(4, 6);
                g.addChildAt(shadow, 0);
              } else if (item.type === 'bumper') {
                const tex = PIXI.Assets.get('/images/assets/obstacles/bumper_plasma.png');
                if (tex) {
                  const sprite = new PIXI.Sprite(tex);
                  sprite.anchor.set(0.5);
                  sprite.width = item.radius * 2.5;
                  sprite.height = item.radius * 2.5;
                  g.addChild(sprite);
                } else {
                  const fallback = new PIXI.Graphics();
                  fallback.circle(0, 0, item.radius);
                  fallback.fill({ color: 0x442222, alpha: 1.0 });
                  fallback.stroke({ width: 3, color: 0xffaa55, alpha: 1.0 });
                  g.addChild(fallback);
                }
                const shadow = new PIXI.Graphics();
                shadow.circle(0, 0, item.radius * 1.25);
                shadow.fill({ color: 0x000000, alpha: 0.8 });
                shadow.position.set(5, 8);
                g.addChildAt(shadow, 0);
              } else if (item.type === 'booster') {
                const tex = PIXI.Assets.get('/images/assets/obstacles/booster_pad.png');
                if (tex) {
                  const sprite = new PIXI.Sprite(tex);
                  sprite.anchor.set(0.5);
                  sprite.width = 50;
                  sprite.height = 50;
                  g.addChild(sprite);
                }
              } else if (item.type === 'windmill') {
                const tex = PIXI.Assets.get('/images/assets/obstacles/windmill_rotor.png');
                if (tex) {
                  const sprite = new PIXI.Sprite(tex);
                  sprite.anchor.set(0.5);
                  sprite.width = 100;
                  sprite.height = 100;
                  g.addChild(sprite);
                } else {
                  const fallback = new PIXI.Graphics();
                  fallback.rect(-50, -5, 100, 10);
                  fallback.rect(-5, -50, 10, 100);
                  fallback.fill({ color: 0x00ffff, alpha: 0.8 });
                  g.addChild(fallback);
                }
                const speed = item.speed || 3;
                app.ticker.add((ticker) => {
                  g.rotation += speed * (ticker.deltaMS / 1000);
                });
              } else if (item.type === 'blackhole' || item.type === 'whitehole') {
                const tex = PIXI.Assets.get('/images/assets/obstacles/blackhole.png');
                if (tex) {
                  const sprite = new PIXI.Sprite(tex);
                  sprite.anchor.set(0.5);
                  sprite.width = item.radius * 2.2;
                  sprite.height = item.radius * 2.2;
                  if (item.type === 'whitehole') {
                    sprite.tint = 0xffaaff;
                    sprite.blendMode = 'add';
                  }
                  g.addChild(sprite);
                  // GSAP rotation animation
                  import('gsap').then(({ gsap }) => {
                    gsap.to(sprite, { rotation: Math.PI * 2, duration: 4, repeat: -1, ease: 'none' });
                  });
                }
              } else if (item.type === 'portal') {
                const tex = PIXI.Assets.get('/images/assets/obstacles/portal_gate.png');
                if (tex) {
                  const sprite = new PIXI.Sprite(tex);
                  sprite.anchor.set(0.5);
                  sprite.width = item.radius * 3;
                  sprite.height = item.radius * 3;
                  sprite.blendMode = 'add';
                  if (item.color) sprite.tint = parseInt(item.color.replace('#', '0x'));
                  g.addChild(sprite);
                  import('gsap').then(({ gsap }) => {
                    gsap.to(sprite.scale, { x: 1.1, y: 1.1, duration: 1, yoyo: true, repeat: -1, ease: 'sine.inOut' });
                  });
                }
              }
              g.position.set(item.x, item.y);
              g.rotation = item.rotation || 0;
              // Provide an ID to the graphic object for animations
              if (item.id) {
                g.label = item.id;
              }
              staticContainer.addChild(g);
            });
          }
          
          workerRef.current?.postMessage({ type: 'START' });
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
                const texName = CHIP_TEXTURES[Math.floor(Math.random() * CHIP_TEXTURES.length)];
                const texUrl = `/images/assets/${texName}`;
                const tex = PIXI.Assets.get(texUrl) || PIXI.Texture.WHITE;
                const sprite = new PIXI.Sprite(tex);
                sprite.anchor.set(0.5);
                sprite.width = 24;
                sprite.height = 24;
                
                // Add glowing aura and filter
                const glow = new PIXI.Graphics();
                glow.circle(0,0, 18);
                glow.fill({ color: 0x00ffcc, alpha: 0.3 });
                glow.blendMode = 'add';
                container.addChild(glow);
                
                const mBlur = new MotionBlurFilter([0, 0], 15, 0);
                container.filters = [mBlur, new GlowFilter({ distance: 10, outerStrength: 1.5, innerStrength: 0, color: 0xffffff, quality: 0.2 })];
                (container as any).mBlur = mBlur; // save ref
                
                container.addChild(sprite);
                
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
            container.rotation = rot;
            
            if ((container as any).mBlur) {
               // Approximate velocity based on previous position could be done, 
               // but we only have speed here. We will just use Y velocity roughly.
               // For a real setup we should send vx, vy from worker.
               (container as any).mBlur.velocity.y = speed > 50 ? Math.min(speed / 5, 40) : 0;
            }

            if (y > firstY && y < 1200) { 
              secondY = firstY;
              firstY = y; 
              firstX = x; 
            } else if (y > secondY && y < 1200) {
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
              }
              return prev;
            });
          }
          
          // Background Parallax & Theme Zone Color
          if (typeof bgSprites !== 'undefined') {
            bgSprites[0].y = 600 - (viewport.center.y - 600) * 0.1; // Slowest (far)
            bgSprites[1].y = 600 - (viewport.center.y - 600) * 0.3; // Faster (mid)
            
            // Theme Tint
            if (viewport.center.y > 900) {
              bgSprites[0].tint = 0xff7777; // Reddish Void
            } else if (viewport.center.y > 500) {
              bgSprites[0].tint = 0x77ff77; // Greenish Factory
            } else {
              bgSprites[0].tint = 0xffffff; // Neon
            }
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
            width: 800,
            height: 1200,
            customMapData,
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-1000">

          <div className="bg-black/90 border border-[#FFD700]/50 rounded-3xl p-10 flex flex-col items-center gap-8 shadow-[0_0_80px_rgba(255,215,0,0.4)] max-w-2xl w-full mx-4 z-10 backdrop-blur-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-tr from-[#FFD700]/10 to-transparent pointer-events-none"></div>
            <h2 
              className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FFD700] animate-pulse drop-shadow-[0_0_15px_rgba(255,215,0,0.8)]"
              style={{ WebkitTextStroke: '1px rgba(255,255,255,0.3)' }}
            >
              🎉 WINNER 🎉
            </h2>
            <p className="text-[#FFD700] font-bold text-2xl tracking-[0.3em] uppercase">
              {gameOverResult.mode === 'speed' && '스피드 레이스 챔피언'}
              {gameOverResult.mode === 'turtle' && '거북이 레이스 최후의 생존자'}
              {gameOverResult.mode === 'lucky' && '행운의 주인공'}
            </p>
            <div className="flex flex-wrap justify-center gap-4 w-full max-h-[400px] overflow-y-auto scrollbar-hide py-4">
              {gameOverResult.winners.map((w: any, idx: number) => (
                <div key={idx} className="bg-gradient-to-b from-white/10 to-white/5 px-8 py-5 rounded-2xl border border-white/20 flex items-center gap-4 animate-in slide-in-from-bottom-10 fade-in duration-700 shadow-xl" style={{ animationDelay: `${idx * 150}ms` }}>
                  <div className="w-8 h-8 rounded-full shadow-[0_0_15px_currentColor]" style={{ backgroundColor: w.color, color: w.color }}></div>
                  <span className="text-4xl font-extrabold text-white tracking-wide">{w.name}</span>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setGameStage('dashboard')}
              className="mt-4 bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black font-extrabold text-2xl tracking-widest px-12 py-5 rounded-2xl hover:opacity-90 hover:scale-105 transition-all w-full shadow-[0_0_30px_rgba(255,215,0,0.5)]"
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
