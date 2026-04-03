import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { fetchDisruptions, DisruptionEvent } from '../api/client'

const severityStyles: Record<string, { border: string; bg: string; badge: string }> = {
  critical: { border: 'border-red-800/50', bg: 'bg-red-950/20', badge: 'bg-red-900 text-red-300' },
  high: { border: 'border-amber-800/50', bg: 'bg-amber-950/20', badge: 'bg-amber-900 text-amber-300' },
  medium: { border: 'border-yellow-800/50', bg: 'bg-yellow-950/20', badge: 'bg-yellow-900 text-yellow-300' },
  low: { border: 'border-slate-700/50', bg: 'bg-slate-800/20', badge: 'bg-slate-700 text-slate-300' },
}

export default function DisruptionTimeline() {
  const { data, isLoading } = useQuery({
    queryKey: ['disruptions'],
    queryFn: fetchDisruptions,
    staleTime: 10 * 60_000,
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-slate-800/30 rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  const events = [...(data?.events ?? [])].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  if (events.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-8">No disruption events recorded</p>
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[18px] top-3 bottom-3 w-px bg-slate-800" />

      <div className="space-y-3">
        {events.map((evt, i) => (
          <EventCard key={i} event={evt} />
        ))}
      </div>
    </div>
  )
}

function EventCard({ event }: { event: DisruptionEvent }) {
  const style = severityStyles[event.severity] || severityStyles.low

  return (
    <div className="flex gap-3 relative">
      {/* Timeline dot */}
      <div className="flex-shrink-0 w-9 flex justify-center pt-3 z-10">
        <div className={`w-3 h-3 rounded-full border-2 ${style.border} ${style.bg}`} />
      </div>

      {/* Card */}
      <div className={`flex-1 rounded-lg border ${style.border} ${style.bg} px-4 py-3`}>
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />
            <h3 className="text-sm font-semibold text-slate-200">{event.title}</h3>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {event.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase font-medium">
                {event.category}
              </span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${style.badge} uppercase font-bold`}>
              {event.severity}
            </span>
            <span className="text-[10px] text-slate-500">{formatDate(event.date)}</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">{event.description}</p>
        <div className="flex items-center gap-3 mt-2">
          {event.brent_impact_pct !== 0 && (
            <span className={`text-[10px] font-medium ${event.brent_impact_pct > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              Brent: {event.brent_impact_pct > 0 ? '+' : ''}{event.brent_impact_pct.toFixed(1)}%
            </span>
          )}
          {event.source && (
            <span className="text-[10px] text-slate-600">Source: {event.source}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
