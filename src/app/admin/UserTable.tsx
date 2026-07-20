'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react'
import { Trash2, Shield, Coins, RefreshCw, Search, ArrowUp, ArrowDown, ArrowUpDown, X, Crown, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import {
  deleteUserAccount,
  updateUserRole,
  updateUserChips,
  getUsers,
  upgradeToPremium,
  bulkUpgradeToPremium,
} from './actions/userActions'
import type { SortColumn, SortDirection } from './actions/userActions'
import { PREMIUM_UPGRADE_BONUS_CHIPS } from '@/lib/premium'

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
  { key: 'nickname', label: '닉네임' },
  { key: 'name', label: '이름' },
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

  // 일괄 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const limit = 50
  const totalPages = Math.ceil(totalCount / limit) || 1

  // 승급 대상 유저 (role === 'user'인 유저만)
  const upgradableUsers = users.filter(u => u.role === 'user')
  const selectedUpgradable = upgradableUsers.filter(u => selectedIds.has(u.id))
  const allUpgradableSelected = upgradableUsers.length > 0 && upgradableUsers.every(u => selectedIds.has(u.id))

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

  // ─── 페이지/검색 변경 시 선택 초기화 ───
  useEffect(() => {
    setSelectedIds(new Set())
  }, [page, debouncedSearch])

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
      newDirection = sortDirection === 'asc' ? 'desc' : 'asc'
    } else {
      newDirection = column === 'nickname' || column === 'name' || column === 'username' || column === 'role' ? 'asc' : 'desc'
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

  // ─── 체크박스 핸들러 ───
  const toggleSelect = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    if (allUpgradableSelected) {
      // 전체 해제
      setSelectedIds(prev => {
        const next = new Set(prev)
        upgradableUsers.forEach(u => next.delete(u.id))
        return next
      })
    } else {
      // 전체 선택
      setSelectedIds(prev => {
        const next = new Set(prev)
        upgradableUsers.forEach(u => next.add(u.id))
        return next
      })
    }
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

  // ─── role 변경 핸들러 (premium 승급 시 자동 칩 지급) ───
  const handleRoleChange = async (userId: string, currentRole: string, newRole: 'user' | 'premium' | 'admin') => {
    if (currentRole === newRole) return

    // user → premium 승급 시 upgradeToPremium 사용 (칩 보너스 포함)
    if (currentRole === 'user' && newRole === 'premium') {
      if (!window.confirm(`프리미엄으로 승급하면 ${PREMIUM_UPGRADE_BONUS_CHIPS.toLocaleString()} Chips가 자동 지급됩니다. 진행하시겠습니까?`)) return

      startTransition(async () => {
        const result = await upgradeToPremium(userId)
        if (!result.success) {
          toast.error(`Error: ${result.error}`)
        } else if (result.skipped) {
          toast.info(result.reason || '이미 프리미엄 이상 등급입니다.')
        } else if ('warning' in result && result.warning) {
          toast.warning(result.warning)
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: 'premium' } : u))
        } else {
          toast.success(`프리미엄 승급 완료! ${PREMIUM_UPGRADE_BONUS_CHIPS.toLocaleString()} Chips 지급됨 🎉`)
          fetchUsers(page) // 칩 잔액도 갱신되므로 전체 새로고침
        }
      })
      return
    }

    // 그 외 역할 변경 (premium→user 강등, admin 변경 등)은 기존 로직
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

  // ─── 일괄 프리미엄 승급 핸들러 ───
  const handleBulkUpgrade = async () => {
    const ids = Array.from(selectedIds).filter(id => {
      const user = users.find(u => u.id === id)
      return user && user.role === 'user'
    })

    if (ids.length === 0) {
      toast.error('승급 가능한 유저를 선택해주세요.')
      return
    }

    if (!window.confirm(
      `선택한 ${ids.length}명의 유저를 프리미엄으로 일괄 승급합니다.\n` +
      `각 유저에게 ${PREMIUM_UPGRADE_BONUS_CHIPS.toLocaleString()} Chips가 지급됩니다.\n\n계속하시겠습니까?`
    )) return

    startTransition(async () => {
      const result = await bulkUpgradeToPremium(ids)
      if (!result.success) {
        toast.error(`Error: ${result.error}`)
      } else {
        const messages: string[] = []
        if (result.upgraded > 0) messages.push(`${result.upgraded}명 승급 완료`)
        if (result.skipped > 0) messages.push(`${result.skipped}명 스킵 (이미 프리미엄)`)
        if (result.failed > 0) messages.push(`${result.failed}명 실패`)

        if (result.failed > 0) {
          toast.warning(messages.join(', '))
        } else {
          toast.success(messages.join(', ') + ' 🎉')
        }

        setSelectedIds(new Set())
        fetchUsers(page)
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
          <div className="flex items-center gap-3">
            {/* 일괄 승급 버튼 */}
            {selectedUpgradable.length > 0 && (
              <button
                onClick={handleBulkUpgrade}
                disabled={isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-sm transition-all
                  bg-gradient-to-r from-amber-600/30 to-purple-600/30 border border-amber-500/50
                  text-amber-300 hover:from-amber-600/50 hover:to-purple-600/50 hover:border-amber-400/70
                  hover:shadow-[0_0_15px_rgba(251,191,36,0.3)] disabled:opacity-50"
              >
                <Crown className="w-3.5 h-3.5" />
                선택한 {selectedUpgradable.length}명 프리미엄 승급
              </button>
            )}
            <button 
              onClick={handleRefresh}
              className="text-xs font-bold text-slate-400 hover:text-cyan-400 flex items-center transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${(isLoading || isPending) ? 'animate-spin' : ''}`} />
              새로고침
            </button>
          </div>
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
              {/* 체크박스 헤더 */}
              <th className="px-3 py-4 w-10">
                <button
                  onClick={toggleSelectAll}
                  className="text-cyan-600 hover:text-cyan-400 transition-colors"
                  title={allUpgradableSelected ? '전체 해제' : '승급 대상 전체 선택'}
                >
                  {allUpgradableSelected && upgradableUsers.length > 0
                    ? <CheckSquare className="w-4 h-4" />
                    : <Square className="w-4 h-4" />
                  }
                </button>
              </th>
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
            {users.map((user) => {
              const isUpgradable = user.role === 'user'
              const isSelected = selectedIds.has(user.id)

              return (
                <tr key={user.id} className={`data-row group ${isSelected ? 'bg-amber-500/5 border-l-2 border-l-amber-400/50' : ''}`}>
                  {/* 체크박스 */}
                  <td className="px-3 py-4">
                    {isUpgradable ? (
                      <button
                        onClick={() => toggleSelect(user.id)}
                        className={`transition-colors ${isSelected ? 'text-amber-400' : 'text-slate-600 hover:text-cyan-400'}`}
                      >
                        {isSelected
                          ? <CheckSquare className="w-4 h-4" />
                          : <Square className="w-4 h-4" />
                        }
                      </button>
                    ) : (
                      <span className="text-slate-700">
                        <Square className="w-4 h-4 opacity-20" />
                      </span>
                    )}
                  </td>
                  {/* 닉네임 */}
                  <td className="px-6 py-4">
                    <span className="text-white font-bold tracking-wide">{user.nickname || <span className="text-slate-600 italic">—</span>}</span>
                  </td>
                  {/* 이름 */}
                  <td className="px-6 py-4">
                    <span className="text-slate-300">{user.name || <span className="text-slate-600 italic">—</span>}</span>
                  </td>
                  {/* 식별자 (ID) */}
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_#0ff] mr-3"></div>
                      <div>
                        <p className="text-cyan-200 font-bold tracking-wide text-xs">{user.username}</p>
                        <p className="text-slate-600 text-[10px] font-mono mt-0.5" title={user.id}>
                          {user.id.slice(0, 8)}…
                        </p>
                      </div>
                    </div>
                  </td>
                  {/* 접근 등급 */}
                  <td className="px-6 py-4">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, user.role, e.target.value as any)}
                      className="bg-black/60 border border-cyan-700/50 text-cyan-300 text-xs rounded-sm px-2 py-1 focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 uppercase cursor-pointer"
                    >
                      <option value="admin">Admin</option>
                      <option value="premium">Premium</option>
                      <option value="user">User</option>
                    </select>
                  </td>
                  {/* 보유 자산 (칩) */}
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
                  {/* 가입일 */}
                  <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  {/* 최종 접속일 */}
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
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-500 text-sm">
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
