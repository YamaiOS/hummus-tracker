import { useQuery } from '@tanstack/react-query'
import { fetchLatestBrief } from '../api/client'

export default function IntelligenceBriefPanel() {
  const { data: brief, isLoading } = useQuery({
    queryKey: ['latestBrief'],
    queryFn: fetchLatestBrief,
    refetchInterval: 3600_000,
  })

  if (isLoading && !brief) {
    return (
      <div className="h-32 flex items-center justify-center">
        <span className="text-xs text-text-muted uppercase font-bold tracking-wide">Generating Brief...</span>
      </div>
    )
  }

  if (!brief) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-text-faint uppercase font-bold tracking-wide">No brief available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <span className="text-[11px] font-bold text-text-faint uppercase tracking-wide">DATE: {brief.date}</span>
        <button className="text-[11px] font-bold text-petro-teal hover:text-text-warm transition-colors uppercase tracking-tight">
          EXPORT RAW (TXT)
        </button>
      </div>

      <div className="p-4 bg-petro-bg border border-petro-border rounded overflow-x-auto">
        <div className="whitespace-pre-wrap font-mono text-xs sm:text-[13px] text-text-warm leading-relaxed break-words max-w-full">
          {brief.content_markdown}
        </div>
      </div>
    </div>
  )
}
