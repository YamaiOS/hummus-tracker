import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  timeout: 30_000,
})

export default api

// ── Types ────────────────────────────────────────────────────────────────────

export interface Vessel {
  mmsi: string
  imo?: string
  name?: string
  vessel_type?: number
  vessel_class?: string
  lat: number
  lon: number
  speed?: number
  course?: number
  draught?: number
  destination?: string
  is_loaded?: boolean
  estimated_barrels?: number
  crude_grade?: string
  direction?: string
  flag?: string
  observed_at: string
  dwell_hours?: number
}

export interface LiveVesselsResponse {
  vessels: Vessel[]
  tanker_count: number
  total_count: number
  loaded_count: number
  ballast_count: number
  stream_status: {
    connected: boolean
    last_message: string | null
    total_messages: number
    active_vessels: number
  }
}

export interface OilPrice {
  date: string
  brent?: number
  wti?: number
}

export interface DisruptionEvent {
  date: string
  title: string
  description: string
  severity: string
  category?: string
  latitude?: number
  longitude?: number
  brent_impact_pct: number
  source: string
}

export interface OverviewResponse {
  strait_status: {
    vessels_tracked: number
    tankers_active: number
    loaded_tankers: number
    ballast_tankers: number
    total_dwt_outbound: number
    inbound_outbound_ratio: number
  }
  oil_flow: {
    eia_baseline_mbpd: number
    key_exporters: Array<{ country: string; mbpd: number }>
  }
  imf_portwatch: Record<string, any>
  oil_prices: { brent?: number; wti?: number }
  ais_stream: {
    connected: boolean
    total_messages: number
    active_vessels: number
    mode?: string
  }
}

export interface IMFTransit {
  date: string
  total_transits: number
  tanker_transits: number
  bulk_transits: number
  container_transits: number
  trade_value_usd: number
}

export interface SelectiveTransit {
  flag: string
  vessels: number
  barrels: number
}

export interface ImpactResponse {
  war_risk_multiplier: number
  insurance_status: string
  bypass_analysis: {
    route: string
    extra_days: number
    extra_cost_per_vlcc_usd: number
    total_extra_fuel_tons: number
  }
  selective_transits: SelectiveTransit[]
  global_economic_loss_est_usd_day: number
}

export interface FreightEstimate {
  class: string
  route: string
  ws_points: number
  tce_day_rate_usd: number
  status: string
}

export interface FreightResponse {
  date: string
  market_sentiment: string
  brent_ref: number
  risk_multiplier: number
  estimates: FreightEstimate[]
}

export interface MarketMetrics {
  date: string
  brent_m1: number
  brent_m2: number
  brent_m6: number
  dubai_m1: number
  dubai_m2: number
  dubai_m6: number
  brent_dubai_efs: number
  brent_m1_m2: number
  brent_m1_m6: number
  dubai_m1_m2: number
}

export interface FloatingStorageVessel {
  mmsi: string
  vessel_name: string
  vessel_class: string
  latitude: number
  longitude: number
  duration_hrs: number
  estimated_barrels: number
  last_observed_at: string
  is_active: boolean
}

export interface DarkVessel {
  mmsi: string
  vessel_name: string
  vessel_class: string
  last_lat: number
  last_lon: number
  last_speed: number
  last_course: number
  is_loaded: boolean
  last_observed_at: string
  detected_at: string
  is_active: boolean
}

export interface STSEvent {
  id: number
  vessel_a_mmsi: string
  vessel_a_name: string
  vessel_b_mmsi: string
  vessel_b_name: string
  latitude: number
  longitude: number
  distance_m: number
  detected_at: string
  is_active: boolean
}

export interface FujairahInventory {
  date: string
  light_distillates: number
  middle_distillates: number
  heavy_distillates_residues: number
  total_inventory: number
}

export interface ActivityEvent {
  id: number
  timestamp: string
  event_type: string
  severity: 'info' | 'warning' | 'critical'
  message: string
  metadata_json?: string
}

export interface EFSHistoryItem {
  date: string
  brent_m1: number
  dubai_m1: number
  efs: number
}

export interface BunkerPrice {
  date: string
  vlsfo_price: number
  hsfo_price: number
  spread: number
}

export interface TerminalWeather {
  terminal_name: string
  latitude: number
  longitude: number
  wind_speed_knots: number
  wind_gusts_knots: number
  wave_height_m?: number
  is_alert_active: boolean
  updated_at: string
}

export interface IntelligenceBrief {
  date: string
  content_markdown: string
  created_at: string
}

export interface StraitStatus {
  level: 'green' | 'amber' | 'red'
  score: number
  summary: string
  timestamp: string
}

export interface PortCongestion {
  terminal_name: string
  avg_wait_hrs: number
  vessel_count: number
  date: string
}

export interface ComplianceRecord {
  country: string
  quota_mbpd: number
  observed_mbpd: number
  delta: number
  compliance_pct: number
  is_exempt: boolean
}

export interface FloatingStorageResponse {
  vessels: FloatingStorageVessel[]
  summary: {
    date: string
    vessel_count: number
    total_barrels: number
  } | null
  count: number
  total_barrels: number
}

export interface InsuranceStatus {
  jwc_status: string
  is_listed_area: boolean
  premium_bps: number
  baseline_bps: number
  multiplier: number
}

// ── API calls ────────────────────────────────────────────────────────────────

export const fetchOverview = () =>
  api.get<OverviewResponse>('/overview').then(r => r.data)

export const fetchStraitStatus = () =>
  api.get<StraitStatus>('/status').then(r => r.data)

export const fetchActivity = (limit = 50) =>
  api.get<ActivityEvent[]>(`/activity?limit=${limit}`).then(r => r.data)

export const fetchLatestBrief = () =>
  api.get<IntelligenceBrief>('/brief/latest').then(r => r.data)

export const fetchFreight = () =>
  api.get<FreightResponse>('/flow/freight').then(r => r.data)

export const fetchOPECCompliance = () =>
  api.get<{ compliance: ComplianceRecord[]; date: string; period_days: number }>('/flow/opec-compliance').then(r => r.data)

export const fetchImpact = () =>
  api.get<ImpactResponse>('/flow/impact').then(r => r.data)

export const fetchLiveVessels = () =>
  api.get<LiveVesselsResponse>('/vessels/live').then(r => r.data)

export const fetchOilPrices = (days = 365) =>
  api.get<{ prices: OilPrice[]; latest: OilPrice }>(`/prices/oil?days=${days}`).then(r => r.data)

export const fetchDisruptions = () =>
  api.get<{ events: DisruptionEvent[] }>('/disruptions/').then(r => r.data)

export const fetchMarketMetrics = () =>
  api.get<{ metrics: MarketMetrics; source: string }>('/prices/market-metrics').then(r => r.data)

export const fetchEFSHistory = (days = 90) =>
  api.get<{ history: EFSHistoryItem[]; count: number }>(`/prices/efs-history?days=${days}`).then(r => r.data)

export const fetchFloatingStorage = () =>
  api.get<FloatingStorageResponse>('/vessels/floating-storage').then(r => r.data)

export const fetchDarkVessels = () =>
  api.get<{ vessels: DarkVessel[]; count: number }>('/vessels/dark').then(r => r.data)

export const fetchPortCongestion = () =>
  api.get<PortCongestion[]>('/congestion/latest').then(r => r.data)

export const fetchSTSEvents = () =>
  api.get<{ events: STSEvent[]; count: number }>('/vessels/sts').then(r => r.data)

export const fetchBunkerPrices = () =>
  api.get<BunkerPrice>('/prices/bunkers/latest').then(r => r.data)

export const fetchBunkerHistory = (days = 30) =>
  api.get<{ history: BunkerPrice[]; count: number }>(`/prices/bunkers/history?days=${days}`).then(r => r.data)

export const fetchTerminalWeather = () =>
  api.get<TerminalWeather[]>('/weather/latest').then(r => r.data)

export const fetchInsurance = () =>
  api.get<InsuranceStatus>('/flow/insurance').then(r => r.data)

export const fetchFujairahLatest = () =>
  api.get<FujairahInventory>('/fujairah/latest').then(r => r.data)

export const fetchFujairahHistory = (limit = 52) =>
  api.get<FujairahInventory[]>(`/fujairah/history?limit=${limit}`).then(r => r.data)

export const fetchIMFTransits = (days = 90) =>
  api.get<{ transits: IMFTransit[]; summary: Record<string, any> }>(`/flow/imf?days=${days}`).then(r => r.data)

export const fetchFlowEstimate = () =>
  api.get<Record<string, any>>('/flow/estimate').then(r => r.data)

export const fetchBaseline = () =>
  api.get<Record<string, any>>('/flow/baseline').then(r => r.data)
