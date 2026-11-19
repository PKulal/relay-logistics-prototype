/**
 * Customer money seed (seed-data.md §5): Sharma's October invoice
 * LGS/DL/25-26/04417 (412 shipments, ₹2,04,915 + GST ₹36,885 = ₹2,41,800, due
 * 01-Dec, unpaid) and an earlier paid one; COD remitted this month ₹2,12,600
 * and ₹38,400 pending. seed-data.md's "next remittance 20-Nov" is before the
 * demo date, so these were delivered 22-Nov and fall due at T+2 (24-Nov). The overdue invoice is on
 * Triveni (ERP-31 sample "₹3.1 lakh"): Sharma's ₹3,44,200 credit
 * used is the October invoice plus ₹1,02,400 unbilled, so it has no overdue.
 * INVENTED: the September invoices, remittance split, UTRs other than
 * REM-2026-1103's, and the older LRs (before the demo data).
 */
import type { CodRecord, CodRemittance, DemoData, Invoice } from '@shared/types'

const AT = (d: string, t = '10:00') => `${d}T${t}:00+05:30`

const invoices: Invoice[] = [
  { id: 'LGS/DL/25-26/03862', customerId: 'C-SHARMA', period: '2026-09', date: '2026-10-01', shipmentCount: 371, taxable: 185300, gst: 33354, total: 218654, dueDate: '2026-10-31', status: 'paid', irn: 'IRN-7f3a0c19d2b84e61', payment: { at: AT('2026-10-29', '15:20'), ref: 'HDFCN52026102988211', method: 'netBanking', by: 'CU-KAVITA' } },
  { id: 'LGS/DL/25-26/04417', customerId: 'C-SHARMA', period: '2026-10', date: '2026-11-01', shipmentCount: 412, taxable: 204915, gst: 36885, total: 241800, dueDate: '2026-12-01', status: 'unpaid', irn: 'IRN-a19e44b07c3d5f22' },
  // Triveni (45-day terms): August invoice due 16-Oct, unpaid → overdue
  { id: 'LGS/DL/25-26/03518', customerId: 'C-TRIVENI', period: '2026-08', date: '2026-09-01', shipmentCount: 188, taxable: 262711.86, gst: 47288.14, total: 310000, dueDate: '2026-10-16', status: 'overdue', irn: 'IRN-55c2e8a90b1f7d36' },
]

/** n COD records on older LRs adding up to `total` (equal split, rounding on the last). */
function records(prefix: string, startSerial: number, n: number, total: number, base: Omit<CodRecord, 'id' | 'shipmentId' | 'amount'>): CodRecord[] {
  const each = Math.floor(total / n / 100) * 100
  return Array.from({ length: n }, (_, i) => {
    const lr = `LGS-DEL-000${String(startSerial + i).padStart(3, '0')}`
    return { ...base, id: `${prefix}-${lr.slice(-6)}`, shipmentId: lr, amount: i === n - 1 ? total - each * (n - 1) : each }
  })
}

export function addMoneySeed(data: DemoData): DemoData {
  const remittances: CodRemittance[] = []
  const cod: CodRecord[] = []
  const batch = (id: string, date: string, n: number, gross: number, start: number, utr: string) => {
    const recs = records('COD', start, n, gross, { customerId: 'C-SHARMA', partnerId: 'P-NKEXP', mode: 'cash', deliveredAt: AT(addDays(date, -2), '12:00'), collectedAt: AT(addDays(date, -2), '12:00'), depositedAt: AT(addDays(date, -1), '09:30'), deposit: { to: 'office', ref: 'Cashier OTP' }, remittanceId: id, remittedAt: AT(date, '11:00'), status: 'remitted' })
    cod.push(...recs)
    remittances.push({ id, customerId: 'C-SHARMA', date, recordIds: recs.map((r) => r.id), gross, deductions: 0, net: gross, utr, status: 'remitted', makerId: 'LS-LAKSHMI', checkerId: 'LS-RAHUL' })
  }
  batch('REM-2026-1101', '2026-11-04', 17, 61800, 501, 'HDFCN52026110412018')
  batch('REM-2026-1102', '2026-11-11', 24, 98500, 518, 'HDFCN52026111110944')
  batch('REM-2026-1103', '2026-11-18', 14, 52300, 542, 'HDFCN52026111812345')
  // ₹38,400 delivered Sunday 22-Nov, deposited at the partner office next morning: remitted at T+2 (24-Nov)
  cod.push(...records('COD', 556, 9, 38400, { customerId: 'C-SHARMA', partnerId: 'P-NKEXP', mode: 'cash', deliveredAt: AT('2026-11-22', '12:00'), collectedAt: AT('2026-11-22', '12:00'), collectedBy: 'FS-MANJU', depositedAt: AT('2026-11-23', '09:30'), deposit: { to: 'office', ref: 'Cashier OTP 4417' }, status: 'deposited' }))
  // ERP-34 sample "SwiftCity · ₹21,600": Triveni COD Ravi collected last evening, not yet deposited
  cod.push(...records('COD', 565, 6, 21600, { customerId: 'C-TRIVENI', partnerId: 'P-SWIFTCITY', mode: 'cash', deliveredAt: AT('2026-11-22', '18:40'), collectedAt: AT('2026-11-22', '18:40'), collectedBy: 'FS-RAVI', status: 'collected' }))
  // Over 24 h without a deposit: MetroDash, for the shortage demo
  cod.push(...records('COD', 571, 1, 3150, { customerId: 'C-TRIVENI', partnerId: 'P-METRODASH', mode: 'cash', deliveredAt: AT('2026-11-21', '16:15'), collectedAt: AT('2026-11-21', '16:15'), status: 'collected' }))
  return {
    ...data,
    invoices: { ...data.invoices, ...Object.fromEntries(invoices.map((i) => [i.id, i])) },
    codRecords: { ...data.codRecords, ...Object.fromEntries(cod.map((r) => [r.id, r])) },
    codRemittances: { ...data.codRemittances, ...Object.fromEntries(remittances.map((r) => [r.id, r])) },
  }
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00+05:30`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
