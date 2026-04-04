interface Exporter {
  country: string
  mbpd: number
}

const FLAG_MAP: Record<string, string> = {
  'Saudi Arabia': '\u{1F1F8}\u{1F1E6}',
  'Iraq': '\u{1F1EE}\u{1F1F6}',
  'UAE': '\u{1F1E6}\u{1F1EA}',
  'Kuwait': '\u{1F1F0}\u{1F1FC}',
  'Qatar': '\u{1F1F6}\u{1F1E6}',
  'Iran': '\u{1F1EE}\u{1F1F7}',
  'Bahrain': '\u{1F1E7}\u{1F1ED}',
}

export default function ExporterBreakdown({ exporters }: { exporters: Exporter[] }) {
  if (exporters.length === 0) {
    return <p className="text-sm text-text-faint text-center py-4">No exporter data</p>
  }

  const total = exporters.reduce((sum, e) => sum + e.mbpd, 0)

  return (
    <div className="space-y-2.5">
      {exporters.map((exp, i) => {
        const pct = total > 0 ? (exp.mbpd / total) * 100 : 0
        const flag = FLAG_MAP[exp.country] ?? ''

        return (
          <div key={exp.country}>
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-1.5">
                {flag && <span className="text-sm">{flag}</span>}
                <span className="text-xs text-text-warm">{exp.country}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-text-warm">{exp.mbpd.toFixed(1)}</span>
                <span className="text-xs text-text-faint w-10 text-right">{pct.toFixed(0)}%</span>
              </div>
            </div>
            <div className="h-1.5 bg-petro-border rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-petro-teal"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )
      })}

      <div className="border-t border-petro-border pt-2 flex items-center justify-between">
        <span className="text-xs text-text-faint uppercase font-bold tracking-wide">Total via Hormuz</span>
        <span className="text-xs font-mono font-bold text-text-warm">{total.toFixed(1)} mbpd</span>
      </div>
    </div>
  )
}
