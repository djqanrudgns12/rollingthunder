import { createClient } from '@/lib/supabase/server'
import MapTable from './MapTable'

export default async function AdminMapsPage() {
  const supabase = await createClient()

  // Fetch maps with creator info
  const { data: maps, error } = await supabase
    .from('maps')
    .select('*, creator:creator_id(username)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Failed to load maps:', error)
  }

  const officialCount = maps?.filter(m => m.is_official).length || 0

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 font-rajdhani">
        <div className="glass-panel p-5 rounded-sm relative overflow-hidden border border-purple-500/30 group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all"></div>
          <p className="text-[10px] text-purple-400 tracking-[0.2em] uppercase font-bold mb-1">Active Topology Maps</p>
          <p className="text-4xl font-black text-white font-orbitron">{maps?.length || 0}</p>
          <div className="mt-2 text-xs text-slate-400">{officialCount} Official / {(maps?.length || 0) - officialCount} Custom</div>
        </div>
      </div>

      <MapTable initialMaps={maps || []} />
    </>
  )
}
