import { tasksFor } from '@shared/engines/fieldTasks'
import { useDemoStore } from '@shared/store'
import { riderCode, type PieceCondition } from './deliveryActions'
import { handoverState } from './handoverActions'

const HERO = 'LGS-DEL-000781'
const TRIP = 'TRP-2026-0931'
const st = () => useDemoStore.getState()

/** Hero all the way to Hubli Warehousing and in-scanned there (PA-14 to PA-26). */
function heroAtHubballi() {
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
  st().startTrip({ tripId: TRIP, staffId: 'FS-BASAVARAJ', vehicleNo: 'KA25AB1234', sealNos: ['SL-44822'], photo: 'door' })
  st().advanceTime(2 * 24 * 60) // 25-Nov 10:00
  st().arriveTrip(TRIP, 'FS-BASAVARAJ')
  st().handOverAtArrival({ tripId: TRIP, staffId: 'FS-BASAVARAJ', broken: [] })
  st().receiveHandover({ legId: 'JOB-000781-L4', staffId: 'FS-HWH-SHIVA', code: st().data.trips[TRIP].handoverCode!, pieceIds, brokenSeals: [], damagedPieceIds: [], photos: [] })
  st().inScan({ hubId: 'HUB-HBL', legIds: ['JOB-000781-L4'], pieceIds, staffId: 'FS-HWH-SHIVA' })
  return pieceIds
}

const allOk = (pieces: string[]): Record<string, PieceCondition> => Object.fromEntries(pieces.map((p) => [p, { state: 'ok' as const }]))

describe('last mile: Hubli Warehousing → Manju R. → Hubli Electric Distributors', () => {
  it('Manju has a Receive task until the hub hands over; one code for her load', () => {
    const pieces = heroAtHubballi()
    expect(tasksFor(st().data, 'FS-MANJU', st().demoNow).find((t) => t.leg.id === 'JOB-000781-L5')?.kind).toBe('receive')
    st().giveToRider({ hubId: 'HUB-HBL', legIds: ['JOB-000781-L4'], staffId: 'FS-HWH-SHIVA', photos: ['p'] })
    const code = riderCode(st().data, 'FS-MANJU')!
    expect(code).toMatch(/^\d{6}$/)
    st().receiveLoad({ legIds: ['JOB-000781-L5'], staffId: 'FS-MANJU', code, pieceIds: pieces })
    expect(st().data.legs['JOB-000781-L4'].status).toBe('handedOver')
    expect(st().data.legs['JOB-000781-L5'].status).toBe('assigned')
    expect(riderCode(st().data, 'FS-MANJU')).toBeUndefined()
  })

  it('start run → Out for Delivery; complete with OTP and GRN → Delivered, e-POD to the shipper', () => {
    const pieces = heroAtHubballi()
    st().giveToRider({ hubId: 'HUB-HBL', legIds: ['JOB-000781-L4'], staffId: 'FS-HWH-SHIVA', photos: ['p'] })
    st().receiveLoad({ legIds: ['JOB-000781-L5'], staffId: 'FS-MANJU', code: riderCode(st().data, 'FS-MANJU')!, pieceIds: pieces })
    st().startRun(['JOB-000781-L5'], 'FS-MANJU')
    expect(st().data.shipments[HERO].status).toBe('outForDelivery')
    st().completeDelivery({ legId: 'JOB-000781-L5', staffId: 'FS-MANJU', pieces: allOk(pieces), receivedBy: 'Mahesh Patil', verification: 'otp', grn: 'GRN-HED-55120', photo: 'pod' })
    const { data } = st()
    expect(data.shipments[HERO].status).toBe('delivered')
    expect(data.legs['JOB-000781-L5'].status).toBe('delivered')
    const pod = Object.values(data.events).find((e) => e.shipmentId === HERO && e.type === 'delivered')!
    expect(pod).toMatchObject({ receivedBy: 'Mahesh Patil', grn: 'GRN-HED-55120', note: 'OTP verified' })
    expect(pod.pieceIds).toHaveLength(6)
    expect(Object.values(data.notifications).find((n) => n.title === `${HERO}: delivered`)?.body).toBe('e-POD: received by Mahesh Patil · GRN-HED-55120')
  })

  it('a damaged piece → Delivered with Exception, with an exception on the delivery partner', () => {
    const pieces = heroAtHubballi()
    st().giveToRider({ hubId: 'HUB-HBL', legIds: ['JOB-000781-L4'], staffId: 'FS-HWH-SHIVA', photos: ['p'] })
    st().receiveLoad({ legIds: ['JOB-000781-L5'], staffId: 'FS-MANJU', code: riderCode(st().data, 'FS-MANJU')!, pieceIds: pieces })
    st().startRun(['JOB-000781-L5'], 'FS-MANJU')
    st().completeDelivery({ legId: 'JOB-000781-L5', staffId: 'FS-MANJU', pieces: { ...allOk(pieces), [pieces[2]]: { state: 'damaged', photo: 'dmg', remark: 'Corner crushed' } }, receivedBy: 'Mahesh Patil', verification: 'signature', photo: 'pod' })
    const { data } = st()
    expect(data.shipments[HERO].status).toBe('deliveredWithException')
    expect(Object.values(data.exceptions).find((x) => x.shipmentId === HERO && x.type === 'damage')).toMatchObject({ legId: 'JOB-000781-L5', ownerPartnerId: 'P-NKEXP' })
  })
})
