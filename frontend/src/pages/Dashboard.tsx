import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, BarChart3, PieChart } from 'lucide-react'
import VesselMap from '../components/VesselMap'
import PriceChart from '../components/PriceChart'
import TransitChart from '../components/TransitChart'
import DisruptionTimeline from '../components/DisruptionTimeline'
import VesselTable from '../components/VesselTable'
import SupplyChainImpact from '../components/SupplyChainImpact'
import VolumeByFlag from '../components/VolumeByFlag'
import FreightRates from '../components/FreightRates'
import MarketMetricsPanel from '../components/MarketMetricsPanel'
import FloatingStoragePanel from '../components/FloatingStoragePanel'
import DarkVesselPanel from '../components/DarkVesselPanel'
import STSEventsPanel from '../components/STSEventsPanel'
import FujairahInventoryPanel from '../components/FujairahInventoryPanel'
import OPECCompliancePanel from '../components/OPECCompliancePanel'
import PortCongestionPanel from '../components/PortCongestionPanel'
import StraitStatusBanner from '../components/StraitStatusBanner'
import ActivityFeed from '../components/ActivityFeed'
import IntelligenceBriefPanel from '../components/IntelligenceBriefPanel'
import CrudeMixPanel from '../components/CrudeMixPanel'
import TonMilePanel from '../components/TonMilePanel'
import BunkerPricesPanel from '../components/BunkerPricesPanel'
import WeatherAlertsPanel from '../components/WeatherAlertsPanel'
import { fetchOverview } from '../api/client'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'ops' | 'market' | 'analytics'>('ops')
  const { data, isLoading } = useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: 60_000,
  })

  const strait = data?.strait_status
  const prices = data?.oil_prices
  const stream = data?.ais_stream
  const baseline = data?.oil_flow

  const getStatusLabel = () => {
    if (!stream) return 'Connecting'
    if (stream.mode === 'mock') return 'Simulated Data'
    if (stream.connected) return 'AIS Live'
    return 'Reconnecting'
  }

  const getStatusColor = () => {
    if (!stream) return 'bg-petro-gold'
    if (stream.mode === 'mock') return 'bg-petro-gold'
    if (stream.connected) return 'bg-petro-teal animate-pulse'
    return 'bg-petro-red'
  }

  return (
    <div className="min-h-screen bg-petro-bg text-text-warm font-sans">
      {/* Header — Solid deep petroleum, no blur */}
      <header className="border-b border-petro-border bg-petro-bg sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold tracking-wide text-text-warm leading-tight">
              HUMMUS TRACKER
            </h1>
            <p className="text-sm text-text-faint font-medium">Strait of Hormuz Intelligence</p>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-4 border-r border-petro-border pr-6">
              {prices?.brent && (
                <div className="flex gap-2 text-sm font-mono leading-none">
                  <span className="text-text-muted font-bold">BRENT</span>
                  <span className="text-petro-teal">${prices.brent.toFixed(2)}</span>
                </div>
              )}
              {prices?.wti && (
                <div className="flex gap-2 text-sm font-mono leading-none">
                  <span className="text-text-muted font-bold">WTI</span>
                  <span className="text-petro-teal">${prices.wti.toFixed(2)}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full ${getStatusColor()}`} />
              <span className="text-xs font-bold text-text-muted uppercase tracking-wide">
                {getStatusLabel()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <StraitStatusBanner />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* KPI Row — Minimalist, no icons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          <KPICard label="Vessels Tracked" value={strait?.vessels_tracked ?? 0} loading={isLoading} />
          <KPICard label="Active Tankers" value={strait?.tankers_active ?? 0} loading={isLoading} />
          <KPICard label="Loaded (Out)" value={strait?.loaded_tankers ?? 0} loading={isLoading} />
          <KPICard label="Ballast (In)" value={strait?.ballast_tankers ?? 0} loading={isLoading} />
          <KPICard label="Flow (mbpd)" value={baseline?.eia_baseline_mbpd ?? 20.0} loading={isLoading} suffix=" mbpd" />
          <KPICard label="DWT Throughput" value={strait?.total_dwt_outbound ? (strait.total_dwt_outbound / 1_000_000).toFixed(2) : 0} loading={isLoading} suffix="M" />
          <KPICard label="I/O Ratio" value={strait?.inbound_outbound_ratio?.toFixed(2) ?? '1.00'} loading={isLoading} />
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-petro-card border border-petro-border rounded-lg w-fit">
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

        {/* Operations Tab */}
        {activeTab === 'ops' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Panel title="Live Vessel Map" subtitle="Real-time AIS positions & maritime lanes">
                  <VesselMap />
                </Panel>
              </div>
              <div className="space-y-4">
                <Panel title="Recent Activity" subtitle="Intelligence feed & anomaly log">
                  <ActivityFeed />
                </Panel>
                <Panel title="Shamal Wind Alerts" subtitle="Terminal weather conditions">
                  <WeatherAlertsPanel />
                </Panel>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Panel title="AIS Dark Vessels" subtitle={`${data?.strait_status?.loaded_tankers || 0} active`}>
                <DarkVesselPanel />
              </Panel>
              <Panel title="STS Transfer Alerts" subtitle="Suspicious tanker proximity">
                <STSEventsPanel />
              </Panel>
              <Panel title="Floating Storage" subtitle="Stationary loaded tonnage">
                <FloatingStoragePanel />
              </Panel>
              <Panel title="Freight Rate Modeling" subtitle="Heuristic day rates MEG-Asia">
                <FreightRates />
              </Panel>
            </div>

            <Panel title="Tracking Registry" subtitle="Detailed tanker and LNG carrier telemetry">
              <VesselTable />
            </Panel>
          </div>
        )}

        {/* Market Tab */}
        {activeTab === 'market' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Panel title="Brent-Dubai Spread" subtitle="90-day EFS history & market structure">
                  <MarketMetricsPanel />
                </Panel>
              </div>
              <div className="space-y-4">
                <Panel title="Fujairah Inventory" subtitle="Weekly stock levels ('000 bbl)">
                  <FujairahInventoryPanel />
                </Panel>
                <Panel title="OPEC+ Compliance" subtitle="Quota vs observed exports (7-day)">
                  <OPECCompliancePanel />
                </Panel>
                <Panel title="Inferred Crude Mix" subtitle="Grade distribution by loading port">
                  <CrudeMixPanel />
                </Panel>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Panel title="Brent Crude" subtitle="Daily settlement history (FRED)">
                <PriceChart />
              </Panel>
              <Panel title="Bunker Market" subtitle="Fujairah VLSFO & HSFO rates">
                <BunkerPricesPanel />
              </Panel>
              <Panel title="Supply Chain Risk" subtitle="Insurance & routing friction">
                <SupplyChainImpact />
              </Panel>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Panel title="Satellite Transits" subtitle="IMF PortWatch — Daily volume trends">
                  <TransitChart />
                </Panel>
              </div>
              <div className="space-y-4">
                <Panel title="Volume by Flag" subtitle="Selective transit intelligence">
                  <VolumeByFlag />
                </Panel>
                <Panel title="Ton-Mile Index" subtitle="Shipping demand & freight pressure">
                  <TonMilePanel />
                </Panel>
                <Panel title="Terminal Waiting Times" subtitle="Avg hours from BBox entry to arrival">
                  <PortCongestionPanel />
                </Panel>
              </div>
            </div>
            <Panel title="Disruption Timeline" subtitle="Historical Strait of Hormuz incidents">
              <DisruptionTimeline />
            </Panel>
            <Panel title="Morning Brief" subtitle="Daily automated intelligence summary">
              <IntelligenceBriefPanel />
            </Panel>
          </div>
        )}

        <footer className="text-center py-8 border-t border-petro-border">
          <p className="text-xs text-text-muted font-bold uppercase tracking-wide">
            Syazwan Naim Research & Development
          </p>
          <p className="text-[11px] text-text-faint mt-1">
            Data: aisstream.io | IMF PortWatch | EIA | FRED | Open-Meteo
          </p>
        </footer>
      </main>
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
        flex items-center gap-2 px-4 py-2 rounded text-xs font-bold transition-all tracking-wide
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
  label, value, loading, suffix = '',
}: {
  label: string
  value: number | string
  loading: boolean
  suffix?: string
}) {
  return (
    <div className="bg-petro-card border border-petro-border rounded-lg px-4 py-4">
      <p className="text-xs font-bold text-text-muted uppercase tracking-wide mb-1">
        {label}
      </p>
      {loading ? (
        <p className="text-xs text-text-faint">Loading...</p>
      ) : (
        <p className="text-2xl font-mono font-bold text-text-warm leading-none">
          {typeof value === 'number' ? value.toLocaleString() : value}
          <span className="text-xs text-text-faint font-normal ml-1 lowercase">
            {suffix}
          </span>
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
    </div>
  )
}
