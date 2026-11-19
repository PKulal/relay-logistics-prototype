/**
 * Hub operations (Partner App PA-25 to PA-29): where each shipment passing a
 * hub stands, which bag its pieces go in, and the shift's tiles. Pure reads of
 * legs, events, bags, manifests and trips.
 */
import { istDate } from '@shared/lib/time'
import type { Bag, DemoData, Id, IsoDateTime, Leg, Manifest, Shipment, ShipmentEvent, Trip } from '@shared/types'
import { nextLegOf, prevLegOf, underWay } from './fieldTasks'

/** expected → (receive, PA-20) → toInScan → (PA-26) → toSort → (PA-27) → sorted → (PA-28) → sealed → (PA-29) → dispatched */
export type HubStage = 'expected' | 'toInScan' | 'toSort' | 'sorted' | 'sealed' | 'dispatched'

/** Colour family for a destination (design tokens, PA-27 "very large text + colour"). */
export type Tone = 'info' | 'success' | 'warning' | 'neutral'

export interface Destination {
  /** Destination hub id, or LOCAL for this city's deliveries */
  key: string
  /** Upper-case city for the big sort display, e.g. HUBBALLI */
  name: string
  tone: Tone
}

export interface HubItem {
  leg: Leg
  shipment: Shipment
  stage: HubStage
  /** Pieces at (or coming to) the hub */
  pieceIds: Id[]
  /** Who brings it: the previous leg */
  from: Leg
  /** Expected arrival: end of the previous leg's window */
  eta: IsoDateTime
  dest: Destination
}

const TONES: Record<string, Tone> = { 'HUB-HBL': 'info', 'HUB-BLR': 'success', 'HUB-BOM': 'warning' }

export const isHubLeg = (leg: Leg) => leg.type === 'originHub' || leg.type === 'destHub'

/** The hub a hub leg happens at. */
export function hubIdOfLeg(data: DemoData, leg: Leg): Id | undefined {
  const s = data.shipments[leg.shipmentId]
  return data.pincodes[leg.type === 'destHub' ? s.destPincode : s.originPincode]?.hubId
}

/** Where pieces go after this hub leg: another hub by truck, or local delivery. */
export function destinationOf(data: DemoData, leg: Leg): Destination {
  const s = data.shipments[leg.shipmentId]
  const next = nextLegOf(data, leg)
  if (next?.type === 'lineHaul') {
    const hubId = data.pincodes[s.destPincode].hubId!
    return { key: hubId, name: data.pincodes[data.hubs[hubId].pincode].city.toUpperCase(), tone: TONES[hubId] ?? 'neutral' }
  }
  return { key: 'LOCAL', name: data.pincodes[s.destPincode].city.toUpperCase(), tone: 'neutral' }
}

/** "BAG-GGN-07" → "BAG 07" */
export const bagLabel = (bag: Pick<Bag, 'id'>) => `BAG ${bag.id.split('-').pop()}`

/** The destination's display name for a bag or manifest. */
export function destinationName(data: DemoData, key: string, hubId: Id): string {
  if (key === 'LOCAL') return data.pincodes[data.hubs[hubId].pincode].city.toUpperCase()
  const hub = data.hubs[key]
  return hub ? data.pincodes[hub.pincode].city.toUpperCase() : key
}

export function toneOf(key: string): Tone {
  return TONES[key] ?? 'neutral'
}

function legEvents(data: DemoData, legId: Id): ShipmentEvent[] {
  return Object.values(data.events)
    .filter((e) => e.legId === legId)
    .sort((a, b) => a.at.localeCompare(b.at))
}

/** Bags at the hub holding a piece (open or sealed, not yet dispatched). */
export function bagOfPiece(data: DemoData, hubId: Id, pieceId: Id): Bag | undefined {
  return Object.values(data.bags).find((b) => b.hubId === hubId && b.status !== 'dispatched' && b.status !== 'received' && b.pieceIds.includes(pieceId))
}

/**
 * Every shipment passing the hub that is still open, or due today: hub legs not
 * finished (or withdrawn), whose window starts on or before today.
 */
export function hubItems(data: DemoData, hubId: Id, now: IsoDateTime): HubItem[] {
  const today = istDate(now)
  const items: HubItem[] = []
  for (const leg of Object.values(data.legs)) {
    if (!isHubLeg(leg) || hubIdOfLeg(data, leg) !== hubId) continue
    if (['withdrawn', 'closed'].includes(leg.status)) continue
    const from = prevLegOf(data, leg)
    if (!from) continue
    const s = data.shipments[leg.shipmentId]
    if (s.status === 'cancelled') continue
    const events = legEvents(data, leg.id)
    const last = <T extends ShipmentEvent['type']>(type: T) => events.filter((e) => e.type === type).at(-1)
    const received = last('handoverReceived')
    const inScan = last('hubInScan')
    const sealed = last('bagSealed')
    const out = last('hubOutScan')

    let stage: HubStage
    if (out || leg.status === 'handedOver') stage = 'dispatched'
    else if (sealed) stage = 'sealed'
    else if (inScan) stage = 'toSort'
    else if (received) stage = 'toInScan'
    else stage = 'expected'

    const pieceIds = inScan?.pieceIds ?? received?.pieceIds ?? s.pieces.map((p) => p.id)
    if (stage === 'toSort' && pieceIds.every((p) => bagOfPiece(data, hubId, p))) stage = 'sorted'

    // Finished work leaves the shift view after its day; expected work shows on its day
    if (stage === 'dispatched' && istDate((out ?? events.at(-1))?.at ?? leg.updatedAt) !== today) continue
    // Expected = goods on their way: the leg before is under way, or it is a pickup due today
    const onTheWay = underWay(from) || (from.type === 'firstMile' && ['offered', 'accepted', 'assigned'].includes(from.status) && istDate(from.window.from) === today)
    if (stage === 'expected' && !onTheWay) continue

    items.push({ leg, shipment: s, stage, pieceIds, from, eta: from.window.to, dest: destinationOf(data, leg) })
  }
  return items.sort((a, b) => a.eta.localeCompare(b.eta) || a.shipment.id.localeCompare(b.shipment.id))
}

/** Pieces in the hub waiting to be sorted, with their shipment item. */
export function piecesToSort(items: HubItem[], data: DemoData, hubId: Id) {
  return items
    .filter((i) => i.stage === 'toSort')
    .flatMap((i) => i.pieceIds.filter((p) => !bagOfPiece(data, hubId, p)).map((pieceId) => ({ pieceId, item: i })))
}

/** The open bag for a destination, if there is one. */
export function openBagFor(data: DemoData, hubId: Id, destKey: string): Bag | undefined {
  return Object.values(data.bags)
    .filter((b) => b.hubId === hubId && b.destination === destKey && b.status === 'open')
    .sort((a, b) => a.id.localeCompare(b.id))[0]
}

/** Next bag id at the hub: BAG-GGN-08 after BAG-GGN-07. */
export function nextBagId(data: DemoData, hubId: Id): Id {
  const code = hubId.replace('HUB-', '')
  const nums = Object.values(data.bags)
    .filter((b) => b.hubId === hubId)
    .map((b) => Number(b.id.split('-').pop()))
  return `BAG-${code}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, '0')}`
}

/** Next manifest id at the hub: MAN-GGN-1124 after MAN-GGN-1123. */
export function nextManifestId(data: DemoData, hubId: Id): Id {
  const code = hubId.replace('HUB-', '')
  const nums = Object.values(data.manifests)
    .filter((m) => m.hubId === hubId)
    .map((m) => Number(m.id.split('-').pop()))
  return `MAN-${code}-${(nums.length ? Math.max(...nums) : 1000) + 1}`
}

/** The planned trip leaving this hub for a destination hub, soonest first. */
export function tripFor(data: DemoData, hubId: Id, destKey: string): Trip | undefined {
  return Object.values(data.trips)
    .filter((t) => t.status === 'planned' && data.lanes[t.laneId]?.originHubId === hubId && data.lanes[t.laneId]?.destHubId === destKey)
    .sort((a, b) => a.departAt.localeCompare(b.departAt))[0]
}

/** Open manifests a sealed bag for this destination can join. */
export function openManifestsFor(data: DemoData, hubId: Id, destKey: string): Manifest[] {
  return Object.values(data.manifests).filter((m) => m.hubId === hubId && m.destination === destKey && m.status !== 'dispatched')
}

/** Shipments (and their hub legs) in a set of bags. */
export function shipmentsInBags(data: DemoData, bags: Bag[]) {
  const byLr = new Map<Id, Id[]>()
  for (const b of bags) for (const p of b.pieceIds) byLr.set(p.slice(0, -3), [...(byLr.get(p.slice(0, -3)) ?? []), p])
  return [...byLr.entries()].map(([lr, pieceIds]) => {
    const s = data.shipments[lr]
    const hubId = bags[0]?.hubId
    const leg = s.legIds.map((id) => data.legs[id]).find((l) => isHubLeg(l) && hubIdOfLeg(data, l) === hubId)!
    return { shipment: s, leg, pieceIds }
  })
}

/** PA-25 stage tiles. */
export function hubTiles(data: DemoData, hubId: Id, items: HubItem[]) {
  const bags = Object.values(data.bags).filter((b) => b.hubId === hubId)
  const legIds = new Set(items.map((i) => i.leg.id))
  const prevIds = new Set(items.map((i) => i.from.id))
  const pieces = (stage: HubStage) => items.filter((i) => i.stage === stage).reduce((n, i) => n + i.pieceIds.length, 0)
  return {
    toInScan: pieces('toInScan'),
    toSort: piecesToSort(items, data, hubId).length,
    bagsOpen: bags.filter((b) => b.status === 'open').length,
    bagsToSeal: bags.filter((b) => b.status === 'open' && b.pieceIds.length > 0).length,
    toDispatch: bags.filter((b) => b.status === 'sealed').length,
    exceptions: Object.values(data.exceptions).filter((x) => x.status !== 'resolved' && x.legId && (legIds.has(x.legId) || prevIds.has(x.legId))).length,
  }
}

/** PA-25 outbound departures: planned or loading trips from this hub. */
export function departures(data: DemoData, hubId: Id) {
  return Object.values(data.trips)
    .filter((t) => (t.status === 'planned' || t.status === 'loading') && data.lanes[t.laneId]?.originHubId === hubId)
    .sort((a, b) => a.departAt.localeCompare(b.departAt))
    .map((trip) => {
      const destKey = data.lanes[trip.laneId].destHubId
      const manifests = Object.values(data.manifests).filter((m) => m.tripId === trip.id)
      return { trip, destKey, name: destinationName(data, destKey, hubId), vehicle: data.vehicles[trip.vehicleId], manifests, bags: manifests.reduce((n, m) => n + m.bagIds.length, 0) }
    })
}
