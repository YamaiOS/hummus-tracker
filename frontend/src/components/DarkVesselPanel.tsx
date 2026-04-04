import { useQuery } from '@tanstack/react-query'
import { fetchDarkVessels } from '../api/client'

export default function DarkVesselPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['darkVessels'],
    queryFn: fetchDarkVessels,
    refetchInterval: 60_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading...</span>
      </div>
    )
  }

  const vessels = data?.vessels || []

  return (
    <div className="space-y-0 divide-y divide-petro-border">
      {vessels.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-text-faint uppercase font-bold tracking-wide">No dark vessels detected</p>
          <p className="text-xs text-text-faint mt-1">Detection runs hourly</p>
        </div>
      ) : (
        vessels.map((v) => (
          <div key={v.mmsi} className="py-3 px-1 hover:bg-petro-card-hover transition-colors">
            <div className="flex justify-between items-start mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-petro-red shrink-0" />
                <span className="text-sm font-bold text-text-warm truncate max-w-[160px] uppercase tracking-tight">
                  {v.vessel_name || v.mmsi}
                </span>
              </div>
              <span className={`text-xs font-bold ${v.is_loaded ? 'text-petro-gold' : 'text-text-faint'}`}>
                {v.is_loaded ? 'LOADED' : 'BALLAST'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-y-1 font-mono text-[11px] text-text-muted">
              <div className="flex gap-1.5">
                <span className="text-text-faint uppercase font-bold">LKP:</span>
                <span>{v.last_lat.toFixed(2)}, {v.last_lon.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-text-faint uppercase font-bold mr-1.5">SPD:</span>
                <span>{v.last_speed.toFixed(1)}kt</span>
              </div>
              <div className="flex gap-1.5">
                <span className="text-text-faint uppercase font-bold">SILENT:</span>
                <span className="text-petro-red font-bold">
                  {(() => {
                    const diffMs = new Date().getTime() - new Date(v.last_observed_at).getTime()
                    const diffMins = Math.round(diffMs / 60000)
                    if (diffMins < 60) return `${diffMins}m`
                    return `${Math.round(diffMins / 60)}h`
                  })()}
                </span>
              </div>
              <div className="text-right">
                <span>{new Date(v.last_observed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
