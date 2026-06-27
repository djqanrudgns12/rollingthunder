import RAPIER from '@dimforge/rapier2d-compat';
import { MapBuilder } from './MapBuilder';
import { ChipFactory } from './ChipFactory';
import { NudgeSystem } from './NudgeSystem';
import { SkillSystem } from './SkillSystem';
import { RankingTracker } from './RankingTracker';
import { getPresetMap, getPresetMeta } from './MapPresets';
import type { WallStyle } from './MapBuilder';

let world: RAPIER.World | null = null;
let eventQueue: RAPIER.EventQueue | null = null;

let isRunning = false;
let stepInterval: any = null;
let skillInterval: any = null;
let hasDispatchedGameOver = false;

let positionsBuffer: Float32Array;
let activeChips: RAPIER.RigidBody[] = [];

let survivorsData: any[] = [];
let targetCount = 1;
let gameMode = 'speed';
let customWinningRank = 1;
let isSkillEnabled = true;
let worldHeight = 1200; // INIT에서 갱신. 결승선 = worldHeight + 20
const finishedChips = new Set<string>();
const finishOrder: string[] = [];

const lastWarpTime = new Map<string, number>();

// Y축 진척도 Anti-Stuck: 각 칩이 얼마나 아래로 내려갔는지 추적
const chipMaxY = new Map<string, number>();          // 칩별 최대 도달 Y 좌표
const chipLastProgressFrame = new Map<string, number>(); // 마지막으로 진전을 보인 프레임
let gameStartFrame = 0;  // 게임 시작 이후 경과 프레임 (Absolute Timeout용)

function broadcastFrame() {
  if (!activeChips || activeChips.length === 0) return;
  
  for (let i = 0; i < activeChips.length; i++) {
    const body = activeChips[i];
    const t = body.translation();
    const r = body.rotation();
    const v = body.linvel();
    
    positionsBuffer[i * 5 + 0] = i; // Use index instead of handle
    positionsBuffer[i * 5 + 1] = t.x;
    positionsBuffer[i * 5 + 2] = t.y;
    positionsBuffer[i * 5 + 3] = v.x; // Send vx
    positionsBuffer[i * 5 + 4] = v.y; // Send vy
  }
  
  const frameData = new Float32Array(positionsBuffer);
  (self.postMessage as any)({ type: 'FRAME', payload: frameData }, [frameData.buffer]);
}

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'INIT') {
    await RAPIER.init();
    
    // 무결성 보장: 브라우저 캐시로 인해 예전 스킬 코드가 실행되어 물리 엔진에 존재하지 않는 함수를 호출하더라도 워커가 크래시되지 않도록 방어(Polyfill) 주입
    if (RAPIER.RigidBody && !(RAPIER.RigidBody.prototype as any).setAdditionalMassProps) {
      (RAPIER.RigidBody.prototype as any).setAdditionalMassProps = function() {
        console.warn("Ignored legacy physics call to setAdditionalMassProps");
      };
    }
    
    if (skillInterval) clearInterval(skillInterval);
    if (stepInterval) clearInterval(stepInterval);
    hasDispatchedGameOver = false;
    finishedChips.clear();
    finishOrder.length = 0;
    
    if (world) {
      world.free();
    }
    
    const gravity = { x: 0.0, y: 9.81 * 30 };
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true);
    
    const { width, height, customMapData, selectedMapPreset, gimmickDensity, survivors, targetCount: tc, mode, customRank, isSkillEnabled: isSkill } = payload;
    
    // 프리셋 메타에서 동적 worldHeight와 wallStyle을 가져옴
    const presetMeta = selectedMapPreset && selectedMapPreset !== 'random' ? getPresetMeta(selectedMapPreset) : null;
    worldHeight = presetMeta ? presetMeta.worldHeight : height;
    const wallStyle: WallStyle = presetMeta ? presetMeta.wallStyle : 'zigzag';
    
    targetCount = tc;
    gameMode = mode;
    customWinningRank = customRank;
    survivorsData = survivors;
    isSkillEnabled = isSkill ?? true;
    
    // 외벽 생성: 맵 프리셋의 wallStyle 적용 (straight/zigzag/narrow/wide)
    MapBuilder.createWalls(world, width, worldHeight, 100, wallStyle);
    
    const presetData = presetMeta ? presetMeta.items : null;
    const mapToLoad = customMapData && customMapData.length > 0 ? customMapData : presetData;
    
    // Anti-Stuck 상태 초기화
    chipMaxY.clear();
    chipLastProgressFrame.clear();
    gameStartFrame = 0;

    if (mapToLoad && mapToLoad.length > 0) {
      mapToLoad.forEach((item: any) => {
        if (item.type === 'pin') {
          MapBuilder.createPin(world!, item.x, item.y, item.radius || 15, false, item.restitution, item.friction);
        } else if (item.type === 'bumper') {
          MapBuilder.createPin(world!, item.x, item.y, item.radius || 15, true, item.restitution, item.friction);
        } else if (item.type === 'wall') {
          MapBuilder.createRect(world!, item.x, item.y, item.w || 100, item.h || 20, 'wall', item.rotation || 0, item.restitution, item.friction);
        } else if (item.type === 'windmill') {
          MapBuilder.createKinematic(world!, item);
        } else if (item.type === 'portal' || item.type === 'booster' || item.type === 'blackhole' || item.type === 'whitehole') {
          MapBuilder.createSensor(world!, item);
        }
      });
    } else {
      MapBuilder.buildRandomMap(world, width, height, gimmickDensity);
    }

    const mapData: any[] = [];
    world.forEachRigidBody((body) => {
      const userData = body.userData as any;
      if (userData && userData.type && userData.type !== 'chip') {
        const t = body.translation();
        mapData.push({
          type: userData.type,
          x: t.x,
          y: t.y,
          w: userData.w,
          h: userData.h,
          radius: userData.radius,
          rotation: body.rotation(),
          speed: userData.speed,
          color: userData.color
        });
      }
    });

    activeChips = [];
    survivors.forEach((s: any) => {
      const spawnX = width * 0.1 + Math.random() * (width * 0.8);
      // Spawn chips at the start line (y = 50) and make them dynamic but we won't step the world yet
      const chip = ChipFactory.createChip(world!, spawnX, 50, 12, s.id);
      // Optional: zero velocity just in case
      chip.setLinvel({ x: 0, y: 0 }, true);
      activeChips.push(chip);
    });

    positionsBuffer = new Float32Array(activeChips.length * 5);
    
    self.postMessage({ type: 'INIT_DONE', payload: { activeChipsCount: activeChips.length, mapData } });
    
    // Broadcast initial frame so they are rendered at the start line
    broadcastFrame();
    
  } else if (type === 'SHUFFLE') {
    if (!world || isRunning) return;
    const { width } = payload;
    // Spread them randomly across the start line
    activeChips.forEach(chip => {
      const spawnX = width * 0.1 + Math.random() * (width * 0.8);
      chip.setTranslation({ x: spawnX, y: 50 }, true);
      chip.setLinvel({ x: 0, y: 0 }, true);
    });
    broadcastFrame();
    
  } else if (type === 'START') {
    isRunning = true;
    let dtMultiplier = 1.0;
    
    if (skillInterval) clearInterval(skillInterval);
    if (isSkillEnabled) {
      skillInterval = setInterval(() => {
        if (!world || activeChips.length === 0) return;
        const aliveChips = activeChips.filter(c => {
        const d = c.userData as any;
        return d && d.type === 'chip' && !finishedChips.has(d.id);
      });
      if (aliveChips.length === 0) return;
      const randomChip = aliveChips[Math.floor(Math.random() * aliveChips.length)];
      const chipData = randomChip.userData as any;
      
      const skills: any[] = ['tank', 'booster'];
      const randomSkill = skills[Math.floor(Math.random() * skills.length)];
      
      self.postMessage({ type: 'SKILL_FIRED', payload: { chipId: chipData.id, skill: randomSkill } });
      dtMultiplier = 0.15;
      SkillSystem.triggerSkill(world, chipData.id, randomSkill);
      
        setTimeout(() => {
          dtMultiplier = 1.0;
        }, 1500);
      }, 8000);
    }

    let frameCount = 0;
    let lowSpeedFrames = 0;
    gameStartFrame = 0;
    stepInterval = setInterval(() => {
      if (!world || !eventQueue) return;
      
      world.integrationParameters.dt = (1 / 60) * dtMultiplier;
      world.step(eventQueue);
      
      eventQueue.drainCollisionEvents((handle1, handle2, intersecting) => {
        if (!intersecting) return;
        const c1 = world!.getCollider(handle1);
        const c2 = world!.getCollider(handle2);
        if (!c1 || !c2) return;
        const b1 = c1.parent();
        const b2 = c2.parent();
        if (!b1 || !b2) return;
        
        const d1 = b1.userData as any;
        const d2 = b2.userData as any;
        
        // Calculate relative velocity for impact sound
        const v1 = b1.linvel();
        const v2 = b2.linvel();
        const relVx = v1.x - v2.x;
        const relVy = v1.y - v2.y;
        const impactV = Math.sqrt(relVx * relVx + relVy * relVy);
        
        if (impactV > 50) {
           const isBumper = d1?.type === 'bumper' || d2?.type === 'bumper';
           const x = (b1.translation().x + b2.translation().x) / 2;
           if (isBumper) {
             self.postMessage({ type: 'SOUND_EFFECT', payload: { type: 'bumperHit', impulse: impactV * 10, x }});
           } else {
             // Wall or pin
             self.postMessage({ type: 'SOUND_EFFECT', payload: { type: 'wallHit', impulse: impactV * 5, x }});
           }
        }
        
        let chipBody: RAPIER.RigidBody | null = null;
        let sensorBody: RAPIER.RigidBody | null = null;
        
        if (d1?.type === 'chip' && ['portal', 'booster'].includes(d2?.type)) { chipBody = b1; sensorBody = b2; }
        if (d2?.type === 'chip' && ['portal', 'booster'].includes(d1?.type)) { chipBody = b2; sensorBody = b1; }
        
        if (chipBody && sensorBody) {
          const chipData = chipBody.userData as any;
          const sensorData = sensorBody.userData as any;
          
          if (sensorData.type === 'portal') {
            const now = Date.now();
            const lastWarp = lastWarpTime.get(chipData.id) || 0;
            if (now - lastWarp > 1000) {
              let targetPortal: any = null;
              world!.forEachRigidBody(b => {
                const d = b.userData as any;
                if (d?.type === 'portal' && d.color === sensorData.color && b.handle !== sensorBody!.handle) {
                  targetPortal = b;
                }
              });
              if (targetPortal) {
                const tPos = targetPortal.translation();
                chipBody.setTranslation({ x: tPos.x, y: tPos.y }, true);
                lastWarpTime.set(chipData.id, now);
                self.postMessage({ type: 'SOUND_EFFECT', payload: { type: 'warp' }});
              }
            }
          } else if (sensorData.type === 'booster') {
            const angle = (sensorData.rotation || 0) * (Math.PI / 180);
            const power = (sensorData.power || 3) * 500;
            chipBody.applyImpulse({ x: Math.sin(angle) * power, y: -Math.cos(angle) * power }, true);
          }
        }
      });
      
      // Blackhole 인력 로직: 블랙홀 범위 안의 칩을 중심으로 끌어당김
      const blackholes: RAPIER.RigidBody[] = []
      const whiteholes: RAPIER.RigidBody[] = []
      world!.forEachRigidBody(b => {
        const d = b.userData as any
        if (d?.type === 'blackhole') blackholes.push(b)
        if (d?.type === 'whitehole') whiteholes.push(b)
      });
      blackholes.forEach(bh => {
        const bhData = bh.userData as any
        const bhPos = bh.translation()
        const radius = bhData.radius || 150
        const forceMult = bhData.force || 5
        
        activeChips.forEach(chip => {
          const cPos = chip.translation()
          const dx = bhPos.x - cPos.x
          const dy = bhPos.y - cPos.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          
          if (dist < radius && dist > 10) {
            const pull = (1 - dist / radius) * forceMult * 10
            chip.applyImpulse({ x: (dx/dist) * pull, y: (dy/dist) * pull }, true)
          }
        })
      });
      
      // Whitehole 척력 로직: 화이트홀 범위 안의 칩을 바깥으로 밀어냄 (블랙홀의 정반대)
      whiteholes.forEach(wh => {
        const whData = wh.userData as any
        const whPos = wh.translation()
        const radius = whData.radius || 100
        const forceMult = whData.force || 5
        
        activeChips.forEach(chip => {
          const cPos = chip.translation()
          const dx = cPos.x - whPos.x  // 방향 반전: 화이트홀에서 칩 쪽으로
          const dy = cPos.y - whPos.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          
          if (dist < radius && dist > 10) {
            const push = (1 - dist / radius) * forceMult * 10
            chip.applyImpulse({ x: (dx/dist) * push, y: (dy/dist) * push }, true)
          }
        })
      });

      let totalSpeed = 0;
      for (let i = 0; i < activeChips.length; i++) {
        const body = activeChips[i];
        const t = body.translation();
        const r = body.rotation();
        const v = body.linvel();
        const speed = Math.sqrt(v.x * v.x + v.y * v.y);
        totalSpeed += speed;
        
        positionsBuffer[i * 5 + 0] = i; // Use index instead of handle
        positionsBuffer[i * 5 + 1] = t.x;
        positionsBuffer[i * 5 + 2] = t.y;
        positionsBuffer[i * 5 + 3] = v.x;
        positionsBuffer[i * 5 + 4] = v.y;
        
        const data = body.userData as any;
        if (data?.type === 'chip' && t.y > worldHeight + 20 && !finishedChips.has(data.id)) {
          finishedChips.add(data.id);
          finishOrder.push(data.id);
          self.postMessage({ type: 'SOUND_EFFECT', payload: { type: 'finish' }});
          
          const survivor = survivorsData.find((s:any) => s.id === data.id);
          if (survivor) {
            self.postMessage({ 
              type: 'CHIP_FINISHED', 
              payload: { 
                rank: finishOrder.length, 
                survivor 
              }
            });
          }

          // Check Game Over conditions
          let isGameOver = false;
          let winners: any[] = [];

          if (gameMode === 'speed') {
            if (finishOrder.length === targetCount) {
              isGameOver = true;
              winners = finishOrder.map(id => survivorsData.find((s:any) => s.id === id)).filter(Boolean);
            }
          } else if (gameMode === 'turtle') {
            // End when all losers have finished, leaving exactly targetCount survivors on the map
            if (finishOrder.length === (survivorsData.length - targetCount)) {
              isGameOver = true;
              const finishedSet = new Set(finishOrder);
              winners = survivorsData.filter((s:any) => !finishedSet.has(s.id));
            }
          } else if (gameMode === 'lucky') {
            if (finishOrder.length === customWinningRank) {
              isGameOver = true;
              winners = [survivor]; // The one who just finished at this exact rank
            }
          }

          if (isGameOver && !hasDispatchedGameOver) {
            hasDispatchedGameOver = true;
            self.postMessage({ 
              type: 'GAME_OVER', 
              payload: { winners, mode: gameMode } 
            });
          }
        }
      } // End of activeChips loop
      
      if (activeChips.length > 0 && !hasDispatchedGameOver) {
        const avgSpeed = totalSpeed / activeChips.length;
        
        // Level 1: Gravity Storm — 전체 칩 평균 속도 < 10 이 5초 지속 시 전체 넉백
        if (avgSpeed < 10) {
          lowSpeedFrames++;
          if (lowSpeedFrames > 300) {
            self.postMessage({ type: 'GRAVITY_STORM' });
            NudgeSystem.applyNudge(world!, 3000);
            activeChips.forEach(chip => {
              chip.applyImpulse({ x: (Math.random() - 0.5) * 50000, y: -Math.random() * 50000 }, true);
            });
            lowSpeedFrames = 0;
          }
        } else {
          lowSpeedFrames = 0;
        }
        
        // Level 2: Y-Axis Progress Check — 개별 칩이 15초간 80px 미만 전진 시 강제 하향 임펄스
        activeChips.forEach(chip => {
          const data = chip.userData as any;
          if (!data || data.type !== 'chip' || finishedChips.has(data.id)) return;
          const t = chip.translation();
          const prevMaxY = chipMaxY.get(data.id) || 0;
          if (t.y > prevMaxY) {
            chipMaxY.set(data.id, t.y);
            // Y좌표가 80px 이상 전진하면 진척도 갱신
            if (t.y - prevMaxY > 80 || prevMaxY === 0) {
              chipLastProgressFrame.set(data.id, gameStartFrame);
            }
          }
          const lastProgress = chipLastProgressFrame.get(data.id) || 0;
          // 900프레임(15초) 동안 진전 없으면 강제 하향 임펄스
          if (gameStartFrame - lastProgress > 900) {
            chip.applyImpulse({ x: (Math.random() - 0.5) * 6000, y: 10000 }, true);
            chipLastProgressFrame.set(data.id, gameStartFrame); // 쿨다운 리셋
          }
        });
        
        // Level 3: Absolute Timeout — 3분(10800프레임) 경과 시 중력 2배 + 중력장 비활성화
        if (gameStartFrame === 10800) {
          const grav = world!.gravity;
          world!.gravity = { x: grav.x, y: grav.y * 2 };
          // 모든 블랙홀/화이트홀의 force를 0으로
          world!.forEachRigidBody(b => {
            const d = b.userData as any;
            if (d?.type === 'blackhole' || d?.type === 'whitehole') {
              d.force = 0;
            }
          });
        }
      }
      
      gameStartFrame++;
      
      if (frameCount % 10 === 0) {
        const ranks = RankingTracker.updateRankings(world!);
        self.postMessage({ type: 'RANKINGS_UPDATE', payload: ranks });
      }
      frameCount++;
      
      broadcastFrame();
      
    }, 1000 / 60);
    
  } else if (type === 'NUDGE') {
    if (world) {
      NudgeSystem.applyNudge(world, payload.force || 150);
    }
  } else if (type === 'STOP') {
    isRunning = false;
    if (stepInterval) clearInterval(stepInterval);
    if (skillInterval) clearInterval(skillInterval);
    if (world) {
      world.free();
      world = null;
    }
  }
};
