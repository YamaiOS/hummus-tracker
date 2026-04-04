import { useQuery } from '@tanstack/react-query'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fetchBunkerHistory, fetchBunkerPrices } from '../api/client'

export default function BunkerPricesPanel() {
  const { data: latest, isLoading: loadingLatest } = useQuery({
    queryKey: ['latestBunkerPrices'],
    queryFn: fetchBunkerPrices,
    refetchInterval: 3600_000,
  })

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['bunkerHistory'],
    queryFn: () => fetchBunkerHistory(30),
    refetchInterval: 3600_000,
  })

  if (loadingLatest || loadingHistory) {
    return (
      <div className="h-64 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading...</span>
      </div>
    )
  }

  const chartData = (historyData?.history || []).map((item) => ({
    date: new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    VLSFO: item.vlsfo_price,
    HSFO: item.hsfo_price,
  }))

  return (
    <div className="space-y-4">
      {latest && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-2 bg-petro-bg border border-petro-border rounded text-center">
            <p className="text-xs text-text-muted uppercase font-bold mb-1">VLSFO (0.5%S)</p>
            <p className="text-sm font-mono font-bold text-text-warm">${latest.vlsfo_price.toFixed(2)}</p>
          </div>
          <div className="p-2 bg-petro-bg border border-petro-border rounded text-center">
            <p className="text-xs text-text-muted uppercase font-bold mb-1">HSFO (380cSt)</p>
            <p className="text-sm font-mono font-bold text-text-warm">${latest.hsfo_price.toFixed(2)}</p>
          </div>
          <div className="p-2 bg-petro-bg border border-petro-border rounded text-center">
            <p className="text-xs text-text-muted uppercase font-bold mb-1">Hi-5 Spread</p>
            <p className="text-sm font-mono font-bold text-petro-gold">${latest.spread.toFixed(2)}</p>
          </div>
        </div>
      )}

      <div className="h-48 w-full bg-petro-bg rounded-md p-2 border border-petro-border">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f1d32', border: '1px solid #1c2e4a', fontSize: '11px', borderRadius: '4px' }}
              itemStyle={{ fontSize: '11px' }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, undefined]}
            />
            <Legend iconType="circle" verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />
            <Line
              type="monotone"
              dataKey="VLSFO"
              stroke="#00a19c"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="HSFO"
              stroke="#c4a35a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
