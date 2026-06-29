'use client'

import React, { useState } from 'react'
import { useEditorStore, EditorItemType, EditorItem } from '@/store/editorStore'
import { Plus, Trash2, MapPin, CircleDashed, Zap, Fan, ArrowDownToLine, Loader, Wind, Trophy, MoveDiagonal, Circle, Waypoints, Aperture, Sun, Square, Box, Flag, FlagTriangleRight } from 'lucide-react'

type TabType = 'obstacles' | 'frames' | 'skeleton'

interface ItemDef {
  type: EditorItemType;
  label: string;
  icon?: React.FC<any>;
  imagePath?: string;
  color: string;
}

const CATEGORIES: Record<TabType, ItemDef[]> = {
  obstacles: [
    { type: 'pin', label: '핀 (Pin)', imagePath: '/images/assets/obstacles/obstacle_pin.png', color: 'text-gray-300' },
    { type: 'bumper', label: '범퍼 (Bumper)', imagePath: '/images/assets/obstacles/obstacle_bumper.png', color: 'text-yellow-400' },
    { type: 'booster', label: '부스터 (Booster)', imagePath: '/images/assets/obstacles/obstacle_booster.png', color: 'text-orange-500' },
    { type: 'windmill', label: '풍차 (Windmill)', imagePath: '/images/assets/obstacles/obstacle_windmill.png', color: 'text-blue-400' },
    { type: 'piston', label: '피스톤 (Piston)', imagePath: '/images/assets/obstacles/obstacle_piston.png', color: 'text-red-400' },
    { type: 'spinner', label: '스피너 (Spinner)', icon: Loader, color: 'text-indigo-400' },
    { type: 'windcannon', label: '송풍기 (WindCannon)', icon: Wind, color: 'text-teal-300' },
    { type: 'luckygate', label: '럭키게이트 (LuckyGate)', icon: Trophy, color: 'text-yellow-500' },
    { type: 'flipper', label: '플리퍼 (Flipper)', icon: MoveDiagonal, color: 'text-pink-400' },
    { type: 'hole', label: '구멍 (Hole)', imagePath: '/images/assets/obstacles/obstacle_hole.png', color: 'text-black' },
    { type: 'portal', label: '포탈 (Portal)', imagePath: '/images/assets/obstacles/obstacle_portal.png', color: 'text-purple-500' },
    { type: 'blackhole', label: '블랙홀 (Blackhole)', imagePath: '/images/assets/obstacles/obstacle_blackhole.png', color: 'text-gray-600' },
    { type: 'whitehole', label: '화이트홀 (Whitehole)', imagePath: '/images/assets/obstacles/obstacle_whitehole.png', color: 'text-white' },
  ],
  frames: [
    { type: 'wall', label: '벽 (Wall)', imagePath: '/images/assets/obstacles/obstacle_wall.png', color: 'text-gray-500' },
    { type: 'iceblock', label: '얼음블록 (IceBlock)', icon: Box, color: 'text-cyan-200' },
  ],
  skeleton: [
    { type: 'startline', label: '시작선 (Start)', icon: Flag, color: 'text-green-400' },
    { type: 'endline', label: '도착선 (End)', icon: FlagTriangleRight, color: 'text-red-500' },
  ]
}

export default function ToolboxPanel() {
  const { addItem, selectedItemId, removeItem, clearItems } = useEditorStore()
  const [activeTab, setActiveTab] = useState<TabType>('obstacles')

  const handleAddItem = (type: EditorItemType) => {
    const newItem: EditorItem = {
      id: `${type}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      type,
      x: 400,
      y: 400,
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
      default:
        newItem.w = 40; newItem.h = 40; break;
    }

    addItem(newItem)
  }

  const handleDeleteItem = () => {
    if (selectedItemId) {
      removeItem(selectedItemId)
    }
  }

  return (
    <div className="absolute top-16 left-4 w-72 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl flex flex-col pointer-events-auto h-[calc(100vh-5rem)] z-10 overflow-hidden">
      {/* 탭 네비게이션 */}
      <div className="flex border-b border-[#333] bg-[#222]">
        <button 
          onClick={() => setActiveTab('obstacles')}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'obstacles' ? 'text-white border-b-2 border-blue-500 bg-[#2a2a2a]' : 'text-gray-400 hover:text-gray-200'}`}
        >
          기물
        </button>
        <button 
          onClick={() => setActiveTab('frames')}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'frames' ? 'text-white border-b-2 border-blue-500 bg-[#2a2a2a]' : 'text-gray-400 hover:text-gray-200'}`}
        >
          프레임
        </button>
        <button 
          onClick={() => setActiveTab('skeleton')}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'skeleton' ? 'text-white border-b-2 border-blue-500 bg-[#2a2a2a]' : 'text-gray-400 hover:text-gray-200'}`}
        >
          골격
        </button>
      </div>

      {/* 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-[#444] scrollbar-track-transparent">
        {CATEGORIES[activeTab].map(it => {
          const Icon = it.icon
          return (
            <div
              key={it.type}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-editor-item', it.type);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              // 클릭으로 추가하는 기능도 남겨두기 (기존 기능)
              onClick={() => handleAddItem(it.type)}
              className="w-full flex items-center gap-3 px-3 py-2.5 bg-[#252525] hover:bg-[#333] border border-[#333] hover:border-[#555] rounded-lg transition-colors text-left group cursor-grab active:cursor-grabbing"
              title="클릭 시 추가되거나 캔버스로 드래그하세요"
            >
              <div className="w-12 h-12 bg-[#1a1a1a] border border-[#333] rounded flex items-center justify-center shrink-0 p-1 pointer-events-none">
                {it.imagePath ? (
                  <img src={it.imagePath} alt={it.label} className="w-full h-full object-contain filter drop-shadow-md" />
                ) : Icon && (
                  <Icon className={`w-6 h-6 ${it.color}`} />
                )}
              </div>
              <div className="flex-1 pointer-events-none">
                <div className="text-sm font-semibold text-gray-200 group-hover:text-white">{it.label}</div>
              </div>
              <Plus className="w-4 h-4 text-gray-500 group-hover:text-blue-400 pointer-events-none" />
            </div>
          )
        })}
      </div>

      {/* 하단 도구 영역 */}
      <div className="p-3 border-t border-[#333] bg-[#222] space-y-2">
        <button
          onClick={handleDeleteItem}
          disabled={!selectedItemId}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors text-sm font-bold disabled:opacity-30 disabled:hover:bg-red-500/10"
        >
          <Trash2 className="w-4 h-4" />
          선택 삭제 (Delete)
        </button>
        <button
          onClick={clearItems}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#333] hover:bg-[#444] text-gray-300 rounded-lg transition-colors text-sm font-bold"
        >
          전체 지우기
        </button>
      </div>
    </div>
  )
}
