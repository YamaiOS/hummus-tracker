import { useQuery } from '@tanstack/react-query'
import { fetchActivity } from '../api/client'

export default function ActivityFeed() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['activityFeed'],
    queryFn: () => fetchActivity(20),
    refetchInterval: 30_000,
  })

  if (isLoading && !events) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading...</span>
      </div>
    )
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-petro-red'
      case 'warning': return 'bg-petro-gold'
      default: return 'bg-petro-teal'
    }
  }

  return (
    <div className="space-y-0 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar divide-y divide-petro-border">
      {(events || []).length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-xs text-text-faint uppercase font-bold tracking-wide">No recent events</p>
        </div>
      ) : (
        events?.map((event) => (
          <div 
            key={event.id} 
            className="py-3 px-1 hover:bg-petro-card-hover transition-colors group"
          >
            <div className="flex items-start gap-3">
              <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${getSeverityColor(event.severity)}`} />
              <div className="space-y-1 min-w-0">
                <p className="text-xs font-medium text-text-warm leading-snug">
                  {event.message}
                </p>
                <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
                  <span className="font-bold text-text-faint">
                    {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span>•</span>
                  <span className="uppercase truncate opacity-70">{event.event_type.replace(/_/g, ' ')}</span>
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
