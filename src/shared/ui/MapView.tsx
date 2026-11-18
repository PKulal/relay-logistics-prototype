/**
 * Leaflet + OpenStreetMap map (design-system.md §6 MapView).
 * Marker colours come from CSS classes (index.css .map-*), because Leaflet sets
 * colours as SVG attributes, which can't read our CSS variables.
 */
import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { cn } from '@/shared/lib/utils'
import type { Point } from '@shared/engines/position'
import type { Tone } from './tones'

export interface MapMarker extends Point {
  id: string
  tone: Tone
  label: string
  /** Larger dot (hubs, the current position) */
  emphasis?: boolean
  onClick?: () => void
}

interface MapViewProps {
  markers: MapMarker[]
  /** Route line through these points (dashed) */
  route?: Point[]
  className?: string
  ariaLabel: string
}

/** India, if there is nothing to fit */
const INDIA: [number, number] = [21.5, 78.5]

function FitBounds({ points }: { points: Point[] }) {
  const map = useMap()
  const key = points.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join('|')
  // The container may still be settling (e.g. inside a tab that just opened): re-measure once.
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 50)
    return () => clearTimeout(id)
  }, [map])
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 9)
    else map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), { padding: [40, 40], maxZoom: 9 })
    // Fit only when the set of points changes (key), not on every render, so the user can pan.
  }, [map, key]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

export function MapView({ markers, route, className, ariaLabel }: MapViewProps) {
  const points = [...markers, ...(route ?? [])]
  return (
    // `isolate`: Leaflet's panes use z-index up to 1000; keep them inside the map so
    // dialogs, menus and the demo toolbar stay on top.
    <div role="region" aria-label={ariaLabel} className={cn('isolate overflow-hidden rounded-xl border', className)}>
      <MapContainer center={INDIA} zoom={5} scrollWheelZoom className="size-full min-h-80" attributionControl>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        {route && route.length > 1 && <Polyline positions={route.map((p) => [p.lat, p.lng] as [number, number])} pathOptions={{ className: 'map-route', weight: 3, dashArray: '6 6' }} />}
        {markers.map((m) => (
          <CircleMarker
            key={m.id}
            center={[m.lat, m.lng]}
            radius={m.emphasis ? 9 : 6}
            pathOptions={{ className: `map-dot map-${m.tone}`, weight: 2, fillOpacity: 0.85 }}
            eventHandlers={m.onClick ? { click: m.onClick } : undefined}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {m.label}
            </Tooltip>
          </CircleMarker>
        ))}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  )
}
