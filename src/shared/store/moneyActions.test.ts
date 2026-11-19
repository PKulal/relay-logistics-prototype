import { buildSeed, DEMO_START } from '@data/seed'
import type { Claim } from '@shared/types'
import { ageing, cashInHand, codSummary, collectionsPriority, creditSummary, depositedNotRemitted, invoiceRunPreview, invoiceStatus, ledger, notDeposited, walletKind } from '@shared/engines/receivables'
import { completeDelivery } from './deliveryActions'
import { settleClaim } from './claimActions'
import { codFromDeliveries, createRemittanceBatch, decideRemittanceBatch, depositCod, generateInvoices, payInvoices, raiseCodShortage, rechargeWallet, sendReminder } from './moneyActions'

const now = DEMO_START

describe('receivables engine (seed-data.md §5)', () => {
  it('Sharma: credit ₹5,00,000 / ₹3,44,200 / ₹1,55,800, nothing overdue; COD ₹38,400 pending, ₹2,12,600 remitted this month', () => {
    const d = buildSeed()
    expect(creditSummary(d, d.customers['C-SHARMA'], now)).toEqual({ limit: 500000, used: 344200, available: 155800, termsDays: 30, overdue: 0 })
    expect(invoiceStatus(d.invoices['LGS/DL/25-26/04417'], now)).toBe('unpaid')
    expect(codSummary(d, 'C-SHARMA', now)).toEqual({ pending: 38400, nextRemittance: '2026-11-24', remittedThisMonth: 212600 })
  })

  it('ledger: invoices debit, payment and credit note credit, running balance', () => {
    const rows = ledger(buildSeed(), 'C-SHARMA')
    expect(rows.map((r) => [r.kind, r.debit, r.credit])).toEqual([
      ['invoice', 218654, 0],
      ['payment', 0, 218654],
      ['invoice', 241800, 0],
      ['creditNote', 0, 30000],
    ])
    expect(rows.at(-1)!.balance).toBe(211800)
  })

  it('collections: Triveni ₹3.1 lakh, 38 days overdue, ranks first; ageing 61–90', () => {
    const d = buildSeed()
    expect(collectionsPriority(d, now)[0]).toMatchObject({ customerId: 'C-TRIVENI', amount: 310000, daysOverdue: 38, reasons: ['overdue', 'noReminder'] })
    expect(ageing(d, now)[0]).toMatchObject({ customerId: 'C-TRIVENI', '61-90': 310000 })
    // A reminder in the last 3 days moves it down the list
    const after = sendReminder(d, 'C-TRIVENI', 'whatsapp', 'LS-LAKSHMI', now)
    expect(after.invoices['LGS/DL/25-26/03518'].reminders).toHaveLength(1)
    expect(collectionsPriority(after, now)[0]).toMatchObject({ customerId: 'C-TRIVENI', reasons: ['overdue'] })
    expect(collectionsPriority(after, now)[0].score).toBeLessThan(collectionsPriority(d, now)[0].score)
  })

  it('COD stages: SwiftCity ₹21,600 not deposited (15 h); MetroDash over 24 h; Sharma ₹38,400 deposited for 24-Nov', () => {
    const d = buildSeed()
    expect(notDeposited(d, now).map((x) => [x.partnerId, x.amount, x.hours, x.late])).toEqual([
      ['P-METRODASH', 3150, 41, true],
      ['P-SWIFTCITY', 21600, 15, false],
    ])
    expect(depositedNotRemitted(d).map((x) => [x.customerId, x.amount, x.remitBy])).toEqual([['C-SHARMA', 38400, '2026-11-24']])
    expect(cashInHand(d, 'FS-RAVI').reduce((s, r) => s + r.amount, 0)).toBe(21600)
  })
})

describe('money actions', () => {
  it('CP-23: Kaveri recharges ₹10,000 by UPI; under ₹1,000 is refused; a claim credit lands in the wallet', () => {
    const base = buildSeed()
    expect(rechargeWallet(base, 'C-KAVERI', 999, 'upi', 'CU-SURESH', now).data).toBe(base)
    expect(rechargeWallet(base, 'C-SHARMA', 10000, 'upi', 'CU-PRIYA', now).data).toBe(base)
    const r = rechargeWallet(base, 'C-KAVERI', 10000, 'upi', 'CU-SURESH', now)
    expect(r.ref).toMatch(/^UPI \d{12}$/)
    expect(r.data.customers['C-KAVERI'].walletBalance).toBe(18450)
    const txn = Object.values(r.data.walletTxns).at(-1)!
    expect(txn).toMatchObject({ type: 'topUp', amount: 10000, balanceAfter: 18450 })
    expect(walletKind(txn)).toBe('recharge')
  })

  it('CP-24: paying the October invoice marks it paid and frees credit', () => {
    const base = buildSeed()
    expect(payInvoices(base, ['LGS/DL/25-26/03862'], 'upi', 'CU-KAVITA', now).data).toBe(base)
    const r = payInvoices(base, ['LGS/DL/25-26/04417'], 'netBanking', 'CU-KAVITA', now)
    expect(r.data.invoices['LGS/DL/25-26/04417']).toMatchObject({ status: 'paid', payment: { method: 'netBanking', by: 'CU-KAVITA', ref: r.ref } })
    expect(r.data.customers['C-SHARMA'].creditUsed).toBe(102400)
  })

  it('ERP-31: an invoice run creates one invoice per customer with lines, IRN and due date on terms', () => {
    const base = buildSeed()
    const preview = invoiceRunPreview(base, '2026-11')
    const sharma = preview.find((l) => l.customerId === 'C-SHARMA')!
    const r = generateInvoices(base, '2026-11', ['C-SHARMA', 'C-TRIVENI'], 'LS-LAKSHMI', now)
    expect(r.ids).toEqual(['LGS/DL/25-26/04418', 'LGS/DL/25-26/04419'])
    const inv = Object.values(r.data.invoices).find((i) => i.customerId === 'C-SHARMA' && i.period === '2026-11')!
    expect(inv).toMatchObject({ date: '2026-11-23', dueDate: '2026-12-23', status: 'unpaid', total: sharma.total, shipmentCount: sharma.lrs.length })
    expect(inv.irn).toMatch(/^IRN-[0-9a-f]{16}$/)
    expect(Object.values(r.data.invoices).find((i) => i.customerId === 'C-TRIVENI' && i.period === '2026-11')!.dueDate).toBe('2027-01-07')
    // Invoiced shipments drop out of the next preview
    expect(invoiceRunPreview(r.data, '2026-11').some((l) => l.customerId === 'C-SHARMA')).toBe(false)
  })

  it('PA-34 → PA-36 → ERP-34: Manju collects ₹4,200 on 000786, deposits it, Lakshmi batches it, Rahul approves', () => {
    const base = buildSeed()
    const s = base.shipments['LGS-DEL-000786']
    const legId = s.legIds.at(-1)!
    const pieces = Object.fromEntries(s.pieces.map((p) => [p.id, { state: 'ok' as const }]))
    const x = { legId, staffId: 'FS-MANJU', pieces, receivedBy: 'S. Kulkarni', verification: 'otp' as const, photo: 'pod.jpg' }
    // No COD, or a partial amount: not delivered
    expect(completeDelivery(base, x, now)).toBe(base)
    expect(completeDelivery(base, { ...x, cod: { mode: 'cash', amount: 4000 } }, now)).toBe(base)
    let d = completeDelivery(base, { ...x, cod: { mode: 'cash', amount: 4200 } }, now)
    expect(d.shipments[s.id].status).toBe('delivered')
    expect(d.codRecords['COD-000786']).toMatchObject({ amount: 4200, mode: 'cash', collectedBy: 'FS-MANJU', partnerId: 'P-NKEXP', status: 'collected' })
    expect(codSummary(d, 'C-SHARMA', now).pending).toBe(42600)

    expect(depositCod(d, 'FS-MANJU', { to: 'office', amount: 4000, ref: '4417' }, now)).toBe(d)
    d = depositCod(d, 'FS-MANJU', { to: 'office', amount: 4200, ref: '4417' }, now)
    expect(d.codRecords['COD-000786']).toMatchObject({ status: 'deposited', deposit: { to: 'office', ref: '4417', by: 'FS-MANJU' } })

    const b = createRemittanceBatch(d, 'C-SHARMA', 'LS-LAKSHMI', now)
    expect(b.id).toBe('REM-2026-1104')
    d = b.data
    expect(d.codRemittances['REM-2026-1104']).toMatchObject({ gross: 42600, net: 42600, status: 'pendingApproval', makerId: 'LS-LAKSHMI' })
    expect(depositedNotRemitted(d)).toEqual([])
    // The maker can't approve their own batch
    expect(decideRemittanceBatch(d, 'REM-2026-1104', 'approve', 'LS-LAKSHMI', now)).toBe(d)
    d = decideRemittanceBatch(d, 'REM-2026-1104', 'approve', 'LS-RAHUL', now)
    expect(d.codRemittances['REM-2026-1104']).toMatchObject({ status: 'remitted', checkerId: 'LS-RAHUL', date: '2026-11-23' })
    expect(d.codRemittances['REM-2026-1104'].utr).toMatch(/^HDFCN520261123\d{5}$/)
    expect(d.codRecords['COD-000786'].status).toBe('remitted')
    expect(codSummary(d, 'C-SHARMA', now)).toMatchObject({ pending: 0, remittedThisMonth: 255200 })
  })

  it('PA-34 UPI goes straight to the nodal account', () => {
    const base = buildSeed()
    const s = base.shipments['LGS-DEL-000786']
    const pieces = Object.fromEntries(s.pieces.map((p) => [p.id, { state: 'ok' as const }]))
    const d = completeDelivery(base, { legId: s.legIds.at(-1)!, staffId: 'FS-MANJU', pieces, receivedBy: 'S. Kulkarni', verification: 'otp', photo: 'pod.jpg', cod: { mode: 'upi', amount: 4200, upiRef: '612345678901' } }, now)
    expect(d.codRecords['COD-000786']).toMatchObject({ status: 'deposited', deposit: { to: 'nodal', ref: '612345678901' } })
    expect(cashInHand(d, 'FS-MANJU')).toEqual([])
  })

  it('ERP-34 shortage: needs evidence; recovered from the partner, the shipper is still paid in full', () => {
    const base = buildSeed()
    const id = 'COD-000571'
    expect(raiseCodShortage(base, id, 3150, ' ', 'LS-LAKSHMI', now)).toBe(base)
    expect(raiseCodShortage(base, id, 4000, 'x', 'LS-LAKSHMI', now)).toBe(base)
    const d = raiseCodShortage(base, id, 3150, 'No deposit 41 h after delivery; rider unreachable', 'LS-LAKSHMI', now)
    expect(d.codRecords[id]).toMatchObject({ status: 'deposited', shortage: { amount: 3150, status: 'raised' } })
    const b = createRemittanceBatch(d, 'C-TRIVENI', 'LS-LAKSHMI', now)
    expect(b.data.codRemittances[b.id!]).toMatchObject({ gross: 3150, deductions: 0, net: 3150 })
  })

  it('background COD deliveries leave cash with the rider; a prepaid claim credit goes to the wallet', () => {
    const base = buildSeed()
    expect(codFromDeliveries(base)).toBe(base)
    const kav = Object.values(base.shipments).find((s) => s.customerId === 'C-KAVERI' && s.status === 'delivered')!
    {
      const c = { id: 'CLM-T', customerId: 'C-KAVERI', shipmentId: kav.id, type: 'damage' as const, pieceIds: [kav.pieces[0].id], amountClaimed: 200, description: 'x', files: ['a'], raisedAt: now, settleBy: '2026-11-30', status: 'investigating' as const, liableLegId: kav.legIds.at(-1)!, liablePartnerId: base.legs[kav.legIds.at(-1)!].partnerId } as unknown as Claim
      const d = settleClaim({ ...base, claims: { ...base.claims, [c.id]: c } }, c.id, { amount: 200, reason: 'OK', method: 'creditNote', recovery: { partner: 0, insurer: 200 } }, 'LS-FARHAN', now)
      expect(d.customers['C-KAVERI'].walletBalance).toBe(8650)
      expect(walletKind(Object.values(d.walletTxns).at(-1)!)).toBe('claimCredit')
    }
  })
})
