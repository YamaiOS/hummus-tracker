import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from 'recharts'
import { fetchIMFTransits } from '../api/client'

export default function TransitChart() {
  const { data, isLoading } = useQuery({
    queryKey: ['imfTransits'],
    queryFn: () => fetchIMFTransits(90),
    staleTime: 5 * 60_000,
  })

  if (isLoading && !data) {
    return <div className="h-[300px] flex items-center justify-center text-xs text-text-faint uppercase font-bold tracking-wide">Loading Analytics...</div>
  }

  const transits = data?.transits ?? []

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={transits} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="tankerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00a19c" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#00a19c" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b9bb4" stopOpacity={0.1} />
              <stop offset="95%" stopColor="#8b9bb4" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }} 
            axisLine={false} 
            tickLine={false} 
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0f1d32',
              border: '1px solid #1c2e4a',
              borderRadius: '4px',
              fontSize: 11,
            }}
            labelStyle={{ color: '#8b9bb4', fontWeight: 'bold', marginBottom: '4px' }}
            labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                total_transits: 'TOTAL',
                tanker_transits: 'TANKERS',
              }
              return [value, labels[name] || name.toUpperCase()]
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', paddingBottom: '10px' }}
            formatter={(value: string) => {
              const labels: Record<string, string> = { total_transits: 'TOTAL', tanker_transits: 'TANKERS' }
              return labels[value] || value.toUpperCase()
            }}
          />
          <Area
            type="monotone"
            dataKey="total_transits"
            name="total_transits"
            stroke="#8b9bb4"
            strokeWidth={1}
            fill="url(#totalGrad)"
            dot={false}
          />
          <Area
            type="monotone"
            dataKey="tanker_transits"
            name="tanker_transits"
            stroke="#00a19c"
            strokeWidth={2}
            fill="url(#tankerGrad)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
