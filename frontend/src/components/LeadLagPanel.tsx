import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { AlertTriangle, Hourglass } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { fetchHistorySeries, type HistorySeriesPoint } from '../api/client'

// ── Tunables ───────────────────────────────────────────────────────────────
const MIN_POINTS = 24        // below this, gate the analytics entirely
const TARGET_POINTS = 500    // ~3 weeks of hourly snapshots
const MAX_LAG = 6            // cross-correlation lag window: -6..+6 data points

// ── Pure stats helpers (no deps, all null-safe) ──────────────────────────────

/** Pearson correlation. Returns null on length<2, mismatch, or zero variance. */
function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return null
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i]
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null
    sx += x
    sy += y
  }
  const mx = sx / n
  const my = sy / n
  let sxy = 0, sxx = 0, syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  const denom = Math.sqrt(sxx * syy)
  if (!Number.isFinite(denom) || denom === 0) return null // zero variance
  const r = sxy / denom
  return Number.isFinite(r) ? r : null
}

/** First differences between consecutive elements. */
function diff(xs: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < xs.length; i++) out.push(xs[i] - xs[i - 1])
  return out
}

/**
 * Cross-correlation across integer lags k = -MAX_LAG..+MAX_LAG.
 * r between risk[t] and brent[t+k]. Positive k → risk LEADS brent.
 * Each lag re-aligns the two arrays to their overlapping window only.
 */
function crossCorrelation(
  risk: number[],
  brent: number[],
  maxLag: number,
): { lag: number; r: number | null; n: number }[] {
  const out: { lag: number; r: number | null; n: number }[] = []
  const len = Math.min(risk.length, brent.length)
  for (let k = -maxLag; k <= maxLag; k++) {
    const a: number[] = []
    const b: number[] = []
    for (let t = 0; t < len; t++) {
      const tk = t + k
      if (tk < 0 || tk >= len) continue
      a.push(risk[t])
      b.push(brent[tk])
    }
    out.push({ lag: k, r: pearson(a, b), n: a.length })
  }
  return out
}

/** Format an r value for display: 2dp, or em-dash when null. */
function fmtR(r: number | null): string {
  return r === null ? '—' : r.toFixed(2)
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LeadLagPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['historySeries'],
    queryFn: fetchHistorySeries,
    refetchInterval: 300_000,
  })

  const analysis = useMemo(() => {
    const raw: HistorySeriesPoint[] = data?.series ?? []
    // Keep only points where BOTH risk_score and brent are present + finite, sorted by ts asc.
    const paired = raw
      .filter(
        p =>
          p.risk_score !== null &&
          p.brent !== null &&
          Number.isFinite(p.risk_score as number) &&
          Number.isFinite(p.brent as number),
      )
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())

    const risk = paired.map(p => p.risk_score as number)
    const brent = paired.map(p => p.brent as number)
    const n = paired.length

    if (n < MIN_POINTS) {
      return { n, gated: true as const }
    }

    // 1. Contemporaneous correlations
    const rLevel = pearson(risk, brent)
    // Δbrent vs risk_score aligned to the *later* point of each consecutive pair.
    const dBrent = diff(brent)
    const riskForDelta = risk.slice(1) // align risk[t] with (brent[t]-brent[t-1])
    const rDelta = pearson(riskForDelta, dBrent)

    // 2. Cross-correlation lag profile
    const xcorr = crossCorrelation(risk, brent, MAX_LAG)
    // Peak by |r| among non-null lags.
    let peak: { lag: number; r: number | null; n: number } | null = null
    for (const c of xcorr) {
      if (c.r === null) continue
      if (peak === null || Math.abs(c.r) > Math.abs(peak.r as number)) peak = c
    }

    // 3. Scatter points (contemporaneous)
    const scatter = paired.map(p => ({
      risk: p.risk_score as number,
      brent: p.brent as number,
    }))

    return {
      n,
      gated: false as const,
      rLevel,
      rDelta,
      nDelta: Math.min(riskForDelta.length, dBrent.length),
      xcorr,
      peak,
      scatter,
    }
  }, [data])

  const days = data?.days ?? 0

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <div className="h-48 flex items-center justify-center">
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">
          Analyzing Relationship…
        </span>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="h-48 flex items-center justify-center gap-2">
        <AlertTriangle size={14} className="text-petro-gold" />
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">
          Relationship Data Unavailable
        </span>
      </div>
    )
  }

  // ── Gated: accumulating history ──────────────────────────────────────────────
  if (analysis.gated) {
    const pct = Math.min(100, Math.round((analysis.n / TARGET_POINTS) * 100))
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <Hourglass size={18} className="text-petro-gold" />
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">
          Accumulating History
        </span>
        <span className="text-[11px] text-text-faint leading-relaxed max-w-sm">
          {analysis.n}/~{TARGET_POINTS} hourly points with both Risk &amp; Brent.
          Relationship analytics unlock with more data (needs at least {MIN_POINTS} points).
        </span>
        {/* Progress hint */}
        <div className="w-full max-w-xs">
          <div className="h-1.5 bg-petro-bg rounded-full overflow-hidden border border-petro-border">
            <div
              className="h-full rounded-full bg-petro-gold transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-text-faint font-mono mt-1">{pct}% toward ~3 weeks of history</p>
        </div>
      </div>
    )
  }

  // ── Analytics (n >= MIN_POINTS) ──────────────────────────────────────────────
  const { n, rLevel, rDelta, nDelta, xcorr, peak, scatter } = analysis

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

  const xcorrData = xcorr.map(c => ({
    lag: c.lag,
    r: c.r ?? 0,
    rRaw: c.r,
    isPeak: peak !== null && c.lag === peak.lag,
  }))

  // Peak interpretation string (honest, non-predictive phrasing).
  let peakNote = 'No usable lag (insufficient variance across the window).'
  if (peak !== null && peak.r !== null) {
    if (peak.lag === 0) {
      peakNote = `Strongest co-movement is contemporaneous (lag 0), r = ${fmtR(peak.r)}.`
    } else if (peak.lag > 0) {
      peakNote = `Strongest co-movement at lag +${peak.lag} (risk moves before Brent in this sample), r = ${fmtR(peak.r)}.`
    } else {
      peakNote = `Strongest co-movement at lag ${peak.lag} (Brent moves before risk in this sample), r = ${fmtR(peak.r)}.`
    }
  }

  return (
    <div className="space-y-4">
      {/* HONESTY BADGE — prominent */}
      <div className="flex items-start gap-2 rounded-md border border-petro-gold/40 bg-petro-gold/10 px-3 py-2">
        <span className="flex-shrink-0 mt-0.5 text-[9px] font-bold rounded px-1.5 py-0.5 bg-petro-gold/20 text-petro-gold border border-petro-gold/40 uppercase tracking-wider">
          Preliminary
        </span>
        <p className="text-[11px] text-text-muted leading-relaxed">
          {n} points over ~{days} days. Correlation &ne; causation; <span className="font-bold text-petro-gold">NOT statistically significant yet</span>{' '}
          (needs ~3&ndash;4 weeks of history). Auto-strengthens as data accumulates.
        </p>
      </div>

      {/* Contemporaneous correlations */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-petro-border bg-petro-bg p-3">
          <p className="text-[10px] font-bold text-text-faint uppercase tracking-wide mb-1">
            Risk vs Brent (level)
          </p>
          <p className="font-mono text-2xl font-bold text-text-warm leading-none">{fmtR(rLevel)}</p>
          <p className="text-[10px] text-text-faint font-mono mt-1">Pearson r · n={n}</p>
        </div>
        <div className="rounded-md border border-petro-border bg-petro-bg p-3">
          <p className="text-[10px] font-bold text-text-faint uppercase tracking-wide mb-1">
            Risk vs &Delta;Brent
          </p>
          <p className="font-mono text-2xl font-bold text-text-warm leading-none">{fmtR(rDelta)}</p>
          <p className="text-[10px] text-text-faint font-mono mt-1">Pearson r · n={nDelta}</p>
        </div>
      </div>

      {/* Cross-correlation bar chart */}
      <div>
        <p className="text-[11px] font-bold text-text-faint uppercase tracking-wide px-1 mb-2">
          Cross-Correlation by Lag (data points)
        </p>
        <div className="h-40 w-full bg-petro-bg rounded-md p-2 border border-petro-border">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={xcorrData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" vertical={false} />
              <XAxis
                dataKey="lag"
                tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
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
                formatter={(_v: number, _n: string, item: any) => {
                  const raw = item?.payload?.rRaw
                  return [raw === null || raw === undefined ? '—' : (raw as number).toFixed(2), 'r']
                }}
                labelFormatter={(l: number) => `Lag ${l > 0 ? `+${l}` : l}`}
              />
              <ReferenceLine y={0} stroke="#566b8a" strokeWidth={1} />
              <Bar dataKey="r" radius={[2, 2, 0, 0]} isAnimationActive={false}>
                {xcorrData.map((d, i) => (
                  <Cell key={i} fill={d.isPeak ? '#c4a35a' : '#00a19c'} fillOpacity={d.isPeak ? 0.95 : 0.55} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-text-faint leading-snug mt-1.5 px-1">
          x = lag in data points; positive = Risk leads Brent. Gold bar = peak |r|. {peakNote}
        </p>
      </div>

      {/* Scatter: risk vs brent (contemporaneous) */}
      <div>
        <p className="text-[11px] font-bold text-text-faint uppercase tracking-wide px-1 mb-2">
          Risk Score vs Brent (contemporaneous)
        </p>
        <div className="h-40 w-full bg-petro-bg rounded-md p-2 border border-petro-border">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" />
              <XAxis
                type="number"
                dataKey="risk"
                name="risk"
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}`}
              />
              <YAxis
                type="number"
                dataKey="brent"
                name="brent"
                domain={['auto', 'auto']}
                tick={{ fontSize: 10, fill: '#566b8a', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v}`}
              />
              <ZAxis range={[24, 24]} />
              <Tooltip
                {...tooltipStyle}
                cursor={{ strokeDasharray: '3 3', stroke: '#566b8a' }}
                formatter={(value: number, name: string) => {
                  if (name === 'brent') return [`$${value?.toFixed(2)}`, 'BRENT']
                  if (name === 'risk') return [`${value?.toFixed(1)}`, 'RISK']
                  return [value, name]
                }}
              />
              <Scatter data={scatter} fill="#ef4444" fillOpacity={0.55} isAnimationActive={false} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-text-faint leading-snug mt-1.5 px-1">
          Each dot = one hourly snapshot. x = Risk Score (0&ndash;100), y = Brent (USD). Descriptive only &mdash; no predictive power implied.
        </p>
      </div>
    </div>
  )
}
