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
    pctOfBaseline >= 90 ? 'bg-emerald-500' :
    pctOfBaseline >= 70 ? 'bg-amber-500' :
    'bg-red-500'

  const statusLabel =
    pctOfBaseline >= 90 ? 'Normal flow' :
    pctOfBaseline >= 70 ? 'Below baseline' :
    pctOfBaseline > 0 ? 'Significant disruption' :
    'No data'

  return (
    <div className="space-y-4">
      {loadingEst ? (
        <div className="space-y-3">
          <div className="h-6 bg-slate-800/50 rounded animate-pulse" />
          <div className="h-4 bg-slate-800/50 rounded animate-pulse w-2/3" />
        </div>
      ) : (
        <>
          {/* Main gauge */}
          <div>
            <div className="flex items-end justify-between mb-1">
              <span className="text-2xl font-bold text-slate-100">
                {estimatedMbpd > 0 ? estimatedMbpd.toFixed(1) : '—'}
              </span>
              <span className="text-xs text-slate-500">/ {baselineMbpd.toFixed(1)} mbpd baseline</span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
                style={{ width: `${Math.min(pctOfBaseline, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-500">{pctOfBaseline.toFixed(0)}% of baseline</span>
              <span className="text-[10px] text-slate-500">{statusLabel}</span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Tankers Observed" value={tankersObserved} />
            <Stat label="Loaded Tankers" value={loadedTankers} />
            <Stat label="Est. Total Barrels" value={formatBarrels(totalBarrels)} />
            <Stat label="Baseline (EIA)" value={`${baselineMbpd} mbpd`} />
          </div>

          {estimate?.vessel_breakdown && (
            <div className="border-t border-slate-800 pt-3">
              <p className="text-[10px] text-slate-500 uppercase mb-2">By Vessel Class</p>
              <div className="space-y-1.5">
                {Object.entries(estimate.vessel_breakdown as Record<string, number>).map(([cls, count]) => (
                  <div key={cls} className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{cls}</span>
                    <span className="text-slate-200 font-medium">{count}</span>
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
    <div className="bg-slate-800/30 rounded-lg px-2.5 py-2">
      <p className="text-[10px] text-slate-500 uppercase">{label}</p>
      <p className="text-sm font-semibold text-slate-200">{value}</p>
    </div>
  )
}

function formatBarrels(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M bbl`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K bbl`
  return `${n} bbl`
}
