import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, AlertTriangle, Activity } from 'lucide-react'
import { fetchRiskIndex, RiskIndexComponent } from '../api/client'

const LEVEL_CONFIG = {
  low:      { label: 'LOW',      color: '#00a19c', bg: 'bg-petro-teal/10',   ring: 'ring-petro-teal/40',   text: 'text-petro-teal' },
  elevated: { label: 'ELEVATED', color: '#c4a35a', bg: 'bg-petro-gold/10',   ring: 'ring-petro-gold/40',   text: 'text-petro-gold' },
  high:     { label: 'HIGH',     color: '#f97316', bg: 'bg-orange-500/10',   ring: 'ring-orange-500/40',   text: 'text-orange-400' },
  severe:   { label: 'SEVERE',   color: '#ef4444', bg: 'bg-red-500/10',      ring: 'ring-red-500/40',      text: 'text-red-400'    },
} as const

function GaugeArc({ score, color }: { score: number; color: string }) {
  // SVG semi-circle gauge, 0-100
  const r = 54
  const cx = 70
  const cy = 70
  const circumference = Math.PI * r  // half circle
  const filled = (score / 100) * circumference
  // arc path left→right (180° sweep)
  const startX = cx - r
  const endX = cx + r
  return (
    <svg width="140" height="80" viewBox="0 0 140 80" className="overflow-visible">
      {/* track */}
      <path
        d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`}
        fill="none"
        stroke="#1c2e4a"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* fill */}
      <path
        d={`M ${startX} ${cy} A ${r} ${r} 0 0 1 ${endX} ${cy}`}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      {/* needle */}
      {(() => {
        const angle = ((score / 100) * 180 - 180) * (Math.PI / 180)
        const nx = cx + r * 0.75 * Math.cos(angle)
        const ny = cy + r * 0.75 * Math.sin(angle)
        return (
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        )
      })()}
      {/* center dot */}
      <circle cx={cx} cy={cy} r="4" fill={color} />
    </svg>
  )
}

function ComponentBar({ comp }: { comp: RiskIndexComponent }) {
  const weighted = (comp.score_0_100 * comp.weight).toFixed(1)
  const pct = Math.min(100, comp.score_0_100)
  const barColor =
    comp.score_0_100 >= 75 ? '#ef4444'
    : comp.score_0_100 >= 50 ? '#f97316'
    : comp.score_0_100 >= 25 ? '#c4a35a'
    : '#00a19c'

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-text-muted font-bold uppercase tracking-wide">{comp.name}</span>
        <span className="text-text-faint font-mono">{weighted} pts · w={comp.weight.toFixed(2)}</span>
      </div>
      <div className="h-1.5 bg-petro-bg rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="text-[10px] text-text-faint leading-snug">{comp.detail}</p>
    </div>
  )
}

export default function RiskIndexGauge() {
  const [expanded, setExpanded] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['riskIndex'],
    queryFn: fetchRiskIndex,
    refetchInterval: 300_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-40 flex items-center justify-center">
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">Computing Risk Index…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="h-40 flex items-center justify-center gap-2">
        <AlertTriangle size={14} className="text-petro-gold" />
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">Risk Index Unavailable</span>
      </div>
    )
  }

  const cfg = LEVEL_CONFIG[data.level] ?? LEVEL_CONFIG.elevated
  const ts = new Date(data.computed_at).toLocaleString('en-GB', { hour12: false, timeZone: 'UTC', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <div className="space-y-4">
      {/* headline row */}
      <div className="flex items-start gap-6">
        {/* gauge */}
        <div className="flex-shrink-0 flex flex-col items-center -mt-1">
          <GaugeArc score={data.score} color={cfg.color} />
          <div className="flex items-baseline gap-2 -mt-1">
            <span className="text-4xl font-mono font-bold" style={{ color: cfg.color }}>{Math.round(data.score)}</span>
            <span className="text-xs text-text-faint font-bold uppercase">/100</span>
          </div>
        </div>

        {/* level + summary */}
        <div className="flex-1 space-y-2 pt-1">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded ring-1 ${cfg.bg} ${cfg.ring}`}>
            <Activity size={11} style={{ color: cfg.color }} />
            <span className={`text-[11px] font-bold uppercase tracking-widest ${cfg.text}`}>{cfg.label} RISK</span>
          </div>
          <p className="text-[12px] text-text-muted leading-relaxed">{data.summary}</p>
          <p className="text-[10px] text-text-faint font-mono">COMPUTED {ts} UTC</p>
        </div>
      </div>

      {/* expandable components */}
      <div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="flex items-center gap-1.5 text-[11px] font-bold text-text-faint uppercase tracking-wide hover:text-text-muted transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Hide' : 'Show'} Component Breakdown ({data.components.length})
        </button>

        {expanded && (
          <div className="mt-3 space-y-4 bg-petro-bg rounded-md p-3 border border-petro-border">
            {data.components.map((c, i) => (
              <ComponentBar key={i} comp={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
