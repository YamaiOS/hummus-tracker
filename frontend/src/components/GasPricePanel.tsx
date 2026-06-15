import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { fetchGasPrices } from '../api/client'

const fmt = (v: number | null | undefined, unit = '') =>
  v == null ? '—' : `${v.toFixed(2)}${unit}`

export default function GasPricePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['gasPrices'],
    queryFn: fetchGasPrices,
    refetchInterval: 300_000,
    staleTime: 300_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-[260px] flex items-center justify-center text-xs text-text-faint uppercase font-bold tracking-wide">
        Loading Gas Prices...
      </div>
    )
  }

  if (!data || !data.series || data.series.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-xs text-text-faint uppercase tracking-wide">
        No gas price data available
      </div>
    )
  }

  const { series, latest, source } = data

  const jkmHhSpread = latest?.jkm_hh_spread

  return (
    <div className="space-y-3">
      {/* Headline row */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-petro-bg/40 rounded p-2">
          <div className="text-[10px] font-mono text-text-faint uppercase tracking-wide mb-1">Asia LNG (JKM proxy)</div>
          <div className="text-lg font-bold text-[#2dd4bf]">{fmt(latest?.jkm, ' $/MMBtu')}</div>
        </div>
        <div className="bg-petro-bg/40 rounded p-2">
          <div className="text-[10px] font-mono text-text-faint uppercase tracking-wide mb-1">EU Gas (TTF proxy)</div>
          <div className="text-lg font-bold text-[#c4a35a]">{fmt(latest?.eu_gas, ' $/MMBtu')}</div>
        </div>
        <div className="bg-petro-bg/40 rounded p-2">
          <div className="text-[10px] font-mono text-text-faint uppercase tracking-wide mb-1">US Henry Hub</div>
          <div className="text-lg font-bold text-[#94a3b8]">{fmt(latest?.henry_hub, ' $/MMBtu')}</div>
        </div>
        <div className="bg-petro-bg/40 rounded p-2">
          <div className="text-[10px] font-mono text-text-faint uppercase tracking-wide mb-1">JKM–HH Spread</div>
          <div className={`text-lg font-bold ${jkmHhSpread != null && jkmHhSpread > 0 ? 'text-[#2dd4bf]' : 'text-text-muted'}`}>
            {jkmHhSpread != null ? `${jkmHhSpread > 0 ? '+' : ''}${jkmHhSpread.toFixed(2)}` : '—'}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
              tickFormatter={(d: string) => {
                const dt = new Date(d)
                return `${dt.getMonth() + 1}/${String(dt.getFullYear()).slice(2)}`
              }}
              interval="preserveStartEnd"
              minTickGap={40}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
              tickFormatter={(v: number) => `$${v}`}
              domain={['auto', 'auto']}
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
              itemStyle={{ padding: '0px' }}
              labelFormatter={(d: string) => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = { jkm: 'JKM (Asia LNG)', eu_gas: 'EU Gas (TTF)', henry_hub: 'Henry Hub' }
                return [`$${value?.toFixed(2)} /MMBtu`, labels[name] ?? name]
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', paddingBottom: '8px' }}
              formatter={(value: string) => {
                const labels: Record<string, string> = { jkm: 'JKM', eu_gas: 'TTF', henry_hub: 'HH' }
                return labels[value] ?? value.toUpperCase()
              }}
            />
            <Line
              type="monotone"
              dataKey="jkm"
              name="jkm"
              stroke="#2dd4bf"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="eu_gas"
              name="eu_gas"
              stroke="#c4a35a"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              strokeDasharray="4 2"
            />
            <Line
              type="monotone"
              dataKey="henry_hub"
              name="henry_hub"
              stroke="#94a3b8"
              strokeWidth={1.5}
              dot={false}
              connectNulls
              strokeDasharray="2 3"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="text-[10px] font-mono text-text-faint uppercase">
        {source ?? 'FRED/IMF monthly'} · lags spot · as of {latest?.date ?? '—'}
      </div>
    </div>
  )
}
