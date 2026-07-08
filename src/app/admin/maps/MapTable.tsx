'use client'

import { useState, useTransition } from 'react'
import { Trash2, Map as MapIcon, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { toggleOfficialMap, deleteCustomMap, getMaps } from '../actions/mapActions'

export default function MapTable({ initialMaps, initialCount }: { initialMaps: any[], initialCount: number }) {
  const [maps, setMaps] = useState(initialMaps)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(initialCount)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const limit = 50
  const totalPages = Math.ceil(totalCount / limit) || 1

  const fetchMaps = async (newPage: number) => {
    setIsLoading(true)
    const result = await getMaps(newPage, limit)
    if (result.success && result.data) {
      setMaps(result.data)
      setPage(newPage)
      if (result.count !== undefined) setTotalCount(result.count)
    } else {
      toast.error(`Error: ${result.error}`)
    }
    setIsLoading(false)
  }

  const handleRefresh = () => {
    fetchMaps(page)
  }

  const handleToggleOfficial = async (mapId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus
    
    startTransition(async () => {
      const result = await toggleOfficialMap(mapId, newStatus)
      if (!result.success) {
        toast.error(`Error: ${result.error}`)
      } else {
        toast.success(newStatus ? 'Map promoted to Official.' : 'Map demoted to Custom.')
        setMaps(prev => prev.map(m => m.id === mapId ? { ...m, is_official: newStatus } : m))
      }
    })
  }

  const handleDelete = async (mapId: string) => {
    if (!window.confirm('정말 이 맵을 삭제하시겠습니까? (연관된 기록이 모두 삭제됩니다)')) return

    startTransition(async () => {
      const result = await deleteCustomMap(mapId)
      if (!result.success) {
        toast.error(`Error: ${result.error}`)
      } else {
        toast.success('Map deleted.')
        fetchMaps(page)
      }
    })
  }

  return (
    <div className="glass-panel rounded-sm overflow-hidden flex flex-col font-noto">
      <div className="px-6 py-4 border-b border-cyan-900/50 bg-black/40 flex justify-between items-center">
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

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-purple-950/20 border-b border-purple-900/50 text-purple-400 tracking-wide text-xs font-bold">
            <tr>
              <th className="px-6 py-4">맵 이름 (Topology Name)</th>
              <th className="px-6 py-4">제작자 (Creator)</th>
              <th className="px-6 py-4">난이도 / 길이 (Complexity / Length)</th>
              <th className="px-6 py-4">공식 지정 여부 (Official)</th>
              <th className="px-6 py-4 text-right">강제 명령</th>
            </tr>
          </thead>
          <tbody className="text-slate-300 font-medium relative text-sm">
            {(isLoading || isPending) && (
              <tr className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <td><RefreshCw className="w-6 h-6 text-purple-500 animate-spin" /></td>
              </tr>
            )}
            {maps.map((map) => (
              <tr key={map.id} className="data-row hover:border-l-purple-400 group">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className={`w-1.5 h-1.5 rounded-full ${map.is_official ? 'bg-purple-400 shadow-[0_0_5px_#b026ff]' : 'bg-slate-600'} mr-3`}></div>
                    <div>
                      <p className="text-white font-bold tracking-wide">{map.name}</p>
                      <p className="text-slate-500 text-xs font-mono mt-0.5">ID: {map.id.slice(0,8)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-400">{map.creator?.username || 'System'}</td>
                <td className="px-6 py-4">
                  <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded-sm text-xs border border-slate-700 mr-2 uppercase">
                    {map.complexity}
                  </span>
                  <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded-sm text-xs border border-slate-700 uppercase">
                    {map.length_type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={map.is_official}
                      onChange={() => handleToggleOfficial(map.id, map.is_official)}
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                  </label>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleDelete(map.id)}
                    className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors p-2 rounded-sm border border-transparent hover:border-red-500/30"
                    title="맵 강제 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {maps.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500 text-sm">
                  등록된 맵이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-4 bg-black/60 border-t border-purple-900/30 flex items-center justify-between">
        <span className="text-xs text-purple-700 tracking-wide font-bold">
          페이지 {page} / {totalPages} (총 {totalCount} 맵)
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
