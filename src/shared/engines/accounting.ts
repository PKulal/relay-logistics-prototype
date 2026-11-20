/**
 * ERP-35 Accounting (light) — source §9 (Accounting: revenue, leg costs and
 * margin per shipment and lane; GST), §11 Dept 9 (cash forecast). Lane and
 * shipment P&L reuse the margin monitor (ERP-24). GL posting and the GSTR-2B
 * side of the ITC reconciliation are SIMULATED; the cash forecast is a
 * SIMULATED AI projection from due invoices, payouts and COD remittances.
 */
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { DemoData, IsoDate, IsoDateTime } from '@shared/types'
import { round2 } from './money'
import { shipmentPnl } from './pricingMonitor'
import { isOpen } from './receivables'

/** Daily GL posting for the last 7 days (entries = bookings, finished legs, payments, invoices). */
export function glPostings(data: DemoData, now: IsoDateTime) {
  const today = istDate(now)
  return Array.from({ length: 7 }, (_, i) => addDaysToDate(today, -i)).map((date) => {
    const bookings = Object.values(data.shipments).filter((s) => istDate(s.bookedAt) === date).length
    const costs = Object.values(data.events).filter((e) => istDate(e.at) === date && (e.type === 'handoverReceived' || e.type === 'delivered')).length
    const invoices = Object.values(data.invoices).filter((x) => x.date === date).length
    const payouts = Object.values(data.payouts).filter((p) => p.paidAt && istDate(p.paidAt) === date).length
    return { date, entries: bookings * 2 + costs + invoices * 3 + payouts * 2, status: date === today ? ('scheduled' as const) : ('posted' as const) }
  })
}

/** GST ITC: partner invoice GST per month vs GSTR-2B (disputed invoices are not yet in 2B). */
export function itcReconciliation(data: DemoData) {
  const by = new Map<string, { books: number; gstr2b: number; invoices: number }>()
  for (const inv of Object.values(data.partnerInvoices)) {
    const month = (inv.date ?? inv.cycle.slice(0, 10)).slice(0, 7)
    const row = by.get(month) ?? { books: 0, gstr2b: 0, invoices: 0 }
    row.books += inv.gst
    row.gstr2b += inv.status === 'disputed' || inv.status === 'submitted' ? 0 : inv.gst
    row.invoices += 1
    by.set(month, row)
  }
  return [...by.entries()]
    .map(([month, r]) => ({ month, invoices: r.invoices, books: round2(r.books), gstr2b: round2(r.gstr2b), diff: round2(r.books - r.gstr2b) }))
    .sort((a, b) => b.month.localeCompare(a.month))
}

/** Next 30 days: money in (customer invoices due) and out (partner payouts, COD remittances), with the running balance. */
export function cashForecast(data: DemoData, now: IsoDateTime, days = 30) {
  const today = istDate(now)
  const dates: IsoDate[] = Array.from({ length: days }, (_, i) => addDaysToDate(today, i))
  let balance = 0
  return dates.map((date) => {
    const inflow = Object.values(data.invoices)
      .filter((x) => isOpen(x) && (x.dueDate === date || (date === today && x.dueDate < today)))
      .reduce((s, x) => s + x.total, 0)
    const payouts = Object.values(data.payouts)
      .filter((p) => !p.paidAt && p.dueDate === date)
      .reduce((s, p) => s + p.net, 0)
    const cod = Object.values(data.codRemittances)
      .filter((r) => r.status !== 'remitted' && r.date === date)
      .reduce((s, r) => s + r.net, 0)
    balance += inflow - payouts - cod
    return { date, inflow: round2(inflow), outflow: round2(payouts + cod), balance: round2(balance) }
  })
}

/** Shipment P&L rows, worst margin first. */
export function shipmentPnlRows(data: DemoData, limit = 25) {
  return Object.values(data.shipments)
    .filter((s) => s.status !== 'cancelled')
    .map((s) => shipmentPnl(data, s))
    .sort((a, b) => a.marginPct - b.marginPct)
    .slice(0, limit)
}
