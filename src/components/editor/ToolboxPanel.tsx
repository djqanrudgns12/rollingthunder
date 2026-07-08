'use client'

import React, { useState } from 'react'
import { useEditorStore, EditorItemType, EditorItem } from '@/store/editorStore'
import { Plus, Trash2, MapPin, CircleDashed, Zap, Fan, ArrowDownToLine, Loader, Wind, Trophy, MoveDiagonal, Circle, Waypoints, Aperture, Sun, Square, Box, Flag, FlagTriangleRight, ChevronLeft, ChevronRight } from 'lucide-react'

type TabType = 'obstacles' | 'frames' | 'backgrounds'

interface ItemDef {
  type: EditorItemType;
  label: string;
  desc?: string;
  icon?: React.FC<any>;
  imagePath?: string;
  color: string;
  variant?: string;
}

const CATEGORIES: Record<TabType, ItemDef[]> = {
  obstacles: [
    { type: 'pin', label: '핀 (Pin)', desc: '공이 닿으면 통통 튕겨내는 가장 기본적인 원형 핀입니다.', imagePath: '/images/assets/obstacles/obstacle_pin.png', color: 'text-gray-300' },
    { type: 'bumper', label: '범퍼 (Bumper)', desc: '공이 강하게 부딪힐수록 더 멀리 튕겨내는 탄성 범퍼입니다.', imagePath: '/images/assets/obstacles/obstacle_bumper.png', color: 'text-yellow-400' },
    { type: 'booster', label: '부스터 (Booster)', desc: '닿는 순간 공의 속도를 특정 방향으로 강하게 가속시킵니다.', imagePath: '/images/assets/obstacles/obstacle_booster.png', color: 'text-orange-500' },
    { type: 'windmill', label: '풍차 (Windmill)', desc: '일정 속도로 회전하며 공의 경로를 방해하거나 쳐냅니다.', imagePath: '/images/assets/obstacles/obstacle_windmill.png', color: 'text-blue-400' },
    { type: 'piston', label: '피스톤 (Piston)', desc: '주기적으로 튀어나와 공을 강제로 밀어냅니다.', imagePath: '/images/assets/obstacles/obstacle_piston.png', color: 'text-red-400' },
    { type: 'spinner', label: '스피너 (Spinner)', desc: '제자리에서 빠르게 회전하며 공을 불규칙하게 튕겨냅니다.', icon: Loader, color: 'text-indigo-400' },
    { type: 'windcannon', label: '송풍기 (WindCannon)', desc: '특정 방향으로 바람을 일으켜 공의 궤적을 밀어냅니다.', imagePath: '/images/assets/obstacles/obstacle_blower.png', color: 'text-teal-300' },
    { type: 'luckygate', label: '럭키게이트 (LuckyGate)', desc: '통과 시 점수나 이로운 효과를 부여하는 특수 게이트입니다.', icon: Trophy, color: 'text-yellow-500' },
    { type: 'flipper', label: '플리퍼 (Flipper)', desc: '핀볼처럼 공을 강하게 쳐서 위로 올려보냅니다.', icon: MoveDiagonal, color: 'text-pink-400' },
    { type: 'hole', label: '구멍 (Hole)', desc: '공이 빠질 수 있는 구멍으로, 맵의 장애물 역할을 합니다.', imagePath: '/images/assets/obstacles/obstacle_hole.png', color: 'text-black' },
    { type: 'portal', label: '포탈 (Portal)', desc: '진입한 공을 연결된 다른 포탈로 즉시 이동시킵니다.', imagePath: '/images/assets/obstacles/obstacle_portal.png', color: 'text-purple-500' },
    { type: 'blackhole', label: '블랙홀 (Blackhole)', desc: '근처의 공을 중심부로 강력하게 빨아들입니다.', imagePath: '/images/assets/obstacles/obstacle_blackhole.png', color: 'text-gray-600' },
    { type: 'whitehole', label: '화이트홀 (Whitehole)', desc: '빨아들인 공을 다른 곳으로 강하게 뱉어냅니다.', imagePath: '/images/assets/obstacles/obstacle_whitehole.png', color: 'text-white' },
  ],
  frames: [
    { type: 'wall', label: '벽 (Wall)', desc: '콘셉트에 맞는 기본적인 경계 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall.png', color: 'text-gray-500' },
    { type: 'wall', variant: 'neon', label: '벽 (네온 사이버펑크)', desc: '화려한 네온 빛을 내는 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_neon.png', color: 'text-pink-400' },
    { type: 'wall', variant: 'circuit', label: '벽 (전자 기판)', desc: '회로가 흐르는 듯한 기판 형태의 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_circuit.png', color: 'text-green-500' },
    { type: 'wall', variant: 'matrix', label: '벽 (매트릭스)', desc: '디지털 데이터가 흐르는 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_matrix.png', color: 'text-green-400' },
    { type: 'wall', variant: 'lava', label: '벽 (용암 대장간)', desc: '뜨거운 열기가 느껴지는 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_lava.png', color: 'text-red-500' },
    { type: 'wall', variant: 'ice', label: '벽 (빙하 얼음)', desc: '차가운 얼음 형태의 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_ice.png', color: 'text-cyan-300' },
    { type: 'wall', variant: 'toxic', label: '벽 (맹독 지대)', desc: '오염된 맹독이 흐르는 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_toxic.png', color: 'text-yellow-400' },
    { type: 'wall', variant: 'crystal', label: '벽 (수정 동굴)', desc: '빛나는 수정이 박힌 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_crystal.png', color: 'text-purple-400' },
    { type: 'wall', variant: 'grass', label: '벽 (잔디 숲)', desc: '자연의 기운을 담은 잔디 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_grass.png', color: 'text-green-600' },
    { type: 'wall', variant: 'gold', label: '벽 (황금 신전)', desc: '고급스러운 황금빛 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_gold.png', color: 'text-yellow-500' },
    { type: 'wall', variant: 'steampunk', label: '벽 (스팀펑크)', desc: '톱니바퀴가 돌아가는 기계 장치 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_steampunk.png', color: 'text-amber-700' },
    { type: 'wall', variant: 'gothic', label: '벽 (고딕 호러)', desc: '으스스한 분위기의 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_gothic.png', color: 'text-red-900' },
    { type: 'wall', variant: 'space', label: '벽 (심우주)', desc: '우주의 신비로움을 담은 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_space.png', color: 'text-indigo-900' },
    { type: 'wall', variant: 'candy', label: '벽 (캔디 랜드)', desc: '달콤한 과자 모양의 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_candy.png', color: 'text-pink-300' },
    { type: 'wall', variant: 'arcade', label: '벽 (레트로 아케이드)', desc: '고전 게임 스타일의 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_arcade.png', color: 'text-red-600' },
    { type: 'wall', variant: 'plasma', label: '벽 (플라즈마 에너지)', desc: '에너지가 요동치는 벽입니다.', imagePath: '/images/assets/obstacles/obstacle_wall_plasma.png', color: 'text-cyan-400' },
    { type: 'iceblock', label: '얼음블록 (IceBlock)', desc: '공이 부딪히면 내구도가 닳고 결국 깨지는 블록입니다.', icon: Box, color: 'text-cyan-200' },
    { type: 'polygon', label: '자유형 블록 (Polygon)', desc: '꼭짓점을 직접 드래그하여 원하는 다각형 모양으로 만들 수 있는 블록입니다.', icon: CircleDashed, color: 'text-fuchsia-400' },
  ]
}

export const AVAILABLE_BACKGROUNDS = [
  { id: 'neon_arcade', name: '네온 아케이드', path: '/images/assets/map_bg_neon_arcade.png' },
  { id: 'gravity_abyss', name: '블랙홀의 함정', path: '/images/assets/map_bg_gravity_abyss.png' },
  { id: 'mechanical_factory', name: '톱니바퀴 공장', path: '/images/assets/map_bg_mechanical_factory.png' },
  { id: 'boost_highway', name: '부스트 하이웨이', path: '/images/assets/map_bg_boost_highway.png' },
  { id: 'portal_labyrinth', name: '차원 포탈 미궁', path: '/images/assets/map_bg_portal_labyrinth.png' },
  { id: 'plinko_cascade', name: '플링코 폭포', path: '/images/assets/map_bg_plinko_cascade.png' },
  { id: 'roulette_of_fate', name: '운명의 룰렛', path: '/images/assets/map_bg_roulette_of_fate.png' },
  { id: 'tornado_canyon', name: '토네이도 협곡', path: '/images/assets/map_bg_tornado_canyon.png' },
  { id: 'bounce_mirror', name: '혼돈의 거울', path: '/images/assets/map_bg_bounce_mirror.png' },
  { id: 'meteor_field', name: '미티어 필드', path: '/images/assets/map_bg_meteor_field.png' },
  { id: 'cyber_dystopia', name: '사이버 디스토피아', path: '/images/assets/bg_cyber_dystopia.png' },
  { id: 'neon_synthwave', name: '네온 신스웨이브', path: '/images/assets/bg_neon_synthwave_ultra.png' },
  { id: 'celestial_clockwork', name: '천체 시계장치', path: '/images/assets/bg_celestial_clockwork.png' },
  { id: 'abyssal_trench', name: '심해 해구', path: '/images/assets/bg_abyssal_trench.png' },
  { id: 'abstract_geometric_void', name: '기하학적 추상', path: '/images/assets/bg_abstract_geometric_void_1782785788732.jpg' },
  { id: 'alien_planet_surface', name: '외계 행성', path: '/images/assets/bg_alien_planet_surface_1782785858731.jpg' },
  { id: 'ancient_mystic_ruins', name: '고대 유적', path: '/images/assets/bg_ancient_mystic_ruins_1782785615064.jpg' },
  { id: 'bioluminescent_jungle', name: '생물발광 정글', path: '/images/assets/bg_bioluminescent_jungle_1782785780805.jpg' },
  { id: 'candy_land', name: '캔디 랜드', path: '/images/assets/bg_candy_land_1782785710474.jpg' },
  { id: 'celestial_sky_palace', name: '천상의 궁전', path: '/images/assets/bg_celestial_sky_palace_1782785761515.jpg' },
  { id: 'clockwork_gears', name: '톱니바퀴 시계', path: '/images/assets/bg_clockwork_gears_1782785770871.jpg' },
  { id: 'crystal_cave', name: '수정 동굴', path: '/images/assets/bg_crystal_cave_1782785736014.jpg' },
  { id: 'cyberpunk_megacity', name: '사이버펑크 시티', path: '/images/assets/bg_cyberpunk_megacity_1782785606020.jpg' },
  { id: 'deep_space_nebula', name: '심우주 성운', path: '/images/assets/bg_deep_space_nebula_1782785644285.jpg' },
  { id: 'desert_oasis', name: '사막 오아시스', path: '/images/assets/bg_desert_oasis_1782785682635.jpg' },
  { id: 'enchanted_forest', name: '요정의 숲', path: '/images/assets/bg_enchanted_forest_1782785674317.jpg' },
  { id: 'floating_islands', name: '부유하는 섬', path: '/images/assets/bg_floating_islands_1782785867391.jpg' },
  { id: 'frozen_tundra', name: '혹한의 툰드라', path: '/images/assets/bg_frozen_tundra_1782785823149.jpg' },
  { id: 'galactic_highway', name: '은하계 도로', path: '/images/assets/bg_galactic_highway_1782785832121.jpg' },
  { id: 'golden_temple', name: '황금 신전', path: '/images/assets/bg_golden_temple_1782785887745.jpg' },
  { id: 'haunted_gothic_castle', name: '고딕 성', path: '/images/assets/bg_haunted_gothic_castle_1782785727034.jpg' },
  { id: 'icy_glacier_cavern', name: '빙하 동굴', path: '/images/assets/bg_icy_glacier_cavern_1782785635405.jpg' },
  { id: 'lava_volcano_core', name: '용암 지대', path: '/images/assets/bg_lava_volcano_core_1782785625035.jpg' },
  { id: 'magma_forge', name: '마그마 대장간', path: '/images/assets/bg_magma_forge_1782785812794.jpg' },
  { id: 'pirate_ship_deck', name: '해적선 갑판', path: '/images/assets/bg_pirate_ship_deck_1782785840910.jpg' },
  { id: 'post_apocalyptic_ruins', name: '아포칼립스', path: '/images/assets/bg_post_apocalyptic_ruins_1782785753197.jpg' },
  { id: 'quantum_realm', name: '양자 영역', path: '/images/assets/bg_quantum_realm_1782785877783.jpg' },
  { id: 'retrowave_sunset', name: '레트로 선셋', path: '/images/assets/bg_retrowave_sunset_1782785719122.jpg' },
  { id: 'samurai_dojo', name: '사무라이 도장', path: '/images/assets/bg_samurai_dojo_1782785850135.jpg' },
  { id: 'steampunk_factory', name: '스팀펑크 공장', path: '/images/assets/bg_steampunk_factory_1782785664737.jpg' },
  { id: 'toxic_wasteland', name: '오염 구역', path: '/images/assets/bg_toxic_wasteland_1782785654564.jpg' },
  { id: 'underwater_atlantis', name: '심해 아틀란티스', path: '/images/assets/bg_underwater_atlantis_1782785691060.jpg' },
  { id: 'virtual_matrix_grid', name: '가상 매트릭스', path: '/images/assets/bg_virtual_matrix_grid_1782785744588.jpg' },
  { id: 'zen_garden', name: '젠 가든', path: '/images/assets/bg_zen_garden_1782785804310.jpg' },
]

export default function ToolboxPanel() {
  const { addItem, selectedItemId, removeItem, clearItems, bgImage, setBgImage } = useEditorStore()
  const [activeTab, setActiveTab] = useState<TabType>('obstacles')
  const [isOpen, setIsOpen] = useState(true)

  const handleAddItem = (type: EditorItemType, variant?: string) => {
    const newItem: EditorItem = {
      id: `${type}_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      type,
      variant,
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
        newItem.w = 100; newItem.h = 20; break;
      case 'iceblock':
        newItem.w = 60; newItem.h = 25; newItem.hp = 3; newItem.maxHp = 3; break;
      case 'windcannon':
        newItem.w = 120; newItem.h = 120; newItem.windAngle = 90; newItem.windForce = 15; newItem.onFrames = 180; newItem.offFrames = 120; break;
      case 'luckygate':
        newItem.w = 140; newItem.h = 20; break;
      case 'flipper':
        newItem.w = 90; newItem.h = 20; newItem.length = 90; newItem.side = 'left'; newItem.restAngle = 30; newItem.swingAngle = -30; newItem.swingSpeed = 30; newItem.returnSpeed = 8; break;
      case 'windmill':
        newItem.w = 100; newItem.h = 10; newItem.speed = 3; break;
      case 'pin':
        newItem.radius = 8; newItem.restitution = 0.4; break;
      case 'bumper':
        newItem.radius = 14; newItem.restitution = 1.4; break;
      case 'hole':
        newItem.radius = 30; break;
      case 'blackhole':
      case 'whitehole':
        newItem.radius = 150; newItem.force = 5; break;
      case 'portal':
        newItem.color = '#c084fc'; break;
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

    addItem(newItem)
  }

  const handleDeleteItem = () => {
    if (selectedItemId) {
      removeItem(selectedItemId)
    }
  }

  return (
    <div className={`absolute top-14 bottom-0 left-0 w-72 bg-[#1a1a1a]/90 backdrop-blur-md border-r border-[#333] shadow-2xl flex flex-col pointer-events-auto z-20 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      {/* 토글 버튼 */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -right-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-[#222]/90 backdrop-blur-md border-y border-r border-[#333] rounded-r-lg flex items-center justify-center cursor-pointer hover:bg-[#333] transition-colors shadow-[4px_0_10px_rgba(0,0,0,0.5)] group z-30"
        title={isOpen ? "사이드바 숨기기" : "사이드바 열기"}
      >
        {isOpen ? (
          <ChevronLeft className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
        )}
      </div>

      <div className="flex flex-col h-full overflow-hidden">
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
          onClick={() => setActiveTab('backgrounds')}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${activeTab === 'backgrounds' ? 'text-white border-b-2 border-blue-500 bg-[#2a2a2a]' : 'text-gray-400 hover:text-gray-200'}`}
        >
          배경
        </button>
      </div>

      {/* 리스트 영역 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-[#444] scrollbar-track-transparent">
        {activeTab !== 'backgrounds' && CATEGORIES[activeTab].map(it => {
          const Icon = it.icon
          return (
            <div
              key={`${it.type}_${it.variant ?? 'default'}`}
              draggable
              onDragStart={(e) => {
                const dragData = JSON.stringify({ type: it.type, variant: it.variant });
                e.dataTransfer.setData('application/x-editor-item', dragData);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              // 클릭으로 추가하는 기능도 남겨두기 (기존 기능)
              onClick={() => handleAddItem(it.type, it.variant)}
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
              <div className="flex-1 pointer-events-none min-w-0">
                <div className="text-sm font-semibold text-gray-200 group-hover:text-white truncate">{it.label}</div>
                {it.desc && (
                  <div className="text-[11px] text-gray-400 group-hover:text-gray-300 line-clamp-2 mt-0.5 leading-tight break-keep">{it.desc}</div>
                )}
              </div>
              <Plus className="w-4 h-4 text-gray-500 group-hover:text-blue-400 pointer-events-none" />
            </div>
          )
        })}

        {activeTab === 'backgrounds' && (
          <div className="grid grid-cols-2 gap-2">
            <div 
              onClick={() => setBgImage(null)}
              className={`cursor-pointer rounded overflow-hidden border-2 transition-all ${!bgImage ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-[#333] hover:border-[#555]'}`}
            >
              <div className="w-full h-20 bg-black flex items-center justify-center text-xs text-gray-500">None</div>
              <div className="bg-[#222] p-1.5 text-xs text-center text-gray-300 truncate">없음</div>
            </div>
            {AVAILABLE_BACKGROUNDS.map((bg) => (
              <div 
                key={bg.id}
                onClick={() => setBgImage(bg.path)}
                className={`cursor-pointer rounded overflow-hidden border-2 transition-all ${bgImage === bg.path ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-[#333] hover:border-[#555]'}`}
                title={bg.name}
              >
                <div 
                  className="w-full h-20 bg-cover bg-center"
                  style={{ backgroundImage: `url(${bg.path})` }}
                />
                <div className="bg-[#222] p-1.5 text-xs text-center text-gray-300 truncate">{bg.name}</div>
              </div>
            ))}
          </div>
        )}
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
    </div>
  )
}
