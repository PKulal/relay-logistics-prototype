import { currentTrip, etaAtRisk, loadedLegs, tripEta, tripProgress } from '@shared/engines/trip'
import { shipmentPosition } from '@shared/engines/position'
import { useDemoStore } from '@shared/store'
import { handoverState } from './handoverActions'

const HERO = 'LGS-DEL-000781'
const TRIP = 'TRP-2026-0931'
const st = () => useDemoStore.getState()

/** Hero booked → picked up → NCR CrossDock → sealed on MAN-GGN-1123 → Basavaraj took the load (PA-14 to PA-29). */
function heroLoadedOnTruck() {
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
    invoice: { no: 'SE/25-26/1187', date: '2026-11-23', value: 180000 },
    hsn: '8537',
    goodsDescription: 'LT switchgear panels',
    pieces: Array.from({ length: 6 }, () => ({ l: 60, b: 40, h: 40, weight: 20, skuCode: 'SG-LT-400' })),
    pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' },
  })
  st().acceptLegs(['JOB-000781-L1'], 'PU-NEHA')
  st().assignLegs(['JOB-000781-L1'], 'FS-RAVI', 'V-DL01LT4521', 'PU-NEHA')
  const pieceIds = st().data.shipments[HERO].pieces.map((p) => p.id)
  st().confirmPickup({ legId: 'JOB-000781-L1', staffId: 'FS-RAVI', pieceIds, verified: [], photos: ['invoice'], handedOverBy: 'Ramesh Kumar', confirmation: 'otp', packagingDamaged: false, labelledBy: 'shipper' })
  st().giveHandover({ legId: 'JOB-000781-L1', staffId: 'FS-RAVI', pieceIds, photos: ['p'] })
  st().receiveHandover({ legId: 'JOB-000781-L2', staffId: 'FS-POOJA', code: handoverState(st().data, 'JOB-000781-L1').given!.handoverCode!, pieceIds, brokenSeals: [], damagedPieceIds: [], photos: [] })
  st().inScan({ hubId: 'HUB-GGN', legIds: ['JOB-000781-L2'], pieceIds, staffId: 'FS-POOJA' })
  for (const p of pieceIds) st().sortPiece('HUB-GGN', p)
  st().sealBag({ bagId: 'BAG-GGN-07', sealNo: 'SL-44817', photo: 'bag', manifestId: 'MAN-GGN-1123', staffId: 'FS-POOJA' })
  st().dispatchManifest({ manifestId: 'MAN-GGN-1123', vehicleNo: 'KA25AB1234', doorSeal: 'SL-44822', photo: 'door', staffId: 'FS-POOJA' })
  st().receiveManifest({ manifestId: 'MAN-GGN-1123', staffId: 'FS-BASAVARAJ', code: st().data.manifests['MAN-GGN-1123'].handoverCode!, bagIds: ['BAG-GGN-07'], brokenSeals: [], photos: [] })
  return pieceIds
}

const start = (vehicleNo = 'KA25AB1234', sealNos = ['SL-44822']) => st().startTrip({ tripId: TRIP, staffId: 'FS-BASAVARAJ', vehicleNo, sealNos, photo: 'door' })

describe('driver trip TRP-2026-0931 (PA-21 to PA-24)', () => {
  beforeEach(heroLoadedOnTruck)

  it('Basavaraj’s current trip carries the hero', () => {
    const trip = currentTrip(st().data, 'FS-BASAVARAJ')!
    expect(trip.id).toBe(TRIP)
    expect(loadedLegs(st().data, trip).map((l) => l.id)).toEqual(['JOB-000781-L3'])
  })

  it('start is blocked by a different truck or seals that do not match the manifest', () => {
    start('KA25AB9999')
    expect(st().data.trips[TRIP].status).toBe('loading')
    start('KA25AB1234', ['SL-44823'])
    expect(st().data.shipments[HERO].status).toBe('atOriginHub')
  })

  it('start → In Transit, Part B updated; the truck moves with the clock', () => {
    start()
    const { data } = st()
    expect(data.trips[TRIP]).toMatchObject({ status: 'inTransit', startedAt: st().demoNow })
    expect(data.shipments[HERO].status).toBe('inTransit')
    expect(data.legs['JOB-000781-L3'].status).toBe('inProgress')
    expect(data.shipments[HERO].ewb?.partBUpdated).toBe(true)
    expect(tripProgress(data.trips[TRIP], st().demoNow)).toBe(0)
    st().advanceTime(10 * 60)
    const p = tripProgress(st().data.trips[TRIP], st().demoNow)
    // 10 h of 46.75 h driving (85% of the 55 h window)
    expect(p).toBeCloseTo(10 / 46.75, 3)
    // The ERP map shows the same truck position
    const pos = shipmentPosition(st().data, st().data.shipments[HERO], st().demoNow)
    expect(pos.lat).toBeLessThan(28)
  })

  it('a 3-hour halt stops the truck and moves the ETA by 3 hours (still within the SLA)', () => {
    start()
    const before = tripEta(st().data.trips[TRIP])
    st().reportHalt({ tripId: TRIP, staffId: 'FS-BASAVARAJ', reason: 'Traffic', minutes: 180 })
    const trip = st().data.trips[TRIP]
    expect(Date.parse(tripEta(trip)) - Date.parse(before)).toBe(3 * 3600_000)
    expect(etaAtRisk(trip)).toBe(false)
    st().advanceTime(120)
    expect(tripProgress(st().data.trips[TRIP], st().demoNow)).toBe(0) // still halted
    expect(Object.values(st().data.events).find((e) => e.type === 'haltReported' && e.shipmentId === HERO)).toMatchObject({ etaAtRisk: false, note: 'Traffic · 180 min' })
  })

  it('a long breakdown makes the trip late: exception on Deccan, new delivery date to the customer', () => {
    start()
    const eta0 = st().data.shipments[HERO].eta
    st().reportHalt({ tripId: TRIP, staffId: 'FS-BASAVARAJ', reason: 'breakdown', minutes: 30 * 60, breakdown: { issue: 'Engine', backupVehicle: true, photos: ['bd'] } })
    const { data } = st()
    expect(etaAtRisk(data.trips[TRIP])).toBe(true)
    expect(data.legs['JOB-000781-L3'].status).toBe('exception')
    expect(Object.values(data.exceptions).find((x) => x.shipmentId === HERO && x.type === 'breakdown')).toMatchObject({ ownerPartnerId: 'P-DECCAN', status: 'open' })
    expect(data.shipments[HERO].eta > eta0).toBe(true)
    expect(Object.values(data.notifications).find((n) => n.audience.app === 'customer' && n.title === `${HERO}: delay`)).toBeDefined()
    expect(data.shipments[HERO].status).toBe('inTransit')
  })

  it('arrive → seal check → hand over; Hubballi hub accepts → At Destination Hub', () => {
    start()
    st().advanceTime(2 * 24 * 60)
    expect(tripProgress(st().data.trips[TRIP], st().demoNow)).toBe(1)
    st().arriveTrip(TRIP, 'FS-BASAVARAJ')
    expect(st().data.trips[TRIP].status).toBe('arrived')
    st().handOverAtArrival({ tripId: TRIP, staffId: 'FS-BASAVARAJ', broken: [] })
    const code = st().data.trips[TRIP].handoverCode!
    const given = handoverState(st().data, 'JOB-000781-L3').given!
    expect(given).toMatchObject({ handoverCode: code, sealNos: ['SL-44822'], vehicleNo: 'KA25AB1234', counterpartStaffId: 'FS-HWH-SHIVA' })
    expect(given.pieceIds).toHaveLength(6)
    st().receiveHandover({ legId: 'JOB-000781-L4', staffId: 'FS-HWH-SHIVA', code, pieceIds: given.pieceIds!, brokenSeals: [], damagedPieceIds: [], photos: [] })
    expect(st().data.legs['JOB-000781-L3'].status).toBe('handedOver')
    expect(st().data.shipments[HERO].status).toBe('atDestinationHub')
    expect(currentTrip(st().data, 'FS-BASAVARAJ')?.id).not.toBe(TRIP)
  })

  it('a broken door seal is recorded before unloading, against the truck partner', () => {
    start()
    st().advanceTime(2 * 24 * 60)
    st().arriveTrip(TRIP, 'FS-BASAVARAJ')
    st().handOverAtArrival({ tripId: TRIP, staffId: 'FS-BASAVARAJ', broken: [{ seal: 'SL-44822', photo: 'seal' }] })
    expect(Object.values(st().data.exceptions).find((x) => x.shipmentId === HERO && x.type === 'sealMismatch')).toMatchObject({ legId: 'JOB-000781-L3', ownerPartnerId: 'P-DECCAN' })
  })
})
