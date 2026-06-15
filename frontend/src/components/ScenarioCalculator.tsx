import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchBypass, fetchOverview } from '../api/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_THROUGHPUT = 20.9   // mbpd — EIA/IEA Hormuz baseline
const DEFAULT_SPARE     = 5.95   // mbpd — total pipeline bypass spare
const DEFAULT_BRENT     = 80     // $/bbl — fallback if API unavailable
const GLOBAL_STOCKS_MB  = 4100   // million barrels — OECD commercial + SPR (IEA 2024)
const PRICE_MULT_LOW    = 1.0    // $/bbl per mbpd disruption — conservative
const PRICE_MULT_HIGH   = 2.2    // $/bbl per mbpd disruption — IEA/Goldman stress

// ── Severity colours ─────────────────────────────────────────────────────────
function severityColor(pctRemoved: number): string {
  if (pctRemoved < 10) return 'text-teal-400'
  if (pctRemoved < 30) return 'text-yellow-400'
  if (pctRemoved < 60) return 'text-orange-400'
  return 'text-red-400'
}
function severityBg(pctRemoved: number): string {
  if (pctRemoved < 10) return 'border-teal-500/40 bg-teal-900/10'
  if (pctRemoved < 30) return 'border-yellow-500/40 bg-yellow-900/10'
  if (pctRemoved < 60) return 'border-orange-500/40 bg-orange-900/10'
  return 'border-red-500/40 bg-red-900/10'
}

// ── Slider ───────────────────────────────────────────────────────────────────
function Slider({
  label, value, min, max, step = 1, unit, onChange, description,
}: {
  label: string; value: number; min: number; max: number; step?: number
  unit: string; onChange: (v: number) => void; description?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-semibold uppercase tracking-wide text-text-warm">{label}</span>
        <span className="text-sm font-mono font-bold text-petro-gold tabular-nums">
          {value.toLocaleString()}{unit}
        </span>
      </div>
      {description && (
        <p className="text-[10px] text-text-faint leading-snug">{description}</p>
      )}
      <div className="relative pt-1">
        {/* track */}
        <div className="h-1.5 w-full bg-petro-border rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-teal-600 to-petro-gold rounded-full transition-all duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-4 -top-1"
        />
      </div>
      <div className="flex justify-between text-[10px] font-mono text-text-faint">
        <span>{min}{unit}</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  )
}

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({
  label, value, sub, color, border,
}: {
  label: string; value: string; sub?: string; color?: string; border?: string
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-1 ${border ?? 'border-petro-border'}`}>
      <p className="text-[10px] font-mono uppercase tracking-wider text-text-faint">{label}</p>
      <p className={`text-xl font-bold font-mono tabular-nums leading-none ${color ?? 'text-text-warm'}`}>
        {value}
      </p>
      {sub && <p className="text-[11px] text-text-muted leading-tight">{sub}</p>}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ScenarioCalculator() {
  const [reduction, setReduction] = useState(100)    // 0–100 %
  const [duration, setDuration]   = useState(30)     // days
  const [sprRelease, setSprRelease] = useState(60)   // million barrels

  const { data: bypassData } = useQuery({
    queryKey: ['bypass'],
    queryFn: fetchBypass,
    refetchInterval: 300_000,
    staleTime: 60_000,
  })
  const { data: overviewData } = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: 300_000,
    staleTime: 60_000,
  })

  // Pull live values with safe fallbacks
  const throughput = bypassData?.hormuz_throughput_mbpd ?? DEFAULT_THROUGHPUT
  const spare      = bypassData?.total_spare_mbpd       ?? DEFAULT_SPARE
  const brentRaw   = overviewData?.oil_prices?.brent
    ?? overviewData?.oil_prices?.brent_futures
    ?? DEFAULT_BRENT
  const currentBrent = brentRaw > 0 ? brentRaw : DEFAULT_BRENT

  // ── Compute ──────────────────────────────────────────────────────────────
  const calc = useMemo(() => {
    // Step 1: bypass absorbs first
    const disruptedGross   = (reduction / 100) * throughput
    const bypassAbsorbs    = Math.min(spare, disruptedGross)
    const effectiveDisrupt = Math.max(0, disruptedGross - bypassAbsorbs)

    // Step 2: price impact ($/bbl) — proportional to effective disruption
    const impactLow  = effectiveDisrupt * PRICE_MULT_LOW
    const impactHigh = effectiveDisrupt * PRICE_MULT_HIGH

    const peakBrentLow  = Math.max(currentBrent, currentBrent + impactLow)
    const peakBrentHigh = Math.max(currentBrent, currentBrent + impactHigh)

    // Step 3: buffer days  (mb ÷ mb/d = days)
    const denom      = Math.max(effectiveDisrupt, 0.01)
    const bufferDays = (GLOBAL_STOCKS_MB + sprRelease) / denom

    // Derived
    const pctOfTotal = throughput > 0 ? (effectiveDisrupt / throughput) * 100 : 0
    const bypassCoversPct = disruptedGross > 0
      ? Math.min(100, (bypassAbsorbs / disruptedGross) * 100)
      : 100

    return {
      disruptedGross,
      bypassAbsorbs,
      effectiveDisrupt,
      impactLow,
      impactHigh,
      peakBrentLow,
      peakBrentHigh,
      bufferDays,
      pctOfTotal,
      bypassCoversPct,
    }
  }, [reduction, sprRelease, throughput, spare, currentBrent])

  // ── Chart data ───────────────────────────────────────────────────────────
  const barData = [
    { name: 'Throughput', mbpd: throughput, fill: '#2d4a5a' },
    { name: 'Bypass covers', mbpd: calc.bypassAbsorbs, fill: '#2dd4bf' },
    { name: 'Supply gap', mbpd: calc.effectiveDisrupt, fill: '#dc2626' },
    { name: 'SPR equiv.', mbpd: sprRelease / Math.max(duration, 1), fill: '#c9a432' },
  ]

  // ── Narrative ────────────────────────────────────────────────────────────
  const sevColor = severityColor(calc.pctOfTotal)
  const sevBg    = severityBg(calc.pctOfTotal)

  const narrative = (() => {
    if (reduction === 0) return 'No closure — strait remains fully open. No supply impact.'
    if (calc.effectiveDisrupt < 0.1)
      return `A ${reduction}% closure for ${duration}d is fully absorbed by pipeline bypass capacity (~${spare.toFixed(1)} mbpd). No net price impact expected.`
    return `A ${reduction}% closure for ${duration}d removes ~${calc.effectiveDisrupt.toFixed(1)} mbpd after bypass absorbs ${calc.bypassAbsorbs.toFixed(1)} mbpd; Brent could reach $${calc.peakBrentLow.toFixed(0)}–$${calc.peakBrentHigh.toFixed(0)}/bbl. Global stocks provide ~${calc.bufferDays.toFixed(0)}d of cover.`
  })()

  return (
    <div className="space-y-6">
      {/* Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Slider
          label="Traffic reduction"
          value={reduction} min={0} max={100} unit="%"
          onChange={setReduction}
          description="% of normal Hormuz traffic halted by closure or blockade"
        />
        <Slider
          label="Duration"
          value={duration} min={1} max={180} unit="d"
          onChange={setDuration}
          description="Scenario length in days (affects SPR daily release rate)"
        />
        <Slider
          label="IEA / SPR release"
          value={sprRelease} min={0} max={400} step={5} unit=" mb"
          onChange={setSprRelease}
          description="Coordinated strategic petroleum reserve release (million barrels)"
        />
      </div>

      {/* Output cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Supply removed"
          value={`${calc.effectiveDisrupt.toFixed(2)} mbpd`}
          sub={`${calc.pctOfTotal.toFixed(0)}% of Hormuz flow; bypass covers ${calc.bypassCoversPct.toFixed(0)}%`}
          color={sevColor}
          border={calc.effectiveDisrupt > 1 ? 'border-red-700/50' : 'border-petro-border'}
        />
        <MetricCard
          label="Est. Brent peak"
          value={`$${calc.peakBrentLow.toFixed(0)}–$${calc.peakBrentHigh.toFixed(0)}`}
          sub={`+$${calc.impactLow.toFixed(0)}–$${calc.impactHigh.toFixed(0)}/bbl vs $${currentBrent.toFixed(0)} spot`}
          color={calc.impactHigh > 0 ? 'text-orange-400' : 'text-teal-400'}
          border={calc.impactHigh > 20 ? 'border-orange-700/50' : 'border-petro-border'}
        />
        <MetricCard
          label="Stock buffer"
          value={`${Math.min(calc.bufferDays, 9999).toFixed(0)}d`}
          sub={`OECD ${GLOBAL_STOCKS_MB.toLocaleString()} mb + ${sprRelease} mb SPR at ${calc.effectiveDisrupt.toFixed(1)} mbpd deficit`}
          color={calc.bufferDays < 30 ? 'text-red-400' : calc.bufferDays < 90 ? 'text-yellow-400' : 'text-teal-400'}
        />
        <MetricCard
          label="Asia exposure"
          value="~74%"
          sub="of Hormuz oil flows to China, India, Japan & S. Korea; +20% global LNG (Qatar)"
          color="text-yellow-300"
        />
      </div>

      {/* Narrative */}
      <div className={`rounded-lg border px-4 py-3 ${sevBg}`}>
        <p className={`text-sm font-semibold leading-relaxed ${sevColor}`}>{narrative}</p>
      </div>

      {/* Supply gap bar chart */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-wider text-text-faint mb-2">
          Supply flow breakdown (mbpd)
        </p>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#8fa3b1', fontFamily: 'monospace' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: '#8fa3b1', fontFamily: 'monospace' }}
                axisLine={false} tickLine={false}
                width={40}
                tickFormatter={v => `${v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{
                  background: '#0f1923', border: '1px solid #1e3040',
                  borderRadius: 6, fontSize: 11, fontFamily: 'monospace',
                }}
                labelStyle={{ color: '#c9a432', fontWeight: 600 }}
                itemStyle={{ color: '#b0c4d0' }}
                formatter={(v: number) => [`${v.toFixed(2)} mbpd`, '']}
              />
              <Bar dataKey="mbpd" radius={[3, 3, 0, 0]}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3 mt-1">
          {barData.map((d) => (
            <span key={d.name} className="flex items-center gap-1 text-[10px] font-mono text-text-faint">
              <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: d.fill }} />
              {d.name}: {d.mbpd.toFixed(2)} mbpd
            </span>
          ))}
        </div>
      </div>

      {/* Formula disclosure */}
      <div className="border-t border-petro-border pt-3 space-y-1">
        <p className="text-[10px] font-mono text-text-faint uppercase tracking-wide">Model formulas</p>
        <div className="text-[10px] font-mono text-text-faint/70 space-y-0.5 leading-relaxed">
          <p>effective_disruption = (reduction% × throughput) − min(bypass_spare, disrupted_gross)</p>
          <p>price_impact = effective_disruption × [1.0, 2.2] $/bbl·mbpd⁻¹</p>
          <p>buffer_days = (global_stocks_mb + SPR_release) ÷ effective_disruption</p>
          <p>global_stocks = {GLOBAL_STOCKS_MB.toLocaleString()} mb (OECD commercial + strategic, IEA 2024)</p>
        </div>
        <p className="text-[10px] text-text-faint/50 italic pt-1">
          Illustrative model — defensible public parameters (EIA/IEA), not a forecast.
          Live throughput: {throughput.toFixed(1)} mbpd · bypass spare: {spare.toFixed(1)} mbpd · Brent: ${currentBrent.toFixed(2)}/bbl
        </p>
      </div>
    </div>
  )
}
