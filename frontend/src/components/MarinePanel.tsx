import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis } from 'recharts'
import { fetchMarine } from '../api/client'

function fmt(v: number | null | undefined, decimals = 1): string {
  if (v == null) return '—'
  return v.toFixed(decimals)
}

function waveColor(h: number | null): string {
  if (h == null) return 'text-text-muted'
  if (h >= 2.5) return 'text-petro-red'
  if (h >= 1.5) return 'text-petro-gold'
  return 'text-petro-teal'
}

export default function MarinePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['marine'],
    queryFn: fetchMarine,
    refetchInterval: 600_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading marine data…</span>
      </div>
    )
  }

  const cur = data?.current
  const hourly = data?.hourly ?? []
  const max24h = data?.max_wave_24h ?? null

  // Prepare sparkline data — show next ~48 points (hourly)
  const chartData = hourly.slice(0, 48).map(h => ({
    t: new Date(h.time).getHours() + ':00',
    wh: h.wave_height ?? 0,
  }))

  return (
    <div className="space-y-3">
      {/* Current stat cells */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-petro-bg/40 rounded p-2 text-center">
          <p className="text-[10px] uppercase text-text-faint font-bold tracking-wide mb-1">Wave Ht</p>
          <p className={`text-lg font-bold font-mono ${waveColor(cur?.wave_height ?? null)}`}>
            {fmt(cur?.wave_height)}
          </p>
          <p className="text-[10px] text-text-faint font-mono">m</p>
        </div>
        <div className="bg-petro-bg/40 rounded p-2 text-center">
          <p className="text-[10px] uppercase text-text-faint font-bold tracking-wide mb-1">Swell</p>
          <p className={`text-lg font-bold font-mono ${waveColor(cur?.swell_wave_height ?? null)}`}>
            {fmt(cur?.swell_wave_height)}
          </p>
          <p className="text-[10px] text-text-faint font-mono">m</p>
        </div>
        <div className="bg-petro-bg/40 rounded p-2 text-center">
          <p className="text-[10px] uppercase text-text-faint font-bold tracking-wide mb-1">24h Max</p>
          <p className={`text-lg font-bold font-mono ${waveColor(max24h)}`}>
            {fmt(max24h)}
          </p>
          <p className="text-[10px] text-text-faint font-mono">m</p>
        </div>
      </div>

      {/* Wind wave sub-stat */}
      {cur?.wind_wave_height != null && (
        <div className="flex items-center gap-2 text-xs font-mono text-text-faint">
          <span className="uppercase">Wind Wave:</span>
          <span className={`font-bold ${waveColor(cur.wind_wave_height)}`}>{fmt(cur.wind_wave_height)} m</span>
        </div>
      )}

      {/* Sparkline */}
      {chartData.length > 0 && (
        <div className="pt-1">
          <p className="text-[10px] uppercase text-text-faint font-bold tracking-wide mb-1">Wave Height Forecast (48h)</p>
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="t" hide />
              <Tooltip
                contentStyle={{ background: '#0d1a2e', border: '1px solid #1e3a5f', fontSize: 10 }}
                labelStyle={{ color: '#8ca3be' }}
                itemStyle={{ color: '#e2c97e' }}
                formatter={(v: number) => [`${v.toFixed(2)} m`, 'Wave Ht']}
              />
              <Area
                type="monotone"
                dataKey="wh"
                stroke="#0ea5e9"
                strokeWidth={1.5}
                fill="url(#waveGrad)"
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {chartData.length === 0 && !isLoading && (
        <div className="py-4 text-center">
          <p className="text-xs text-text-faint uppercase font-bold tracking-wide">No marine forecast data</p>
        </div>
      )}

      <p className="text-[10px] font-mono text-text-faint uppercase pt-1">
        Open-Meteo Marine (~8km model; indicative) · Hormuz narrows ~26.5°N 56.5°E
      </p>
    </div>
  )
}
