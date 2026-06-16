import Panel from '../../components/Panel'
import VesselMap from '../../components/VesselMap'
import ActivityFeed from '../../components/ActivityFeed'
import WeatherAlertsPanel from '../../components/WeatherAlertsPanel'
import DarkVesselPanel from '../../components/DarkVesselPanel'
import STSEventsPanel from '../../components/STSEventsPanel'
import FloatingStoragePanel from '../../components/FloatingStoragePanel'
import FreightRates from '../../components/FreightRates'
import VesselTable from '../../components/VesselTable'
import NewsWire from '../../components/NewsWire'
import SeismicPanel from '../../components/SeismicPanel'
import MarinePanel from '../../components/MarinePanel'
import IncidentTimeline from '../../components/IncidentTimeline'

interface OperationsTabProps {
  darkVesselCount: number
}

export default function OperationsTab({ darkVesselCount }: OperationsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2">
          <Panel
            title="Live Vessel Map"
            subtitle="Real-time AIS positions & maritime lanes"
            footer="SOURCE: AISSTREAM.IO"
            tier="SIM"
          >
            <VesselMap />
          </Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Recent Activity" subtitle="Intelligence feed & anomaly log" tier="SIM">
            <ActivityFeed />
          </Panel>
          <Panel title="Shamal Wind Alerts" subtitle="Terminal weather conditions" tier="LIVE">
            <WeatherAlertsPanel />
          </Panel>
          <Panel title="Marine Conditions" subtitle="Hormuz narrows — wave & swell" tier="LIVE">
            <MarinePanel />
          </Panel>
        </div>
      </div>

      <Panel title="Strait Intelligence Wire" subtitle="Live Hormuz & Gulf shipping headlines" tier="LIVE">
        <NewsWire />
      </Panel>

      <Panel
        title="Maritime Security Incidents"
        subtitle="Press-reported kinetic incidents — Hormuz & Gulf"
        footer="POLLED EVERY 5 MIN · PRESS SOURCES"
        tier="LIVE"
      >
        <IncidentTimeline />
      </Panel>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Panel title="AIS Dark Vessels" subtitle={`${darkVesselCount} active detections`} tier="SIM">
          <DarkVesselPanel />
        </Panel>
        <Panel title="STS Transfer Alerts" subtitle="Suspicious tanker proximity" tier="SIM">
          <STSEventsPanel />
        </Panel>
        <Panel title="Floating Storage" subtitle="Stationary loaded tonnage" tier="SIM">
          <FloatingStoragePanel />
        </Panel>
        <Panel title="Freight Rate Modeling" subtitle="Heuristic day rates MEG-Asia" tier="EST">
          <FreightRates />
        </Panel>
      </div>

      <Panel title="Regional Seismicity" subtitle="USGS quakes near Gulf terminals" tier="LIVE">
        <SeismicPanel />
      </Panel>

      <Panel title="Tracking Registry" subtitle="Detailed tanker and LNG carrier telemetry" tier="SIM">
        <VesselTable />
      </Panel>
    </div>
  )
}
