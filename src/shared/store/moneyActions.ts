/**
 * Customer money actions (source §9): wallet recharge (CP-23), paying invoices
 * (CP-24), invoice runs and reminders (ERP-31), COD collection and deposit
 * (PA-34, PA-36) and COD reconciliation with maker-checker remittance batches
 * and shortages (ERP-34). All collections land in Logisco's nodal account.
 */
import { invoiceRunPreview, isOpen, remitDate } from '@shared/engines/receivables'
import { round2 } from '@shared/engines/money'
import { addDaysToDate, istDate } from '@shared/lib/time'
import { simulateIrn, simulatePaymentRef, simulateUtr, type PayMethod } from '@shared/sim/payment'
import type { CodRecord, CodRemittance, DemoData, Id, Invoice, IsoDateTime, Notification } from '@shared/types'
import { audit } from './erpActions'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const walletTxnId = (data: DemoData) => `WT-${String(Object.keys(data.walletTxns).length + 1).padStart(5, '0')}`

// ── CP-23 wallet ────────────────────────────────────────────────────────────

/** SIMULATED gateway success: the balance goes up and the entry carries the payment id. */
export function rechargeWallet(data: DemoData, customerId: Id, amount: number, method: PayMethod, by: Id, at: IsoDateTime): { data: DemoData; ref?: string } {
  const c = data.customers[customerId]
  if (!c || c.billing !== 'prepaid' || !(amount >= 1000)) return { data }
  const id = walletTxnId(data)
  const ref = simulatePaymentRef(method, `${id}@${at}`)
  const balanceAfter = round2(c.walletBalance + amount)
  let next: DemoData = {
    ...data,
    customers: { ...data.customers, [c.id]: { ...c, walletBalance: balanceAfter } },
    walletTxns: { ...data.walletTxns, [id]: { id, customerId: c.id, type: 'topUp', ref, amount, balanceAfter, at } },
  }
  next = audit(next, { userId: by, app: 'customer', action: 'Wallet recharged', recordId: id, at, after: { amount, ref } })
  return { data: next, ref }
}

/** A claim settled for a prepaid customer goes back to the wallet (CP-23 "Claim credit"). */
export function creditWallet(data: DemoData, customerId: Id, amount: number, ref: string, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c || c.billing !== 'prepaid' || !(amount > 0)) return data
  const id = walletTxnId(data)
  const balanceAfter = round2(c.walletBalance + amount)
  return {
    ...data,
    customers: { ...data.customers, [c.id]: { ...c, walletBalance: balanceAfter } },
    walletTxns: { ...data.walletTxns, [id]: { id, customerId: c.id, type: 'claimCredit', ref, amount, balanceAfter, at } },
  }
}

// ── CP-24 pay now ───────────────────────────────────────────────────────────

/** SIMULATED gateway success for one or more open invoices of one customer: paid in full, credit freed. */
export function payInvoices(data: DemoData, invoiceIds: Id[], method: PayMethod, by: Id, at: IsoDateTime): { data: DemoData; ref?: string } {
  const invs = invoiceIds.map((id) => data.invoices[id]).filter((i): i is Invoice => !!i && isOpen(i))
  if (!invs.length || invs.length !== invoiceIds.length || new Set(invs.map((i) => i.customerId)).size !== 1) return { data }
  const c = data.customers[invs[0].customerId]
  const ref = simulatePaymentRef(method, `${invoiceIds.join(',')}@${at}`)
  const total = round2(invs.reduce((s, i) => s + i.total, 0))
  const invoices = { ...data.invoices }
  for (const i of invs) invoices[i.id] = { ...i, status: 'paid', payment: { at, ref, method, by } }
  let next: DemoData = { ...data, invoices, customers: { ...data.customers, [c.id]: { ...c, creditUsed: round2(Math.max(0, c.creditUsed - total)) } } }
  next = audit(next, { userId: by, app: 'customer', action: 'Invoices paid', recordId: invoiceIds.join(', '), at, after: { total, ref, method } })
  next = notify(next, { app: 'erp', role: 'finance' }, 'Payment received', `${c.shortName} · ₹${total} · ${ref}`, '/erp/finance/invoicing?tab=collections', at)
  return { data: next, ref }
}

// ── ERP-31 invoice runs and reminders ───────────────────────────────────────

const nextInvoiceNo = (data: DemoData, offset: number) => {
  const max = Math.max(0, ...Object.keys(data.invoices).map((k) => (k.startsWith('LGS/DL/') ? Number(k.slice(-5)) : 0)))
  return `LGS/DL/25-26/${String(max + 1 + offset).padStart(5, '0')}`
}

/**
 * Monthly consolidated GST invoices for the period (source §9): one per
 * customer, one line per delivered shipment with its e-POD, SIMULATED IRN.
 * Due on the customer's credit terms. Returns the new invoice numbers.
 */
export function generateInvoices(data: DemoData, period: string, customerIds: Id[], by: Id, at: IsoDateTime): { data: DemoData; ids: Id[] } {
  const lines = invoiceRunPreview(data, period).filter((l) => customerIds.includes(l.customerId))
  if (!lines.length) return { data, ids: [] }
  const date = istDate(at)
  let next = data
  const ids: Id[] = []
  lines.forEach((l, n) => {
    const id = nextInvoiceNo(data, n)
    const c = data.customers[l.customerId]
    const inv: Invoice = { id, customerId: l.customerId, period, date, shipmentCount: l.lrs.length, taxable: l.taxable, gst: l.gst, total: l.total, dueDate: addDaysToDate(date, c.creditTermsDays || 30), status: 'unpaid', irn: simulateIrn(id), lrs: l.lrs }
    next = { ...next, invoices: { ...next.invoices, [id]: inv } }
    next = notify(next, { app: 'customer', customerId: c.id }, `Invoice ${id}`, `₹${inv.total} · ${inv.shipmentCount} shipments · due ${inv.dueDate}`, `/customer/billing/invoices?invoice=${encodeURIComponent(id)}`, at)
    ids.push(id)
  })
  next = audit(next, { userId: by, app: 'erp', action: 'Invoice run', recordId: period, at, after: { invoices: ids } })
  return { data: next, ids }
}

/** ERP-31 "Send reminder" for a customer's open invoices (SIMULATED email / WhatsApp). */
export function sendReminder(data: DemoData, customerId: Id, channel: 'email' | 'whatsapp', by: Id, at: IsoDateTime): DemoData {
  const open = Object.values(data.invoices).filter((i) => i.customerId === customerId && isOpen(i))
  if (!open.length) return data
  const invoices = { ...data.invoices }
  for (const i of open) invoices[i.id] = { ...i, reminders: [...(i.reminders ?? []), { at, by, channel }] }
  const total = round2(open.reduce((s, i) => s + i.total, 0))
  let next: DemoData = { ...data, invoices }
  next = notify(next, { app: 'customer', customerId }, 'Payment reminder', `${open.map((i) => i.id).join(', ')} · ₹${total}`, '/customer/billing/invoices', at)
  return audit(next, { userId: by, app: 'erp', action: `Reminder sent (${channel})`, recordId: customerId, at, after: { invoices: open.map((i) => i.id) } })
}

// ── PA-34 / PA-36 COD ───────────────────────────────────────────────────────

export interface CodCollection {
  mode: 'cash' | 'upi'
  amount: number
  upiRef?: string
}

/**
 * PA-34: the COD record for a delivery. Cash stays with the rider (collected);
 * UPI goes straight into Logisco's nodal account (deposited). The consignee
 * gets a SIMULATED SMS receipt.
 */
export function codRecordFor(data: DemoData, lr: Id, staffId: Id, x: CodCollection, at: IsoDateTime): CodRecord | undefined {
  const s = data.shipments[lr]
  if (!s || s.paymentMode !== 'cod' || x.amount !== s.codAmount) return undefined
  const partnerId = data.fieldStaff[staffId]?.partnerId
  const base: CodRecord = { id: `COD-${lr.slice(-6)}`, shipmentId: lr, customerId: s.customerId, partnerId, amount: x.amount, mode: x.mode, deliveredAt: at, collectedBy: staffId, collectedAt: at, status: 'collected' }
  return x.mode === 'upi' ? { ...base, upiRef: x.upiRef, status: 'deposited', depositedAt: at, deposit: { to: 'nodal', ref: x.upiRef ?? '' } } : base
}

export interface CodDeposit {
  to: 'office' | 'bank'
  amount: number
  /** Cashier OTP or the bank slip photo */
  ref: string
}

/** PA-36: the rider hands all cash in hand to the partner office or bank; the amount must match. */
export function depositCod(data: DemoData, staffId: Id, x: CodDeposit, at: IsoDateTime): DemoData {
  const held = Object.values(data.codRecords).filter((r) => r.collectedBy === staffId && r.status === 'collected' && r.mode !== 'upi')
  const total = round2(held.reduce((s, r) => s + r.amount, 0))
  if (!held.length || round2(x.amount) !== total || !x.ref.trim()) return data
  const codRecords = { ...data.codRecords }
  // Bank: straight into Logisco's account. Office: the partner deposits it to Logisco in PP-28.
  for (const r of held) codRecords[r.id] = { ...r, status: x.to === 'bank' ? 'deposited' : 'atOffice', depositedAt: x.to === 'bank' ? at : undefined, deposit: { to: x.to, ref: x.ref.trim(), by: staffId } }
  const partnerId = data.fieldStaff[staffId]?.partnerId
  let next: DemoData = { ...data, codRecords }
  if (partnerId) next = notify(next, { app: 'partnerPortal', partnerId }, 'COD deposited', `${data.fieldStaff[staffId].name} · ₹${total} · ${held.length} LR`, '/partner/finance/cod', at)
  return next
}

// ── ERP-34 reconciliation ───────────────────────────────────────────────────

const remittanceNo = (data: DemoData) => {
  const max = Math.max(0, ...Object.keys(data.codRemittances).map((k) => Number(k.slice(-4))))
  return `REM-2026-${String(max + 1).padStart(4, '0')}`
}

/** Maker: batch a customer's deposited COD for remittance; it waits for the checker. */
export function createRemittanceBatch(data: DemoData, customerId: Id, by: Id, at: IsoDateTime): { data: DemoData; id?: Id } {
  const pending = new Set(
    Object.values(data.codRemittances)
      .filter((b) => b.status !== 'remitted')
      .flatMap((b) => b.recordIds),
  )
  const recs = Object.values(data.codRecords).filter((r) => r.customerId === customerId && r.status === 'deposited' && !pending.has(r.id))
  if (!recs.length) return { data }
  const id = remittanceNo(data)
  const gross = round2(recs.reduce((s, r) => s + r.amount, 0))
  const date = recs.map(remitDate).sort()[0] < istDate(at) ? istDate(at) : recs.map(remitDate).sort()[0]
  // Shortages are deducted from the partner, never the shipper (source §9): net = gross
  const batch: CodRemittance = { id, customerId, date, recordIds: recs.map((r) => r.id), gross, deductions: 0, net: gross, status: 'pendingApproval', makerId: by }
  let next: DemoData = { ...data, codRemittances: { ...data.codRemittances, [id]: batch } }
  next = notify(next, { app: 'erp', role: 'leadership' }, 'COD remittance to approve', `${id} · ${data.customers[customerId].shortName} · ₹${gross}`, '/erp/finance/cod', at)
  return { data: audit(next, { userId: by, app: 'erp', action: 'COD remittance batch created', recordId: id, at, after: { gross, records: recs.length } }), id }
}

/** Checker: approve → paid out of the nodal account (SIMULATED UTR); hold → stays on hold. Maker can't check. */
export function decideRemittanceBatch(data: DemoData, id: Id, decision: 'approve' | 'hold', by: Id, at: IsoDateTime): DemoData {
  const b = data.codRemittances[id]
  if (!b || (b.status !== 'pendingApproval' && b.status !== 'onHold') || b.makerId === by) return data
  if (decision === 'hold') return audit({ ...data, codRemittances: { ...data.codRemittances, [id]: { ...b, status: 'onHold', checkerId: by } } }, { userId: by, app: 'erp', action: 'COD remittance on hold', recordId: id, at })
  const utr = simulateUtr(id, istDate(at))
  const codRecords = { ...data.codRecords }
  for (const rid of b.recordIds) codRecords[rid] = { ...codRecords[rid], status: 'remitted', remittanceId: id, remittedAt: at }
  let next: DemoData = { ...data, codRecords, codRemittances: { ...data.codRemittances, [id]: { ...b, status: 'remitted', checkerId: by, utr, date: istDate(at) } } }
  next = notify(next, { app: 'customer', customerId: b.customerId }, 'COD remitted', `${id} · ₹${b.net} · UTR ${utr}`, `/customer/billing/cod?remittance=${id}`, at)
  return audit(next, { userId: by, app: 'erp', action: 'COD remittance approved', recordId: id, at, after: { utr, net: b.net } })
}

/**
 * Raise a shortage with evidence (source §9 "shortages deducted with
 * evidence"): the amount is recovered from the partner's payout; whatever cash
 * there is counts as deposited, so the shipper is still remitted in full.
 */
export function raiseCodShortage(data: DemoData, recordId: Id, amount: number, evidence: string, by: Id, at: IsoDateTime): DemoData {
  const r = data.codRecords[recordId]
  if (!r || r.shortage || r.status === 'remitted' || r.status === 'deposited' || !(amount > 0) || amount > r.amount || !evidence.trim()) return data
  const rec: CodRecord = {
    ...r,
    shortage: { amount, evidence: evidence.trim(), by, at, status: 'raised' },
    ...(r.status === 'collected' || r.status === 'atOffice' ? { status: 'deposited' as const, depositedAt: at, deposit: { to: 'office' as const, ref: `Shortage ₹${amount} to payout` } } : {}),
  }
  let next: DemoData = { ...data, codRecords: { ...data.codRecords, [r.id]: rec } }
  if (r.partnerId) next = notify(next, { app: 'partnerPortal', partnerId: r.partnerId }, 'COD shortage', `${r.shipmentId} · ₹${amount} · deducted from your next payout`, '/partner', at)
  return audit(next, { userId: by, app: 'erp', action: 'COD shortage raised', recordId: r.id, at, after: { amount, evidence } })
}

/**
 * Background deliveries (demo clock) of COD shipments: the rider collected
 * cash. Live PA-33 deliveries create their record with the delivery.
 */
export function codFromDeliveries(data: DemoData): DemoData {
  let codRecords: DemoData['codRecords'] | undefined
  for (const s of Object.values(data.shipments)) {
    if (s.paymentMode !== 'cod' || !s.codAmount || (s.status !== 'delivered' && s.status !== 'deliveredWithException')) continue
    const id = `COD-${s.id.slice(-6)}`
    if (data.codRecords[id]) continue
    const ev = Object.values(data.events).find((e) => e.shipmentId === s.id && e.type === 'delivered')
    if (!ev) continue
    const leg = data.legs[s.legIds.at(-1)!]
    codRecords ??= { ...data.codRecords }
    codRecords[id] = { id, shipmentId: s.id, customerId: s.customerId, partnerId: leg?.partnerId, amount: s.codAmount, mode: 'cash', deliveredAt: ev.at, collectedBy: ev.by, collectedAt: ev.at, status: 'collected' }
  }
  return codRecords ? { ...data, codRecords } : data
}
