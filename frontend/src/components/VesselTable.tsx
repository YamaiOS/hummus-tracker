import { useQuery } from '@tanstack/react-query'
import { fetchLiveVessels, Vessel } from '../api/client'

export default function VesselTable() {
  const { data, isLoading } = useQuery({
    queryKey: ['liveVessels'],
    queryFn: fetchLiveVessels,
    refetchInterval: 15_000,
  })

  const vessels = data?.vessels ?? []

  if (isLoading && vessels.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-petro-card border border-petro-border rounded-lg">
        <span className="text-sm text-text-muted">Loading Registry...</span>
      </div>
    )
  }

  if (vessels.length === 0) {
    return (
      <div className="text-center py-12 bg-petro-card border border-petro-border rounded-lg">
        <p className="text-sm text-text-faint">No vessels currently in the tracking zone</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead>
          <tr className="bg-petro-bg text-text-muted uppercase tracking-wide text-xs border-b border-petro-border sticky top-0 z-10">
            <th className="py-3 px-4 font-bold">Vessel / IMO</th>
            <th className="py-3 px-2 font-bold text-center">Class</th>
            <th className="py-3 px-2 font-bold text-center">Dir</th>
            <th className="py-3 px-4 font-bold">Destination</th>
            <th className="py-3 px-2 font-bold text-center">Dwell</th>
            <th className="py-3 px-2 font-bold text-center">Status</th>
            <th className="py-3 px-4 font-bold text-right">Cargo (Est)</th>
            <th className="py-3 px-4 font-bold text-center">Grade</th>
            <th className="py-3 px-4 font-bold text-right pr-6">Last Update</th>
          </tr>
        </thead>
        <tbody className="text-sm font-mono divide-y divide-petro-border">
          {vessels.map((v, idx) => (
            <tr 
              key={v.mmsi} 
              className={`${idx % 2 === 0 ? 'bg-petro-card' : 'bg-petro-bg'} hover:bg-petro-card-hover transition-colors group`}
            >
              <td className="py-3 px-4">
                <div className="flex flex-col">
                  <span className="font-bold text-text-warm group-hover:text-petro-teal transition-colors">
                    {v.name || `MMSI: ${v.mmsi}`}
                  </span>
                  <div className="flex items-center gap-2 text-[11px] text-text-faint font-sans uppercase">
                    <span>{v.imo ? `IMO:${v.imo}` : `T:${v.vessel_type}`}</span>
                    {v.flag && <span className="text-text-muted">{v.flag}</span>}
                  </div>
                </div>
              </td>
              <td className="py-3 px-2 text-center">
                <span className="text-[11px] text-text-muted font-sans border border-petro-border px-1.5 py-0.5 rounded-sm">
                  {v.vessel_class || 'OTHER'}
                </span>
              </td>
              <td className="py-3 px-2 text-center">
                <span className={`font-bold ${v.direction === 'outbound' ? 'text-petro-teal' : 'text-text-muted'}`}>
                  {v.direction === 'outbound' ? 'OUT' : 'IN'}
                </span>
              </td>
              <td className="py-3 px-4 font-sans">
                <span className="text-[13px] text-text-warm truncate max-w-[140px] block">
                  {v.destination || '—'}
                </span>
              </td>
              <td className="py-3 px-2 text-center text-[11px]">
                <span className={v.dwell_hours && v.dwell_hours > 48 ? 'text-petro-red' : v.dwell_hours && v.dwell_hours > 24 ? 'text-petro-gold' : 'text-text-faint'}>
                  {v.dwell_hours ? `${v.dwell_hours.toFixed(1)}h` : '<1h'}
                </span>
              </td>
              <td className="py-3 px-2 text-center text-[11px]">
                <span className={`font-bold ${v.is_loaded ? 'text-petro-teal' : 'text-text-faint'}`}>
                  {v.is_loaded ? 'LOADED' : 'BALLAST'}
                </span>
              </td>
              <td className="py-3 px-4 text-right">
                {v.estimated_barrels && v.estimated_barrels > 0 ? (
                  <div className="flex flex-col">
                    <span className="text-text-warm font-bold">{(v.estimated_barrels / 1_000_000).toFixed(2)}M</span>
                    <span className="text-[11px] text-text-faint font-sans">{v.draught?.toFixed(1)}m</span>
                  </div>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </td>
              <td className="py-3 px-4 text-center">
                {v.crude_grade ? (
                  <span className="text-[11px] text-petro-gold font-sans font-bold border border-petro-gold/20 px-1.5 py-0.5 rounded-sm bg-petro-gold/5">
                    {v.crude_grade}
                  </span>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </td>
              <td className="py-3 px-4 text-right pr-6 text-text-faint text-[11px] font-sans uppercase">
                {new Date(v.observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
