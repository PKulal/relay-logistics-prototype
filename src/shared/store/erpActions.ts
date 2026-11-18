/**
 * Pure state changes behind ERP one-click actions (ERP-03 / ERP-05).
 * Each one writes an audit-log entry (shown later in ERP-43).
 */
import { addDaysToDate } from '@shared/lib/time'
import type { AppKey, DemoData, Id, IsoDateTime } from '@shared/types'

function audit(data: DemoData, entry: { userId: Id; app: AppKey; action: string; recordId: Id; at: IsoDateTime; before?: unknown; after?: unknown }): DemoData {
  const id = `AUD-${String(Object.keys(data.auditLog).length + 1).padStart(5, '0')}`
  return { ...data, auditLog: { ...data.auditLog, [id]: { id, ...entry } } }
}

/**
 * SIMULATED: extend the e-way bill with the NIC portal. Validity is pushed out by
 * one full validity period for the lane (1 day per 200 km), counted from today or
 * from the current expiry, whichever is later.
 */
export function extendEwayBill(data: DemoData, lr: Id, userId: Id, now: IsoDateTime): DemoData {
  const s = data.shipments[lr]
  if (!s?.ewb) return data
  const km = s.laneId ? data.lanes[s.laneId].distanceKm : 120
  const days = Math.max(1, Math.ceil(km / data.settings.ewayBillKmPerDay))
  const today = now.slice(0, 10)
  const from = s.ewb.validTill > today ? s.ewb.validTill : today
  const ewb = { ...s.ewb, validTill: addDaysToDate(from, days) }
  const next = { ...data, shipments: { ...data.shipments, [lr]: { ...s, ewb, updatedAt: now } } }
  return audit(next, { userId, app: 'erp', action: 'ewb.extend', recordId: lr, at: now, before: s.ewb.validTill, after: ewb.validTill })
}

/** SIMULATED: update e-way bill Part B (vehicle details) with the NIC portal. */
export function updatePartB(data: DemoData, lr: Id, userId: Id, now: IsoDateTime): DemoData {
  const s = data.shipments[lr]
  if (!s?.ewb || s.ewb.partBUpdated) return data
  const next = { ...data, shipments: { ...data.shipments, [lr]: { ...s, ewb: { ...s.ewb, partBUpdated: true }, updatedAt: now } } }
  return audit(next, { userId, app: 'erp', action: 'ewb.partB', recordId: lr, at: now })
}

export type MessageTemplate = 'delay' | 'pickupReschedule' | 'appointment' | 'general'

/**
 * SIMULATED: WhatsApp / email to the customer. The message lands in the
 * customer's notifications (CP-36) and the audit log.
 */
export function messageCustomer(data: DemoData, lr: Id, template: MessageTemplate, body: string, userId: Id, now: IsoDateTime): DemoData {
  const s = data.shipments[lr]
  if (!s) return data
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  const next: DemoData = {
    ...data,
    notifications: {
      ...data.notifications,
      [id]: { id, audience: { app: 'customer', customerId: s.customerId }, title: `${lr}: ${template}`, body, link: `/customer/shipments/${lr}`, at: now, read: false },
    },
  }
  return audit(next, { userId, app: 'erp', action: `message.${template}`, recordId: lr, at: now, after: body })
}

/** SIMULATED: masked call to a partner (number never shown). Only the audit entry is real. */
export function logMaskedCall(data: DemoData, lr: Id, partnerId: Id, userId: Id, now: IsoDateTime): DemoData {
  return audit(data, { userId, app: 'erp', action: 'call.partner', recordId: lr, at: now, after: partnerId })
}
