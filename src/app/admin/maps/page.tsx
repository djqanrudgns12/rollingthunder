import { getAdminMaps } from '../actions/mapActions'
import MapTable from './MapTable'

export default async function AdminMapsPage() {
  // getAdminMaps()가 count, officialCount, customCount를 모두 반환하므로 별도 쿼리 불필요
  const { data: initialMaps, count, officialCount, customCount } = await getAdminMaps(1, 50)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 font-noto">
        <div className="glass-panel p-5 rounded-sm relative overflow-hidden border border-purple-500/30 group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-xl group-hover:bg-purple-500/20 transition-all"></div>
          <p className="text-sm text-purple-400 tracking-wide font-bold mb-1">전체 맵</p>
          <p className="text-4xl font-black text-white font-orbitron">{count || 0}</p>
        </div>
        <div className="glass-panel p-5 rounded-sm relative overflow-hidden border border-amber-500/30 group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/10 rounded-full blur-xl group-hover:bg-amber-500/20 transition-all"></div>
          <p className="text-sm text-amber-400 tracking-wide font-bold mb-1">공식 프리셋 맵</p>
          <p className="text-4xl font-black text-white font-orbitron">{officialCount || 0}</p>
        </div>
        <div className="glass-panel p-5 rounded-sm relative overflow-hidden border border-emerald-500/30 group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-all"></div>
          <p className="text-sm text-emerald-400 tracking-wide font-bold mb-1">유저 커스텀 맵</p>
          <p className="text-4xl font-black text-white font-orbitron">{customCount || 0}</p>
        </div>
      </div>

      <MapTable initialMaps={initialMaps || []} initialCount={count || 0} />
    </>
  )
}
