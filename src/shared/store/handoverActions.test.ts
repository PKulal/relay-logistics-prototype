import { useDemoStore } from '@shared/store'
import { handoverState } from './handoverActions'

/** Hero booked, picked up by Ravi; NCR CrossDock (auto-accept) has Pooja on L2. */
function heroPickedUp() {
  const store = useDemoStore.getState()
  store.resetDemo()
  store.bookShipment({
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
  const s = useDemoStore.getState()
  s.acceptLegs(['JOB-000781-L1'], 'PU-NEHA')
  s.assignLegs(['JOB-000781-L1'], 'FS-RAVI', 'V-DL01LT4521', '', 'PU-NEHA')
  const pieceIds = useDemoStore.getState().data.shipments['LGS-DEL-000781'].pieces.map((p) => p.id)
  useDemoStore.getState().confirmPickup({
    legId: 'JOB-000781-L1',
    staffId: 'FS-RAVI',
    pieceIds,
    verified: [],
    photos: ['invoice'],
    handedOverBy: 'Ramesh Kumar',
    confirmation: 'otp',
    packagingDamaged: false,
    labelledBy: 'shipper',
  })
  return pieceIds
}

const give = (pieceIds: string[]) => useDemoStore.getState().giveHandover({ legId: 'JOB-000781-L1', staffId: 'FS-RAVI', pieceIds, photos: ['p'] })
const code = () => handoverState(useDemoStore.getState().data, 'JOB-000781-L1').given!.handoverCode!

describe('hand-over (PA-19 → PA-20)', () => {
  it('the hub job is waiting for Pooja; showing the code changes no status', () => {
    const pieces = heroPickedUp()
    expect(useDemoStore.getState().data.legs['JOB-000781-L2']).toMatchObject({ staffId: 'FS-POOJA', status: 'assigned' })
    give(pieces)
    const { data } = useDemoStore.getState()
    expect(code()).toMatch(/^\d{6}$/)
    expect(data.legs['JOB-000781-L1'].status).toBe('inProgress')
    expect(data.shipments['LGS-DEL-000781'].status).toBe('pickedUp')
    // a second "Show code" while waiting does nothing
    give(pieces)
    expect(Object.values(useDemoStore.getState().data.events).filter((e) => e.type === 'handoverGiven' && e.shipmentId === 'LGS-DEL-000781')).toHaveLength(1)
  })

  it('a wrong code is refused; the right code moves liability and the shipment to the origin hub', () => {
    const pieces = heroPickedUp()
    give(pieces)
    const receive = (c: string) => useDemoStore.getState().receiveHandover({ legId: 'JOB-000781-L2', staffId: 'FS-POOJA', code: c, pieceIds: pieces, brokenSeals: [], damagedPieceIds: [], photos: [] })
    receive('000000')
    expect(useDemoStore.getState().data.legs['JOB-000781-L1'].status).toBe('inProgress')
    receive(code())
    const { data } = useDemoStore.getState()
    expect(data.legs['JOB-000781-L1'].status).toBe('handedOver')
    expect(data.legs['JOB-000781-L2'].status).toBe('inProgress')
    expect(data.shipments['LGS-DEL-000781'].status).toBe('atOriginHub')
    expect(Object.values(data.exceptions).filter((x) => x.shipmentId === 'LGS-DEL-000781')).toHaveLength(0)
  })

  it('a short count accepts with an exception: goods on hold, previous leg investigates within 4 hours', () => {
    const pieces = heroPickedUp()
    give(pieces)
    useDemoStore.getState().receiveHandover({ legId: 'JOB-000781-L2', staffId: 'FS-POOJA', code: code(), pieceIds: pieces.slice(0, 5), brokenSeals: [], damagedPieceIds: [], photos: [] })
    const { data, demoNow } = useDemoStore.getState()
    expect(data.legs['JOB-000781-L1'].status).toBe('handedOver')
    expect(data.legs['JOB-000781-L2'].status).toBe('exception') // on hold at the hub
    expect(data.exceptions['EXC-000781-1']).toMatchObject({ type: 'short', legId: 'JOB-000781-L1', ownerPartnerId: data.legs['JOB-000781-L1'].partnerId, status: 'open' })
    expect(new Date(data.exceptions['EXC-000781-1'].actionDueAt).getTime() - new Date(demoNow).getTime()).toBe(4 * 3600_000)
    const ev = Object.values(data.events).find((e) => e.type === 'exceptionReported' && e.shipmentId === 'LGS-DEL-000781')!
    expect(ev.pieceIds).toEqual([pieces[5]])
  })
})
