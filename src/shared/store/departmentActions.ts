/**
 * Light department actions: ERP-28 QBRs and notes, ERP-29 RFQs, ERP-39 ticket
 * replies, ERP-40 appointment desk, ERP-41 DPDP requests. All audited.
 */
import { ticketDue } from '@shared/engines/departments'
import type { DemoData, Id, IsoDate, IsoDateTime, Rfq } from '@shared/types'
import { bookAppointment } from './appointmentActions'
import { audit } from './erpActions'

const next4 = (keys: string[], prefix: string) => `${prefix}-${String(Math.max(0, ...keys.map((k) => Number(/(\d+)$/.exec(k)?.[1] ?? 0))) + 1).padStart(4, '0')}`

// ── ERP-28 ──────────────────────────────────────────────────────────────────

export function scheduleQbr(data: DemoData, customerId: Id, date: IsoDate, agenda: string, by: Id, at: IsoDateTime): DemoData {
  if (!data.customers[customerId] || !agenda.trim() || date < at.slice(0, 10)) return data
  const id = next4(Object.keys(data.qbrs), 'QBR')
  const next = { ...data, qbrs: { ...data.qbrs, [id]: { id, customerId, date, agenda: agenda.trim(), by } } }
  return audit(next, { userId: by, app: 'erp', action: 'qbr.schedule', recordId: id, at, after: { customerId, date } })
}

export function logAccountNote(data: DemoData, customerId: Id, text: string, by: Id, at: IsoDateTime): DemoData {
  if (!data.customers[customerId] || !text.trim()) return data
  const id = next4(Object.keys(data.accountNotes), 'NOTE')
  return { ...data, accountNotes: { ...data.accountNotes, [id]: { id, customerId, at, by, text: text.trim() } } }
}

// ── ERP-29 ──────────────────────────────────────────────────────────────────

export type NewRfq = Pick<Rfq, 'customerId' | 'prospect' | 'title' | 'dueDate' | 'lanes'>

export function createRfq(data: DemoData, x: NewRfq, by: Id, at: IsoDateTime): { data: DemoData; id?: Id } {
  if ((!x.customerId && !x.prospect?.trim()) || !x.title.trim() || !x.lanes.length || x.lanes.some((l) => !(l.monthlyShipments > 0))) return { data }
  const n = Math.max(0, ...Object.keys(data.rfqs).map((k) => Number(k.slice(-3)))) + 1
  const id = `RFQ-2026-${String(n).padStart(3, '0')}`
  const rfq: Rfq = { ...x, prospect: x.prospect?.trim() || undefined, title: x.title.trim(), id, status: 'received', ownerId: by, createdAt: at, log: [{ at, by, text: 'Received' }] }
  return { data: audit({ ...data, rfqs: { ...data.rfqs, [id]: rfq } }, { userId: by, app: 'erp', action: 'rfq.create', recordId: id, at }), id }
}

const FLOW: Record<Rfq['status'], Rfq['status'][]> = { received: ['pricing'], pricing: ['submitted'], submitted: ['won', 'lost'], won: [], lost: [] }

/** Send to Pricing → Submitted → Won / Lost. */
export function setRfqStatus(data: DemoData, id: Id, status: Rfq['status'], note: string, by: Id, at: IsoDateTime): DemoData {
  const r = data.rfqs[id]
  if (!r || !FLOW[r.status].includes(status) || (status === 'lost' && !note.trim())) return data
  const text = note.trim() ? `${status}: ${note.trim()}` : status
  const next = { ...data, rfqs: { ...data.rfqs, [id]: { ...r, status, log: [...r.log, { at, by, text }] } } }
  return audit(next, { userId: by, app: 'erp', action: `rfq.${status}`, recordId: id, at, after: note })
}

/** SIMULATED AI first draft from the rate card and the lanes. */
export function draftProposal(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const r = data.rfqs[id]
  if (!r) return data
  return { ...data, rfqs: { ...data.rfqs, [id]: { ...r, proposalAt: at, log: [...r.log, { at, by, text: 'AI proposal draft' }] } } }
}

// ── ERP-39 ──────────────────────────────────────────────────────────────────

/** Reply (and optionally resolve); the agent becomes the owner. */
export function replyTicket(data: DemoData, id: Id, text: string, resolve: boolean, by: Id, at: IsoDateTime): DemoData {
  const t = data.tickets[id]
  if (!t || !text.trim() || t.status === 'closed') return data
  const ticket = { ...t, ownerId: t.ownerId ?? by, status: resolve ? ('resolved' as const) : ('inProgress' as const), thread: [...t.thread, { at, by, text: text.trim() }], dueAt: t.dueAt ?? ticketDue(t.createdAt ?? at, t.category) }
  let next: DemoData = { ...data, tickets: { ...data.tickets, [id]: ticket } }
  if (t.customerId) {
    const nid = `NTF-${String(Object.keys(next.notifications).length + 1).padStart(5, '0')}`
    next = { ...next, notifications: { ...next.notifications, [nid]: { id: nid, audience: { app: 'customer', customerId: t.customerId }, title: resolve ? `Ticket ${id} resolved` : `Reply on ${id}`, body: text.trim(), link: '/customer/support', at, read: false } } }
  }
  return audit(next, { userId: by, app: 'erp', action: resolve ? 'ticket.resolve' : 'ticket.reply', recordId: id, at })
}

// ── ERP-40 ──────────────────────────────────────────────────────────────────

/** Appointment desk: confirm or move a slot; the Partner App and Customer Portal follow (CP-18 / PA-32). */
export function confirmSlot(data: DemoData, lr: Id, slot: { date: IsoDate; from: string; to: string }, by: Id, at: IsoDateTime): DemoData {
  const s = data.shipments[lr]
  if (!s?.appointment || slot.from >= slot.to) return data
  const c = data.consignees[s.consigneeId]
  const a = s.appointment
  return bookAppointment(data, lr, { date: slot.date, from: slot.from, to: slot.to, dock: a.dock, contactName: a.contactName ?? c.contact, contactMobile: a.contactMobile ?? c.mobile, gatePass: a.gatePass }, by, at)
}

// ── ERP-41 ──────────────────────────────────────────────────────────────────

export function closeDpdpRequest(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const r = data.dpdpRequests[id]
  if (!r || r.status === 'done') return data
  return audit({ ...data, dpdpRequests: { ...data.dpdpRequests, [id]: { ...r, status: 'done', doneBy: by, doneAt: at } } }, { userId: by, app: 'erp', action: `dpdp.${r.kind}`, recordId: id, at })
}
