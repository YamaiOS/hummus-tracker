import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { fetchHistorySeries } from '../api/client'
import { useFilters } from '../context/FilterContext'

function formatTs(ts: string) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function MetricHistoryChart() {
  const { rangeDays } = useFilters()

  const { data, isLoading } = useQuery({
    queryKey: ['historySeries'],
    queryFn: fetchHistorySeries,
    refetchInterval: 300_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-48 flex items-center justify-center">
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">Loading History…</span>
      </div>
    )
  }

  const rawSeries = data?.series ?? []

  const series = useMemo(() => {
    if (!rawSeries.length) return rawSeries
    const cutoff = Date.now() - rangeDays * 24 * 60 * 60 * 1000
    const filtered = rawSeries.filter(pt => {
      try { return new Date(pt.ts).getTime() >= cutoff } catch { return true }
    })
    return filtered.length > 0 ? filtered : rawSeries
  }, [rawSeries, rangeDays])

  if (series.length < 2) {
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-2">
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">History Building…</span>
        <span className="text-[11px] text-text-faint">
          {series.length === 0
            ? 'No data points yet — check back after the first hourly refresh.'
            : `${series.length} point recorded — need at least 2 to chart.`}
        </span>
      </div>
    )
  }

  const chartData = series.map(pt => ({
    ts: pt.ts,
    label: formatTs(pt.ts),
    risk_score: pt.risk_score ?? undefined,
    strait_flow_mbpd: pt.strait_flow_mbpd ?? undefined,
    brent: pt.brent ?? undefined,
  }))

  const tooltipStyle = {
    contentStyle: { backgroundColor: '#0f1d32', border: '1px solid #1c2e4a', borderRadius: '4px', fontSize: 11 },
    labelStyle: { color: '#8b9bb4', fontWeight: 'bold', marginBottom: '4px' },
    itemStyle: { padding: '0px' },
  }

  return (
    <div className="space-y-4">
      {/* Risk Score + Brent chart */}
      <div>
        <p className="text-[11px] font-bold text-text-faint uppercase tracking-wide px-1 mb-2">
          Hormuz Risk Score &amp; Brent ({data?.days ?? '?'}-day window)
        </p>
        <div className="h-44 w-full bg-petro-bg rounded-md p-2 border border-petro-border">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              {/* Left axis: risk score 0-100 */}
              <YAxis
                yAxisId="risk"
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}`}
              />
              {/* Right axis: brent price */}
              <YAxis
                yAxisId="price"
                orientation="right"
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: number, name: string) => {
                  if (name === 'risk_score') return [`${value?.toFixed(1)}`, 'RISK SCORE']
                  if (name === 'brent') return [`$${value?.toFixed(2)}`, 'BRENT']
                  return [value, name]
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', paddingBottom: '6px' }}
                formatter={(v: string) =>
                  ({ risk_score: 'RISK SCORE', brent: 'BRENT' } as Record<string, string>)[v] ?? v.toUpperCase()
                }
              />
              <Line
                yAxisId="risk"
                type="monotone"
                dataKey="risk_score"
                name="risk_score"
                stroke="#ef4444"
                strokeWidth={2}
                dot={chartData.length < 20 ? { r: 3, fill: '#ef4444' } : false}
                connectNulls
              />
              <Line
                yAxisId="price"
                type="monotone"
                dataKey="brent"
                name="brent"
                stroke="#00a19c"
                strokeWidth={1.5}
                dot={false}
                connectNulls
                strokeDasharray="4 2"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Strait Flow chart */}
      <div>
        <p className="text-[11px] font-bold text-text-faint uppercase tracking-wide px-1 mb-2">
          Strait Flow (Mb/d)
        </p>
        <div className="h-36 w-full bg-petro-bg rounded-md p-2 border border-petro-border">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}`}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(value: number) => [`${value?.toFixed(2)} Mb/d`, 'STRAIT FLOW']}
              />
              <Line
                type="monotone"
                dataKey="strait_flow_mbpd"
                name="strait_flow_mbpd"
                stroke="#c4a35a"
                strokeWidth={2}
                dot={chartData.length < 20 ? { r: 3, fill: '#c4a35a' } : false}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
