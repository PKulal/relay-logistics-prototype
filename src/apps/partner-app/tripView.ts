/** Trip facts shared by the driver's trip screens (PA-21 to PA-24). */
import { loadedLegs } from '@shared/engines/trip'
import { formatDayShort, formatTime } from '@shared/lib/format'
import type { DemoData, Trip } from '@shared/types'

/** "23-Nov 23:00" style, without the year */
export const dayTime = (iso: string) => `${formatDayShort(iso)} ${formatTime(iso)}`

/** Trip header facts shared by the trip screens. */
export function tripFacts(data: DemoData, trip: Trip) {
  const lane = data.lanes[trip.laneId]
  const from = data.hubs[lane.originHubId]
  const to = data.hubs[lane.destHubId]
  const legs = loadedLegs(data, trip)
  const shipments = legs.map((l) => data.shipments[l.shipmentId])
  const manifests = Object.values(data.manifests).filter((m) => m.tripId === trip.id && m.status === 'dispatched')
  const bags = manifests.flatMap((m) => m.bagIds.map((id) => data.bags[id]))
  const kg = shipments.reduce((s, x) => s + (x.weights.verifiedChargeable ?? x.weights.chargeable), 0)
  const seals = [...trip.sealNos, ...bags.map((b) => b.sealNo).filter((s): s is string => !!s)]
  return { lane, from, to, legs, shipments, manifests, bags, kg, seals, vehicle: data.vehicles[trip.vehicleId] }
}
