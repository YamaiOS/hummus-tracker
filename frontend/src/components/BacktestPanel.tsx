import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area, Tooltip, XAxis, YAxis,
  ReferenceArea, ReferenceLine, CartesianGrid,
} from 'recharts'
import { fetchBacktest, type BacktestEvent } from '../api/client'

const LEVEL_COLOR: Record<string, string> = {
  Low: '#2dd4bf',
  Elevated: '#c4a35a',
  High: '#ef4444',
  Severe: '#dc2626',
  Unknown: '#566b8a',
}

export default function BacktestPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['backtest'],
    queryFn: fetchBacktest,
    staleTime: 6 * 3600_000,
    refetchInterval: 6 * 3600_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-[260px] flex items-center justify-center text-xs text-text-faint uppercase font-bold tracking-wide">
        Reconstructing history…
      </div>
    )
  }

  const series = data?.series ?? []
  const events = data?.events ?? []

  if (!data || series.length === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-xs text-text-faint uppercase tracking-wide">
        Backtest unavailable
      </div>
    )
  }

  // Map event month → x-axis category for ReferenceLine placement
  const monthsSet = new Set(series.map(s => s.month))
  const placedEvents = events.filter(e => monthsSet.has(e.date))

  return (
    <div className="space-y-3">
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="proxyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c4a35a" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#c4a35a" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1c2e4a" strokeDasharray="2 4" vertical={false} />

            {/* Regime bands: 25/50/75 thresholds */}
            <ReferenceArea y1={0} y2={25} fill="#2dd4bf" fillOpacity={0.04} />
            <ReferenceArea y1={25} y2={50} fill="#c4a35a" fillOpacity={0.05} />
            <ReferenceArea y1={50} y2={75} fill="#ef4444" fillOpacity={0.05} />
            <ReferenceArea y1={75} y2={100} fill="#dc2626" fillOpacity={0.08} />
            <ReferenceLine y={25} stroke="#2dd4bf" strokeOpacity={0.3} strokeDasharray="3 3" />
            <ReferenceLine y={50} stroke="#c4a35a" strokeOpacity={0.4} strokeDasharray="3 3" />
            <ReferenceLine y={75} stroke="#dc2626" strokeOpacity={0.4} strokeDasharray="3 3" />

            <XAxis
              dataKey="month"
              tick={{ fill: '#566b8a', fontSize: 9 }}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: '#566b8a', fontSize: 9 }}
              width={28}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#0f1d32',
                border: '1px solid #1c2e4a',
                borderRadius: '4px',
                fontSize: 10,
              }}
              labelStyle={{ color: '#8b9bb4' }}
              formatter={(v: any, name: string) => [
                v == null ? '—' : Number(v).toFixed(1),
                name === 'proxy_index' ? 'Proxy index' : name,
              ]}
            />

            {/* Event markers */}
            {placedEvents.map(e => (
              <ReferenceLine
                key={e.date}
                x={e.date}
                stroke={LEVEL_COLOR[e.flagged_level] ?? '#566b8a'}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                label={{
                  value: e.name.split(' ')[0],
                  position: 'top',
                  fill: LEVEL_COLOR[e.flagged_level] ?? '#8b9bb4',
                  fontSize: 8,
                }}
              />
            ))}

            <Area
              type="monotone"
              dataKey="proxy_index"
              stroke="#c4a35a"
              strokeWidth={1.6}
              fill="url(#proxyGrad)"
              dot={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Event table */}
      <div className="border border-petro-border rounded overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-petro-bg/40 text-text-faint uppercase font-mono">
              <th className="text-left px-2 py-1 font-medium">Date</th>
              <th className="text-left px-2 py-1 font-medium">Crisis</th>
              <th className="text-right px-2 py-1 font-medium">Proxy</th>
              <th className="text-right px-2 py-1 font-medium">Flag</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e: BacktestEvent) => (
              <tr key={e.date} className="border-t border-petro-border/60">
                <td className="px-2 py-1 font-mono text-text-faint whitespace-nowrap">{e.date}</td>
                <td className="px-2 py-1 text-text-muted">{e.name}</td>
                <td className="px-2 py-1 text-right font-mono font-bold text-text-warm">
                  {e.proxy_index != null ? e.proxy_index.toFixed(0) : '—'}
                </td>
                <td className="px-2 py-1 text-right">
                  <span
                    className="font-mono font-bold uppercase text-[10px]"
                    style={{ color: LEVEL_COLOR[e.flagged_level] ?? '#566b8a' }}
                  >
                    {e.flagged_level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] font-mono text-petro-gold/80 leading-snug">
        {data.disclaimer}
      </div>
      <div className="text-[10px] font-mono text-text-faint uppercase">
        Weights: GPR {Math.round((data.weights?.gpr ?? 0) * 100)}% · OVX {Math.round((data.weights?.ovx ?? 0) * 100)}% (illustrative) · {data.source}
      </div>
    </div>
  )
}
