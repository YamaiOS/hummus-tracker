import { useEffect } from 'react'
import { X, CheckCircle2, AlertTriangle, Info } from 'lucide-react'

interface MethodologyModalProps {
  open: boolean
  onClose: () => void
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

          {/* Refresh model */}
          <section>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wide mb-2">
              Data Refresh Model
            </h3>
            <p className="text-sm text-text-faint leading-relaxed">
              The dashboard operates on a <span className="text-text-warm font-semibold">static-snapshot / hourly-refresh</span> model.
              A backend pipeline fetches and caches all external data sources once per hour.
              The UI reads from this snapshot; no data is streamed live to the browser.
              The <span className="text-text-warm font-semibold">Data Freshness</span> badge in the header shows the age of the current snapshot.
            </p>
          </section>

          {/* Real sources */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={14} className="text-petro-teal shrink-0" />
              <h3 className="text-xs font-bold text-petro-teal uppercase tracking-wide">
                Real / Verified Data Sources
              </h3>
            </div>
            <div className="space-y-2">
              {[
                { source: 'FRED (St. Louis Fed)', provides: 'Brent crude spot price (DCOILBRENTEU), updated daily on trading days' },
                { source: 'EIA (U.S. Energy Information Administration)', provides: 'Petroleum supply/demand statistics; Strait of Hormuz throughput baseline (~20 mbpd)' },
                { source: 'IMF PortWatch', provides: 'Satellite-derived chokepoint transit vessel counts; updated daily' },
                { source: 'Open-Meteo', provides: 'Terminal weather for Fujairah / Hormuz region; Shamal wind speed & direction' },
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

          {/* Simulated / seeded */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-petro-gold shrink-0" />
              <h3 className="text-xs font-bold text-petro-gold uppercase tracking-wide">
                Simulated / Seeded Data
              </h3>
            </div>
            <p className="text-xs text-text-faint mb-3 leading-relaxed">
              The following data are clearly labeled <span className="bg-petro-gold/20 text-petro-gold font-bold px-1 rounded border border-petro-gold/30 text-[10px] uppercase">SIM</span> in the UI.
              They are generated from realistic but synthetic models and do <span className="font-semibold text-text-muted">not</span> reflect actual current vessel positions or market prices.
            </p>
            <div className="space-y-2">
              {[
                { label: 'Vessel positions / AIS', detail: 'The free AIS feed returns no data for this region. All vessel positions, dark fleet detections, ship-to-ship (STS) events, and floating storage are generated from a simulated model seeded with realistic traffic patterns.' },
                { label: 'Bunker prices', detail: 'Fujairah bunker (VLSFO/IFO380) prices are seeded reference values, not live market quotes.' },
                { label: 'Fujairah oil inventory', detail: 'Weekly inventory estimates are derived from a seeded baseline; no live data feed is connected.' },
                { label: 'Insurance risk premium', detail: 'The geopolitical risk premium for Hormuz insurance is a baseline figure from open sources, updated manually, not a live Lloyd\'s / marine market feed.' },
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

          {/* Risk Index methodology */}
          <section>
            <h3 className="text-xs font-bold text-text-muted uppercase tracking-wide mb-3">
              Hormuz Risk Index — Methodology
            </h3>
            <p className="text-xs text-text-faint mb-3 leading-relaxed">
              The Hormuz Risk Index is a composite 0–100 score aggregating five signal categories.
              Each component is normalized to a 0–100 sub-score, then weighted as follows:
            </p>
            <div className="space-y-2">
              {[
                { label: 'Oil flow deviation', weight: '30%', desc: 'Observed vs. EIA baseline throughput; large negative deviations increase risk' },
                { label: 'Dark vessel activity', weight: '20%', desc: 'Rate of AIS-dark tankers in the strait (sanctions evasion / conflict indicator)' },
                { label: 'Weather / Shamal winds', weight: '15%', desc: 'Wind speed and storm severity at Fujairah terminal affecting transit safety' },
                { label: 'Insurance risk premium', weight: '15%', desc: 'War-risk and geopolitical premium in Hormuz hull / cargo insurance' },
                { label: 'Disruption events', weight: '10%', desc: 'Active reported incidents (seizures, strikes, mine threats) in the strait' },
                { label: 'STS / floating storage', weight: '10%', desc: 'Ship-to-ship transfer volume used as a sanctions / flow-diversion proxy' },
              ].map(({ label, weight, desc }) => (
                <div key={label} className="flex gap-3 items-start bg-petro-bg rounded-lg px-4 py-3 border border-petro-border">
                  <span className="text-petro-teal font-mono font-bold text-xs shrink-0 w-10 text-right">{weight}</span>
                  <div>
                    <p className="text-xs font-bold text-text-warm">{label}</p>
                    <p className="text-xs text-text-faint mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Disclaimer */}
          <section className="bg-petro-bg border border-petro-border rounded-lg px-4 py-4">
            <p className="text-[11px] text-text-faint leading-relaxed">
              <span className="text-text-muted font-bold uppercase">Disclaimer — </span>
              Hummus Tracker is an analytical and educational research tool.
              Nothing on this dashboard constitutes trading advice, investment advice, or operational guidance for maritime navigation.
              Simulated vessel data does not reflect actual real-world positions.
              Users relying on this data for any commercial, financial, or safety-critical purpose do so at their own risk.
            </p>
          </section>

        </div>
      </div>
    </div>
  )
}
