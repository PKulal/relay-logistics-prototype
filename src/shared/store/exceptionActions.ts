/**
 * Field and partner exceptions (source §5.1 Escalations, NDR, SOS; §7 Step 7
 * short / excess at the hub; §10 Step 3 pickup missed, seal mismatch / short):
 * PA-18 pickup failed, PA-30 hub report, PP-20 acknowledge / resolve,
 * PP-21 reattempt assignment, PA-12 SOS, and the demo toolbar's injected ticket.
 */
import { CALL_LOG_MINUTES } from '@shared/engines/ndr'
import { ACTION_HOURS } from '@shared/engines/exceptionDetect'
import { ackDueAt, ackHours } from '@shared/engines/escalations'
import { addHours, minutesBetween } from '@shared/lib/time'
import type { DemoData, ExceptionKind, Id, IsoDateTime, Notification, PartnerRootCause, RootCause, ShipmentEvent, ShipmentException, SosAlert } from '@shared/types'
import { applyEvents } from './actions'
import { eventIdFactory } from './booking'
import { audit } from './erpActions'
import { exceptionId } from './handoverActions'
import { dropSim } from './hubActions'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const toTower = { app: 'erp' as const, role: 'controlTower' }
const toPartner = (partnerId: Id) => ({ app: 'partnerPortal' as const, partnerId })
const setException = (data: DemoData, x: ShipmentException): DemoData => ({ ...data, exceptions: { ...data.exceptions, [x.id]: x } })
const withPartnerTimer = (data: DemoData, x: ShipmentException): ShipmentException => (x.ownerPartnerId ? { ...x, partner: { ackDueAt: addHours(x.raisedAt, ackHours(data, x.ownerPartnerId)) } } : x)

// ── PA-18 pickup failed ─────────────────────────────────────────────────────

export const PICKUP_FAIL_REASONS = ['goodsNotReady', 'shipperClosed', 'shipperRefused', 'documentsMissing', 'addressWrong', 'vehicleTooSmall', 'other'] as const
export type PickupFailReason = (typeof PICKUP_FAIL_REASONS)[number]

export interface PickupFailed {
  legId: Id
  staffId: Id
  reason: PickupFailReason
  photo: string
  note?: string
  /** SIMULATED masked call to the shipper */
  calledAt?: IsoDateTime
}

const FAIL_CAUSE: Record<PickupFailReason, RootCause> = { goodsNotReady: 'consignee', shipperClosed: 'consignee', shipperRefused: 'consignee', documentsMissing: 'consignee', addressWrong: 'consignee', vehicleTooSmall: 'vehicle', other: 'pickupDelay' }

/** No fake attempts: a photo and a call to the shipper in the last 15 minutes (assumed, as for NDR). */
export const canReportPickupFail = (x: PickupFailed, at: IsoDateTime) => !!x.photo && !!x.calledAt && minutesBetween(x.calledAt, at) <= CALL_LOG_MINUTES && minutesBetween(x.calledAt, at) >= 0

/** PA-18: task → failed; a pickup-missed ticket for the desk (2 h to reassign, source §10) and the partner office. */
export function reportPickupFailed(data: DemoData, x: PickupFailed, at: IsoDateTime): DemoData {
  const leg = data.legs[x.legId]
  if (!leg || leg.type !== 'firstMile' || leg.staffId !== x.staffId || !['assigned', 'inProgress'].includes(leg.status) || !canReportPickupFail(x, at)) return data
  const s = data.shipments[leg.shipmentId]
  if (s.status !== 'booked') return data
  const origin = data.pincodes[s.originPincode] // SIMULATED GPS
  const ev: ShipmentEvent = { id: eventIdFactory(data, s.id)(), shipmentId: s.id, legId: leg.id, type: 'pickupFailed', at, by: x.staffId, app: 'partnerApp', reason: x.reason, note: x.note?.trim() || undefined, photos: [x.photo], lat: origin.lat, lng: origin.lng }
  let next = applyEvents(dropSim(data, [s.id]), [ev], at)
  const report = { by: x.staffId, photos: [x.photo], note: x.note?.trim() || undefined, reason: x.reason }
  const open = Object.values(next.exceptions).find((t) => t.legId === leg.id && t.type === 'pickupMissed' && t.status !== 'resolved')
  if (open) next = setException(next, { ...open, report, aiCause: FAIL_CAUSE[x.reason] })
  else {
    const id = exceptionId(next, s.id)
    next = setException(next, withPartnerTimer(next, { id, shipmentId: s.id, legId: leg.id, type: 'pickupMissed', raisedAt: at, actionDueAt: addHours(at, ACTION_HOURS.pickupMissed!), ownerPartnerId: leg.partnerId, aiCause: FAIL_CAUSE[x.reason], status: 'open', customerConfirmed: false, report }))
  }
  next = notify(next, toTower, 'Pickup failed', `${s.id} · ${x.reason}`, '/erp/control-tower/exceptions', at)
  return notify(next, toPartner(leg.partnerId), 'Pickup failed', `${leg.id} · ${data.fieldStaff[x.staffId].name}`, '/partner/escalations', at)
}

// ── PA-30 short / excess / damage / seal mismatch at the hub ────────────────

export const HUB_REPORT_KINDS = ['short', 'excess', 'damage', 'sealMismatch'] as const
export type HubReportKind = (typeof HUB_REPORT_KINDS)[number]

export interface HubReport {
  legId: Id
  staffId: Id
  kind: HubReportKind
  pieceIds: Id[]
  photos: string[]
  note?: string
}

/**
 * PA-30: a ticket against the previous leg's partner (source §10: investigate
 * the previous leg, hold, 4 hours). The hold is the open ticket; the hub leg
 * keeps moving so the rest of the shipment isn't blocked.
 */
export function reportHubException(data: DemoData, x: HubReport, at: IsoDateTime): { data: DemoData; id?: Id } {
  const leg = data.legs[x.legId]
  if (!leg || !x.pieceIds.length || !x.photos.length || x.photos.length > 5) return { data }
  const s = data.shipments[leg.shipmentId]
  const prev = s.legIds[leg.seq - 2] ? data.legs[s.legIds[leg.seq - 2]] : undefined
  const ev: ShipmentEvent = { id: eventIdFactory(data, s.id)(), shipmentId: s.id, type: 'exceptionReported', at, by: x.staffId, app: 'partnerApp', exceptionKind: x.kind as ExceptionKind, pieceIds: x.pieceIds, photos: x.photos, note: [`At ${data.hubs[data.fieldStaff[x.staffId]?.hubId ?? '']?.name ?? 'hub'}`, x.note?.trim()].filter(Boolean).join(' · ') }
  let next = applyEvents(dropSim(data, [s.id]), [ev], at)
  const id = exceptionId(next, s.id)
  const owner = prev?.partnerId ?? leg.partnerId
  next = setException(
    next,
    withPartnerTimer(next, { id, shipmentId: s.id, legId: prev?.id ?? leg.id, type: x.kind, raisedAt: at, actionDueAt: addHours(at, ACTION_HOURS[x.kind] ?? 4), ownerPartnerId: owner, aiCause: 'handoverGap', status: 'open', customerConfirmed: false, report: { by: x.staffId, pieceIds: x.pieceIds, photos: x.photos, note: x.note?.trim() || undefined } }),
  )
  next = notify(next, toTower, `Hub report: ${x.kind}`, `${s.id} · ${x.pieceIds.join(', ')}`, '/erp/control-tower/exceptions', at)
  return { data: notify(next, toPartner(owner), 'Escalation raised', `${id} · ${s.id}`, '/partner/escalations', at), id }
}

// ── PP-20 escalations ───────────────────────────────────────────────────────

/** Acknowledge: stops the acknowledgement timer. */
export function acknowledgeTicket(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const x = data.exceptions[id]
  if (!x || !x.ownerPartnerId || x.status === 'resolved' || x.partner?.ackAt) return data
  const next = setException(data, { ...x, status: 'inProgress', partner: { ...x.partner, ackDueAt: ackDueAt(data, x), ackAt: at, ackBy: by }, log: [...(x.log ?? []), { at, by, action: 'partnerAck' }] })
  return audit(next, { userId: by, app: 'partnerPortal', action: 'ticket.acknowledge', recordId: id, at })
}

export interface TicketResolution {
  response: string
  rootCause: PartnerRootCause
  evidence: string[]
}

/** Resolve: the partner's resolution goes to the Control Tower; Logisco closes the ticket (ERP-07). */
export function resolvePartnerTicket(data: DemoData, id: Id, r: TicketResolution, by: Id, at: IsoDateTime): DemoData {
  const x = data.exceptions[id]
  if (!x || !x.ownerPartnerId || x.status === 'resolved' || x.partner?.resolvedAt || !r.response.trim()) return data
  const ack = x.partner?.ackAt ? {} : { ackAt: at, ackBy: by }
  let next = setException(data, {
    ...x,
    status: 'inProgress',
    partner: { ...x.partner, ackDueAt: ackDueAt(data, x), ...ack, response: r.response.trim(), rootCause: r.rootCause, evidence: r.evidence, resolvedAt: at, resolvedBy: by },
    log: [...(x.log ?? []), { at, by, action: 'partnerResolved', note: r.response.trim() }],
  })
  next = notify(next, toTower, 'Partner resolved a ticket', `${id} · ${data.partners[x.ownerPartnerId].shortName}`, '/erp/control-tower/exceptions', at)
  return audit(next, { userId: by, app: 'partnerPortal', action: 'ticket.partnerResolve', recordId: id, at, after: r })
}

/** Demo toolbar "Inject exception": a missed-scan escalation on one of the partner's jobs in progress. */
export function injectEscalation(data: DemoData, partnerId: Id, at: IsoDateTime): { data: DemoData; id?: Id } {
  const busy = new Set(Object.values(data.exceptions).filter((x) => x.status !== 'resolved').map((x) => x.legId))
  const leg = Object.values(data.legs)
    .filter((l) => l.partnerId === partnerId && ['inProgress', 'handedOver', 'assigned'].includes(l.status) && !busy.has(l.id))
    .sort((a, b) => b.window.from.localeCompare(a.window.from))[0]
  if (!leg) return { data }
  const id = exceptionId(data, leg.shipmentId)
  let next = setException(data, withPartnerTimer(data, { id, shipmentId: leg.shipmentId, legId: leg.id, type: 'missedScan', raisedAt: at, actionDueAt: addHours(at, 4), ownerPartnerId: partnerId, aiCause: 'handoverGap', status: 'open', customerConfirmed: false, auto: true }))
  next = notify(next, toPartner(partnerId), 'Escalation raised', `${id} · ${leg.id}`, '/partner/escalations', at)
  return { data: notify(next, toTower, 'Missed scan', `${leg.shipmentId} · ${leg.id}`, '/erp/control-tower/exceptions', at), id }
}

// ── PP-21 reattempt assignment ──────────────────────────────────────────────

/** "Assign reattempt": the delivery job goes back to the chosen rider with the customer's new slot. */
export function assignReattempt(data: DemoData, legId: Id, staffId: Id, by: Id, at: IsoDateTime): DemoData {
  const leg = data.legs[legId]
  const rider = data.fieldStaff[staffId]
  if (!leg || leg.type !== 'lastMile' || leg.status !== 'assigned' || !rider || rider.partnerId !== leg.partnerId || rider.role !== 'rider') return data
  const ev: ShipmentEvent = { id: eventIdFactory(data, leg.shipmentId)(), shipmentId: leg.shipmentId, legId, type: 'legAssigned', at, by, app: 'partnerPortal', assigneeStaffId: staffId, assigneeVehicleId: rider.vehicleId, note: 'Reattempt' }
  const next = applyEvents({ ...data, legs: { ...data.legs, [legId]: { ...leg, staffId, vehicleId: rider.vehicleId } } }, [ev], at)
  return audit(next, { userId: by, app: 'partnerPortal', action: 'ndr.assignReattempt', recordId: legId, at, after: { staffId } })
}

// ── PA-12 SOS ───────────────────────────────────────────────────────────────

/** Source §5.1 SOS button; cancel allowed within 10 seconds (assumed). */
export const SOS_CANCEL_SECONDS = 10

/** Where the staff member is: their latest event, else their hub / vehicle base (SIMULATED GPS). */
function lastPosition(data: DemoData, staffId: Id): { lat: number; lng: number } {
  const ev = Object.values(data.events)
    .filter((e) => e.by === staffId && e.lat !== undefined)
    .sort((a, b) => b.at.localeCompare(a.at))[0]
  if (ev) return { lat: ev.lat!, lng: ev.lng! }
  const hub = data.hubs[data.fieldStaff[staffId]?.hubId ?? '']
  const pin = hub ? data.pincodes[hub.pincode] : Object.values(data.pincodes)[0]
  return { lat: pin.lat, lng: pin.lng }
}

export function triggerSos(data: DemoData, staffId: Id, at: IsoDateTime): { data: DemoData; id?: Id } {
  const staff = data.fieldStaff[staffId]
  if (!staff || Object.values(data.sosAlerts).some((a) => a.staffId === staffId && a.status === 'active')) return { data }
  const id = `SOS-${String(Object.keys(data.sosAlerts).length + 1).padStart(4, '0')}`
  const alert: SosAlert = { id, staffId, partnerId: staff.partnerId, at, ...lastPosition(data, staffId), status: 'active' }
  let next: DemoData = { ...data, sosAlerts: { ...data.sosAlerts, [id]: alert } }
  next = notify(next, toTower, `SOS: ${staff.name}`, `${data.partners[staff.partnerId].shortName} · ${staff.mobile}`, '/erp/control-tower/partner-health', at)
  next = notify(next, toPartner(staff.partnerId), `SOS: ${staff.name}`, staff.mobile, '/partner', at)
  return { data: next, id }
}

export function setSosKind(data: DemoData, id: Id, kind: NonNullable<SosAlert['kind']>): DemoData {
  const a = data.sosAlerts[id]
  return a && a.status === 'active' ? { ...data, sosAlerts: { ...data.sosAlerts, [id]: { ...a, kind } } } : data
}

export function cancelSos(data: DemoData, id: Id, at: IsoDateTime): DemoData {
  const a = data.sosAlerts[id]
  if (!a || a.status !== 'active' || minutesBetween(a.at, at) * 60 > SOS_CANCEL_SECONDS) return data
  return notify({ ...data, sosAlerts: { ...data.sosAlerts, [id]: { ...a, status: 'cancelled', cancelledAt: at } } }, toTower, 'SOS cancelled', data.fieldStaff[a.staffId].name, '/erp/control-tower/partner-health', at)
}

/** Control Tower closes the alert once the person is safe. */
export function resolveSos(data: DemoData, id: Id, note: string, by: Id, at: IsoDateTime): DemoData {
  const a = data.sosAlerts[id]
  if (!a || a.status !== 'active') return data
  const next = notify({ ...data, sosAlerts: { ...data.sosAlerts, [id]: { ...a, status: 'resolved', resolvedAt: at, resolvedBy: by, note: note.trim() || undefined } } }, toPartner(a.partnerId), 'SOS closed by Logisco', data.fieldStaff[a.staffId].name, '/partner', at)
  return audit(next, { userId: by, app: 'erp', action: 'sos.resolve', recordId: id, at, after: note })
}
