'use client'

import React from 'react'
import { useEditorStore } from '@/store/editorStore'
import { Settings2, Trash2, Image as ImageIcon, Map as MapIcon, Maximize2 } from 'lucide-react'
import FloatingPanel from './FloatingPanel'

function GlobalMapSettings() {
  const { wallStyle, setWallStyle, worldHeight, setWorldHeight } = useEditorStore()

  return (
    <FloatingPanel 
      title="GLOBAL MAP SETTINGS" 
      icon={<MapIcon className="w-4 h-4 text-blue-400" />}
      width="w-80"
      style={{ top: '80px', right: '20px' }}
    >
      <div className="flex-1 p-4 space-y-6">
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
    </FloatingPanel>
  )
}

export default function PropertiesInspector() {
  const { items, selectedItemId, updateItem, removeItem, setSelectedItemId } = useEditorStore()
  
  const item = items.find(it => it.id === selectedItemId)

  const handleChange = (field: string, value: any) => {
    if (!item) return;
    updateItem(item.id, { [field]: value })
  }

  return (
    <>
      {/* 스테이지 속성은 항상 표시 */}
      <GlobalMapSettings />

      {/* 기물 선택 시 나타나는 기물 속성 패널 */}
      {item && (
        <FloatingPanel 
          title={`${item.type} PROPERTIES`} 
          icon={<Settings2 className="w-4 h-4 text-[var(--accent-primary)]" />}
          onClose={() => setSelectedItemId(null)}
          width="w-80"
          style={{ bottom: '20px', right: '20px' }}
        >
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
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Width (W)</label>
                  <input type="number" value={Math.round(item.w || item.radius || 0)} onChange={(e) => handleChange('w', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)] transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Height (H)</label>
                  <input type="number" value={Math.round(item.h || item.radius || 0)} onChange={(e) => handleChange('h', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)] transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Angle</label>
                <input type="number" value={Math.round(item.rotation || 0)} onChange={(e) => handleChange('rotation', Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)] transition-colors" />
              </div>
            </div>

            {/* 물리/동적 속성 */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase">Physics / Dynamic</h4>
              {(item.type === 'spinner' || item.type === 'windmill' || item.type === 'piston') && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Speed</label>
                  <input type="number" value={item.speed ?? 1} onChange={(e) => handleChange('speed', Number(e.target.value))} step="0.5" className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)] transition-colors" />
                </div>
              )}
              {item.type === 'bumper' && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Bounciness</label>
                  <input type="number" value={item.restitution ?? 1.5} onChange={(e) => handleChange('restitution', Number(e.target.value))} step="0.1" className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)] transition-colors" />
                </div>
              )}
              {['booster', 'blackhole', 'whitehole'].includes(item.type) && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Power / Force</label>
                  <input type="number" value={item.power ?? item.force ?? 1} onChange={(e) => handleChange(item.type === 'booster' ? 'power' : 'force', Number(e.target.value))} step="0.5" className="w-full bg-black/40 border border-white/10 rounded p-1.5 text-sm text-white focus:outline-none focus:border-[var(--accent-primary)] transition-colors" />
                </div>
              )}
              {item.type === 'flipper' && (
                <div className="flex items-center justify-between mt-2">
                  <label className="text-xs text-gray-400">Flip (Left/Right)</label>
                  <button 
                    onClick={() => handleChange('flipX', !item.flipX)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${item.flipX ? 'bg-[var(--accent-primary)]' : 'bg-gray-600'}`}
                  >
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${item.flipX ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              )}
            </div>

            {/* 비주얼 속성 */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-gray-500 uppercase">Visual</h4>
              {item.type === 'portal' && (
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Color (Hex)</label>
                  <input type="color" value={item.color || '#c084fc'} onChange={(e) => handleChange('color', e.target.value)} className="w-full h-8 bg-black/40 border border-white/10 rounded p-0 text-white cursor-pointer" />
                </div>
              )}
            </div>

            {/* 컴포넌트 특수 속성 */}
            {item.type === 'flipper' && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase">Flipper Setting</h4>
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
        </FloatingPanel>
      )}
    </>
  )
}
