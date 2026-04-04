import { useQuery } from '@tanstack/react-query'
import { fetchLiveVessels } from '../api/client'

const CLASS_ORDER = ['VLCC', 'Suezmax', 'Aframax', 'LNG', 'Other']
const CLASS_COLORS: Record<string, string> = {
  VLCC: 'bg-petro-teal',
  Suezmax: 'bg-petro-gold',
  Aframax: 'bg-text-muted',
  LNG: 'bg-petro-green',
  Other: 'bg-text-faint',
}

export default function VesselClassBreakdown() {
  const { data, isLoading } = useQuery({
    queryKey: ['liveVessels'],
    queryFn: fetchLiveVessels,
    refetchInterval: 30_000,
  })

  if (isLoading) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading...</span>
      </div>
    )
  }

  const vessels = data?.vessels ?? []
  const tankers = vessels.filter(v => (v.vessel_type ?? 0) >= 70 && (v.vessel_type ?? 0) < 90)

  const classCounts: Record<string, { total: number; loaded: number; barrels: number }> = {}
  for (const v of tankers) {
    const cls = v.vessel_class || 'Other'
    if (!classCounts[cls]) classCounts[cls] = { total: 0, loaded: 0, barrels: 0 }
    classCounts[cls].total += 1
    if (v.is_loaded && v.direction === 'outbound') {
      classCounts[cls].loaded += 1
      classCounts[cls].barrels += v.estimated_barrels ?? 0
    }
  }

  const sorted = CLASS_ORDER
    .filter(cls => classCounts[cls])
    .map(cls => ({ cls, ...classCounts[cls] }))

  // Add any classes not in CLASS_ORDER
  for (const [cls, stats] of Object.entries(classCounts)) {
    if (!CLASS_ORDER.includes(cls)) {
      sorted.push({ cls, ...stats })
    }
  }

  const maxTotal = Math.max(...sorted.map(s => s.total), 1)

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-text-faint">No tankers detected</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sorted.map((item) => (
        <div key={item.cls} className="space-y-1.5">
          <div className="flex justify-between items-end">
            <span className="text-xs font-bold text-text-warm uppercase tracking-wide">{item.cls}</span>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted font-mono">
                {item.loaded} loaded
              </span>
              <span className="text-sm font-mono font-bold text-text-warm">{item.total}</span>
            </div>
          </div>
          <div className="h-2 w-full bg-petro-border rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-1000 ${CLASS_COLORS[item.cls] || 'bg-text-faint'}`}
              style={{ width: `${(item.total / maxTotal) * 100}%` }}
            />
          </div>
          {item.barrels > 0 && (
            <p className="text-xs text-text-faint font-mono">
              {(item.barrels / 1_000_000).toFixed(2)}M bbl outbound
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
