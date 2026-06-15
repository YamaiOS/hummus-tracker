import { useQuery } from '@tanstack/react-query'
import { fetchProduction } from '../api/client'

const GULF_COUNTRIES = ['Saudi Arabia', 'Iran', 'Iraq', 'UAE', 'Kuwait', 'Qatar']

export default function ProductionPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['production'],
    queryFn: fetchProduction,
    refetchInterval: 600_000,
  })

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <span className="text-xs text-text-muted font-mono uppercase tracking-wide animate-pulse">
          Loading…
        </span>
      </div>
    )
  }

  const producers = data?.producers ?? []

  // Filter to Gulf/OPEC countries of interest, preserving order
  const filtered = producers.length > 0
    ? producers
    : GULF_COUNTRIES.map(c => ({ country: c, code: c.slice(0, 3).toUpperCase(), mbpd: 0, period: '—' }))

  const maxMbpd = Math.max(...filtered.map(p => p.mbpd), 1)

  return (
    <div className="space-y-3">
      {filtered.length === 0 ? (
        <p className="text-sm text-text-faint text-center py-8">No production data available</p>
      ) : (
        <>
          {filtered.map((p, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-text-warm">{p.country}</span>
                <span className="text-xs font-mono text-text-muted">
                  {p.mbpd > 0 ? `${p.mbpd.toFixed(2)} mbpd` : '—'}
                </span>
              </div>
              <div className="h-1.5 w-full bg-petro-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-petro-teal/70 rounded-full transition-all duration-1000"
                  style={{ width: `${p.mbpd > 0 ? (p.mbpd / maxMbpd) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}

          {data?.opec_total_mbpd != null && (
            <div className="mt-4 pt-3 border-t border-petro-border space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-xs font-bold text-petro-gold uppercase tracking-wide">
                  OPEC Total
                </span>
                <span className="text-xs font-mono font-bold text-petro-gold">
                  {data.opec_total_mbpd.toFixed(2)} mbpd
                </span>
              </div>
              <div className="h-2 w-full bg-petro-border rounded-full overflow-hidden">
                <div className="h-full bg-petro-gold rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          )}
        </>
      )}

      <p className="text-[11px] text-text-faint font-mono pt-1">
        EIA International — monthly, total petroleum &amp; other liquids
      </p>
    </div>
  )
}
