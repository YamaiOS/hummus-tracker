import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { fetchIntegrity } from '../api/client'

export default function IntegrityBanner() {
  const { data } = useQuery({
    queryKey: ['integrity'],
    queryFn: fetchIntegrity,
    refetchInterval: 600_000,
  })

  if (!data?.gps_disruption_active) return null

  const count = data.mention_count ?? 0

  return (
    <div className="rounded-lg border border-petro-gold/50 bg-amber-950/30 px-4 py-3 flex items-center gap-3 mb-2">
      <AlertTriangle size={15} className="shrink-0 text-petro-gold" />
      <p className="text-[11px] font-bold font-mono uppercase tracking-wide leading-snug text-petro-gold">
        DATA RELIABILITY — Active GPS/GNSS interference reported
        {count > 0 ? ` (${count} recent report${count !== 1 ? 's' : ''})` : ''}
        ; AIS positions &amp; transit counts may be understated.
      </p>
    </div>
  )
}
