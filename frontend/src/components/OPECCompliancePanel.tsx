import { useQuery } from '@tanstack/react-query'
import { fetchOPECCompliance, fetchOverview } from '../api/client'

export default function OPECCompliancePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['opecCompliance'],
    queryFn: fetchOPECCompliance,
    refetchInterval: 3600_000,
  })

  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: 60_000,
  })

  const isMock = overview?.ais_stream?.mode === 'mock'
  const hasInsufficientData = !isMock && (overview?.strait_status?.tankers_active ?? 0) < 5

  if (isLoading && !data) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Analyzing...</span>
      </div>
    )
  }

  const compliance = data?.compliance || []

  return (
    <div className="space-y-0">
      {isMock && (
        <div className="px-2 py-1.5 mb-2 bg-petro-gold/10 border border-petro-gold/20 rounded">
          <p className="text-xs text-petro-gold font-bold uppercase tracking-wide">Simulated — observed values derived from mock AIS</p>
        </div>
      )}
      {hasInsufficientData && (
        <div className="px-2 py-1.5 mb-2 bg-petro-gold/10 border border-petro-gold/20 rounded">
          <p className="text-xs text-petro-gold font-bold uppercase tracking-wide">Insufficient AIS coverage — observed values unreliable</p>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-petro-bg text-text-muted uppercase tracking-wide text-xs border-b border-petro-border">
              <th className="py-3 px-1 font-bold">Country</th>
              <th className="py-3 px-1 font-bold text-right">Quota</th>
              <th className="py-3 px-1 font-bold text-right">Observed</th>
              <th className="py-3 px-1 font-bold text-right">Delta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-petro-border font-mono text-sm">
            {compliance.map((c) => {
              const over = c.delta > 0.1 && !c.is_exempt
              const under = c.delta < -0.1 && !c.is_exempt
              const suppress = (isMock || hasInsufficientData) && !c.is_exempt
              return (
                <tr key={c.country} className="hover:bg-petro-card-hover transition-colors">
                  <td className="py-3 px-1 font-sans font-bold text-text-warm uppercase text-xs">
                    {c.country}
                  </td>
                  <td className="py-3 px-1 text-right text-text-muted">
                    {c.is_exempt ? 'EXEMPT' : c.quota_mbpd.toFixed(2)}
                  </td>
                  <td className="py-3 px-1 text-right text-text-warm font-bold">
                    {suppress ? <span className="text-text-faint">N/A</span> : c.observed_mbpd.toFixed(2)}
                  </td>
                  <td className={`py-3 px-1 text-right font-bold ${
                    suppress || c.is_exempt ? 'text-text-faint' :
                    over ? 'text-petro-red' :
                    under ? 'text-petro-green' : 'text-text-faint'
                  }`}>
                    {suppress || c.is_exempt ? '—' : `${c.delta > 0 ? '+' : ''}${c.delta.toFixed(2)}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
