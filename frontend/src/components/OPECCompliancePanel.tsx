import { useQuery } from '@tanstack/react-query'
import { fetchOPECCompliance } from '../api/client'

export default function OPECCompliancePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['opecCompliance'],
    queryFn: fetchOPECCompliance,
    refetchInterval: 3600_000,
  })

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
              return (
                <tr key={c.country} className="hover:bg-petro-card-hover transition-colors">
                  <td className="py-3 px-1 font-sans font-bold text-text-warm uppercase text-xs">
                    {c.country}
                  </td>
                  <td className="py-3 px-1 text-right text-text-muted">
                    {c.is_exempt ? 'EXEMPT' : c.quota_mbpd.toFixed(2)}
                  </td>
                  <td className="py-3 px-1 text-right text-text-warm font-bold">
                    {c.observed_mbpd.toFixed(2)}
                  </td>
                  <td className={`py-3 px-1 text-right font-bold ${
                    c.is_exempt ? 'text-text-faint' : 
                    over ? 'text-petro-red' : 
                    under ? 'text-petro-green' : 'text-text-faint'
                  }`}>
                    {c.is_exempt ? '—' : `${c.delta > 0 ? '+' : ''}${c.delta.toFixed(2)}`}
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
