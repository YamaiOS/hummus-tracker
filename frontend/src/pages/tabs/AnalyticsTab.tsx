import Panel from '../../components/Panel'
import RiskIndexGauge from '../../components/RiskIndexGauge'
import MetricHistoryChart from '../../components/MetricHistoryChart'
import TransitChart from '../../components/TransitChart'
import VolumeByFlag from '../../components/VolumeByFlag'
import DailyFlowTrend from '../../components/DailyFlowTrend'
import VesselClassBreakdown from '../../components/VesselClassBreakdown'
import DisruptionTimeline from '../../components/DisruptionTimeline'
import IntelligenceBriefPanel from '../../components/IntelligenceBriefPanel'
import ChokepointComparison from '../../components/ChokepointComparison'
import BypassGauge from '../../components/BypassGauge'
import ScenarioCalculator from '../../components/ScenarioCalculator'

export default function AnalyticsTab() {
  return (
    <div className="space-y-4">
      {/* Macro context row: chokepoint comparison + bypass capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel
          title="Chokepoint Comparison"
          subtitle="Hormuz vs global maritime chokepoints (% of 30-day baseline)"
          footer="POLLED EVERY 5 MIN · IMF PORTWATCH"
        >
          <ChokepointComparison />
        </Panel>
        <Panel
          title="Bypass Capacity &amp; Supply Gap"
          subtitle="Pipeline reroute vs ~20.9 mbpd Hormuz throughput"
          footer="STATIC CAPACITY · SAUDI PETROLINE · UAE FUJAIRAH · IRAN GOREH-JASK"
        >
          <BypassGauge />
        </Panel>
      </div>

      {/* Scenario Calculator — interactive supply-shock model */}
      <Panel
        title="Scenario Calculator — What If Hormuz Closes?"
        subtitle="Interactive supply-shock &amp; price-impact model"
        footer="ILLUSTRATIVE · EIA/IEA PUBLIC PARAMETERS · NOT A FORECAST"
      >
        <ScenarioCalculator />
      </Panel>

      {/* Risk Index + Metric History — flagship analytics row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel
          title="Hormuz Risk Index"
          subtitle="Composite geopolitical &amp; flow risk score (0–100)"
          footer="POLLED EVERY 5 MIN · MULTI-FACTOR COMPOSITE"
        >
          <RiskIndexGauge />
        </Panel>
        <Panel
          title="Metric History"
          subtitle="Risk score, Brent price &amp; strait flow over time"
          footer="ACCUMULATING · HOURLY SNAPSHOTS"
        >
          <MetricHistoryChart />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <Panel title="Satellite Transits" subtitle="IMF PortWatch — Daily volume trends">
            <TransitChart />
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Volume by Flag" subtitle="Selective transit intelligence">
            <VolumeByFlag />
          </Panel>
          <Panel
            title="Daily Flow Trend"
            subtitle="30-day observed mbpd vs EIA baseline"
            footer="SOURCE: EIA BASELINE CROSS-REF"
          >
            <DailyFlowTrend />
          </Panel>
          <Panel title="Vessel Class Mix" subtitle="Active tanker fleet composition">
            <VesselClassBreakdown />
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
  )
}
