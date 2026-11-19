/**
 * Customer money (source §9 Customer Invoicing, COD Handling; §11 Dept 9
 * collections priority): invoice status and ageing, the ledger, invoice-run
 * previews, COD stages and remittance dates. Pure functions over DemoData.
 */
import { addDaysToDate, istDate, minutesBetween } from '@shared/lib/time'
import type { CodRecord, Customer, DemoData, Id, Invoice, IsoDate, IsoDateTime, Shipment, WalletTxn } from '@shared/types'
import { round2 } from './money'

const DAY_MS = 86_400_000
const daysBetween = (from: IsoDate, to: IsoDate) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

// ── Invoices ────────────────────────────────────────────────────────────────

/** Unpaid past its due date reads Overdue. */
export function invoiceStatus(inv: Invoice, now: IsoDateTime): Invoice['status'] {
  if (inv.status === 'paid') return 'paid'
  return istDate(now) > inv.dueDate ? 'overdue' : inv.status === 'overdue' ? 'unpaid' : inv.status
}

export const isOpen = (inv: Invoice) => inv.status !== 'paid'

export function customerInvoices(data: DemoData, customerId: Id): Invoice[] {
  return Object.values(data.invoices)
    .filter((i) => i.customerId === customerId)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
}

/** CP-24 credit summary. */
export function creditSummary(data: DemoData, c: Customer, now: IsoDateTime) {
  const overdue = customerInvoices(data, c.id)
    .filter((i) => invoiceStatus(i, now) === 'overdue')
    .reduce((s, i) => s + i.total, 0)
  return { limit: c.creditLimit, used: c.creditUsed, available: round2(Math.max(0, c.creditLimit - c.creditUsed)), termsDays: c.creditTermsDays, overdue: round2(overdue) }
}

export type LedgerKind = 'invoice' | 'payment' | 'creditNote'
export interface LedgerRow {
  date: IsoDate
  kind: LedgerKind
  no: string
  debit: number
  credit: number
  balance: number
}

/** CP-24 ledger: invoices debit, payments and credit notes credit; oldest first with a running balance. */
export function ledger(data: DemoData, customerId: Id): LedgerRow[] {
  const rows: Omit<LedgerRow, 'balance'>[] = []
  for (const i of customerInvoices(data, customerId)) {
    rows.push({ date: i.date, kind: 'invoice', no: i.id, debit: i.total, credit: 0 })
    if (i.payment) rows.push({ date: istDate(i.payment.at), kind: 'payment', no: i.payment.ref, debit: 0, credit: i.total })
  }
  for (const cn of Object.values(data.creditNotes)) if (cn.customerId === customerId) rows.push({ date: cn.date, kind: 'creditNote', no: cn.id, debit: 0, credit: cn.amount })
  const order: Record<LedgerKind, number> = { invoice: 0, creditNote: 1, payment: 2 }
  rows.sort((a, b) => a.date.localeCompare(b.date) || order[a.kind] - order[b.kind])
  let balance = 0
  return rows.map((r) => {
    balance = round2(balance + r.debit - r.credit)
    return { ...r, balance }
  })
}

// ── Collections (ERP-31) ────────────────────────────────────────────────────

export const AGEING_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const
export type AgeingBucket = (typeof AGEING_BUCKETS)[number]
const bucketOf = (days: number): AgeingBucket => (days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+')

/** Receivables ageing by customer, by days since the invoice date. */
export function ageing(data: DemoData, now: IsoDateTime) {
  const today = istDate(now)
  const by = new Map<Id, Record<AgeingBucket, number> & { total: number }>()
  for (const i of Object.values(data.invoices)) {
    if (!isOpen(i)) continue
    const row = by.get(i.customerId) ?? { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0, total: 0 }
    const b = bucketOf(daysBetween(i.date, today))
    row[b] = round2(row[b] + i.total)
    row.total = round2(row.total + i.total)
    by.set(i.customerId, row)
  }
  return [...by.entries()].map(([customerId, r]) => ({ customerId, ...r })).sort((a, b) => b.total - a.total)
}

export type PriorityReason = 'overdue' | 'dueSoon' | 'noReminder' | 'nearLimit'
export interface CollectionPriority {
  customerId: Id
  invoiceIds: Id[]
  amount: number
  daysOverdue: number
  /** Days to the nearest due date when nothing is overdue yet */
  dueInDays?: number
  lastReminder?: IsoDateTime
  reasons: PriorityReason[]
  score: number
}

/**
 * SIMULATED AI collections priority (source §11 Dept 9): who to chase first.
 * Score weighs the overdue amount by how late it is, then money falling due in
 * the next 7 days; a customer reminded in the last 3 days drops down the list.
 */
export function collectionsPriority(data: DemoData, now: IsoDateTime): CollectionPriority[] {
  const today = istDate(now)
  const by = new Map<Id, Invoice[]>()
  for (const i of Object.values(data.invoices)) if (isOpen(i)) by.set(i.customerId, [...(by.get(i.customerId) ?? []), i])
  const out: CollectionPriority[] = []
  for (const [customerId, invs] of by) {
    const c = data.customers[customerId]
    const overdue = invs.filter((i) => i.dueDate < today)
    const daysOverdue = overdue.length ? Math.max(...overdue.map((i) => daysBetween(i.dueDate, today))) : 0
    const dueInDays = overdue.length ? undefined : Math.min(...invs.map((i) => daysBetween(today, i.dueDate)))
    const amount = round2(invs.reduce((s, i) => s + i.total, 0))
    const lastReminder = invs.flatMap((i) => i.reminders ?? []).map((r) => r.at).sort().at(-1)
    const recentlyReminded = !!lastReminder && minutesBetween(lastReminder, now) < 3 * 1440
    const reasons: PriorityReason[] = []
    if (overdue.length) reasons.push('overdue')
    else if (dueInDays! <= 7) reasons.push('dueSoon')
    if (!lastReminder && overdue.length) reasons.push('noReminder')
    if (c && c.creditLimit > 0 && c.creditUsed / c.creditLimit >= 0.8) reasons.push('nearLimit')
    const overdueAmt = overdue.reduce((s, i) => s + i.total, 0)
    let score = (overdueAmt / 1000) * (1 + daysOverdue / 30) + (dueInDays !== undefined && dueInDays <= 7 ? amount / 4000 : amount / 20000)
    if (recentlyReminded) score /= 4
    out.push({ customerId, invoiceIds: invs.map((i) => i.id), amount, daysOverdue, dueInDays, lastReminder, reasons, score: Math.round(score) })
  }
  return out.sort((a, b) => b.score - a.score)
}

// ── Invoice runs (ERP-31) ───────────────────────────────────────────────────

/** Billing period of a shipment: the month it was booked in. */
export const periodOf = (s: Shipment) => istDate(s.bookedAt).slice(0, 7)
const DELIVERED = new Set(['delivered', 'deliveredWithException'])

export function invoicedLrs(data: DemoData): Set<Id> {
  return new Set(Object.values(data.invoices).flatMap((i) => i.lrs ?? []))
}

/** Delivered, not yet invoiced shipments of credit customers (prepaid ones paid from the wallet at booking). */
export function unbilled(data: DemoData): Shipment[] {
  const done = invoicedLrs(data)
  return Object.values(data.shipments).filter((s) => DELIVERED.has(s.status) && !done.has(s.id) && data.customers[s.customerId]?.billing === 'credit')
}

export const runPeriods = (data: DemoData) => [...new Set(unbilled(data).map(periodOf))].sort().reverse()

export interface RunLine {
  customerId: Id
  lrs: Id[]
  taxable: number
  gst: number
  total: number
  /** Delivered without an e-POD (delivered event) on record: the invoice would go out without it */
  missingPods: Id[]
}

export function invoiceRunPreview(data: DemoData, period: string): RunLine[] {
  const by = new Map<Id, Shipment[]>()
  for (const s of unbilled(data)) if (periodOf(s) === period) by.set(s.customerId, [...(by.get(s.customerId) ?? []), s])
  const pod = new Set(Object.values(data.events).filter((e) => e.type === 'delivered').map((e) => e.shipmentId))
  return [...by.entries()]
    .map(([customerId, ss]) => ({
      customerId,
      lrs: ss.map((s) => s.id).sort(),
      taxable: round2(ss.reduce((a, s) => a + s.price.subtotal, 0)),
      gst: round2(ss.reduce((a, s) => a + s.price.gst, 0)),
      total: round2(ss.reduce((a, s) => a + s.price.total, 0)),
      missingPods: ss.filter((s) => !pod.has(s.id)).map((s) => s.id),
    }))
    .sort((a, b) => b.total - a.total)
}

// ── Wallet (CP-23) ──────────────────────────────────────────────────────────

export type WalletKind = 'recharge' | 'bookingDebit' | 'weightRevision' | 'rtoCharge' | 'refund' | 'claimCredit'
export function walletKind(t: WalletTxn): WalletKind {
  if (t.type === 'topUp') return 'recharge'
  if (t.type === 'debit') return 'bookingDebit'
  if (t.type === 'refund') return 'refund'
  if (t.type === 'claimCredit') return 'claimCredit'
  return t.ref.startsWith('RTO-') ? 'rtoCharge' : 'weightRevision'
}
export const WALLET_MIN_RECHARGE = 1000
export const WALLET_QUICK_PICKS = [5000, 10000, 25000]

// ── COD (CP-25, PA-36, ERP-34) ──────────────────────────────────────────────

/** Source §9: remitted to the shipper at T+2 from delivery. */
export const COD_REMIT_DAYS = 2
/** Source §9: the partner deposits COD within 24 hours. */
export const COD_DEPOSIT_HOURS = 24

export const remitDate = (r: CodRecord): IsoDate => addDaysToDate(istDate(r.deliveredAt ?? r.collectedAt ?? r.depositedAt!), COD_REMIT_DAYS)
const unremitted = (r: CodRecord) => r.status === 'collected' || r.status === 'deposited'

/** CP-25 summary (and CP-11 "COD due"). */
export function codSummary(data: DemoData, customerId: Id, now: IsoDateTime) {
  const month = istDate(now).slice(0, 7)
  const pending = Object.values(data.codRecords).filter((r) => r.customerId === customerId && unremitted(r))
  const dates = pending.map(remitDate).sort()
  return {
    pending: round2(pending.reduce((s, r) => s + r.amount, 0)),
    nextRemittance: dates[0] && dates[0] < istDate(now) ? istDate(now) : dates[0],
    remittedThisMonth: round2(
      Object.values(data.codRemittances)
        .filter((b) => b.customerId === customerId && b.status === 'remitted' && b.date.startsWith(month))
        .reduce((s, b) => s + b.net, 0),
    ),
  }
}

/** Cash a rider holds (PA-36): collected in cash, not yet handed over. */
export const cashInHand = (data: DemoData, staffId: Id) => Object.values(data.codRecords).filter((r) => r.collectedBy === staffId && r.status === 'collected' && r.mode !== 'upi')

/** ERP-34 "Collected, not deposited": by partner, oldest first, hours since the first collection. */
export function notDeposited(data: DemoData, now: IsoDateTime) {
  const by = new Map<Id, CodRecord[]>()
  for (const r of Object.values(data.codRecords)) if (r.status === 'collected' && r.partnerId) by.set(r.partnerId, [...(by.get(r.partnerId) ?? []), r])
  return [...by.entries()]
    .map(([partnerId, rs]) => {
      const oldest = rs.map((r) => r.collectedAt!).sort()[0]
      const hours = Math.floor(minutesBetween(oldest, now) / 60)
      return { partnerId, records: rs, amount: round2(rs.reduce((s, r) => s + r.amount, 0)), hours, late: hours > COD_DEPOSIT_HOURS }
    })
    .sort((a, b) => b.hours - a.hours)
}

/** ERP-34 "Deposited, not remitted": by customer, with the remittance date and whether a batch is waiting. */
export function depositedNotRemitted(data: DemoData) {
  const inBatch = new Set(
    Object.values(data.codRemittances)
      .filter((b) => b.status !== 'remitted')
      .flatMap((b) => b.recordIds),
  )
  const by = new Map<Id, CodRecord[]>()
  for (const r of Object.values(data.codRecords)) if (r.status === 'deposited' && !inBatch.has(r.id)) by.set(r.customerId, [...(by.get(r.customerId) ?? []), r])
  return [...by.entries()]
    .map(([customerId, rs]) => ({ customerId, records: rs, amount: round2(rs.reduce((s, r) => s + r.amount, 0)), remitBy: rs.map(remitDate).sort()[0] }))
    .sort((a, b) => a.remitBy.localeCompare(b.remitBy))
}

export const shortages = (data: DemoData) => Object.values(data.codRecords).filter((r) => r.shortage)
