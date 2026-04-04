import { useQuery } from '@tanstack/react-query'
import { fetchFreight } from '../api/client'

export default function FreightRates() {
  const { data, isLoading } = useQuery({
    queryKey: ['freight'],
    queryFn: fetchFreight,
    refetchInterval: 60_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading Rates...</span>
      </div>
    )
  }

  return (
    <div className="space-y-0 divide-y divide-petro-border">
      {data?.estimates.map((est, i) => (
        <div key={i} className="py-3 px-1 hover:bg-petro-card-hover transition-colors group">
          <div className="flex justify-between items-start mb-2">
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-text-warm uppercase tracking-tight truncate">{est.class}</h4>
              <p className="text-[11px] text-text-faint font-mono uppercase truncate">{est.route}</p>
            </div>
            <div className={`text-[11px] font-bold uppercase tracking-tighter ${
              est.status === 'RISING' ? 'text-petro-gold' : 'text-text-faint'
            }`}>
              {est.status}
            </div>
          </div>
          
          <div className="flex justify-between items-baseline font-mono">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-text-muted uppercase font-bold">WS</span>
              <span className="text-sm font-bold text-text-warm">{est.ws_points}</span>
            </div>
            <div className="text-right flex items-baseline gap-1.5">
              <span className="text-xs text-text-muted uppercase font-bold">TCE</span>
              <span className="text-sm font-bold text-petro-teal">
                ${(est.tce_day_rate_usd / 1000).toFixed(1)}K
                <span className="text-xs text-text-faint ml-0.5 lowercase font-normal">/day</span>
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
