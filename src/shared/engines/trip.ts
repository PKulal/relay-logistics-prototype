/**
 * Line-haul trips (Partner App PA-21 to PA-24; ERP map). Pure reads: what is
 * loaded, where the truck is and when it will arrive.
 * SIMULATED tracking: the truck moves along the lane route at a steady speed
 * from the moment the trip starts; reported halts stop it for their duration.
 */
import { toIst } from '@shared/lib/time'
import { LANE_WAYPOINTS } from '@shared/sim/routes'
import type { DemoData, Id, IsoDateTime, Leg, Trip } from '@shared/types'
import { km } from './fieldTasks'
import type { Point } from './position'

/**
 * Share of the planned trip time spent driving; the rest is rest / meal
 * allowance (SIMULATED schedule). Halts beyond it push the ETA past the SLA.
 */
export const DRIVING_SHARE = 0.85

const MIN = 60_000

/** Hub-to-hub points of the trip's road route. */
export function tripRoute(data: DemoData, trip: Trip): Point[] {
  const lane = data.lanes[trip.laneId]
  const at = (hubId: Id): Point => {
    const pin = data.pincodes[data.hubs[hubId].pincode]
    return { lat: pin.lat, lng: pin.lng }
  }
  return [at(lane.originHubId), ...(LANE_WAYPOINTS[trip.laneId] ?? []), at(lane.destHubId)]
}

/** Driving minutes planned for the trip. */
export const plannedDrivingMinutes = (trip: Trip) => ((Date.parse(trip.eta) - Date.parse(trip.departAt)) / MIN) * DRIVING_SHARE

/** Halt minutes that have passed by `now` (a halt still running counts up to now). */
function haltMinutesBy(trip: Trip, now: number): number {
  return trip.halts.reduce((sum, h) => {
    const start = Date.parse(h.at)
    if (start >= now) return sum
    return sum + Math.min(h.minutes, (now - start) / MIN)
  }, 0)
}

/** 0 → 1 along the route. */
export function tripProgress(trip: Trip, now: IsoDateTime): number {
  if (!trip.startedAt) return 0
  if (trip.arrivedAt) return 1
  const t = Date.parse(now)
  const driven = (t - Date.parse(trip.startedAt)) / MIN - haltMinutesBy(trip, t)
  return Math.min(1, Math.max(0, driven / plannedDrivingMinutes(trip)))
}

/** Is the truck stopped for a reported halt right now? */
export function activeHalt(trip: Trip, now: IsoDateTime) {
  const t = Date.parse(now)
  return trip.halts.find((h) => Date.parse(h.at) <= t && t < Date.parse(h.at) + h.minutes * MIN)
}

/**
 * Expected arrival. Before the start: the planned arrival. On the way: start +
 * driving time + every halt reported (Logisco's delay prediction, SIMULATED).
 */
export function tripEta(trip: Trip): IsoDateTime {
  if (trip.arrivedAt) return trip.arrivedAt
  if (!trip.startedAt) return trip.eta
  const halts = trip.halts.reduce((s, h) => s + h.minutes, 0)
  return toIst(new Date(Date.parse(trip.startedAt) + (plannedDrivingMinutes(trip) + halts) * MIN))
}

/** Late against the trip's SLA (the planned arrival)? */
export const etaAtRisk = (trip: Trip) => Date.parse(tripEta(trip)) > Date.parse(trip.eta)

/** Point at a fraction of the way along a polyline (by distance). */
export function pointAlong(points: Point[], fraction: number): Point {
  const segs = points.slice(1).map((p, i) => km(points[i], p))
  const total = segs.reduce((a, b) => a + b, 0)
  let left = Math.min(1, Math.max(0, fraction)) * total
  for (let i = 0; i < segs.length; i++) {
    if (left <= segs[i] || i === segs.length - 1) {
      const f = segs[i] ? Math.min(1, left / segs[i]) : 0
      return { lat: points[i].lat + (points[i + 1].lat - points[i].lat) * f, lng: points[i].lng + (points[i + 1].lng - points[i].lng) * f }
    }
    left -= segs[i]
  }
  return points[points.length - 1]
}

/** The next named checkpoint ahead of the truck, and the share of the route done at it. */
export function nextCheckpoint(data: DemoData, trip: Trip, now: IsoDateTime): string | undefined {
  const route = tripRoute(data, trip)
  const names = [undefined, ...(LANE_WAYPOINTS[trip.laneId] ?? []).map((w) => w.name), data.hubs[data.lanes[trip.laneId].destHubId].name]
  const segs = route.slice(1).map((p, i) => km(route[i], p))
  const total = segs.reduce((a, b) => a + b, 0)
  const done = tripProgress(trip, now) * total
  let acc = 0
  for (let i = 0; i < segs.length; i++) {
    acc += segs[i]
    if (acc > done + 0.5) return names[i + 1]
  }
  return undefined
}

/** Where the truck is now. */
export const tripPosition = (data: DemoData, trip: Trip, now: IsoDateTime): Point => pointAlong(tripRoute(data, trip), tripProgress(trip, now))

/** Line-haul legs actually loaded on the truck: the driver took them from the hub (PA-20). */
export function loadedLegs(data: DemoData, trip: Trip): Leg[] {
  return (trip.loadedLegIds ?? []).map((id) => data.legs[id]).filter(Boolean)
}

/** Pieces each loaded leg carries (as received from the hub). */
export function loadedPieces(data: DemoData, leg: Leg): Id[] {
  return (
    Object.values(data.events)
      .filter((e) => e.legId === leg.id && e.type === 'handoverReceived')
      .at(-1)?.pieceIds ?? []
  )
}

/**
 * The driver's current trip: started and not yet handed over, else the next
 * planned or loading one.
 */
export function currentTrip(data: DemoData, driverId: Id): Trip | undefined {
  const mine = Object.values(data.trips)
    .filter((t) => t.driverId === driverId)
    .sort((a, b) => a.departAt.localeCompare(b.departAt))
  const open = (t: Trip) => t.status !== 'arrived' || loadedLegs(data, t).some((l) => l.status !== 'handedOver')
  return mine.find((t) => t.status === 'inTransit' || t.status === 'arrived' ? open(t) : false) ?? mine.find((t) => t.status === 'planned' || t.status === 'loading')
}
