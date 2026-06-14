import { useQuery } from '@tanstack/react-query'
import { fetchRiskIndex } from '../api/client'

const LEVEL_STYLES: Record<string, string> = {
  low:      'bg-petro-teal/10 border-petro-teal/40 text-petro-teal',
  elevated: 'bg-petro-gold/10 border-petro-gold/40 text-petro-gold',
  high:     'bg-orange-500/10 border-orange-500/40 text-orange-400',
  severe:   'bg-petro-red/10 border-petro-red/40 text-petro-red',
}

export default function RiskChip({ onClickToAnalytics }: { onClickToAnalytics: () => void }) {
  const { data } = useQuery({
    queryKey: ['risk-index'],
    queryFn: fetchRiskIndex,
    refetchInterval: 300_000,
  })

  if (!data) return null

  const styles = LEVEL_STYLES[data.level] ?? LEVEL_STYLES['elevated']

  return (
    <button
      onClick={onClickToAnalytics}
      className={`
        flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-xs font-bold
        uppercase tracking-wide transition-opacity hover:opacity-80 shrink-0
        ${styles}
      `}
      title={data.summary}
    >
      <span className="hidden sm:inline">HORMUZ RISK ·</span>
      <span>{data.score}</span>
      <span className="opacity-60">·</span>
      <span>{data.level.toUpperCase()}</span>
    </button>
  )
}
