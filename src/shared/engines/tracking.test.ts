import { useDemoStore } from '@shared/store'
import { makeZip } from '@shared/sim/zip'
import { customerTimeline, matchesSearch, shipmentDocs, trackStep } from './tracking'

const HERO = 'LGS-DEL-000781'
const st = () => useDemoStore.getState()

function bookHero() {
  st().resetDemo()
  st().bookShipment({
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
    goodsDescription: 'LT switchgear panels',
    pieces: Array.from({ length: 6 }, () => ({ l: 60, b: 40, h: 40, weight: 20, skuCode: 'SG-LT-400' })),
    pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' },
  })
}

describe('customer tracking (CP-16 to CP-18)', () => {
  beforeEach(bookHero)

  it('status track steps follow source §7.1', () => {
    expect(trackStep('booked')).toBe(0)
    expect(trackStep('inTransit')).toBe(3)
    expect(trackStep('deliveredWithException')).toBe(6)
  })

  it('the timeline shows customer events with places, never partner names or job offers', () => {
    st().acceptLegs(['JOB-000781-L1'], 'PU-NEHA')
    st().assignLegs(['JOB-000781-L1'], 'FS-RAVI', 'V-DL01LT4521', 'PU-NEHA')
    const pieceIds = st().data.shipments[HERO].pieces.map((p) => p.id)
    st().confirmPickup({ legId: 'JOB-000781-L1', staffId: 'FS-RAVI', pieceIds, verified: [], photos: ['invoice'], handedOverBy: 'Ramesh Kumar', confirmation: 'otp', packagingDamaged: false, labelledBy: 'shipper' })
    const tl = customerTimeline(st().data, st().data.shipments[HERO])
    expect(tl.map((e) => e.kind)).toEqual(['pickupConfirmed', 'booked'])
    expect(tl[0]).toMatchObject({ place: 'New Delhi', pieces: 6 })
    expect(JSON.stringify(tl)).not.toMatch(/SwiftCity|Ravi|NCR CrossDock/)
  })

  it('universal search finds by LR, invoice, PO, consignee name and mobile', () => {
    const s = st().data.shipments[HERO]
    for (const q of ['000781', 'se/25-26/1187', 'HED/PO/3321', 'hubli electric', '9448012345']) expect(matchesSearch(st().data, s, q)).toBe(true)
    expect(matchesSearch(st().data, s, 'Kaveri')).toBe(false)
  })

  it('documents before pickup: LR, labels, e-way bill', () => {
    expect(shipmentDocs(st().data, st().data.shipments[HERO]).map((d) => d.key)).toEqual(['lr', 'labels', 'ewb'])
  })

  it('consignee books the slot: saved, last-mile job moves to the slot, partner and rider reminded', () => {
    st().bookAppointment(HERO, { date: '2026-11-26', from: '11:00', to: '13:00', dock: 'Dock 2', contactName: 'Mahesh Patil', contactMobile: '94480 12345' }, 'consignee')
    const { data } = st()
    expect(data.shipments[HERO].appointment).toMatchObject({ date: '2026-11-26', from: '11:00', to: '13:00', dock: 'Dock 2', confirmed: true })
    expect(data.legs['JOB-000781-L5'].window).toEqual({ from: '2026-11-26T11:00:00+05:30', to: '2026-11-26T13:00:00+05:30' })
    const reminders = Object.values(data.notifications).filter((n) => n.title === 'Appointment booked')
    expect(reminders.map((n) => n.audience.app).sort()).toEqual(['partnerApp', 'partnerPortal'])
    expect(reminders.find((n) => n.audience.app === 'partnerApp')?.audience.userId).toBe('FS-MANJU')
  })

  it('the ZIP is a real archive (PK header, one entry per document)', async () => {
    const blob = makeZip([
      { name: 'a.txt', content: 'hello' },
      { name: 'b.txt', content: 'world' },
    ])
    const bytes = new Uint8Array(await blob.arrayBuffer())
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b])
    // End of central directory: 2 entries
    expect(bytes[bytes.length - 22 + 10]).toBe(2)
  })
})
