import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Rectangle, Polyline, Tooltip } from 'react-leaflet'
import { 
  fetchLiveVessels, 
  fetchDisruptions, 
  fetchDarkVessels,
  fetchSTSEvents,
  fetchFloatingStorage,
  Vessel 
} from '../api/client'
import 'leaflet/dist/leaflet.css'
import { Anchor, EyeOff, Link2 } from 'lucide-react'
import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'

const HORMUZ_CENTER: [number, number] = [26.0, 56.5]
const HORMUZ_BOUNDS: [[number, number], [number, number]] = [
  [24.5, 55.5],
  [27.0, 58.0],
]

const OUTBOUND_LANE: [number, number][] = [[25.2, 55.2], [25.8, 55.8], [26.4, 56.3], [26.7, 56.6], [26.3, 57.2], [25.8, 57.8]]
const INBOUND_LANE: [number, number][] = [[25.5, 57.8], [26.5, 57.0], [27.1, 56.6], [26.8, 56.2], [26.2, 55.7], [25.0, 54.8]]

const createIcon = (icon: React.ReactNode, color: string) => {
  return L.divIcon({
    html: renderToStaticMarkup(
      <div style={{ color }}>
        {icon}
      </div>
    ),
    className: 'custom-div-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

function vesselColor(v: Vessel) {
  if (v.is_loaded) return '#c4a35a' // --accent-gold for loaded outbound
  if (v.direction === 'inbound') return '#566b8a' // --text-tertiary for ballast
  return '#00a19c' // --accent-teal for normal tankers
}

function vesselRadius(v: Vessel) {
  const barrels = v.estimated_barrels ?? 0
  if (barrels > 1_500_000) return 8 // VLCC
  if (barrels > 800_000) return 6  // Suezmax
  if (barrels > 400_000) return 5  // Aframax
  return 4
}

export default function VesselMap() {
  const { data, isLoading } = useQuery({
    queryKey: ['liveVessels'],
    queryFn: fetchLiveVessels,
    refetchInterval: 30_000,
  })

  const { data: disruptionData } = useQuery({
    queryKey: ['disruptions'],
    queryFn: fetchDisruptions,
  })

  const { data: darkData } = useQuery({
    queryKey: ['darkVessels'],
    queryFn: fetchDarkVessels,
    refetchInterval: 60_000,
  })

  const { data: stsData } = useQuery({
    queryKey: ['stsEvents'],
    queryFn: fetchSTSEvents,
    refetchInterval: 60_000,
  })

  const { data: storageData } = useQuery({
    queryKey: ['floatingStorage'],
    queryFn: fetchFloatingStorage,
    refetchInterval: 60_000,
  })

  const vessels = data?.vessels ?? []
  const events = disruptionData?.events ?? []
  const darkVessels = darkData?.vessels ?? []
  const stsEvents = stsData?.events ?? []
  const floatingStorage = storageData?.vessels ?? []

  return (
    <div className="h-[480px] w-full rounded-lg overflow-hidden relative border border-petro-border">
      {isLoading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-petro-bg/80">
          <p className="text-sm text-text-muted">Loading positions...</p>
        </div>
      )}
      <MapContainer
        center={HORMUZ_CENTER}
        zoom={7}
        zoomControl={false}
        style={{ background: '#0a1628', height: '100%', width: '100%' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        <Rectangle
          bounds={HORMUZ_BOUNDS}
          pathOptions={{ color: '#c4a35a', weight: 1, fillOpacity: 0.02, dashArray: '4 4' }}
        />

        {/* Shipping Lanes — subtle branding */}
        <Polyline 
          positions={OUTBOUND_LANE} 
          pathOptions={{ color: '#00a19c', weight: 8, opacity: 0.05, lineCap: 'round' }} 
        />
        <Polyline 
          positions={INBOUND_LANE} 
          pathOptions={{ color: '#566b8a', weight: 8, opacity: 0.05, lineCap: 'round' }} 
        />

        {/* STS Events — Accent Gold */}
        {stsEvents.map((sts) => (
          <Polyline
            key={`sts-${sts.id}`}
            positions={[[sts.latitude, sts.longitude], [sts.latitude + 0.005, sts.longitude + 0.005]]}
            pathOptions={{ color: '#c4a35a', weight: 2, dashArray: '2, 4' }}
          >
            <Tooltip permanent direction="top" opacity={1} className="bg-petro-card border-petro-gold text-petro-gold text-[11px] font-bold font-mono">
              STS
            </Tooltip>
          </Polyline>
        ))}

        {/* Dark Vessels — Accent Red */}
        {darkVessels.map((dv) => (
          <CircleMarker
            key={`dark-${dv.mmsi}`}
            center={[dv.last_lat, dv.last_lon]}
            radius={6}
            pathOptions={{
              color: '#c4463a',
              fillColor: '#c4463a',
              fillOpacity: 0.1,
              weight: 1,
              dashArray: '2, 2'
            }}
          >
            <Tooltip permanent direction="right" opacity={1} className="bg-petro-card border-petro-red text-petro-red text-[11px] font-bold font-mono">
              DARK
            </Tooltip>
          </CircleMarker>
        ))}

        {/* Floating Storage — Petronas Teal */}
        {floatingStorage.map((fs) => (
          <Marker
            key={`storage-${fs.mmsi}`}
            position={[fs.latitude, fs.longitude]}
            icon={createIcon(<Anchor size={12} />, '#00a19c')}
          >
            <Tooltip direction="bottom" className="font-mono text-[11px]">STORAGE</Tooltip>
          </Marker>
        ))}

        {vessels.map((v) => (
          <CircleMarker
            key={v.mmsi}
            center={[v.lat, v.lon]}
            radius={vesselRadius(v)}
            pathOptions={{
              color: vesselColor(v),
              fillColor: vesselColor(v),
              fillOpacity: 0.8,
              weight: 1,
            }}
          >
            <Popup>
              <div className="text-[13px] font-sans space-y-1 min-w-[180px] p-1">
                <p className="font-bold text-text-warm border-b border-petro-border pb-1 mb-1">
                  {v.name || v.mmsi}
                </p>
                <div className="grid grid-cols-2 gap-x-2 font-mono text-[11px] text-text-muted">
                  <span>CLASS:</span> <span className="text-text-warm">{v.vessel_class}</span>
                  <span>FLAG:</span> <span className="text-text-warm">{v.flag}</span>
                  <span>SPEED:</span> <span className="text-text-warm">{v.speed?.toFixed(1)}kt</span>
                  <span>LOAD:</span> <span className={v.is_loaded ? 'text-petro-teal' : 'text-text-faint'}>
                    {v.is_loaded ? 'LOADED' : 'BALLAST'}
                  </span>
                </div>
                {v.estimated_barrels && v.estimated_barrels > 0 && (
                  <p className="text-[11px] font-bold text-petro-teal pt-1">
                    CARGO: {(v.estimated_barrels / 1_000_000).toFixed(2)}M BBL
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend — Bloomberg Style */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-petro-card border border-petro-border rounded px-3 py-3 text-[11px] font-mono space-y-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-petro-gold" />
          <span className="text-text-muted">LOADED (OUT)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-text-faint" />
          <span className="text-text-muted">BALLAST (IN)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-petro-teal" />
          <span className="text-text-muted">NORMAL TANKER</span>
        </div>
        <div className="h-px bg-petro-border my-1" />
        <div className="flex items-center gap-2">
          <EyeOff size={10} className="text-petro-red" />
          <span className="text-text-muted">SIGNAL LOSS</span>
        </div>
        <div className="flex items-center gap-2">
          <Link2 size={10} className="text-petro-gold" />
          <span className="text-text-muted">POTENTIAL STS</span>
        </div>
        <div className="flex items-center gap-2">
          <Anchor size={10} className="text-petro-teal" />
          <span className="text-text-muted">FLOATING STORAGE</span>
        </div>
      </div>

      {/* Stats overlay */}
      {data && (
        <div className="absolute top-4 right-4 z-[1000] flex flex-col items-end gap-2">
          {data.stream_status?.mode === 'mock' && (
            <div className="bg-petro-red/90 text-white px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wide border border-white/20">
              Simulated Data
            </div>
          )}
          <div className="bg-petro-card border border-petro-border rounded px-3 py-2 text-[11px] font-mono text-text-muted">
            <span className="text-text-warm font-bold">{data.tanker_count}</span> TANKERS / 
            <span className="text-petro-teal font-bold ml-1">{data.loaded_count}</span> LOADED
          </div>
        </div>
      )}
    </div>
  )
}
