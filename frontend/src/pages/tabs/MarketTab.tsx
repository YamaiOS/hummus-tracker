import Panel from '../../components/Panel'
import ProductionPanel from '../../components/ProductionPanel'
import MarketMetricsPanel from '../../components/MarketMetricsPanel'
import FujairahInventoryPanel from '../../components/FujairahInventoryPanel'
import OPECCompliancePanel from '../../components/OPECCompliancePanel'
import TopDestinations from '../../components/TopDestinations'
import PriceChart from '../../components/PriceChart'
import BunkerPricesPanel from '../../components/BunkerPricesPanel'
import SupplyChainImpact from '../../components/SupplyChainImpact'
import GasPricePanel from '../../components/GasPricePanel'
import VolatilityWidget from '../../components/VolatilityWidget'

export default function MarketTab() {
  return (
    <div className="space-y-4">
      {/* Gas & LNG + OVX row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <Panel
            title="Global Gas & LNG Prices"
            subtitle="Asia (JKM) · EU (TTF) · Henry Hub — Qatar LNG transits Hormuz"
            footer="FRED/IMF MONTHLY — LAGS SPOT"
            tier="LIVE"
          >
            <GasPricePanel />
          </Panel>
        </div>
        <div>
          <Panel
            title="Oil Volatility (OVX)"
            subtitle="Crude implied vol — risk sentiment"
            tier="LIVE"
          >
            <VolatilityWidget />
          </Panel>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <Panel
            title="Brent-Dubai Spread"
            subtitle="90-day EFS history & market structure"
            footer="SOURCE: YFINANCE BZ=F"
            tier="LIVE"
          >
            <MarketMetricsPanel />
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Fujairah Inventory" subtitle="Weekly stock levels ('000 bbl)" tier="EST">
            <FujairahInventoryPanel />
          </Panel>
          <Panel title="OPEC+ Compliance" subtitle="Quota vs observed exports — derived from SIMULATED vessel flows" tier="SIM">
            <OPECCompliancePanel />
          </Panel>
          <Panel
            title="OPEC & Gulf Production"
            subtitle="Crude + liquids output by producer (EIA)"
            tier="LIVE"
          >
            <ProductionPanel />
          </Panel>
          <Panel title="Top Destinations" subtitle="Outbound cargo flow by region" tier="SIM">
            <TopDestinations />
          </Panel>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel
          title="Brent Crude"
          subtitle="Daily settlement history (FRED)"
          footer="SOURCE: FRED SPOT"
          tier="LIVE"
        >
          <PriceChart />
        </Panel>
        <Panel title="Bunker Market" subtitle="Fujairah VLSFO & HSFO rates" tier="EST">
          <BunkerPricesPanel />
        </Panel>
        <Panel title="Supply Chain Risk" subtitle="Insurance & routing friction" tier="EST">
          <SupplyChainImpact />
        </Panel>
      </div>
    </div>
  )
}
