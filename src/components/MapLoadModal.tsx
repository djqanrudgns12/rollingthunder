'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useUIStore } from '@/store/uiStore'
import { useGameStore } from '@/store/gameStore'
import { toast } from 'sonner'
import { X, Search, Map } from 'lucide-react'

interface MapLoadModalProps {
  isOpen: boolean
  onClose: () => void
}

// id 는 반드시 MapPresets.ts 의 프리셋 키와 일치해야 한다('random' 은 랜덤 생성).
export const DEFAULT_MAPS = [
  { id: 'random', title: '랜덤 맵', type: '매번 새로운 배치', length: '', complexity: '' },
  { id: 'neon_arcade', title: '네온 아케이드', type: '범퍼·부스터·풍차', length: '미들', complexity: '중간' },
  { id: 'gravity_abyss', title: '블랙홀의 함정', type: '블랙홀·화이트홀·핀', length: '미들', complexity: '복잡' },
  { id: 'mechanical_factory', title: '톱니바퀴 공장', type: '풍차·고탄성벽', length: '롱', complexity: '복잡' },
  { id: 'boost_highway', title: '부스트 하이웨이', type: '초고속 부스터 스프린트', length: '숏', complexity: '단순' },
  { id: 'portal_labyrinth', title: '차원 포탈 미궁', type: '포탈 순간이동·밀폐 방', length: '미들', complexity: '복잡' },
  { id: 'plinko_cascade', title: '플링코 폭포', type: '핀 120+개 순수 운', length: '롱', complexity: '복잡' },
  { id: 'roulette_of_fate', title: '운명의 룰렛', type: '거대 깔때기 병목', length: '숏', complexity: '중간' },
  { id: 'tornado_canyon', title: '토네이도 협곡', type: '블랙홀+풍차 회오리', length: '롱', complexity: '중간' },
  { id: 'bounce_mirror', title: '바운스 미러', type: '좌우 대칭·초고탄성', length: '미들', complexity: '단순' },
  { id: 'meteor_field', title: '운석 지대', type: '범퍼만 25+개 벽없음', length: '롱', complexity: '중간' },
]

export default function MapLoadModal({ isOpen, onClose }: MapLoadModalProps) {
  const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default')
  const [mapCode, setMapCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { setCustomMapData, setCustomMapTitle } = useUIStore()
  const { setSelectedMapPreset } = useGameStore()

  if (!isOpen) return null

  const handleLoadCustomMap = async () => {
    if (!mapCode.trim()) return
    setIsLoading(true)
    const { data, error } = await supabase
      .from('map_presets')
      .select('map_data, title')
      .eq('share_code', mapCode.toUpperCase())
      .single()
      
    setIsLoading(false)
    
    if (error || !data) {
      toast.error('유효하지 않은 맵 코드이거나 찾을 수 없습니다.')
      return
    }
    
    setCustomMapData(data.map_data)
    setCustomMapTitle(data.title)
    toast.success(`[${data.title}] 맵을 성공적으로 불러왔습니다!`)
    onClose()
  }

  const handleLoadDefaultMap = (mapId: string) => {
    // 커스텀 맵 데이터를 비우고(워커는 customMapData를 우선시함), 선택한 프리셋 키를 gameStore에 저장
    setCustomMapData(null)
    setCustomMapTitle(null)
    setSelectedMapPreset(mapId)
    const selected = DEFAULT_MAPS.find(m => m.id === mapId)
    toast.success(`[${selected?.title ?? '기본 맵'}] 맵이 선택되었습니다.`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
      <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Map className="w-6 h-6 text-[var(--accent-primary)]" />
            맵 로드
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setActiveTab('default')}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${
              activeTab === 'default' 
                ? 'text-[var(--accent-primary)] border-b-2 border-[var(--accent-primary)] bg-white/5' 
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            기본 맵
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`flex-1 py-4 text-sm font-bold transition-colors ${
              activeTab === 'custom' 
                ? 'text-[var(--accent-secondary)] border-b-2 border-[var(--accent-secondary)] bg-white/5' 
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            커스텀 맵 (코드 입력)
          </button>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[300px]">
          {activeTab === 'default' && (
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
              <p className="text-sm text-white/50 mb-2">기본으로 제공되는 맵 프리셋을 선택하세요.</p>
              {DEFAULT_MAPS.map((map) => (
                <button
                  key={map.id}
                  onClick={() => handleLoadDefaultMap(map.id)}
                  className="flex items-center justify-between p-4 bg-black/50 border border-white/10 rounded-xl hover:border-[var(--accent-primary)] hover:bg-white/5 transition-all text-left group"
                >
                  <div>
                    <h3 className="font-bold text-white group-hover:text-[var(--accent-primary)] transition-colors">{map.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-white/40">{map.type}</span>
                      {map.length && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          map.length === '숏' ? 'bg-green-500/20 text-green-400' :
                          map.length === '미들' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-purple-500/20 text-purple-400'
                        }`}>{map.length}</span>
                      )}
                      {map.complexity && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          map.complexity === '단순' ? 'bg-emerald-500/20 text-emerald-400' :
                          map.complexity === '중간' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>{map.complexity}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-bold text-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity">
                    선택하기
                  </span>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="flex flex-col gap-4 h-full">
              <p className="text-sm text-white/50">
                맵 에디터에서 복사한 6자리 공유 코드를 입력하여 맵을 불러옵니다.
              </p>
              <div className="flex gap-2 mt-4">
                <input 
                  type="text" 
                  placeholder="예: A1B2C3" 
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-[var(--accent-secondary)] font-bold focus:outline-none focus:border-[var(--accent-secondary)] transition-colors uppercase text-center tracking-widest text-lg"
                  value={mapCode}
                  onChange={(e) => setMapCode(e.target.value)}
                  maxLength={6}
                />
              </div>
              <button 
                onClick={handleLoadCustomMap}
                disabled={isLoading || mapCode.length < 4}
                className="mt-auto w-full bg-[var(--accent-secondary)] text-black font-bold py-4 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    맵 검색 및 불러오기
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
