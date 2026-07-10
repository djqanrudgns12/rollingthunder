'use client'

import { useState } from 'react'
import { Activity, RefreshCw, Search, ArrowDown, ArrowUp } from 'lucide-react'
import { getEconomyLogs } from '../actions/economyActions'
import { toast } from 'sonner'

export default function EconomyTable({ initialLogs, initialCount }: { initialLogs: any[], initialCount: number }) {
  const [logs, setLogs] = useState(initialLogs)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(initialCount)
  const [isLoading, setIsLoading] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  const limit = 50

  const fetchLogs = async (newPage: number, q: string = searchQuery, sb: string = sortBy, so: 'asc' | 'desc' = sortOrder) => {
    setIsLoading(true)
    const result = await getEconomyLogs(newPage, limit, q, sb, so)
    if (result.success && result.data) {
      setLogs(result.data)
      setPage(newPage)
      if (typeof result.count === 'number') setTotalCount(result.count)
    } else {
      toast.error(`Error: ${result.error}`)
    }
    setIsLoading(false)
  }

  const handleRefresh = () => {
    fetchLogs(page)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchLogs(1)
  }

  const handleSort = (field: string) => {
    const newOrder = sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc'
    setSortBy(field)
    setSortOrder(newOrder)
    fetchLogs(1, searchQuery, field, newOrder)
  }

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return null
    return sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 inline ml-1" /> : <ArrowDown className="w-3 h-3 inline ml-1" />
  }

  const totalPages = Math.ceil(totalCount / limit) || 1

  return (
    <div className="glass-panel rounded-sm overflow-hidden flex flex-col font-noto">
      <div className="px-6 py-4 border-b border-cyan-900/50 bg-black/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-base font-bold tracking-wide text-yellow-500 flex items-center shrink-0">
          <Activity className="w-5 h-5 mr-2" />
          경제 시스템 로그
        </h2>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <form onSubmit={handleSearch} className="flex items-center bg-black/50 border border-yellow-900/50 rounded-sm overflow-hidden flex-1 sm:w-64 focus-within:border-yellow-500/50 transition-colors">
            <input 
              type="text" 
              placeholder="유저명 또는 ID 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-yellow-100 text-xs px-3 py-2 outline-none w-full font-noto"
            />
            <button type="submit" className="px-3 text-yellow-600 hover:text-yellow-400 transition-colors">
              <Search className="w-4 h-4" />
            </button>
          </form>

          <button 
            onClick={handleRefresh}
            className="text-xs font-bold text-slate-400 hover:text-yellow-400 flex items-center transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-yellow-950/20 border-b border-yellow-900/50 text-yellow-600 tracking-wide text-xs font-bold">
            <tr>
              <th className="px-6 py-4 cursor-pointer hover:bg-yellow-900/30 transition-colors" onClick={() => handleSort('created_at')}>
                발생 시간 (Timestamp) <SortIcon field="created_at" />
              </th>
              <th className="px-6 py-4 cursor-pointer hover:bg-yellow-900/30 transition-colors" onClick={() => handleSort('username')}>
                대상 유저 (Entity) <SortIcon field="username" />
              </th>
              <th className="px-6 py-4 cursor-pointer hover:bg-yellow-900/30 transition-colors" onClick={() => handleSort('amount')}>
                거래 금액 (Amount) <SortIcon field="amount" />
              </th>
              <th className="px-6 py-4 cursor-pointer hover:bg-yellow-900/30 transition-colors" onClick={() => handleSort('reason')}>
                사유 (Reason) <SortIcon field="reason" />
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-300 font-medium relative text-sm">
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
                <td colSpan={4} className="text-center py-8 text-slate-500 text-sm">
                  검색된 거래 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="px-6 py-4 bg-black/60 border-t border-cyan-900/30 flex items-center justify-between">
        <span className="text-xs text-yellow-700 tracking-wide font-bold">
          페이지 {page} / {totalPages} (총 {totalCount} 건)
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
