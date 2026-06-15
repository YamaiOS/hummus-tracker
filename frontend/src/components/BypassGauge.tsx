import { useQuery } from '@tanstack/react-query'
import { fetchBypass, BypassRoute } from '../api/client'

export default function BypassGauge() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['bypass'],
    queryFn: fetchBypass,
    refetchInterval: 300_000,
  })

  if (isLoading) {
    return (
      <div className="h-48 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading bypass data…</span>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="h-48 flex items-center justify-center">
        <span className="text-xs text-text-faint">Bypass capacity data unavailable</span>
      </div>
    )
  }

  const total = data.hormuz_throughput_mbpd ?? 20.9
  const spare = data.total_spare_mbpd ?? 0
  const atRisk = data.at_risk_mbpd ?? 0
  const coveragePct = data.bypass_coverage_pct ?? 0
  const routes: BypassRoute[] = data.routes ?? []

  // Segment widths as % of total throughput
  const spareWidth = total > 0 ? Math.min((spare / total) * 100, 100) : 0
  const atRiskWidth = total > 0 ? Math.min((atRisk / total) * 100, 100 - spareWidth) : 0

  return (
    <div className="space-y-4">
      {/* Headline coverage % */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold font-mono text-teal-400 tabular-nums">
          {coveragePct.toFixed(0)}%
        </span>
        <span className="text-sm text-text-muted">
          of Hormuz flow can be bypassed via pipeline
        </span>
      </div>

      {/* Supply gap bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-text-faint font-mono mb-1">
          <span>~{total.toFixed(1)} mbpd Hormuz throughput</span>
          <span className="text-red-400">AT RISK: {atRisk.toFixed(1)} mbpd</span>
        </div>
        <div className="h-5 w-full bg-petro-border rounded overflow-hidden flex">
          {/* Can bypass (teal) */}
          <div
            className="h-full bg-teal-500 flex items-center justify-center transition-all duration-700"
            style={{ width: `${spareWidth}%` }}
            title={`Can bypass: ${spare.toFixed(1)} mbpd`}
          >
            {spareWidth > 12 && (
              <span className="text-[9px] font-mono font-bold text-black/70 whitespace-nowrap px-1">
                {spare.toFixed(1)} mbpd
              </span>
            )}
          </div>
          {/* At risk (red) */}
          <div
            className="h-full bg-red-600 flex items-center justify-center transition-all duration-700"
            style={{ width: `${atRiskWidth}%` }}
            title={`At risk: ${atRisk.toFixed(1)} mbpd`}
          >
            {atRiskWidth > 12 && (
              <span className="text-[9px] font-mono font-bold text-white/80 whitespace-nowrap px-1">
                {atRisk.toFixed(1)} mbpd
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-4 text-[10px] font-mono pt-0.5">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-teal-500" />
            <span className="text-text-faint">CAN BYPASS ({spare.toFixed(1)} mbpd)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm bg-red-600" />
            <span className="text-text-faint">AT RISK ({atRisk.toFixed(1)} mbpd)</span>
          </span>
        </div>
      </div>

      {/* Per-route breakdown */}
      {routes.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-mono uppercase text-text-faint tracking-wide">Pipeline Routes</p>
          {routes.map((route, i) => {
            const routeCapPct = data.total_bypass_capacity_mbpd > 0
              ? (route.capacity_mbpd / data.total_bypass_capacity_mbpd) * 100
              : 0
            const sparePct = route.capacity_mbpd > 0
              ? (route.spare_mbpd / route.capacity_mbpd) * 100
              : 0
            return (
              <div key={i} className="space-y-1">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-xs font-semibold text-text-warm">{route.name}</span>
                    <span className="text-[10px] text-text-faint ml-2">{route.operator}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono text-teal-400">
                      +{route.spare_mbpd.toFixed(1)} mbpd spare
                    </span>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-petro-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-600/60 rounded-full"
                    style={{ width: `${routeCapPct}%` }}
                  >
                    <div
                      className="h-full bg-teal-400 rounded-full"
                      style={{ width: `${sparePct}%` }}
                    />
                  </div>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-text-faint">
                  <span>Cap: {route.capacity_mbpd.toFixed(1)} mbpd</span>
                  <span>In use: {route.in_use_mbpd.toFixed(1)} mbpd</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Note */}
      {data.note && (
        <p className="text-[11px] text-text-muted italic border-l-2 border-petro-gold/40 pl-2">
          {data.note}
        </p>
      )}

      <p className="text-[10px] text-text-faint font-mono uppercase">
        Source: {data.source} · {data.updated_at ? new Date(data.updated_at).toLocaleString() : '—'}
      </p>
    </div>
  )
}
