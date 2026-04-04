import { useQuery } from '@tanstack/react-query'
import { fetchImpact } from '../api/client'

export default function VolumeByFlag() {
  const { data, isLoading } = useQuery({
    queryKey: ['impact'],
    queryFn: fetchImpact,
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading...</span>
      </div>
    )
  }

  const transits = data?.selective_transits ?? []
  const maxBarrels = Math.max(...transits.map(t => t.barrels), 1)

  return (
    <div className="space-y-4">
      {transits.length === 0 ? (
        <p className="text-sm text-text-faint text-center py-8">No outbound transit data available</p>
      ) : (
        transits.map((item, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-warm">{item.flag}</span>
                <span className="text-xs text-text-faint uppercase">{item.vessels} Vessels</span>
              </div>
              <span className="text-xs font-mono text-text-muted">
                {(item.barrels / 1_000_000).toFixed(2)}M bbl
              </span>
            </div>
            <div className="h-1.5 w-full bg-petro-border rounded-full overflow-hidden">
              <div
                className="h-full bg-petro-gold rounded-full transition-all duration-1000"
                style={{ width: `${(item.barrels / maxBarrels) * 100}%` }}
              />
            </div>
          </div>
        ))
      )}
    </div>
  )
}
