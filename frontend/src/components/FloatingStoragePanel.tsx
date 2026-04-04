import { useQuery } from '@tanstack/react-query'
import { fetchFloatingStorage } from '../api/client'

export default function FloatingStoragePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['floatingStorage'],
    queryFn: fetchFloatingStorage,
    refetchInterval: 600_000,
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
          <p className="text-xs text-text-faint uppercase font-bold tracking-wide">No floating storage</p>
        </div>
      ) : (
        vessels.map((v) => (
          <div key={v.mmsi} className="py-3 px-1 hover:bg-petro-card-hover transition-colors">
            <div className="flex justify-between items-start mb-1.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-petro-teal shrink-0" />
                <span className="text-sm font-bold text-text-warm truncate max-w-[160px] uppercase tracking-tight">
                  {v.vessel_name || v.mmsi}
                </span>
              </div>
              <span className="text-xs font-bold text-text-muted border border-petro-border px-1 py-0.5 rounded-sm">
                {v.vessel_class}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-y-1 font-mono text-[11px] text-text-muted">
              <div className="flex gap-1.5">
                <span className="text-text-faint uppercase font-bold">CARGO:</span>
                <span className="text-text-warm font-bold">{(v.estimated_barrels / 1_000_000).toFixed(1)}M BBL</span>
              </div>
              <div className="text-right">
                <span className="text-text-faint uppercase font-bold mr-1.5">STAY:</span>
                <span className="text-petro-teal font-bold">{Math.round(v.duration_hrs)}h</span>
              </div>
              <div className="flex gap-1.5 col-span-2">
                <span className="text-text-faint uppercase font-bold">POS:</span>
                <span>{v.latitude.toFixed(2)}, {v.longitude.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
