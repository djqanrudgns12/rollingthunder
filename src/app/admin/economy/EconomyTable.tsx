'use client'

import { useState } from 'react'
import { Activity, RefreshCw } from 'lucide-react'
import { getEconomyLogs } from '../actions/economyActions'
import { toast } from 'sonner'

export default function EconomyTable({ initialLogs, initialCount }: { initialLogs: any[], initialCount: number }) {
  const [logs, setLogs] = useState(initialLogs)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const limit = 50

  const fetchLogs = async (newPage: number) => {
    setIsLoading(true)
    const result = await getEconomyLogs(newPage, limit)
    if (result.success && result.data) {
      setLogs(result.data)
      setPage(newPage)
    } else {
      toast.error(`Error: ${result.error}`)
    }
    setIsLoading(false)
  }

  const handleRefresh = () => {
    fetchLogs(page)
  }

  const totalPages = Math.ceil(initialCount / limit) || 1

  return (
    <div className="glass-panel rounded-sm overflow-hidden flex flex-col font-rajdhani">
      <div className="px-6 py-4 border-b border-cyan-900/50 bg-black/40 flex justify-between items-center">
        <h2 className="text-sm font-bold tracking-widest text-yellow-500 uppercase flex items-center">
          <Activity className="w-4 h-4 mr-2" />
          Economy Matrix Log
        </h2>
        <button 
          onClick={handleRefresh}
          className="text-[10px] text-slate-400 hover:text-yellow-400 uppercase tracking-widest flex items-center transition-colors"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-yellow-950/20 border-b border-yellow-900/50 text-yellow-600 uppercase tracking-[0.15em] text-[10px] font-bold">
            <tr>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Entity (User)</th>
              <th className="px-6 py-4">Transaction Amount</th>
              <th className="px-6 py-4">Context / Reason</th>
            </tr>
          </thead>
          <tbody className="text-slate-300 font-medium relative">
            {isLoading && (
              <tr className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <td><RefreshCw className="w-6 h-6 text-yellow-500 animate-spin" /></td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.log_id} className="data-row hover:border-l-yellow-500 group">
                <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div>
                      <p className="text-white font-bold tracking-wide">{log.profiles?.username || 'Unknown'}</p>
                      <p className="text-slate-500 text-xs font-mono mt-0.5">ID: {log.user_id.slice(0,8)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`font-orbitron font-bold tracking-wider ${log.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {log.amount >= 0 ? '+' : ''}{log.amount}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-400 text-xs uppercase tracking-wider">
                  {log.reason}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center py-8 text-slate-500">
                  No transaction logs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 bg-black/60 border-t border-cyan-900/30 flex items-center justify-between">
        <span className="text-[10px] text-yellow-700 uppercase tracking-widest font-bold">
          Displaying Page {page} of {totalPages}
        </span>
        <div className="flex space-x-1 font-orbitron text-xs">
          <button 
            onClick={() => fetchLogs(page - 1)}
            disabled={page === 1 || isLoading}
            className="px-3 py-1 bg-black border border-yellow-900/50 text-yellow-700 disabled:opacity-50 hover:bg-yellow-900/20 transition-colors rounded-sm"
          >
            &lt;
          </button>
          <span className="px-3 py-1 bg-yellow-900/40 border border-yellow-600 text-yellow-400 rounded-sm shadow-[0_0_10px_rgba(234,179,8,0.2)]">
            {page.toString().padStart(2, '0')}
          </span>
          <button 
            onClick={() => fetchLogs(page + 1)}
            disabled={page >= totalPages || isLoading}
            className="px-3 py-1 bg-black border border-yellow-900/50 text-yellow-700 disabled:opacity-50 hover:bg-yellow-900/20 transition-colors rounded-sm"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  )
}
