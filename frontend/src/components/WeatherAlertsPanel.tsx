import { useQuery } from '@tanstack/react-query'
import { fetchTerminalWeather } from '../api/client'

export default function WeatherAlertsPanel() {
  const { data: weather, isLoading } = useQuery({
    queryKey: ['terminalWeather'],
    queryFn: fetchTerminalWeather,
    refetchInterval: 300_000,
  })

  if (isLoading && !weather) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading Weather...</span>
      </div>
    )
  }

  const terminals = weather || []

  return (
    <div className="space-y-0 divide-y divide-petro-border">
      {terminals.map((t) => (
        <div 
          key={t.terminal_name} 
          className={`py-3 px-1 flex items-center justify-between hover:bg-petro-card-hover transition-colors`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.is_alert_active ? 'bg-petro-red animate-pulse' : 'bg-petro-green'}`} />
            <div className="min-w-0">
              <p className="text-xs font-bold text-text-warm truncate uppercase tracking-tight">
                {t.terminal_name}
              </p>
              <p className="text-[11px] text-text-faint font-mono mt-0.5">
                {t.latitude.toFixed(2)}°N {t.longitude.toFixed(2)}°E
              </p>
            </div>
          </div>
          <div className="text-right ml-4 shrink-0">
            <div className="flex items-baseline gap-1 justify-end font-mono">
              <span className={`text-sm font-bold ${t.is_alert_active ? 'text-petro-red' : 'text-text-warm'}`}>
                {t.wind_speed_knots.toFixed(1)}
              </span>
              <span className="text-xs text-text-faint uppercase">kt</span>
            </div>
            <p className="text-xs text-text-muted font-mono uppercase">
              Gusts {t.wind_gusts_knots.toFixed(1)}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
