import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { fetchChokepoints, fetchIMFTransits } from '../api/client'

const HORMUZ_ID = 'hormuz'

function pctColor(pct: number | null | undefined): string {
  if (pct == null) return 'text-text-warm'
  if (pct < 40) return 'text-petro-red'
  if (pct < 70) return 'text-petro-gold'
  return 'text-petro-teal'
}

function statusFromPct(pct: number | null | undefined): { label: string; cls: string } {
  if (pct == null) return { label: 'NO DATA', cls: 'bg-petro-border/40 text-text-muted border-petro-border' }
  if (pct < 40) return { label: 'CRITICAL', cls: 'bg-petro-red/15 text-petro-red border border-petro-red/40' }
  if (pct < 70) return { label: 'DISRUPTION WATCH', cls: 'bg-petro-gold/15 text-petro-gold border border-petro-gold/40' }
  return { label: 'NORMAL', cls: 'bg-petro-teal/15 text-petro-teal border border-petro-teal/40' }
}

export default function TransitMonitor() {
  const chokeQ = useQuery({
    queryKey: ['chokepoints'],
    queryFn: fetchChokepoints,
    refetchInterval: 300_000,
  })

  const transitQ = useQuery({
    queryKey: ['imfTransits', 60],
    queryFn: () => fetchIMFTransits(60),
    refetchInterval: 300_000,
  })

  const hormuz = useMemo(() => {
    const list = chokeQ.data?.chokepoints || []
    return (
      list.find(c => c?.id === HORMUZ_ID) ||
      list.find(c => /hormuz/i.test(c?.name || '')) ||
      null
    )
  }, [chokeQ.data])

  const transits = useMemo(() => {
    const raw = transitQ.data?.transits || []
    if (!Array.isArray(raw)) return []
    return raw
      .filter(t => t && t.date != null)
      .slice(-60)
  }, [transitQ.data])

  const baseline = hormuz?.baseline_total_30d ?? null

  const tankerBaseline = useMemo(() => {
    if (!transits.length) return null
    const vals = transits
      .map(t => (typeof t.tanker_transits === 'number' ? t.tanker_transits : null))
      .filter((v): v is number => v != null)
    if (!vals.length) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
  }, [transits])

  const chartData = useMemo(
    () =>
      transits.map(t => ({
        date: (() => {
          try {
            return new Date(t.date).toLocaleDateString([], { month: 'short', day: 'numeric' })
          } catch {
            return String(t.date)
          }
        })(),
        tankers: typeof t.tanker_transits === 'number' ? t.tanker_transits : null,
      })),
    [transits],
  )

  const isLoading = chokeQ.isLoading || transitQ.isLoading
  const pct = hormuz?.pct_of_baseline ?? null
  const status = statusFromPct(pct)

  if (isLoading) {
    return (
      <div className="h-72 flex items-center justify-center">
        <span className="text-xs text-text-muted">Loading transit data...</span>
      </div>
    )
  }

  if (!hormuz && chartData.length < 2) {
    return (
      <div className="py-10 text-center">
        <p className="text-xs text-text-faint uppercase font-bold tracking-wide">Transit data unavailable</p>
        <p className="text-xs text-text-faint mt-1">Backfilling from IMF PortWatch — check back shortly</p>
      </div>
    )
  }

  const latestTanker = hormuz?.latest_tanker ?? null
  const latestTotal = hormuz?.latest_total ?? null

  return (
    <div className="space-y-4">
      {/* Headline stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-petro-bg rounded-md p-3 border border-petro-border">
          <div className="text-2xl font-bold font-mono text-text-warm">
            {latestTanker != null ? latestTanker.toLocaleString() : '—'}
          </div>
          <div className="text-[11px] text-text-faint uppercase font-bold tracking-wide mt-0.5">Tanker transits</div>
        </div>
        <div className="bg-petro-bg rounded-md p-3 border border-petro-border">
          <div className="text-2xl font-bold font-mono text-text-warm">
            {latestTotal != null ? latestTotal.toLocaleString() : '—'}
          </div>
          <div className="text-[11px] text-text-faint uppercase font-bold tracking-wide mt-0.5">Total transits</div>
        </div>
        <div className="bg-petro-bg rounded-md p-3 border border-petro-border">
          <div className={`text-2xl font-bold font-mono ${pctColor(pct)}`}>
            {pct != null ? `${pct.toFixed(0)}%` : '—'}
          </div>
          <div className="text-[11px] text-text-faint uppercase font-bold tracking-wide mt-0.5">vs 30-day baseline</div>
        </div>
        <div className="bg-petro-bg rounded-md p-3 border border-petro-border flex flex-col justify-center">
          <span className={`inline-block text-[11px] font-bold rounded px-2 py-1 text-center ${status.cls}`}>
            {status.label}
          </span>
          <div className="text-[11px] text-text-faint uppercase font-bold tracking-wide mt-1.5">Strait status</div>
        </div>
      </div>

      {/* Daily tanker transit trend */}
      {chartData.length >= 2 ? (
        <div className="h-56 w-full bg-petro-bg rounded-md p-2 border border-petro-border">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorTransit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00a19c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00a19c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1c2e4a" vertical={false} />
              <XAxis dataKey="date" stroke="#566b8a" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis stroke="#566b8a" fontSize={11} tickLine={false} axisLine={false} domain={[0, 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f1d32', border: '1px solid #1c2e4a', fontSize: '11px', borderRadius: '4px' }}
                formatter={(value: number) => [`${value} transits`, 'Tankers']}
              />
              {tankerBaseline != null && (
                <ReferenceLine
                  y={tankerBaseline}
                  stroke="#c4a35a"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                  label={{ value: 'Baseline', position: 'right', fill: '#c4a35a', fontSize: 10 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="tankers"
                stroke="#00a19c"
                fillOpacity={1}
                fill="url(#colorTransit)"
                strokeWidth={2}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="text-xs text-text-faint uppercase font-bold tracking-wide">Insufficient daily history</p>
        </div>
      )}

      <p className="text-[11px] text-text-faint">
        Source: IMF PortWatch (satellite AIS aggregate) — real, daily
      </p>
    </div>
  )
}
