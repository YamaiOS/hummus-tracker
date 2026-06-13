import Panel from '../../components/Panel'
import VesselMap from '../../components/VesselMap'
import ActivityFeed from '../../components/ActivityFeed'
import WeatherAlertsPanel from '../../components/WeatherAlertsPanel'
import DarkVesselPanel from '../../components/DarkVesselPanel'
import STSEventsPanel from '../../components/STSEventsPanel'
import FloatingStoragePanel from '../../components/FloatingStoragePanel'
import FreightRates from '../../components/FreightRates'
import VesselTable from '../../components/VesselTable'

interface OperationsTabProps {
  darkVesselCount: number
}

export default function OperationsTab({ darkVesselCount }: OperationsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Panel
            title="Live Vessel Map"
            subtitle="Real-time AIS positions & maritime lanes"
            footer="SOURCE: AISSTREAM.IO"
          >
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
        <Panel title="AIS Dark Vessels" subtitle={`${darkVesselCount} active detections`}>
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
  )
}
