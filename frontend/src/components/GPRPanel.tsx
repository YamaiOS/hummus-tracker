import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area, Tooltip, ReferenceLine, ReferenceArea, YAxis,
} from 'recharts'
import { fetchGPR } from '../api/client'

const REGIME_STYLES: Record<string, { label: string; color: string; badge: string }> = {
  normal:   { label: 'NORMAL',   color: '#2dd4bf', badge: 'bg-teal-900/60 text-teal-300 border-teal-700' },
  elevated: { label: 'ELEVATED', color: '#c4a35a', badge: 'bg-amber-900/60 text-amber-300 border-amber-700' },
  high:     { label: 'HIGH',     color: '#ef4444', badge: 'bg-orange-900/60 text-orange-400 border-orange-700' },
  severe:   { label: 'SEVERE',   color: '#dc2626', badge: 'bg-red-950/80 text-red-300 border-red-600' },
  unknown:  { label: 'N/A',      color: '#566b8a', badge: 'bg-petro-border/40 text-text-faint border-petro-border' },
}

export default function GPRPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['gpr'],
    queryFn: fetchGPR,
    refetchInterval: 600_000,
    staleTime: 600_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-[200px] flex items-center justify-center text-xs text-text-faint uppercase font-bold tracking-wide">
        Loading GPR…
      </div>
    )
  }

  if (!data || !data.latest) {
    return (
      <div className="h-[200px] flex items-center justify-center text-xs text-text-faint uppercase tracking-wide">
        No GPR data
      </div>
    )
  }

  const regime = data.regime ?? 'unknown'
  const style = REGIME_STYLES[regime] ?? REGIME_STYLES.unknown
  const history = (data.history ?? []).filter(h => h.gpr != null)
  const baseline = data.baseline ?? 100

  return (
    <div className="space-y-3">
      {/* GPR value + regime badge */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-3xl font-bold text-text-warm leading-none">
            {data.latest.gpr != null ? data.latest.gpr.toFixed(0) : '—'}
          </div>
          <div className="text-[10px] font-mono text-text-faint mt-1">GPR INDEX · {data.latest.month ?? '—'}</div>
        </div>
        <span className={`px-2 py-0.5 text-[11px] font-mono font-bold border rounded uppercase tracking-wider ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {/* Normalized risk 0–100 */}
      <div className="bg-petro-bg/40 rounded p-2 flex items-center justify-between">
        <div className="text-[10px] font-mono text-text-faint uppercase">Normalized risk (0–100)</div>
        <div className={`text-sm font-bold font-mono ${
          data.normalized_0_100 == null ? 'text-text-faint'
          : data.normalized_0_100 >= 75 ? 'text-[#dc2626]'
          : data.normalized_0_100 >= 50 ? 'text-[#ef4444]'
          : data.normalized_0_100 >= 25 ? 'text-[#c4a35a]'
          : 'text-[#2dd4bf]'
        }`}>
          {data.normalized_0_100 != null ? data.normalized_0_100.toFixed(0) : '—'}
        </div>
      </div>

      {/* Area sparkline with baseline */}
      {history.length > 0 && (
        <div className="h-[100px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
              <defs>
                <linearGradient id="gprGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={style.color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={style.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <YAxis domain={['auto', 'auto']} hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f1d32',
                  border: '1px solid #1c2e4a',
                  borderRadius: '4px',
                  fontSize: 10,
                }}
                labelStyle={{ color: '#8b9bb4' }}
                itemStyle={{ padding: '0px' }}
                labelFormatter={(m: string) => m}
                formatter={(v: number) => [`${v.toFixed(0)}`, 'GPR']}
              />
              {/* Faint gold shading above baseline = elevated geopolitical risk zone */}
              <ReferenceArea y1={baseline} y2={350} fill="#c4a35a" fillOpacity={0.07} ifOverflow="hidden" />
              <ReferenceLine
                y={baseline}
                stroke="#566b8a"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <Area
                type="monotone"
                dataKey="gpr"
                stroke={style.color}
                strokeWidth={1.5}
                fill="url(#gprGrad)"
                dot={false}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="text-[10px] font-mono text-text-faint uppercase">
        Caldara-Iacoviello Geopolitical Risk Index — peer-reviewed, monthly
      </div>
    </div>
  )
}
