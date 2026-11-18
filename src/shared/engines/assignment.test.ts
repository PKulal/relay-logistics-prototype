import { buildSeed } from '@data/seed'
import type { DemoData, Leg } from '@shared/types'
import { legCost, planAssignment, rankCandidates, type AssignmentInput } from './assignment'
import { computeEta, earliestPickupDate, legPattern, legWindows } from './schedule'

const data = buildSeed()

const hero: AssignmentInput = {
  pattern: ['firstMile', 'originHub', 'lineHaul', 'destHub', 'lastMile'],
  origin: data.pincodes['110020'],
  dest: data.pincodes['580030'],
  lane: data.lanes['LN-DEL-HBL'],
  serviceKind: 'ptl',
  service: 'expressPtl',
  chargeableKg: 162,
  pieces: 6,
  date: '2026-11-23',
}

describe('assignment — hero shipment (seed-data.md §3)', () => {
  const plan = planAssignment(data, hero)

  it('assigns the documented partner to each of the 5 legs', () => {
    expect(plan.map((l) => l.partnerId)).toEqual(['P-SWIFTCITY', 'P-NCRXD', 'P-DECCAN', 'P-HUBLIWH', 'P-NKEXP'])
  })

  it('costs the legs ₹250, ₹162, ₹1,458, ₹162, ₹300 = ₹2,332', () => {
    expect(plan.map((l) => l.cost)).toEqual([250, 162, 1458, 162, 300])
    expect(plan.reduce((s, l) => s + l.cost, 0)).toBe(2332)
  })

  it('first mile: MetroDash skipped at capacity; SwiftCity (Gold 86) ahead of cheaper QuickLink (Silver 74)', () => {
    const fm = plan[0].candidates
    expect(fm.map((c) => [c.partnerId, c.eligible, c.reason ?? null])).toEqual([
      ['P-SWIFTCITY', true, null],
      ['P-QUICKLINK', true, null],
      ['P-METRODASH', false, 'atCapacity'],
    ])
    expect(fm[1].cost).toBe(220)
  })
})

describe('assignment rules', () => {
  it('ranks by score, then cost, then transit', () => {
    const d: DemoData = structuredClone(data)
    d.partners['P-QUICKLINK'].score = 86 // tie with SwiftCity → cheaper QuickLink wins
    expect(rankCandidates(d, 'firstMile', hero)[0].partnerId).toBe('P-QUICKLINK')
  })

  it('counts modelled legs that day against capacity', () => {
    const d: DemoData = structuredClone(data)
    d.partners['P-SWIFTCITY'].baseLoadToday = 399
    d.legs['JOB-X-L1'] = { id: 'JOB-X-L1', partnerId: 'P-SWIFTCITY', status: 'offered', window: { from: '2026-11-23T12:00:00+05:30', to: '' } } as Leg
    expect(planAssignment(d, hero)[0].partnerId).toBe('P-QUICKLINK')
  })

  it('caps Bronze partners at 50% of capacity', () => {
    const d: DemoData = structuredClone(data)
    const ft = d.partners['P-FASTTRACK'] // capacity 200 → 100 while Bronze
    ft.baseLoadToday = 100
    const input = { ...hero, origin: d.pincodes['570001'], dest: d.pincodes['411001'], lane: d.lanes['LN-BLR-BOM'], serviceKind: 'parcel' as const, service: 'standard' as const }
    expect(rankCandidates(d, 'firstMile', input)[0]).toMatchObject({ partnerId: 'P-FASTTRACK', eligible: false, reason: 'atCapacity' })
  })

  it('skips suspended partners', () => {
    const d: DemoData = structuredClone(data)
    d.partners['P-SWIFTCITY'].status = 'suspended'
    const fm = rankCandidates(d, 'firstMile', hero)
    expect(fm[0].partnerId).toBe('P-QUICKLINK')
    expect(fm.find((c) => c.partnerId === 'P-SWIFTCITY')?.reason).toBe('notActive')
  })

  it('throws when a leg has no eligible partner', () => {
    const d: DemoData = structuredClone(data)
    d.partners['P-DECCAN'].status = 'suspended'
    expect(() => planAssignment(d, hero)).toThrow(/lineHaul/)
  })

  it('applies per-kg minimums', () => {
    const deccan = Object.values(data.partnerRates).find((r) => r.partnerId === 'P-DECCAN' && r.laneOrCluster === 'LN-DEL-HBL')!
    expect(legCost(deccan, 30, 1)).toBe(450) // min 50 kg × ₹9
    const ncr = Object.values(data.partnerRates).find((r) => r.partnerId === 'P-NCRXD' && r.legType === 'originHub')!
    expect(legCost(ncr, 80, 1)).toBe(150) // min ₹150
  })
})

describe('schedule', () => {
  it('leg patterns: intra-city 2, intra-region 3, long-haul 5 (ERP §12 #8)', () => {
    const p = data.pincodes
    expect(legPattern(p['110020'], p['110001'])).toHaveLength(2)
    expect(legPattern(p['110020'], p['122050'])).toHaveLength(3)
    expect(legPattern(p['110020'], p['580030'])).toHaveLength(5)
  })

  it('hero: booked Monday before the cut-off, 3-day Express PTL → ETA Thursday 26-Nov', () => {
    const pickup = earliestPickupDate('2026-11-23T10:05:00+05:30', '14:00')
    expect(pickup).toBe('2026-11-23')
    expect(computeEta(pickup, 3)).toBe('2026-11-26')
  })

  it('after the 14:00 cut-off, pickup moves to the next working day (skipping Sunday)', () => {
    expect(earliestPickupDate('2026-11-23T14:30:00+05:30', '14:00')).toBe('2026-11-24')
    expect(earliestPickupDate('2026-11-21T15:00:00+05:30', '14:00')).toBe('2026-11-23') // Sat → Mon
  })

  it('hero leg windows connect: pickup 14:00–16:00, truck 23:00, appointment 11:00–13:00', () => {
    const w = legWindows(hero.pattern, {
      pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' },
      eta: '2026-11-26',
      lane: data.lanes['LN-DEL-HBL'],
      deliverySlot: { date: '2026-11-26', from: '11:00', to: '13:00' },
    })
    expect(w).toEqual([
      { from: '2026-11-23T14:00:00+05:30', to: '2026-11-23T16:00:00+05:30' },
      { from: '2026-11-23T16:00:00+05:30', to: '2026-11-23T23:00:00+05:30' },
      { from: '2026-11-23T23:00:00+05:30', to: '2026-11-26T06:00:00+05:30' },
      { from: '2026-11-26T06:00:00+05:30', to: '2026-11-26T10:00:00+05:30' },
      { from: '2026-11-26T11:00:00+05:30', to: '2026-11-26T13:00:00+05:30' },
    ])
  })
})
