import { buildSeed, DEMO_START } from '@data/seed'
import { bookShipment } from '@shared/store/booking'
import { legRows, NO_FILTERS, shipmentRows } from './jobBoard'

const seed = buildSeed()

/** The hero, booked as CP-13 does it. */
const { data } = bookShipment(
  seed,
  {
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
  },
  '2026-11-23T10:05:00+05:30',
)

describe('ERP-05 legs view', () => {
  it('shows the new booking’s 5 legs, offered to their partners', () => {
    const rows = legRows(data, { ...NO_FILTERS, q: '000781' }, DEMO_START)
    expect(rows.map((r) => [r.leg.id, r.leg.partnerId, r.leg.status])).toEqual([
      ['JOB-000781-L1', 'P-SWIFTCITY', 'offered'],
      ['JOB-000781-L2', 'P-NCRXD', 'offered'],
      ['JOB-000781-L3', 'P-DECCAN', 'offered'],
      ['JOB-000781-L4', 'P-HUBLIWH', 'offered'],
      ['JOB-000781-L5', 'P-NKEXP', 'offered'],
    ])
    expect(rows[0].last).toMatchObject({ event: { type: 'legOffered' }, place: 'New Delhi' })
    expect(rows[2].last?.place).toBe('Delhi NCR → Hubballi')
  })

  it('hides finished work unless asked', () => {
    const active = legRows(data, NO_FILTERS, DEMO_START)
    const all = legRows(data, { ...NO_FILTERS, includeDone: true }, DEMO_START)
    expect(all.length).toBe(Object.keys(data.legs).length)
    expect(active.length).toBeLessThan(all.length)
    expect(active.every((r) => !['handedOver', 'delivered', 'closed', 'withdrawn'].includes(r.leg.status))).toBe(true)
  })

  it('filters by partner, hub, status and SLA state', () => {
    expect(legRows(data, { ...NO_FILTERS, partnerId: 'P-DECCAN' }, DEMO_START).every((r) => r.leg.partnerId === 'P-DECCAN')).toBe(true)
    const viaHubli = legRows(data, { ...NO_FILTERS, hubId: 'HUB-HBL' }, DEMO_START)
    expect(viaHubli.length).toBeGreaterThan(0)
    expect(viaHubli.every((r) => r.shipment.destPincode.startsWith('58') || r.shipment.destPincode.startsWith('59') || r.shipment.originPincode.startsWith('58'))).toBe(true)
    expect(legRows(data, { ...NO_FILTERS, status: 'assigned' }, DEMO_START).every((r) => r.leg.status === 'assigned')).toBe(true)
    const breached = legRows(data, { ...NO_FILTERS, sla: 'breached' }, DEMO_START)
    expect(breached.length).toBeGreaterThan(0)
    expect(breached.every((r) => r.sla === 'breached')).toBe(true)
  })
})

describe('ERP-05 shipments view', () => {
  it('one row per shipment with the leg in charge', () => {
    const [row] = shipmentRows(data, { ...NO_FILTERS, q: 'LGS-DEL-000781' }, DEMO_START)
    expect(row).toMatchObject({ shipment: { id: 'LGS-DEL-000781', status: 'booked' }, current: { id: 'JOB-000781-L1' }, sla: 'onTrack' })
  })

  it('filters by customer and service', () => {
    const rows = shipmentRows(data, { ...NO_FILTERS, customerId: 'C-KAVERI', includeDone: true }, DEMO_START)
    expect(rows).toHaveLength(8)
    expect(shipmentRows(data, { ...NO_FILTERS, service: 'expressPtl' }, DEMO_START).every((r) => r.shipment.service === 'expressPtl')).toBe(true)
  })

  it('records why each leg got its partner, and the margin check, at booking', () => {
    expect(data.aiDecisions['AI-000781-L1']).toMatchObject({
      kind: 'legAssignment',
      chosenPartnerId: 'P-SWIFTCITY',
      candidates: [
        { partnerId: 'P-SWIFTCITY', eligible: true, score: 86, cost: 250 },
        { partnerId: 'P-QUICKLINK', eligible: true, score: 74, cost: 220 },
        { partnerId: 'P-METRODASH', eligible: false, reason: 'atCapacity' },
      ],
    })
    expect(data.aiDecisions['AI-000781-M'].margin).toEqual({ gross: 562.8, grossPct: 18.3, net: 501.3, netPct: 16.3, targetPct: 15, belowTarget: false })
  })
})
