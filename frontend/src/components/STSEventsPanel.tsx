import { useQuery } from '@tanstack/react-query'
import { fetchSTSEvents } from '../api/client'

export default function STSEventsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['stsEvents'],
    queryFn: fetchSTSEvents,
    refetchInterval: 60_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading...</span>
      </div>
    )
  }

  const events = data?.events || []

  return (
    <div className="space-y-0 divide-y divide-petro-border">
      {events.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-text-faint uppercase font-bold tracking-wide">No STS events detected</p>
          <p className="text-xs text-text-faint mt-1">Proximity scan every 15 min</p>
        </div>
      ) : (
        events.map((e) => (
          <div key={e.id} className="py-3 px-1 hover:bg-petro-card-hover transition-colors">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-petro-gold shrink-0" />
              <div className="flex items-center gap-1.5 text-sm font-bold text-text-warm uppercase tracking-tight truncate">
                <span>{e.vessel_a_name || 'UNKNOWN'}</span>
                <span className="text-text-faint text-xs">/</span>
                <span>{e.vessel_b_name || 'UNKNOWN'}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-y-1 font-mono text-[11px] text-text-muted">
              <div className="flex gap-1.5">
                <span className="text-text-faint uppercase font-bold">DIST:</span>
                <span className="text-petro-gold font-bold">{Math.round(e.distance_m)}m</span>
              </div>
              <div className="text-right">
                <span className="text-text-faint uppercase font-bold mr-1.5">TIME:</span>
                <span>{new Date(e.detected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex gap-1.5 col-span-2">
                <span className="text-text-faint uppercase font-bold">POS:</span>
                <span>{e.latitude.toFixed(3)}, {e.longitude.toFixed(3)}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
