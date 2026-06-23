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
import { Hand, Volume2, VolumeX, Maximize } from 'lucide-react'

// Texture Map
const CHIP_TEXTURES = [
  'chip_obsidian_gold.png',
  'chip_neon_plasma.png',
  'chip_cyber_hologram.png',
  'chip_liquid_mercury.png',
  'chip_crystal_prism.png'
];

export default function PhysicsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [rankings, setRankings] = useState<ParticipantRank[]>([])
  const [activeSkill, setActiveSkill] = useState<{ chipId: string; skill: string } | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [isPiP, setIsPiP] = useState(false)
  
  const { survivors, setSurvivors, targetSurvivalCount, gimmickDensity } = useGameStore()
  const { setGameStage, customMapData } = useUIStore()
  const workerRef = useRef<Worker | null>(null)

  const handleNudge = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'NUDGE', payload: { force: 200 } });
      if (navigator.vibrate) navigator.vibrate(50);
    }
  }, [])

  useEffect(() => {
    let isMounted = true;
    let app: PIXI.Application;
    let viewport: Viewport;
    let pipViewport: Viewport;
    const graphicsMap = new Map<string, PIXI.Container>();
    
    let activeChipsCount = 0;
    
    const initPixi = async () => {
      app = new PIXI.Application();
      await app.init({
        canvas: canvasRef.current!,
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 1,
        backgroundColor: 0x0a0a10, // Dark background
        antialias: true,
        resolution: window.devicePixelRatio || 1,
      });

      // Background Parallax Layer
      const bgTexture = PIXI.Assets.get('/images/assets/bg_neon_synthwave_ultra.png');
      const bgSprite = new PIXI.Sprite(bgTexture);
      bgSprite.anchor.set(0.5);
      bgSprite.x = 400; // Center of physics width (800)
      bgSprite.y = 600;
      // Make it large enough to cover viewport panning
      bgSprite.scale.set(1.5);
      bgSprite.alpha = 0.4;
      app.stage.addChild(bgSprite);

      viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        worldWidth: 800,
        worldHeight: 1200,
        events: app.renderer.events
      });

      app.stage.addChild(viewport);
      viewport.drag().pinch().wheel().decelerate();
      // Clamp zoom
      viewport.clampZoom({ minWidth: 400, maxWidth: 1600 });
      viewport.moveCenter(400, 200);

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
      
      workerRef.current.onmessage = (e) => {
        if (!isMounted) return;
        const { type, payload } = e.data;
        
        if (type === 'INIT_DONE') {
          activeChipsCount = payload.activeChipsCount;
          workerRef.current?.postMessage({ type: 'START' });
        } else if (type === 'FRAME') {
          const buffer = new Float32Array(payload);
          
          let firstY = -Infinity;
          let firstX = 400;
          let lastY = Infinity;
          let lastX = 400;

          // Buffer format: [id, x, y, rotation, speed]
          for (let i = 0; i < buffer.length; i += 5) {
            const handle = buffer[i];
            const x = buffer[i + 1];
            const y = buffer[i + 2];
            const rot = buffer[i + 3];
            const speed = buffer[i + 4];

            const bodyId = handle.toString();
            let container = graphicsMap.get(bodyId);
            
            if (!container) {
              container = new PIXI.Container();
              viewport.addChild(container);
              
              // We need to also add to pipViewport. But PIXI.DisplayObject can only have one parent.
              // So for true PiP we either duplicate sprites or just render the whole stage to a RenderTexture.
              // Since true duplicate is heavy, we will skip PiP duplicating here to keep it simple, 
              // or just rely on a RenderTexture for PiP.
              // Let's implement PiP later using RenderTexture, for now just main viewport.
              
              // Create Sprite for Chip
              // We assume this is a chip if it's within the first `activeChipsCount` indices.
              // Since we don't have exact ID mapping in this simple buffer, we assign random textures for demo,
              // or we can use the ID.
              const isChip = (i / 5) < survivors.length; 
              
              if (isChip) {
                const texName = CHIP_TEXTURES[Math.floor(Math.random() * CHIP_TEXTURES.length)];
                const sprite = new PIXI.Sprite(PIXI.Assets.get(`/images/assets/${texName}`));
                sprite.anchor.set(0.5);
                sprite.width = 24;
                sprite.height = 24;
                
                // Add glowing aura
                const glow = new PIXI.Graphics();
                glow.circle(0,0, 18);
                glow.fill({ color: 0x00ffcc, alpha: 0.3 });
                glow.blendMode = 'add';
                container.addChild(glow);
                
                container.addChild(sprite);
              } else {
                // Draw obstacles (walls, pins)
                // This is a simplification. We should ideally pass type in the buffer.
                // For this demo, we just draw a small dot if we don't know the type.
                const g = new PIXI.Graphics();
                g.circle(0,0, 10);
                g.fill(0xffffff);
                container.addChild(g);
              }
              
              graphicsMap.set(bodyId, container);
            }
            
            container.position.set(x, y);
            container.rotation = rot;

            // Camera calculations
            if (y > firstY) { firstY = y; firstX = x; } // Since down is positive Y
            if (y < lastY) { lastY = y; lastX = x; }
          }
          
          // AI Camera Director
          // Follow the 1st place chip smoothly
          if (firstY !== -Infinity) {
            const currentCenter = viewport.center;
            const targetY = firstY + 150; // Look ahead
            viewport.moveCenter(
              currentCenter.x + (firstX - currentCenter.x) * 0.05,
              currentCenter.y + (targetY - currentCenter.y) * 0.05
            );
          }
          
          // Background Parallax
          bgSprite.y = 600 - (viewport.center.y - 600) * 0.2;

        } else if (type === 'SOUND_EFFECT') {
          if (payload.type === 'warp') soundManager.playFinish();
          else if (payload.type === 'finish') soundManager.playFinish();
        } else if (type === 'SKILL_FIRED') {
          setActiveSkill(payload);
          setTimeout(() => setActiveSkill(null), 2000);
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        } else if (type === 'RANKINGS_UPDATE') {
          setRankings(payload);
        } else if (type === 'GAME_OVER') {
          setSurvivors(payload.survivors);
          setGameStage('results');
          isMounted = false;
        }
      };

      workerRef.current.postMessage({
        type: 'INIT',
        payload: {
          width: 800,
          height: 1200,
          customMapData,
          gimmickDensity,
          survivors,
          targetSurvival: targetSurvivalCount
        }
      });
    }

    initPixi();

    return () => {
      isMounted = false;
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'STOP' });
        workerRef.current.terminate();
      }
      if (app) app.destroy(true, { children: true, texture: false });
    }
  }, [survivors, targetSurvivalCount, gimmickDensity, setSurvivors, setGameStage, customMapData])

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden bg-black">
      <LiveLeaderboard rankings={rankings} />
      <SkillEventOverlay activeSkill={activeSkill} />
      
      {/* Broadcaster / Streamer UI Layout */}
      <div className="absolute top-6 left-6 z-50 flex gap-4">
         {/* Additional streamer buttons can go here */}
      </div>

      <div className="absolute bottom-6 right-6 z-50 flex gap-4">
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
      <div className="w-full h-full flex items-center justify-center">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full object-cover pointer-events-auto"
        />
      </div>
    </div>
  )
}
