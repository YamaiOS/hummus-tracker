import { useQuery } from '@tanstack/react-query'
import { fetchLiveVessels } from '../api/client'

const REGION_MAP: Record<string, string> = {
  'CHINA': 'China',
  'NINGBO': 'China',
  'SHANGHAI': 'China',
  'QINGDAO': 'China',
  'DALIAN': 'China',
  'TIANJIN': 'China',
  'ZHOUSHAN': 'China',
  'INDIA': 'India',
  'JAMNAGAR': 'India',
  'MUMBAI': 'India',
  'PARADIP': 'India',
  'SIKKA': 'India',
  'MANGALORE': 'India',
  'JAPAN': 'Japan',
  'CHIBA': 'Japan',
  'YOKOHAMA': 'Japan',
  'KIIRE': 'Japan',
  'KOREA': 'South Korea',
  'ULSAN': 'South Korea',
  'YEOSU': 'South Korea',
  'DAESAN': 'South Korea',
  'SINGAPORE': 'Singapore',
  'JURONG': 'Singapore',
  'ROTTERDAM': 'Europe',
  'TRIESTE': 'Europe',
  'AUGUSTA': 'Europe',
  'SIDI KERIR': 'Europe',
  'SUEZ': 'Europe',
  'FUJAIRAH': 'Fujairah (Bunker)',
  'HOUSTON': 'Americas',
  'LONG BEACH': 'Americas',
}

function inferRegion(destination: string): string {
  if (!destination) return 'Unknown'
  const upper = destination.toUpperCase()
  for (const [key, region] of Object.entries(REGION_MAP)) {
    if (upper.includes(key)) return region
  }
  return 'Other'
}

export default function TopDestinations() {
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
  const outbound = vessels.filter(v => v.is_loaded && v.direction === 'outbound' && v.destination)

  const regionMap: Record<string, { vessels: number; barrels: number }> = {}
  for (const v of outbound) {
    const region = inferRegion(v.destination || '')
    if (!regionMap[region]) regionMap[region] = { vessels: 0, barrels: 0 }
    regionMap[region].vessels += 1
    regionMap[region].barrels += v.estimated_barrels ?? 0
  }

  const sorted = Object.entries(regionMap)
    .map(([region, stats]) => ({ region, ...stats }))
    .sort((a, b) => b.barrels - a.barrels)

  const maxBarrels = Math.max(...sorted.map(s => s.barrels), 1)

  if (sorted.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-text-faint">No outbound destinations detected</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sorted.map((item) => (
        <div key={item.region} className="space-y-1">
          <div className="flex justify-between items-end">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-text-warm">{item.region}</span>
              <span className="text-xs text-text-faint">{item.vessels} tankers</span>
            </div>
            <span className="text-xs font-mono text-text-muted">
              {(item.barrels / 1_000_000).toFixed(2)}M bbl
            </span>
          </div>
          <div className="h-1.5 w-full bg-petro-border rounded-full overflow-hidden">
            <div
              className="h-full bg-petro-teal rounded-full transition-all duration-1000"
              style={{ width: `${(item.barrels / maxBarrels) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
