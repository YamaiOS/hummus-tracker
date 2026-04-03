import { useQuery } from '@tanstack/react-query'
import { fetchImpact } from '../api/client'

export default function VolumeByFlag() {
  const { data, isLoading } = useQuery({
    queryKey: ['impact'],
    queryFn: fetchImpact,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return <div className="h-48 bg-slate-800/20 animate-pulse rounded-lg" />
  }

  const transits = data?.selective_transits ?? []
  const maxBarrels = Math.max(...transits.map(t => t.barrels), 1)

  return (
    <div className="space-y-4">
      {transits.length === 0 ? (
        <p className="text-xs text-slate-500 text-center py-10 italic">No outbound transit data available for breakdown</p>
      ) : (
        transits.map((item, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-slate-200">{item.flag}</span>
                <span className="text-[9px] text-slate-500 uppercase tracking-tighter">{item.vessels} Vessels</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">
                {(item.barrels / 1_000_000).toFixed(2)}M bbl
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500/60 rounded-full transition-all duration-1000"
                style={{ width: `${(item.barrels / maxBarrels) * 100}%` }}
              />
            </div>
          </div>
        ))
      )}
      
      <div className="mt-6 pt-4 border-t border-slate-800/50">
        <p className="text-[9px] text-slate-600 leading-relaxed italic">
          * Selective Transit Intelligence: Monitoring volume flow by sovereign flag to identify selective permitting or blockade patterns in the Strait.
        </p>
      </div>
    </div>
  )
}
