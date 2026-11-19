import { hubItems, hubTiles, piecesToSort } from '@shared/engines/hub'
import { useDemoStore } from '@shared/store'
import { handoverState } from './handoverActions'

const HERO = 'LGS-DEL-000781'
const st = () => useDemoStore.getState()

/** Hero booked, picked up by Ravi and received by Pooja at NCR CrossDock (PA-20). */
function heroAtHub() {
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
  const code = handoverState(st().data, 'JOB-000781-L1').given!.handoverCode!
  st().receiveHandover({ legId: 'JOB-000781-L2', staffId: 'FS-POOJA', code, pieceIds, brokenSeals: [], damagedPieceIds: [], photos: [] })
  return pieceIds
}

const heroItem = () => hubItems(st().data, 'HUB-GGN', st().demoNow).find((i) => i.shipment.id === HERO)!

describe('hub day at NCR CrossDock (PA-25 to PA-29)', () => {
  it('seed: tonight’s Hubballi trip carries the hero’s line-haul once booked', () => {
    heroAtHub()
    const { data } = st()
    expect(data.legs['JOB-000781-L3'].tripId).toBe('TRP-2026-0931')
    expect(data.trips['TRP-2026-0931'].legIds).toEqual(expect.arrayContaining(['JOB-000781-L3', 'JOB-000790-L3', 'JOB-000716-L3']))
    expect(data.manifests['MAN-GGN-1123']).toMatchObject({ status: 'open', tripId: 'TRP-2026-0931', destination: 'HUB-HBL' })
  })

  it('received → in-scan → sort to BAG 07 → seal SL-44817 on MAN-GGN-1123 → out-scan → Basavaraj accepts', () => {
    const pieces = heroAtHub()
    expect(heroItem().stage).toBe('toInScan')
    expect(hubTiles(st().data, 'HUB-GGN', hubItems(st().data, 'HUB-GGN', st().demoNow)).toInScan).toBe(6)

    st().inScan({ hubId: 'HUB-GGN', legIds: ['JOB-000781-L2'], pieceIds: pieces, staffId: 'FS-POOJA' })
    expect(heroItem().stage).toBe('toSort')
    expect(st().data.shipments[HERO].status).toBe('atOriginHub')
    expect(heroItem().dest).toMatchObject({ key: 'HUB-HBL', name: 'HUBBALLI', tone: 'info' })

    for (const p of pieces) expect(st().sortPiece('HUB-GGN', p)).toBe('BAG-GGN-07')
    expect(heroItem().stage).toBe('sorted')
    expect(piecesToSort(hubItems(st().data, 'HUB-GGN', st().demoNow), st().data, 'HUB-GGN').some((x) => x.item.shipment.id === HERO)).toBe(false)

    st().sealBag({ bagId: 'BAG-GGN-07', sealNo: 'SL-44817', weightKg: 172, photo: 'bag', manifestId: 'MAN-GGN-1123', staffId: 'FS-POOJA' })
    expect(st().data.bags['BAG-GGN-07']).toMatchObject({ status: 'sealed', sealNo: 'SL-44817', manifestId: 'MAN-GGN-1123' })
    expect(st().data.manifests['MAN-GGN-1123'].bagIds).toEqual(['BAG-GGN-07'])
    expect(heroItem().stage).toBe('sealed')

    st().dispatchManifest({ manifestId: 'MAN-GGN-1123', vehicleNo: 'KA25AB1234', doorSeal: 'SL-44822', photo: 'door', staffId: 'FS-POOJA' })
    const { data } = st()
    expect(data.manifests['MAN-GGN-1123']).toMatchObject({ status: 'dispatched', doorSeal: 'SL-44822' })
    expect(data.trips['TRP-2026-0931'].status).toBe('loading')
    const given = handoverState(data, 'JOB-000781-L2').given!
    expect(given).toMatchObject({ sealNos: ['SL-44817', 'SL-44822'], vehicleNo: 'KA25AB1234', counterpartStaffId: 'FS-BASAVARAJ' })
    expect(given.handoverCode).toBe(data.manifests['MAN-GGN-1123'].handoverCode)

    st().receiveManifest({ manifestId: 'MAN-GGN-1123', staffId: 'FS-BASAVARAJ', code: '000000', bagIds: ['BAG-GGN-07'], brokenSeals: [], photos: [] })
    expect(st().data.legs['JOB-000781-L2'].status).toBe('inProgress') // wrong code
    st().receiveManifest({ manifestId: 'MAN-GGN-1123', staffId: 'FS-BASAVARAJ', code: given.handoverCode!, bagIds: ['BAG-GGN-07'], brokenSeals: [], photos: [] })
    expect(st().data.legs['JOB-000781-L2'].status).toBe('handedOver')
    expect(st().data.shipments[HERO].status).toBe('atOriginHub') // until the trip starts (PA-22)
  })

  it('finish inbound with a piece missing: short exception for the hub to investigate', () => {
    const pieces = heroAtHub()
    st().inScan({ hubId: 'HUB-GGN', legIds: ['JOB-000781-L2'], pieceIds: pieces.slice(0, 5), staffId: 'FS-POOJA', shortReason: 'Not in the load' })
    const { data } = st()
    expect(data.exceptions['EXC-000781-1']).toMatchObject({ type: 'short', legId: 'JOB-000781-L2', ownerPartnerId: 'P-NCRXD', rootCause: 'Not in the load' })
    expect(heroItem().pieceIds).toHaveLength(5)
  })

  it('a piece sorted for a destination with no open bag opens the next bag', () => {
    const pieces = heroAtHub()
    st().inScan({ hubId: 'HUB-GGN', legIds: ['JOB-000781-L2'], pieceIds: pieces, staffId: 'FS-POOJA' })
    st().sortPiece('HUB-GGN', pieces[0])
    st().sealBag({ bagId: 'BAG-GGN-07', sealNo: 'SL-44817', photo: 'bag', manifestId: 'MAN-GGN-1123', staffId: 'FS-POOJA' })
    expect(st().sortPiece('HUB-GGN', pieces[1])).toBe('BAG-GGN-08')
  })

  it('expected inbound is only what is on its way: not a shipment whose pickup failed days ago', () => {
    st().resetDemo()
    const expected = hubItems(st().data, 'HUB-GGN', st().demoNow).filter((i) => i.stage === 'expected')
    expect(expected.map((i) => i.shipment.id)).not.toContain('LGS-HBL-000647')
    expect(expected.map((i) => i.shipment.id)).toEqual(expect.arrayContaining(['LGS-DEL-000716', 'LGS-DEL-000790']))
    expect(expected.every((i) => i.from.status === 'inProgress' || i.from.type === 'firstMile')).toBe(true)
  })

  it('touching a background shipment ends its simulated journey', () => {
    st().resetDemo()
    st().advanceTime(10 * 60) // 20:00: Ravi's 12:00 pickups have reached the hub
    const item = hubItems(st().data, 'HUB-GGN', st().demoNow).find((i) => i.shipment.id === 'LGS-DEL-000716')!
    expect(item.stage).toBe('toSort')
    expect(st().data.shipments['LGS-DEL-000716'].sim).toBeDefined()
    st().sortPiece('HUB-GGN', item.pieceIds[0])
    expect(st().data.shipments['LGS-DEL-000716'].sim).toBeUndefined()
  })
})
