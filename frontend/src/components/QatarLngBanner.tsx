import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, AlertOctagon } from 'lucide-react'
import { fetchChokepoints } from '../api/client'

export default function QatarLngBanner() {
  const { data } = useQuery({
    queryKey: ['chokepoints'],
    queryFn: fetchChokepoints,
    refetchInterval: 300_000,
    staleTime: 300_000,
  })

  if (!data?.chokepoints) return null

  const hormuz = data.chokepoints.find(c => c.name?.toLowerCase().includes('hormuz'))
  if (!hormuz) return null

  const pct = hormuz.pct_of_baseline
  if (pct == null || pct >= 70) return null

  const isCritical = pct < 40

  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-center gap-3 mb-2 ${
        isCritical
          ? 'bg-red-950/40 border-petro-red/50 text-petro-red'
          : 'bg-amber-950/30 border-petro-gold/50 text-petro-gold'
      }`}
    >
      {isCritical
        ? <AlertOctagon size={16} className="shrink-0" />
        : <AlertTriangle size={16} className="shrink-0" />
      }
      <p className="text-[11px] font-bold font-mono uppercase tracking-wide leading-snug">
        {isCritical
          ? `LNG SUPPLY CRITICAL — Hormuz transits at ${pct.toFixed(0)}% of baseline; ~20% of global LNG (Qatar via Hormuz) at acute risk`
          : `LNG DISRUPTION WATCH — Hormuz at ${pct.toFixed(0)}% of baseline; Qatar LNG (~20% of global supply) exposed`
        }
      </p>
    </div>
  )
}
