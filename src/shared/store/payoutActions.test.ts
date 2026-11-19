import { buildSeed, DEMO_START } from '@data/seed'
import { batchPreview, cycleOf, dailyReconciliation, earlyPayAvailable, isSelfBilling, matchLine, nextPayout, openDisputes, partnerCodOutstanding, partnerPayoutDate, selfBillingPreview, tiersDue, unbilledLegs } from '@shared/engines/payables'
import { depositCod, raiseCodShortage } from './moneyActions'
import { acceptMatchedLine, approvePartnerInvoice, disputeLine, recordPartnerCodDeposit, releaseEarlyPay, releasePayoutBatch, requestEarlyPay, resolveDispute, runSelfBilling, submitPayoutBatch, uploadPartnerInvoice } from './payoutActions'

const now = DEMO_START
const LEG = 'JOB-000786-L3' // Deccan line-haul, ₹9 / kg, min 50 kg

describe('payables engine', () => {
  it('cycles, tiers and dates: 27-Nov pays Platinum, Gold and Silver; Bronze and trial partners on 04-Dec', () => {
    expect(cycleOf('2026-11-19')).toBe('2026-11-16/2026-11-22')
    expect(tiersDue('2026-11-27')).toEqual(['platinum', 'gold', 'silver'])
    expect(tiersDue('2026-12-04')).toContain('bronze')
    const d = buildSeed()
    expect(partnerPayoutDate(d, 'P-SWIFTCITY', now)).toBe('2026-11-27')
    expect(partnerPayoutDate(d, 'P-DECCAN', now)).toBe('2026-12-04')
  })

  it('SwiftCity next payout ₹1,84,063 on 27-Nov (₹1,84,363 less the ₹300 penalty, seed-data.md §6)', () => {
    const d = buildSeed()
    expect(nextPayout(d, 'P-SWIFTCITY', now)).toMatchObject({ date: '2026-11-27', line: { gross: 184363, net: 184063, deductions: [{ kind: 'penalty', amount: 300 }] } })
    expect(batchPreview(d, '2026-11-27').map((l) => l.partnerId)).toEqual(['P-SWIFTCITY'])
    expect(earlyPayAvailable(d, 'P-SWIFTCITY')).toBe(184363)
    expect(earlyPayAvailable(d, 'P-DECCAN')).toBe(0)
  })

  it('3-way match: Deccan bills 58 kg against 8 kg verified (50 kg minimum) → ₹522 vs ₹450, a ₹72 mismatch', () => {
    const d = buildSeed()
    expect(isSelfBilling(d, 'P-DECCAN')).toBe(false)
    expect(unbilledLegs(d, 'P-DECCAN').some((l) => l.id === LEG)).toBe(true)
    expect(matchLine(d, LEG)).toMatchObject({ rate: 9, unit: 'perKg', verifiedWeight: 8, billed: 450, matched: 450, pod: true, result: 'match' })
    expect(matchLine(d, LEG, 58)).toMatchObject({ billed: 522, matched: 450, result: 'mismatch', reason: 'weight' })
  })

  it('PP-25: SwiftCity days show legs, earnings, COD collected and the payout status', () => {
    const rows = dailyReconciliation(buildSeed(), 'P-SWIFTCITY', now)
    const sun = rows.find((r) => r.date === '2026-11-22')!
    expect(sun).toMatchObject({ codCollected: 21600, codDeposited: 0, status: 'matched' })
    expect(sun.legs.length).toBeGreaterThan(0)
  })
})

describe('payout actions', () => {
  it('upload → mismatch → dispute (48 h) → desk pays matched → approve for payout', () => {
    const base = buildSeed()
    const x = { no: 'DR/0099', date: '2026-11-23', amount: 522, pdf: 'INV-DR-0099.pdf', lineFile: 'lines.xlsx', lines: [{ legId: LEG, billedWeight: 58 }] }
    expect(uploadPartnerInvoice(base, 'P-DECCAN', { ...x, amount: 500 }, 'PU-PRAKASH', now).id).toBeUndefined()
    expect(uploadPartnerInvoice(base, 'P-SWIFTCITY', x, 'PU-ANIL', now).id).toBeUndefined() // self-billing partner
    const r = uploadPartnerInvoice(base, 'P-DECCAN', x, 'PU-PRAKASH', now)
    let d = r.data
    expect(d.partnerInvoices['DR/0099']).toMatchObject({ mode: 'uploaded', taxable: 522, gst: 93.96, total: 615.96, status: 'submitted' })
    expect(unbilledLegs(d, 'P-DECCAN').some((l) => l.id === LEG)).toBe(false)

    expect(disputeLine(d, 'DR/0099', LEG, ' ', [], 'PU-PRAKASH', now)).toBe(d)
    d = disputeLine(d, 'DR/0099', LEG, 'Weighed 58 kg at our dock', ['weighbridge.jpg'], 'PU-PRAKASH', now)
    expect(d.partnerInvoices['DR/0099'].status).toBe('disputed')
    expect(openDisputes(d, now)).toMatchObject([{ invoiceId: 'DR/0099', amount: 72, hoursLeft: 48 }])
    expect(approvePartnerInvoice(d, 'DR/0099', 'LS-LAKSHMI', now)).toBe(d)
    // Partial outside the billed / matched range is refused
    expect(resolveDispute(d, 'DR/0099', LEG, { decision: 'partial', amount: 600, note: 'x' }, 'LS-LAKSHMI', now)).toBe(d)
    d = resolveDispute(d, 'DR/0099', LEG, { decision: 'matched', note: 'Pickup verification 8 kg with photos' }, 'LS-LAKSHMI', now)
    expect(d.partnerInvoices['DR/0099']).toMatchObject({ status: 'matched', lines: [{ final: 450, dispute: { decision: 'matched', decidedBy: 'LS-LAKSHMI' } }] })
    d = approvePartnerInvoice(d, 'DR/0099', 'LS-LAKSHMI', now)
    expect(d.partnerInvoices['DR/0099'].status).toBe('approved')
    // Deccan is in trial → paid with Bronze on 04-Dec, at the matched value + GST
    expect(batchPreview(d, '2026-12-04').find((l) => l.partnerId === 'P-DECCAN')).toMatchObject({ gross: 531, net: 531 })
  })

  it('accepting the matched amount closes the line', () => {
    const base = buildSeed()
    let d = uploadPartnerInvoice(base, 'P-DECCAN', { no: 'DR/0100', date: '2026-11-23', amount: 522, pdf: 'a.pdf', lineFile: 'l.xlsx', lines: [{ legId: LEG, billedWeight: 58 }] }, 'PU-PRAKASH', now).data
    d = acceptMatchedLine(d, 'DR/0100', LEG, 'PU-PRAKASH', now)
    expect(d.partnerInvoices['DR/0100']).toMatchObject({ status: 'matched', lines: [{ partner: 'accepted', final: 450 }] })
  })

  it('self-billing run for 16–22 Nov: one matched invoice per self-billing partner, Deccan excluded, SwiftCity already billed', () => {
    const base = buildSeed()
    const preview = selfBillingPreview(base, now)
    expect(preview.every((l) => l.cycle === '2026-11-16/2026-11-22')).toBe(true)
    expect(preview.some((l) => l.partnerId === 'P-DECCAN' || l.partnerId === 'P-SWIFTCITY')).toBe(false)
    const r = runSelfBilling(base, '2026-11-16/2026-11-22', 'LS-LAKSHMI', now)
    const ncr = Object.values(r.data.partnerInvoices).find((i) => i.partnerId === 'P-NCRXD')!
    expect(ncr).toMatchObject({ id: 'SB/NCRXD/25-26/001'.replace('NCRXD', 'NCR'), mode: 'selfBilled', status: 'matched' })
    expect(r.ids).toHaveLength(preview.length)
    expect(selfBillingPreview(r.data, now)).toEqual([])
  })

  it('ERP-33: Lakshmi submits the 27-Nov batch but may not release it; Rahul releases → UTRs, invoices paid; a net-negative line carries forward', () => {
    let d = buildSeed()
    // A COD shortage on MetroDash (Platinum) and NCR's self-billed invoice approved
    d = raiseCodShortage(d, 'COD-000571', 3150, 'No deposit in 41 h', 'LS-LAKSHMI', now)
    d = runSelfBilling(d, '2026-11-16/2026-11-22', 'LS-LAKSHMI', now).data
    const ncr = Object.values(d.partnerInvoices).find((i) => i.partnerId === 'P-NCRXD')!
    d = approvePartnerInvoice(d, ncr.id, 'LS-LAKSHMI', now)
    const lines = batchPreview(d, '2026-11-27')
    expect(lines.find((l) => l.partnerId === 'P-METRODASH')).toMatchObject({ gross: 0, net: -3150, deductions: [{ kind: 'codShortage', amount: 3150 }] })
    const b = submitPayoutBatch(d, '2026-11-27', 'LS-LAKSHMI', now)
    expect(b.id).toBe('PB-2026-1127')
    d = b.data
    expect(d.payouts['PO-SWC-2026-1127']).toMatchObject({ status: 'pendingApproval', batchId: 'PB-2026-1127', net: 184063 })
    expect(submitPayoutBatch(d, '2026-11-27', 'LS-LAKSHMI', now).data).toBe(d)
    expect(releasePayoutBatch(d, 'PB-2026-1127', 'LS-LAKSHMI', now)).toBe(d)
    d = releasePayoutBatch(d, 'PB-2026-1127', 'LS-RAHUL', now)
    expect(d.payoutBatches['PB-2026-1127']).toMatchObject({ status: 'released', checkerId: 'LS-RAHUL' })
    expect(d.payouts['PO-SWC-2026-1127'].utr).toMatch(/^HDFCN520261123\d{5}$/)
    expect(d.partnerInvoices['SB/SWC/25-26/047'].status).toBe('paid')
    expect(d.partnerInvoices[ncr.id].status).toBe('paid')
    // MetroDash earned nothing this week: the shortage carries forward
    expect(d.payoutBatches['PB-2026-1127'].payoutIds.some((id) => d.payouts[id].partnerId === 'P-METRODASH')).toBe(false)
    expect(d.codRecords['COD-000571'].shortage!.status).toBe('raised')
    expect(nextPayout(d, 'P-SWIFTCITY', now).line).toBeUndefined()
  })

  it('early pay: up to the matched unpaid amount, 1% fee, released by IMPS, then set off in the batch', () => {
    let d = buildSeed()
    expect(requestEarlyPay(d, 'P-SWIFTCITY', 200000, 'PU-ANIL', now).id).toBeUndefined()
    const r = requestEarlyPay(d, 'P-SWIFTCITY', 50000, 'PU-ANIL', now)
    d = r.data
    expect(d.payouts[r.id!]).toMatchObject({ kind: 'earlyPay', gross: 50000, fee: 500, net: 49500, status: 'pendingApproval', mode: 'IMPS' })
    expect(earlyPayAvailable(d, 'P-SWIFTCITY')).toBe(134363)
    d = releaseEarlyPay(d, r.id!, 'LS-RAHUL', now)
    expect(d.payouts[r.id!].status).toBe('paid')
    expect(nextPayout(d, 'P-SWIFTCITY', now).line).toMatchObject({ net: 134063 })
    d = releasePayoutBatch(submitPayoutBatch(d, '2026-11-27', 'LS-LAKSHMI', now).data, 'PB-2026-1127', 'LS-RAHUL', now)
    expect(d.payouts[r.id!].settledInBatch).toBe('PB-2026-1127')
  })

  it('PP-28: office cash from the rider is deposited to Logisco by the partner; the amount must match', () => {
    let d = buildSeed()
    // Ravi hands SwiftCity's office ₹21,600 (PA-36, office)
    d = depositCod(d, 'FS-RAVI', { to: 'office', amount: 21600, ref: 'Cashier OTP' }, now)
    const recs = Object.values(d.codRecords).filter((r) => r.partnerId === 'P-SWIFTCITY')
    expect(recs.every((r) => r.status === 'atOffice')).toBe(true)
    expect(partnerCodOutstanding(d, 'P-SWIFTCITY')).toMatchObject({ amount: 21600, oldest: '2026-11-22T18:40:00+05:30', dueBy: '2026-11-23T18:40:00+05:30' })
    const ids = recs.map((r) => r.id)
    expect(recordPartnerCodDeposit(d, 'P-SWIFTCITY', { method: 'bankTransfer', amount: 20000, ref: 'AXISN2026112309911', recordIds: ids }, 'PU-ANIL', now)).toBe(d)
    d = recordPartnerCodDeposit(d, 'P-SWIFTCITY', { method: 'bankTransfer', amount: 21600, ref: 'AXISN2026112309911', recordIds: ids }, 'PU-ANIL', now)
    expect(d.codRecords[ids[0]]).toMatchObject({ status: 'deposited', partnerDeposit: { method: 'bankTransfer', ref: 'AXISN2026112309911' } })
    expect(partnerCodOutstanding(d, 'P-SWIFTCITY').amount).toBe(0)
  })
})
