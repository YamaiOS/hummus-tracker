import { useQuery } from '@tanstack/react-query'
import { fetchFlowEstimate, fetchBaseline } from '../api/client'

export default function FlowMeter() {
  const { data: estimate, isLoading: loadingEst } = useQuery({
    queryKey: ['flowEstimate'],
    queryFn: fetchFlowEstimate,
    refetchInterval: 60_000,
  })

  const { data: baseline } = useQuery({
    queryKey: ['baseline'],
    queryFn: fetchBaseline,
  })

  const baselineMbpd = baseline?.eia_baseline_mbpd ?? 20.0
  const estimatedMbpd = estimate?.estimated_mbpd ?? 0
  const pctOfBaseline = baselineMbpd > 0 ? (estimatedMbpd / baselineMbpd) * 100 : 0
  const tankersObserved = estimate?.tankers_observed ?? 0
  const loadedTankers = estimate?.loaded_tankers ?? 0
  const totalBarrels = estimate?.total_estimated_barrels ?? 0

  const barColor =
    pctOfBaseline >= 90 ? 'bg-petro-green' :
    pctOfBaseline >= 70 ? 'bg-petro-gold' :
    'bg-petro-red'

  const statusLabel =
    pctOfBaseline >= 90 ? 'Normal flow' :
    pctOfBaseline >= 70 ? 'Below baseline' :
    pctOfBaseline > 0 ? 'Significant disruption' :
    'No data'

  return (
    <div className="space-y-4">
      {loadingEst ? (
        <div className="h-16 flex items-center justify-center">
          <span className="text-xs text-text-muted">Loading...</span>
        </div>
      ) : (
        <>
          <div>
            <div className="flex items-end justify-between mb-1">
              <span className="text-2xl font-bold font-mono text-text-warm">
                {estimatedMbpd > 0 ? estimatedMbpd.toFixed(1) : '\u2014'}
              </span>
              <span className="text-xs text-text-faint">/ {baselineMbpd.toFixed(1)} mbpd baseline</span>
            </div>
            <div className="h-3 bg-petro-border rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                style={{ width: `${Math.min(pctOfBaseline, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-text-faint">{pctOfBaseline.toFixed(0)}% of baseline</span>
              <span className="text-xs text-text-faint">{statusLabel}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Stat label="Tankers Observed" value={tankersObserved} />
            <Stat label="Loaded Tankers" value={loadedTankers} />
            <Stat label="Est. Total Barrels" value={formatBarrels(totalBarrels)} />
            <Stat label="Baseline (EIA)" value={`${baselineMbpd} mbpd`} />
          </div>

          {estimate?.vessel_breakdown && (
            <div className="border-t border-petro-border pt-3">
              <p className="text-xs text-text-faint uppercase font-bold tracking-wide mb-2">By Vessel Class</p>
              <div className="space-y-1.5">
                {Object.entries(estimate.vessel_breakdown as Record<string, number>).map(([cls, count]) => (
                  <div key={cls} className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">{cls}</span>
                    <span className="text-text-warm font-mono font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-petro-bg border border-petro-border rounded px-2.5 py-2">
      <p className="text-xs text-text-muted uppercase font-bold tracking-wide">{label}</p>
      <p className="text-sm font-mono font-bold text-text-warm">{value}</p>
    </div>
  )
}

function formatBarrels(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M bbl`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K bbl`
  return `${n} bbl`
}
