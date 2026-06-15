const TIER_STYLES: Record<string, { bg: string; text: string; border: string; tooltip: string }> = {
  LIVE: {
    bg: 'bg-petro-teal/15',
    text: 'text-petro-teal',
    border: 'border border-petro-teal/40',
    tooltip: 'Live real-time/near-real-time data from a primary source',
  },
  EST: {
    bg: 'bg-petro-gold/15',
    text: 'text-petro-gold',
    border: 'border border-petro-gold/40',
    tooltip: 'Estimated / seeded / modeled',
  },
  SIM: {
    bg: 'bg-petro-red/15',
    text: 'text-petro-red',
    border: 'border border-petro-red/40',
    tooltip: 'Simulated (AIS feed unavailable)',
  },
}

export default function Panel({
  title, subtitle, children, footer, tier
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: string
  tier?: 'LIVE' | 'EST' | 'SIM'
}) {
  const tierStyle = tier ? TIER_STYLES[tier] : null
  return (
    <div className="bg-petro-card border border-petro-border rounded-lg overflow-hidden shadow-none flex flex-col h-full">
      <div className="px-4 py-3 border-b border-petro-border flex-shrink-0">
        <div className="flex items-center justify-between leading-none mb-1">
          <h2 className="text-[15px] font-semibold text-text-warm uppercase tracking-wide">
            {title}
          </h2>
          {tierStyle && (
            <span
              className={`text-[10px] font-bold rounded px-1.5 py-0.5 ${tierStyle.bg} ${tierStyle.text} ${tierStyle.border}`}
              title={tierStyle.tooltip}
            >
              {tier}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-text-muted font-medium truncate">
            {subtitle}
          </p>
        )}
      </div>
      <div className="p-4 flex-grow">
        {children}
      </div>
      {footer && (
        <div className="px-4 py-2 border-t border-petro-border bg-petro-bg/30 text-[11px] font-mono text-text-faint uppercase">
          {footer}
        </div>
      )}
    </div>
  )
}
