import { buildSeed, DEMO_START } from '@data/seed'
import { claimCap, custodyChain, fraudSignals, liableLeg, nextPayoutDate, partnerCap, suggestedRecovery } from '@shared/engines/claims'
import { confirmClaim, decidePartnerClaim, raiseClaim, reopenClaim, respondToClaim, settleClaim } from './claimActions'

const now = DEMO_START

describe('liability engine and caps (source §10 Step 4)', () => {
  it('CLM-2026-0142: piece 4 entered NCR CrossDock (leg 2) and was not sealed out', () => {
    const d = buildSeed()
    const s = d.shipments['LGS-DEL-000769']
    expect(liableLeg(d, s, 'shortage', ['LGS-DEL-000769-04'])).toEqual({ legId: 'JOB-000769-L2', partnerId: 'P-NCRXD', why: 'notPassedOn', in: 6, out: 5 })
    expect(custodyChain(d, s)[1]).toMatchObject({ sealsOut: ['SL-45383'], staffIds: ['FS-POOJA'] })
    // Insured: the invoice share; NCR's cap ₹10,000 → ₹10,000 + ₹20,000 insurer (seed-data.md §4)
    expect(claimCap(d, s, ['LGS-DEL-000769-04'])).toEqual({ invoiceShare: 30000, max: 30000 })
    expect(suggestedRecovery(d, s, 'P-NCRXD', 30000)).toEqual({ partner: 10000, partnerInsurer: 0, insurer: 20000 })
  })

  it('not insured: capped at ₹100 / kg of the shipment (000667: 15 kg → ₹1,500)', () => {
    const d = buildSeed()
    expect(claimCap(d, d.shipments['LGS-DEL-000667'], ['LGS-DEL-000667-03'])).toEqual({ invoiceShare: 1800, liabilityCap: 1500, max: 1500 })
    expect(d.claims['CLM-2026-0151']).toMatchObject({ status: 'investigating', liablePartnerId: 'P-NCRXD' })
  })

  it('damage with no earlier report: the last mile held it; partner cap from the default terms', () => {
    const d = buildSeed()
    const s = d.shipments['LGS-DEL-000657']
    const l = liableLeg(d, s, 'damage', ['LGS-DEL-000657-02'])!
    expect(l).toMatchObject({ legId: s.legIds.at(-1), why: 'damagedInCustody' })
    expect(partnerCap(d, l.partnerId, s)).toBe(10000)
  })

  it('next payout: SwiftCity has 27-Nov scheduled; a Silver partner pays weekly on Friday', () => {
    const d = buildSeed()
    expect(nextPayoutDate(d, 'P-SWIFTCITY', now)).toBe('2026-11-27')
    expect(nextPayoutDate(d, 'P-NCRXD', now)).toBe('2026-11-27')
  })
})

describe('claim actions (CP-22, ERP-37, PP-22)', () => {
  it('raise → settle by credit note with recovery split → partner contests → desk upholds; customer confirms', () => {
    const base = buildSeed()
    const s = base.shipments['LGS-DEL-000657']
    const bad = raiseClaim(base, { lr: s.id, type: 'damage', pieceIds: ['LGS-DEL-000657-02'], amount: 15201, description: 'Crushed', files: ['p.jpg'] }, 'CU-PRIYA', now)
    expect(bad.claimId).toBeUndefined()
    const r = raiseClaim(base, { lr: s.id, type: 'damage', pieceIds: ['LGS-DEL-000657-02'], amount: 15200, description: 'Carton 2 crushed', files: ['photo.jpg', 'grn.jpg'] }, 'CU-PRIYA', now)
    const id = r.claimId!
    expect(id).toBe('CLM-2026-0152')
    let d = r.data
    expect(d.claims[id]).toMatchObject({ status: 'raised', settleBy: '2026-11-30', liableLegId: s.legIds.at(-1) })
    const partnerId = d.claims[id].liablePartnerId!

    // Split must add up and respect the partner cap
    expect(settleClaim(d, id, { amount: 15200, reason: 'OK', method: 'creditNote', recovery: { partner: 10000, insurer: 5000 } }, 'LS-FARHAN', now)).toBe(d)
    d = settleClaim(d, id, { amount: 15200, reason: 'Approved in full; insured', method: 'creditNote', recovery: { partner: 10000, partnerInsurer: 0, insurer: 5200 } }, 'LS-FARHAN', now)
    expect(d.claims[id]).toMatchObject({ status: 'settled', amountApproved: 15200, creditNoteId: 'CN-2026-0089', settlement: { method: 'creditNote', ref: 'CN-2026-0089' }, partner: { status: 'notified' } })
    expect(d.creditNotes['CN-2026-0089']).toMatchObject({ amount: 15200, claimId: id })

    expect(respondToClaim(d, id, { kind: 'contest', reason: ' ', files: [] }, 'PU-X', now)).toBe(d)
    d = respondToClaim(d, id, { kind: 'contest', reason: 'Carton was crushed before we took it', files: ['cctv.mp4'] }, 'PU-X', now)
    expect(d.claims[id].partner).toMatchObject({ status: 'contested', files: ['cctv.mp4'] })
    d = decidePartnerClaim(d, id, 'upheld', 'Hand-over photo shows it intact', 'LS-FARHAN', now)
    expect(d.claims[id].partner).toMatchObject({ status: 'decided', decision: 'upheld' })
    expect(Object.values(d.notifications).some((n) => n.audience.partnerId === partnerId && n.title === 'Claim deduction confirmed')).toBe(true)

    d = confirmClaim(d, id, 'CU-PRIYA', now)
    expect(d.claims[id]).toMatchObject({ status: 'closed', confirmedAt: now })
    d = reopenClaim(d, id, 'Second carton also damaged', 'CU-PRIYA', now)
    expect(d.claims[id].status).toBe('investigating')
  })

  it('waive moves the partner share to Logisco’s insurer; bank transfer gets a UTR; reject needs a reason', () => {
    const base = buildSeed()
    let d = settleClaim(base, 'CLM-2026-0151', { amount: 1500, reason: 'Approved; capped (not insured)', method: 'bank', recovery: { partner: 1500, insurer: 0 } }, 'LS-FARHAN', now)
    expect(d.claims['CLM-2026-0151'].settlement!.ref).toMatch(/^UTR\d+0151$/)
    d = respondToClaim(d, 'CLM-2026-0151', { kind: 'contest', reason: 'Seal intact', files: [] }, 'PU-DEEPAK', now)
    d = decidePartnerClaim(d, 'CLM-2026-0151', 'waived', '', 'LS-FARHAN', now)
    expect(d.claims['CLM-2026-0151'].recovery).toMatchObject({ partner: 0, insurer: 1500 })
    expect(settleClaim(base, 'CLM-2026-0151', { amount: 0, reason: '', method: 'creditNote', recovery: { partner: 0, insurer: 0 } }, 'LS-FARHAN', now)).toBe(base)
    expect(settleClaim(base, 'CLM-2026-0151', { amount: 0, reason: 'Pieces delivered per GRN', method: 'creditNote', recovery: { partner: 0, insurer: 0 } }, 'LS-FARHAN', now).claims['CLM-2026-0151'].status).toBe('rejected')
  })

  it('fraud signals: a shortage on pieces scanned as delivered; the third claim in 30 days', () => {
    const base = buildSeed()
    const r = raiseClaim(base, { lr: 'LGS-DEL-000671', type: 'shortage', pieceIds: ['LGS-DEL-000671-01'], amount: 1000, description: 'Missing', files: ['grn.jpg'] }, 'CU-PRIYA', now)
    expect(fraudSignals(r.data, r.data.claims[r.claimId!])).toEqual(['repeatClaims', 'deliveredScanned'])
    expect(fraudSignals(base, base.claims['CLM-2026-0142'])).toEqual([])
  })
})
