/**
 * Weight revision responses (source §7 Step 4: "Accept Revised Rate OR Raise
 * Dispute"; CP-20) and Finance's decision on a dispute (ERP-31). No response in
 * 48 hours → the revised rate is accepted automatically (assumed, CP-20 rule).
 */
import { WEIGHT_REVISION_RESPONSE_HOURS } from '@shared/engines/customerDashboard'
import { addMinutes } from '@shared/lib/time'
import type { DemoData, Id, IsoDateTime, Notification, WeightDisputeReason, WeightRevision } from '@shared/types'
import { audit } from './erpActions'

const round2 = (n: number) => Math.round(n * 100) / 100
const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const setWr = (data: DemoData, w: WeightRevision): DemoData => ({ ...data, weightRevisions: { ...data.weightRevisions, [w.id]: w } })
const cp20 = (w: WeightRevision) => `/customer/exceptions/weight/${w.shipmentId}`

/**
 * Charge the difference: a prepaid customer's wallet is debited; a credit
 * customer has it added to the invoice (credit used goes up). Either way it
 * counts towards this month's spend.
 */
function charge(data: DemoData, w: WeightRevision, at: IsoDateTime): { data: DemoData; chargedTo: 'wallet' | 'invoice' } {
  const s = data.shipments[w.shipmentId]
  const c = data.customers[s.customerId]
  const spend = round2(c.spendMonthToDate + w.amountDiff)
  if (c.billing === 'prepaid') {
    const balanceAfter = round2(c.walletBalance - w.amountDiff)
    const txnId = `WT-${String(Object.keys(data.walletTxns).length + 1).padStart(5, '0')}`
    return {
      data: {
        ...data,
        customers: { ...data.customers, [c.id]: { ...c, walletBalance: balanceAfter, spendMonthToDate: spend } },
        walletTxns: { ...data.walletTxns, [txnId]: { id: txnId, customerId: c.id, type: 'adjustment', ref: w.id, amount: -w.amountDiff, balanceAfter, at } },
      },
      chargedTo: 'wallet',
    }
  }
  return { data: { ...data, customers: { ...data.customers, [c.id]: { ...c, creditUsed: round2(c.creditUsed + w.amountDiff), spendMonthToDate: spend } } }, chargedTo: 'invoice' }
}

/** CP-20 Accept revised rate (or the 48-hour rule, by 'system'). */
export function acceptRevision(data: DemoData, wrId: Id, by: Id, at: IsoDateTime): DemoData {
  const w = data.weightRevisions[wrId]
  if (!w || w.status !== 'pending') return data
  const r = charge(data, w, at)
  const status = by === 'system' ? 'autoAccepted' : 'accepted'
  let next = setWr(r.data, { ...w, status, respondedBy: by, respondedAt: at, chargedTo: r.chargedTo })
  next = audit(next, { userId: by, app: 'customer', action: `weightRevision.${status}`, recordId: wrId, at, after: { amount: w.amountDiff, chargedTo: r.chargedTo } })
  return next
}

export interface DisputeInput {
  reason: WeightDisputeReason
  remarks: string
  files: string[]
}

/** CP-20 Raise dispute: "Under dispute"; Finance reviews (ERP-31). Nothing is charged meanwhile. */
export function disputeRevision(data: DemoData, wrId: Id, d: DisputeInput, by: Id, at: IsoDateTime): DemoData {
  const w = data.weightRevisions[wrId]
  if (!w || w.status !== 'pending' || !d.remarks.trim()) return data
  let next = setWr(data, { ...w, status: 'disputed', respondedBy: by, respondedAt: at, dispute: { reason: d.reason, remarks: d.remarks.trim(), files: d.files, by, at } })
  next = notify(next, { app: 'erp', role: 'finance' }, 'Weight dispute raised', `${w.shipmentId} · ₹${w.amountDiff}`, `/erp/finance/invoicing?wr=${wrId}`, at)
  return audit(next, { userId: by, app: 'customer', action: 'weightRevision.disputed', recordId: wrId, at, after: { reason: d.reason } })
}

/**
 * ERP-31 decision. Upheld: the revised rate stands and is charged. Reversed:
 * the booked weight stands; the verified chargeable weight goes back to the
 * booked one, so partner billing (3-way match) uses it too.
 */
export function resolveDispute(data: DemoData, wrId: Id, decision: 'upheld' | 'reversed', note: string, by: Id, at: IsoDateTime): DemoData {
  const w = data.weightRevisions[wrId]
  if (!w || w.status !== 'disputed' || !note.trim()) return data
  const resolution = { decision, note: note.trim(), by, at }
  let next: DemoData
  if (decision === 'upheld') {
    const r = charge(data, w, at)
    next = setWr(r.data, { ...w, status: 'upheld', resolution, chargedTo: r.chargedTo })
  } else {
    const s = data.shipments[w.shipmentId]
    next = setWr(data, { ...w, status: 'reversed', resolution })
    next = { ...next, shipments: { ...next.shipments, [s.id]: { ...s, weights: { ...s.weights, verifiedChargeable: w.booked } } } }
  }
  const users = Object.values(next.customerUsers).filter((u) => u.customerId === next.shipments[w.shipmentId].customerId && u.role !== 'dispatch')
  for (const u of users) next = notify(next, { app: 'customer', userId: u.id }, decision === 'upheld' ? 'Weight dispute: revised weight upheld' : 'Weight dispute: booked weight accepted', `${w.shipmentId} · ${resolution.note}`, cp20(w), at)
  return audit(next, { userId: by, app: 'erp', action: `weightRevision.${decision}`, recordId: wrId, at, after: resolution })
}

/** The 48-hour rule: pending revisions past their response time are accepted. Runs as the demo clock moves. */
export function autoAcceptRevisions(data: DemoData, now: IsoDateTime): DemoData {
  let next = data
  for (const w of Object.values(data.weightRevisions)) {
    const due = addMinutes(w.raisedAt, WEIGHT_REVISION_RESPONSE_HOURS * 60)
    if (w.status === 'pending' && Date.parse(due) <= Date.parse(now)) next = acceptRevision(next, w.id, 'system', due)
  }
  return next
}
