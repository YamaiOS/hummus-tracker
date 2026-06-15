import { useQuery } from '@tanstack/react-query'
import { fetchChokepoints, Chokepoint } from '../api/client'

function pctColor(pct: number | null): string {
  if (pct === null) return 'bg-petro-border'
  if (pct < 60) return 'bg-red-500'
  if (pct < 85) return 'bg-petro-gold'
  return 'bg-teal-400'
}

function pctTextColor(pct: number | null): string {
  if (pct === null) return 'text-text-faint'
  if (pct < 60) return 'text-red-400'
  if (pct < 85) return 'text-petro-gold'
  return 'text-teal-400'
}

function pctLabel(pct: number | null): string {
  if (pct === null) return 'N/A'
  if (pct < 60) return 'DEPRESSED'
  if (pct < 85) return 'REDUCED'
  return 'NORMAL'
}

export default function ChokepointComparison() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['chokepoints'],
    queryFn: fetchChokepoints,
    refetchInterval: 300_000,
  })

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading chokepoint data…</span>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="h-48 flex items-center justify-center">
        <span className="text-xs text-text-faint">Chokepoint data unavailable</span>
      </div>
    )
  }

  const chokepoints: Chokepoint[] = data.chokepoints ?? []

  if (chokepoints.length === 0) {
    return (
      <p className="text-sm text-text-faint text-center py-8">No chokepoint data available</p>
    )
  }

  return (
    <div className="space-y-3">
      {chokepoints.map((cp) => {
        const pct = cp.pct_of_baseline
        const barWidth = pct !== null ? Math.min(pct, 110) : 0
        const label = pctLabel(pct)
        const textCls = pctTextColor(pct)
        const barCls = pctColor(pct)

        return (
          <div key={cp.id} className="space-y-1.5">
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-warm uppercase tracking-wide">
                  {cp.name}
                </span>
                <span className={`text-[10px] font-mono font-bold uppercase ${textCls}`}>
                  {label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {cp.latest_tanker !== null && (
                  <span className="text-[11px] text-text-muted font-mono">
                    {cp.latest_tanker} tankers
                  </span>
                )}
                <span className={`text-xs font-mono font-bold tabular-nums ${textCls}`}>
                  {pct !== null ? `${pct.toFixed(0)}%` : 'N/A'}
                </span>
              </div>
            </div>
            {/* Baseline marker at 100% */}
            <div className="relative h-2 w-full bg-petro-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barCls}`}
                style={{ width: `${barWidth}%` }}
              />
              {/* 100% baseline tick */}
              <div
                className="absolute top-0 bottom-0 w-px bg-white/30"
                style={{ left: `${Math.min(100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-text-faint font-mono">
              <span>0%</span>
              <span className="text-text-faint/50">← 30d baseline →</span>
              <span>100%+</span>
            </div>
          </div>
        )
      })}
      <p className="text-[10px] text-text-faint font-mono uppercase pt-1">
        Source: {data.source} · {data.updated_at ? new Date(data.updated_at).toLocaleString() : '—'}
      </p>
    </div>
  )
}
