import { createClient } from '@/lib/supabase/server'
import { getMaps } from '../actions/mapActions'
import MapTable from './MapTable'

export default async function AdminMapsPage() {
  const supabase = await createClient()

  // Fetch only count and total stats
  const { count: totalMaps } = await supabase
    .from('maps')
    .select('*', { count: 'exact', head: true })

  const { count: officialCount } = await supabase
    .from('maps')
    .select('*', { count: 'exact', head: true })
    .eq('is_official', true)

  // Fetch paginated initial maps
  const { data: initialMaps } = await getMaps(1, 50)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 font-noto">
        <div className="glass-panel p-5 rounded-sm relative overflow-hidden border border-purple-500/30 group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all"></div>
          <p className="text-sm text-purple-400 tracking-wide font-bold mb-1">활성화된 커스텀 맵</p>
          <p className="text-4xl font-black text-white font-orbitron">{totalMaps || 0}</p>
          <div className="mt-2 text-sm text-slate-400">{officialCount || 0} 공식 맵 / {(totalMaps || 0) - (officialCount || 0)} 일반 커스텀 맵</div>
        </div>
      </div>

      <MapTable initialMaps={initialMaps || []} initialCount={totalMaps || 0} />
    </>
  )
}
