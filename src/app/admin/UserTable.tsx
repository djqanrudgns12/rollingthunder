'use client'

import { useState } from 'react'
import { Trash2, Shield, Coins, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { deleteUserAccount, updateUserRole, updateUserChips } from './actions/userActions'

interface User {
  id: string
  username: string
  role: 'user' | 'premium' | 'admin'
  chips_balance: number
  created_at: string
}

export default function UserTable({ initialUsers }: { initialUsers: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleDelete = async (userId: string) => {
    if (!window.confirm('정말 이 사용자를 완전히 삭제하시겠습니까? (복구 불가)')) return

    // 1. Optimistic Update (UI 즉각 반영)
    const backupUsers = [...users]
    setUsers((prev) => prev.filter((u) => u.id !== userId))

    // 2. Server Action 비동기 호출
    const result = await deleteUserAccount(userId)

    // 3. 에러 발생 시 UI 롤백
    if (!result.success) {
      setUsers(backupUsers)
      toast.error(`Error: ${result.error}`)
    } else {
      toast.success('User purged from the system.')
    }
  }

  const handleRoleChange = async (userId: string, newRole: 'user' | 'premium' | 'admin') => {
    // 1. Optimistic Update
    const backupUsers = [...users]
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
    )

    // 2. Server Action
    const result = await updateUserRole(userId, newRole)
    if (!result.success) {
      setUsers(backupUsers)
      toast.error(`Error: ${result.error}`)
    } else {
      toast.success('Access level updated.')
    }
  }

  const handleChipsChange = async (userId: string, newChipsStr: string) => {
    const newChips = parseInt(newChipsStr, 10)
    if (isNaN(newChips) || newChips < 0) return

    // 1. Optimistic Update
    const backupUsers = [...users]
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, chips_balance: newChips } : u))
    )

    // 2. Server Action
    const result = await updateUserChips(userId, newChips)
    if (!result.success) {
      setUsers(backupUsers)
      toast.error(`Error: ${result.error}`)
    } else {
      toast.success('Capital updated.')
    }
  }

  return (
    <div className="glass-panel rounded-sm overflow-hidden flex flex-col font-rajdhani">
      <div className="px-6 py-4 border-b border-cyan-900/50 bg-black/40 flex justify-between items-center">
        <h2 className="text-sm font-bold tracking-widest text-cyan-400 uppercase flex items-center">
          <Shield className="w-4 h-4 mr-2" />
          Entity Registry
        </h2>
        <button 
          onClick={() => window.location.reload()}
          className="text-[10px] text-slate-400 hover:text-cyan-400 uppercase tracking-widest flex items-center transition-colors"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-cyan-950/20 border-b border-cyan-900/50 text-cyan-600 uppercase tracking-[0.15em] text-[10px] font-bold">
            <tr>
              <th className="px-6 py-4">Identification</th>
              <th className="px-6 py-4">Access Level</th>
              <th className="px-6 py-4">Capital (Chips)</th>
              <th className="px-6 py-4">Init Date</th>
              <th className="px-6 py-4 text-right">Override</th>
            </tr>
          </thead>
          <tbody className="text-slate-300 font-medium">
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
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors p-2 rounded-sm border border-transparent hover:border-red-500/30"
                    title="PURGE ENTITY"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500">
                  No entities found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
