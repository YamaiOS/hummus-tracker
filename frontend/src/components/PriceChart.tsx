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

  if (loadingPrices && !priceData) {
    return <div className="h-[300px] flex items-center justify-center text-xs text-text-faint uppercase font-bold tracking-wide">Loading Market Data...</div>
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
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
            tickFormatter={(d: string) => {
              const dt = new Date(d)
              return `${dt.getMonth() + 1}/${dt.getDate()}`
            }}
            interval="preserveStartEnd"
            minTickGap={40}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="price"
            tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
            tickFormatter={(v: number) => `$${v}`}
            domain={['auto', 'auto']}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="transits"
            orientation="right"
            tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
            domain={[0, 'auto']}
            axisLine={false}
            tickLine={false}
            hide
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f1d32',
              border: '1px solid #1c2e4a',
              borderRadius: '4px',
              fontSize: 11,
            }}
            labelStyle={{ color: '#8b9bb4', fontWeight: 'bold', marginBottom: '4px' }}
            itemStyle={{ padding: '0px' }}
            labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
            formatter={(value: number, name: string) => {
              if (name === 'transits') return [value, 'TRANSITS']
              return [`$${value?.toFixed(2)}`, name.toUpperCase()]
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', paddingBottom: '10px' }}
            formatter={(value: string) => {
              const labels: Record<string, string> = { brent: 'BRENT', wti: 'WTI', transits: 'TRANSITS' }
              return labels[value] || value.toUpperCase()
            }}
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="brent"
            name="brent"
            stroke="#00a19c"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="wti"
            name="wti"
            stroke="#c4a35a"
            strokeWidth={1.5}
            dot={false}
            connectNulls
            strokeDasharray="4 2"
          />
          <Bar
            yAxisId="transits"
            dataKey="transits"
            name="transits"
            fill="#566b8a"
            opacity={0.2}
            barSize={2}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
