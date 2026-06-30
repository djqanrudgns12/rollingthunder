'use client'

import { useEditorStore } from '@/store/editorStore'
import { Settings2, Trash2, Image as ImageIcon, Map as MapIcon, Maximize2 } from 'lucide-react'

const AVAILABLE_BACKGROUNDS = [
  { id: 'neon_arcade', name: '네온 아케이드', path: '/images/assets/map_bg_neon_arcade.png' },
  { id: 'gravity_abyss', name: '블랙홀의 함정', path: '/images/assets/map_bg_gravity_abyss.png' },
  { id: 'mechanical_factory', name: '톱니바퀴 공장', path: '/images/assets/map_bg_mechanical_factory.png' },
  { id: 'boost_highway', name: '부스트 하이웨이', path: '/images/assets/map_bg_boost_highway.png' },
  { id: 'portal_labyrinth', name: '차원 포탈 미궁', path: '/images/assets/map_bg_portal_labyrinth.png' },
  { id: 'plinko_cascade', name: '플링코 폭포', path: '/images/assets/map_bg_plinko_cascade.png' },
  { id: 'roulette_of_fate', name: '운명의 룰렛', path: '/images/assets/map_bg_roulette_of_fate.png' },
  { id: 'tornado_canyon', name: '토네이도 협곡', path: '/images/assets/map_bg_tornado_canyon.png' },
  { id: 'bounce_mirror', name: '바운스 미러', path: '/images/assets/map_bg_bounce_mirror.png' },
  { id: 'meteor_field', name: '미티어 필드', path: '/images/assets/map_bg_meteor_field.png' },
  { id: 'cyber_dystopia', name: '사이버 디스토피아', path: '/images/assets/bg_cyber_dystopia.png' },
  { id: 'neon_synthwave', name: '네온 신스웨이브', path: '/images/assets/bg_neon_synthwave_ultra.png' },
  { id: 'celestial_clockwork', name: '천체 시계장치', path: '/images/assets/bg_celestial_clockwork.png' },
  { id: 'abyssal_trench', name: '심해 해구', path: '/images/assets/bg_abyssal_trench.png' },
  // AI 생성 에셋 30종 추가
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

function GlobalMapSettings() {
  const { bgImage, setBgImage, wallStyle, setWallStyle, worldHeight, setWorldHeight } = useEditorStore()

  return (
    <div className="w-80 h-full glass-panel flex flex-col overflow-hidden shrink-0 hidden lg:flex">
      <div className="p-4 border-b border-white/10 flex items-center gap-2 bg-black/20">
        <MapIcon className="w-4 h-4 text-blue-400" />
        <h3 className="font-bold text-blue-400 font-outfit tracking-wider uppercase">
          GLOBAL MAP SETTINGS
        </h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
            <ImageIcon className="w-3 h-3" /> Background Image
          </h4>
          <p className="text-[10px] text-gray-500 leading-relaxed mb-2">
            ※ 이미지는 외벽 사이에 완벽히 임베딩되며, 기물 뒤(Z-Index 맨 아래)에 배치됩니다.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div 
              onClick={() => setBgImage(null)}
              className={`cursor-pointer rounded overflow-hidden border-2 transition-all ${!bgImage ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-white/10 hover:border-white/30'}`}
            >
              <div className="w-full h-16 bg-black flex items-center justify-center text-xs text-gray-500">None</div>
              <div className="bg-black/60 p-1 text-[10px] text-center text-white truncate">없음</div>
            </div>
            {AVAILABLE_BACKGROUNDS.map((bg) => (
              <div 
                key={bg.id}
                onClick={() => setBgImage(bg.path)}
                className={`cursor-pointer rounded overflow-hidden border-2 transition-all ${bgImage === bg.path ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'border-white/10 hover:border-white/30'}`}
                title={bg.name}
              >
                <div 
                  className="w-full h-16 bg-cover bg-center"
                  style={{ backgroundImage: `url(${bg.path})` }}
                />
                <div className="bg-black/80 p-1 text-[10px] text-center text-white truncate">{bg.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
            <Maximize2 className="w-3 h-3" /> Layout Settings
          </h4>
          <div>
            <label className="text-xs text-gray-400 block mb-1">World Height (px)</label>
            <input 
              type="number" 
              value={worldHeight} 
              onChange={(e) => setWorldHeight(Number(e.target.value))} 
              className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white focus:outline-none focus:border-blue-500" 
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Wall Style</label>
            <select 
              value={wallStyle} 
              onChange={(e) => setWallStyle(e.target.value as any)} 
              className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="straight">Straight (800px)</option>
              <option value="narrow">Narrow (600px)</option>
              <option value="wide">Wide (900px)</option>
              <option value="zigzag">Zigzag</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PropertiesInspector() {
  const { items, selectedItemId, updateItem, removeItem, setSelectedItemId } = useEditorStore()
  
  const item = items.find(it => it.id === selectedItemId)

  if (!item) {
    return <GlobalMapSettings />
  }

  const handleChange = (field: string, value: any) => {
    updateItem(item.id, { [field]: value })
  }

  return (
    <div className="w-80 h-full glass-panel flex flex-col overflow-hidden shrink-0">
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/20">
        <h3 className="font-bold text-[var(--accent-primary)] font-outfit tracking-wider uppercase flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          {item.type} PROPERTIES
        </h3>
        <button onClick={() => setSelectedItemId(null)} className="text-gray-400 hover:text-white">
          ✕
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* 공통 속성 */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-gray-500 uppercase">Transform</h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">X Position</label>
              <input type="number" value={Math.round(item.x)} onChange={(e) => handleChange('x', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)] transition-colors" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Y Position</label>
              <input type="number" value={Math.round(item.y)} onChange={(e) => handleChange('y', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)] transition-colors" />
            </div>
          </div>
        </div>

        {/* 개별 속성 렌더링 로직 */}
        {item.type === 'wall' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase">Wall Physics</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Width</label>
                <input type="number" value={item.w || 100} onChange={(e) => handleChange('w', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Height</label>
                <input type="number" value={item.h || 20} onChange={(e) => handleChange('h', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-gray-400 block mb-1">Rotation (deg)</label>
                <input type="range" min="0" max="360" value={item.rotation || 0} onChange={(e) => handleChange('rotation', Number(e.target.value))} className="w-full accent-[var(--accent-primary)]" />
                <div className="text-right text-xs text-white mt-1">{item.rotation || 0}°</div>
              </div>
            </div>
          </div>
        )}

        {item.type === 'bumper' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-500 uppercase">Bumper Physics</h4>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Restitution (Bounciness)</label>
              <input type="range" min="0.5" max="2.0" step="0.1" value={item.restitution || 1.4} onChange={(e) => handleChange('restitution', Number(e.target.value))} className="w-full accent-orange-500" />
              <div className="text-right text-xs text-white mt-1">{item.restitution || 1.4}</div>
              <p className="text-[10px] text-gray-500 mt-1">1.0 초과는 에너지를 더해 튕김. 2.0 이상은 폭주를 유발하므로 상한 고정.</p>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Radius</label>
              <input type="number" value={item.radius || 15} onChange={(e) => handleChange('radius', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
            </div>
          </div>
        )}

        {item.type === 'booster' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-[var(--accent-primary)] uppercase drop-shadow-[0_0_5px_var(--accent-primary)]">Hyper Booster</h4>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Direction (Angle)</label>
              <input type="range" min="0" max="360" value={item.rotation || 0} onChange={(e) => handleChange('rotation', Number(e.target.value))} className="w-full accent-[var(--accent-primary)]" />
              <div className="text-right text-xs text-white mt-1">{item.rotation || 0}°</div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Power Level (1-5)</label>
              <input type="range" min="1" max="5" value={item.power || 3} onChange={(e) => handleChange('power', Number(e.target.value))} className="w-full accent-[var(--accent-primary)]" />
              <div className="text-right text-xs text-white mt-1 font-bold text-[var(--accent-primary)]">LV. {item.power || 3}</div>
            </div>
          </div>
        )}

        {item.type === 'windmill' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-red-400 uppercase drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]">Kinematic Mechanism</h4>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Angular Velocity (rad/s)</label>
              <input type="range" min="-10" max="10" step="1" value={item.speed || 3} onChange={(e) => handleChange('speed', Number(e.target.value))} className="w-full accent-red-500" />
              <div className="text-right text-xs text-white mt-1">{item.speed || 3} rad/s</div>
              <p className="text-[10px] text-gray-500 mt-1">음수: 반시계 / 양수: 시계방향</p>
            </div>
          </div>
        )}

        {item.type === 'spinner' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-purple-400 uppercase drop-shadow-[0_0_5px_rgba(168,85,247,0.5)]">Roulette Spinner</h4>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Length (px)</label>
              <input type="range" min="50" max="600" step="10" value={item.w || 200} onChange={(e) => handleChange('w', Number(e.target.value))} className="w-full accent-purple-500" />
              <div className="text-right text-xs text-white mt-1">{item.w || 200} px</div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Thickness (px)</label>
              <input type="range" min="10" max="50" step="5" value={item.h || 20} onChange={(e) => handleChange('h', Number(e.target.value))} className="w-full accent-purple-500" />
              <div className="text-right text-xs text-white mt-1">{item.h || 20} px</div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Angular Velocity (rad/s)</label>
              <input type="range" min="-15" max="15" step="1" value={item.speed || 5} onChange={(e) => handleChange('speed', Number(e.target.value))} className="w-full accent-purple-500" />
              <div className="text-right text-xs text-white mt-1">{item.speed || 5} rad/s</div>
              <p className="text-[10px] text-gray-500 mt-1">음수: 반시계(보라) / 양수: 시계(빨강)</p>
            </div>
          </div>
        )}
        
        {item.type === 'portal' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-purple-400 uppercase drop-shadow-[0_0_5px_rgba(192,132,252,0.5)]">Hyper-Space Link</h4>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Channel Color</label>
              <input type="color" value={item.color || '#c084fc'} onChange={(e) => handleChange('color', e.target.value)} className="w-full h-10 rounded cursor-pointer bg-transparent border-0 p-0" />
            </div>
            <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
              ※ 동일한 색상의 채널로 설정된 포탈끼리 쌍(Pair)으로 연결됩니다.<br/>
              ※ 진입 시 벡터(속도/각도)가 100% 보존됩니다.
            </p>
          </div>
        )}

        {(item.type === 'blackhole' || item.type === 'whitehole') && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-gray-400 uppercase drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">Gravity Well Field</h4>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Field Radius</label>
              <input type="range" min="50" max="300" step="10" value={item.radius || 150} onChange={(e) => handleChange('radius', Number(e.target.value))} className="w-full accent-white" />
              <div className="text-right text-xs text-white mt-1">{item.radius || 150} px</div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Gravity Force (강도)</label>
              <input type="range" min="1" max="10" step="1" value={item.force || 5} onChange={(e) => handleChange('force', Number(e.target.value))} className="w-full accent-white" />
              <div className="text-right text-xs text-white mt-1">Force {item.force || 5}</div>
              <p className="text-[10px] text-gray-500 mt-1">
                {item.type === 'blackhole'
                  ? '칩을 중심으로 빨아들이는 소용돌이(접선 회전 포함). 3=은은, 6=강력, 9+=탈출 곤란.'
                  : '칩을 바깥으로 밀어내는 반발장. 3=은은, 6=강력, 9+=강하게 튕겨냄.'}
              </p>
            </div>
          </div>
        )}

        {/* 함정 구멍: 반경 조절 */}
        {item.type === 'hole' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-red-400 uppercase drop-shadow-[0_0_5px_rgba(255,0,0,0.5)]">Trap Hole</h4>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Hole Radius</label>
              <input type="range" min="15" max="80" step="5" value={item.radius || 30} onChange={(e) => handleChange('radius', Number(e.target.value))} className="w-full accent-red-500" />
              <div className="text-right text-xs text-white mt-1">{item.radius || 30} px</div>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              ※ 칩이 구멍에 빠지면 1.5초 갇힌 뒤, 함정 위쪽(약 500px) 체크포인트로 되돌아갑니다.
            </p>
          </div>
        )}

        {/* 피스톤: 크기, 속도, 도착점 조절 */}
        {item.type === 'piston' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-yellow-400 uppercase drop-shadow-[0_0_5px_rgba(255,204,0,0.5)]">Piston Platform</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Width</label>
                <input type="number" value={item.w || 100} onChange={(e) => handleChange('w', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Height</label>
                <input type="number" value={item.h || 20} onChange={(e) => handleChange('h', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Speed</label>
              <input type="range" min="1" max="10" step="1" value={item.speed || 2} onChange={(e) => handleChange('speed', Number(e.target.value))} className="w-full accent-yellow-400" />
              <div className="text-right text-xs text-white mt-1">Speed {item.speed || 2}</div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-400 block">Waypoint B (도착점)</label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">B.x</label>
                  <input type="number" value={item.waypointB?.x || item.x + 150} onChange={(e) => handleChange('waypointB', { x: Number(e.target.value), y: item.waypointB?.y || item.y })} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">B.y</label>
                  <input type="number" value={item.waypointB?.y || item.y} onChange={(e) => handleChange('waypointB', { x: item.waypointB?.x || item.x + 150, y: Number(e.target.value) })} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">
              ※ A(현재 위치)↔B(도착점) 사이를 sin 곡선으로 부드럽게 왕복합니다.
            </p>
          </div>
        )}
        {/* 신규 장애물들 */}
        {item.type === 'iceblock' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-blue-300 uppercase">Ice Block</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Width</label>
                <input type="number" value={item.w || 60} onChange={(e) => handleChange('w', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Height</label>
                <input type="number" value={item.h || 25} onChange={(e) => handleChange('h', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Durability (HP)</label>
              <input type="number" value={item.hp || 3} onChange={(e) => handleChange('hp', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
            </div>
          </div>
        )}

        {item.type === 'windcannon' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase">Wind Cannon</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Angle (deg)</label>
                <input type="number" value={item.windAngle || 90} onChange={(e) => handleChange('windAngle', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Force</label>
                <input type="number" value={item.windForce || 300} onChange={(e) => handleChange('windForce', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">On Frames</label>
                <input type="number" value={item.onFrames || 180} onChange={(e) => handleChange('onFrames', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Off Frames</label>
                <input type="number" value={item.offFrames || 120} onChange={(e) => handleChange('offFrames', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
            </div>
          </div>
        )}

        {item.type === 'luckygate' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-yellow-400 uppercase">Lucky Gate</h4>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Width</label>
              <input type="number" value={item.w || 140} onChange={(e) => handleChange('w', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
            </div>
          </div>
        )}

        {item.type === 'flipper' && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-red-400 uppercase">Auto Flipper</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Length</label>
                <input type="number" value={item.length || 90} onChange={(e) => handleChange('length', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Side</label>
                <select value={item.side || 'left'} onChange={(e) => handleChange('side', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white">
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Rest Angle</label>
                <input type="number" value={item.restAngle ?? 20} onChange={(e) => handleChange('restAngle', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Swing Angle</label>
                <input type="number" value={item.swingAngle ?? -40} onChange={(e) => handleChange('swingAngle', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white" />
              </div>
            </div>
          </div>
        )}

      </div>
      
      {/* 액션 버튼 */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        <button 
          onClick={() => removeItem(item.id)}
          className="w-full py-2.5 bg-red-500/10 text-red-400 border border-red-500/30 rounded font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500/30 transition-colors group"
        >
          <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
          DELETE ITEM
        </button>
      </div>
    </div>
  )
}
