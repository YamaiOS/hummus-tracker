interface Exporter {
  country: string
  mbpd: number
}

const FLAG_MAP: Record<string, string> = {
  'Saudi Arabia': '🇸🇦',
  'Iraq': '🇮🇶',
  'UAE': '🇦🇪',
  'Kuwait': '🇰🇼',
  'Qatar': '🇶🇦',
  'Iran': '🇮🇷',
  'Bahrain': '🇧🇭',
}

const BAR_COLORS = [
  'bg-amber-500',
  'bg-emerald-500',
  'bg-blue-500',
  'bg-violet-500',
  'bg-cyan-500',
  'bg-rose-500',
  'bg-slate-500',
]

export default function ExporterBreakdown({ exporters }: { exporters: Exporter[] }) {
  if (exporters.length === 0) {
    return <p className="text-sm text-slate-500 text-center py-4">No exporter data</p>
  }

  const total = exporters.reduce((sum, e) => sum + e.mbpd, 0)

  return (
    <div className="space-y-2.5">
      {exporters.map((exp, i) => {
        const pct = total > 0 ? (exp.mbpd / total) * 100 : 0
        const flag = FLAG_MAP[exp.country] ?? ''
        const barColor = BAR_COLORS[i % BAR_COLORS.length]

        return (
          <div key={exp.country}>
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5">
                {flag && <span className="text-sm">{flag}</span>}
                <span className="text-xs text-slate-300">{exp.country}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-200">{exp.mbpd.toFixed(1)}</span>
                <span className="text-[10px] text-slate-500 w-10 text-right">{pct.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}

      <div className="border-t border-slate-800 pt-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 uppercase">Total via Hormuz</span>
        <span className="text-xs font-bold text-slate-200">{total.toFixed(1)} mbpd</span>
      </div>
    </div>
  )
}
