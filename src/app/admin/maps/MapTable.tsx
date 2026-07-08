'use client'

import { useState } from 'react'
import { Trash2, Map as MapIcon, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { toggleOfficialMap, deleteCustomMap } from '../actions/mapActions'

export default function MapTable({ initialMaps }: { initialMaps: any[] }) {
  const [maps, setMaps] = useState(initialMaps)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleToggleOfficial = async (mapId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus
    const backup = [...maps]
    setMaps(prev => prev.map(m => m.id === mapId ? { ...m, is_official: newStatus } : m))

    const result = await toggleOfficialMap(mapId, newStatus)
    if (!result.success) {
      setMaps(backup)
      toast.error(`Error: ${result.error}`)
    } else {
      toast.success(newStatus ? 'Map promoted to Official.' : 'Map demoted to Custom.')
    }
  }

  const handleDelete = async (mapId: string) => {
    if (!window.confirm('정말 이 맵을 삭제하시겠습니까? (연관된 기록이 모두 삭제됩니다)')) return

    const backup = [...maps]
    setMaps(prev => prev.filter(m => m.id !== mapId))

    const result = await deleteCustomMap(mapId)
    if (!result.success) {
      setMaps(backup)
      toast.error(`Error: ${result.error}`)
    } else {
      toast.success('Map deleted.')
    }
  }

  return (
    <div className="glass-panel rounded-sm overflow-hidden flex flex-col font-rajdhani">
      <div className="px-6 py-4 border-b border-cyan-900/50 bg-black/40 flex justify-between items-center">
        <h2 className="text-sm font-bold tracking-widest text-purple-400 uppercase flex items-center">
          <MapIcon className="w-4 h-4 mr-2" />
          Topology Registry
        </h2>
        <button 
          onClick={() => window.location.reload()}
          className="text-[10px] text-slate-400 hover:text-purple-400 uppercase tracking-widest flex items-center transition-colors"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-purple-950/20 border-b border-purple-900/50 text-purple-400 uppercase tracking-[0.15em] text-[10px] font-bold">
            <tr>
              <th className="px-6 py-4">Topology Name</th>
              <th className="px-6 py-4">Creator</th>
              <th className="px-6 py-4">Complexity / Length</th>
              <th className="px-6 py-4">Official Status</th>
              <th className="px-6 py-4 text-right">Override</th>
            </tr>
          </thead>
          <tbody className="text-slate-300 font-medium">
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
                    title="DELETE TOPOLOGY"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {maps.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500">
                  No topologies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
