/**
 * Failed delivery (NDR): the rider records it (PA-35); the shipper (CP-21) or the
 * consignee (CP-18 / WhatsApp) chooses Reattempt · Change slot / address · RTO;
 * the first response applies and the other side is told (source §5.1, §7 Step
 * 10, §10 Step 3). A reattempt goes back to the rider as a delivery task.
 */
import { CALL_LOG_MINUTES, ndrDueAt, ndrsOf, nextWorkingDays, openNdr, rtoCharge } from '@shared/engines/ndr'
import { addHours, istDate, minutesBetween } from '@shared/lib/time'
import type { DemoData, Id, IsoDate, IsoDateTime, Ndr, NdrReason, Notification, ShipmentEvent } from '@shared/types'
import { applyEvents } from './actions'
import { chargeCustomer } from './billing'
import { eventIdFactory } from './booking'
import { audit } from './erpActions'
import { exceptionId } from './handoverActions'
import { dropSim } from './hubActions'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const setNdr = (data: DemoData, n: Ndr): DemoData => ({ ...data, ndrs: { ...data.ndrs, [n.id]: n } })
/** Shipper users who act on NDRs (Admin, Dispatch). */
const shipperUsers = (data: DemoData, lr: Id) => Object.values(data.customerUsers).filter((u) => u.customerId === data.shipments[lr].customerId && u.role !== 'finance')

export interface ReportNdr {
  legId: Id
  staffId: Id
  reason: NdrReason
  photo: string
  note?: string
  /** Time of the masked call to the consignee */
  calledAt?: IsoDateTime
}

/** PA-35 needs a location photo and a masked call in the last 15 minutes (assumed, to stop fake attempts). */
export function canReportNdr(x: Pick<ReportNdr, 'photo' | 'calledAt'>, now: IsoDateTime): boolean {
  return !!x.photo && !!x.calledAt && minutesBetween(x.calledAt, now) <= CALL_LOG_MINUTES
}

/**
 * PA-35 Submit: shipment → Undelivered (NDR); the NDR ticket is raised; the
 * shipper and consignee are asked to choose. The third failed attempt goes to
 * RTO by itself (assumed).
 */
export function reportNdr(data: DemoData, x: ReportNdr, at: IsoDateTime): DemoData {
  const leg = data.legs[x.legId]
  if (!leg || leg.type !== 'lastMile' || leg.status !== 'inProgress' || !canReportNdr(x, at)) return data
  const s = data.shipments[leg.shipmentId]
  const dest = data.pincodes[s.destPincode] // SIMULATED GPS at the consignee's pincode
  const attempt = ndrsOf(data, s.id).length + 1
  const ev: ShipmentEvent = { id: eventIdFactory(data, s.id)(), shipmentId: s.id, legId: leg.id, type: 'deliveryFailed', at, by: x.staffId, app: 'partnerApp', reason: x.reason, note: x.note?.trim() || undefined, photos: [x.photo], lat: dest.lat, lng: dest.lng }
  let next = applyEvents(dropSim(data, [s.id]), [ev], at)
  const ndr: Ndr = { id: `NDR-${s.id.slice(-6)}-${attempt}`, shipmentId: s.id, legId: leg.id, attempt, reason: x.reason, photo: x.photo, note: ev.note, calledAt: x.calledAt, at }
  next = setNdr(next, ndr)
  const excId = exceptionId(next, s.id)
  next = { ...next, exceptions: { ...next.exceptions, [excId]: { id: excId, shipmentId: s.id, legId: leg.id, type: 'ndr', raisedAt: at, actionDueAt: addHours(at, 24), ownerPartnerId: leg.partnerId, aiCause: 'consignee', status: 'open', customerConfirmed: false } } }
  if (attempt >= data.settings.ndrMaxAttempts) return respondNdr(next, s.id, { kind: 'rto' }, 'system', at)
  // SIMULATED WhatsApp with buttons to the consignee (shown on CP-18); in-app to the shipper
  for (const u of shipperUsers(next, s.id)) next = notify(next, { app: 'customer', userId: u.id }, 'Delivery failed: choose what to do', `${s.id} · ${x.reason}`, `/customer/exceptions/ndr/${s.id}`, at)
  return next
}

export type NdrChoice =
  | { kind: 'reattempt'; date: IsoDate; from: string; to: string; instructions?: string }
  | { kind: 'changeSlot'; date: IsoDate; from: string; to: string; contact?: string; address?: string; instructions?: string }
  | { kind: 'rto' }

/**
 * CP-21 / CP-18 response. The first response applies; a later one is ignored.
 * Reattempt / change slot: the delivery job gets the new window and goes back
 * to the rider. RTO: shipment → Return to Origin and the RTO charge.
 */
export function respondNdr(data: DemoData, lr: Id, c: NdrChoice, by: Id, at: IsoDateTime): DemoData {
  const n = openNdr(data, lr)
  if (!n) return data
  const s = data.shipments[lr]
  const leg = data.legs[n.legId ?? s.legIds.at(-1)!]
  const app = by === 'system' ? 'system' : 'customer'
  const evId = eventIdFactory(data, lr)
  let next = dropSim(data, [lr])
  let record: Ndr = { ...n, legId: leg.id, customerChoice: c.kind, choiceBy: by, choiceAt: at }

  if (c.kind === 'rto') {
    const charge = rtoCharge(next, lr)
    next = applyEvents(next, [{ id: evId(), shipmentId: lr, legId: leg.id, type: 'rtoInitiated', at, by, app, note: by === 'system' ? `After ${n.attempt} failed attempts` : undefined }], at)
    next = chargeCustomer(next, s.customerId, charge, `RTO-${lr}`, at).data
    record = { ...record, rtoCharge: charge }
  } else {
    const window = { from: `${c.date}T${c.from}:00+05:30`, to: `${c.date}T${c.to}:00+05:30` }
    next = { ...next, legs: { ...next.legs, [leg.id]: { ...leg, window } } }
    const extra = c.kind === 'changeSlot' ? [c.address && `New address: ${c.address}`, c.contact && `Contact: ${c.contact}`] : []
    const note = [`Reattempt ${c.date} ${c.from}–${c.to}`, ...extra, c.instructions].filter(Boolean).join(' · ')
    next = applyEvents(next, [{ id: evId(), shipmentId: lr, legId: leg.id, type: 'reattemptScheduled', at, by, app, note }], at)
    record = { ...record, newSlot: { date: c.date, from: c.from, to: c.to }, instructions: c.instructions?.trim() || undefined, ...(c.kind === 'changeSlot' && { updatedContact: c.contact?.trim() || undefined, updatedAddress: c.address?.trim() || undefined }) }
  }
  next = setNdr(next, record)
  // The NDR ticket closes with the response: it is the customer's confirmation (source §10 Step 2)
  next = { ...next, exceptions: Object.fromEntries(Object.entries(next.exceptions).map(([k, x]) => [k, x.shipmentId === lr && x.type === 'ndr' && x.status !== 'resolved' ? { ...x, status: 'resolved' as const, customerConfirmed: true } : x])) }

  // Tell the other side and the last-mile partner. When the shipper answers, the
  // consignee sees the outcome on CP-18 / WhatsApp; otherwise the shipper is told.
  const what = c.kind === 'rto' ? 'Return to origin' : `Reattempt ${c.date} ${c.from}–${c.to}`
  if (by === 'consignee' || by === 'system')
    for (const u of shipperUsers(next, lr)) next = notify(next, { app: 'customer', userId: u.id }, by === 'consignee' ? 'The consignee answered the failed delivery' : 'Failed delivery: applied automatically', `${lr} · ${what}`, `/customer/exceptions/ndr/${lr}`, at)
  next = notify(next, { app: 'partnerPortal', partnerId: leg.partnerId }, c.kind === 'rto' ? 'Shipment to be returned' : 'Reattempt scheduled', `${lr} · ${what}`, `/partner/jobs/${leg.id}`, at)
  // PA-08: the rider who attempted it sees the customer's choice
  if (leg.staffId) next = notify(next, { app: 'partnerApp', userId: leg.staffId }, c.kind === 'rto' ? 'Return to origin' : 'Customer chose reattempt', `${lr} · ${what}`, '/app', at)
  return audit(next, { userId: by, app: 'customer', action: `ndr.${c.kind}`, recordId: record.id, at, after: c })
}

/**
 * Demo-clock rule: an NDR with no response by its due time is reattempted on the
 * next working day, in the job's original time window (CP-21, assumed).
 */
export function autoReattempt(data: DemoData, now: IsoDateTime): DemoData {
  let next = data
  // Only NDRs recorded in the demo (PA-35, seed 000776); generator background shipments stay as they are
  for (const s of Object.values(data.shipments)) {
    if (s.status !== 'undelivered' || !Object.values(next.ndrs).some((r) => r.shipmentId === s.id)) continue
    const n = openNdr(next, s.id)
    if (!n || Date.parse(ndrDueAt(next, n)) > Date.parse(now)) continue
    const leg = next.legs[n.legId ?? s.legIds.at(-1)!]
    const date = nextWorkingDays(istDate(now), 1)[0]
    next = respondNdr(next, s.id, { kind: 'reattempt', date, from: leg.window.from.slice(11, 16), to: leg.window.to.slice(11, 16) }, 'system', now)
  }
  return next
}
