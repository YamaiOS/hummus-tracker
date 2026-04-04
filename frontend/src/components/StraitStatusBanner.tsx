import { useQuery } from '@tanstack/react-query'
import { fetchStraitStatus } from '../api/client'

export default function StraitStatusBanner() {
  const { data: status, isLoading } = useQuery({
    queryKey: ['straitStatus'],
    queryFn: fetchStraitStatus,
    refetchInterval: 30_000,
  })

  if (isLoading || !status) {
    return (
      <div className="bg-petro-bg border-b border-petro-border h-10 flex items-center justify-center">
        <span className="text-xs text-text-faint font-bold uppercase tracking-wide">Calculating Strait Health...</span>
      </div>
    )
  }

  const statusColors = {
    green: 'border-petro-green text-petro-green',
    amber: 'border-petro-gold text-petro-gold',
    red: 'border-petro-red text-petro-red',
  }

  const barColors = {
    green: 'bg-petro-green',
    amber: 'bg-petro-gold',
    red: 'bg-petro-red',
  }

  return (
    <div className={`border-b border-petro-border bg-petro-bg sticky top-[57px] z-40 transition-colors duration-500`}>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-4 min-w-0">
          <div className={`flex items-center gap-2 px-2 py-0.5 rounded border ${statusColors[status.level]} bg-opacity-5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${barColors[status.level]} ${status.level !== 'green' ? 'animate-pulse' : ''}`} />
            <span className="text-[11px] font-bold uppercase tracking-wide">{status.level}</span>
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-tight whitespace-nowrap">SUMMARY:</span>
            <span className="text-[11px] font-medium text-text-warm truncate uppercase tracking-tight">{status.summary}</span>
          </div>
        </div>
        <div className="flex items-center gap-6 ml-4">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-bold text-text-muted uppercase tracking-tight">HEALTH SCORE</span>
            <div className="flex items-center gap-2">
              <div className="w-32 h-1.5 bg-petro-border rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ${barColors[status.level]}`}
                  style={{ width: `${status.score}%` }}
                />
              </div>
              <span className="text-[11px] font-bold font-mono text-text-warm w-8">{status.score}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
