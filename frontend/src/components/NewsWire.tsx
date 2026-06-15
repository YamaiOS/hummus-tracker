import { useQuery } from '@tanstack/react-query'
import { ExternalLink } from 'lucide-react'
import { fetchNews, NewsArticle } from '../api/client'

type Topic = NewsArticle['topic']

const TOPIC_STYLES: Record<Topic, { label: string; classes: string }> = {
  attack:      { label: 'ATTACK',      classes: 'bg-petro-red/20 text-petro-red border border-petro-red/40' },
  sanctions:   { label: 'SANCTIONS',   classes: 'bg-petro-gold/20 text-petro-gold border border-petro-gold/40' },
  geopolitics: { label: 'GEOPOLITICS', classes: 'bg-teal-900/40 text-petro-teal border border-petro-teal/40' },
  shipping:    { label: 'SHIPPING',    classes: 'bg-slate-700/50 text-slate-300 border border-slate-500/40' },
  energy:      { label: 'ENERGY',      classes: 'bg-slate-800/50 text-text-muted border border-petro-border' },
}

function relativeTime(published: string, ageHours: number): string {
  // Prefer age_hours if provided; fall back to computing from published
  const hours = ageHours != null && isFinite(ageHours)
    ? ageHours
    : (Date.now() - new Date(published).getTime()) / 3_600_000

  if (hours < 1) return `${Math.round(hours * 60)}m ago`
  if (hours < 24) return `${Math.round(hours)}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

export default function NewsWire() {
  const { data, isLoading } = useQuery({
    queryKey: ['news'],
    queryFn: fetchNews,
    refetchInterval: 300_000,
  })

  if (isLoading && !data) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading headlines...</span>
      </div>
    )
  }

  const articles = data?.articles ?? []

  if (articles.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-text-faint uppercase font-bold tracking-wide">No recent headlines</p>
      </div>
    )
  }

  return (
    <div className="max-h-[360px] overflow-y-auto pr-1 custom-scrollbar divide-y divide-petro-border">
      {articles.map((article, idx) => {
        const topic = article.topic as Topic
        const style = TOPIC_STYLES[topic] ?? TOPIC_STYLES.energy
        const timeAgo = relativeTime(article.published ?? '', article.age_hours ?? NaN)

        return (
          <div
            key={`${article.url ?? ''}-${idx}`}
            className="py-3 px-1 hover:bg-petro-card-hover transition-colors group"
          >
            <div className="flex items-start gap-3">
              {/* Topic chip */}
              <span
                className={`mt-0.5 shrink-0 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${style.classes}`}
              >
                {style.label}
              </span>

              {/* Content */}
              <div className="min-w-0 flex-1 space-y-1">
                <a
                  href={article.url ?? '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1 group/link"
                >
                  <span className="text-xs font-medium text-text-warm leading-snug group-hover/link:text-petro-teal transition-colors">
                    {article.title ?? '(untitled)'}
                  </span>
                  <ExternalLink
                    size={11}
                    className="shrink-0 mt-0.5 text-text-faint group-hover/link:text-petro-teal transition-colors"
                  />
                </a>

                <div className="flex items-center gap-2 font-mono text-[11px] text-text-muted">
                  <span className="font-bold text-text-faint uppercase truncate">
                    {article.source ?? 'Unknown'}
                  </span>
                  <span className="opacity-50">•</span>
                  <span className="opacity-70">{timeAgo}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
