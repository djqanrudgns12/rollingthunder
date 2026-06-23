'use client'

import { useEditorStore } from '@/store/editorStore'
import { Settings2, Trash2 } from 'lucide-react'

export default function PropertiesInspector() {
  const { items, selectedItemId, updateItem, removeItem, setSelectedItemId } = useEditorStore()
  
  const item = items.find(it => it.id === selectedItemId)

  if (!item) {
    return (
      <div className="w-80 h-full glass-panel flex flex-col items-center justify-center text-center p-6 text-[var(--text-secondary)] shrink-0 hidden lg:flex">
        <Settings2 className="w-12 h-12 mb-4 opacity-30" />
        <p className="text-sm">캔버스에서 블록을 선택하여<br/>속성을 편집하세요.</p>
      </div>
    )
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
              <input type="range" min="0.5" max="3.0" step="0.1" value={item.restitution || 1.5} onChange={(e) => handleChange('restitution', Number(e.target.value))} className="w-full accent-orange-500" />
              <div className="text-right text-xs text-white mt-1">{item.restitution || 1.5}</div>
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
              <label className="text-xs text-gray-400 block mb-1">Gravity Force</label>
              <input type="range" min="1" max="20" step="1" value={item.force || 5} onChange={(e) => handleChange('force', Number(e.target.value))} className="w-full accent-white" />
              <div className="text-right text-xs text-white mt-1">Force {item.force || 5}</div>
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
