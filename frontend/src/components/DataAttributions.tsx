import { Database } from 'lucide-react'

export default function DataAttributions() {
  return (
    <div className="space-y-3">
      {/* EIA */}
      <div className="bg-petro-bg rounded-lg px-4 py-3 border border-petro-border">
        <p className="text-[11px] text-text-faint leading-relaxed">
          <span className="text-text-muted font-semibold">EIA (production, petroleum):</span>{' '}
          U.S. Energy Information Administration (EIA), via api.eia.gov — public domain.
        </p>
      </div>

      {/* FRED */}
      <div className="bg-petro-bg rounded-lg px-4 py-3 border border-petro-border">
        <p className="text-[11px] text-text-faint leading-relaxed">
          <span className="text-text-muted font-semibold">FRED / St. Louis Fed (Brent, WTI, Henry Hub):</span>{' '}
          Brent/WTI/Henry Hub: U.S. EIA, retrieved from FRED, Federal Reserve Bank of St. Louis.
        </p>
      </div>

      {/* CBOE OVX */}
      <div className="bg-petro-bg rounded-lg px-4 py-3 border border-petro-border">
        <p className="text-[11px] text-text-faint leading-relaxed">
          <span className="text-text-muted font-semibold">CBOE OVX (oil volatility):</span>{' '}
          CBOE Crude Oil Volatility Index (OVX) © Chicago Board Options Exchange, Inc., via FRED — displayed for reference.
        </p>
      </div>

      {/* IMF PortWatch */}
      <div className="bg-petro-bg rounded-lg px-4 py-3 border border-petro-border">
        <p className="text-[11px] text-text-faint leading-relaxed">
          <span className="text-text-muted font-semibold">IMF PortWatch (chokepoint transits):</span>{' '}
          Source: International Monetary Fund (IMF) PortWatch —{' '}
          <a
            href="https://portwatch.imf.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-petro-teal hover:underline"
          >
            portwatch.imf.org
          </a>.
        </p>
      </div>

      {/* Open-Meteo — CC-BY-4.0 mandatory attribution */}
      <div className="bg-petro-bg rounded-lg px-4 py-3 border border-petro-border border-petro-teal/20">
        <p className="text-[11px] text-text-faint leading-relaxed">
          <span className="text-text-muted font-semibold">Open-Meteo (weather &amp; marine):</span>{' '}
          Weather data by{' '}
          <a
            href="https://open-meteo.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-petro-teal hover:underline"
          >
            Open-Meteo.com
          </a>{' '}
          <span className="text-[10px] text-text-faint">(CC-BY-4.0)</span>
        </p>
      </div>

      {/* USGS */}
      <div className="bg-petro-bg rounded-lg px-4 py-3 border border-petro-border">
        <p className="text-[11px] text-text-faint leading-relaxed">
          <span className="text-text-muted font-semibold">USGS (seismicity):</span>{' '}
          Earthquake data courtesy of the U.S. Geological Survey.
        </p>
      </div>

      {/* Caldara-Iacoviello GPR */}
      <div className="bg-petro-bg rounded-lg px-4 py-3 border border-petro-border">
        <p className="text-[11px] text-text-faint leading-relaxed">
          <span className="text-text-muted font-semibold">Caldara-Iacoviello GPR:</span>{' '}
          Caldara, D. &amp; Iacoviello, M. (2022), 'Measuring Geopolitical Risk,' <em>American Economic Review</em> 112(4): 1194–1225.{' '}
          <a
            href="https://matteoiacoviello.com/gpr.htm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-petro-teal hover:underline"
          >
            matteoiacoviello.com/gpr.htm
          </a>
        </p>
      </div>

      {/* Google News */}
      <div className="bg-petro-bg rounded-lg px-4 py-3 border border-petro-border">
        <p className="text-[11px] text-text-faint leading-relaxed">
          <span className="text-text-muted font-semibold">Google News:</span>{' '}
          Headlines, publisher names, and links are aggregated from Google News RSS and remain the property of their respective publishers.
          We display headlines and source attribution only and link to the originals — no full article content is reproduced.
          Incident counts are auto-derived from headline keywords and may be inaccurate.
          Not affiliated with or endorsed by Google or any publisher.
        </p>
      </div>

      {/* Simulated / modeled data closing line */}
      <div className="bg-petro-bg rounded-lg px-4 py-3 border border-petro-gold/20">
        <p className="text-[11px] text-text-faint leading-relaxed">
          Vessel/AIS positions are <span className="text-petro-gold font-semibold">SIMULATED</span> (no free Gulf AIS feed).
          Bunkers, Fujairah inventory, insurance, freight &amp; OPEC-compliance figures are seeded/modeled estimates — see data tiers (<span className="text-petro-teal font-semibold">LIVE</span> / <span className="text-sky-300 font-semibold">EST</span> / <span className="text-petro-gold font-semibold">SIM</span>).
        </p>
      </div>
    </div>
  )
}
