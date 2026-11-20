import { cardMargins, linesBelowTarget } from '@shared/engines/rateCardMargin'
import { useDemoStore } from '@shared/store'
import { pilotDay, skuOutlier } from './contractActions'

const st = () => useDemoStore.getState()

/** A manufacturer through KYC and credit, now at the contract step (Part 3a). */
function atContract() {
  st().resetDemo()
  const { customerId, userId } = st().signUp({ legalName: 'Vardhman Wires Pvt Ltd', gstin: '27AAGCV4321K1Z2', businessType: 'manufacturer', industry: 'electricals', city: 'Pune', contact: { name: 'Anita', email: 'a@v.in', mobile: '98220 11223' }, source: 'salesVisit', privacyConsent: true, gstConsent: true, language: 'en' })
  st().saveQualification(customerId, { shipmentsPerMonth: 450, spendBand: '2lTo10l', parcelPct: 30, lanes: [{ originPincode: '411001', destCity: 'Bengaluru', perMonth: 60 }], specialHandling: [], payment: ['tbb'] }, userId)
  st().verifyGstin(customerId, 'U27100MH2009PTC123456')
  st().verifyPan(customerId, 'AAGCV4321K')
  st().verifyBank(customerId, { holder: 'Vardhman Wires Pvt Ltd', account: '123456789012', ifsc: 'ICIC0000456', type: 'current' })
  st().saveSignatory(customerId, { name: 'Rohan', designation: 'Director', email: 'r@v.in', mobile: '98220 44556' })
  st().savePickupLocation(customerId, { name: 'Plant', address: 'MIDC', pincode: '411001', lat: 18.6, lng: 73.8, contact: { name: 'S', mobile: '98220 77889' }, window: { from: '10:00', to: '17:00' }, days: 'Mon–Sat' })
  st().submitKyc(customerId, userId)
  st().submitCredit(customerId, { requestedLimit: 500000, termsDays: 30, yearsInBusiness: 17, gstConsent: true, depositWilling: true }, userId)
  st().autoDecide(customerId, 'credit')
  st().acceptCredit(customerId, userId)
  return { customerId, userId }
}

describe('rate cards (ERP-22 / ERP-23)', () => {
  beforeEach(() => st().resetDemo())

  it('the margin engine checks every line of the standard card', () => {
    const m = cardMargins(st().data, st().data.rateCards['RC-STANDARD'])
    expect(m.ptl.length).toBeGreaterThan(0)
    expect(m.ptl.every((l) => typeof l.m?.marginPct === 'number')).toBe(true)
    // Parcels move in bags with per-parcel hub and line-haul rates (Phase 6 tuning of invented rates), so a zone D standard parcel clears the target
    expect(m.parcel.find((l) => l.zone === 'D' && l.tier === 'standard')?.m?.belowTarget).toBe(false)
  })

  it('a negotiated card with lines below target needs the Pricing Head; approve → live', () => {
    const { customerId } = atContract()
    const cardId = st().createNegotiatedCard(customerId, 'RC-STANDARD', 'LS-DIVYA')
    expect(st().data.rateCards[cardId]).toMatchObject({ status: 'draft', type: 'negotiated', customerId })
    st().editRateCard(cardId, { kind: 'ptl', index: 0, field: 'perKg', value: 30 })
    expect(st().data.rateCards[cardId].ptl[0].perKg).toBe(30)
    st().submitRateCard(cardId, 'LS-DIVYA')
    expect(linesBelowTarget(cardMargins(st().data, st().data.rateCards[cardId])).length).toBeGreaterThan(0)
    expect(st().data.rateCards[cardId].status).toBe('pendingApproval')
    st().decideRateCard(cardId, 'approve', 'Strategic account', 'LS-DIVYA')
    expect(st().data.rateCards[cardId]).toMatchObject({ status: 'live', approval: { decision: 'approve', decidedBy: 'LS-DIVYA' } })
  })
})

describe('contract → integration → pilot → live (CP-08 to CP-10, ERP-27)', () => {
  it('assisted track: contract issued automatically with the live card, e-signed; SKUs; pilot; live after 14 days', () => {
    const { customerId, userId } = atContract()
    expect(st().data.customers[customerId].status).toBe('contract')
    st().autoDecide(customerId, 'contract')
    expect(st().data.customers[customerId].onboarding!.contract).toMatchObject({ rateCardId: 'RC-STANDARD', status: 'issued', effectiveDate: '2026-12-01', termMonths: 12 })

    st().requestContractChanges(customerId, 'Delhi NCR → Karnataka Express PTL', 'Can you match ₹13/kg?', userId)
    expect(st().data.customers[customerId].onboarding!.contract!.status).toBe('changesRequested')
    expect(Object.values(st().data.notifications).some((n) => n.audience.userId === 'LS-ARJUN' && n.title === 'Contract changes requested')).toBe(true)
    st().issueContract(customerId, 'RC-STANDARD', 'LS-ARJUN') // re-issued after the call
    st().signContract(customerId, 'aadhaarOtp', userId)
    expect(st().data.customers[customerId]).toMatchObject({ status: 'integration', rateCardId: 'RC-STANDARD' })

    st().setIntegration(customerId, { kind: 'erp', erp: 'tally' })
    st().setIntegration(customerId, { kind: 'apiKey' })
    expect(st().data.customers[customerId].integrations).toMatchObject({ erp: 'tally', tally: true })
    expect(st().data.customers[customerId].integrations.apiKey).toMatch(/^sk_sandbox_/)
    st().uploadSkus(
      customerId,
      [
        { code: 'VW-2.5', description: 'Copper wire 2.5 mm, 90 m coil', l: 30, b: 30, h: 12, weight: 9.5, hsn: '8544', unitValue: 2400 },
        { code: 'VW-DRUM', description: 'Cable drum', l: 60, b: 60, h: 60, weight: 900, hsn: '8544', unitValue: 50000 },
      ],
      userId,
    )
    const skus = Object.values(st().data.skus).filter((s) => s.customerId === customerId)
    expect(skus.find((s) => s.code === 'VW-2.5')?.status).toBe('frozen')
    expect(skus.find((s) => s.code === 'VW-DRUM')?.status).toBe('flagged') // 4,167 kg/m³
    st().fixSku(skus.find((s) => s.code === 'VW-DRUM')!.id, { l: 60, b: 60, h: 60, weight: 90 })
    expect(Object.values(st().data.skus).find((s) => s.code === 'VW-DRUM')?.status).toBe('frozen')

    st().completeIntegration(customerId, false, userId)
    const c = st().data.customers[customerId]
    expect(c).toMatchObject({ status: 'pilot', onboarding: { pilot: { start: '2026-11-23', end: '2026-12-06' } } })
    expect(pilotDay(c, st().demoNow)).toBe(1)
    st().markLive(customerId, 'LS-ARJUN')
    expect(st().data.customers[customerId].status).toBe('pilot') // not before the pilot ends
    st().advanceTime(14 * 24 * 60)
    st().markLive(customerId, 'LS-ARJUN')
    expect(st().data.customers[customerId].status).toBe('live')
    expect(Object.values(st().data.leads).find((l) => l.customerId === customerId)?.stage).toBe('live')
  })

  it('self-serve: click-wrap of the standard card without an issued contract', () => {
    st().resetDemo()
    const { customerId, userId } = st().signUp({ legalName: 'Kala Crafts', gstin: '29AAKPK1234L1Z3', businessType: 'sme', industry: 'textiles', city: 'Mysuru', contact: { name: 'Kala', email: 'k@k.in', mobile: '98450 11223' }, source: 'website', privacyConsent: true, gstConsent: false, language: 'en' })
    st().saveQualification(customerId, { shipmentsPerMonth: 40, spendBand: 'lt50k', parcelPct: 90, lanes: [{ originPincode: '570001', destCity: 'Bengaluru', perMonth: 40 }], specialHandling: [], payment: ['prepaid'] }, userId)
    st().verifyGstin(customerId)
    st().verifyPan(customerId, 'AAKPK1234L')
    st().verifyBank(customerId, { holder: 'Kala Crafts', account: '123456789', ifsc: 'SBIN0001234', type: 'current' })
    st().saveSignatory(customerId, { name: 'Kala', designation: 'Owner', email: 'k@k.in', mobile: '98450 11223' })
    st().savePickupLocation(customerId, { name: 'Shop', address: 'Sayyaji Rao Road', pincode: '570001', lat: 12.3, lng: 76.6, contact: { name: 'Kala', mobile: '98450 11223' }, window: { from: '10:00', to: '18:00' }, days: 'Mon–Sat' })
    st().submitKyc(customerId, userId)
    expect(st().data.customers[customerId]).toMatchObject({ status: 'contract', track: 'selfServe', billing: 'prepaid' })
    st().signContract(customerId, 'clickWrap', userId)
    expect(st().data.customers[customerId]).toMatchObject({ status: 'integration', rateCardId: 'RC-STANDARD', onboarding: { contract: { method: 'clickWrap' } } })
  })

  it('SKU outliers: implausible density or a side over 3 m', () => {
    expect(skuOutlier({ l: 30, b: 30, h: 12, weight: 9.5 })).toBeUndefined()
    expect(skuOutlier({ l: 100, b: 100, h: 100, weight: 5 })).toBe('density')
    expect(skuOutlier({ l: 320, b: 20, h: 20, weight: 30 })).toBe('size')
  })
})
