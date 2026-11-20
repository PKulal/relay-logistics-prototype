import { buildSeed, DEMO_START } from '@data/seed'
import { bookShipment } from '@shared/store/booking'
import { laneAlerts, laneRows, quoteChecks, simulate } from './pricingMonitor'

const HERO_INPUT = {
  customerId: 'C-SHARMA',
  originPincode: '110020',
  destPincode: '580030',
  serviceKind: 'ptl' as const,
  service: 'expressPtl' as const,
  pieces: Array.from({ length: 6 }, () => ({ l: 60, b: 40, h: 40, weight: 20 })),
  declaredValue: 180000,
  addOns: { appointment: true, insurance: true, specialHandling: false },
  paymentMode: 'tbb' as const,
}

describe('ERP-25 simulator (ERP spec §7.2 worked example)', () => {
  it('hero: ₹3,074.80, legs ₹2,332, ₹562.80 (18.3%) → ₹501.30 (16.3%) above target', () => {
    const r = simulate(buildSeed(), HERO_INPUT, '2026-11-23')
    if (!r.ok) throw new Error(r.code)
    expect(r.sim.quote.price.subtotal).toBe(3074.8)
    expect(r.sim.legs.map((l) => [l.partnerId, l.cost])).toEqual([
      ['P-SWIFTCITY', 250],
      ['P-NCRXD', 162],
      ['P-DECCAN', 1458],
      ['P-HUBLIWH', 162],
      ['P-NKEXP', 300],
    ])
    expect(r.sim.margin).toMatchObject({ legTotal: 2332, gross: 562.8, grossPct: 18.3, buffer: 61.5, net: 501.3, netPct: 16.3, belowTarget: false })
  })

  it('another partner mix recalculates; errors come back as codes', () => {
    const d = buildSeed()
    const r = simulate(d, HERO_INPUT, '2026-11-23')
    if (!r.ok) throw new Error(r.code)
    const alt = r.sim.legs[0].options.find((o) => o.partnerId !== 'P-SWIFTCITY')!
    const m = simulate(d, HERO_INPUT, '2026-11-23', { 0: alt.partnerId })
    if (!m.ok) throw new Error(m.code)
    expect(m.sim.legs[0]).toMatchObject({ partnerId: alt.partnerId, cost: alt.cost })
    expect(m.sim.margin.legTotal).toBe(2332 - 250 + alt.cost)
    expect(simulate(d, { ...HERO_INPUT, destPincode: '600032' }, '2026-11-23')).toEqual({ ok: false, code: 'destNotServiceable' })
  })
})

describe('ERP-24 margin monitor', () => {
  it('lane P&L from booked shipments; the hero lands on Delhi NCR → Hubballi', () => {
    const d = bookShipment(buildSeed(), { ...HERO_INPUT, bookedByUserId: 'CU-PRIYA', pickupLocationId: 'PL-OKHLA', consigneeId: 'CN-HED', invoice: { no: 'SE/25-26/1187', date: '2026-11-23', value: 180000 }, hsn: '8537', goodsDescription: 'LT switchgear panels', pieces: HERO_INPUT.pieces, pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' } }, DEMO_START).data
    const rows = laneRows(d, DEMO_START)
    const hub = rows.find((r) => r.key === 'Delhi NCR → Hubballi')!
    const hero = hub.shipments.find((p) => p.shipment.id === 'LGS-DEL-000781')!
    expect(hero).toMatchObject({ revenue: 3074.8, legCosts: 2332, insurance: 180, claims: 0, margin: 562.8, marginPct: 18.3 })
    expect(laneAlerts(d, rows, DEMO_START).some((a) => a.kind === 'belowTarget')).toBe(true)
  })

  it('quote checks list flagged bookings with the alternative model when it clears target', () => {
    const checks = quoteChecks(buildSeed())
    expect(checks.length).toBeGreaterThan(0)
    expect(checks.every((c) => c.netPct < 15)).toBe(true)
    expect(checks.some((c) => c.alternative)).toBe(true)
  })
})
