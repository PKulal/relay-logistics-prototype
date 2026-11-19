import { buildSeed, DEMO_START } from '@data/seed'
import { exceptionQueue, inTab } from '@shared/engines/customerExceptions'
import { aiWeightCheck, compareWeights } from '@shared/engines/weightCheck'
import type { DemoData } from '@shared/types'
import { acceptRevision, autoAcceptRevisions, disputeRevision, resolveDispute } from './weightActions'

const now = DEMO_START
const WR = 'WR-000784'
const LR = 'LGS-DEL-000784'

describe('weight revision (source §7 Step 4; CP-20, ERP-31)', () => {
  it('compares booked and verified: two cartons re-measured, + ₹81.77 incl. GST', () => {
    const d = buildSeed()
    const cmp = compareWeights(d, d.shipments[LR])
    expect(cmp.pieces.filter((p) => p.changed).map((p) => p.id)).toEqual(['LGS-DEL-000784-03', 'LGS-DEL-000784-04'])
    expect(cmp.verified.chargeable).toBe(d.weightRevisions[WR].verified)
    expect(cmp.difference).toBe(d.weightRevisions[WR].amountDiff)
  })

  it('AI check: photos for both cartons, but the frozen SKU disagrees → review', () => {
    const d = buildSeed()
    expect(aiWeightCheck(d, d.shipments[LR], d.weightRevisions[WR])).toEqual({ photoCoverage: { withPhotos: 2, changed: 2 }, flags: ['skuFrozenDiffers'], verdict: 'review' })
  })

  it('accept on credit: added to the invoice (credit used and spend go up)', () => {
    const d = buildSeed()
    const c = d.customers['C-SHARMA']
    const next = acceptRevision(d, WR, 'CU-PRIYA', now)
    expect(next.weightRevisions[WR]).toMatchObject({ status: 'accepted', respondedBy: 'CU-PRIYA', chargedTo: 'invoice' })
    expect(next.customers['C-SHARMA'].creditUsed).toBeCloseTo(c.creditUsed + 81.77, 2)
    expect(next.customers['C-SHARMA'].spendMonthToDate).toBeCloseTo(c.spendMonthToDate + 81.77, 2)
    expect(acceptRevision(next, WR, 'CU-PRIYA', now)).toBe(next)
  })

  it('accept on prepaid: the wallet is debited with an entry', () => {
    const base = buildSeed()
    const d: DemoData = { ...base, customers: { ...base.customers, 'C-SHARMA': { ...base.customers['C-SHARMA'], billing: 'prepaid', walletBalance: 1000 } } }
    const next = acceptRevision(d, WR, 'CU-PRIYA', now)
    expect(next.customers['C-SHARMA'].walletBalance).toBe(918.23)
    expect(Object.values(next.walletTxns).at(-1)).toMatchObject({ customerId: 'C-SHARMA', type: 'adjustment', ref: WR, amount: -81.77, balanceAfter: 918.23 })
  })

  it('dispute → Finance reverses: booked weight stands, nothing charged, partner billing uses the booked weight', () => {
    const d = buildSeed()
    const c = d.customers['C-SHARMA']
    expect(disputeRevision(d, WR, { reason: 'skuFrozen', remarks: '  ', files: [] }, 'CU-PRIYA', now)).toBe(d)
    let next = disputeRevision(d, WR, { reason: 'skuFrozen', remarks: 'SG-LT-400 is frozen at 60×40×40', files: ['spec.pdf'] }, 'CU-PRIYA', now)
    expect(next.weightRevisions[WR]).toMatchObject({ status: 'disputed', dispute: { reason: 'skuFrozen', files: ['spec.pdf'] } })
    expect(autoAcceptRevisions(next, '2026-12-31T10:00:00+05:30').weightRevisions[WR].status).toBe('disputed')
    next = resolveDispute(next, WR, 'reversed', 'Frozen SKU confirmed', 'LS-LAKSHMI', now)
    expect(next.weightRevisions[WR]).toMatchObject({ status: 'reversed', resolution: { decision: 'reversed', by: 'LS-LAKSHMI' } })
    expect(next.shipments[LR].weights.verifiedChargeable).toBe(d.weightRevisions[WR].booked)
    expect(next.customers['C-SHARMA'].creditUsed).toBe(c.creditUsed)
  })

  it('dispute → Finance upholds: charged as if accepted', () => {
    let d = disputeRevision(buildSeed(), WR, { reason: 'dimensions', remarks: 'Boxes are 60×40×40', files: [] }, 'CU-PRIYA', now)
    d = resolveDispute(d, WR, 'upheld', 'Tape photos show 62×42×42', 'LS-LAKSHMI', now)
    expect(d.weightRevisions[WR]).toMatchObject({ status: 'upheld', chargedTo: 'invoice' })
  })

  it('48-hour rule: accepted automatically once the clock passes the response time', () => {
    const d = buildSeed()
    expect(autoAcceptRevisions(d, now)).toBe(d)
    const due = '2026-11-23T14:40:00+05:30'
    const next = autoAcceptRevisions(d, '2026-11-23T15:00:00+05:30')
    expect(next.weightRevisions[WR]).toMatchObject({ status: 'autoAccepted', respondedBy: 'system', respondedAt: due })
  })

  it('CP-19 queue for Sharma: the revision needs action; finance users see weight and claims', () => {
    const d = buildSeed()
    const rows = exceptionQueue(d, 'C-SHARMA', now)
    expect(inTab(rows, 'weight')).toEqual([expect.objectContaining({ shipmentId: LR, type: 'weightRevision', amount: 81.77, to: `/customer/exceptions/weight/${LR}` })])
    expect(inTab(rows, 'action').some((r) => r.shipmentId === LR)).toBe(true)
    expect(inTab(rows, 'ndr').some((r) => r.shipmentId === 'LGS-DEL-000776')).toBe(true)
  })
})
