import { useQuery } from '@tanstack/react-query'
import { Activity, Anchor, Eye, EyeOff, Layers, Droplets, TrendingUp, Clock } from 'lucide-react'
import {
  fetchRiskIndex,
  fetchOverview,
  fetchStraitStatus,
} from '../api/client'

// ── Level configs ─────────────────────────────────────────────────────────────

const RISK_LEVEL = {
  low:      { label: 'LOW RISK',      color: '#00a19c', bg: 'bg-petro-teal/10',  ring: 'ring-petro-teal/40',  text: 'text-petro-teal',   pulse: false },
  elevated: { label: 'ELEVATED RISK', color: '#c4a35a', bg: 'bg-petro-gold/10',  ring: 'ring-petro-gold/40',  text: 'text-petro-gold',   pulse: false },
  high:     { label: 'HIGH RISK',     color: '#f97316', bg: 'bg-orange-500/10',  ring: 'ring-orange-500/40',  text: 'text-orange-400',   pulse: true  },
  severe:   { label: 'SEVERE RISK',   color: '#ef4444', bg: 'bg-red-500/10',     ring: 'ring-red-500/40',     text: 'text-red-400',      pulse: true  },
} as const

const STRAIT_LEVEL = {
  green: { label: 'NOMINAL',  color: '#00a19c', dot: 'bg-petro-teal',  text: 'text-petro-teal'  },
  amber: { label: 'ELEVATED', color: '#c4a35a', dot: 'bg-petro-gold',  text: 'text-petro-gold'  },
  red:   { label: 'CRITICAL', color: '#ef4444', dot: 'bg-petro-red',   text: 'text-petro-red'   },
} as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string | undefined): string {
  if (!iso) return '—'
  const ageMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ageMs / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  return `${Math.floor(min / 60)}h ago`
}

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreArc({ score, color }: { score: number; color: string }) {
  const r = 46
  const cx = 60
  const cy = 60
  const circ = Math.PI * r
  const filled = (score / 100) * circ
  const angle = ((score / 100) * 180 - 180) * (Math.PI / 180)
  const nx = cx + r * 0.72 * Math.cos(angle)
  const ny = cy + r * 0.72 * Math.sin(angle)

  return (
    <svg width="120" height="68" viewBox="0 0 120 68" className="overflow-visible">
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#1c2e4a" strokeWidth="8" strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        style={{ transition: 'stroke-dasharray 0.7s ease' }}
      />
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="3.5" fill={color} />
    </svg>
  )
}

function StatCell({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  sub?: string
  icon?: React.ElementType
  accent?: string
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5 mb-0.5">
        {Icon && <Icon size={10} className="text-text-faint shrink-0" />}
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-faint truncate">{label}</span>
      </div>
      <span
        className="text-lg font-mono font-bold leading-none tracking-tight"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </span>
      {sub && <span className="text-[10px] text-text-faint font-mono mt-0.5 truncate">{sub}</span>}
    </div>
  )
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`bg-petro-border/40 rounded animate-pulse ${className ?? ''}`} />
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const { data: risk, isLoading: riskLoading } = useQuery({
    queryKey: ['riskIndex'],
    queryFn: fetchRiskIndex,
    refetchInterval: 300_000,
  })

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: 300_000,
  })

  const { data: strait, isLoading: straitLoading } = useQuery({
    queryKey: ['straitStatus'],
    queryFn: fetchStraitStatus,
    refetchInterval: 300_000,
  })

  const loading = riskLoading || overviewLoading || straitLoading

  const riskCfg = risk ? (RISK_LEVEL[risk.level] ?? RISK_LEVEL.elevated) : null
  const straitCfg = strait ? (STRAIT_LEVEL[strait.level] ?? STRAIT_LEVEL.amber) : null

  const ss = overview?.strait_status
  const prices = overview?.oil_prices
  const oilFlow = overview?.oil_flow

  // Freshness: pick newest of risk computed_at vs overview cached_date
  const freshAt = risk?.computed_at

  return (
    <div className="w-full bg-petro-card border border-petro-border rounded-lg overflow-hidden shadow-none">
      {/* ── Top accent bar (level-colored) ─────────────────────────────────── */}
      <div
        className="h-[3px] w-full transition-colors duration-700"
        style={{ backgroundColor: riskCfg?.color ?? '#1c2e4a' }}
      />

      <div className="p-4 sm:p-5 space-y-4">

        {/* ── Row 1: Hero risk + situational summary ─────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">

          {/* LEFT: Gauge + score */}
          <div className="flex-shrink-0 flex items-center gap-4">
            {loading || !risk ? (
              <div className="w-[120px] h-[68px] flex items-center justify-center">
                <SkeletonBlock className="w-[100px] h-[56px] rounded-full" />
              </div>
            ) : (
              <div className="flex flex-col items-center -mb-1">
                <ScoreArc score={risk.score} color={riskCfg!.color} />
                <div className="flex items-baseline gap-1 -mt-0.5">
                  <span
                    className="text-5xl font-mono font-black leading-none tracking-tight"
                    style={{ color: riskCfg!.color }}
                  >
                    {Math.round(risk.score)}
                  </span>
                  <span className="text-xs text-text-faint font-bold uppercase">/100</span>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Level badge + situational sentence */}
          <div className="flex-1 min-w-0 space-y-2 sm:pt-0.5">
            {/* System label */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-faint">
                STRAIT OF HORMUZ · COMMAND CENTER
              </span>
            </div>

            {/* Level badge */}
            {loading || !riskCfg ? (
              <SkeletonBlock className="h-6 w-32" />
            ) : (
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded ring-1 ${riskCfg.bg} ${riskCfg.ring}`}>
                <Activity
                  size={11}
                  style={{ color: riskCfg.color }}
                  className={riskCfg.pulse ? 'animate-pulse' : ''}
                />
                <span className={`text-[11px] font-black uppercase tracking-widest ${riskCfg.text}`}>
                  {riskCfg.label}
                </span>
              </div>
            )}

            {/* Situational sentence */}
            {loading || !risk ? (
              <div className="space-y-1">
                <SkeletonBlock className="h-3 w-full" />
                <SkeletonBlock className="h-3 w-3/4" />
              </div>
            ) : (
              <p className="text-[13px] text-text-muted leading-relaxed font-medium">
                {risk.summary}
              </p>
            )}
          </div>
        </div>

        {/* ── Divider ─────────────────────────────────────────────────────── */}
        <div className="border-t border-petro-border" />

        {/* ── Row 2: Stat strip ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-x-5 gap-y-4">

          {/* Strait status */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Anchor size={10} className="text-text-faint shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-faint">Strait Status</span>
            </div>
            {loading || !straitCfg ? (
              <SkeletonBlock className="h-5 w-20" />
            ) : (
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${straitCfg.dot} ${strait!.level !== 'green' ? 'animate-pulse' : ''}`}
                />
                <span
                  className={`text-lg font-mono font-bold leading-none ${straitCfg.text}`}
                >
                  {straitCfg.label}
                </span>
              </div>
            )}
            {strait && (
              <span className="text-[10px] text-text-faint font-mono mt-0.5">
                health {strait.score}%
              </span>
            )}
          </div>

          {/* Tankers active — SIM (vessel data) */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Layers size={10} className="text-text-faint shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-faint truncate">Tankers Active</span>
              <span className="text-[9px] font-bold text-petro-gold uppercase tracking-wide">SIM</span>
            </div>
            <span className="text-lg font-mono font-bold leading-none tracking-tight">
              {loading ? '—' : fmt(ss?.tankers_active)}
            </span>
            {ss && <span className="text-[10px] text-text-faint font-mono mt-0.5 truncate">{fmt(ss.vessels_tracked)} tracked</span>}
          </div>

          {/* Loaded outbound — SIM (vessel data) */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <TrendingUp size={10} className="text-text-faint shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-faint truncate">Loaded Outbound</span>
              <span className="text-[9px] font-bold text-petro-gold uppercase tracking-wide">SIM</span>
            </div>
            <span className="text-lg font-mono font-bold leading-none tracking-tight">
              {loading ? '—' : fmt(ss?.loaded_tankers)}
            </span>
            {ss && <span className="text-[10px] text-text-faint font-mono mt-0.5 truncate">{fmt(ss.ballast_tankers)} ballast</span>}
          </div>

          {/* EIA Baseline — static reference figure */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Droplets size={10} className="text-text-faint shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-faint truncate">EIA Baseline</span>
            </div>
            {loading ? (
              <SkeletonBlock className="h-5 w-16" />
            ) : (
              <span className="text-lg font-mono font-bold leading-none text-text-warm">
                {fmt(oilFlow?.eia_baseline_mbpd, 1)}
                <span className="text-[11px] font-normal text-text-faint ml-1">mbpd</span>
              </span>
            )}
            <span className="text-[10px] text-text-faint font-mono mt-0.5">static — not live</span>
          </div>

          {/* Brent price */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[10px] text-text-faint font-bold">$</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-faint">Brent</span>
            </div>
            {loading ? (
              <SkeletonBlock className="h-5 w-16" />
            ) : (
              <span className="text-lg font-mono font-bold leading-none text-petro-gold">
                {prices?.brent != null ? `$${fmt(prices.brent, 2)}` : '—'}
              </span>
            )}
            <span className="text-[10px] text-text-faint font-mono mt-0.5">
              {prices?.brent_date ?? 'per bbl'}
            </span>
          </div>

          {/* Dark vessels — SIM (vessel data) */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <EyeOff size={10} className="text-text-faint shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-faint truncate">Dark Vessels</span>
              <span className="text-[9px] font-bold text-petro-gold uppercase tracking-wide">SIM</span>
            </div>
            <span className="text-lg font-mono font-bold leading-none tracking-tight">
              {loading ? '—' : fmt(ss?.dark_vessel_count ?? 0)}
            </span>
            <span className="text-[10px] text-text-faint font-mono mt-0.5 truncate">AIS-off</span>
          </div>

          {/* STS events — SIM (vessel data) */}
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Eye size={10} className="text-text-faint shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-faint truncate">STS Events</span>
              <span className="text-[9px] font-bold text-petro-gold uppercase tracking-wide">SIM</span>
            </div>
            <span className="text-lg font-mono font-bold leading-none tracking-tight">
              {loading ? '—' : fmt(ss?.sts_event_count ?? 0)}
            </span>
            <span className="text-[10px] text-text-faint font-mono mt-0.5 truncate">ship-to-ship</span>
          </div>
        </div>

        {/* ── Row 3: Freshness line ────────────────────────────────────────── */}
        <div className="flex items-center gap-2 pt-0.5">
          <Clock size={10} className="text-text-faint shrink-0" />
          <span className="text-[10px] font-mono text-text-faint uppercase tracking-wide">
            {freshAt
              ? `as of ${relativeTime(freshAt)} · updates hourly`
              : 'refreshing…'}
          </span>
          {riskCfg && (
            <>
              <span className="text-text-faint text-[10px]">·</span>
              <span className="text-[10px] font-mono text-text-faint uppercase tracking-wide">
                auto-refresh 5 min
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
