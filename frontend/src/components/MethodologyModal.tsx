import { useEffect } from 'react'
import { X, CheckCircle2, AlertTriangle, Info, HelpCircle, Cpu } from 'lucide-react'

interface MethodologyModalProps {
  open: boolean
  onClose: () => void
}

const Badge = ({ type }: { type: 'LIVE' | 'EST' | 'SIM' }) => {
  const styles: Record<string, string> = {
    LIVE: 'bg-petro-teal/20 text-petro-teal border-petro-teal/30',
    EST:  'bg-sky-400/20 text-sky-300 border-sky-400/30',
    SIM:  'bg-petro-gold/20 text-petro-gold border-petro-gold/30',
  }
  return (
    <span className={`inline-block text-[9px] font-bold px-1 py-0.5 rounded border uppercase tracking-wider ${styles[type]}`}>
      {type}
    </span>
  )
}

export default function MethodologyModal({ open, onClose }: MethodologyModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-petro-card border border-petro-border rounded-xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-petro-card border-b border-petro-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Info size={16} className="text-petro-teal" />
            <h2 className="text-sm font-bold text-text-warm uppercase tracking-widest">
              Data &amp; Methodology
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-petro-border text-text-muted hover:text-text-warm transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">

          {/* 1 — Refresh model */}
          <section>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wide mb-2">
              Data Refresh Model
            </h3>
            <p className="text-sm text-text-faint leading-relaxed">
              The dashboard runs on a <span className="text-text-warm font-semibold">static-snapshot / hourly-refresh</span> model.
              A backend pipeline fetches and caches all external sources once per hour via an external cron trigger.
              The host process scales to zero between runs; the UI always reads from the latest cached snapshot — no data is streamed live to the browser.
              The <span className="text-text-warm font-semibold">Data Freshness</span> badge in the header shows the age of the current snapshot.
            </p>
          </section>

          {/* 2 — Data-quality tiers */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle size={14} className="text-text-muted shrink-0" />
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wide">
                Data-Quality Tiers
              </h3>
            </div>
            <p className="text-xs text-text-faint mb-3 leading-relaxed">
              Every panel carries one of three badges indicating confidence in the underlying data.
            </p>
            <div className="space-y-2">
              {[
                {
                  badge: 'LIVE' as const,
                  label: 'Real — primary source',
                  detail: 'Data fetched directly from a public API or authoritative feed during the most recent pipeline run. Values reflect real-world readings within the snapshot age shown in the header.',
                },
                {
                  badge: 'EST' as const,
                  label: 'Estimated / seeded / modeled',
                  detail: 'Values derived from published reference figures (EIA, IEA, CNBC, Lloyd\'s) or heuristic models. Not connected to a live feed; updated manually when public sources change.',
                },
                {
                  badge: 'SIM' as const,
                  label: 'Simulated',
                  detail: 'Data generated from a synthetic model because no free live feed is available. Does not reflect actual real-world conditions. Clearly labeled throughout the UI.',
                },
              ].map(({ badge, label, detail }) => (
                <div key={badge} className="flex gap-3 bg-petro-bg rounded-lg px-4 py-3 border border-petro-border">
                  <div className="shrink-0 pt-0.5"><Badge type={badge} /></div>
                  <div>
                    <p className="text-xs font-bold text-text-warm">{label}</p>
                    <p className="text-xs text-text-faint mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3 — LIVE sources */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={14} className="text-petro-teal shrink-0" />
              <h3 className="text-xs font-bold text-petro-teal uppercase tracking-wide">
                Real (LIVE) Data Sources
              </h3>
            </div>
            <div className="space-y-2">
              {[
                {
                  source: 'FRED (St. Louis Fed)',
                  provides: 'Brent crude spot (DCOILBRENTEU) and WTI spot (DCOILWTICO); natural gas & LNG prices — Asia JKM proxy, EU/TTF proxy, US Henry Hub; crude-oil implied volatility index (OVX). Updated on trading days.',
                },
                {
                  source: 'EIA (U.S. Energy Information Administration)',
                  provides: 'Petroleum supply/demand statistics; OPEC and Gulf state crude and liquids production by country; Strait of Hormuz throughput baseline reference (~20 mbpd).',
                },
                {
                  source: 'IMF PortWatch',
                  provides: 'Satellite-derived chokepoint transit vessel counts across multiple chokepoints: Hormuz, Suez Canal, Bab-el-Mandeb, and Strait of Malacca. Updated daily.',
                },
                {
                  source: 'Open-Meteo',
                  provides: 'Terminal weather for Fujairah/Hormuz region including Shamal wind speed & direction; marine wave height and swell conditions at the Hormuz narrows.',
                },
                {
                  source: 'USGS Earthquake Hazards',
                  provides: 'Regional seismicity near Gulf terminals — recent M2.5+ events within 500 km of the Strait.',
                },
                {
                  source: 'Google News RSS',
                  provides: 'Strait Intelligence Wire — headline feed filtered for Hormuz/Gulf geopolitical terms, updated each pipeline run. Also drives the maritime security-incident timeline: MARAD/UKMTO official advisories are access-restricted, so incidents are press-reported via this feed and clearly labeled accordingly.',
                },
                {
                  source: 'Caldara-Iacoviello GPR Index',
                  provides: 'Peer-reviewed Geopolitical Risk Index (monthly), constructed from automated text-search counts in major newspapers. Captures global conflict/tensions that feed through to energy markets. Published by the Federal Reserve.',
                },
              ].map(({ source, provides }) => (
                <div key={source} className="flex gap-3 bg-petro-bg rounded-lg px-4 py-3 border border-petro-border">
                  <span className="text-petro-teal font-bold text-xs shrink-0 w-4">✓</span>
                  <div>
                    <p className="text-xs font-bold text-text-warm">{source}</p>
                    <p className="text-xs text-text-faint mt-0.5">{provides}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4 — EST sources */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-sky-400 shrink-0" />
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wide">
                Estimated / Seeded (EST) Data
              </h3>
            </div>
            <p className="text-xs text-text-faint mb-3 leading-relaxed">
              The following panels are labeled <Badge type="EST" /> and draw from static reference figures or heuristic models, not live feeds.
            </p>
            <div className="space-y-2">
              {[
                { label: 'War-risk insurance baseline', detail: 'Geopolitical risk premium for Hormuz hull/cargo insurance; sourced from published Lloyd\'s/JWC area designations and open news reports. Updated manually.' },
                { label: 'Bunker prices', detail: 'Fujairah VLSFO/IFO380 bunker reference prices seeded from published market surveys (Ship & Bunker). Not a live market feed.' },
                { label: 'Fujairah oil inventory', detail: 'Weekly inventory estimates derived from a seeded baseline; no live data connection.' },
                { label: 'OPEC quotas', detail: 'Published OPEC+ production quota and compliance figures from official OPEC communiqués and IEA OMR.' },
                { label: 'Bypass pipeline capacities', detail: 'Iraq–Turkey (Kirkuk–Ceyhan), UAE Habshan–Fujairah, and Saudi East–West (Petroline) bypass capacities from EIA/CNBC reference data.' },
                { label: 'Freight TCE heuristic', detail: 'VLCC time-charter equivalent estimate derived from Worldscale flat-rate tables and published rate indices; not a live Baltic Exchange feed.' },
                { label: 'Historical disruption events', detail: 'Curated timeline of past Hormuz disruptions (tanker wars, seizures, mine incidents) from public historical records.' },
              ].map(({ label, detail }) => (
                <div key={label} className="flex gap-3 bg-petro-bg rounded-lg px-4 py-3 border border-petro-border border-sky-400/20">
                  <span className="text-sky-400 font-bold text-xs shrink-0 w-4">≈</span>
                  <div>
                    <p className="text-xs font-bold text-text-warm">{label}</p>
                    <p className="text-xs text-text-faint mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5 — SIM sources */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-petro-gold shrink-0" />
              <h3 className="text-xs font-bold text-petro-gold uppercase tracking-wide">
                Simulated (SIM) Data
              </h3>
            </div>
            <p className="text-xs text-text-faint mb-3 leading-relaxed">
              The free public AIS feed returns no vessel data for this region. All vessel-related panels are labeled <Badge type="SIM" /> and generated from a synthetic model seeded with realistic Gulf traffic patterns. They do <span className="font-semibold text-text-muted">not</span> reflect actual ship positions or movements.
            </p>
            <div className="space-y-2">
              {[
                { label: 'Live vessel positions', detail: 'Tanker, carrier, and naval vessel positions shown on the map are simulated.' },
                { label: 'Dark-vessel detections', detail: 'AIS-dark events (AIS transponder off) are generated by the simulation model — not observed.' },
                { label: 'Ship-to-ship (STS) transfers', detail: 'STS events used as a sanctions/diversion proxy are simulated.' },
                { label: 'Floating storage', detail: 'Anchored VLCC floating-storage counts are derived from the simulation.' },
              ].map(({ label, detail }) => (
                <div key={label} className="flex gap-3 bg-petro-bg rounded-lg px-4 py-3 border border-petro-border border-petro-gold/20">
                  <span className="text-petro-gold font-bold text-xs shrink-0 w-4">~</span>
                  <div>
                    <p className="text-xs font-bold text-text-warm">{label}</p>
                    <p className="text-xs text-text-faint mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 6 — Derived / computed signals */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Cpu size={14} className="text-purple-400 shrink-0" />
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wide">
                Derived &amp; Computed Signals
              </h3>
            </div>
            <p className="text-xs text-text-faint mb-3 leading-relaxed">
              The following outputs are computed by the pipeline from the raw source data above. They are not fetched from any external provider.
            </p>
            <div className="space-y-2">
              {[
                {
                  label: 'GPS/AIS Data-Integrity Signal',
                  detail: 'Flags periods when news reporting indicates GPS jamming or AIS spoofing activity in the Gulf. When active, AIS-derived transit counts and vessel positions may be understated or unreliable — a caveat note is shown on affected panels.',
                },
                {
                  label: 'Bypass Supply-Gap Model',
                  detail: 'Estimates the volume gap that cannot be bypassed if Hormuz were disrupted, based on static EIA/CNBC pipeline capacity figures (UAE Habshan–Fujairah, Saudi Petroline, Iraq–Turkey). Not a live calculation; updates when EST baseline figures change.',
                },
                {
                  label: '"What-If Hormuz Closes" Scenario Calculator',
                  detail: 'Illustrative scenario tool only — not a forecast or trading signal. Applies published EIA and IEA parameters (bypass capacity, strategic reserve draw rates, demand elasticity) to estimate directional impact across user-selectable closure durations. All outputs carry an explicit illustrative disclaimer.',
                },
                {
                  label: 'Risk Index Component Decomposition',
                  detail: 'For each of the 8 Risk Index components, the pipeline computes the individual contribution as (sub-score × weight). The decomposition bar chart shows which signals are currently driving the overall index level.',
                },
              ].map(({ label, detail }) => (
                <div key={label} className="flex gap-3 bg-petro-bg rounded-lg px-4 py-3 border border-petro-border border-purple-400/20">
                  <span className="text-purple-400 font-bold text-xs shrink-0 w-4">∫</span>
                  <div>
                    <p className="text-xs font-bold text-text-warm">{label}</p>
                    <p className="text-xs text-text-faint mt-0.5">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 7 — Risk Index v2 */}
          <section>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wide mb-3">
              Hormuz Risk Index v2 — Methodology
            </h3>
            <p className="text-xs text-text-faint mb-3 leading-relaxed">
              A transparent 0–100 composite score. Eight components are each normalized to a 0–100 sub-score and tier-tagged. Missing inputs are dropped and weights renormalized automatically.
              Aggregation: <span className="text-text-warm font-semibold">0.65 × weighted mean + 0.35 × worst component</span> — the worst-component term ensures a single severe signal can lift the overall index even if other inputs are calm.
              Output levels: <span className="text-petro-teal font-semibold">Low</span> · <span className="text-yellow-400 font-semibold">Elevated</span> · <span className="text-orange-400 font-semibold">High</span> · <span className="text-red-400 font-semibold">Severe</span>.
            </p>
            <div className="space-y-2">
              {[
                { label: 'Strait Flow', source: 'IMF PortWatch', tier: 'LIVE' as const, weight: '.22', desc: 'Chokepoint transit vessel counts vs. baseline; below-trend flow raises risk.' },
                { label: 'Oil Volatility (OVX)', source: 'FRED', tier: 'LIVE' as const, weight: '.18', desc: 'CBOE Crude Oil Volatility Index — market-implied fear gauge for crude prices.' },
                { label: 'News Pressure', source: 'Google News RSS', tier: 'LIVE' as const, weight: '.18', desc: 'Topic-weighted headline count from the Strait Intelligence Wire; conflict/sanction terms score higher.' },
                { label: 'Shamal Wind', source: 'Open-Meteo', tier: 'LIVE' as const, weight: '.12', desc: 'Wind speed at Fujairah/Hormuz narrows; high Shamal conditions affect safe transit.' },
                { label: 'War-Risk Insurance', source: 'Reference baseline', tier: 'EST' as const, weight: '.12', desc: 'Geopolitical premium in Hormuz hull/cargo insurance (manually updated).' },
                { label: 'Geopolitical Risk (GPR)', source: 'Caldara-Iacoviello', tier: 'LIVE' as const, weight: '.10', desc: 'Peer-reviewed monthly GPR index; elevated readings reflect heightened global conflict tensions feeding into energy market risk.' },
                { label: 'Seismic Activity', source: 'USGS', tier: 'LIVE' as const, weight: '.06', desc: 'Recent M2.5+ earthquake events near Gulf terminals.' },
                { label: 'Anomaly Vessels', source: 'AIS simulation', tier: 'SIM' as const, weight: '.12', desc: 'Dark-vessel and STS anomaly rate from the vessel simulation model.' },
              ].map(({ label, source, tier, weight, desc }) => (
                <div key={label} className="flex gap-3 items-start bg-petro-bg rounded-lg px-4 py-3 border border-petro-border">
                  <span className="text-petro-teal font-mono font-bold text-xs shrink-0 w-8 text-right pt-0.5">{weight}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-text-warm">{label}</p>
                      <Badge type={tier} />
                      <span className="text-[10px] text-text-faint">{source}</span>
                    </div>
                    <p className="text-xs text-text-faint mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-faint mt-3 leading-relaxed">
              <span className="text-text-muted font-semibold">Note on official advisories:</span> MARAD and UKMTO maritime security advisories are access-restricted. Incidents are sourced from press reporting via Google News RSS and are clearly labeled as press-reported throughout the dashboard.
            </p>
          </section>

          {/* 8 — Scenario calculator */}
          <section>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wide mb-2">
              What-If Scenario Calculator
            </h3>
            <p className="text-xs text-text-faint leading-relaxed">
              The "What-If Hormuz Closes" model is <span className="text-text-warm font-semibold">illustrative only</span>.
              It applies defensible public parameters from EIA and IEA analyses (bypass capacity, strategic reserve draw rates, demand elasticity) to estimate the directional impact of varying closure durations.
              It is not a forecast, not a trading signal, and does not incorporate real-time market dynamics.
            </p>
          </section>

          {/* Disclaimer & Terms */}
          <section className="bg-petro-bg border border-petro-gold/30 rounded-lg px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-petro-gold shrink-0" />
              <h3 className="text-xs font-bold text-petro-gold uppercase tracking-widest">
                Disclaimer &amp; Terms
              </h3>
            </div>
            <ul className="space-y-2 text-[11px] text-text-faint leading-relaxed list-none">
              <li>
                <span className="text-text-warm font-semibold">Informational &amp; educational use only.</span>{' '}
                Hummus Tracker is <span className="text-text-muted font-semibold">not</span> financial, trading, investment, operational, navigational, or security advice, and must not be used as the basis for any such decision.
              </li>
              <li>
                <span className="text-text-warm font-semibold">Not a validated model.</span>{' '}
                The Hormuz Risk Index is a transparent composite of public indicators with subjective, <span className="text-text-muted font-semibold">unfitted</span> weights (operator priors). It is <span className="text-text-muted font-semibold">not</span> a back-tested or predictive model — do not rely on it for decisions.
              </li>
              <li>
                <span className="text-text-warm font-semibold">Third-party &amp; simulated data.</span>{' '}
                Data is aggregated from public third-party sources (FRED, EIA, IMF PortWatch, USGS, Open-Meteo, Google News, Caldara-Iacoviello GPR) and may be delayed, incomplete, or incorrect. Vessel/AIS positions and some panels are <span className="text-text-muted font-semibold">simulated or seeded</span> (clearly badged) and must not be treated as real feeds.
              </li>
              <li>
                <span className="text-text-warm font-semibold">Provided "AS IS".</span>{' '}
                No warranty of any kind, express or implied. The author accepts no liability for any loss or decision made using this tool. You use it entirely at your own risk.
              </li>
              <li>
                <span className="text-text-warm font-semibold">Attribution.</span>{' '}
                The GPR Index (Caldara &amp; Iacoviello) and IMF PortWatch are used under their respective public / Creative Commons terms.
              </li>
            </ul>
          </section>

        </div>
      </div>
    </div>
  )
}
