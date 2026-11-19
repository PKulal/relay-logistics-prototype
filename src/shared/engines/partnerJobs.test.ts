import { buildSeed, DEMO_START } from '@data/seed'
import { addMinutes } from '@shared/lib/time'
import { bookShipment, type BookingInput } from '@shared/store/booking'
import { acceptLegs, assignLegs, flagLeg, reportProblem, unassignLeg } from '@shared/store/partnerActions'
import { acceptBy, capacityToday, jobEnds, jobSpecials, jobTab, neighbours, partnerAlerts, scoreTrend, staffOptions, todayTiles, vehicleRequired } from './partnerJobs'
import { publishScores } from '@shared/store/scoringActions'

const hero: BookingInput = {
  customerId: 'C-SHARMA',
  bookedByUserId: 'CU-PRIYA',
  pickupLocationId: 'PL-OKHLA',
  consigneeId: 'CN-HED',
  serviceKind: 'ptl',
  service: 'expressPtl',
  paymentMode: 'tbb',
  addOns: { appointment: true, insurance: true, specialHandling: false },
  invoice: { no: 'SE/25-26/1187', date: '2026-11-23', value: 180000 },
  hsn: '8537',
  goodsDescription: 'LT switchgear panels',
  pieces: Array.from({ length: 6 }, () => ({ l: 60, b: 40, h: 40, weight: 20 })),
  pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' },
  autoAccept: true,
}
const { data } = bookShipment(buildSeed(), hero, DEMO_START)
const s = data.shipments['LGS-DEL-000781']
const L = (n: number) => data.legs[`JOB-000781-L${n}`]

describe('booking with partner auto-accept (agreed)', () => {
  it('SwiftCity (hand-driven) gets L1 as an offer; the other partners accept and assign their default staff', () => {
    expect(L(1).status).toBe('offered')
    expect(L(1).staffId).toBeUndefined()
    expect([2, 3, 4, 5].map((n) => [L(n).status, L(n).staffId])).toEqual([
      ['assigned', 'FS-POOJA'],
      ['assigned', 'FS-BASAVARAJ'],
      ['assigned', 'FS-HWH-SHIVA'],
      ['assigned', 'FS-MANJU'],
    ])
    expect(L(3).vehicleId).toBe('V-KA25AB1234')
  })
})

describe('PP-12 / PP-13 job view', () => {
  it('maps leg statuses to inbox tabs', () => {
    expect(jobTab(L(1))).toBe('offered')
    expect(jobTab(L(2))).toBe('assigned')
  })

  it('accept-by is 30 minutes after the offer', () => {
    expect(acceptBy(data, L(1))).toBe(addMinutes(DEMO_START, 30))
  })

  it('pickup job shows the shipper and the origin hub; line-haul shows hubs only (masking)', () => {
    expect(jobEnds(data, L(1), s)).toEqual({
      from: { name: 'Sharma Electricals', place: 'Okhla Factory, Plot 42, Okhla Industrial Area Phase II, New Delhi', pincode: '110020' },
      to: { name: 'NCR CrossDock, Gurugram', place: 'Khasra 210, Daulatabad Road, Gurugram, Haryana', pincode: '122001' },
    })
    const lh = jobEnds(data, L(3), s)
    expect([lh.from.name, lh.to.name]).toEqual(['NCR CrossDock, Gurugram', 'Hubli Warehousing, Hubballi'])
    expect(JSON.stringify(lh)).not.toMatch(/Sharma|Hubli Electric/)
    expect(jobEnds(data, L(5), s).to.name).toBe('Hubli Electric Distributors')
  })

  it('special icons and neighbours', () => {
    expect(jobSpecials(data, L(1), s)).toEqual(['ewb'])
    expect(jobSpecials(data, L(5), s)).toEqual(['appointment', 'ewb'])
    expect(neighbours(data, L(1), s).next?.id).toBe('P-NCRXD')
    expect(neighbours(data, L(3), s)).toMatchObject({ prev: { id: 'P-NCRXD' }, next: { id: 'P-HUBLIWH' } })
  })
})

describe('PP-14 assign', () => {
  it('lists SwiftCity riders with the day load', () => {
    const opts = staffOptions(data, 'P-SWIFTCITY', 'firstMile', DEMO_START)
    expect(opts.map((o) => o.staff.id).sort()).toEqual(['FS-RAVI', 'FS-SWC-AJAY', 'FS-SWC-DEEPAK'])
    // 7 pickups still to do, plus the ones already done today
    expect(opts.find((o) => o.staff.id === 'FS-RAVI')!.jobsToday).toBeGreaterThanOrEqual(7)
  })

  it('blocks staff with an expired licence or pending police verification', () => {
    const d = structuredClone(data)
    d.fieldStaff['FS-SWC-AJAY'].licenceValidTill = '2026-11-01'
    d.fieldStaff['FS-SWC-DEEPAK'].policeVerified = false
    const blocks = Object.fromEntries(staffOptions(d, 'P-SWIFTCITY', 'firstMile', DEMO_START).map((o) => [o.staff.id, o.block]))
    expect(blocks).toEqual({ 'FS-RAVI': undefined, 'FS-SWC-AJAY': 'licenceExpired', 'FS-SWC-DEEPAK': 'policeVerificationPending' })
  })

  it('needs a vehicle for the 120 kg pickup and for line-haul', () => {
    expect(vehicleRequired(L(1), s)).toBe(true)
    expect(vehicleRequired(L(3), s)).toBe(true)
    expect(vehicleRequired(L(5), s)).toBe(false)
  })
})

describe('partner actions', () => {
  it('accept, assign Ravi (with vehicle), unassign', () => {
    const accepted = acceptLegs(data, ['JOB-000781-L1'], 'PU-NEHA', DEMO_START)
    expect(accepted.legs['JOB-000781-L1'].status).toBe('accepted')
    const assigned = assignLegs(accepted, ['JOB-000781-L1'], 'FS-RAVI', 'V-DL01LT4521', 'PU-NEHA', DEMO_START)
    expect(assigned.legs['JOB-000781-L1']).toMatchObject({ status: 'assigned', staffId: 'FS-RAVI', vehicleId: 'V-DL01LT4521' })
    expect(Object.values(assigned.notifications).at(-1)).toMatchObject({ audience: { app: 'partnerApp', userId: 'FS-RAVI' }, body: 'LGS-DEL-000781' })
    const back = unassignLeg(assigned, 'JOB-000781-L1', 'PU-NEHA', DEMO_START)
    expect(back.legs['JOB-000781-L1']).toMatchObject({ status: 'accepted', staffId: undefined })
  })

  it('cannot assign a job that has not been accepted', () => {
    expect(assignLegs(data, ['JOB-000781-L1'], 'FS-RAVI', undefined, 'PU-NEHA', DEMO_START)).toBe(data)
  })

  it('flag not serviceable records the reason and returns the job to Logisco', () => {
    const flagged = flagLeg(data, 'JOB-000781-L1', 'capacityFull', 'All riders out', 'PU-NEHA', DEMO_START)
    expect(flagged.legs['JOB-000781-L1'].status).toBe('flagged')
    expect(Object.values(flagged.events).at(-1)).toMatchObject({ type: 'legFlagged', reason: 'capacityFull', note: 'All riders out' })
  })

  it('report a problem raises a ticket on the shipment', () => {
    const next = reportProblem(data, 'JOB-000781-L1', 'vehicleDelay', 'Tempo stuck in traffic', 'PU-NEHA', DEMO_START)
    expect(Object.values(next.tickets).at(-1)).toMatchObject({ shipmentId: 'LGS-DEL-000781', category: 'vehicleDelay', status: 'open' })
  })
})

describe('PP-11 dashboard figures', () => {
  it('before the weekly run: 85.6 Gold (09–15 Nov); after publishing 16–22 Nov: 86.2, up 0.6', () => {
    expect(scoreTrend(data, 'P-SWIFTCITY')).toMatchObject({ score: 85.6, tier: 'gold' })
    expect(scoreTrend(publishScores(data, '2026-11-16', 'LS-MEERA', DEMO_START), 'P-SWIFTCITY')).toEqual({ score: 86.2, tier: 'gold', delta: 0.6 })
  })

  it('capacity today counts outside work plus the day jobs', () => {
    const c = capacityToday(data, 'P-SWIFTCITY', DEMO_START)
    expect(c.capacity).toBe(400)
    expect(c.used).toBeGreaterThan(180)
  })

  it('today tiles count SwiftCity 7 assigned pickups', () => {
    expect(todayTiles(data, 'P-SWIFTCITY', DEMO_START).assigned).toBe(7)
  })

  it('alerts NCR CrossDock to the shortage claim it is liable for', () => {
    expect(partnerAlerts(data, 'P-NCRXD', DEMO_START)).toContainEqual({ kind: 'claimAttributed', claimId: 'CLM-2026-0142' })
  })
})
