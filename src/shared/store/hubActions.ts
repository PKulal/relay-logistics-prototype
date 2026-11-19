/**
 * Hub actions (Partner App PA-26 to PA-29). In-scan, bag sealing and out-scan
 * are chain-of-custody events; sorting a piece into a bag only changes the bag.
 * A live action on a background shipment ends its simulated journey.
 */
import { bagLabel, bagOfPiece, destinationOf, hubIdOfLeg, isHubLeg, nextBagId, nextManifestId, openBagFor, shipmentsInBags, tripFor } from '@shared/engines/hub'
import { nextLegOf } from '@shared/engines/fieldTasks'
import { addHours } from '@shared/lib/time'
import { makeHandoverCode } from '@shared/sim/handover'
import type { Bag, DemoData, Id, IsoDateTime, Manifest, ShipmentEvent, ShipmentException } from '@shared/types'
import { applyEvents } from './actions'
import { eventIdFactory } from './booking'
import { exceptionId, receiveHandover } from './handoverActions'

/** Hours a hub has to investigate pieces it finds short at in-scan (source §10). */
const HUB_INVESTIGATE_HOURS = 4

/** A live action takes over: the shipment stops moving on its own (CLAUDE.md, background movement). */
export function dropSim(data: DemoData, lrs: Id[]): DemoData {
  const live = lrs.filter((lr) => data.shipments[lr]?.sim)
  if (!live.length) return data
  const shipments = { ...data.shipments }
  for (const lr of live) {
    const { sim: _sim, ...rest } = shipments[lr]
    void _sim
    shipments[lr] = rest
  }
  return { ...data, shipments }
}

/** The shipment's leg at this hub. */
function hubLeg(data: DemoData, lr: Id, hubId: Id) {
  return data.shipments[lr].legIds.map((id) => data.legs[id]).find((l) => isHubLeg(l) && hubIdOfLeg(data, l) === hubId)
}

export interface InScan {
  hubId: Id
  /** Hub legs of the source (one rider's or truck's load) */
  legIds: Id[]
  /** Pieces scanned in */
  pieceIds: Id[]
  staffId: Id
  /** Reason for any pieces not scanned (Finish inbound) */
  shortReason?: string
  /** Optional hub re-weigh of the whole load */
  weightKg?: number
  weightPhoto?: string
}

/** Pickup weight of pieces: the rider's verified weight, else the booked weight. */
export function loadWeight(data: DemoData, pieceIds: Id[]): number {
  let kg = 0
  for (const id of pieceIds) {
    const p = data.shipments[id.slice(0, -3)]?.pieces.find((x) => x.id === id)
    if (p) kg += p.verifiedWeight ?? p.weight
  }
  return Math.round(kg * 10) / 10
}

/**
 * PA-26 "Finish inbound": one hubInScan event per shipment (→ At Origin / At
 * Destination Hub). Pieces not scanned are marked short with the reason and an
 * exception is raised for the hub to investigate.
 */
export function inScan(data: DemoData, x: InScan, at: IsoDateTime): DemoData {
  const legs = x.legIds.map((id) => data.legs[id]).filter(Boolean)
  const events: ShipmentEvent[] = []
  const exceptions: Record<Id, ShipmentException> = {}
  const weightNote = x.weightKg ? `Hub weight ${x.weightKg} kg (pickup ${loadWeight(data, x.pieceIds)} kg)` : ''
  for (const leg of legs) {
    const s = data.shipments[leg.shipmentId]
    const newId = eventIdFactory({ ...data, events: { ...data.events, ...Object.fromEntries(events.map((e) => [e.id, e])) } }, s.id)
    const expected = Object.values(data.events)
      .filter((e) => e.legId === leg.id && e.type === 'handoverReceived')
      .at(-1)?.pieceIds ?? s.pieces.map((p) => p.id)
    const scanned = expected.filter((p) => x.pieceIds.includes(p))
    const missing = expected.filter((p) => !x.pieceIds.includes(p))
    events.push({ id: newId(), shipmentId: s.id, legId: leg.id, type: 'hubInScan', at, by: x.staffId, app: 'partnerApp', pieceIds: scanned, photos: x.weightPhoto ? [x.weightPhoto] : undefined, note: weightNote || undefined })
    if (missing.length) {
      events.push({ id: newId(), shipmentId: s.id, legId: leg.id, type: 'exceptionReported', at, by: x.staffId, app: 'partnerApp', exceptionKind: 'short', pieceIds: missing, note: `${scanned.length} of ${expected.length} in-scanned · ${x.shortReason ?? ''}`.trim() })
      const id = exceptionId({ ...data, exceptions: { ...data.exceptions, ...exceptions } }, s.id)
      exceptions[id] = { id, shipmentId: s.id, legId: leg.id, type: 'short', raisedAt: at, actionDueAt: addHours(at, HUB_INVESTIGATE_HOURS), ownerPartnerId: leg.partnerId, rootCause: x.shortReason, status: 'open', customerConfirmed: false }
    }
  }
  const next = applyEvents(dropSim(data, legs.map((l) => l.shipmentId)), events, at)
  return { ...next, exceptions: { ...next.exceptions, ...exceptions } }
}

/**
 * PA-27: put a piece in the open bag for its destination, opening a new bag if
 * there is none. Returns the data and the bag used.
 */
export function sortPiece(data: DemoData, hubId: Id, pieceId: Id): { data: DemoData; bagId?: Id } {
  const lr = pieceId.slice(0, -3)
  const leg = data.shipments[lr] ? hubLeg(data, lr, hubId) : undefined
  if (!leg) return { data }
  const current = bagOfPiece(data, hubId, pieceId)
  if (current) return { data, bagId: current.id }
  const dest = destinationOf(data, leg)
  const bag: Bag = openBagFor(data, hubId, dest.key) ?? { id: nextBagId(data, hubId), hubId, destination: dest.key, pieceIds: [], status: 'open' }
  const next = dropSim(data, [lr])
  return { data: { ...next, bags: { ...next.bags, [bag.id]: { ...bag, pieceIds: [...bag.pieceIds, pieceId] } } }, bagId: bag.id }
}

/** PA-28 "scan again to remove": take a piece out of an open bag. */
export function removeFromBag(data: DemoData, bagId: Id, pieceId: Id): DemoData {
  const bag = data.bags[bagId]
  if (!bag || bag.status !== 'open') return data
  return { ...data, bags: { ...data.bags, [bagId]: { ...bag, pieceIds: bag.pieceIds.filter((p) => p !== pieceId) } } }
}

export interface SealBag {
  bagId: Id
  sealNo: string
  weightKg?: number
  photo: string
  /** Existing open manifest, or undefined for a new one */
  manifestId?: Id
  staffId: Id
}

/**
 * PA-28 "Seal and add": the bag is sealed and joins a manifest (a new one goes
 * on the next planned trip to that destination). One bagSealed event per
 * shipment in the bag.
 */
export function sealBag(data: DemoData, x: SealBag, at: IsoDateTime): DemoData {
  const bag = data.bags[x.bagId]
  if (!bag || bag.status !== 'open' || !bag.pieceIds.length) return data
  let manifest: Manifest | undefined = x.manifestId ? data.manifests[x.manifestId] : undefined
  if (!manifest || manifest.status === 'dispatched') {
    const trip = tripFor(data, bag.hubId, bag.destination)
    manifest = { id: nextManifestId(data, bag.hubId), hubId: bag.hubId, destination: bag.destination, bagIds: [], vehicleId: trip?.vehicleId, tripId: trip?.id, status: 'open' }
  }
  const sealed: Bag = { ...bag, status: 'sealed', sealNo: x.sealNo, weightKg: x.weightKg, photo: x.photo, sealedAt: at, sealedBy: x.staffId, manifestId: manifest.id }
  let next: DemoData = {
    ...data,
    bags: { ...data.bags, [bag.id]: sealed },
    manifests: { ...data.manifests, [manifest.id]: { ...manifest, bagIds: [...manifest.bagIds, bag.id] } },
  }
  const events: ShipmentEvent[] = []
  for (const { shipment, leg, pieceIds } of shipmentsInBags(next, [sealed])) {
    const newId = eventIdFactory(next, shipment.id)
    events.push({ id: newId(), shipmentId: shipment.id, legId: leg.id, type: 'bagSealed', at, by: x.staffId, app: 'partnerApp', pieceIds, sealNos: [x.sealNo], photos: [x.photo], note: `${bagLabel(bag)} · ${manifest.id}` })
  }
  next = dropSim(next, events.map((e) => e.shipmentId))
  return applyEvents(next, events, at)
}

export interface Dispatch {
  manifestId: Id
  vehicleNo: string
  doorSeal: string
  photo: string
  staffId: Id
}

/**
 * PA-29 "Hand over to driver": bags out-scanned onto the vehicle and the
 * hand-over code shown (PA-19). Per shipment: hubOutScan, then handoverGiven
 * with the bag and door seals. The driver's PA-20 completes it.
 */
export function dispatchManifest(data: DemoData, x: Dispatch, at: IsoDateTime): DemoData {
  const manifest = data.manifests[x.manifestId]
  if (!manifest || manifest.status === 'dispatched') return data
  const bags = manifest.bagIds.map((id) => data.bags[id]).filter((b) => b?.status === 'sealed')
  if (!bags.length) return data
  const trip = manifest.tripId ? data.trips[manifest.tripId] : undefined
  const code = makeHandoverCode(manifest.id, at)
  let next: DemoData = {
    ...data,
    manifests: { ...data.manifests, [manifest.id]: { ...manifest, status: 'dispatched', doorSeal: x.doorSeal, photo: x.photo, dispatchedAt: at, handoverCode: code } },
    bags: { ...data.bags, ...Object.fromEntries(bags.map((b) => [b.id, { ...b, status: 'dispatched' as const }])) },
    trips: trip ? { ...data.trips, [trip.id]: { ...trip, status: 'loading', sealNos: [x.doorSeal] } } : data.trips,
  }
  const events: ShipmentEvent[] = []
  for (const b of bags) {
    for (const { shipment, leg, pieceIds } of shipmentsInBags(next, [b])) {
      const newId = eventIdFactory({ ...next, events: { ...next.events, ...Object.fromEntries(events.map((e) => [e.id, e])) } }, shipment.id)
      const seals = [b.sealNo!, x.doorSeal]
      const driver = trip?.driverId ?? nextLegOf(next, leg)?.staffId
      events.push({ id: newId(), shipmentId: shipment.id, legId: leg.id, type: 'hubOutScan', at, by: x.staffId, app: 'partnerApp', pieceIds, sealNos: seals, vehicleNo: x.vehicleNo, note: `${bagLabel(b)} · ${manifest.id}` })
      events.push({ id: newId(), shipmentId: shipment.id, legId: leg.id, type: 'handoverGiven', at, by: x.staffId, app: 'partnerApp', pieceIds, sealNos: seals, vehicleNo: x.vehicleNo, photos: [x.photo], counterpartStaffId: driver, handoverCode: code, note: manifest.id })
    }
  }
  next = dropSim(next, events.map((e) => e.shipmentId))
  return applyEvents(next, events, at)
}

export interface ReceiveManifest {
  manifestId: Id
  staffId: Id
  code: string
  /** Bags counted onto the truck by the driver */
  bagIds: Id[]
  /** Seals (bag or door) broken or not matching */
  brokenSeals: string[]
  photos: string[]
}

/**
 * PA-20 for a driver: accept the manifest's bags with the hub's code. Each
 * shipment's line-haul leg receives the pieces in the bags counted; a missing
 * bag is a short, a broken seal a seal mismatch (investigated on the hub leg).
 */
export function receiveManifest(data: DemoData, x: ReceiveManifest, at: IsoDateTime): DemoData {
  const manifest = data.manifests[x.manifestId]
  if (!manifest || manifest.status !== 'dispatched' || manifest.handoverCode !== x.code) return data
  const bags = manifest.bagIds.map((id) => data.bags[id])
  let next = data
  const taken: Id[] = []
  for (const { leg, pieceIds } of shipmentsInBags(data, bags)) {
    const truck = nextLegOf(data, leg)
    if (!truck) continue
    taken.push(truck.id)
    const shipmentBags = bags.filter((b) => b.pieceIds.some((p) => pieceIds.includes(p)))
    const received = shipmentBags.filter((b) => x.bagIds.includes(b.id)).flatMap((b) => b.pieceIds.filter((p) => pieceIds.includes(p)))
    const broken = x.brokenSeals.filter((s) => s === manifest.doorSeal || shipmentBags.some((b) => b.sealNo === s))
    next = receiveHandover(next, { legId: truck.id, staffId: x.staffId, code: x.code, pieceIds: received, brokenSeals: broken, damagedPieceIds: [], photos: x.photos }, at)
  }
  // The trip now carries these legs (PA-21 load, PA-22 start)
  const trip = manifest.tripId ? next.trips[manifest.tripId] : undefined
  if (trip) next = { ...next, trips: { ...next.trips, [trip.id]: { ...trip, loadedLegIds: [...new Set([...(trip.loadedLegIds ?? []), ...taken])] } } }
  return next
}

/** The manifest's hand-over: shipments, and whether the driver has accepted. */
export function manifestHandover(data: DemoData, manifestId: Id) {
  const manifest = data.manifests[manifestId]
  if (!manifest) return undefined
  const items = shipmentsInBags(
    data,
    manifest.bagIds.map((id) => data.bags[id]),
  )
  const receipts = items
    .map(({ leg }) => {
      const truck = nextLegOf(data, leg)
      return truck ? Object.values(data.events).find((e) => e.legId === truck.id && e.type === 'handoverReceived') : undefined
    })
    .filter((e): e is ShipmentEvent => !!e)
  return { manifest, items, received: items.length > 0 && receipts.length === items.length ? receipts[0] : undefined }
}
