import { useQuery } from '@tanstack/react-query'
import { Clock } from 'lucide-react'
import { fetchHealth } from '../api/client'

function formatRelativeTime(iso: string): { label: string; isStale: boolean } {
  const generatedAt = new Date(iso)
  const ageMs = Date.now() - generatedAt.getTime()
  const ageMin = Math.floor(ageMs / 60_000)
  const isStale = ageMs > 90 * 60_000

  let label: string
  if (ageMin < 1) {
    label = 'just now'
  } else if (ageMin < 60) {
    label = `${ageMin}m ago`
  } else {
    const ageHr = Math.floor(ageMin / 60)
    label = `${ageHr}h ago`
  }

  return { label, isStale }
}

export default function DataFreshnessBadge() {
  const { data } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 60_000,
  })

  const generatedAt = data?.snapshot?.generated_at

  if (!generatedAt) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 text-petro-gold">
        <Clock size={12} />
        <span className="text-[11px] font-bold uppercase tracking-wide">STALE</span>
      </div>
    )
  }

  const { label, isStale } = formatRelativeTime(generatedAt)

  return (
    <div className={`hidden sm:flex items-center gap-1.5 ${isStale ? 'text-petro-gold' : 'text-text-muted'}`}>
      <Clock size={12} className="shrink-0" />
      <span className="text-[11px] font-bold uppercase tracking-wide">
        {isStale ? `STALE · ${label}` : `Updated ${label} · refreshes hourly`}
      </span>
    </div>
  )
}
