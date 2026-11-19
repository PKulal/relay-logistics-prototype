import { creditScore, gstinCheck, gstinTaken, laneMargin, laneVerdict, pennyDrop, suggestedCredit, trackFor } from '@shared/engines/onboarding'
import { useDemoStore } from '@shared/store'
import type { Qualification } from '@shared/types'
import { kycReady, pendingDecisions } from './onboardingActions'

const st = () => useDemoStore.getState()

const signUp = (gstin = '27AAGCV4321K1Z2') =>
  st().signUp({
    legalName: 'Vardhman Wires Pvt Ltd',
    gstin,
    businessType: 'manufacturer',
    industry: 'electricals',
    city: 'Pune',
    contact: { name: 'Anita Kulkarni', designation: 'Logistics Manager', email: 'anita@vardhmanwires.in', mobile: '98220 11223' },
    source: 'salesVisit',
    privacyConsent: true,
    gstConsent: true,
    language: 'en',
  })

const qualification: Qualification = {
  shipmentsPerMonth: 450,
  spendBand: '2lTo10l',
  parcelPct: 30,
  lanes: [
    { originPincode: '411001', destCity: 'Hubballi', perMonth: 60 },
    { originPincode: '411001', destCity: 'Bengaluru', perMonth: 120 },
  ],
  specialHandling: ['appointment'],
  payment: ['tbb'],
}

describe('identity checks and rules (source §6)', () => {
  beforeEach(() => st().resetDemo())

  it('GSTIN format gives the state and PAN; Sharma’s GSTIN is already registered', () => {
    expect(gstinCheck('07AABCS1234F1Z5')).toEqual({ ok: true, state: 'Delhi', pan: 'AABCS1234F' })
    expect(gstinCheck('99AABCS1234F1Z5').ok).toBe(false)
    expect(gstinCheck('07AABCS1234F1X5').ok).toBe(false)
    expect(gstinTaken(st().data, '07AABCS1234F1Z5')).toBe(true)
    expect(gstinTaken(st().data, '27AAGCV4321K1Z2')).toBe(false)
  })

  it('tracks follow the customer type and volume', () => {
    expect(trackFor('sme', 80, '50kTo2l')).toBe('selfServe')
    expect(trackFor('sme', 350, '50kTo2l')).toBe('insideSales')
    expect(trackFor('manufacturer', 450, '2lTo10l')).toBe('insideSales')
    expect(trackFor('brand', 1, 'lt50k')).toBe('kam')
    expect(trackFor('enterprise', 1, 'lt50k')).toBe('kamSolutions')
    expect(trackFor('marketplace', 1, 'lt50k')).toBe('apiOndc')
  })

  it('lane check: Delhi → Hubballi serviceable with a margin preview; an unknown origin is not', () => {
    expect(laneVerdict(st().data, '110020', 'Hubballi')).toBe('serviceable')
    expect(laneVerdict(st().data, '999999', 'Hubballi')).toBe('notServiceable')
    // No Mumbai-hub → Hubballi lane on the network yet
    expect(laneVerdict(st().data, '411001', 'Hubballi')).toBe('notServiceable')
    expect(laneVerdict(st().data, '411001', 'Bengaluru')).toBe('serviceable')
    const m = laneMargin(st().data, '110020', 'Hubballi', 30)!
    expect(m.marginPct).toBeGreaterThan(0)
  })

  it('penny-drop name match; FAIL0000000 fails', () => {
    expect(pennyDrop('HDFC0001234', 'Sharma Electricals Pvt Ltd', 'Sharma Electricals Pvt Ltd')).toMatchObject({ ok: true, bankName: 'HDFC Bank', matchPct: 100 })
    expect(pennyDrop('FAIL0000000', 'Sharma Electricals', 'Sharma Electricals Pvt Ltd').ok).toBe(false)
  })

  it('credit score: an old, GST-regular business willing to give a deposit is approved in full', () => {
    const s = creditScore({ yearsInBusiness: 18, gstConsent: true, gstActive: true, depositWilling: true })
    expect(s.score).toBeGreaterThanOrEqual(70)
    expect(suggestedCredit(s.score, 500000)).toEqual({ status: 'approved', limit: 500000, deposit: 50000 })
    expect(suggestedCredit(55, 500000).status).toBe('approvedLower')
    expect(suggestedCredit(30, 500000).status).toBe('declined')
  })
})

describe('onboarding a new customer (CP-04 to CP-07)', () => {
  beforeEach(() => st().resetDemo())

  it('sign-up creates the account, its Admin and a lead in the CRM', () => {
    const { customerId, userId } = signUp()
    const { data } = st()
    expect(data.customers[customerId]).toMatchObject({ status: 'lead', pan: 'AAGCV4321K', entityType: 'Private Ltd', billing: 'prepaid' })
    expect(data.customerUsers[userId]).toMatchObject({ role: 'admin', name: 'Anita Kulkarni' })
    const lead = Object.values(data.leads).find((l) => l.customerId === customerId)!
    expect(lead).toMatchObject({ stage: 'new', source: 'salesVisit', gstin: '27AAGCV4321K1Z2' })
    expect(gstinTaken(data, '27AAGCV4321K1Z2')).toBe(true)
  })

  it('qualification → inside sales, credit billing, KAM Arjun; KYC → credit → approved and accepted → contract', () => {
    const { customerId, userId } = signUp()
    st().saveQualification(customerId, qualification, userId)
    let c = st().data.customers[customerId]
    expect(c).toMatchObject({ status: 'qualified', track: 'insideSales', billing: 'credit', kamId: 'LS-ARJUN' })
    expect(Object.values(st().data.leads).find((l) => l.customerId === customerId)).toMatchObject({ stage: 'qualified', ownerId: 'LS-ARJUN', declaredVolume: 450 })

    st().verifyGstin(customerId, 'U27100MH2009PTC123456')
    st().verifyPan(customerId, 'AAGCV4321K')
    st().verifyBank(customerId, { holder: 'Vardhman Wires Pvt Ltd', account: '123456789012', ifsc: 'ICIC0000456', type: 'current' })
    st().saveSignatory(customerId, { name: 'Rohan Shah', designation: 'Director', email: 'rohan@vardhmanwires.in', mobile: '98220 44556' })
    expect(kycReady(st().data, customerId)).toBe(false) // no pickup address yet
    st().savePickupLocation(customerId, { name: 'Bhosari Plant', address: 'Plot 7, MIDC Bhosari', pincode: '411001', lat: 18.62, lng: 73.84, contact: { name: 'Sunil', mobile: '98220 77889' }, window: { from: '10:00', to: '17:00' }, days: 'Mon–Sat' })
    expect(kycReady(st().data, customerId)).toBe(true)
    st().submitKyc(customerId, userId)
    c = st().data.customers[customerId]
    expect(c.onboarding!.kyc!.status).toBe('verified')
    expect(c.status).toBe('credit')
    expect(c.bank).toMatchObject({ name: 'ICICI Bank', ifsc: 'ICIC0000456' })

    st().submitCredit(customerId, { requestedLimit: 500000, termsDays: 30, yearsInBusiness: 17, gstConsent: true, depositWilling: true }, userId)
    expect(pendingDecisions(st().data)).toEqual([{ customerId, kind: 'credit' }])
    st().autoDecide(customerId, 'credit')
    expect(st().data.customers[customerId].onboarding!.credit).toMatchObject({ status: 'approved', approvedLimit: 500000, deposit: 50000, decidedBy: 'system' })
    st().acceptCredit(customerId, userId)
    expect(st().data.customers[customerId]).toMatchObject({ status: 'contract', billing: 'credit', creditLimit: 500000, creditTermsDays: 30, securityDeposit: 50000 })
    expect(Object.values(st().data.leads).find((l) => l.customerId === customerId)?.stage).toBe('contract')
  })

  it('a flagged check (GSTIN ending Z9) puts KYC under review until Logisco clears it', () => {
    const { customerId, userId } = signUp('27AAGCV4321K1Z9')
    st().saveQualification(customerId, { ...qualification, payment: ['prepaid'] }, userId)
    st().verifyGstin(customerId, 'U27100MH2009PTC123456')
    st().verifyPan(customerId, 'AAGCV4321K')
    st().verifyBank(customerId, { holder: 'Vardhman Wires Pvt Ltd', account: '123456789012', ifsc: 'ICIC0000456', type: 'current' })
    st().saveSignatory(customerId, { name: 'Rohan Shah', designation: 'Director', email: 'r@v.in', mobile: '98220 44556' })
    st().savePickupLocation(customerId, { name: 'Plant', address: 'MIDC', pincode: '411001', lat: 18.6, lng: 73.8, contact: { name: 'S', mobile: '98220 77889' }, window: { from: '10:00', to: '17:00' }, days: 'Mon–Sat' })
    st().submitKyc(customerId, userId)
    expect(st().data.customers[customerId].onboarding!.kyc!.status).toBe('underReview')
    st().clearKyc(customerId, 'LS-ARJUN')
    expect(st().data.customers[customerId]).toMatchObject({ status: 'contract', billing: 'prepaid' })
  })
})
