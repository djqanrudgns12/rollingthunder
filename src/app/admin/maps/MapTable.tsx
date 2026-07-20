'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react'
import { Trash2, Map as MapIcon, RefreshCw, Search, ArrowUp, ArrowDown, ArrowUpDown, X, Star, Globe, Download, Heart } from 'lucide-react'
import { toast } from 'sonner'
import {
  getAdminMaps,
  toggleMapPublished,
  toggleMapFeatured,
  deleteAdminMap,
} from '../actions/mapActions'
import type { AdminMapEntry, MapSortColumn, MapSortDirection } from '../actions/mapActions'

// ─── 정렬 가능한 컬럼 정의 ───
const SORTABLE_COLUMNS: { key: MapSortColumn; label: string }[] = [
  { key: 'name', label: '맵 이름' },
  { key: 'created_at', label: '등록일' },
  { key: 'download_count', label: '다운로드' },
  { key: 'like_count', label: '좋아요' },
  { key: 'is_published', label: '배포 상태' },
]

const LENGTH_LABEL: Record<string, string> = { Short: '숏', Middle: '미들', Long: '롱' }
const COMPLEXITY_LABEL: Record<string, string> = { Simple: '단순', Medium: '중간', Complex: '복잡' }

function lengthBadgeClass(label: string) {
  return label === '숏' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
    label === '미들' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
    'bg-purple-500/20 text-purple-400 border-purple-500/30'
}

function complexityBadgeClass(label: string) {
  return label === '단순' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
    label === '중간' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
    'bg-red-500/20 text-red-400 border-red-500/30'
}

export default function MapTable({ initialMaps, initialCount }: { initialMaps: AdminMapEntry[], initialCount: number }) {
  const [maps, setMaps] = useState<AdminMapEntry[]>(initialMaps)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(initialCount)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 정렬 상태
  const [sortColumn, setSortColumn] = useState<MapSortColumn>('created_at')
  const [sortDirection, setSortDirection] = useState<MapSortDirection>('desc')

  const limit = 50
  const totalPages = Math.ceil(totalCount / limit) || 1

  // ─── 검색 디바운스 (300ms) ───
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [searchQuery])

  // ─── 데이터 재요청 ───
  const fetchMaps = useCallback(async (
    newPage: number,
    search?: string,
    sort?: MapSortColumn,
    dir?: MapSortDirection
  ) => {
    setIsLoading(true)
    const result = await getAdminMaps(
      newPage,
      limit,
      search ?? debouncedSearch,
      sort ?? sortColumn,
      dir ?? sortDirection,
    )
    if (result.success && result.data) {
      setMaps(result.data)
      setPage(newPage)
      if (typeof result.count === 'number') setTotalCount(result.count)
    } else {
      toast.error(`Error: ${result.error}`)
    }
    setIsLoading(false)
  }, [debouncedSearch, sortColumn, sortDirection])

  // 디바운스된 검색어 변경 시 재검색
  useEffect(() => {
    fetchMaps(1, debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // ─── 정렬 토글 ───
  const handleSort = (column: MapSortColumn) => {
    let newDirection: MapSortDirection
    if (sortColumn === column) {
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      newDirection = column === 'name' ? 'asc' : 'desc'
    }
    setSortColumn(column)
    setSortDirection(newDirection)
    fetchMaps(1, debouncedSearch, column, newDirection)
  }

  const renderSortIcon = (column: MapSortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 group-hover/th:opacity-70 transition-opacity" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-purple-400" />
      : <ArrowDown className="w-3 h-3 ml-1 text-purple-400" />
  }

  const handleRefresh = () => fetchMaps(page)

  const handleTogglePublished = async (mapId: string, currentStatus: boolean) => {
    startTransition(async () => {
      const result = await toggleMapPublished(mapId, !currentStatus)
      if (!result.success) {
        toast.error(`Error: ${result.error}`)
      } else {
        toast.success(!currentStatus ? '맵이 배포되었습니다.' : '맵 배포가 해제되었습니다.')
        setMaps(prev => prev.map(m => m.id === mapId ? { ...m, is_published: !currentStatus } : m))
      }
    })
  }

  const handleToggleFeatured = async (mapId: string, currentStatus: boolean) => {
    startTransition(async () => {
      const result = await toggleMapFeatured(mapId, !currentStatus)
      if (!result.success) {
        toast.error(`Error: ${result.error}`)
      } else {
        toast.success(!currentStatus ? '추천 맵으로 지정되었습니다. ⭐' : '추천이 해제되었습니다.')
        setMaps(prev => prev.map(m => m.id === mapId ? { ...m, is_featured: !currentStatus } : m))
      }
    })
  }

  const handleDelete = async (mapId: string, source: 'official' | 'custom') => {
    const label = source === 'official' ? '공식 프리셋 맵' : '커스텀 맵'
    if (!window.confirm(`정말 이 ${label}을 삭제하시겠습니까? (복구 불가)`)) return

    startTransition(async () => {
      const result = await deleteAdminMap(mapId, source)
      if (!result.success) {
        toast.error(`Error: ${result.error}`)
      } else {
        toast.success('맵이 삭제되었습니다.')
        fetchMaps(page)
      }
    })
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setDebouncedSearch('')
  }

  return (
    <div className="glass-panel rounded-sm overflow-hidden flex flex-col font-noto">
      {/* ─── 헤더 ─── */}
      <div className="px-6 py-4 border-b border-purple-900/50 bg-black/40">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold tracking-wide text-purple-400 flex items-center">
            <MapIcon className="w-5 h-5 mr-2" />
            토폴로지 관리 (맵 레지스트리)
          </h2>
          <button
            onClick={handleRefresh}
            className="text-xs font-bold text-slate-400 hover:text-purple-400 flex items-center transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${(isLoading || isPending) ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {/* ─── 검색바 ─── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="맵 검색 (맵 이름, 제작자 ID...)"
            className="w-full pl-10 pr-10 py-2.5 bg-black/60 border border-purple-900/50 rounded-sm text-sm text-purple-100 placeholder:text-slate-600 focus:outline-none focus:border-purple-500/70 focus:shadow-[0_0_10px_rgba(176,38,255,0.15)] transition-all font-noto"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-purple-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─── 테이블 ─── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-purple-950/20 border-b border-purple-900/50 text-purple-400 tracking-wide text-xs font-bold">
            <tr>
              {SORTABLE_COLUMNS.map(({ key, label }) => (
                <th key={key} className="px-6 py-4">
                  <button
                    onClick={() => handleSort(key)}
                    className="group/th flex items-center hover:text-purple-300 transition-colors cursor-pointer select-none"
                  >
                    {label}
                    {renderSortIcon(key)}
                  </button>
                </th>
              ))}
              <th className="px-6 py-4">제작자</th>
              <th className="px-6 py-4">난이도 / 길이</th>
              <th className="px-6 py-4">추천</th>
              <th className="px-6 py-4 text-right">강제 명령</th>
            </tr>
          </thead>
          <tbody className="text-slate-300 font-medium relative text-sm">
            {(isLoading || isPending) && (
              <tr className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <td><RefreshCw className="w-6 h-6 text-purple-500 animate-spin" /></td>
              </tr>
            )}
            {maps.map((map) => {
              const lengthLabel = map.length_type ? LENGTH_LABEL[map.length_type] : null
              const complexityLabel = map.complexity ? COMPLEXITY_LABEL[map.complexity] : null

              return (
                <tr key={`${map.source}-${map.id}`} className="data-row hover:border-l-purple-400 group">
                  {/* 맵 이름 */}
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className={`w-1.5 h-1.5 rounded-full mr-3 ${
                        map.source === 'official'
                          ? 'bg-amber-400 shadow-[0_0_5px_#f59e0b]'
                          : map.is_featured
                            ? 'bg-purple-400 shadow-[0_0_5px_#b026ff]'
                            : 'bg-slate-600'
                      }`}></div>
                      <div>
                        <p className="text-white font-bold tracking-wide flex items-center gap-1.5">
                          {map.name}
                          {map.source === 'official' && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/30">공식</span>
                          )}
                        </p>
                        <p className="text-slate-600 text-[10px] font-mono mt-0.5">
                          {map.source === 'official' ? `PRESET: ${map.id}` : map.id.slice(0, 8) + '…'}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* 등록일 */}
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                    {new Date(map.created_at).toLocaleDateString()}
                  </td>

                  {/* 다운로드 수 */}
                  <td className="px-6 py-4">
                    {map.source === 'custom' ? (
                      <span className="flex items-center gap-1 text-slate-400 text-xs">
                        <Download className="w-3 h-3" />
                        {map.download_count}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* 좋아요 수 */}
                  <td className="px-6 py-4">
                    {map.source === 'custom' ? (
                      <span className="flex items-center gap-1 text-slate-400 text-xs">
                        <Heart className="w-3 h-3" />
                        {map.like_count}
                      </span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>

                  {/* 배포 상태 */}
                  <td className="px-6 py-4">
                    {map.source === 'custom' ? (
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={map.is_published}
                          onChange={() => handleTogglePublished(map.id, map.is_published)}
                        />
                        <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                      </label>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                        <Globe className="w-3 h-3" /> 상시
                      </span>
                    )}
                  </td>

                  {/* 제작자 */}
                  <td className="px-6 py-4 text-slate-400 text-xs">
                    {map.creator_username}
                  </td>

                  {/* 난이도 / 길이 */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      {lengthLabel && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${lengthBadgeClass(lengthLabel)}`}>
                          {lengthLabel}
                        </span>
                      )}
                      {complexityLabel && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${complexityBadgeClass(complexityLabel)}`}>
                          {complexityLabel}
                        </span>
                      )}
                      {!lengthLabel && !complexityLabel && <span className="text-slate-600 text-xs">—</span>}
                    </div>
                  </td>

                  {/* 추천 */}
                  <td className="px-6 py-4">
                    {map.source === 'custom' ? (
                      <button
                        onClick={() => handleToggleFeatured(map.id, map.is_featured)}
                        className={`p-1.5 rounded-sm border transition-all ${
                          map.is_featured
                            ? 'text-amber-400 bg-amber-500/15 border-amber-500/30 hover:bg-amber-500/25 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                            : 'text-slate-600 border-transparent hover:text-amber-400 hover:border-amber-500/30 hover:bg-amber-500/10'
                        }`}
                        title={map.is_featured ? '추천 해제' : '추천 맵 지정'}
                      >
                        <Star className={`w-4 h-4 ${map.is_featured ? 'fill-amber-400' : ''}`} />
                      </button>
                    ) : (
                      <span className="text-slate-700">
                        <Star className="w-4 h-4 opacity-20" />
                      </span>
                    )}
                  </td>

                  {/* 강제 명령 */}
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(map.id, map.source)}
                      className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors p-2 rounded-sm border border-transparent hover:border-red-500/30"
                      title="맵 강제 삭제"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
            {maps.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-500 text-sm">
                  {debouncedSearch ? `"${debouncedSearch}" 검색 결과가 없습니다.` : '등록된 맵이 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── 페이지네이션 ─── */}
      <div className="px-6 py-4 bg-black/60 border-t border-purple-900/30 flex items-center justify-between">
        <span className="text-xs text-purple-700 tracking-wide font-bold">
          페이지 {page} / {totalPages} (총 {totalCount} 맵)
          {debouncedSearch && <span className="ml-2 text-purple-500">— 검색: &quot;{debouncedSearch}&quot;</span>}
        </span>
        <div className="flex space-x-1 font-orbitron text-xs">
          <button
            onClick={() => fetchMaps(page - 1)}
            disabled={page === 1 || isLoading || isPending}
            className="px-3 py-1 bg-black border border-purple-900/50 text-purple-700 disabled:opacity-50 hover:bg-purple-900/20 transition-colors rounded-sm"
          >
            &lt;
          </button>
          <span className="px-3 py-1 bg-purple-900/40 border border-purple-600 text-purple-400 rounded-sm shadow-[0_0_10px_rgba(176,38,255,0.2)]">
            {page.toString().padStart(2, '0')}
          </span>
          <button
            onClick={() => fetchMaps(page + 1)}
            disabled={page >= totalPages || isLoading || isPending}
            className="px-3 py-1 bg-black border border-purple-900/50 text-purple-700 disabled:opacity-50 hover:bg-purple-900/20 transition-colors rounded-sm"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  )
}
