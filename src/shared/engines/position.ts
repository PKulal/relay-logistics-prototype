/**
 * Where a shipment is on the map (ERP-05 Map view, ERP-03 Map tab).
 * SIMULATED: real positions would come from GPS / FASTag. Here the position is
 * estimated from the shipment status and its legs' time windows:
 * at the pickup point, at a hub, partway along the lane, or out for delivery.
 */
import type { DemoData, IsoDateTime, Leg, Pincode, Shipment } from '@shared/types'

export interface Point {
  lat: number
  lng: number
}

export interface RouteStop extends Point {
  kind: 'origin' | 'originHub' | 'destHub' | 'dest'
  label: string
}

const at = (p: Pincode): Point => ({ lat: p.lat, lng: p.lng })
const lerp = (a: Point, b: Point, t: number): Point => ({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t })
const progress = (leg: Leg | undefined, now: IsoDateTime) => {
  if (!leg) return 0.5
  const from = Date.parse(leg.window.from)
  const to = Date.parse(leg.window.to)
  return to > from ? Math.min(1, Math.max(0, (Date.parse(now) - from) / (to - from))) : 0.5
}

/** The stops a shipment passes: origin → origin hub → destination hub → destination (as its legs require). */
export function routeStops(data: DemoData, s: Shipment): RouteStop[] {
  const origin = data.pincodes[s.originPincode]
  const dest = data.pincodes[s.destPincode]
  const types = s.legIds.map((id) => data.legs[id].type)
  const hubStop = (hubId: string | undefined, kind: RouteStop['kind']): RouteStop[] => {
    const hub = hubId ? data.hubs[hubId] : undefined
    const pin = hub ? data.pincodes[hub.pincode] : undefined
    return hub && pin ? [{ ...at(pin), kind, label: hub.name }] : []
  }
  return [
    { ...at(origin), kind: 'origin', label: `${origin.city} ${origin.code}` },
    ...(types.includes('originHub') ? hubStop(origin.hubId, 'originHub') : []),
    ...(types.includes('destHub') ? hubStop(dest.hubId, 'destHub') : []),
    { ...at(dest), kind: 'dest', label: `${dest.city} ${dest.code}` },
  ]
}

export function shipmentPosition(data: DemoData, s: Shipment, now: IsoDateTime): Point {
  const stops = routeStops(data, s)
  const find = (kind: RouteStop['kind']) => stops.find((x) => x.kind === kind)
  const origin = find('origin')!
  const dest = find('dest')!
  const originHub = find('originHub') ?? origin
  const destHub = find('destHub') ?? originHub
  const leg = (type: Leg['type']) => s.legIds.map((id) => data.legs[id]).find((l) => l.type === type)

  switch (s.status) {
    case 'booked':
    case 'pickedUp':
    case 'cancelled':
      return origin
    case 'atOriginHub':
      return originHub
    case 'inTransit':
      return lerp(originHub, destHub, progress(leg('lineHaul'), now))
    case 'atDestinationHub':
      return destHub
    case 'outForDelivery':
      return lerp(destHub, dest, progress(leg('lastMile'), now))
    default:
      return dest
  }
}
