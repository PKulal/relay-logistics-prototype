/**
 * Last mile (Partner App PA-31 to PA-33, and the hub → rider hand-over before it).
 * Every step is a chain-of-custody event; e-POD is the delivered event itself.
 */
import { nextLegOf, prevLegOf } from '@shared/engines/fieldTasks'
import { addHours } from '@shared/lib/time'
import { makeHandoverCode } from '@shared/sim/handover'
import type { DemoData, Id, IsoDateTime, ShipmentEvent, ShipmentException } from '@shared/types'
import { applyEvents } from './actions'
import { eventIdFactory } from './booking'
import { exceptionId, handoverState, receiveHandover } from './handoverActions'
import { dropSim } from './hubActions'

/** Pieces a hub leg holds: in-scanned, else received. */
function hubPieces(data: DemoData, legId: Id): Id[] {
  const evs = Object.values(data.events).filter((e) => e.legId === legId)
  return (evs.filter((e) => e.type === 'hubInScan').at(-1) ?? evs.filter((e) => e.type === 'handoverReceived').at(-1))?.pieceIds ?? []
}

const withEvents = (data: DemoData, evs: ShipmentEvent[]): DemoData => ({ ...data, events: { ...data.events, ...Object.fromEntries(evs.map((e) => [e.id, e])) } })

export interface GiveToRider {
  hubId: Id
  /** Hub legs whose next leg is this rider's delivery */
  legIds: Id[]
  staffId: Id
  /** Goods at hand-over */
  photos: string[]
}

/**
 * Hub → rider hand-over (PA-19 for the last mile): one code for all of the
 * rider's shipments. The pieces leave any open local bag.
 */
export function giveToRider(data: DemoData, x: GiveToRider, at: IsoDateTime): DemoData {
  const legs = x.legIds.map((id) => data.legs[id]).filter((l) => l && l.status === 'inProgress' && nextLegOf(data, l)?.type === 'lastMile')
  if (!legs.length) return data
  const rider = nextLegOf(data, legs[0])!.staffId
  const code = makeHandoverCode(`${rider ?? 'rider'}-${x.hubId}`, at)
  const events: ShipmentEvent[] = []
  for (const leg of legs) {
    const { given, received } = handoverState(data, leg.id)
    if (given && !received) continue // already waiting
    const id = eventIdFactory(withEvents(data, events), leg.shipmentId)()
    events.push({ id, shipmentId: leg.shipmentId, legId: leg.id, type: 'handoverGiven', at, by: x.staffId, app: 'partnerApp', pieceIds: hubPieces(data, leg.id), counterpartStaffId: nextLegOf(data, leg)?.staffId, handoverCode: code, photos: x.photos, note: 'To rider' })
  }
  const pieces = new Set(events.flatMap((e) => e.pieceIds ?? []))
  const bags = { ...data.bags }
  for (const b of Object.values(bags)) {
    if (b.hubId === x.hubId && b.status === 'open' && b.pieceIds.some((p) => pieces.has(p))) bags[b.id] = { ...b, pieceIds: b.pieceIds.filter((p) => !pieces.has(p)) }
  }
  return applyEvents(dropSim({ ...data, bags }, events.map((e) => e.shipmentId)), events, at)
}

/** The code a hub is showing to this rider (the latest pending hand-over to them). */
export function riderCode(data: DemoData, riderId: Id): string | undefined {
  return Object.values(data.events)
    .filter((e) => e.type === 'handoverGiven' && e.counterpartStaffId === riderId && e.handoverCode)
    .filter((e) => {
      const leg = data.legs[e.legId!]
      const next = leg && nextLegOf(data, leg)
      return next?.type === 'lastMile' && !Object.values(data.events).some((r) => r.legId === next.id && r.type === 'handoverReceived')
    })
    .sort((a, b) => a.at.localeCompare(b.at))
    .at(-1)?.handoverCode
}

export interface ReceiveLoad {
  /** The rider's delivery legs being loaded */
  legIds: Id[]
  staffId: Id
  code: string
  /** Pieces scanned at the hub */
  pieceIds: Id[]
}

/** PA-31 load check: the rider takes every shipment handed over with the code (PA-20 per shipment). */
export function receiveLoad(data: DemoData, x: ReceiveLoad, at: IsoDateTime): DemoData {
  let next = data
  for (const legId of x.legIds) {
    const leg = data.legs[legId]
    const prev = leg && prevLegOf(data, leg)
    const given = prev ? handoverState(data, prev.id).given : undefined
    if (!given || given.handoverCode !== x.code) continue
    next = receiveHandover(next, { legId, staffId: x.staffId, code: x.code, pieceIds: (given.pieceIds ?? []).filter((p) => x.pieceIds.includes(p)), brokenSeals: [], damagedPieceIds: [], photos: [] }, at)
  }
  return next
}

/**
 * PA-31 "Start run": loaded shipments → Out for Delivery. Each consignee gets
 * the delivery window with the rider's masked number (SIMULATED WhatsApp, §7 Step 8).
 */
export function startRun(data: DemoData, legIds: Id[], staffId: Id, at: IsoDateTime): DemoData {
  const events: ShipmentEvent[] = []
  for (const legId of legIds) {
    const leg = data.legs[legId]
    if (!leg || leg.type !== 'lastMile' || leg.status !== 'assigned') continue
    if (!Object.values(data.events).some((e) => e.legId === legId && e.type === 'handoverReceived')) continue
    const id = eventIdFactory(withEvents(data, events), leg.shipmentId)()
    events.push({ id, shipmentId: leg.shipmentId, legId, type: 'runStarted', at, by: staffId, app: 'partnerApp', note: `Delivery window ${leg.window.from.slice(11, 16)}–${leg.window.to.slice(11, 16)} sent to consignee with masked rider contact` })
  }
  return applyEvents(dropSim(data, events.map((e) => e.shipmentId)), events, at)
}

export type PieceCondition = { state: 'ok' } | { state: 'short' | 'damaged'; photo: string; remark: string }

export interface CompleteDelivery {
  legId: Id
  staffId: Id
  /** Every piece of the shipment with what was found */
  pieces: Record<Id, PieceCondition>
  receivedBy: string
  verification: 'otp' | 'signature'
  grn?: string
  photo: string
}

/**
 * PA-33 "Complete delivery": short / damaged pieces are recorded first (with
 * photos), then the e-POD (delivered event) → Delivered, or Delivered with
 * Exception. The shipper gets the e-POD (SIMULATED message).
 */
export function completeDelivery(data: DemoData, x: CompleteDelivery, at: IsoDateTime): DemoData {
  const leg = data.legs[x.legId]
  if (!leg || leg.type !== 'lastMile' || leg.status !== 'inProgress') return data
  const s = data.shipments[leg.shipmentId]
  const dest = data.pincodes[s.destPincode] // SIMULATED GPS: the consignee's pincode
  const events: ShipmentEvent[] = []
  const exceptions: Record<Id, ShipmentException> = {}
  const add = (e: Omit<ShipmentEvent, 'id' | 'shipmentId' | 'legId'>) => events.push({ id: eventIdFactory(withEvents(data, events), s.id)(), shipmentId: s.id, legId: leg.id, ...e })

  for (const kind of ['short', 'damaged'] as const) {
    const found = Object.entries(x.pieces).filter(([, c]) => c.state === kind) as [Id, Extract<PieceCondition, { photo: string }>][]
    if (!found.length) continue
    const type = kind === 'short' ? 'short' : 'damage'
    add({ type: 'exceptionReported', at, by: x.staffId, app: 'partnerApp', exceptionKind: type, pieceIds: found.map(([p]) => p), photos: found.map(([, c]) => c.photo), note: found.map(([p, c]) => `${p.slice(-2)}: ${c.remark}`).join('; '), lat: dest.lat, lng: dest.lng })
    const id = exceptionId({ ...data, exceptions: { ...data.exceptions, ...exceptions } }, s.id)
    exceptions[id] = { id, shipmentId: s.id, legId: leg.id, type, raisedAt: at, actionDueAt: addHours(at, 4), ownerPartnerId: leg.partnerId, status: 'open', customerConfirmed: false }
  }
  add({
    type: 'delivered',
    at,
    by: x.staffId,
    app: 'partnerApp',
    lat: dest.lat,
    lng: dest.lng,
    pieceIds: Object.entries(x.pieces)
      .filter(([, c]) => c.state !== 'short')
      .map(([p]) => p),
    photos: [x.photo],
    receivedBy: x.receivedBy,
    grn: x.grn || undefined,
    note: x.verification === 'otp' ? 'OTP verified' : 'e-signature',
  })
  let next = applyEvents(dropSim(data, [s.id]), events, at)
  next = { ...next, exceptions: { ...next.exceptions, ...exceptions } }
  // SIMULATED: e-POD to the shipper (WhatsApp / email); lands in their notifications
  const id = `NTF-${String(Object.keys(next.notifications).length + 1).padStart(5, '0')}`
  next = {
    ...next,
    notifications: {
      ...next.notifications,
      [id]: { id, audience: { app: 'customer', customerId: s.customerId }, title: `${s.id}: delivered`, body: `e-POD: received by ${x.receivedBy}${x.grn ? ` · ${x.grn}` : ''}`, link: `/customer/shipments/${s.id}`, at, read: false },
    },
  }
  return next
}
