import { getEconomyLogs } from '../actions/economyActions'
import EconomyTable from './EconomyTable'

export default async function AdminEconomyPage() {
  const { data: logs, count, error } = await getEconomyLogs(1, 50)

  if (error) {
    console.error('Failed to load economy logs:', error)
  }

  // 간단한 통계용 계산 (최신 50개 기준이므로 전체 통계는 아님)
  const recentVolume = logs?.reduce((acc, log) => acc + Math.abs(log.amount), 0) || 0

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 font-rajdhani">
        <div className="glass-panel p-5 rounded-sm relative overflow-hidden border border-yellow-500/30 group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-yellow-500/10 rounded-full blur-xl group-hover:bg-yellow-500/20 transition-all"></div>
          <p className="text-[10px] text-yellow-400 tracking-[0.2em] uppercase font-bold mb-1">Total Logs Count</p>
          <p className="text-4xl font-black text-white font-orbitron">{count || 0}</p>
        </div>
        
        <div className="glass-panel p-5 rounded-sm relative overflow-hidden border border-yellow-500/30 group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-yellow-500/10 rounded-full blur-xl group-hover:bg-yellow-500/20 transition-all"></div>
          <p className="text-[10px] text-yellow-400 tracking-[0.2em] uppercase font-bold mb-1">Recent Vol (50 logs)</p>
          <p className="text-4xl font-black text-white font-orbitron">{recentVolume}</p>
        </div>
      </div>

      <EconomyTable initialLogs={logs || []} initialCount={count || 0} />
    </>
  )
}
