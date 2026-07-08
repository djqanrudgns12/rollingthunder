import { createClient } from '@/lib/supabase/server'
import { getUsers } from './actions/userActions'
import UserTable from './UserTable'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  // 1. Fetch total count only (fast)
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  // 2. Fetch first page of users (paginated) via the server action logic
  const { data: initialUsers } = await getUsers(1, 50)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 font-noto">
        <div className="glass-panel p-5 rounded-sm neon-border relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all"></div>
          <p className="text-sm text-cyan-400 tracking-wide font-bold mb-1">등록된 엔티티 (유저 수)</p>
          <p className="text-4xl font-black text-white font-orbitron">{totalUsers || 0}</p>
        </div>
      </div>

      <UserTable initialUsers={initialUsers || []} initialCount={totalUsers || 0} />
    </>
  )
}
