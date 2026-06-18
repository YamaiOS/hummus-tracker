import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { fetchLeadlag, type LeadLagEntry } from '../api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtR(r: number | null | undefined): string {
  return r == null ? '—' : r.toFixed(3)
}

function fmtLag(k: number): string {
  if (k === 0) return '0'
  return k > 0 ? `+${k}` : `${k}`
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: '#0f1d32',
    border: '1px solid #1c2e4a',
    borderRadius: '4px',
    fontSize: 11,
  },
  labelStyle: { color: '#8b9bb4', fontWeight: 'bold' as const, marginBottom: '4px' },
  itemStyle: { padding: '0px', color: '#cdd9ec' },
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HistoricalLeadLag() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leadlag'],
    queryFn: fetchLeadlag,
    staleTime: 6 * 3600_000,
    refetchInterval: 6 * 3600_000,
  })

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <div className="h-48 flex items-center justify-center">
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">
          Computing lead-lag…
        </span>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="h-48 flex items-center justify-center gap-2">
        <AlertTriangle size={14} className="text-petro-gold" />
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">
          Lead-Lag Data Unavailable
        </span>
      </div>
    )
  }

  // ── Insufficient data ────────────────────────────────────────────────────────
  if (data.insufficient || data.lags.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <AlertTriangle size={16} className="text-petro-gold" />
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">
          Insufficient Historical Data
        </span>
        <span className="text-[11px] text-text-faint leading-relaxed max-w-sm">
          {data.interpretation || `Only ${data.n} overlapping months found (need ≥24). Check FRED_API_KEY.`}
        </span>
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const { lags, peak, contemporaneous_level_r, n, span, ci95, interpretation, disclaimer } = data

  const chartData = lags.map((entry: LeadLagEntry) => ({
    lag: entry.lag_months,
    r: entry.r ?? 0,
    rRaw: entry.r,
    significant: entry.significant,
    isPeak: peak != null && entry.lag_months === peak.lag_months,
  }))

  const peakR = peak?.r ?? null
  const peakK = peak?.lag_months ?? null
  const peakSig = peak?.significant ?? false

  // Headline text
  const headlineLag =
    peakK === null ? '—' : peakK === 0 ? 'contemporaneous' : `${fmtLag(peakK)} mo`
  const headlineSig = peakSig ? 'significant ✓' : 'not significant'

  return (
    <div className="space-y-4">
      {/* Disclaimer banner */}
      <div className="flex items-start gap-2 rounded-md border border-petro-gold/40 bg-petro-gold/10 px-3 py-2">
        <span className="flex-shrink-0 mt-0.5 text-[9px] font-bold rounded px-1.5 py-0.5 bg-petro-gold/20 text-petro-gold border border-petro-gold/40 uppercase tracking-wider">
          Methodological
        </span>
        <p className="text-[11px] text-text-muted leading-relaxed">
          {disclaimer}
        </p>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md border border-petro-border bg-petro-bg p-3">
          <p className="text-[10px] font-bold text-text-faint uppercase tracking-wide mb-1">
            Peak Lag
          </p>
          <p className="font-mono text-xl font-bold text-text-warm leading-none">
            {headlineLag}
          </p>
          <p className="text-[10px] font-mono mt-1" style={{ color: peakSig ? '#c4a35a' : '#566b8a' }}>
            {headlineSig}
          </p>
        </div>
        <div className="rounded-md border border-petro-border bg-petro-bg p-3">
          <p className="text-[10px] font-bold text-text-faint uppercase tracking-wide mb-1">
            Peak r
          </p>
          <p className="font-mono text-xl font-bold text-text-warm leading-none">
            {fmtR(peakR)}
          </p>
          <p className="text-[10px] text-text-faint font-mono mt-1">
            n={peak?.lag_months != null ? lags.find(l => l.lag_months === peak!.lag_months)?.n ?? n : n}
            {ci95 != null ? ` · CI ±${ci95.toFixed(3)}` : ''}
          </p>
        </div>
        <div className="rounded-md border border-petro-border bg-petro-bg p-3">
          <p className="text-[10px] font-bold text-text-faint uppercase tracking-wide mb-1">
            Level r (contemp)
          </p>
          <p className="font-mono text-xl font-bold text-text-warm leading-none">
            {fmtR(contemporaneous_level_r)}
          </p>
          <p className="text-[10px] text-text-faint font-mono mt-1">
            proxy vs Brent level
          </p>
        </div>
      </div>

      {/* Cross-correlation bar chart */}
      <div>
        <p className="text-[11px] font-bold text-text-faint uppercase tracking-wide px-1 mb-2">
          Cross-Correlation by Lag (months)
        </p>
        <div className="h-44 w-full bg-petro-bg rounded-md p-2 border border-petro-border">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" vertical={false} />
              <XAxis
                dataKey="lag"
                tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => fmtLag(v)}
              />
              <YAxis
                domain={[-1, 1]}
                ticks={[-1, -0.5, 0, 0.5, 1]}
                tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <Tooltip
                {...tooltipStyle}
                cursor={{ fill: '#1c2e4a', fillOpacity: 0.3 }}
                formatter={(_v: number, _name: string, item: any) => {
                  const raw = item?.payload?.rRaw
                  const sig = item?.payload?.significant
                  return [
                    raw == null ? '—' : `${(raw as number).toFixed(3)}${sig ? ' ✓' : ''}`,
                    'r',
                  ]
                }}
                labelFormatter={(l: number) => `Lag ${fmtLag(l)} months`}
              />
              {/* Zero line */}
              <ReferenceLine y={0} stroke="#566b8a" strokeWidth={1} />
              {/* 95% CI band */}
              {ci95 != null && (
                <>
                  <ReferenceLine
                    y={ci95}
                    stroke="#c4a35a"
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    label={{ value: `+${ci95.toFixed(2)}`, position: 'right', fontSize: 9, fill: '#c4a35a' }}
                  />
                  <ReferenceLine
                    y={-ci95}
                    stroke="#c4a35a"
                    strokeDasharray="4 3"
                    strokeWidth={1}
                    label={{ value: `-${ci95.toFixed(2)}`, position: 'right', fontSize: 9, fill: '#c4a35a' }}
                  />
                </>
              )}
              <Bar dataKey="r" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {chartData.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.isPeak ? '#c4a35a' : d.significant ? '#00a19c' : '#566b8a'}
                    fillOpacity={d.isPeak ? 0.95 : d.significant ? 0.70 : 0.45}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-text-faint leading-snug mt-1.5 px-1">
          x = lag in months; positive = risk proxy LEADS Brent returns.{' '}
          <span style={{ color: '#c4a35a' }}>Gold</span> = peak |r|.{' '}
          <span style={{ color: '#00a19c' }}>Teal</span> = significant at 95%.{' '}
          Dashed gold lines = 95% CI (±1.96/√n). n={n} months
          {span ? ` · ${span.start} – ${span.end}` : ''}.
        </p>
      </div>

      {/* Plain-language interpretation */}
      <div className="rounded-md border border-petro-border bg-petro-bg px-3 py-2">
        <p className="text-[10px] font-bold text-text-faint uppercase tracking-wide mb-1">
          Interpretation
        </p>
        <p className="text-[11px] text-text-muted leading-relaxed">
          {interpretation}
        </p>
      </div>
    </div>
  )
}
