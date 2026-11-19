import { buildSeed, DEMO_START } from '@data/seed'
import { planAssignment } from '@shared/engines/assignment'
import { trialJobScore, tripTrialJob } from '@shared/engines/partnerOnboarding'
import { findLane } from '@shared/engines/quote'
import { partnerLineMargin } from '@shared/engines/rateCardMargin'
import type { DemoData } from '@shared/types'
import {
  addFieldStaff,
  answerCounter,
  autoDecideCommercial,
  decideTrial,
  markReadyForTrial,
  pendingCommercialDecisions,
  proposePartnerChanges,
  recordTripForTrial,
  signPartnerAgreement,
  simulateTrialJob,
} from './partnerAgreementActions'
import { applyAsPartner, autoDecidePartner, runPartnerCheck, submitPartnerKyc, uploadPartnerDoc, type PartnerApplyInput } from './partnerOnboardingActions'

const now = DEMO_START
const DECCAN = 'APP-2026-0412'

/** Cost of Deccan's line-haul leg for a 100 kg Express PTL shipment to a pincode. */
function deccanCost(d: DemoData, dest: string): number {
  const o = d.pincodes['110020']
  const t = d.pincodes[dest]
  const plan = planAssignment(d, { pattern: ['lineHaul'], origin: o, dest: t, lane: findLane(d, o, t), serviceKind: 'ptl', service: 'expressPtl', chargeableKg: 100, pieces: 1, date: '2026-11-24' })
  return plan[0].cost
}

describe('trial scoring (source §4 Step 7)', () => {
  it('scores on time, scan compliance and anomaly flags', () => {
    expect(trialJobScore({ onTime: true, scanPct: 100, anomalies: [] })).toBe(100)
    expect(trialJobScore({ onTime: true, scanPct: 90, anomalies: ['longHalt', 'weightGap'] })).toBe(86)
    expect(trialJobScore({ onTime: false, scanPct: 100, anomalies: ['lateArrival'] })).toBe(79)
  })
  it('Deccan is 2 of 3 trips at 84', () => {
    const p = buildSeed().partners['P-DECCAN']
    expect(p.trial).toMatchObject({ tripsDone: 2, tripsRequired: 3, score: 84 })
  })
})

describe('Deccan: Belagavi rate negotiation after signature (PP-08, ERP-13)', () => {
  it('₹14.50 is not accepted; a counter of ₹12 is declined, ₹9 is accepted and loaded for Belagavi drops only', () => {
    let d = buildSeed()
    const line = () => d.applications[DECCAN].agreement!.lines.find((l) => l.destCity === 'Belagavi')!
    expect(line().status).toBe('notAccepted')
    expect(partnerLineMargin(d, 'P-DECCAN', line())!.marginPct).toBeLessThan(0)
    expect(deccanCost(d, '590001')).toBe(900) // the general Delhi → Hubballi line, ₹9 × 100 kg

    d = proposePartnerChanges(d, DECCAN, [{ lineId: line().id, rate: 12, remark: 'Extra 95 km' }], 'PU-PRAKASH', now)
    expect(d.applications[DECCAN].agreement!.status).toBe('signed')
    expect(pendingCommercialDecisions(d)).toContainEqual({ id: DECCAN, kind: 'counter' })
    d = autoDecideCommercial(d, DECCAN, 'counter', now)
    expect(line()).toMatchObject({ status: 'notAccepted', rate: 14.5 })
    expect(line().counter).toBeUndefined()

    d = proposePartnerChanges(d, DECCAN, [{ lineId: line().id, rate: 9, remark: 'Same as Hubballi' }], 'PU-PRAKASH', now)
    d = autoDecideCommercial(d, DECCAN, 'counter', now)
    expect(line()).toMatchObject({ status: 'accepted', rate: 9, pricingApproval: { by: 'system' } })
    expect(Object.values(d.partnerRates).find((r) => r.partnerId === 'P-DECCAN' && r.destCity === 'Belagavi')).toMatchObject({ rate: 9, laneOrCluster: 'LN-DEL-HBL' })
    // The hero lane keeps its own line
    expect(deccanCost(d, '580030')).toBe(900)
  })

  it('manual: Meera declines the counter; the line stays not accepted', () => {
    let d = buildSeed()
    const id = d.applications[DECCAN].agreement!.lines[1].id
    d = proposePartnerChanges(d, DECCAN, [{ lineId: id, rate: 13, remark: '' }], 'PU-PRAKASH', now)
    d = answerCounter(d, DECCAN, id, false, 'LS-MEERA', now)
    expect(d.applications[DECCAN].agreement!.lines[1]).toMatchObject({ status: 'notAccepted', rate: 14.5 })
  })
})

describe('Deccan: the hero trip is the third trial trip → go live at Bronze (PP-10, ERP-14)', () => {
  it('an on-time arrival completes the trial; the rules put Deccan live at Bronze', () => {
    let d = buildSeed()
    const trip = { ...d.trips['TRP-2026-0931'], status: 'arrived' as const, arrivedAt: '2026-11-26T05:10:00+05:30' }
    expect(tripTrialJob(trip, trip.arrivedAt)).toMatchObject({ onTime: true, scanPct: 100, anomalies: [], score: 100 })
    d = recordTripForTrial(d, trip, trip.arrivedAt)
    expect(d.partners['P-DECCAN'].trial).toMatchObject({ tripsDone: 3, score: 89 })
    expect(pendingCommercialDecisions(d)).toContainEqual({ id: 'P-DECCAN', kind: 'trial' })
    d = autoDecideCommercial(d, 'P-DECCAN', 'trial', now)
    expect(d.partners['P-DECCAN']).toMatchObject({ status: 'live', tier: 'bronze', score: 89 })
    expect(d.applications[DECCAN].status).toBe('live')
  })

  it('go live needs a complete trial at or above the pass mark; extend raises the requirement', () => {
    let d = buildSeed()
    expect(decideTrial(d, 'P-DECCAN', 'live', '', 'LS-MEERA', now).partners['P-DECCAN'].status).toBe('trial')
    d = decideTrial(d, 'P-DECCAN', 'extend', 'One more trip on the new route', 'LS-MEERA', now)
    expect(d.partners['P-DECCAN'].trial).toMatchObject({ tripsRequired: 6, decision: { result: 'extended' } })
  })
})

describe('a new line-haul partner from agreement to live', () => {
  it('commercials → e-sign → setup → trial → Bronze', () => {
    const x: PartnerApplyInput = {
      type: 'D',
      legs: ['lineHaul'],
      services: ['expressPtl', 'standardPtl'],
      companyName: 'Vindhya Freight Carriers Pvt Ltd',
      gstin: '07AAHCV5521R1Z3',
      pan: 'AAHCV5521R',
      constitution: 'privateLtd',
      contact: { name: 'Harish Tiwari', designation: 'Director', mobile: '98990 31245', email: 'h@v.in' },
      address: 'New Delhi',
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
    const r = applyAsPartner(buildSeed(), x, now)
    const id = r.applicationId
    let d = autoDecidePartner(r.data, id, 'fit', now)
    d = runPartnerCheck(d, id, { kind: 'digilocker' }, now)
    d = runPartnerCheck(d, id, { kind: 'pennyDrop', holder: 'Vindhya Freight Carriers Pvt Ltd', account: '912020012345678', ifsc: 'UTIB0000123' }, now)
    d = runPartnerCheck(d, id, { kind: 'vahan', regNo: 'DL01LAB4521' }, now)
    d = runPartnerCheck(d, id, { kind: 'sarathi', dl: 'DL-0420190012345' }, now)
    for (const k of ['transportLicence', 'bank', 'vehicles', 'driverLicence', 'policeVerification'] as const) d = uploadPartnerDoc(d, id, k, { file: `${k}.pdf` }, now)
    d = uploadPartnerDoc(d, id, 'insurance', { file: 'git.pdf', number: 'G/1', expiry: '2027-12-31' }, now)
    d = submitPartnerKyc(d, id, r.userId, now)
    expect(d.applications[id].status).toBe('agreement')

    // Automatic commercials: one Delhi → Bengaluru line, just below target but profitable → Pricing approves → issued
    expect(pendingCommercialDecisions(d)).toContainEqual({ id, kind: 'commercials' })
    d = autoDecideCommercial(d, id, 'commercials', now)
    const g = d.applications[id].agreement!
    expect(g.status).toBe('issued')
    expect(g.lines).toEqual([expect.objectContaining({ leg: 'lineHaul', laneOrCluster: 'LN-DEL-BLR', rate: 8.5, status: 'accepted', pricingApproval: expect.objectContaining({ by: 'system' }) })])

    d = signPartnerAgreement(d, id, 'aadhaarOtp', true, r.userId, now)
    expect(d.partners[r.partnerId].status).toBe('integration')
    expect(Object.values(d.partnerRates).filter((l) => l.partnerId === r.partnerId)).toEqual([expect.objectContaining({ legType: 'lineHaul', laneOrCluster: 'LN-DEL-BLR', rate: 8.5 })])

    // PP-09 (Type D → Partner App): needs field staff first
    expect(markReadyForTrial(d, id, r.userId, now)).toBe(d)
    d = addFieldStaff(d, r.partnerId, { name: 'Raju Yadav', mobile: '98990 11122', role: 'driver', language: 'hi', photo: 'p', idProof: { kind: 'dl', last4: '2345' } })
    d = markReadyForTrial(d, id, r.userId, now)
    expect(d.partners[r.partnerId]).toMatchObject({ status: 'trial', laneIds: ['LN-DEL-BLR'], trial: { tripsRequired: 3, unit: 'trips', tripsDone: 0 } })
    expect(d.lanes['LN-DEL-BLR'].lineHaulPartnerIds).toContain(r.partnerId)

    for (let i = 0; i < 3; i++) d = simulateTrialJob(d, r.partnerId, now)
    expect(d.partners[r.partnerId].trial).toMatchObject({ tripsDone: 3, score: 91 })
    d = autoDecideCommercial(d, r.partnerId, 'trial', now)
    expect(d.partners[r.partnerId]).toMatchObject({ status: 'live', tier: 'bronze' })
  })
})
