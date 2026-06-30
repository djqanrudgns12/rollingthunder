'use client'

import React, { useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { Settings2, Trash2, Image as ImageIcon, Map as MapIcon, Maximize2, Clock } from 'lucide-react'
import HistoryTimelineModal from './HistoryTimelineModal'


function GlobalMapSettings() {
  const { wallStyle, setWallStyle, worldHeight, setWorldHeight, tabs, activeTabId } = useEditorStore()
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <>
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

      <div className="p-4 border-t border-white/10 bg-black/20 mt-auto">
        <button 
          onClick={() => setShowHistoryModal(true)}
          className="w-full py-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded font-bold text-sm flex items-center justify-center gap-2 hover:bg-purple-500/30 transition-colors group"
        >
          <Clock className="w-4 h-4 group-hover:-rotate-90 transition-transform duration-300" />
          작업 내역 타임라인 보기
        </button>
      </div>
    </div>
    
    {showHistoryModal && (
      <HistoryTimelineModal 
        mapId={activeTab?.mapId || null}
        mapTitle={activeTab?.title || ''}
        onClose={() => setShowHistoryModal(false)}
      />
    )}
    </>
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
