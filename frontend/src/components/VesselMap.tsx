import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
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
import { Anchor, EyeOff, Link2, Layers } from 'lucide-react'
import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'

// ---------------------------------------------------------------------------
// Infrastructure layer — oil terminals, TSS chokepoint
// ---------------------------------------------------------------------------

interface Terminal {
  name: string
  lat: number
  lon: number
  country: string
}

const OIL_TERMINALS: Terminal[] = [
  { name: 'Ras Tanura',       lat: 26.64, lon: 50.16, country: 'SA' },
  { name: 'Juaymah',          lat: 26.88, lon: 49.99, country: 'SA' },
  { name: 'Mina Al Ahmadi',   lat: 29.07, lon: 48.16, country: 'KW' },
  { name: 'Kharg Island',     lat: 29.23, lon: 50.32, country: 'IR' },
  { name: 'Bandar Abbas',     lat: 27.13, lon: 56.21, country: 'IR' },
  { name: 'Das Island',       lat: 25.14, lon: 52.87, country: 'AE' },
  { name: 'Halul',            lat: 25.67, lon: 52.41, country: 'QA' },
  { name: 'Jebel Dhanna / Ruwais', lat: 24.18, lon: 52.61, country: 'AE' },
  { name: 'Jebel Ali',        lat: 25.01, lon: 55.06, country: 'AE' },
  { name: 'Fujairah',         lat: 25.16, lon: 56.36, country: 'AE' },
]

// Narrowest point of the strait ~26.57N, 56.47E
const STRAIT_CHOKEPOINT: [number, number] = [26.57, 56.47]

// Traffic Separation Scheme lanes (approximate centrelines)
// Outbound (NE-bound): south lane
const TSS_OUTBOUND: [number, number][] = [
  [26.30, 56.15],
  [26.40, 56.40],
  [26.55, 56.65],
  [26.65, 56.90],
]
// Inbound (SW-bound): north lane
const TSS_INBOUND: [number, number][] = [
  [26.70, 56.90],
  [26.60, 56.65],
  [26.75, 56.40],
  [26.65, 56.15],
]

function createTerminalIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
    <polygon points="7,0 14,7 7,14 0,7" fill="#c4a35a" fill-opacity="0.85" stroke="#0a1628" stroke-width="1"/>
  </svg>`
  return L.divIcon({
    html: svg,
    className: 'terminal-diamond-icon',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

const TERMINAL_ICON = createTerminalIcon()

// ---------------------------------------------------------------------------

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

/** Returns a rotated vessel arrow icon. course is in degrees (0=North, clockwise). */
function createVesselIcon(color: string, course: number, sizePx: number) {
  // SVG: arrow pointing up (north = 0°), rotated by course degrees
  const half = sizePx / 2
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}">
    <g transform="rotate(${course}, ${half}, ${half})">
      <polygon
        points="${half},2 ${sizePx - 3},${sizePx - 2} ${half},${sizePx - 6} 3,${sizePx - 2}"
        fill="${color}"
        fill-opacity="0.9"
        stroke="#0a1628"
        stroke-width="0.8"
      />
    </g>
  </svg>`
  return L.divIcon({
    html: svg,
    className: 'vessel-arrow-icon',
    iconSize: [sizePx, sizePx],
    iconAnchor: [half, half],
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

/** Icon pixel size for rotated vessel arrow, scaled by vessel size. */
function vesselIconSize(v: Vessel): number {
  const barrels = v.estimated_barrels ?? 0
  if (barrels > 1_500_000) return 22 // VLCC
  if (barrels > 800_000) return 18   // Suezmax
  if (barrels > 400_000) return 16   // Aframax
  return 14
}

export default function VesselMap() {
  const [showInfra, setShowInfra] = useState(true)

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

        {/* ---- Infrastructure layer (terminals + TSS) ---- */}
        {showInfra && OIL_TERMINALS.map((t) => (
          <Marker
            key={`terminal-${t.name}`}
            position={[t.lat, t.lon]}
            icon={TERMINAL_ICON}
          >
            <Tooltip
              permanent
              direction="right"
              opacity={1}
              className="terminal-label"
            >
              {t.name}
            </Tooltip>
            <Popup>
              <div className="text-[13px] font-sans p-1 min-w-[160px]">
                <p className="font-bold text-text-warm">{t.name}</p>
                <p className="text-[11px] font-mono text-text-muted mt-1">
                  {t.lat.toFixed(2)}°N, {t.lon.toFixed(2)}°E
                </p>
                <p className="text-[11px] font-mono text-text-muted">
                  Country: {t.country}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}

        {showInfra && (
          <>
            {/* TSS outbound lane — teal */}
            <Polyline
              positions={TSS_OUTBOUND}
              pathOptions={{ color: '#00a19c', weight: 3, opacity: 0.55, dashArray: '6 4' }}
            >
              <Tooltip sticky direction="top" opacity={0.9} className="terminal-label">
                TSS Outbound Lane
              </Tooltip>
            </Polyline>
            {/* TSS inbound lane — blue-grey */}
            <Polyline
              positions={TSS_INBOUND}
              pathOptions={{ color: '#7ba3c8', weight: 3, opacity: 0.55, dashArray: '6 4' }}
            >
              <Tooltip sticky direction="top" opacity={0.9} className="terminal-label">
                TSS Inbound Lane
              </Tooltip>
            </Polyline>
            {/* Chokepoint circle */}
            <CircleMarker
              center={STRAIT_CHOKEPOINT}
              radius={18}
              pathOptions={{ color: '#c4a35a', weight: 2, fillColor: '#c4a35a', fillOpacity: 0.07, dashArray: '5 3' }}
            >
              <Tooltip permanent direction="bottom" opacity={1} className="terminal-label tss-label">
                Strait of Hormuz — TSS
              </Tooltip>
            </CircleMarker>
          </>
        )}
        {/* ---- end Infrastructure layer ---- */}

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

        {vessels.map((v) => {
          // Use heading if available and valid, otherwise fall back to course
          const bearing = (v as any).heading != null && (v as any).heading !== 511
            ? (v as any).heading as number
            : (v.course ?? 0)
          const color = vesselColor(v)
          const iconSize = vesselIconSize(v)
          const icon = createVesselIcon(color, bearing, iconSize)

          return (
            <Marker
              key={v.mmsi}
              position={[v.lat, v.lon]}
              icon={icon}
            >
              <Popup>
                <div className="text-[13px] font-sans space-y-1 min-w-[200px] p-1">
                  {/* Header: name + MMSI */}
                  <div className="border-b border-petro-border pb-1 mb-2">
                    <p className="font-bold text-text-warm leading-tight">
                      {v.name ? v.name : '(UNKNOWN)'}
                    </p>
                    <p className="font-mono text-[10px] text-text-muted tracking-widest">
                      MMSI {v.mmsi}
                    </p>
                  </div>

                  {/* Core fields */}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-[3px] font-mono text-[11px]">
                    <span className="text-text-muted">CLASS</span>
                    <span className="text-text-warm">{v.vessel_class ?? '—'}</span>

                    <span className="text-text-muted">FLAG</span>
                    <span className="text-text-warm">{v.flag ?? '—'}</span>

                    <span className="text-text-muted">DEST</span>
                    <span className="text-text-warm truncate" title={v.destination}>{v.destination ?? '—'}</span>

                    <span className="text-text-muted">DIRECTION</span>
                    <span className="text-text-warm">{v.direction ? v.direction.toUpperCase() : '—'}</span>

                    <span className="text-text-muted">STATUS</span>
                    <span className={v.is_loaded ? 'text-[#c4a35a] font-bold' : 'text-[#566b8a]'}>
                      {v.is_loaded ? 'LOADED' : 'BALLAST'}
                    </span>

                    {(v.estimated_barrels ?? 0) > 0 && (
                      <>
                        <span className="text-text-muted">CARGO</span>
                        <span className="text-[#00a19c] font-bold">
                          {((v.estimated_barrels ?? 0) / 1_000_000).toFixed(2)}M BBL
                        </span>
                      </>
                    )}

                    {v.crude_grade && (
                      <>
                        <span className="text-text-muted">GRADE</span>
                        <span className="text-text-warm">{v.crude_grade}</span>
                      </>
                    )}

                    <span className="text-text-muted">SPEED</span>
                    <span className="text-text-warm">
                      {v.speed != null ? `${v.speed.toFixed(1)} kt` : '—'}
                    </span>

                    <span className="text-text-muted">COG</span>
                    <span className="text-text-warm">{v.course != null ? `${Math.round(v.course)}°` : '—'}</span>

                    {(v.dwell_hours ?? 0) > 0 && (
                      <>
                        <span className="text-text-muted">DWELL</span>
                        <span className="text-text-warm">{(v.dwell_hours ?? 0).toFixed(1)} h</span>
                      </>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          )
        })}
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
        <div className="h-px bg-petro-border my-1" />
        {/* Infrastructure toggle */}
        <button
          onClick={() => setShowInfra(v => !v)}
          className={`flex items-center gap-2 w-full text-left transition-opacity ${showInfra ? '' : 'opacity-40'}`}
        >
          <Layers size={10} className="text-petro-gold" />
          <span className={showInfra ? 'text-petro-gold' : 'text-text-muted'}>INFRASTRUCTURE</span>
        </button>
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
