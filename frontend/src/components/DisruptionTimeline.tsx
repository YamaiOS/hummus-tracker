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
    <div className="relative">
      <div className="absolute left-[18px] top-3 bottom-3 w-px bg-petro-border" />

      <div className="space-y-3">
        {events.map((evt, i) => (
          <EventCard key={i} event={evt} />
        ))}
      </div>
    </div>
  )
}

function EventCard({ event }: { event: DisruptionEvent }) {
  const style = severityColors[event.severity] || severityColors.low

  return (
    <div className="flex gap-3 relative">
      <div className="flex-shrink-0 w-9 flex justify-center pt-3 z-10">
        <div className={`w-3 h-3 rounded-full ${style.dot}`} />
      </div>

      <div className="flex-1 border-b border-petro-border pb-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-text-warm">{event.title}</h3>
          <div className="flex items-center gap-2 flex-shrink-0">
            {event.category && (
              <span className="text-xs text-text-faint uppercase font-bold">{event.category}</span>
            )}
            <span className={`text-xs font-bold uppercase ${style.text}`}>{event.severity}</span>
            <span className="text-xs text-text-faint font-mono">{formatDate(event.date)}</span>
          </div>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">{event.description}</p>
        <div className="flex items-center gap-3 mt-2">
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
  )
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
