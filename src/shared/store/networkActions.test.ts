import { buildSeed, DEMO_START } from '@data/seed'
import { rankCandidates } from '@shared/engines/assignment'
import { coverageGaps, laneForecast, pincodeCoverage, utilisation } from '@shared/engines/network'
import { networkFit } from '@shared/engines/partnerOnboarding'
import { legWindows } from '@shared/engines/schedule'
import { addPincode, createRecruitmentNeed, decideCoverageChange, decideSettings, proposeSettings, requestCoverageChange, setCapacity, updateLane, updatePincode } from './networkActions'

const now = DEMO_START

describe('network engine', () => {
  it('coverage per pincode; the two new Noida pincodes have nobody; Belagavi last mile has one partner', () => {
    const d = buildSeed()
    const cov = pincodeCoverage(d)
    expect(cov['201303']).toEqual({ firstMile: [], lastMile: [] })
    const gaps = coverageGaps(d, now)
    expect(gaps.find((g) => g.key === 'firstMile-201303')).toMatchObject({ action: 'recruit', partners: [] })
    expect(gaps.find((g) => g.key === 'lastMile-590001')).toMatchObject({ action: 'backup', partners: ['P-NKEXP'] })
    expect(gaps.some((g) => g.place === '600032')).toBe(false) // not serviceable
  })

  it('utilisation respects closed days; the forecast is 14 days with capacity', () => {
    const d = buildSeed()
    const days = utilisation(d, 'P-SWIFTCITY', '2026-12-24', 2)
    expect(days[1]).toMatchObject({ date: '2026-12-25', closed: true, capacity: 0, jobs: 0 })
    const f = laneForecast(d, 'LN-DEL-HBL', now)
    expect(f.days).toHaveLength(14)
    expect(f.growthPct).toBe(18)
  })
})

describe('network actions', () => {
  it('ERP-18: edit and add pincodes (validated, audited)', () => {
    let d = buildSeed()
    d = updatePincode(d, '581110', { oda: false }, 'LS-KARTHIK', now)
    expect(d.pincodes['581110'].oda).toBe(false)
    expect(addPincode(d, { code: '12345', area: 'x', city: 'y', state: 'z', region: 'Karnataka', hubId: 'HUB-HBL', oda: false, metro: false }, 'LS-KARTHIK', now)).toBe(d)
    d = addPincode(d, { code: '591307', area: 'Gokak', city: 'Gokak', state: 'Karnataka', region: 'Karnataka', hubId: 'HUB-HBL', oda: true, metro: false }, 'LS-KARTHIK', now)
    expect(d.pincodes['591307']).toMatchObject({ serviceable: true, oda: true, lat: d.pincodes[d.hubs['HUB-HBL'].pincode].lat })
  })

  it('ERP-19: lane edits are validated; ERP-20: leg times need a different approver and then drive new leg windows', () => {
    let d = buildSeed()
    expect(updateLane(d, 'LN-DEL-HBL', { departureTime: '25:00' }, 'LS-KARTHIK', now)).toBe(d)
    d = updateLane(d, 'LN-DEL-HBL', { departureTime: '22:00' }, 'LS-KARTHIK', now)
    expect(d.lanes['LN-DEL-HBL'].departureTime).toBe('22:00')
    const r = proposeSettings(d, { destHubHandoverBy: '09:00' }, 'Earlier out-for-delivery in Hubballi', 'LS-KARTHIK', now)
    d = r.data
    expect(d.settings.destHubHandoverBy).toBe('10:00')
    expect(decideSettings(d, r.id!, true, 'LS-KARTHIK', now)).toBe(d)
    d = decideSettings(d, r.id!, true, 'LS-RAHUL', now)
    expect(d.settings.destHubHandoverBy).toBe('09:00')
    const w = legWindows(['firstMile', 'originHub', 'lineHaul', 'destHub', 'lastMile'], { pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' }, eta: '2026-11-26', lane: d.lanes['LN-DEL-HBL'], deliverySlot: { date: '2026-11-26', from: '11:00', to: '13:00' }, times: d.settings })
    expect(w[3].to).toBe('2026-11-26T09:00:00+05:30')
  })

  it('PP-18: a closed day takes no offers; an override changes capacity', () => {
    let d = buildSeed()
    const input = { pattern: ['firstMile' as const], origin: d.pincodes['110020'], dest: d.pincodes['580030'], serviceKind: 'ptl' as const, service: 'expressPtl' as const, chargeableKg: 20, pieces: 1, date: '2026-11-30' }
    expect(rankCandidates(d, 'firstMile', input).find((c) => c.partnerId === 'P-SWIFTCITY')).toMatchObject({ eligible: true })
    d = setCapacity(d, 'P-SWIFTCITY', { closed: { '2026-11-30': true }, overrides: { '2026-12-01': 200 } }, 'PU-VIKRAM', now)
    expect(rankCandidates(d, 'firstMile', input).find((c) => c.partnerId === 'P-SWIFTCITY')).toMatchObject({ eligible: false, reason: 'atCapacity' })
    expect(utilisation(d, 'P-SWIFTCITY', '2026-12-01', 1)[0]).toMatchObject({ capacity: 200, override: 200 })
    expect(setCapacity(d, 'P-SWIFTCITY', { capacityPerDay: 0 }, 'PU-VIKRAM', now)).toBe(d)
  })

  it('PP-19 → ERP-21: the Noida request approved closes the gap; a rejection needs a note', () => {
    let d = buildSeed()
    expect(d.coverageRequests['CR-0001'].status).toBe('pending')
    expect(decideCoverageChange(d, 'CR-0001', false, ' ', 'LS-KARTHIK', now)).toBe(d)
    d = decideCoverageChange(d, 'CR-0001', true, '', 'LS-KARTHIK', now)
    expect(d.partners['P-SWIFTCITY'].coveragePincodes).toEqual(expect.arrayContaining(['201303', '201309']))
    expect(pincodeCoverage(d)['201303'].firstMile).toContain('P-SWIFTCITY')
    const r = requestCoverageChange(d, 'P-SWIFTCITY', { action: 'remove', pincodes: ['122050'], laneIds: [], effectiveFrom: '2026-12-01', reason: 'Manesar rider leaving' }, 'PU-VIKRAM', now)
    expect(r.data.coverageRequests[r.id!]).toMatchObject({ status: 'pending', action: 'remove' })
    expect(requestCoverageChange(d, 'P-SWIFTCITY', { action: 'add', pincodes: ['999999'], laneIds: [], effectiveFrom: '2026-12-01', reason: 'x' }, 'PU-VIKRAM', now).id).toBeUndefined()
  })

  it('ERP-21: a recruitment need raises the fit of matching applicants', () => {
    let d = buildSeed()
    const x = { type: 'B' as const, legs: ['lastMile' as const], pincodes: ['590001'], lanes: [], hubs: [] }
    const before = networkFit(d, x).fitScore
    d = createRecruitmentNeed(d, 'lastMile', '590001', 'LS-KARTHIK', now)
    expect(networkFit(d, x).fitScore).toBe(Math.min(99, before + 8))
    expect(createRecruitmentNeed(d, 'lastMile', '590001', 'LS-KARTHIK', now)).toBe(d)
  })
})
