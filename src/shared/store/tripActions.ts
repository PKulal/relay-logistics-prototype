/**
 * Driver trip actions (Partner App PA-22 to PA-24). Every step is a
 * chain-of-custody event on each line-haul leg loaded on the truck.
 */
import { nextLegOf } from '@shared/engines/fieldTasks'
import { etaAtRisk, loadedLegs, loadedPieces, tripEta, tripPosition, tripRoute } from '@shared/engines/trip'
import { addDaysToDate, addHours } from '@shared/lib/time'
import { makeHandoverCode } from '@shared/sim/handover'
import type { DemoData, ExceptionKind, Id, IsoDateTime, ShipmentEvent, ShipmentException, Trip } from '@shared/types'
import { recordTripForTrial } from './partnerAgreementActions'
import { applyEvents } from './actions'
import { eventIdFactory } from './booking'
import { exceptionId } from './handoverActions'
import { dropSim } from './hubActions'

/** Hours Logisco gives itself to act on a line-haul exception (breakdown, seal) — source §10 uses 4 h for seal / short. */
const ACT_WITHIN_HOURS = 4

/** Events for every loaded leg, with ids that stay unique within each shipment. */
function legEvents(data: DemoData, trip: Trip, make: (legId: Id, shipmentId: Id) => Omit<ShipmentEvent, 'id' | 'shipmentId' | 'legId'>): ShipmentEvent[] {
  const out: ShipmentEvent[] = []
  for (const leg of loadedLegs(data, trip)) {
    const id = eventIdFactory({ ...data, events: { ...data.events, ...Object.fromEntries(out.map((e) => [e.id, e])) } }, leg.shipmentId)()
    out.push({ id, shipmentId: leg.shipmentId, legId: leg.id, ...make(leg.id, leg.shipmentId) })
  }
  return out
}

/** One exception record per shipment on the truck, owned by the line-haul partner. */
function raiseOnTrip(data: DemoData, trip: Trip, type: ExceptionKind, at: IsoDateTime, rootCause?: string): DemoData {
  const exceptions: Record<Id, ShipmentException> = {}
  for (const leg of loadedLegs(data, trip)) {
    const id = exceptionId({ ...data, exceptions: { ...data.exceptions, ...exceptions } }, leg.shipmentId)
    exceptions[id] = { id, shipmentId: leg.shipmentId, legId: leg.id, type, raisedAt: at, actionDueAt: addHours(at, ACT_WITHIN_HOURS), ownerPartnerId: leg.partnerId, rootCause, status: 'open', customerConfirmed: false }
  }
  return { ...data, exceptions: { ...data.exceptions, ...exceptions } }
}

export interface StartTrip {
  tripId: Id
  staffId: Id
  vehicleNo: string
  sealNos: string[]
  photo: string
}

/** Why a start is blocked: wrong truck (office must change it and Part B), seals that don't match, nothing loaded. */
export function startBlock(data: DemoData, x: Omit<StartTrip, 'staffId' | 'photo'>): 'notLoaded' | 'vehicle' | 'seals' | undefined {
  const trip = data.trips[x.tripId]
  if (!trip || loadedLegs(data, trip).length === 0) return 'notLoaded'
  if (x.vehicleNo.replace(/\s/g, '').toUpperCase() !== data.vehicles[trip.vehicleId]?.regNo) return 'vehicle'
  const expected = [...trip.sealNos].sort().join(',')
  if ([...x.sealNos].sort().join(',') !== expected) return 'seals'
  return undefined
}

/**
 * PA-22 "Start trip": shipments on board → In Transit; e-way bill Part B
 * updated with the vehicle number (SIMULATED NIC call); tracking starts.
 */
export function startTrip(data: DemoData, x: StartTrip, at: IsoDateTime): DemoData {
  const trip = data.trips[x.tripId]
  if (!trip || trip.startedAt || startBlock(data, x)) return data
  const [origin] = tripRoute(data, trip)
  const vehicleNo = data.vehicles[trip.vehicleId].regNo
  const events = legEvents(data, trip, () => ({ type: 'tripStarted', at, by: x.staffId, app: 'partnerApp', vehicleNo, sealNos: x.sealNos, photos: [x.photo], lat: origin.lat, lng: origin.lng }))
  const lrs = events.map((e) => e.shipmentId)
  const shipments = { ...data.shipments }
  for (const lr of lrs) {
    const s = shipments[lr]
    // SIMULATED: e-way bill Part B (vehicle number) updated through the NIC API
    if (s.ewb) shipments[lr] = { ...s, ewb: { ...s.ewb, partBUpdated: true }, updatedAt: at }
  }
  const next: DemoData = { ...dropSim({ ...data, shipments }, lrs), trips: { ...data.trips, [trip.id]: { ...trip, status: 'inTransit', startedAt: at } } }
  return applyEvents(next, events, at)
}

export interface ReportHalt {
  tripId: Id
  staffId: Id
  reason: string
  minutes: number
  breakdown?: { issue: string; backupVehicle: boolean; photos: string[] }
}

/**
 * PA-23 "Report halt" / "Report breakdown". The ETA moves by the halt; when it
 * goes past the planned arrival the legs are flagged at risk and each customer
 * gets the new ETA (source §10). A breakdown also opens an exception.
 */
export function reportHalt(data: DemoData, x: ReportHalt, at: IsoDateTime): DemoData {
  const trip = data.trips[x.tripId]
  if (!trip || trip.status !== 'inTransit' || x.minutes <= 0) return data
  const pos = tripPosition(data, trip, at) // SIMULATED GPS
  const wasLate = etaAtRisk(trip)
  const updated: Trip = { ...trip, halts: [...trip.halts, { at, minutes: x.minutes, reason: x.reason, lat: pos.lat, lng: pos.lng, breakdown: x.breakdown }] }
  const late = etaAtRisk(updated)
  let next: DemoData = { ...data, trips: { ...data.trips, [trip.id]: updated } }
  const note = x.breakdown ? `Breakdown: ${x.breakdown.issue} · ${x.minutes} min${x.breakdown.backupVehicle ? ' · backup vehicle needed' : ''}` : `${x.reason} · ${x.minutes} min`
  const events = legEvents(next, updated, () => ({ type: 'haltReported', at, by: x.staffId, app: 'partnerApp', lat: pos.lat, lng: pos.lng, etaAtRisk: late || !!x.breakdown, photos: x.breakdown?.photos, note }))
  if (x.breakdown) {
    events.push(...legEvents({ ...next, events: { ...next.events, ...Object.fromEntries(events.map((e) => [e.id, e])) } }, updated, () => ({ type: 'exceptionReported', at, by: x.staffId, app: 'partnerApp', exceptionKind: 'breakdown', lat: pos.lat, lng: pos.lng, photos: x.breakdown!.photos, note })))
    next = raiseOnTrip(next, updated, 'breakdown', at, note)
  }
  next = applyEvents(next, events, at)

  if (late) {
    // New ETA to each customer; the delivery date moves by the extra days this halt adds
    const daysLate = (t: Trip) => Math.max(0, Math.ceil((Date.parse(tripEta(t)) - Date.parse(t.eta)) / 86_400_000))
    const shift = daysLate(updated) - (wasLate ? daysLate(trip) : 0)
    const notifications = { ...next.notifications }
    const shipments = { ...next.shipments }
    for (const leg of loadedLegs(next, updated)) {
      const s = shipments[leg.shipmentId]
      const eta = shift > 0 ? addDaysToDate(s.eta, shift) : s.eta
      shipments[s.id] = { ...s, eta, updatedAt: at }
      const id = `NTF-${String(Object.keys(notifications).length + 1).padStart(5, '0')}`
      // SIMULATED WhatsApp / email; lands in the customer's notifications
      notifications[id] = { id, audience: { app: 'customer', customerId: s.customerId }, title: `${s.id}: delay`, body: `Truck delayed (${x.breakdown ? 'breakdown' : x.reason}). New delivery date ${eta}.`, link: `/customer/shipments/${s.id}`, at, read: false }
    }
    next = { ...next, notifications, shipments }
  }
  return next
}

/** PA-23 "I've arrived" (inside the destination hub geo-fence, SIMULATED). */
export function arriveTrip(data: DemoData, tripId: Id, staffId: Id, at: IsoDateTime): DemoData {
  const trip = data.trips[tripId]
  if (!trip || trip.status !== 'inTransit') return data
  const route = tripRoute(data, trip)
  const dest = route[route.length - 1]
  const events = legEvents(data, trip, () => ({ type: 'tripArrived', at, by: staffId, app: 'partnerApp', lat: dest.lat, lng: dest.lng }))
  const arrived: Trip = { ...trip, status: 'arrived', arrivedAt: at, positions: [...trip.positions, { at, lat: dest.lat, lng: dest.lng }] }
  // A trip by a partner in its monitored trial is scored as a trial job (source §4 Step 7)
  return recordTripForTrial(applyEvents({ ...data, trips: { ...data.trips, [trip.id]: arrived } }, events, at), arrived, at)
}

/** Deccan's third trial trip is the hero trip (seed-data.md §6, PP-10 prototype note). */
export const DECCAN_TRIAL_TRIP: Id = 'TRP-2026-0931'

/**
 * Demo toolbar "Complete Deccan's third trial trip": a trip on the road arrives
 * for real (driver taps Arrived); a trip not yet started is only scored for the
 * trial, as an on-time arrival at its ETA (SIMULATED, marked as a demo job), so
 * the hero shipment's own journey is untouched.
 */
export function completeTrialTrip(data: DemoData, tripId: Id, at: IsoDateTime): DemoData {
  const trip = data.trips[tripId]
  const partner = trip && data.partners[data.vehicles[trip.vehicleId]?.partnerId]
  if (!trip || partner?.status !== 'trial' || trip.status === 'arrived') return data
  if (trip.status === 'inTransit') return arriveTrip(data, tripId, trip.driverId, at)
  return recordTripForTrial(data, { ...trip, arrivedAt: trip.eta }, at, true)
}

export interface ArrivalHandover {
  tripId: Id
  staffId: Id
  /** Seals found broken or not matching, with their photos */
  broken: { seal: string; photo: string }[]
}

/**
 * PA-24 "Hand over to hub": the seal check is recorded first (a broken seal is
 * an exception on the truck partner, before unloading — source §10), then the
 * code is shown for the destination hub's PA-20.
 */
export function handOverAtArrival(data: DemoData, x: ArrivalHandover, at: IsoDateTime): DemoData {
  const trip = data.trips[x.tripId]
  if (!trip || trip.status !== 'arrived' || trip.handoverCode) return data
  let next = data
  if (x.broken.length) {
    const seals = x.broken.map((b) => b.seal)
    const events = legEvents(next, trip, () => ({ type: 'exceptionReported', at, by: x.staffId, app: 'partnerApp', exceptionKind: 'sealMismatch', sealNos: seals, photos: x.broken.map((b) => b.photo), note: `Seal ${seals.join(', ')} broken on arrival` }))
    next = applyEvents(raiseOnTrip(next, trip, 'sealMismatch', at, `Seal ${seals.join(', ')} broken on arrival`), events, at)
  }
  const code = makeHandoverCode(trip.id, at)
  const vehicleNo = data.vehicles[trip.vehicleId].regNo
  const given = legEvents(next, trip, (legId) => {
    const leg = next.legs[legId]
    return {
      type: 'handoverGiven',
      at,
      by: x.staffId,
      app: 'partnerApp',
      pieceIds: loadedPieces(next, leg),
      sealNos: trip.sealNos,
      vehicleNo,
      counterpartStaffId: nextLegOf(next, leg)?.staffId,
      handoverCode: code,
      note: trip.id,
    }
  })
  next = applyEvents(next, given, at)
  return { ...next, trips: { ...next.trips, [trip.id]: { ...next.trips[trip.id], handoverCode: code } } }
}
