import { useState, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, BarChart3, PieChart, Info } from 'lucide-react'
import DataFreshnessBadge from '../components/DataFreshnessBadge'
import StraitStatusBanner from '../components/StraitStatusBanner'
import MethodologyModal from '../components/MethodologyModal'
import { fetchOverview, fetchFlowEstimate } from '../api/client'

const OperationsTab = lazy(() => import('./tabs/OperationsTab'))
const MarketTab = lazy(() => import('./tabs/MarketTab'))
const AnalyticsTab = lazy(() => import('./tabs/AnalyticsTab'))

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-16 text-text-faint text-sm font-mono uppercase tracking-wide">
      <span className="animate-pulse">Loading…</span>
    </div>
  )
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'ops' | 'market' | 'analytics'>('ops')
  const [methodologyOpen, setMethodologyOpen] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: 60_000,
  })

  const { data: flowEstimate } = useQuery({
    queryKey: ['flowEstimate'],
    queryFn: fetchFlowEstimate,
    refetchInterval: 60_000,
  })

  const strait = data?.strait_status
  const prices = data?.oil_prices
  const stream = data?.ais_stream
  const baseline = data?.oil_flow
  const observedFlow = flowEstimate?.estimated_mbpd as number | undefined

  const isCached = strait?.source === 'cached'

  const getStatusLabel = () => {
    if (!stream) return 'Connecting'
    if (isCached) return `Cached (${strait?.cached_date})`
    if (stream.mode === 'mock') return 'Simulated Data'
    if (stream.connected) return 'AIS Live'
    return 'Reconnecting'
  }

  const getStatusColor = () => {
    if (!stream) return 'bg-petro-gold'
    if (isCached) return 'bg-petro-gold'
    if (stream.mode === 'mock') return 'bg-petro-gold'
    if (stream.connected) return 'bg-petro-teal animate-pulse'
    return 'bg-petro-red'
  }

  return (
    <div className="min-h-screen bg-petro-bg text-text-warm font-sans">
      {/* Data limitations banner */}
      <div className="bg-petro-card border-b border-petro-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-1.5 flex items-center gap-2">
          <span className="text-[11px] text-text-faint font-mono">
            <span className="text-text-muted font-bold uppercase">R&D PREVIEW</span>
            {' '}— Data streaming may take up to 15s to initialize. Enterprise configuration recommended for live trading decisions.
          </span>
        </div>
      </div>
      {/* Header — Solid deep petroleum, no blur */}
      <header className="border-b border-petro-border bg-petro-bg sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-wide text-text-warm leading-tight">
              HUMMUS TRACKER
            </h1>
            <p className="text-sm text-text-faint font-medium">Strait of Hormuz Intelligence</p>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            {/* Desktop: both prices */}
            {(prices?.brent_futures || prices?.brent) && (
              <div className="hidden sm:flex items-center gap-4 border-r border-petro-border pr-4 sm:pr-6">
                {prices?.brent_futures && (
                  <div className="flex flex-col items-end leading-none">
                    <div className="flex gap-2 text-sm font-mono">
                      <span className="text-text-muted font-bold">BZ=F</span>
                      <span className="text-petro-teal">${prices.brent_futures.toFixed(2)}</span>
                    </div>
                    <span className="text-[11px] uppercase font-bold mt-0.5 text-text-faint">
                      ICE Futures M1
                    </span>
                  </div>
                )}
                {prices?.brent && (
                  <div className="flex flex-col items-end leading-none border-l border-petro-border pl-4">
                    <div className="flex gap-2 text-sm font-mono">
                      <span className="text-text-muted font-bold">DCOILBRENTEU</span>
                      <span className={prices.is_stale ? 'text-petro-gold' : 'text-petro-teal'}>${prices.brent.toFixed(2)}</span>
                    </div>
                    <span className={`text-[11px] uppercase font-bold mt-0.5 ${prices.is_stale ? 'text-petro-gold' : 'text-text-faint'}`}>
                      {prices.brent_date} • FRED Spot
                    </span>
                  </div>
                )}
              </div>
            )}
            {/* Mobile: compact */}
            {(prices?.brent_futures || prices?.brent) && (
              <div className="sm:hidden flex items-center gap-2 font-mono text-sm border-r border-petro-border pr-4">
                <span className="text-text-muted font-bold">BRT</span>
                <span className="text-petro-teal font-bold">
                  ${(prices.brent_futures ?? prices.brent)?.toFixed(2)}
                </span>
              </div>
            )}

            <DataFreshnessBadge />

            <button
              onClick={() => setMethodologyOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-petro-teal transition-colors uppercase tracking-wide"
              title="Data & Methodology"
            >
              <Info size={14} />
              <span className="hidden sm:inline">Methodology</span>
            </button>

            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor()}`} />
              <span className="text-xs font-bold text-text-muted uppercase tracking-wide hidden sm:inline">
                {getStatusLabel()}
              </span>
            </div>
          </div>
        </div>
      </header>

      {stream?.mode === 'mock' && (
        <div className="bg-petro-red/10 border-b border-petro-red/30">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-petro-red shrink-0" />
            <p className="text-xs font-bold text-petro-red uppercase tracking-wide">
              SIMULATED MODE — Vessel positions, dark fleet, STS, floating storage, flow estimates & OPEC compliance are derived from mock AIS data
            </p>
          </div>
        </div>
      )}
      {stream?.mode === 'live' && (strait?.tankers_active ?? 0) < 5 && !isLoading && (
        <div className="bg-petro-gold/10 border-b border-petro-gold/30">
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-petro-gold shrink-0" />
            <p className="text-xs font-bold text-petro-gold uppercase tracking-wide">
              LIMITED AIS COVERAGE — {strait?.tankers_active ?? 0} tankers tracked vs ~50 expected. Vessel-derived analytics may be incomplete.
            </p>
          </div>
        </div>
      )}

      <StraitStatusBanner />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* KPI Row — Minimalist, no icons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          <KPICard label="Vessels Tracked" value={strait?.vessels_tracked ?? 0} loading={isLoading} />
          <KPICard label="Active Tankers" value={strait?.tankers_active ?? 0} loading={isLoading} />
          <KPICard label="Loaded (Out)" value={strait?.loaded_tankers ?? 0} loading={isLoading} />
          <KPICard label="Ballast (In)" value={strait?.ballast_tankers ?? 0} loading={isLoading} />
          <KPICard
            label="Flow (mbpd)"
            value={observedFlow !== undefined ? observedFlow.toFixed(1) : '—'}
            loading={isLoading}
            suffix=" mbpd"
            simulated={stream?.mode === 'mock'}
            sublabel={`vs ${(baseline?.eia_baseline_mbpd ?? 20.0).toFixed(1)} baseline`}
          />
          <KPICard
            label="DWT Throughput"
            value={strait?.total_dwt_outbound ? (strait.total_dwt_outbound / 1_000_000).toFixed(2) : 0}
            loading={isLoading}
            suffix="M"
            simulated={stream?.mode === 'mock'}
          />
          <KPICard label="I/O Ratio" value={strait?.inbound_outbound_ratio?.toFixed(2) ?? '1.00'} loading={isLoading} />
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-petro-card border border-petro-border rounded-lg w-full sm:w-fit">
          <TabButton
            active={activeTab === 'ops'}
            onClick={() => setActiveTab('ops')}
            icon={<LayoutDashboard size={14} />}
            label="OPERATIONS"
          />
          <TabButton
            active={activeTab === 'market'}
            onClick={() => setActiveTab('market')}
            icon={<BarChart3 size={14} />}
            label="MARKET"
          />
          <TabButton
            active={activeTab === 'analytics'}
            onClick={() => setActiveTab('analytics')}
            icon={<PieChart size={14} />}
            label="ANALYTICS"
          />
        </div>

        <Suspense fallback={<TabFallback />}>
          {activeTab === 'ops' && (
            <OperationsTab darkVesselCount={data?.strait_status?.dark_vessel_count ?? 0} />
          )}
          {activeTab === 'market' && <MarketTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
        </Suspense>

        <footer className="text-center py-8 border-t border-petro-border">
          <p className="text-xs text-text-muted font-bold uppercase tracking-wide">
            Syazwan Naim Research & Development
          </p>
          <p className="text-[11px] text-text-faint mt-1">
            Data: aisstream.io | IMF PortWatch | EIA | FRED | Open-Meteo
          </p>
        </footer>
      </main>
      <MethodologyModal open={methodologyOpen} onClose={() => setMethodologyOpen(false)} />
    </div>
  )
}

// ── Reusable components ─────────────────────────────────────────────────────

function TabButton({
  active, onClick, icon, label
}: {
  active: boolean, onClick: () => void, icon: React.ReactNode, label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center justify-center gap-2 px-3 sm:px-4 py-3 min-h-[44px] rounded text-xs font-bold transition-all tracking-wide flex-1 sm:flex-initial
        ${active
          ? 'bg-petro-border text-petro-teal shadow-none'
          : 'text-text-muted hover:text-text-warm hover:bg-petro-card-hover'}
      `}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function KPICard({
  label, value, loading, suffix = '', simulated = false, sublabel
}: {
  label: string
  value: number | string
  loading: boolean
  suffix?: string
  simulated?: boolean
  sublabel?: string
}) {
  return (
    <div className="bg-petro-card border border-petro-border rounded-lg px-4 py-4 relative">
      {simulated && (
        <span className="absolute top-2 right-2 bg-petro-gold/20 text-petro-gold text-[11px] font-bold px-1 rounded border border-petro-gold/30 uppercase">
          SIM
        </span>
      )}
      <p className="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">
        {label}
      </p>
      {loading ? (
        <p className="text-xs text-text-faint">Loading...</p>
      ) : (
        <>
          <p className="text-2xl font-mono font-bold text-text-warm leading-none">
            {typeof value === 'number' ? value.toLocaleString() : value}
            <span className="text-xs text-text-faint font-normal ml-1 lowercase">
              {suffix}
            </span>
          </p>
          {sublabel && (
            <p className="text-[11px] text-text-faint font-mono mt-1">{sublabel}</p>
          )}
        </>
      )}
    </div>
  )
}
