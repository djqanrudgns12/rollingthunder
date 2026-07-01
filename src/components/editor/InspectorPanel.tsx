'use client'

import React, { useState } from 'react'
import { useEditorStore, EditorItem } from '@/store/editorStore'
import { Settings2, Map as MapIcon, ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react'

function CollapsibleSection({ title, icon, defaultOpen = true, children }: { title: string, icon?: React.ReactNode, defaultOpen?: boolean, children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[#333]">
      <div 
        onClick={() => setIsOpen(!isOpen)} 
        className="flex justify-between items-center p-3 cursor-pointer hover:bg-[#222] transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-bold text-gray-300">{title}</span>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronLeft className="w-4 h-4 text-gray-500" />}
      </div>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  )
}

function StagePropertiesContent() {
  const { worldHeight, setWorldHeight, wallStyle, setWallStyle, layoutConfig } = useEditorStore()

  const handleWorldHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value)) {
      setWorldHeight(value);
    }
  };

  const lc = layoutConfig || {}
  const startLineY = lc.startLineY ?? (lc.startMarginPercent ? Math.round((worldHeight || 3300) * lc.startMarginPercent) : 70)
  const endMarginPct = Math.round(((lc.endMarginPercent ?? 0.02) * 100) * 10) / 10
  const setLayout = (patch: any) => useEditorStore.setState({ layoutConfig: { ...lc, ...patch } })

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 -mt-2 mb-2">기물 미선택 시 맵 전체 설정</p>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">세로 길이 (World Height)</label>
        <input
          type="number" step={100} value={worldHeight}
          onChange={handleWorldHeightChange}
          className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-[#00FFD0] uppercase tracking-wider">시작선 Y (Start Line)</label>
        <input
          type="number" step={10} value={startLineY}
          onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) setLayout({ startLineY: v, startMarginPercent: undefined }) }}
          className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-[#00FFD0] transition-colors font-mono"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider">종료 여백 % (End Margin)</label>
        <input
          type="number" step={0.5} value={endMarginPct}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setLayout({ endMarginPercent: v / 100 }) }}
          className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-fuchsia-500 transition-colors font-mono"
        />
        <p className="text-[10px] text-gray-600">종료선 Y ≈ {Math.round((worldHeight || 3300) * (1 - (lc.endMarginPercent ?? 0.02)))}</p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider">외벽 스타일 (Wall Style)</label>
        <select
          value={wallStyle}
          onChange={(e) => setWallStyle(e.target.value as any)}
          className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
        >
          <option value="straight">일자 (straight)</option>
          <option value="zigzag">지그재그 (zigzag)</option>
          <option value="narrow">좁게 (narrow 600px)</option>
          <option value="wide">넓게 (wide 900px)</option>
          <option value="funnel">깔때기 (funnel)</option>
          <option value="hourglass">모래시계 (hourglass)</option>
          <option value="diamond">다이아몬드 (diamond)</option>
          <option value="wave">웨이브 (wave)</option>
          <option value="sawtooth">톱니 (sawtooth)</option>
          <option value="asymmetric">비대칭 쏠림 (asymmetric)</option>
        </select>
      </div>
    </div>
  )
}

function ItemPropertiesContent({ selectedItem }: { selectedItem: EditorItem }) {
  const { updateItem } = useEditorStore()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof EditorItem) => {
    const value = parseFloat(e.target.value)
    if (!isNaN(value)) {
      updateItem(selectedItem.id, { [field]: value })
    }
  }

  const handleToggle = (field: keyof EditorItem) => {
    updateItem(selectedItem.id, { [field]: !selectedItem[field] })
  }

  const renderNumberField = (label: string, field: keyof EditorItem, step = 1) => {
    const val = selectedItem[field] as number | undefined
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
        <input
          type="number"
          step={step}
          value={val ?? 0}
          onChange={(e) => handleChange(e, field)}
          className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors font-mono"
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-[#333] -mt-2">
        <p className="text-xs text-blue-400 font-mono break-all">{selectedItem.id}</p>
      </div>

      {/* Transform Group */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider border-b border-[#333] pb-1">변환 (Transform)</h3>
        <div className="grid grid-cols-2 gap-3">
          {renderNumberField('X좌표', 'x', 1)}
          {renderNumberField('Y좌표', 'y', 1)}
          {renderNumberField('너비(W)', 'w', 1)}
          {renderNumberField('높이(H)', 'h', 1)}
          {renderNumberField('각도', 'angle', 1)}
        </div>
      </div>

      {/* Physics / Dynamic Group */}
      <div>
        <h3 className="text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider border-b border-[#333] pb-1">물리 / 동적 속성</h3>
        <div className="space-y-3">
          {renderNumberField('탄성력(Bounciness)', 'restitution', 0.1)}
          {renderNumberField('마찰력', 'friction', 0.1)}
          
          <div className="flex items-center justify-between bg-[#252525] border border-[#333] p-3 rounded-lg mt-2">
            <span className="text-sm font-semibold text-gray-300">좌우 반전 (Flip)</span>
            <button 
              onClick={() => handleToggle('flip')}
              className={`w-10 h-5 rounded-full relative transition-colors ${selectedItem.flip ? 'bg-blue-500' : 'bg-[#444]'}`}
            >
              <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${selectedItem.flip ? 'left-6' : 'left-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 전용 특성 (Detail Properties) Group */}
      <div>
        <h3 className="text-sm font-bold text-white bg-blue-600/30 p-2 rounded mb-3">세부 특성 (Detail Properties)</h3>
        <div className="space-y-3 p-2 bg-[#1a1a1a] rounded border border-[#333]">

          {(selectedItem.type === 'polygon' || selectedItem.type === 'wall') && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">테마 (Theme / Variant)</label>
              <select 
                value={selectedItem.variant || ''} 
                onChange={(e) => useEditorStore.getState().updateItem(selectedItem.id, { variant: e.target.value })}
                className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">기본 (Default)</option>
                <option value="neon">네온 사이버펑크 (neon)</option>
                <option value="circuit">전자 기판 (circuit)</option>
                <option value="matrix">매트릭스 (matrix)</option>
                <option value="lava">용암 대장간 (lava)</option>
                <option value="ice">빙하 얼음 (ice)</option>
                <option value="toxic">맹독 지대 (toxic)</option>
                <option value="crystal">수정 동굴 (crystal)</option>
                <option value="grass">잔디 숲 (grass)</option>
                <option value="gold">황금 신전 (gold)</option>
                <option value="steampunk">스팀펑크 (steampunk)</option>
                <option value="gothic">고딕 호러 (gothic)</option>
                <option value="space">심우주 (space)</option>
                <option value="candy">캔디 랜드 (candy)</option>
                <option value="arcade">레트로 아케이드 (arcade)</option>
                <option value="plasma">플라즈마 에너지 (plasma)</option>
              </select>
            </div>
          )}
          
          {selectedItem.type === 'flipper' && (
            <div className="grid grid-cols-2 gap-3">
              {renderNumberField('스윙 속도', 'swingSpeed', 1)}
              {renderNumberField('복귀 속도', 'returnSpeed', 1)}
              {renderNumberField('스윙 각도', 'swingAngle', 1)}
              {renderNumberField('대기 각도', 'restAngle', 1)}
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">방향 (Side)</label>
                <select 
                  value={selectedItem.side || 'left'} 
                  onChange={(e) => useEditorStore.getState().updateItem(selectedItem.id, { side: e.target.value })}
                  className="w-full bg-[#252525] border border-[#333] hover:border-[#444] rounded p-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
          )}

          {selectedItem.type === 'windmill' && (
            <div className="grid grid-cols-2 gap-3">
              {renderNumberField('회전 속도', 'speed', 1)}
              <div className="col-span-2 text-[10px] text-gray-500">※ 날개 길이와 두께는 Transform의 너비(W), 높이(H)로 조절하세요.</div>
            </div>
          )}

          {selectedItem.type === 'piston' && (
            <div className="grid grid-cols-2 gap-3">
              {renderNumberField('이동 속도', 'speed', 0.5)}
              <div className="col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">도착점 (Waypoint B)</label>
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" placeholder="X" value={selectedItem.waypointB?.x ?? (selectedItem.x + 100)} onChange={(e) => useEditorStore.getState().updateItem(selectedItem.id, { waypointB: { x: Number(e.target.value), y: selectedItem.waypointB?.y ?? selectedItem.y } })} className="bg-[#252525] border border-[#333] rounded p-1.5 text-white text-sm" />
                  <input type="number" placeholder="Y" value={selectedItem.waypointB?.y ?? selectedItem.y} onChange={(e) => useEditorStore.getState().updateItem(selectedItem.id, { waypointB: { x: selectedItem.waypointB?.x ?? (selectedItem.x + 100), y: Number(e.target.value) } })} className="bg-[#252525] border border-[#333] rounded p-1.5 text-white text-sm" />
                </div>
              </div>
            </div>
          )}

          {selectedItem.type === 'windcannon' && (
            <div className="grid grid-cols-2 gap-3">
              {renderNumberField('바람 각도', 'windAngle', 1)}
              {renderNumberField('바람 세기', 'windForce', 10)}
              {renderNumberField('On 프레임', 'onFrames', 10)}
              {renderNumberField('Off 프레임', 'offFrames', 10)}
            </div>
          )}

          {selectedItem.type === 'spinner' && (
            <div className="grid grid-cols-2 gap-3">
              {renderNumberField('회전 속도', 'speed', 1)}
            </div>
          )}

          {(selectedItem.type === 'pin' || selectedItem.type === 'bumper' || selectedItem.type === 'hole') && (
            <div className="grid grid-cols-2 gap-3">
              {renderNumberField('반경 (Radius)', 'radius', 1)}
            </div>
          )}

          {(selectedItem.type === 'blackhole' || selectedItem.type === 'whitehole') && (
            <div className="grid grid-cols-2 gap-3">
              {renderNumberField('영향 반경', 'radius', 10)}
              {renderNumberField('힘(Force)', 'force', 1)}
            </div>
          )}

          {selectedItem.type === 'booster' && (
            <div className="grid grid-cols-2 gap-3">
              {renderNumberField('가속 강도(1~5)', 'power', 1)}
            </div>
          )}

          {selectedItem.type === 'portal' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">채널 색상</label>
              <input type="color" value={selectedItem.color || '#c084fc'} onChange={(e) => useEditorStore.getState().updateItem(selectedItem.id, { color: e.target.value })} className="w-full h-10 rounded cursor-pointer bg-transparent border-0 p-0" />
            </div>
          )}

          {selectedItem.type === 'iceblock' && (
            <div className="grid grid-cols-2 gap-3">
              {renderNumberField('내구도 (HP)', 'hp', 1)}
            </div>
          )}

        </div>
      </div>

      {/* Polygon Special Group */}
      {selectedItem.type === 'polygon' && (
        <div>
          <h3 className="text-xs font-bold text-fuchsia-400 mb-3 uppercase tracking-wider border-b border-[#333] pb-1">이미지 기반 자동 생성</h3>
          <div className="space-y-3">
            <input 
              type="file" 
              accept="image/*" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const { ImageTracer } = await import('@/lib/ImageTracer');
                  const vertices = await ImageTracer.traceImage(file, 5);
                  if (vertices && vertices.length > 2) {
                    updateItem(selectedItem.id, { vertices });
                  } else {
                    alert('윤곽선을 추출할 수 없습니다.');
                  }
                } catch (err) {
                  console.error(err);
                  alert('이미지 처리 중 오류가 발생했습니다.');
                }
                e.target.value = '';
              }} 
              className="text-xs text-gray-400 w-full" 
            />
            <p className="text-[10px] text-gray-500 leading-tight">이미지를 업로드하면 윤곽선을 자동 추출하여 다각형을 변형합니다. (배경이 투명한 PNG 권장)</p>
          </div>
        </div>
      )}

    </div>
  )
}

export default function InspectorPanel() {
  const { items, selectedItemId } = useEditorStore()
  const [isOpen, setIsOpen] = useState(true)
  const selectedItem = items.find(it => it.id === selectedItemId)

  return (
    <div className={`absolute top-14 bottom-0 right-0 w-80 bg-[#1a1a1a]/90 backdrop-blur-md border-l border-[#333] shadow-2xl flex flex-col pointer-events-auto z-20 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      {/* 토글 버튼 */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -left-8 top-1/2 -translate-y-1/2 w-8 h-16 bg-[#222]/90 backdrop-blur-md border-y border-l border-[#333] rounded-l-lg flex items-center justify-center cursor-pointer hover:bg-[#333] transition-colors shadow-[-4px_0_10px_rgba(0,0,0,0.5)] group z-30"
        title={isOpen ? "사이드바 숨기기" : "사이드바 열기"}
      >
        {isOpen ? (
          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
        ) : (
          <ChevronLeft className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
        )}
      </div>

      <div className="flex flex-col h-full overflow-y-auto scrollbar-thin scrollbar-thumb-[#444] scrollbar-track-transparent">
        <CollapsibleSection title="스테이지 속성 (Stage)" icon={<MapIcon className="w-4 h-4 text-blue-400" />} defaultOpen={true}>
          <StagePropertiesContent />
        </CollapsibleSection>

        <CollapsibleSection title="기물 속성 (Item Properties)" icon={<Settings2 className="w-4 h-4 text-blue-400" />} defaultOpen={true}>
          {selectedItem ? (
            <ItemPropertiesContent selectedItem={selectedItem} />
          ) : (
            <div className="text-gray-500 text-sm text-center py-8">선택된 기물이 없습니다.</div>
          )}
        </CollapsibleSection>
      </div>
    </div>
  )
}
