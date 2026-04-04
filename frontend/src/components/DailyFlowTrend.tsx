import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import api from '../api/client'

export default function DailyFlowTrend() {
  const { data, isLoading } = useQuery({
    queryKey: ['dailyFlowSummary'],
    queryFn: () => api.get('/flow/daily?days=30').then(r => r.data),
    refetchInterval: 300_000,
  })

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading...</span>
      </div>
    )
  }

  const summaries = data?.summaries || []

  if (summaries.length < 2) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-text-faint uppercase font-bold tracking-wide">Insufficient flow data</p>
        <p className="text-xs text-text-faint mt-1">Backfilling from IMF PortWatch — check back shortly</p>
      </div>
    )
  }

  const chartData = summaries.map((s: any) => ({
    date: new Date(s.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    mbpd: s.estimated_mbpd,
    tankers: s.tanker_count,
  }))

  const latest = chartData[chartData.length - 1]?.mbpd || 0
  const avg = chartData.length > 0
    ? chartData.reduce((sum: number, d: any) => sum + d.mbpd, 0) / chartData.length
    : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-text-warm">{latest.toFixed(2)}</span>
          <span className="text-xs text-text-faint font-bold uppercase tracking-wide">mbpd latest</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-mono text-text-muted">{avg.toFixed(2)}</span>
          <span className="text-xs text-text-faint uppercase">30d avg</span>
        </div>
      </div>

      <div className="h-48 w-full bg-petro-bg rounded-md p-2 border border-petro-border">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00a19c" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00a19c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#566b8a"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#566b8a"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f1d32', border: '1px solid #1c2e4a', fontSize: '11px', borderRadius: '4px' }}
              formatter={(value: number, name: string) => {
                if (name === 'mbpd') return [`${value.toFixed(2)} mbpd`, 'Flow']
                return [value, name]
              }}
            />
            <ReferenceLine y={20} stroke="#c4a35a" strokeDasharray="4 4" strokeWidth={1} label={{ value: 'EIA Baseline', position: 'right', fill: '#c4a35a', fontSize: 10 }} />
            <Area
              type="monotone"
              dataKey="mbpd"
              stroke="#00a19c"
              fillOpacity={1}
              fill="url(#colorFlow)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
