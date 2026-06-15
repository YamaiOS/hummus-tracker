import { useQuery } from '@tanstack/react-query'
import { fetchSeismic } from '../api/client'

function relativeTime(isoTime: string): string {
  const diffMs = Date.now() - new Date(isoTime).getTime()
  const diffH = Math.floor(diffMs / 3_600_000)
  if (diffH < 1) return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.floor(diffH / 24)}d ago`
}

function magColor(mag: number): string {
  if (mag >= 5.5) return 'bg-petro-red text-white'
  if (mag >= 4.5) return 'bg-petro-gold text-petro-bg'
  return 'bg-petro-card border border-petro-border text-text-muted'
}

export default function SeismicPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['seismic'],
    queryFn: fetchSeismic,
    refetchInterval: 600_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading seismic data…</span>
      </div>
    )
  }

  const events = data?.events ?? []
  const count = data?.count ?? 0
  const maxMag = data?.max_mag ?? null
  const windowDays = data?.window_days ?? 7

  return (
    <div className="space-y-3">
      {/* Header stats */}
      <div className="flex items-center gap-4 pb-2 border-b border-petro-border">
        <div>
          <span className="text-xl font-bold font-mono text-text-warm">{count}</span>
          <span className="text-xs text-text-faint ml-1 uppercase">events / {windowDays}d</span>
        </div>
        {maxMag !== null && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-muted uppercase">Max</span>
            <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${magColor(maxMag)}`}>
              M{maxMag.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {events.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-xs text-text-faint uppercase font-bold tracking-wide">No significant seismic activity</p>
          <p className="text-xs text-text-faint mt-1">Monitoring Gulf terminals — Bandar Abbas, Kharg Island</p>
        </div>
      ) : (
        <div className="space-y-0 divide-y divide-petro-border max-h-[320px] overflow-y-auto custom-scrollbar">
          {events.map((ev, i) => (
            <a
              key={`${ev.time}-${i}`}
              href={ev.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 py-2.5 px-1 hover:bg-petro-card-hover transition-colors group block"
            >
              {/* Magnitude badge */}
              <span className={`mt-0.5 shrink-0 text-[11px] font-bold font-mono px-1.5 py-0.5 rounded ${magColor(ev.mag)}`}>
                M{ev.mag.toFixed(1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-text-warm leading-snug truncate group-hover:text-petro-gold transition-colors">
                  {ev.place}
                </p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] font-mono text-text-faint">
                  <span>{relativeTime(ev.time)}</span>
                  <span>·</span>
                  <span>{ev.depth_km.toFixed(0)} km depth</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
      <p className="text-[10px] font-mono text-text-faint uppercase pt-1">
        Source: USGS Earthquake Hazards · Risk to Bandar Abbas / Kharg Island terminals
      </p>
    </div>
  )
}
