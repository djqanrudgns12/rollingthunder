'use client'

import React, { useEffect, useRef } from 'react'
import * as PIXI from 'pixi.js'
import { useEditorStore, EditorItem } from '@/store/editorStore'
import { Viewport } from 'pixi-viewport'
import { SVG_ASSETS } from '@/lib/SvgAssets'

// 에셋 맵핑
const ASSET_MAP: Record<string, string> = {
  pin: '/images/assets/obstacles/obstacle_pin.png',
  bumper: '/images/assets/obstacles/obstacle_bumper.png',
  wall: '/images/assets/obstacles/obstacle_wall.png',
  booster: '/images/assets/obstacles/obstacle_booster.png',
  windmill: '/images/assets/obstacles/obstacle_windmill.png',
  piston: '/images/assets/obstacles/obstacle_piston.png',
  hole: '/images/assets/obstacles/obstacle_hole.png',
  portal: '/images/assets/obstacles/obstacle_portal.png',
  blackhole: '/images/assets/obstacles/obstacle_blackhole.png',
  whitehole: '/images/assets/obstacles/obstacle_whitehole.png',
  spinner: SVG_ASSETS.spinner,
  windcannon: SVG_ASSETS.windcannon,
  luckygate: SVG_ASSETS.luckygate,
  flipper: SVG_ASSETS.flipper,
  iceblock: SVG_ASSETS.iceblock
};

export default function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)
  const viewportRef = useRef<Viewport | null>(null)
  const containerRef = useRef<PIXI.Container | null>(null)
  const containerMapRef = useRef<Map<string, PIXI.Container>>(new Map())
  const bgSpriteRef = useRef<PIXI.TilingSprite | null>(null)

  const { items, selectedItemId, setSelectedItemId, updateItem, gridSnap, bgImage, worldHeight, addItem } = useEditorStore()

  useEffect(() => {
    if (!canvasRef.current) return
    let isDestroyed = false;

    const initPixi = async () => {
      const app = new PIXI.Application()
      ;(app as any)._cancelResize = () => {};

      await app.init({
        canvas: canvasRef.current!,
        resizeTo: window,
        backgroundColor: 0x111111,
        antialias: true
      })
      
      if (isDestroyed) {
        app.destroy(true, { children: true });
        return;
      }
      appRef.current = app

      const viewport = new Viewport({
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        worldWidth: 1600,
        worldHeight: 3000,
        events: app.renderer.events
      })
      
      viewport.drag().pinch().wheel().decelerate()
      app.stage.addChild(viewport)
      viewportRef.current = viewport

      viewport.moveCenter(400, 400)

      // Background
      const bgSprite = new PIXI.TilingSprite(PIXI.Texture.WHITE, 1600, 4000)
      bgSprite.tint = 0x111111;
      bgSprite.position.set(-400, -1000)
      viewport.addChild(bgSprite)
      bgSpriteRef.current = bgSprite

      // Background grid
      const grid = new PIXI.Graphics()
      grid.lineStyle(1, 0x333333, 0.5)
      for (let i = -1000; i <= 2000; i += 50) {
        grid.moveTo(i, -1000).lineTo(i, 4000)
      }
      for (let i = -1000; i <= 4000; i += 50) {
        grid.moveTo(-1000, i).lineTo(2000, i)
      }
      viewport.addChild(grid)

      // Game Boundaries (실제 게임 지그재그 외벽 동기화)
      const boundaries = new PIXI.Graphics()
      viewport.addChild(boundaries)
      
      const drawBoundaries = () => {
        boundaries.clear()
        boundaries.lineStyle(6, 0x00ffff, 0.4) // 약간 투명한 사이안 색상으로 벽 표시
        
        const wHeight = useEditorStore.getState().worldHeight || 3000
        
        // Left Zigzag Wall
        boundaries.moveTo(0, -1000)
        for (let y = -1000; y <= wHeight + 1000; y += 100) {
          const isIndent = Math.abs(y) % 200 === 100
          boundaries.lineTo(isIndent ? 20 : 0, y)
        }
        
        // Right Zigzag Wall
        boundaries.moveTo(800, -1000)
        for (let y = -1000; y <= wHeight + 1000; y += 100) {
          const isIndent = Math.abs(y) % 200 === 100
          boundaries.lineTo(isIndent ? 780 : 800, y)
        }

        // Start / End Line Guides (희미하게)
        boundaries.lineStyle(4, 0x00ff00, 0.2)
        boundaries.moveTo(0, 70).lineTo(800, 70)
        
        boundaries.lineStyle(4, 0xff0000, 0.2)
        boundaries.moveTo(0, wHeight - 280).lineTo(800, wHeight - 280)
      }
      
      // 상태 변화 구독하여 바운더리 다시 그리기
      drawBoundaries()
      useEditorStore.subscribe((state) => {
        if (state.worldHeight !== (drawBoundaries as any).lastHeight) {
          (drawBoundaries as any).lastHeight = state.worldHeight;
          drawBoundaries();
        }
      });

      const container = new PIXI.Container()
      viewport.addChild(container)
      containerRef.current = container

      // Preload assets
      const assetsToLoad = Object.values(ASSET_MAP);
      await Promise.all(assetsToLoad.map(url => PIXI.Assets.load(url).catch(() => null)));
      
      // 앱 스테이지 인터랙션 활성화 (전역 드래그/리사이즈용)
      app.stage.eventMode = 'static';
      app.stage.hitArea = new PIXI.Rectangle(-10000, -10000, 20000, 20000);
    }

    initPixi()

    return () => {
      isDestroyed = true;
      if (viewportRef.current) {
        viewportRef.current.destroy();
        viewportRef.current = null;
      }
      if (appRef.current) {
        try {
          appRef.current.destroy(false, { children: true });
        } catch (e) {}
        appRef.current = null;
      }
    }
  }, [])

  // 배경 업데이트
  useEffect(() => {
    if (bgSpriteRef.current && bgImage) {
      PIXI.Assets.load(bgImage).then(tex => {
        if (bgSpriteRef.current) {
          bgSpriteRef.current.texture = tex;
          bgSpriteRef.current.tint = 0xffffff;
        }
      }).catch(() => {});
    }
  }, [bgImage])

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const ctrlCmd = e.ctrlKey || e.metaKey
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useEditorStore.getState()
        if (state.selectedItemId) state.removeItem(state.selectedItemId)
      }
      else if (ctrlCmd && e.key === 'z') {
        e.preventDefault()
        if (e.shiftKey) useEditorStore.getState().redo()
        else useEditorStore.getState().undo()
      }
      else if (ctrlCmd && e.key === 'y') {
        e.preventDefault()
        useEditorStore.getState().redo()
      }
      else if (ctrlCmd && e.key === 'c') {
        const state = useEditorStore.getState()
        if (state.selectedItemId) {
          const item = state.items.find(it => it.id === state.selectedItemId)
          if (item) state.setClipboard(item)
        }
      }
      else if (ctrlCmd && e.key === 'v') {
        const state = useEditorStore.getState()
        if (state.clipboard) {
          const newItem = { ...state.clipboard, id: `${state.clipboard.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, x: state.clipboard.x + 20, y: state.clipboard.y + 20 }
          state.addItem(newItem)
          state.setSelectedItemId(newItem.id)
        }
      }
      else if (ctrlCmd && e.key === 'd') {
        e.preventDefault()
        const state = useEditorStore.getState()
        if (state.selectedItemId) {
          const item = state.items.find(it => it.id === state.selectedItemId)
          if (item) {
            const newItem = { ...item, id: `${item.type}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, x: item.x + 20, y: item.y + 20 }
            state.addItem(newItem)
            state.setSelectedItemId(newItem.id)
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // 드래그 앤 드롭으로 캔버스에 추가
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('application/x-editor-item') as any;
    if (!type) return;

    if (!viewportRef.current || !canvasRef.current) return;
    
    // Get mouse coordinates relative to the canvas
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert screen coordinates to world coordinates
    const worldPos = viewportRef.current.toWorld(x, y);

    const newItem: EditorItem = {
      id: `${type}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      type,
      x: Math.round(worldPos.x),
      y: Math.round(worldPos.y),
      speed: 1.0,
      restitution: 0.5,
      friction: 0.1,
      flip: false
    }
    
    // 타입별 초기 기하 값 할당
    switch(type) {
      case 'wall':
      case 'piston':
      case 'startline':
      case 'endline':
        newItem.w = 100; newItem.h = 20; break;
      case 'iceblock':
        newItem.w = 60; newItem.h = 25; newItem.hp = 3; newItem.maxHp = 3; break;
      case 'windcannon':
        newItem.w = 120; newItem.h = 120; newItem.windAngle = 90; newItem.windForce = 15; break;
      case 'luckygate':
        newItem.w = 140; newItem.h = 20; break;
      case 'flipper':
        newItem.w = 90; newItem.h = 20; newItem.length = 90; newItem.side = 'left'; newItem.restAngle = 30; newItem.swingAngle = -30; break;
      case 'polygon':
        newItem.w = 100; newItem.h = 100;
        newItem.vertices = [
          { x: -50, y: -50 },
          { x: 50, y: -50 },
          { x: 50, y: 50 },
          { x: -50, y: 50 }
        ];
        break;
      default:
        newItem.w = 40; newItem.h = 40; break;
    }

    addItem(newItem);
    setSelectedItemId(newItem.id);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Allows the drop
    e.dataTransfer.dropEffect = 'copy';
  };

  // 렌더링 로직 (리사이즈 및 선택 효과 등 개선)
  useEffect(() => {
    if (!containerRef.current || !viewportRef.current || !appRef.current) return

    const container = containerRef.current
    const currentIds = new Set(items.map(it => it.id))

    for (const [id, c] of containerMapRef.current.entries()) {
      if (!currentIds.has(id)) {
        container.removeChild(c)
        c.destroy({ children: true })
        containerMapRef.current.delete(id)
      }
    }

    items.forEach(item => {
      let c = containerMapRef.current.get(item.id)
      let sprite: PIXI.Sprite | PIXI.Graphics | null = null;
      let selectionG: PIXI.Graphics | null = null;
      let resizeHandles: PIXI.Container | null = null;

      if (!c) {
        c = new PIXI.Container()
        c.eventMode = 'dynamic'
        c.cursor = 'pointer'
        
        let isDragging = false
        let offset = { x: 0, y: 0 }

        c.on('pointerdown', (e) => {
          e.stopPropagation()
          setSelectedItemId(item.id)
          if (viewportRef.current) viewportRef.current.pause = true
          isDragging = true
          const pos = e.data.getLocalPosition(container)
          offset = { x: c!.x - pos.x, y: c!.y - pos.y }
          
          const onGlobalMove = (moveEvent: any) => {
            if (!isDragging) return
            const pos = moveEvent.data.getLocalPosition(container)
            let newX = pos.x + offset.x
            let newY = pos.y + offset.y
            
            const snap = useEditorStore.getState().gridSnap
            if (snap) {
              newX = Math.round(newX / 10) * 10
              newY = Math.round(newY / 10) * 10
            }

            c!.position.set(newX, newY)
            updateItem(item.id, { x: newX, y: newY })
          }

          const onGlobalUp = () => {
            isDragging = false
            if (viewportRef.current) viewportRef.current.pause = false
            appRef.current?.stage.off('pointermove', onGlobalMove)
            appRef.current?.stage.off('pointerup', onGlobalUp)
            appRef.current?.stage.off('pointerupoutside', onGlobalUp)
          }

          appRef.current?.stage.on('pointermove', onGlobalMove)
          appRef.current?.stage.on('pointerup', onGlobalUp)
          appRef.current?.stage.on('pointerupoutside', onGlobalUp)
        })

        // Create inner sprite or graphics
        if (ASSET_MAP[item.type]) {
          const tex = PIXI.Assets.get(ASSET_MAP[item.type]) || PIXI.Texture.from(ASSET_MAP[item.type]);
          sprite = new PIXI.Sprite(tex);
          sprite.anchor.set(0.5);
          sprite.name = 'sprite';
          c.addChild(sprite);
        } else {
          sprite = new PIXI.Graphics();
          sprite.name = 'sprite';
          c.addChild(sprite);
        }

        // Selection graphic
        selectionG = new PIXI.Graphics();
        selectionG.name = 'selection';
        c.addChild(selectionG);

        // Resize Handles
        resizeHandles = new PIXI.Container();
        resizeHandles.name = 'resizeHandles';
        resizeHandles.visible = false;
        c.addChild(resizeHandles);

        if (item.type !== 'polygon') {
          const handleTypes = ['tl', 'tc', 'tr', 'cl', 'cr', 'bl', 'bc', 'br'];
        handleTypes.forEach(type => {
            const h = new PIXI.Graphics();
            h.beginFill(0xffffff);
            h.lineStyle(1, 0x00aaff);
            h.drawRect(-5, -5, 10, 10);
            h.endFill();
            h.name = type;
            h.eventMode = 'dynamic';
            
            if(type === 'tl' || type === 'br') h.cursor = 'nwse-resize';
            else if(type === 'tr' || type === 'bl') h.cursor = 'nesw-resize';
            else if(type === 'tc' || type === 'bc') h.cursor = 'ns-resize';
            else if(type === 'cl' || type === 'cr') h.cursor = 'ew-resize';

            let isResizing = false;
            let startW = 0, startH = 0, startR = 0;
            let startDragPos = {x: 0, y: 0};

            h.on('pointerdown', (e) => {
                e.stopPropagation();
                if (viewportRef.current) viewportRef.current.pause = true;
                isResizing = true;
                startDragPos = e.data.getLocalPosition(container);
                
                const currentItem = useEditorStore.getState().items.find(it => it.id === item.id);
                if (!currentItem) return;
                startW = currentItem.w || 40;
                startH = currentItem.h || 40;
                startR = currentItem.radius || startW/2;

                const onResizeMove = (moveEvent: any) => {
                    if(!isResizing) return;
                    const pos = moveEvent.data.getLocalPosition(container);
                    const dx = pos.x - startDragPos.x;
                    const dy = pos.y - startDragPos.y;
                    
                    let newW = startW;
                    let newH = startH;
                    let newR = startR;

                    // Proportional scaling for circles/pins/bumpers
                    const isCircle = currentItem.type === 'pin' || currentItem.type === 'bumper' || currentItem.type === 'portal';

                    if (isCircle) {
                        // 대각선 드래그로 스케일 적용 (간단히 dx + dy 의 평균으로 처리)
                        const delta = (Math.abs(dx) > Math.abs(dy) ? dx : dy);
                        // 방향성에 따라 부호 결정
                        const sign = (type === 'br' || type === 'cr' || type === 'bc' || type === 'tr') ? 1 : -1;
                        newR = Math.max(5, startR + sign * delta);
                        newW = newR * 2;
                        newH = newR * 2;
                    } else {
                        if (type.includes('r')) newW = Math.max(10, startW + dx * 2);
                        if (type.includes('l')) newW = Math.max(10, startW - dx * 2);
                        if (type.includes('b')) newH = Math.max(10, startH + dy * 2);
                        if (type.includes('t')) newH = Math.max(10, startH - dy * 2);
                    }

                    const snap = useEditorStore.getState().gridSnap;
                    if (snap) {
                        newW = Math.round(newW / 10) * 10;
                        newH = Math.round(newH / 10) * 10;
                        newR = Math.round(newR / 10) * 10;
                    }

                    if (isCircle) {
                        updateItem(item.id, { radius: newR, w: newW, h: newH });
                    } else {
                        updateItem(item.id, { w: newW, h: newH });
                    }
                }

                const onResizeUp = () => {
                    isResizing = false;
                    if (viewportRef.current) viewportRef.current.pause = false;
                    appRef.current?.stage.off('pointermove', onResizeMove);
                    appRef.current?.stage.off('pointerup', onResizeUp);
                    appRef.current?.stage.off('pointerupoutside', onResizeUp);
                }

                appRef.current?.stage.on('pointermove', onResizeMove);
                appRef.current?.stage.on('pointerup', onResizeUp);
                appRef.current?.stage.on('pointerupoutside', onResizeUp);
            });

            resizeHandles!.addChild(h);
        });
        }

        container.addChild(c)
        containerMapRef.current.set(item.id, c)
      } else {
        sprite = c.getChildByName('sprite') as any;
        selectionG = c.getChildByName('selection') as any;
        resizeHandles = c.getChildByName('resizeHandles') as any;
      }

      const isSelected = selectedItemId === item.id
      c.alpha = item.flip ? 0.8 : 1

      c.position.set(item.x, item.y)
      c.rotation = (item.angle || 0) * Math.PI / 180

      let drawW = item.w || 40
      let drawH = item.h || 40
      let drawR = item.radius || drawW/2;

      const isCircleType = item.type === 'pin' || item.type === 'bumper' || item.type === 'portal';

      if (sprite instanceof PIXI.Sprite) {
        sprite.width = drawW;
        sprite.height = item.radius ? drawW : drawH;
        if (isCircleType) {
            sprite.width = sprite.height = drawR * 2;
        }
      } else if (sprite instanceof PIXI.Graphics) {
        sprite.clear();
        sprite.beginFill(0x444444, 0.8)
        if (item.type === 'startline') {
          sprite.lineStyle(2, 0x00ff00)
          sprite.drawRect(-drawW/2, -drawH/2, drawW, drawH)
        } else if (item.type === 'endline') {
          sprite.lineStyle(2, 0xff0000)
          sprite.drawRect(-drawW/2, -drawH/2, drawW, drawH)
        } else if (item.type === 'iceblock' || item.type === 'luckygate') {
          sprite.drawRect(-drawW/2, -drawH/2, drawW, drawH)
        } else if (item.type === 'flipper') {
          const len = item.length || 90
          sprite.drawRect(item.side === 'left' ? 0 : -len, -10, len, 20)
        } else if (item.type === 'polygon') {
          const vertices = item.vertices || [
            { x: -50, y: -50 },
            { x: 50, y: -50 },
            { x: 50, y: 50 },
            { x: -50, y: 50 }
          ];
          sprite.lineStyle(2, 0xff00ff);
          sprite.beginFill(0xff00ff, 0.2);
          sprite.moveTo(vertices[0].x, vertices[0].y);
          for (let i = 1; i < vertices.length; i++) {
            sprite.lineTo(vertices[i].x, vertices[i].y);
          }
          sprite.closePath();
          sprite.endFill();
        } else {
          sprite.drawCircle(0, 0, drawR)
        }
        if (item.type !== 'polygon') {
          sprite.endFill()
        }
      }

      selectionG!.clear();
      if (resizeHandles) resizeHandles.visible = isSelected;

      if (isSelected) {
        // Selection highlight (두꺼운 테두리)
        selectionG!.lineStyle(3, 0x00aaff, 1);
        
        if (item.type === 'polygon') {
          const vertices = item.vertices || [];
          if (vertices.length > 0) {
            selectionG!.moveTo(vertices[0].x, vertices[0].y);
            for (let i = 1; i < vertices.length; i++) {
              selectionG!.lineTo(vertices[i].x, vertices[i].y);
            }
            selectionG!.closePath();
          }

          // Dynamic Handles for Polygon
          // First, clean up old handles
          resizeHandles!.children.forEach(child => child.destroy());
          resizeHandles!.removeChildren();

          vertices.forEach((v, idx) => {
            const h = new PIXI.Graphics();
            h.beginFill(0xffffff);
            h.lineStyle(1, 0x00aaff);
            h.drawCircle(0, 0, 6);
            h.endFill();
            h.position.set(v.x, v.y);
            h.eventMode = 'dynamic';
            h.cursor = 'crosshair';
            
            let isResizing = false;
            let startDragPos = { x: 0, y: 0 };
            let startV = { x: 0, y: 0 };

            h.on('pointerdown', (e) => {
                e.stopPropagation();
                if (viewportRef.current) viewportRef.current.pause = true;
                isResizing = true;
                startDragPos = e.data.getLocalPosition(container);
                
                const currentItem = useEditorStore.getState().items.find(it => it.id === item.id);
                if (!currentItem || !currentItem.vertices) return;
                startV = { x: currentItem.vertices[idx].x, y: currentItem.vertices[idx].y };

                const onResizeMove = (moveEvent: any) => {
                    if(!isResizing) return;
                    const pos = moveEvent.data.getLocalPosition(container);
                    const dx = pos.x - startDragPos.x;
                    const dy = pos.y - startDragPos.y;
                    
                    let newX = startV.x + dx;
                    let newY = startV.y + dy;

                    const snap = useEditorStore.getState().gridSnap;
                    if (snap) {
                        newX = Math.round(newX / 10) * 10;
                        newY = Math.round(newY / 10) * 10;
                    }

                    const newVertices = [...currentItem.vertices!];
                    newVertices[idx] = { x: newX, y: newY };
                    updateItem(item.id, { vertices: newVertices });
                }

                const onResizeUp = () => {
                    isResizing = false;
                    if (viewportRef.current) viewportRef.current.pause = false;
                    appRef.current?.stage.off('pointermove', onResizeMove);
                    appRef.current?.stage.off('pointerup', onResizeUp);
                    appRef.current?.stage.off('pointerupoutside', onResizeUp);
                }

                appRef.current?.stage.on('pointermove', onResizeMove);
                appRef.current?.stage.on('pointerup', onResizeUp);
                appRef.current?.stage.on('pointerupoutside', onResizeUp);
            });
            resizeHandles!.addChild(h);
          });
        } else if (isCircleType) {
            selectionG!.drawCircle(0, 0, drawR + 2);
            // Position handles for circle
            ['tl', 'tc', 'tr', 'cl', 'cr', 'bl', 'bc', 'br'].forEach(type => {
                const h = resizeHandles!.getChildByName(type);
                if(h) {
                    const angleMap: any = { 'cr': 0, 'br': Math.PI/4, 'bc': Math.PI/2, 'bl': 3*Math.PI/4, 'cl': Math.PI, 'tl': 5*Math.PI/4, 'tc': 3*Math.PI/2, 'tr': 7*Math.PI/4 };
                    const a = angleMap[type];
                    h.position.set((drawR+2) * Math.cos(a), (drawR+2) * Math.sin(a));
                }
            });
        } else {
            const hw = drawW/2;
            const hh = drawH/2;
            selectionG!.drawRect(-hw - 2, -hh - 2, drawW + 4, drawH + 4);
            // Position handles for rect
            ['tl', 'tc', 'tr', 'cl', 'cr', 'bl', 'bc', 'br'].forEach(type => {
                const h = resizeHandles!.getChildByName(type);
                if(h) {
                    if(type === 'tl') h.position.set(-hw, -hh);
                    if(type === 'tc') h.position.set(0, -hh);
                    if(type === 'tr') h.position.set(hw, -hh);
                    if(type === 'cl') h.position.set(-hw, 0);
                    if(type === 'cr') h.position.set(hw, 0);
                    if(type === 'bl') h.position.set(-hw, hh);
                    if(type === 'bc') h.position.set(0, hh);
                    if(type === 'br') h.position.set(hw, hh);
                }
            });
        }
      }
    })
  }, [items, selectedItemId, setSelectedItemId, updateItem])

  useEffect(() => {
    if (!viewportRef.current) return
    const vp = viewportRef.current
    const onPointerDown = (e: any) => {
      if (e.target === vp) {
        setSelectedItemId(null)
      }
    }
    vp.on('pointerdown', onPointerDown)
    return () => {
      vp.off('pointerdown', onPointerDown)
    }
  }, [setSelectedItemId])

  return (
    <div 
      className="absolute inset-0 w-full h-full bg-[#111]"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <canvas ref={canvasRef} className="w-full h-full outline-none" tabIndex={0} />
    </div>
  )
}
