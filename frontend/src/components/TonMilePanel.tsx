import { useQuery } from '@tanstack/react-query'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../api/client'

export default function TonMilePanel() {
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
  const chartData = summaries.map((s: any) => ({
    date: new Date(s.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    val: s.ton_mile_index / 1_000_000,
  }))

  const latest = chartData[chartData.length - 1]?.val || 0
  const prev = chartData[chartData.length - 2]?.val || 0
  const trend = latest > prev ? 'rising' : 'falling'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-text-warm">{latest.toFixed(1)}M</span>
          <span className="text-xs text-text-faint font-bold uppercase tracking-wide">Ton-Mile Index</span>
        </div>
        <span className={`text-xs font-bold uppercase tracking-wide ${trend === 'rising' ? 'text-petro-teal' : 'text-petro-red'}`}>
          {trend}
        </span>
      </div>

      <div className="h-48 w-full bg-petro-bg rounded-md p-2 border border-petro-border">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTonMile" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00a19c" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#00a19c" stopOpacity={0}/>
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
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f1d32', border: '1px solid #1c2e4a', fontSize: '11px', borderRadius: '4px' }}
              itemStyle={{ fontSize: '11px' }}
            />
            <Area
              type="monotone"
              dataKey="val"
              name="Index"
              stroke="#00a19c"
              fillOpacity={1}
              fill="url(#colorTonMile)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
