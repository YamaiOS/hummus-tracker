import { useQuery } from '@tanstack/react-query'
import { ExternalLink, AlertTriangle, Shield } from 'lucide-react'
import { fetchIncidents } from '../api/client'

const SEVERITY_CONFIG = {
  critical: { dot: 'bg-red-500',    text: 'text-red-400',    label: 'CRITICAL' },
  high:     { dot: 'bg-orange-500', text: 'text-orange-400', label: 'HIGH' },
  warning:  { dot: 'bg-petro-gold', text: 'text-petro-gold', label: 'WARNING' },
} as const

type Severity = keyof typeof SEVERITY_CONFIG

const TYPE_COLOR: Record<string, string> = {
  attack:   'text-red-400 bg-red-500/10',
  seizure:  'text-orange-400 bg-orange-500/10',
  closure:  'text-petro-gold bg-petro-gold/10',
  sinking:  'text-blue-400 bg-blue-500/10',
  alert:    'text-text-muted bg-petro-bg',
}

function relativeAge(hours: number): string {
  if (hours < 1)  return 'just now'
  if (hours < 24) return `${Math.round(hours)}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function IncidentTimeline() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    refetchInterval: 300_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">Loading Incidents…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="h-32 flex items-center justify-center gap-2">
        <AlertTriangle size={14} className="text-petro-gold" />
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">Incidents Unavailable</span>
      </div>
    )
  }

  const incidents = data.incidents ?? []

  if (incidents.length === 0) {
    return (
      <div className="py-8 flex flex-col items-center justify-center gap-2 text-center">
        <Shield size={20} className="text-petro-teal opacity-60" />
        <span className="text-xs text-text-faint uppercase tracking-wide">No recent security incidents</span>
      </div>
    )
  }

  return (
    <div className="space-y-0 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
      {incidents.map((inc, i) => {
        const sevCfg = SEVERITY_CONFIG[(inc.severity as Severity)] ?? SEVERITY_CONFIG.warning
        const typeClass = TYPE_COLOR[(inc.type ?? '').toLowerCase()] ?? TYPE_COLOR.alert
        const age = typeof inc.age_hours === 'number' ? relativeAge(inc.age_hours) : inc.date

        return (
          <div
            key={i}
            className={`flex gap-3 py-3 ${i < incidents.length - 1 ? 'border-b border-petro-border/50' : ''}`}
          >
            {/* Timeline column */}
            <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sevCfg.dot}`} />
              {i < incidents.length - 1 && (
                <div className="w-px flex-1 bg-petro-border/40 mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1 pb-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Severity chip */}
                <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${sevCfg.text} bg-current/10`}
                  style={{ backgroundColor: undefined }}>
                  <span className={`${sevCfg.text} font-bold`}>{sevCfg.label}</span>
                </span>
                {/* Type tag */}
                {inc.type && (
                  <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${typeClass}`}>
                    {inc.type}
                  </span>
                )}
                {/* Source */}
                <span className="text-[10px] text-text-faint">{inc.source}</span>
              </div>

              {/* Title / link */}
              {inc.url ? (
                <a
                  href={inc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1 group"
                >
                  <span className="text-[12px] text-text-muted leading-snug group-hover:text-petro-teal transition-colors">
                    {inc.title}
                  </span>
                  <ExternalLink size={10} className="flex-shrink-0 mt-0.5 text-text-faint group-hover:text-petro-teal transition-colors" />
                </a>
              ) : (
                <p className="text-[12px] text-text-muted leading-snug">{inc.title}</p>
              )}

              <p className="text-[10px] text-text-faint font-mono">{age}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
