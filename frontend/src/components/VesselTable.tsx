import { useQuery } from '@tanstack/react-query'
import { Ship, Navigation, Anchor, Gauge, ArrowRight } from 'lucide-react'
import { fetchLiveVessels, Vessel } from '../api/client'

export default function VesselTable() {
  const { data, isLoading } = useQuery({
    queryKey: ['liveVessels'],
    queryFn: fetchLiveVessels,
    refetchInterval: 15_000, // Faster refresh for the table
  })

  const vessels = data?.vessels ?? []

  if (isLoading && vessels.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 bg-slate-800/30 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (vessels.length === 0) {
    return (
      <div className="text-center py-10 border border-dashed border-slate-800 rounded-lg">
        <Ship size={24} className="mx-auto text-slate-700 mb-2" />
        <p className="text-sm text-slate-500">No vessels currently in the tracking zone</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="text-slate-500 border-b border-slate-800 uppercase tracking-wider">
            <th className="pb-3 pl-2 font-medium">Vessel</th>
            <th className="pb-3 font-medium text-center">Class</th>
            <th className="pb-3 font-medium text-center">Direction</th>
            <th className="pb-3 font-medium pl-4 text-left">Destination</th>
            <th className="pb-3 font-medium text-center">Status</th>
            <th className="pb-3 font-medium text-right">Cargo (Est)</th>
            <th className="pb-3 font-medium text-right pr-2">Last Seen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {vessels.map((v) => (
            <tr key={v.mmsi} className="hover:bg-slate-800/30 transition-colors group">
              <td className="py-3 pl-2">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded bg-slate-800 ${v.is_loaded ? 'text-emerald-400' : 'text-slate-400'}`}>
                    <Ship size={14} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200 group-hover:text-amber-400 transition-colors">
                      {v.name || `MMSI: ${v.mmsi}`}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-[10px] text-slate-500">{v.imo ? `IMO: ${v.imo}` : `Type: ${v.vessel_type}`}</p>
                      {v.flag && <span className="text-[9px] px-1 bg-slate-800 border border-slate-700 rounded text-slate-400 uppercase">{v.flag}</span>}
                    </div>
                  </div>
                </div>
              </td>
              <td className="py-3 text-center">
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {v.vessel_class || 'Other'}
                </span>
              </td>
              <td className="py-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <Navigation size={10} style={{ transform: `rotate(${v.course || 0}deg)` }} className="text-slate-500" />
                  <span className={v.direction === 'outbound' ? 'text-emerald-400' : 'text-blue-400'}>
                    {v.direction === 'outbound' ? 'Outbound' : 'Inbound'}
                  </span>
                </div>
              </td>
              <td className="py-3 pl-4 text-left">
                <div className="flex items-center gap-1.5">
                  <Anchor size={10} className="text-slate-500" />
                  <span className="text-[11px] font-medium text-slate-300 truncate max-w-[120px]">
                    {v.destination || 'UNSPECIFIED'}
                  </span>
                </div>
              </td>
              <td className="py-3 text-center">
                <div className="flex flex-col items-center">
                  <span className={`text-[10px] font-medium ${v.is_loaded ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {v.is_loaded ? 'LOADED' : 'BALLAST'}
                  </span>
                </div>
              </td>
              <td className="py-3 text-right">
                {v.estimated_barrels && v.estimated_barrels > 0 ? (
                  <div>
                    <p className="text-slate-200">{(v.estimated_barrels / 1_000_000).toFixed(2)}M bbl</p>
                    <p className="text-[9px] text-slate-600">{v.draught?.toFixed(1)}m draught</p>
                  </div>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </td>
              <td className="py-3 text-right pr-2 text-slate-500">
                {new Date(v.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
