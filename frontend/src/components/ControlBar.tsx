import { RefreshCw, Search, X } from 'lucide-react'
import { useFilters } from '../context/FilterContext'
import type { TimeRange, VesselClass } from '../context/FilterContext'

const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: 'ALL', value: 'all' },
]

const VESSEL_CLASSES: { label: string; value: VesselClass }[] = [
  { label: 'All', value: 'all' },
  { label: 'VLCC', value: 'VLCC' },
  { label: 'Suezmax', value: 'Suezmax' },
  { label: 'Aframax', value: 'Aframax' },
  { label: 'LNG', value: 'LNG' },
]

export default function ControlBar() {
  const { timeRange, setTimeRange, search, setSearch, vesselClass, setVesselClass } = useFilters()

  return (
    <div className="border border-petro-border rounded-lg bg-petro-card">
      <div className="px-4 py-2 flex flex-wrap items-center gap-3">

        {/* Time-range segmented control */}
        <div className="flex items-center gap-0.5 bg-petro-border/30 rounded p-0.5 shrink-0">
          {TIME_RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setTimeRange(value)}
              className={[
                'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded transition-colors duration-150',
                timeRange === value
                  ? 'bg-petro-gold text-petro-bg'
                  : 'text-text-muted hover:text-text-warm',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Vessel search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-faint pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vessel, MMSI, flag, destination…"
            className="w-full bg-petro-border/20 border border-petro-border rounded pl-8 pr-7 py-1 text-[11px] text-text-warm placeholder:text-text-faint focus:outline-none focus:border-petro-gold/60 transition-colors duration-150"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-warm transition-colors duration-150"
              aria-label="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Vessel class segmented control */}
        <div className="flex items-center gap-0.5 bg-petro-border/30 rounded p-0.5 shrink-0">
          {VESSEL_CLASSES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setVesselClass(value)}
              className={[
                'px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded transition-colors duration-150',
                vesselClass === value
                  ? 'bg-petro-gold/20 text-petro-gold border border-petro-gold/40'
                  : 'text-text-muted hover:text-text-warm border border-transparent',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1 hidden sm:block" />

        {/* Hourly refresh pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-petro-border/60 bg-petro-border/10 text-text-faint shrink-0">
          <RefreshCw className="w-3 h-3" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Hourly Refresh</span>
        </div>

      </div>
    </div>
  )
}
