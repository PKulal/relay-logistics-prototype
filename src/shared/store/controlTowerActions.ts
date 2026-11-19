/**
 * Control Tower actions (ERP-06 to ERP-08): reassign a leg (manual override,
 * source §8), act on or dismiss an AI risk suggestion (§11.1, §12 "AI suggests;
 * a person confirms"), auto-tickets and ticket handling (§10 Steps 1–3).
 * Every action is written to the audit log.
 */
import { canReassign, reassignOptions, slaRisks, type RiskAction, type SlaRisk } from '@shared/engines/controlTower'
import { detectExceptions } from '@shared/engines/exceptionDetect'
import type { DemoData, Id, IsoDateTime, Notification, ReassignReason, ShipmentEvent, ShipmentException } from '@shared/types'
import { applyEvents } from './actions'
import { eventIdFactory } from './booking'
import { audit, extendEwayBill, logMaskedCall, messageCustomer, updatePartB } from './erpActions'
import { dropSim } from './hubActions'
import { defaultAssignee, partnerOpsUser } from './staffing'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}

export interface Reassign {
  legId: Id
  partnerId: Id
  reason: ReassignReason
  notify: { oldPartner: boolean; newPartner: boolean; customer: boolean }
  /** Set when the reassignment comes from an ERP-06 suggestion */
  ai?: Pick<SlaRisk, 'risk' | 'reasons'>
}

/**
 * ERP-08 Reassign: the old partner's job is withdrawn and the leg is offered to
 * the new partner at its own rate. Partners on API auto-acceptance take it at
 * once (as at booking). Only before anything is picked up or started.
 */
export function reassignLeg(data: DemoData, x: Reassign, by: Id, at: IsoDateTime): DemoData {
  const leg = data.legs[x.legId]
  if (!leg || !canReassign(leg) || leg.partnerId === x.partnerId) return data
  const option = reassignOptions(data, leg.id).find((o) => o.partnerId === x.partnerId && o.eligible)
  if (!option) return data
  const s = data.shipments[leg.shipmentId]
  const oldPartner = leg.partnerId
  const newId = eventIdFactory(data, s.id)
  let next = dropSim(data, [s.id])
  const withdraw: ShipmentEvent = { id: newId(), shipmentId: s.id, legId: leg.id, type: 'legWithdrawn', at, by, app: 'erp', note: `Reassigned from ${data.partners[oldPartner].shortName} to ${data.partners[x.partnerId].shortName} (${x.reason})` }
  next = { ...next, legs: { ...next.legs, [leg.id]: { ...leg, partnerId: x.partnerId, cost: option.cost, staffId: undefined, vehicleId: undefined } } }
  const events: ShipmentEvent[] = [withdraw, { id: newId(), shipmentId: s.id, legId: leg.id, type: 'legOffered', at, by: 'system', app: 'erp' }]
  const np = next.partners[x.partnerId]
  if (np.autoAccept) {
    const ops = partnerOpsUser(next, np.id)
    events.push({ id: newId(), shipmentId: s.id, legId: leg.id, type: 'legAccepted', at, by: ops, app: 'partnerPortal', note: 'API' })
    const staffId = defaultAssignee(next, next.legs[leg.id])
    if (staffId) events.push({ id: newId(), shipmentId: s.id, legId: leg.id, type: 'legAssigned', at, by: ops, app: 'partnerPortal', assigneeStaffId: staffId, assigneeVehicleId: next.fieldStaff[staffId].vehicleId })
  }
  next = applyEvents(next, events, at)
  const label = `${s.id} · ${leg.id}`
  if (x.notify.oldPartner) next = notify(next, { app: 'partnerPortal', partnerId: oldPartner }, 'Job withdrawn by Logisco', label, '/partner/jobs', at)
  if (x.notify.newPartner) next = notify(next, { app: 'partnerPortal', partnerId: x.partnerId }, 'New job offered', label, `/partner/jobs/${leg.id}`, at)
  if (x.notify.customer) next = notify(next, { app: 'customer', customerId: s.customerId }, 'Partner changed for your shipment', `${s.id}: ${data.partners[x.partnerId].shortName}`, `/customer/shipments/${s.id}`, at)
  // Resolve a "pickup missed" ticket on this leg: the action for that type is done
  next = logTicket(next, (t) => t.legId === leg.id && t.type === 'pickupMissed', by, at, 'reassigned', data.partners[x.partnerId].shortName)
  return audit(next, { userId: by, app: 'erp', action: 'leg.reassign', recordId: leg.id, at, before: { partnerId: oldPartner, cost: leg.cost }, after: { partnerId: x.partnerId, cost: option.cost, reason: x.reason, ai: x.ai } })
}

/** ERP-06 Apply suggestion: the action runs and is logged with the AI reason. */
export function applyRiskSuggestion(data: DemoData, legId: Id, by: Id, at: IsoDateTime): DemoData {
  const r = slaRisks(data, at, Number.MAX_SAFE_INTEGER).find((x) => x.legId === legId)
  if (!r) return data
  const leg = data.legs[legId]
  const a: RiskAction = r.action
  let next = data
  if (a.kind === 'reassign') next = reassignLeg(next, { legId, partnerId: a.partnerId, reason: 'slaRisk', notify: { oldPartner: true, newPartner: true, customer: false }, ai: { risk: r.risk, reasons: r.reasons } }, by, at)
  else if (a.kind === 'callPartner') next = logMaskedCall(next, r.shipmentId, leg.partnerId, by, at)
  else next = messageCustomer(next, r.shipmentId, 'delay', `Your shipment ${r.shipmentId} may be delayed; we are on it and will confirm the ETA.`, by, at)
  return audit(next, { userId: by, app: 'erp', action: `slaRisk.apply.${a.kind}`, recordId: legId, at, after: { risk: r.risk, reasons: r.reasons, action: a } })
}

/** ERP-06 Dismiss (with a reason): hidden for the rest of the day. */
export function dismissRisk(data: DemoData, legId: Id, reason: string, by: Id, at: IsoDateTime): DemoData {
  if (!reason.trim()) return data
  const next = { ...data, riskDismissals: { ...data.riskDismissals, [legId]: { legId, reason: reason.trim(), by, at } } }
  return audit(next, { userId: by, app: 'erp', action: 'slaRisk.dismiss', recordId: legId, at, after: reason })
}

// ─── ERP-07 tickets ───────────────────────────────────────────────────────────

const ticketId = (data: DemoData, lr: Id, offset: number) => `EXC-${lr.slice(-6)}-${Object.values(data.exceptions).filter((x) => x.shipmentId === lr).length + offset + 1}`

/** Raise the auto-tickets the detector finds. Runs at seed time and as the demo clock moves. */
export function raiseAutoTickets(data: DemoData, now: IsoDateTime): DemoData {
  const found = detectExceptions(data, now)
  if (!found.length) return data
  const add: Record<Id, ShipmentException> = {}
  const perLr: Record<Id, number> = {}
  for (const f of found) {
    const id = ticketId(data, f.shipmentId, perLr[f.shipmentId] ?? 0)
    perLr[f.shipmentId] = (perLr[f.shipmentId] ?? 0) + 1
    add[id] = { ...f, id }
  }
  return { ...data, exceptions: { ...data.exceptions, ...add } }
}

/** Append to the log of the tickets that match; first action moves them to In progress. */
function logTicket(data: DemoData, match: (t: ShipmentException) => boolean, by: Id, at: IsoDateTime, action: string, note?: string): DemoData {
  let changed = false
  const exceptions = Object.fromEntries(
    Object.entries(data.exceptions).map(([k, t]) => {
      if (t.status === 'resolved' || !match(t)) return [k, t]
      changed = true
      return [k, { ...t, status: 'inProgress' as const, log: [...(t.log ?? []), { at, by, action, note }] }]
    }),
  )
  return changed ? { ...data, exceptions } : data
}

export type TicketAction = 'sendEta' | 'investigate' | 'resendNdr' | 'extendEwb' | 'partB' | 'customerConfirmed'

/**
 * ERP-07 Take action by type (source §10 Step 3): new ETA to the customer
 * (delay, breakdown), hold and investigate the previous leg (seal / short /
 * damage / excess), WhatsApp buttons again (NDR). Recording the customer's
 * confirmation is what allows a ticket to close (§10 Step 2).
 */
export function ticketAction(data: DemoData, id: Id, action: TicketAction, note: string, by: Id, at: IsoDateTime): DemoData {
  const t = data.exceptions[id]
  if (!t || t.status === 'resolved') return data
  let next = data
  if (action === 'sendEta') next = messageCustomer(next, t.shipmentId, 'delay', note || `New ETA for ${t.shipmentId}: ${data.shipments[t.shipmentId].eta}`, by, at)
  if (action === 'resendNdr') next = notify(next, { app: 'customer', customerId: data.shipments[t.shipmentId].customerId }, 'Delivery failed: choose what to do', t.shipmentId, `/customer/exceptions/ndr/${t.shipmentId}`, at)
  if (action === 'extendEwb') next = extendEwayBill(next, t.shipmentId, by, at)
  if (action === 'partB') next = updatePartB(next, t.shipmentId, by, at)
  if (action === 'customerConfirmed') next = { ...next, exceptions: { ...next.exceptions, [id]: { ...next.exceptions[id], customerConfirmed: true } } }
  next = logTicket(next, (x) => x.id === id, by, at, action, note.trim() || undefined)
  return audit(next, { userId: by, app: 'erp', action: `ticket.${action}`, recordId: id, at, after: note })
}

/** ERP-07 Close: only once the customer's confirmation is recorded (source §10 Step 2). */
export function closeTicket(data: DemoData, id: Id, note: string, by: Id, at: IsoDateTime): DemoData {
  const t = data.exceptions[id]
  if (!t || t.status === 'resolved' || !t.customerConfirmed) return data
  const next = { ...data, exceptions: { ...data.exceptions, [id]: { ...t, status: 'resolved' as const, closedAt: at, closedBy: by, rootCause: note.trim() || t.rootCause, log: [...(t.log ?? []), { at, by, action: 'closed', note: note.trim() || undefined }] } } }
  return audit(next, { userId: by, app: 'erp', action: 'ticket.close', recordId: id, at, after: note })
}

/** ERP-09 call / message a partner (SIMULATED masked call): only the audit entry is real. */
export function contactPartner(data: DemoData, partnerId: Id, kind: 'call' | 'message', by: Id, at: IsoDateTime): DemoData {
  return audit(data, { userId: by, app: 'erp', action: `partner.${kind}`, recordId: partnerId, at })
}
