import { createContext, useContext, useMemo, useState } from 'react'

// Global dashboard inputs. Everything is client-side state over the already-
// served static snapshot data — no backend calls — so the scale-to-zero / $0
// cost model is preserved. Panels read these to filter/scope what they render.

export type TimeRange = '7d' | '30d' | '90d' | 'all'
export type VesselClass = 'all' | 'VLCC' | 'Suezmax' | 'Aframax' | 'LNG'

export interface FilterState {
  timeRange: TimeRange
  setTimeRange: (t: TimeRange) => void
  /** Days implied by timeRange (all => 365). Use to slice time-series data. */
  rangeDays: number

  search: string
  setSearch: (s: string) => void

  vesselClass: VesselClass
  setVesselClass: (c: VesselClass) => void
}

const RANGE_DAYS: Record<TimeRange, number> = { '7d': 7, '30d': 30, '90d': 90, all: 365 }

const FilterContext = createContext<FilterState | null>(null)

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [timeRange, setTimeRange] = useState<TimeRange>('90d')
  const [search, setSearch] = useState('')
  const [vesselClass, setVesselClass] = useState<VesselClass>('all')

  const value = useMemo<FilterState>(() => ({
    timeRange,
    setTimeRange,
    rangeDays: RANGE_DAYS[timeRange],
    search,
    setSearch,
    vesselClass,
    setVesselClass,
  }), [timeRange, search, vesselClass])

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

/** Read global filters. Safe to call outside a provider — returns inert defaults. */
export function useFilters(): FilterState {
  const ctx = useContext(FilterContext)
  if (ctx) return ctx
  return {
    timeRange: '90d', setTimeRange: () => {}, rangeDays: 90,
    search: '', setSearch: () => {},
    vesselClass: 'all', setVesselClass: () => {},
  }
}

/** Helper: does a vessel match the current search + class filter? */
export function vesselMatches(
  v: { name?: string | null; mmsi?: string | null; flag?: string | null; destination?: string | null; vessel_class?: string | null },
  search: string,
  vesselClass: VesselClass,
): boolean {
  if (vesselClass !== 'all' && (v.vessel_class || '') !== vesselClass) return false
  const q = search.trim().toLowerCase()
  if (!q) return true
  return [v.name, v.mmsi, v.flag, v.destination]
    .filter(Boolean)
    .some((s) => String(s).toLowerCase().includes(q))
}
