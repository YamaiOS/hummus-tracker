export default function Panel({
  title, subtitle, children, footer
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: string
}) {
  return (
    <div className="bg-petro-card border border-petro-border rounded-lg overflow-hidden shadow-none flex flex-col h-full">
      <div className="px-4 py-3 border-b border-petro-border flex-shrink-0">
        <h2 className="text-[15px] font-semibold text-text-warm leading-none mb-1 uppercase tracking-wide">
          {title}
        </h2>
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
