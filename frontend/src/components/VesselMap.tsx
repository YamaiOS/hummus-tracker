import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, CircleMarker, Popup, Rectangle, Polyline } from 'react-leaflet'
import { fetchLiveVessels, fetchDisruptions, Vessel } from '../api/client'
import 'leaflet/dist/leaflet.css'

const HORMUZ_CENTER: [number, number] = [26.0, 56.5]
const HORMUZ_BOUNDS: [[number, number], [number, number]] = [
  [24.5, 55.5],
  [27.0, 58.0],
]

const OUTBOUND_LANE: [number, number][] = [[25.2, 55.2], [25.8, 55.8], [26.4, 56.3], [26.7, 56.6], [26.3, 57.2], [25.8, 57.8]]
const INBOUND_LANE: [number, number][] = [[25.5, 57.8], [26.5, 57.0], [27.1, 56.6], [26.8, 56.2], [26.2, 55.7], [25.0, 54.8]]

function vesselColor(v: Vessel) {
  if (v.is_loaded) return '#10b981' // emerald — loaded outbound
  if (v.direction === 'inbound') return '#64748b' // slate — ballast inbound
  return '#f59e0b' // amber — other tanker
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

  const vessels = data?.vessels ?? []
  const events = disruptionData?.events ?? []

  return (
    <div className="h-[400px] w-full rounded-lg overflow-hidden relative">
      {isLoading && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-slate-900/60">
          <p className="text-sm text-slate-400 animate-pulse">Loading AIS positions...</p>
        </div>
      )}
      <MapContainer
        center={HORMUZ_CENTER}
        zoom={7}
        className="h-full w-full"
        style={{ background: '#0f172a' }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* Hormuz bounding box */}
        <Rectangle
          bounds={HORMUZ_BOUNDS}
          pathOptions={{ color: '#f59e0b', weight: 1, fillOpacity: 0.03, dashArray: '6 4' }}
        />

        {/* Shipping Lanes */}
        <Polyline 
          positions={OUTBOUND_LANE} 
          pathOptions={{ color: '#10b981', weight: 12, opacity: 0.1, lineCap: 'round' }} 
        />
        <Polyline 
          positions={INBOUND_LANE} 
          pathOptions={{ color: '#64748b', weight: 12, opacity: 0.1, lineCap: 'round' }} 
        />
        <Polyline 
          positions={OUTBOUND_LANE} 
          pathOptions={{ color: '#10b981', weight: 1, opacity: 0.3, dashArray: '5, 10' }} 
        />
        <Polyline 
          positions={INBOUND_LANE} 
          pathOptions={{ color: '#64748b', weight: 1, opacity: 0.3, dashArray: '5, 10' }} 
        />

        {/* Disruption Events */}
        {events.map((evt, i) => (
          evt.latitude && evt.longitude && (
            <CircleMarker
              key={`evt-${i}`}
              center={[evt.latitude, evt.longitude]}
              radius={10}
              pathOptions={{
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.4,
                weight: 2,
                className: 'animate-pulse'
              }}
            >
              <Popup>
                <div className="text-xs space-y-1 min-w-[150px]">
                  <p className="font-bold text-red-500 uppercase tracking-tight">Disruption: {evt.category}</p>
                  <p className="font-bold text-sm">{evt.title}</p>
                  <p className="text-slate-600 line-clamp-2">{evt.description}</p>
                  <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-100">
                    <span className="text-[10px] font-bold text-slate-400">{evt.date}</span>
                    <span className="text-[10px] uppercase px-1 bg-red-100 text-red-600 rounded">{evt.severity}</span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          )
        ))}

        {vessels.map((v) => (
          <CircleMarker
            key={v.mmsi}
            center={[v.lat, v.lon]}
            radius={vesselRadius(v)}
            pathOptions={{
              color: vesselColor(v),
              fillColor: vesselColor(v),
              fillOpacity: 0.7,
              weight: 1,
            }}
          >
            <Popup>
              <div className="text-xs space-y-1 min-w-[180px]">
                <p className="font-bold text-sm">{v.name || `MMSI ${v.mmsi}`}</p>
                <div className="flex items-center gap-2">
                  {v.vessel_class && <p>Class: {v.vessel_class}</p>}
                  {v.flag && <span className="text-[9px] px-1 bg-slate-100 border border-slate-300 rounded text-slate-600 uppercase font-bold">{v.flag}</span>}
                </div>
                {v.destination && <p>Dest: {v.destination}</p>}
                {v.speed != null && <p>Speed: {v.speed.toFixed(1)} kn</p>}
                {v.draught != null && <p>Draught: {v.draught.toFixed(1)} m</p>}
                {v.is_loaded != null && (
                  <p>Status: {v.is_loaded ? 'Loaded (outbound)' : 'Ballast (inbound)'}</p>
                )}
                {v.estimated_barrels != null && v.estimated_barrels > 0 && (
                  <p>Est. cargo: {(v.estimated_barrels / 1_000_000).toFixed(2)}M bbl</p>
                )}
                <p className="text-[10px] text-gray-400">
                  {new Date(v.observed_at).toLocaleTimeString()}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-[10px] space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-slate-300">Loaded (outbound)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
          <span className="text-slate-300">Ballast (inbound)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span className="text-slate-300">Other tanker</span>
        </div>
      </div>

      {/* Stats badge */}
      {data && (
        <div className="absolute top-2 right-2 z-[1000] bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-1.5 text-[10px] text-slate-300">
          {data.tanker_count} tankers | {data.loaded_count} loaded | {data.ballast_count} ballast
        </div>
      )}
    </div>
  )
}
