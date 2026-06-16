import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { fetchRiskIndex } from '../api/client'

// Tier badge colors: LIVE=teal, EST=gold, SIM=red
const TIER_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  LIVE: { bg: 'bg-petro-teal/15', text: 'text-petro-teal', label: 'LIVE' },
  EST:  { bg: 'bg-petro-gold/15', text: 'text-petro-gold', label: 'EST' },
  SIM:  { bg: 'bg-red-500/15',    text: 'text-red-400',    label: 'SIM' },
}

function scoreColor(score: number): string {
  if (score >= 75) return '#ef4444'
  if (score >= 50) return '#f97316'
  if (score >= 25) return '#c4a35a'
  return '#00a19c'
}

export default function RiskDecomposition() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['riskIndex'],
    queryFn: fetchRiskIndex,
    refetchInterval: 300_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">Computing Decomposition…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="h-32 flex items-center justify-center gap-2">
        <AlertTriangle size={14} className="text-petro-gold" />
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">Decomposition Unavailable</span>
      </div>
    )
  }

  const components = data.components ?? []
  if (components.length === 0) {
    return (
      <div className="h-24 flex items-center justify-center">
        <span className="text-xs text-text-faint uppercase tracking-wide">No component data</span>
      </div>
    )
  }

  // Compute contributions
  const withContrib = components.map(c => ({
    ...c,
    contribution: (c.score_0_100 ?? 0) * (c.weight ?? 0),
    tier: (c as any).tier as string | undefined,
    source: (c as any).source as string | undefined,
  }))

  const totalContrib = withContrib.reduce((sum, c) => sum + c.contribution, 0) || 1

  const ranked = [...withContrib].sort((a, b) => b.contribution - a.contribution)

  const maxContrib = ranked[0]?.contribution || 1

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {ranked.map((c, i) => {
          const share = (c.contribution / totalContrib) * 100
          const barPct = (c.contribution / maxContrib) * 100
          const color = scoreColor(c.score_0_100)
          const rawTier = (c.tier ?? '').toUpperCase()
          const tierCfg = TIER_COLOR[rawTier] ?? null

          return (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-text-muted truncate">{c.name}</span>
                  {tierCfg && (
                    <span className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${tierCfg.bg} ${tierCfg.text}`}>
                      {tierCfg.label}
                    </span>
                  )}
                </div>
                <div className="flex-shrink-0 flex items-center gap-3 text-[11px] font-mono">
                  <span className="text-text-faint">Score&nbsp;<span style={{ color }}>{Math.round(c.score_0_100)}</span></span>
                  <span className="text-text-muted font-bold" style={{ color }}>{share.toFixed(1)}%</span>
                </div>
              </div>

              {/* Contribution bar */}
              <div className="h-2 bg-petro-bg rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${barPct}%`, backgroundColor: color }}
                />
              </div>

              {c.detail && (
                <p className="text-[10px] text-text-faint leading-snug">{c.detail}</p>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-[10px] text-text-faint border-t border-petro-border pt-2 leading-relaxed">
        Contribution = score × weight. Share% = component contribution ÷ total weighted contribution × 100. Sorted by contribution descending.
      </p>
    </div>
  )
}
