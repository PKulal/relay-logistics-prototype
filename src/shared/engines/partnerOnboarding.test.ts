import { buildSeed, DEMO_START } from '@data/seed'
import { applyAsPartner, autoDecidePartner, bookHubAudit, decideFit, pendingPartnerDecisions, runPartnerCheck, submitPartnerKyc, uploadPartnerDoc, type PartnerApplyInput } from '@shared/store/partnerOnboardingActions'
import { kycChecklist, kycReadyToSubmit, networkFit, partnerDuplicate, vahanCheck } from './partnerOnboarding'

const data = buildSeed()
const now = DEMO_START

const base = { gstRegistered: true, constitution: 'privateLtd' as const, ownFleet: false, hubs: [] }

describe('document checklist by type (source §4.1)', () => {
  it('Type E without a hub: no hub documents, vehicles and licences required', () => {
    const keys = kycChecklist(base, 'E').map((r) => r.key)
    expect(keys).toEqual(['gstin', 'pan', 'incorporation', 'udyam', 'transportLicence', 'bank', 'insurance', 'vehicles', 'driverLicence', 'policeVerification'])
  })
  it('Type F: premises insurance and hub documents, no vehicles', () => {
    const keys = kycChecklist(base, 'F').map((r) => r.key)
    expect(keys).toContain('premisesInsurance')
    expect(keys).toContain('hubDocs')
    expect(keys).not.toContain('vehicles')
    expect(keys).not.toContain('insurance')
  })
  it('Type C proprietor, not GST-registered: no GSTIN, no incorporation; insurance optional', () => {
    const rows = kycChecklist({ ...base, gstRegistered: false, constitution: 'proprietorship' }, 'C')
    expect(rows.map((r) => r.key)).not.toContain('gstin')
    expect(rows.map((r) => r.key)).not.toContain('incorporation')
    expect(rows.find((r) => r.key === 'insurance')?.required).toBe(false)
  })
  it('Type B: vehicles only with its own fleet', () => {
    expect(kycChecklist(base, 'B').map((r) => r.key)).not.toContain('vehicles')
    expect(kycChecklist({ ...base, ownFleet: true }, 'B').map((r) => r.key)).toContain('vehicles')
  })
  it('Type A: no police verification, no driver licence', () => {
    const keys = kycChecklist(base, 'A').map((r) => r.key)
    expect(keys).not.toContain('policeVerification')
    expect(keys).not.toContain('driverLicence')
  })
})

describe('AI network-gap fit (source §4 Step 2)', () => {
  it('Delhi pincodes already served by three couriers → low fit (waitlist)', () => {
    const f = networkFit(data, { type: 'B', legs: ['firstMile', 'lastMile'], pincodes: ['110020', '110001'], lanes: [], hubs: [] })
    expect(f.fitScore).toBeLessThan(60)
    expect(f.fitDetail).toMatchObject({ kind: 'pincodeCovered', place: 'New Delhi', partners: 3 })
  })
  it('Delhi → Bengaluru has one line-haul partner → 88', () => {
    const f = networkFit(data, { type: 'D', legs: ['lineHaul'], pincodes: [], lanes: [{ origin: 'New Delhi', dest: 'Bengaluru', frequency: 'daily', transitHours: 60 }], hubs: [] })
    expect(f).toEqual({ fitScore: 88, fitDetail: { kind: 'laneGap', place: 'New Delhi → Bengaluru', partners: 1 } })
  })
  it('a lane with no partner scores highest; a two-partner lane is covered', () => {
    expect(networkFit(data, { type: 'D', legs: ['lineHaul'], pincodes: [], lanes: [{ origin: 'Hubballi', dest: 'Bengaluru', frequency: 'daily', transitHours: 12 }], hubs: [] }).fitScore).toBe(92)
    expect(networkFit(data, { type: 'D', legs: ['lineHaul'], pincodes: [], lanes: [{ origin: 'Mumbai', dest: 'Bengaluru', frequency: 'daily', transitHours: 20 }], hubs: [] }).fitDetail?.kind).toBe('laneCovered')
  })
  it('a hub in Belagavi (no Logisco hub) fits; one in Gurugram does not', () => {
    const hub = (pincode: string) => [{ name: 'H', address: 'A', pincode, areaSqft: 10000, docks: 4 }]
    expect(networkFit(data, { type: 'F', legs: ['originHub', 'destHub'], pincodes: [], lanes: [], hubs: hub('590001') })).toEqual({ fitScore: 80, fitDetail: { kind: 'hubGap', place: 'Belagavi', partners: 0 } })
    expect(networkFit(data, { type: 'F', legs: ['originHub', 'destHub'], pincodes: [], lanes: [], hubs: hub('122050') }).fitScore).toBeLessThan(60)
  })
})

describe('duplicate check and Vahan', () => {
  it('finds SwiftCity by GSTIN, PAN or phone', () => {
    expect(partnerDuplicate(data, { gstin: data.partners['P-SWIFTCITY'].gstin })).toBe('gstin')
    expect(partnerDuplicate(data, { pan: data.partners['P-SWIFTCITY'].pan })).toBe('pan')
    expect(partnerDuplicate(data, { mobile: '98111 22334' })).toBe('mobile')
    expect(partnerDuplicate(data, { gstin: '07AAHCV5521R1Z3', pan: 'AAHCV5521R', mobile: '98990 31245' })).toBeUndefined()
  })
  it("a vehicle on another partner's fleet is a duplicate", () => {
    expect(vahanCheck(data, 'DL01LT4521', 'P-NEW').detail.reason).toBe('duplicate')
    expect(vahanCheck(data, 'DL01LAB4521', 'P-NEW').ok).toBe(true)
  })
})

const typeD: PartnerApplyInput = {
  type: 'D',
  legs: ['lineHaul'],
  services: ['expressPtl', 'standardPtl'],
  companyName: 'Vindhya Freight Carriers Pvt Ltd',
  gstin: '07AAHCV5521R1Z3',
  pan: 'AAHCV5521R',
  constitution: 'privateLtd',
  contact: { name: 'Harish Tiwari', designation: 'Director', mobile: '98990 31245', email: 'harish@vindhyafreight.in' },
  address: 'Plot 22, Sanjay Gandhi Transport Nagar, New Delhi 110042',
  source: 'website',
  gstRegistered: true,
  states: ['Delhi', 'Karnataka'],
  cities: ['New Delhi', 'Bengaluru'],
  pincodes: [],
  lanes: [{ origin: 'New Delhi', dest: 'Bengaluru', frequency: 'daily', transitHours: 60 }],
  hubs: [],
  fleet: { truck32: 12 },
  capacity: 80000,
  indicativeRates: [{ leg: 'lineHaul', rate: 8.5 }],
}

describe('partner onboarding actions (PP-04 to PP-07)', () => {
  it('apply → auto invite → KYC with an expired policy → conditional → re-upload closes the condition', () => {
    const r = applyAsPartner(data, typeD, now)
    const id = r.applicationId
    expect(id).toBe('APP-2026-0413')
    let d = r.data
    expect(d.partners[r.partnerId]).toMatchObject({ status: 'applied', type: 'D', tier: null })
    expect(d.partnerUsers[r.userId]).toMatchObject({ role: 'admin', partnerId: r.partnerId })
    expect(pendingPartnerDecisions(d)).toContainEqual({ applicationId: id, kind: 'fit' })
    d = autoDecidePartner(d, id, 'fit', now)
    expect(d.applications[id].status).toBe('invited')
    expect(d.partners[r.partnerId]).toMatchObject({ status: 'kyc', coordinatorId: 'LS-MEERA' })

    d = runPartnerCheck(d, id, { kind: 'digilocker' }, now)
    d = runPartnerCheck(d, id, { kind: 'pennyDrop', holder: 'Vindhya Freight Carriers Pvt Ltd', account: '912020012345678', ifsc: 'UTIB0000123' }, now)
    d = runPartnerCheck(d, id, { kind: 'vahan', regNo: 'DL01LAB4521' }, now)
    d = runPartnerCheck(d, id, { kind: 'sarathi', dl: 'DL-0420190012345' }, now)
    for (const key of ['transportLicence', 'bank', 'vehicles', 'driverLicence', 'policeVerification'] as const) d = uploadPartnerDoc(d, id, key, { file: `${key}.pdf` }, now)
    expect(kycReadyToSubmit(d.applications[id], 'D')).toEqual({ ready: false, missing: ['insurance'] })
    d = uploadPartnerDoc(d, id, 'insurance', { file: 'git.pdf', number: 'GIT/1', expiry: '2026-12-10' }, now)
    expect(kycReadyToSubmit(d.applications[id], 'D').ready).toBe(true)

    d = submitPartnerKyc(d, id, r.userId, now)
    const ins = d.applications[id].documents.find((x) => x.key === 'insurance')!
    expect(ins).toMatchObject({ status: 'flagged', flag: 'expired' })
    expect(d.applications[id].status).toBe('kyc')
    expect(pendingPartnerDecisions(d)).toContainEqual({ applicationId: id, kind: 'kyc' })
    d = autoDecidePartner(d, id, 'kyc', now)
    expect(d.applications[id]).toMatchObject({ status: 'agreement', outcome: { result: 'conditional', conditions: [{ docKey: 'insurance', due: '2026-11-30' }] } })
    expect(d.partners[r.partnerId].status).toBe('agreement')

    d = uploadPartnerDoc(d, id, 'insurance', { file: 'git_renewed.pdf', expiry: '2027-12-31' }, now)
    expect(d.applications[id].documents.find((x) => x.key === 'insurance')!.status).toBe('verified')
    expect(d.applications[id].outcome!.conditions[0].closedAt).toBe(now)
  })

  it('clean KYC is approved at once; a hub operator waits for the audit', () => {
    const f: PartnerApplyInput = { ...typeD, type: 'F', legs: ['originHub', 'destHub'], companyName: 'Belgaum Cargo Hub Pvt Ltd', gstin: '29AAKCB7710F1Z2', pan: 'AAKCB7710F', contact: { ...typeD.contact, mobile: '94481 22007' }, lanes: [], hubs: [{ name: 'Udyambag hub', address: 'Udyambag', pincode: '590001', areaSqft: 30000, docks: 6 }], fleet: {}, capacity: 3000, indicativeRates: [{ leg: 'originHub', rate: 6 }] }
    const r = applyAsPartner(data, f, now)
    const id = r.applicationId
    let d = decideFit(r.data, id, 'invite', {}, 'LS-MEERA', now)
    d = runPartnerCheck(d, id, { kind: 'digilocker' }, now)
    d = runPartnerCheck(d, id, { kind: 'pennyDrop', holder: 'Belgaum Cargo Hub Pvt Ltd', account: '1234567890', ifsc: 'CNRB0001234' }, now)
    for (const key of ['bank', 'policeVerification', 'hubDocs'] as const) d = uploadPartnerDoc(d, id, key, { file: `${key}.pdf` }, now)
    d = uploadPartnerDoc(d, id, 'premisesInsurance', { file: 'p.pdf', number: 'P/1', expiry: '2027-12-31' }, now)
    d = submitPartnerKyc(d, id, r.userId, now)
    expect(d.applications[id]).toMatchObject({ status: 'kyc', outcome: { result: 'approved', by: 'system' } })
    d = bookHubAudit(d, id, { date: '2026-11-26', window: 'morning', contact: 'Site lead', phone: '94481 22008' }, r.userId, now)
    expect(pendingPartnerDecisions(d)).toEqual([{ applicationId: id, kind: 'audit' }])
    d = autoDecidePartner(d, id, 'audit', now)
    expect(d.applications[id]).toMatchObject({ status: 'agreement', hubAudit: { result: 'approved', auditorId: 'LS-KIRAN' } })
    expect(Object.values(d.applications[id].hubAudit!.items!).every((i) => i.result === 'pass' && i.photo.lat > 15)).toBe(true)
  })

  it('a Delhi courier is waitlisted with a monthly re-score date', () => {
    const b: PartnerApplyInput = { ...typeD, type: 'B', legs: ['firstMile', 'lastMile'], services: ['parcel'], companyName: 'Capital Express Couriers', gstin: '07AAGCC3318P1Z6', pan: 'AAGCC3318P', contact: { ...typeD.contact, mobile: '98112 45670' }, pincodes: ['110020', '110001', '110037'], lanes: [] }
    const r = applyAsPartner(data, b, now)
    const d = autoDecidePartner(r.data, r.applicationId, 'fit', now)
    expect(d.applications[r.applicationId]).toMatchObject({ status: 'waitlisted', rescoreOn: '2026-12-23' })
    expect(d.partners[r.partnerId].status).toBe('applied')
  })
})
