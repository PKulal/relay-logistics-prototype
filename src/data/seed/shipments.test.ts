/**
 * Shipment seed: the key shipments behave as seed-data.md §4 describes, and the
 * ~120 background shipments are consistent, varied and identical on every reset.
 */
import { deriveStatus } from '@shared/engines/status'
import { computeMargin } from '@shared/engines/margin'
import { priceLine } from '@shared/engines/pricing'
import { bookShipment } from '@shared/store/booking'
import { SHIPMENT_STATUSES } from '@shared/types'
import { buildBaseSeed, buildSeed, DEMO_START, HERO_LR } from './index'

const seed = buildSeed()
const shipments = Object.values(seed.shipments)
const eventsOf = (id: string) => Object.values(seed.events).filter((e) => e.shipmentId === id)

describe('key shipments (seed-data.md §4)', () => {
  it('LGS-DEL-000769: delivered with exception, piece 4 missing at origin hub, claim settled', () => {
    const s = seed.shipments['LGS-DEL-000769']
    expect(s.status).toBe('deliveredWithException')
    expect(s.pieces[3]).toMatchObject({ id: 'LGS-DEL-000769-04', condition: 'missing' })
    const sealed = eventsOf(s.id).find((e) => e.type === 'bagSealed')!
    expect(sealed.pieceIds).toHaveLength(5)
    expect(seed.claims['CLM-2026-0142']).toMatchObject({
      status: 'settled',
      amountApproved: 30000,
      liableLegId: 'JOB-000769-L2',
      liablePartnerId: 'P-NCRXD',
      recovery: { partner: 10000, insurer: 20000, insurerRef: 'INS-88213' },
      creditNoteId: 'CN-2026-0088',
    })
    expect(seed.creditNotes['CN-2026-0088'].amount).toBe(30000)
    expect(seed.legs['JOB-000769-L2'].partnerId).toBe('P-NCRXD')
  })

  it('LGS-DEL-000776: failed delivery (premises closed) by Manju, awaiting the customer', () => {
    const s = seed.shipments['LGS-DEL-000776']
    expect(s.status).toBe('undelivered')
    expect(seed.legs['JOB-000776-L5']).toMatchObject({ partnerId: 'P-NKEXP', staffId: 'FS-MANJU', status: 'failedAttempt' })
    expect(seed.ndrs['NDR-000776-1']).toMatchObject({ reason: 'premisesClosed', attempt: 1 })
    expect(seed.ndrs['NDR-000776-1'].customerChoice).toBeUndefined()
  })

  it('LGS-DEL-000784: open weight revision, still moving', () => {
    const s = seed.shipments['LGS-DEL-000784']
    expect(s.status).toBe('inTransit')
    const wr = seed.weightRevisions['WR-000784']
    expect(wr.status).toBe('pending')
    expect(wr.verified).toBeGreaterThan(wr.booked)
    expect(wr.amountDiff).toBeGreaterThan(0)
    expect(s.weights.verifiedChargeable).toBe(wr.verified)
    expect(eventsOf(s.id).some((e) => e.type === 'weightRevised')).toBe(true)
  })

  it('LGS-DEL-000790: booked this morning, pickup assigned to Ravi, who has 7 pickups pending', () => {
    const s = seed.shipments['LGS-DEL-000790']
    expect(s.status).toBe('booked')
    expect(seed.legs['JOB-000790-L1']).toMatchObject({ partnerId: 'P-SWIFTCITY', staffId: 'FS-RAVI', status: 'assigned' })
    const raviPending = Object.values(seed.legs).filter((l) => l.staffId === 'FS-RAVI' && l.type === 'firstMile' && l.status === 'assigned' && l.window.from.startsWith('2026-11-23'))
    expect(raviPending).toHaveLength(7)
  })

  it('LGS-MYS-000112: Kaveri parcel 7.5 kg, ₹561.09 paid from the wallet, which is now ₹8,450', () => {
    const s = seed.shipments['LGS-MYS-000112']
    expect(s.weights.chargeable).toBe(7.5)
    expect(s.price.total).toBe(561.09)
    expect(s.status).toBe('inTransit')
    expect(seed.customers['C-KAVERI'].walletBalance).toBe(8450)
    expect(seed.walletTxns['WT-LGS-MYS-000112']).toMatchObject({ amount: -561.09, balanceAfter: 8450 })
  })

  it('keeps Sharma Electricals’ documented credit position', () => {
    expect(seed.customers['C-SHARMA'].creditUsed).toBe(344200)
  })
})

describe('the hero shipment can be booked live', () => {
  it('the first Delhi booking becomes LGS-DEL-000781 with the documented legs, price and margin', () => {
    expect(seed.shipments[HERO_LR]).toBeUndefined()
    const { data, shipmentId } = bookShipment(
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
        invoice: { no: 'SE/25-26/1187', date: '2026-11-23', value: 180000, po: 'HED/PO/3321' },
        hsn: '8537',
        goodsDescription: 'LT switchgear panel 400A',
        pieces: Array.from({ length: 6 }, () => ({ l: 60, b: 40, h: 40, weight: 20, skuCode: 'SG-LT-400' })),
        pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' },
      },
      '2026-11-23T10:05:00+05:30',
    )
    expect(shipmentId).toBe(HERO_LR)
    const s = data.shipments[HERO_LR]
    const legs = s.legIds.map((id) => data.legs[id])
    expect(s).toMatchObject({ status: 'booked', eta: '2026-11-26', weights: { actual: 120, volumetricOrCft: 162, chargeable: 162 } })
    expect(s.price.total).toBe(3628.26)
    expect(s.ewb).toEqual({ no: '3410 2256 7781', validTill: '2026-12-03', partBUpdated: false, source: 'auto' })
    // Appointment requested at booking; the consignee confirms 11:00–13:00 on CP-18
    expect(s.appointment).toEqual({ date: '2026-11-26', confirmed: false })
    expect(legs.map((l) => [l.id, l.partnerId, l.cost])).toEqual([
      ['JOB-000781-L1', 'P-SWIFTCITY', 250],
      ['JOB-000781-L2', 'P-NCRXD', 162],
      ['JOB-000781-L3', 'P-DECCAN', 1458],
      ['JOB-000781-L4', 'P-HUBLIWH', 162],
      ['JOB-000781-L5', 'P-NKEXP', 300],
    ])
    const m = computeMargin({ subtotal: s.price.subtotal, legCosts: legs.map((l) => l.cost), insurance: priceLine(s.price, 'fov'), riskBufferPct: 2, targetMarginPct: 15 })
    expect([m.gross, m.grossPct, m.net, m.netPct]).toEqual([562.8, 18.3, 501.3, 16.3])
    // Credit (TBB): the booking uses Sharma's credit line
    expect(data.customers['C-SHARMA'].creditUsed).toBe(344200 + 3628.26)
    expect(data.lrSerials.DEL).toBe(782)
  })
})

describe('background shipments', () => {
  it('has the key shipments plus ~120 generated ones', () => {
    expect(shipments.length).toBe(125)
  })

  it('gives Sharma ~40 and Kaveri ~8 shipments (CP spec §11.2)', () => {
    const count = (c: string) => shipments.filter((s) => s.customerId === c).length
    expect(count('C-SHARMA')).toBe(40)
    expect(count('C-KAVERI')).toBe(8)
  })

  it('covers every customer-facing status', () => {
    const seen = new Set(shipments.map((s) => s.status))
    expect(SHIPMENT_STATUSES.filter((st) => !seen.has(st))).toEqual([])
  })

  it('uses all 8 lanes', () => {
    expect(new Set(shipments.map((s) => s.laneId).filter(Boolean)).size).toBe(8)
  })

  it('stores statuses that match a fresh replay of the events, with no rejected events', () => {
    for (const s of shipments) {
      const r = deriveStatus({ legs: s.legIds.map((id) => seed.legs[id]), events: eventsOf(s.id) })
      expect(r.shipmentStatus, s.id).toBe(s.status)
      expect(r.ignoredEventIds, s.id).toEqual([])
      for (const id of s.legIds) expect(seed.legs[id].status, id).toBe(r.legStatuses[id])
    }
  })

  it('has no events after the demo opens', () => {
    expect(Object.values(seed.events).filter((e) => Date.parse(e.at) > Date.parse(DEMO_START))).toEqual([])
  })

  it('never takes the hero LR or the key shipments’ serials', () => {
    const generatedDel = shipments.filter((s) => s.id.startsWith('LGS-DEL-') && Number(s.id.slice(-6)) < 769)
    expect(generatedDel.length).toBeGreaterThan(30)
    expect(seed.lrSerials.DEL).toBe(781)
  })

  it('assigns only partners that serve the leg', () => {
    for (const leg of Object.values(seed.legs)) {
      expect(seed.partners[leg.partnerId].legs, leg.id).toContain(leg.type)
    }
  })

  it('is identical on every build', () => {
    expect(buildSeed()).toEqual(seed)
  })

  it('base seed has no shipments', () => {
    expect(Object.keys(buildBaseSeed().shipments)).toHaveLength(0)
  })
})
