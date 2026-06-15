import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, LineChart, Line, Tooltip,
} from 'recharts'
import { fetchVolatility } from '../api/client'

const REGIME_STYLES: Record<string, { label: string; color: string; badge: string }> = {
  low:      { label: 'LOW',      color: '#2dd4bf', badge: 'bg-teal-900/60 text-teal-300 border-teal-700' },
  elevated: { label: 'ELEVATED', color: '#c4a35a', badge: 'bg-amber-900/60 text-amber-300 border-amber-700' },
  high:     { label: 'HIGH',     color: '#ef4444', badge: 'bg-red-900/60 text-red-400 border-red-700' },
  unknown:  { label: 'N/A',      color: '#566b8a', badge: 'bg-petro-border/40 text-text-faint border-petro-border' },
}

export default function VolatilityWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['volatility'],
    queryFn: fetchVolatility,
    refetchInterval: 300_000,
    staleTime: 300_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-[200px] flex items-center justify-center text-xs text-text-faint uppercase font-bold tracking-wide">
        Loading OVX...
      </div>
    )
  }

  if (!data) {
    return (
      <div className="h-[200px] flex items-center justify-center text-xs text-text-faint uppercase tracking-wide">
        No volatility data
      </div>
    )
  }

  const regime = data.regime ?? 'unknown'
  const style = REGIME_STYLES[regime] ?? REGIME_STYLES.unknown
  const history = (data.history ?? []).filter(h => h.ovx != null)

  return (
    <div className="space-y-3">
      {/* OVX value + regime badge */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-3xl font-bold text-text-warm leading-none">
            {data.ovx != null ? data.ovx.toFixed(1) : '—'}
          </div>
          <div className="text-[10px] font-mono text-text-faint mt-1">OVX INDEX</div>
        </div>
        <span className={`px-2 py-0.5 text-[11px] font-mono font-bold border rounded uppercase tracking-wider ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {/* Z-score vs 1y mean */}
      <div className="bg-petro-bg/40 rounded p-2 flex items-center justify-between">
        <div className="text-[10px] font-mono text-text-faint uppercase">Z-score vs 1y mean</div>
        <div className={`text-sm font-bold font-mono ${
          data.zscore == null ? 'text-text-faint'
          : Math.abs(data.zscore) > 2 ? 'text-[#ef4444]'
          : Math.abs(data.zscore) > 1 ? 'text-[#c4a35a]'
          : 'text-[#2dd4bf]'
        }`}>
          {data.zscore != null ? `${data.zscore > 0 ? '+' : ''}${data.zscore.toFixed(2)}σ` : '—'}
        </div>
      </div>

      {/* Sparkline */}
      {history.length > 0 && (
        <div className="h-[90px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f1d32',
                  border: '1px solid #1c2e4a',
                  borderRadius: '4px',
                  fontSize: 10,
                }}
                labelStyle={{ color: '#8b9bb4' }}
                itemStyle={{ padding: '0px' }}
                labelFormatter={(d: string) => new Date(d).toLocaleDateString()}
                formatter={(v: number) => [`${v.toFixed(1)}`, 'OVX']}
              />
              <Line
                type="monotone"
                dataKey="ovx"
                stroke={style.color}
                strokeWidth={1.5}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="text-[10px] font-mono text-text-faint uppercase">
        CBOE Crude Oil Volatility (OVX) · FRED · {data.ovx_date ?? '—'}
      </div>
    </div>
  )
}
