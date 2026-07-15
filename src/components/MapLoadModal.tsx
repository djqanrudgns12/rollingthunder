'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useUIStore, type CustomMapMeta } from '@/store/uiStore'
import { useGameStore } from '@/store/gameStore'
import { toast } from 'sonner'
import { X, Map, Store, Download, Hammer, Loader2 } from 'lucide-react'
import { getPresetMeta } from '@/engine/MapPresets'
import { getMapsAction } from '@/presentation/actions/mapActions'
import { getMyDownloadsAction, getMyUserMapsAction } from '@/presentation/actions/userMapActions'
import MapPreviewCanvas from './MapPreviewCanvas'

interface MapLoadModalProps {
  isOpen: boolean
  onClose: () => void
}

// 맵 목록 재조회 staleness 게이트: 60초 이내 재오픈 시 DB 왕복 스킵(미리보기 stale 방지 목적은 유지)
const MAPS_STALE_MS = 60_000
let lastMapsFetchMs = 0

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
  { id: 'bounce_mirror', title: '혼돈의 거울', type: '좌우 대칭·초고탄성', length: '미들', complexity: '단순' },
  { id: 'meteor_field', title: '운석 지대', type: '범퍼만 25+개 벽없음', length: '롱', complexity: '중간' },
]

const LENGTH_LABEL: Record<string, string> = { Short: '숏', Middle: '미들', Long: '롱' }
const COMPLEXITY_LABEL: Record<string, string> = { Simple: '단순', Medium: '중간', Complex: '복잡' }

// 스토어에서 받은 맵 / 내가 만든 맵을 하나의 리스트 항목으로 통일
interface CustomMapEntry {
  key: string
  source: 'mine' | 'downloaded'
  title: string
  creatorName?: string
  description?: string
  lengthType?: string
  complexity?: string
  isPublished?: boolean
  items: any[]
  meta: CustomMapMeta
}

function lengthBadgeClass(label: string) {
  return label === '숏' ? 'bg-green-500/20 text-green-400' :
    label === '미들' ? 'bg-blue-500/20 text-blue-400' :
    'bg-purple-500/20 text-purple-400'
}

function complexityBadgeClass(label: string) {
  return label === '단순' ? 'bg-emerald-500/20 text-emerald-400' :
    label === '중간' ? 'bg-yellow-500/20 text-yellow-400' :
    'bg-red-500/20 text-red-400'
}

export default function MapLoadModal({ isOpen, onClose }: MapLoadModalProps) {
  const [activeTab, setActiveTab] = useState<'default' | 'custom'>('default')
  const [hoveredMapId, setHoveredMapId] = useState<string | null>(null)

  // 커스텀 맵 탭 상태
  const [customEntries, setCustomEntries] = useState<CustomMapEntry[]>([])
  const [customLoading, setCustomLoading] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [hoveredCustomKey, setHoveredCustomKey] = useState<string | null>(null)

  const { setCustomMapData, setCustomMapMeta, setCustomMapTitle } = useUIStore()
  const { setSelectedMapPreset } = useGameStore()
  // 미리보기가 최신 서버 배포 상태를 반영하도록 캐시를 반응형으로 구독한다.
  const mapDataCache = useGameStore(state => state.mapDataCache)

  // 모달이 열릴 때 서버에서 최신 맵을 다시 불러와 캐시를 갱신한다(미리보기 stale 방지).
  // 단, 60초 이내에 이미 갱신했다면 스킵 — 여닫을 때마다 반복되던 중복 DB 왕복 제거.
  useEffect(() => {
    if (!isOpen) return
    if (Date.now() - lastMapsFetchMs < MAPS_STALE_MS) return
    let cancelled = false
    getMapsAction()
      .then(fresh => {
        if (!cancelled) {
          lastMapsFetchMs = Date.now()
          useGameStore.getState().setMapDataCache(fresh)
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isOpen])

  // 커스텀 맵 탭 활성화 시: 내가 만든 맵 + 스토어에서 받은 맵을 병렬 로드
  useEffect(() => {
    if (!isOpen || activeTab !== 'custom') return
    let cancelled = false
    setCustomLoading(true)
    setNeedsLogin(false)

    Promise.all([getMyUserMapsAction(), getMyDownloadsAction()]).then(([mine, downloads]) => {
      if (cancelled) return
      setCustomLoading(false)

      if (!downloads.success && downloads.code === 'UNAUTHORIZED') {
        setNeedsLogin(true)
        setCustomEntries([])
        return
      }

      const entries: CustomMapEntry[] = []
      if (mine.success) {
        for (const m of mine.maps) {
          entries.push({
            key: `mine-${m.id}`,
            source: 'mine',
            title: m.name,
            description: m.description,
            lengthType: m.lengthType,
            complexity: m.complexity,
            isPublished: m.isPublished,
            items: m.items,
            meta: { worldHeight: m.worldHeight, wallStyle: m.wallStyle, bgImage: m.bgImage, layoutConfig: m.layoutConfig },
          })
        }
      }
      if (downloads.success) {
        for (const d of downloads.downloads) {
          entries.push({
            key: `dl-${d.id}`,
            source: 'downloaded',
            title: d.mapName,
            creatorName: d.creatorName,
            description: d.snapshot?.description,
            lengthType: d.snapshot?.lengthType,
            complexity: d.snapshot?.complexity,
            items: d.snapshot?.items || [],
            meta: {
              worldHeight: d.snapshot?.worldHeight,
              // 스냅샷은 DB JSON이라 string으로 넘어옴 — 에디터가 기록한 값이므로 유니온으로 좁힘
              wallStyle: d.snapshot?.wallStyle as CustomMapMeta['wallStyle'],
              bgImage: d.snapshot?.bgImage,
              layoutConfig: d.snapshot?.layoutConfig,
            },
          })
        }
      }
      setCustomEntries(entries)
    })

    return () => { cancelled = true }
  }, [isOpen, activeTab])

  if (!isOpen) return null

  const handleLoadCustomEntry = (entry: CustomMapEntry) => {
    setCustomMapData(entry.items)
    setCustomMapMeta({
      worldHeight: entry.meta.worldHeight,
      wallStyle: entry.meta.wallStyle,
      bgImage: entry.meta.bgImage,
      layoutConfig: entry.meta.layoutConfig,
    })
    setCustomMapTitle(entry.title)
    toast.success(`[${entry.title}] 맵을 성공적으로 불러왔습니다!`)
    onClose()
  }

  const handleLoadDefaultMap = (mapId: string) => {
    setCustomMapData(null)
    setCustomMapMeta(null)
    setCustomMapTitle(null)
    setSelectedMapPreset(mapId)
    const selected = DEFAULT_MAPS.find(m => m.id === mapId)
    toast.success(`[${selected?.title ?? '기본 맵'}] 맵이 선택되었습니다.`)
    onClose()
  }

  // 우측 미리보기에 렌더링할 메타데이터 결정
  let previewMeta: any = null
  if (activeTab === 'default') {
    if (hoveredMapId && hoveredMapId !== 'random') {
      const p = mapDataCache?.[hoveredMapId] || getPresetMeta(hoveredMapId)
      if (p) {
        previewMeta = {
           title: p.name,
           desc: p.description,
           items: p.items,
           worldHeight: p.worldHeight || 2400
        }
      }
    }
  } else if (activeTab === 'custom') {
    const hovered = customEntries.find(e => e.key === hoveredCustomKey)
    if (hovered) {
      previewMeta = {
        title: hovered.title,
        desc: hovered.description,
        items: hovered.items,
        worldHeight: hovered.meta.worldHeight || 3000,
      }
    }
  }

  const mineEntries = customEntries.filter(e => e.source === 'mine')
  const downloadedEntries = customEntries.filter(e => e.source === 'downloaded')

  const renderCustomEntry = (entry: CustomMapEntry) => {
    const lengthLabel = entry.lengthType ? LENGTH_LABEL[entry.lengthType] : undefined
    const complexityLabel = entry.complexity ? COMPLEXITY_LABEL[entry.complexity] : undefined
    return (
      <button
        key={entry.key}
        onClick={() => handleLoadCustomEntry(entry)}
        onMouseEnter={() => setHoveredCustomKey(entry.key)}
        onMouseLeave={() => setHoveredCustomKey(null)}
        className="flex items-center justify-between p-4 bg-black/50 border border-white/10 rounded-xl hover:border-emerald-400 hover:bg-white/5 transition-all text-left group"
      >
        <div className="min-w-0">
          <h3 className="font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
            {entry.title}
            {entry.source === 'mine' && entry.isPublished && (
              <span className="ml-1.5 text-[10px] font-bold text-emerald-400 align-middle">배포됨</span>
            )}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            {entry.source === 'downloaded' && entry.creatorName && (
              <span className="text-xs text-white/40 truncate">제작: {entry.creatorName}</span>
            )}
            {entry.source === 'mine' && (
              <span className="text-xs text-white/40">내가 만든 맵</span>
            )}
            {lengthLabel && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lengthBadgeClass(lengthLabel)}`}>{lengthLabel}</span>
            )}
            {complexityLabel && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${complexityBadgeClass(complexityLabel)}`}>{complexityLabel}</span>
            )}
          </div>
        </div>
        <span className="text-xs font-bold text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2">
          선택하기
        </span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-opacity">
      {/* max-w-lg 에서 max-w-4xl 로 넓혀서 2단 분할 레이아웃 적용 */}
      <div className="bg-[#111] border border-white/10 rounded-xl sm:rounded-2xl w-full max-w-4xl max-h-[90dvh] overflow-hidden shadow-2xl flex flex-col relative animate-in fade-in zoom-in duration-300">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 shrink-0">
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
        <div className="flex border-b border-white/5 shrink-0">
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
                ? 'text-emerald-400 border-b-2 border-emerald-400 bg-white/5'
                : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            커스텀 맵
          </button>
        </div>

        {/* Content (2단 분할) */}
        <div className="flex flex-col md:flex-row flex-1 min-h-[250px] sm:min-h-[300px] overflow-hidden">
          {/* 좌측 리스트 패널 */}
          <div className="w-full md:w-1/2 p-4 sm:p-6 md:border-r border-b md:border-b-0 border-white/5 overflow-y-auto custom-scrollbar">
            {activeTab === 'default' && (
              <div className="flex flex-col gap-3 pr-1">
                <p className="text-sm text-white/50 mb-2">기본으로 제공되는 맵 프리셋을 선택하세요.</p>
                {DEFAULT_MAPS.map((map) => (
                  <button
                    key={map.id}
                    onClick={() => handleLoadDefaultMap(map.id)}
                    onMouseEnter={() => setHoveredMapId(map.id)}
                    onMouseLeave={() => setHoveredMapId(null)}
                    className="flex items-center justify-between p-4 bg-black/50 border border-white/10 rounded-xl hover:border-[var(--accent-primary)] hover:bg-white/5 transition-all text-left group"
                  >
                    <div>
                      <h3 className="font-bold text-white group-hover:text-[var(--accent-primary)] transition-colors">{map.title}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-white/40">{map.type}</span>
                        {map.length && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${lengthBadgeClass(map.length)}`}>{map.length}</span>
                        )}
                        {map.complexity && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${complexityBadgeClass(map.complexity)}`}>{map.complexity}</span>
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
              <div className="flex flex-col gap-3 pr-1 h-full">
                {customLoading ? (
                  <div className="flex-1 flex items-center justify-center text-white/40 gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> 커스텀 맵을 불러오는 중…
                  </div>
                ) : needsLogin ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                    <Store className="w-10 h-10 text-emerald-500/40" />
                    <p className="text-sm text-white/50">
                      로그인하면 커스텀 맵 스토어에서 받은 맵을<br />여기서 바로 사용할 수 있습니다.
                    </p>
                  </div>
                ) : customEntries.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                    <Store className="w-10 h-10 text-emerald-500/40" />
                    <p className="text-sm text-white/50">
                      아직 보유한 커스텀 맵이 없습니다.<br />커스텀 맵 스토어에서 마음에 드는 맵을 받아보세요!
                    </p>
                    <Link
                      href="/shop?view=mapstore"
                      className="flex items-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                    >
                      <Store className="w-4 h-4" /> 커스텀 맵 스토어 가기
                    </Link>
                  </div>
                ) : (
                  <>
                    {mineEntries.length > 0 && (
                      <>
                        <p className="text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                          <Hammer className="w-3.5 h-3.5" /> 내가 만든 맵
                        </p>
                        {mineEntries.map(renderCustomEntry)}
                      </>
                    )}
                    {downloadedEntries.length > 0 && (
                      <>
                        <p className={`text-xs font-bold text-white/40 uppercase tracking-wider flex items-center gap-1.5 ${mineEntries.length > 0 ? 'mt-3' : ''}`}>
                          <Download className="w-3.5 h-3.5" /> 다운로드한 맵
                        </p>
                        {downloadedEntries.map(renderCustomEntry)}
                      </>
                    )}
                    <Link
                      href="/shop?view=mapstore"
                      className="mt-auto flex items-center justify-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
                    >
                      <Store className="w-4 h-4" /> 커스텀 맵 스토어에서 더 찾아보기
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 우측 미리보기 패널 */}
          <div className="hidden md:flex w-1/2 p-6 flex-col items-center justify-center bg-black/20">
            {previewMeta ? (
              <div className="w-full h-full flex flex-col gap-4 animate-in fade-in duration-300">
                <div className="text-center">
                   <h3 className="text-lg font-bold text-white mb-1">{previewMeta.title}</h3>
                   {previewMeta.desc && <p className="text-xs text-white/50">{previewMeta.desc}</p>}
                </div>
                <div className="flex-1 flex items-center justify-center relative">
                   <MapPreviewCanvas
                     mapData={previewMeta.items}
                     worldHeight={previewMeta.worldHeight}
                     className="w-full h-full"
                   />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-white/20 gap-4">
                <Map className="w-16 h-16 opacity-20" />
                <p className="text-sm font-bold">
                  {activeTab === 'default'
                     ? (hoveredMapId === 'random' ? '랜덤 맵은 매번 새롭게 생성됩니다.' : '좌측에서 맵에 마우스를 올려보세요.')
                     : '좌측에서 맵에 마우스를 올려보세요.'}
                </p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
