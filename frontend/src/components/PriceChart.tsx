import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { fetchOilPrices, fetchIMFTransits } from '../api/client'

export default function PriceChart() {
  const { data: priceData, isLoading: loadingPrices } = useQuery({
    queryKey: ['oilPrices'],
    queryFn: () => fetchOilPrices(180),
    staleTime: 5 * 60_000,
  })

  const { data: transitData } = useQuery({
    queryKey: ['imfTransits'],
    queryFn: () => fetchIMFTransits(180),
    staleTime: 5 * 60_000,
  })

  if (loadingPrices) {
    return <div className="h-[300px] flex items-center justify-center text-sm text-slate-500 animate-pulse">Loading price data...</div>
  }

  const prices = priceData?.prices ?? []
  const transits = transitData?.transits ?? []

  // Merge by date
  const transitMap = new Map(transits.map(t => [t.date, t.tanker_transits]))

  const chartData = prices.map(p => ({
    date: p.date,
    brent: p.brent,
    wti: p.wti,
    transits: transitMap.get(p.date) ?? undefined,
  }))

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickFormatter={(d: string) => {
              const dt = new Date(d)
              return `${dt.getMonth() + 1}/${dt.getDate()}`
            }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            yAxisId="price"
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickFormatter={(v: number) => `$${v}`}
            domain={['dataMin - 5', 'dataMax + 5']}
          />
          <YAxis
            yAxisId="transits"
            orientation="right"
            tick={{ fontSize: 10, fill: '#64748b' }}
            domain={[0, 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '8px',
              fontSize: 11,
            }}
            labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
            formatter={(value: number, name: string) => {
              if (name === 'transits') return [value, 'Tanker Transits']
              return [`$${value?.toFixed(2)}`, name === 'brent' ? 'Brent' : 'WTI']
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value: string) => {
              const labels: Record<string, string> = { brent: 'Brent Crude', wti: 'WTI', transits: 'Tanker Transits' }
              return labels[value] || value
            }}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="brent"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="wti"
            stroke="#10b981"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            strokeDasharray="4 2"
          />
          <Bar
            yAxisId="transits"
            dataKey="transits"
            fill="#3b82f6"
            opacity={0.3}
            barSize={3}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
