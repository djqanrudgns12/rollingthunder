'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react'
import { Trash2, Shield, Coins, RefreshCw, Search, ArrowUp, ArrowDown, ArrowUpDown, X } from 'lucide-react'
import { toast } from 'sonner'
import { deleteUserAccount, updateUserRole, updateUserChips, getUsers } from './actions/userActions'
import type { SortColumn, SortDirection } from './actions/userActions'

interface User {
  id: string
  username: string
  nickname?: string | null
  name?: string | null
  role: 'user' | 'premium' | 'admin'
  chips_balance: number
  created_at: string
  last_seen_at?: string | null
}

// ─── 정렬 가능한 컬럼 정의 ───
const SORTABLE_COLUMNS: { key: SortColumn; label: string }[] = [
  { key: 'username', label: '식별자 (ID)' },
  { key: 'role', label: '접근 등급 (권한)' },
  { key: 'chips_balance', label: '보유 자산 (칩)' },
  { key: 'created_at', label: '가입일' },
  { key: 'last_seen_at', label: '최종 접속일' },
]

export default function UserTable({ initialUsers, initialCount }: { initialUsers: User[], initialCount: number }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(initialCount)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 정렬 상태
  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const limit = 50
  const totalPages = Math.ceil(totalCount / limit) || 1

  // ─── 검색 디바운스 (300ms) ───
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery])

  // ─── 검색어/정렬 변경 시 데이터 재요청 ───
  const fetchUsers = useCallback(async (
    newPage: number,
    search?: string,
    sort?: SortColumn,
    dir?: SortDirection
  ) => {
    setIsLoading(true)
    const result = await getUsers(
      newPage,
      limit,
      search ?? debouncedSearch,
      sort ?? sortColumn,
      dir ?? sortDirection,
    )
    if (result.success && result.data) {
      setUsers(result.data)
      setPage(newPage)
      if (typeof result.count === 'number') setTotalCount(result.count)
    } else {
      toast.error(`Error: ${result.error}`)
    }
    setIsLoading(false)
  }, [debouncedSearch, sortColumn, sortDirection])

  // 디바운스된 검색어 변경 시 자동으로 1페이지에서 재검색
  useEffect(() => {
    fetchUsers(1, debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // ─── 정렬 토글 핸들러 ───
  const handleSort = (column: SortColumn) => {
    let newDirection: SortDirection
    if (sortColumn === column) {
      // 같은 컬럼 클릭: 방향 토글
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      // 새 컬럼 클릭: 기본 내림차순 (숫자/날짜) 또는 오름차순 (텍스트)
      newDirection = column === 'username' || column === 'role' ? 'asc' : 'desc'
    }
    setSortColumn(column)
    setSortDirection(newDirection)
    fetchUsers(1, debouncedSearch, column, newDirection)
  }

  // ─── 정렬 아이콘 렌더링 ───
  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30 group-hover/th:opacity-70 transition-opacity" />
    }
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-cyan-400" />
      : <ArrowDown className="w-3 h-3 ml-1 text-cyan-400" />
  }

  const handleRefresh = () => {
    fetchUsers(page)
  }

  const handleDelete = async (userId: string) => {
    if (!window.confirm('정말 이 사용자를 완전히 삭제하시겠습니까? (복구 불가)')) return

    startTransition(async () => {
      const result = await deleteUserAccount(userId)
      if (!result.success) {
        toast.error(`Error: ${result.error}`)
      } else {
        toast.success('User purged from the system.')
        fetchUsers(page)
      }
    })
  }

  const handleRoleChange = async (userId: string, newRole: 'user' | 'premium' | 'admin') => {
    startTransition(async () => {
      const result = await updateUserRole(userId, newRole)
      if (!result.success) {
        toast.error(`Error: ${result.error}`)
      } else {
        toast.success('Access level updated.')
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      }
    })
  }

  const handleChipsChange = async (userId: string, newChipsStr: string) => {
    const newChips = parseInt(newChipsStr, 10)
    if (isNaN(newChips) || newChips < 0) return

    startTransition(async () => {
      const result = await updateUserChips(userId, newChips)
      if (!result.success) {
        toast.error(`Error: ${result.error}`)
      } else {
        toast.success('Capital updated.')
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, chips_balance: newChips } : u))
      }
    })
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setDebouncedSearch('')
  }

  return (
    <div className="glass-panel rounded-sm overflow-hidden flex flex-col font-noto">
      {/* ─── 헤더: 제목 + 검색바 + 새로고침 ─── */}
      <div className="px-6 py-4 border-b border-cyan-900/50 bg-black/40">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold tracking-wide text-cyan-400 flex items-center">
            <Shield className="w-5 h-5 mr-2" />
            엔티티 레지스트리 (유저 관리)
          </h2>
          <button 
            onClick={handleRefresh}
            className="text-xs font-bold text-slate-400 hover:text-cyan-400 flex items-center transition-colors"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${(isLoading || isPending) ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        </div>

        {/* ─── 검색바 ─── */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-600" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="유저 검색 (ID, 닉네임, 이름, UUID...)"
            className="w-full pl-10 pr-10 py-2.5 bg-black/60 border border-cyan-900/50 rounded-sm text-sm text-cyan-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/70 focus:shadow-[0_0_10px_rgba(0,255,255,0.15)] transition-all font-noto"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-cyan-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* ─── 테이블 ─── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-cyan-950/20 border-b border-cyan-900/50 text-cyan-600 tracking-wide text-xs font-bold">
            <tr>
              {SORTABLE_COLUMNS.map(({ key, label }) => (
                <th key={key} className="px-6 py-4">
                  <button
                    onClick={() => handleSort(key)}
                    className="group/th flex items-center hover:text-cyan-400 transition-colors cursor-pointer select-none"
                  >
                    {label}
                    {renderSortIcon(key)}
                  </button>
                </th>
              ))}
              <th className="px-6 py-4 text-right">강제 명령</th>
            </tr>
          </thead>
          <tbody className="text-slate-300 font-medium relative text-sm">
            {(isLoading || isPending) && (
              <tr className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <td><RefreshCw className="w-6 h-6 text-cyan-500 animate-spin" /></td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id} className="data-row group">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_#0ff] mr-3"></div>
                    <div>
                      <p className="text-white font-bold tracking-wide">{user.username}</p>
                      <p className="text-slate-500 text-xs font-mono mt-0.5" title={user.id}>
                        ID: {user.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as any)}
                    className="bg-black/60 border border-cyan-700/50 text-cyan-300 text-xs rounded-sm px-2 py-1 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 uppercase cursor-pointer"
                  >
                    <option value="admin">Admin</option>
                    <option value="premium">Premium</option>
                    <option value="user">User</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center border border-yellow-600/30 bg-black/40 rounded-sm px-2 py-1 w-32 group-hover:border-yellow-500/60 transition-colors">
                    <Coins className="w-3 h-3 text-yellow-500 mr-2" />
                    <input
                      type="number"
                      value={user.chips_balance}
                      onChange={(e) => {
                         const val = e.target.value;
                         setUsers(prev => prev.map(u => u.id === user.id ? { ...u, chips_balance: parseInt(val) || 0 } : u))
                      }}
                      onBlur={(e) => handleChipsChange(user.id, e.target.value)}
                      className="bg-transparent focus:outline-none text-yellow-100 w-full font-orbitron text-sm tracking-wider"
                    />
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                  {user.last_seen_at ? new Date(user.last_seen_at).toLocaleString() : '접속 기록 없음'}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors p-2 rounded-sm border border-transparent hover:border-red-500/30"
                    title="계정 파기"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-500 text-sm">
                  {debouncedSearch ? `"${debouncedSearch}" 검색 결과가 없습니다.` : '검색된 유저가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── 페이지네이션 ─── */}
      <div className="px-6 py-4 bg-black/60 border-t border-cyan-900/30 flex items-center justify-between">
        <span className="text-xs text-cyan-700 tracking-wide font-bold">
          페이지 {page} / {totalPages} (총 {totalCount} 명)
          {debouncedSearch && <span className="ml-2 text-cyan-500">— 검색: &quot;{debouncedSearch}&quot;</span>}
        </span>
        <div className="flex space-x-1 font-orbitron text-xs">
          <button 
            onClick={() => fetchUsers(page - 1)}
            disabled={page === 1 || isLoading || isPending}
            className="px-3 py-1 bg-black border border-cyan-900/50 text-cyan-700 disabled:opacity-50 hover:bg-cyan-900/20 transition-colors rounded-sm"
          >
            &lt;
          </button>
          <span className="px-3 py-1 bg-cyan-900/40 border border-cyan-600 text-cyan-400 rounded-sm shadow-[0_0_10px_rgba(0,255,255,0.2)]">
            {page.toString().padStart(2, '0')}
          </span>
          <button 
            onClick={() => fetchUsers(page + 1)}
            disabled={page >= totalPages || isLoading || isPending}
            className="px-3 py-1 bg-black border border-cyan-900/50 text-cyan-700 disabled:opacity-50 hover:bg-cyan-900/20 transition-colors rounded-sm"
          >
            &gt;
          </button>
        </div>
      </div>
    </div>
  )
}
