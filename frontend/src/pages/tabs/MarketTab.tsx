import Panel from '../../components/Panel'
import MarketMetricsPanel from '../../components/MarketMetricsPanel'
import FujairahInventoryPanel from '../../components/FujairahInventoryPanel'
import OPECCompliancePanel from '../../components/OPECCompliancePanel'
import TopDestinations from '../../components/TopDestinations'
import PriceChart from '../../components/PriceChart'
import BunkerPricesPanel from '../../components/BunkerPricesPanel'
import SupplyChainImpact from '../../components/SupplyChainImpact'

export default function MarketTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Panel
            title="Brent-Dubai Spread"
            subtitle="90-day EFS history & market structure"
            footer="SOURCE: YFINANCE BZ=F"
          >
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
          <Panel title="Top Destinations" subtitle="Outbound cargo flow by region">
            <TopDestinations />
          </Panel>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel
          title="Brent Crude"
          subtitle="Daily settlement history (FRED)"
          footer="SOURCE: FRED SPOT"
        >
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
  )
}
