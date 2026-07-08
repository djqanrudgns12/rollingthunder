import { createClient } from '@/lib/supabase/server'
import UserTable from './UserTable'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  // 1. Fetch total counts and users
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, username, role, chips_balance, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load users:', error)
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 font-rajdhani">
        <div className="glass-panel p-5 rounded-sm neon-border relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all"></div>
          <p className="text-[10px] text-cyan-400 tracking-[0.2em] uppercase font-bold mb-1">Total Entities</p>
          <p className="text-4xl font-black text-white font-orbitron">{totalUsers || 0}</p>
        </div>
      </div>

      <UserTable initialUsers={users || []} />
    </>
  )
}
