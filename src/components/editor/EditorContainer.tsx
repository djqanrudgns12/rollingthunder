'use client'

import { useState, useEffect } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { toast } from 'sonner'
import { useEditorStore, EditorItemType } from '@/store/editorStore'
import ToolPalette from './ToolPalette'
import EditorCanvas from './EditorCanvas'
import InspectorPanel from './InspectorPanel'
import EditorToolbar from './EditorToolbar'
import HistoryViewer from './HistoryViewer'
import HistoryTimelinePanel from './HistoryTimelinePanel'
import { Share2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { stampService } from '@/lib/stampService'

export default function EditorContainer() {
  const { items, addItem, tabs, activeTabId, showHistoryPanel, setShowHistoryPanel } = useEditorStore()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<EditorItemType | null>(null)

  const activeTab = tabs.find(t => t.id === activeTabId)
  const isHistoryTab = activeTab?.type === 'history'

  // 미션 이벤트: 에디터 열기
  useEffect(() => {
    stampService.trackEvent('open_editor', 1);
    stampService.flushPlayEvents();
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5픽셀 드래그해야 드래그로 판정하여 클릭 제스처와 구분
      },
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    setActiveType(event.active.data.current?.type || null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    setActiveType(null)
    const { active, over } = event
    
    if (!over) return

    // 팔레트에서 꺼내어 캔버스 위에 드롭했을 경우
    if (active.data.current?.fromPalette && over.id === 'editor-canvas') {
      const type = active.data.current.type as EditorItemType
      
      const activeRect = active.rect.current.translated
      const overRect = over.rect
      if (!activeRect || !overRect) return

      const snapSize = 16
      
      // 드래그 중인 고스트 이미지의 위치를 캔버스 기준 상대 좌표로 변환
      const rawX = activeRect.left - overRect.left + (activeRect.width / 2)
      const rawY = activeRect.top - overRect.top + (activeRect.height / 2)

      // 16x16 그리드 스냅 (Grid Snapping)
      const newX = Math.round(rawX / snapSize) * snapSize
      const newY = Math.round(rawY / snapSize) * snapSize

      // 타입별 "바로 작동하는" 기본값(프리셋에서 검증된 값과 동일 스케일).
      // 새 힘 모델 기준: 중력장 force 는 1~10, 범퍼 탄성 ≤ 2.0.
      const radius =
        type === 'pin' || type === 'bumper' ? 15 :
        type === 'blackhole' ? 150 :
        type === 'whitehole' ? 120 :
        type === 'hole' ? 30 : undefined
      const isPiston = type === 'piston'
      addItem({
        id: `item-${Date.now()}`,
        type,
        x: newX,
        y: newY,
        radius,
        w: type === 'wall' ? 100 : isPiston ? 120 : type === 'spinner' ? 200 : undefined,
        h: type === 'wall' ? 20 : isPiston ? 20 : type === 'spinner' ? 20 : undefined,
        restitution: type === 'bumper' ? 1.4 : undefined,
        friction: 0.1,
        rotation: 0,
        power: type === 'booster' ? 3 : undefined,
        speed: type === 'windmill' || type === 'spinner' ? 5 : isPiston ? 3 : undefined,
        color: type === 'portal' ? '#c084fc' : undefined,
        force: type === 'blackhole' || type === 'whitehole' ? 5 : undefined,
        waypointB: isPiston ? { x: newX + 150, y: newY } : undefined,
      })
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <EditorToolbar />
      
      {/* 툴바 (Export 버튼) — 테스트 플레이는 EditorToolbar/ValidationPanel 의 실제 레이스 브리지로 이관됨 */}
      {!isHistoryTab && (
        <div className="absolute top-20 right-6 z-[200] flex gap-3">
          <button
            onClick={async () => {
              if(items.length === 0) {
                toast.error('맵에 배치된 요소가 없습니다.'); return;
              }
              const code = Math.random().toString(36).substring(2, 8).toUpperCase();
              const store = useEditorStore.getState();
              const supabase = createClient();
              const { error } = await supabase.from('map_presets').insert({
                creator_id: 'guest',
                title: 'Custom Map',
                map_data: {
                  items,
                  worldHeight: store.worldHeight,
                  wallStyle: store.wallStyle,
                  bgImage: store.bgImage,
                  layoutConfig: store.layoutConfig
                },
                share_code: code
              });
              if(error) toast.error('DB 저장 실패: ' + error.message)
              else {
                toast.success('맵 데이터가 서버에 배포되었습니다!');
                toast('대시보드 화면에서 다음 코드를 입력하세요: ' + code, { duration: 10000 });
              }
            }}
            className="flex items-center gap-2 bg-white/10 text-white px-5 py-2.5 rounded-full font-bold hover:bg-white/20 transition-colors border border-white/20 backdrop-blur-md"
          >
            <Share2 className="w-5 h-5" />
            EXPORT
          </button>
        </div>
      )}

      {isHistoryTab ? (
        <div className="w-full h-full pt-14 flex items-center justify-center">
          <HistoryViewer />
        </div>
      ) : (
        <div className="flex w-full h-full max-w-[1600px] mx-auto gap-2 md:gap-4 p-2 md:p-4 z-10 pt-14">
          <ToolPalette />
          <EditorCanvas />
          <InspectorPanel />
          
          {showHistoryPanel && (
            <HistoryTimelinePanel 
              mapId={activeTab?.mapId || null}
              mapTitle={activeTab?.title || ''}
              onClose={() => setShowHistoryPanel(false)}
            />
          )}
        </div>
      )}
      
      {/* 마우스를 따라다니는 고스트 이미지 (Ghosting) */}
      <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
        {activeId && activeType ? (
          <div className="opacity-80 scale-110 pointer-events-none drop-shadow-2xl">
            {activeType === 'pin' && <div className="w-[30px] h-[30px] bg-slate-500 rounded-full border-2 border-white shadow-lg"></div>}
            {activeType === 'bumper' && <div className="w-[30px] h-[30px] bg-orange-500 rounded-full border-2 border-white shadow-[0_0_20px_rgba(255,165,0,0.8)]"></div>}
            {activeType === 'wall' && <div className="w-[100px] h-[20px] bg-white/40 border-2 border-white backdrop-blur-md rounded-md shadow-lg"></div>}
            {activeType === 'booster' && <div className="w-[50px] h-[50px] bg-gradient-to-t from-[var(--accent-primary)] to-transparent opacity-80 border-2 border-[var(--accent-primary)] rounded-md shadow-lg"></div>}
            {activeType === 'windmill' && <div className="w-[100px] h-[100px] border-2 border-red-500 rounded-full bg-red-500/10"></div>}
            {activeType === 'spinner' && <div className="w-[100px] h-[10px] bg-purple-500/50 border border-purple-500 rounded-full shadow-[0_0_15px_purple]"></div>}
            {activeType === 'portal' && <div className="w-[40px] h-[40px] rounded-full border-4 border-purple-500"></div>}
            {activeType === 'blackhole' && <div className="w-[60px] h-[60px] rounded-full border-2 border-white border-dashed bg-black shadow-[0_0_30px_rgba(0,0,0,1)]"></div>}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
