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
  direction?: string
  flag?: string
  observed_at: string
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

// ── API calls ────────────────────────────────────────────────────────────────

export const fetchOverview = () =>
  api.get<OverviewResponse>('/overview').then(r => r.data)

export const fetchFreight = () =>
  api.get<FreightResponse>('/flow/freight').then(r => r.data)

export const fetchImpact = () =>
  api.get<ImpactResponse>('/flow/impact').then(r => r.data)

export const fetchLiveVessels = () =>
  api.get<LiveVesselsResponse>('/vessels/live').then(r => r.data)

export const fetchOilPrices = (days = 365) =>
  api.get<{ prices: OilPrice[]; latest: OilPrice }>(`/prices/oil?days=${days}`).then(r => r.data)

export const fetchDisruptions = () =>
  api.get<{ events: DisruptionEvent[] }>('/disruptions/').then(r => r.data)

export const fetchIMFTransits = (days = 90) =>
  api.get<{ transits: IMFTransit[]; summary: Record<string, any> }>(`/flow/imf?days=${days}`).then(r => r.data)

export const fetchFlowEstimate = () =>
  api.get<Record<string, any>>('/flow/estimate').then(r => r.data)

export const fetchBaseline = () =>
  api.get<Record<string, any>>('/flow/baseline').then(r => r.data)
