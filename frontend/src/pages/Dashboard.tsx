import { useQuery } from '@tanstack/react-query'
import { Ship, Droplets, TrendingUp, AlertTriangle, Activity, Anchor, Fuel, Globe } from 'lucide-react'
import VesselMap from '../components/VesselMap'
import PriceChart from '../components/PriceChart'
import TransitChart from '../components/TransitChart'
import DisruptionTimeline from '../components/DisruptionTimeline'
import VesselTable from '../components/VesselTable'
import SupplyChainImpact from '../components/SupplyChainImpact'
import VolumeByFlag from '../components/VolumeByFlag'
import FreightRates from '../components/FreightRates'
import { fetchOverview } from '../api/client'

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: 60_000,
  })

  const strait = data?.strait_status
  const prices = data?.oil_prices
  const stream = data?.ais_stream
  const imf = data?.imf_portwatch
  const baseline = data?.oil_flow

  const getStatusLabel = () => {
    if (!stream) return 'Connecting...'
    if (stream.mode === 'mock') return 'Simulated Data'
    if (stream.connected) return 'AIS Live'
    return 'Reconnecting...'
  }

  const getStatusColor = () => {
    if (!stream) return 'bg-slate-500'
    if (stream.mode === 'mock') return 'bg-blue-400'
    if (stream.connected) return 'bg-emerald-400 animate-pulse'
    return 'bg-red-400'
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-950/50 border border-amber-800/40 rounded-lg">
              <Ship size={22} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                Hummus Tracker
              </h1>
              <p className="text-[11px] text-slate-500">Strait of Hormuz — Oil Tanker Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {prices?.brent && (
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase">Brent Spot</p>
                <p className="text-sm font-bold text-amber-400">${prices.brent.toFixed(2)}</p>
              </div>
            )}
            {prices?.wti && (
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase">WTI Spot</p>
                <p className="text-sm font-bold text-emerald-400">${prices.wti.toFixed(2)}</p>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full">
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor()}`} />
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                {getStatusLabel()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <KPICard
            icon={<Ship size={16} />}
            label="Vessels Tracked"
            value={strait?.vessels_tracked ?? 0}
            color="blue"
            loading={isLoading}
          />
          <KPICard
            icon={<Fuel size={16} />}
            label="Active Tankers"
            value={strait?.tankers_active ?? 0}
            color="amber"
            loading={isLoading}
          />
          <KPICard
            icon={<Anchor size={16} />}
            label="Loaded (Outbound)"
            value={strait?.loaded_tankers ?? 0}
            color="emerald"
            loading={isLoading}
          />
          <KPICard
            icon={<Globe size={16} />}
            label="Ballast (Inbound)"
            value={strait?.ballast_tankers ?? 0}
            color="slate"
            loading={isLoading}
          />
          <KPICard
            icon={<Droplets size={16} />}
            label="Baseline (mbpd)"
            value={baseline?.eia_baseline_mbpd ?? 20.0}
            color="cyan"
            loading={isLoading}
            suffix=" mbpd"
          />
          <KPICard
            icon={<Activity size={16} />}
            label="AIS Messages"
            value={stream?.total_messages ?? 0}
            color="violet"
            loading={isLoading}
          />
        </div>

        {/* Map + Flow Meter */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <Panel title="Live Vessel Map" subtitle="Strait of Hormuz — AIS positions">
              <VesselMap />
            </Panel>
          </div>
          <div className="space-y-4">
            <Panel title="Supply Chain Impact" subtitle="Economic friction and routing risk">
              <SupplyChainImpact />
            </Panel>
            <Panel title="Volume by Vessel Flag" subtitle="Selective transit intelligence">
              <VolumeByFlag />
            </Panel>
            <Panel title="Est. Freight Charges" subtitle="Heuristic tanker day rates & WS">
              <FreightRates />
            </Panel>
          </div>
        </div>

        {/* Live Tracking Table */}
        <Panel title="Vessels Currently in Transit" subtitle="Detailed AIS telemetry for tankers and LNG carriers">
          <VesselTable />
        </Panel>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Panel title="Brent Crude vs Transit Volume" subtitle="Price-flow correlation analysis">
            <PriceChart />
          </Panel>
          <Panel title="IMF PortWatch — Daily Transits" subtitle="Satellite AIS transit counts">
            <TransitChart />
          </Panel>
        </div>

        {/* Disruption Timeline */}
        <Panel title="Disruption Timeline" subtitle="Historical incidents affecting Hormuz oil flow">
          <DisruptionTimeline />
        </Panel>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-slate-800">
          <p className="text-xs text-slate-600">
            Data: aisstream.io (AIS) | IMF PortWatch (satellite) | EIA (oil flow) | FRED (prices)
          </p>
          <p className="text-[10px] text-slate-700 mt-1">
            Built for fundamental analysis — Strait of Hormuz handles ~20% of global seaborne oil
          </p>
        </footer>
      </main>
    </div>
  )
}

// ── Reusable components ─────────────────────────────────────────────────────

function KPICard({
  icon, label, value, color, loading, suffix = '',
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  color: string
  loading: boolean
  suffix?: string
}) {
  const colors: Record<string, string> = {
    blue: 'text-blue-400 bg-blue-950/40 border-blue-800/30',
    amber: 'text-amber-400 bg-amber-950/40 border-amber-800/30',
    emerald: 'text-emerald-400 bg-emerald-950/40 border-emerald-800/30',
    slate: 'text-slate-400 bg-slate-800/40 border-slate-700/30',
    cyan: 'text-cyan-400 bg-cyan-950/40 border-cyan-800/30',
    violet: 'text-violet-400 bg-violet-950/40 border-violet-800/30',
  }
  const c = colors[color] || colors.slate

  return (
    <div className={`rounded-lg border px-3 py-3 ${c}`}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wide opacity-70">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 bg-slate-800/50 rounded animate-pulse" />
      ) : (
        <p className="text-xl font-bold">
          {typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </p>
      )}
    </div>
  )
}

function Panel({
  title, subtitle, children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800/50">
        <h2 className="text-sm font-semibold text-slate-200">{title}</h2>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
