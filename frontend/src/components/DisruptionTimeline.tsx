import { useQuery } from '@tanstack/react-query'
import { fetchDisruptions, DisruptionEvent } from '../api/client'

const severityColors: Record<string, { dot: string; text: string }> = {
  critical: { dot: 'bg-petro-red', text: 'text-petro-red' },
  high: { dot: 'bg-petro-gold', text: 'text-petro-gold' },
  medium: { dot: 'bg-petro-gold', text: 'text-petro-gold' },
  low: { dot: 'bg-text-faint', text: 'text-text-faint' },
}

export default function DisruptionTimeline() {
  const { data, isLoading } = useQuery({
    queryKey: ['disruptions'],
    queryFn: fetchDisruptions,
    staleTime: 10 * 60_000,
  })

  if (isLoading) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading...</span>
      </div>
    )
  }

  const events = [...(data?.events ?? [])].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  if (events.length === 0) {
    return <p className="text-sm text-text-faint text-center py-8">No disruption events recorded</p>
  }

  return (
    <div className="space-y-0 divide-y divide-petro-border max-h-[500px] overflow-y-auto custom-scrollbar">
      {events.map((evt, i) => (
        <EventCard key={i} event={evt} />
      ))}
    </div>
  )
}

function EventCard({ event }: { event: DisruptionEvent }) {
  const style = severityColors[event.severity] || severityColors.low

  return (
    <div className="py-3 px-1 hover:bg-petro-card-hover transition-colors">
      <div className="flex items-start gap-2 mb-1 min-w-0">
        <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${style.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h3 className="text-sm font-semibold text-text-warm break-words">{event.title}</h3>
            <span className={`text-xs font-bold uppercase ${style.text}`}>{event.severity}</span>
            <span className="text-xs text-text-faint font-mono">{formatDate(event.date)}</span>
            {event.category && (
              <span className="text-xs text-text-faint uppercase">{event.category}</span>
            )}
          </div>
          <p className="text-xs text-text-muted leading-relaxed mt-1 break-words">{event.description}</p>
          <div className="flex flex-wrap items-center gap-3 mt-1.5">
            {event.brent_impact_pct !== 0 && (
              <span className={`text-xs font-mono font-bold ${event.brent_impact_pct > 0 ? 'text-petro-red' : 'text-petro-green'}`}>
                Brent: {event.brent_impact_pct > 0 ? '+' : ''}{event.brent_impact_pct.toFixed(1)}%
              </span>
            )}
            {event.source && (
              <span className="text-xs text-text-faint">Source: {event.source}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
