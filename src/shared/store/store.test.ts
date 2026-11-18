import { buildBaseSeed, buildSeed } from '@data/seed'
import type { DemoData, Leg, Shipment, ShipmentEvent } from '@shared/types'
import { applyEvents, nextLr } from './actions'
import { STORAGE_KEY, STORE_VERSION, useDemoStore } from './store'

const NOW = '2026-11-23T10:00:00+05:30'

/** A minimal 2-leg shipment for exercising the store (real shipments arrive in Phase 1b). */
function withTestShipment(data: DemoData): DemoData {
  const id = 'LGS-DEL-000999'
  const legs: Leg[] = [1, 2].map((seq) => ({
    id: `JOB-000999-L${seq}`,
    shipmentId: id,
    seq,
    type: seq === 1 ? 'firstMile' : 'lastMile',
    partnerId: 'P-SWIFTCITY',
    status: 'offered',
    window: { from: NOW, to: NOW },
    slaDueAt: NOW,
    cost: 0,
    updatedAt: NOW,
  }))
  const shipment = { id, legIds: legs.map((l) => l.id), status: 'booked', updatedAt: NOW } as Shipment
  return {
    ...data,
    shipments: { ...data.shipments, [id]: shipment },
    legs: { ...data.legs, ...Object.fromEntries(legs.map((l) => [l.id, l])) },
  }
}

const ev = (id: string, type: ShipmentEvent['type'], at: string, legId?: string): ShipmentEvent => ({
  id,
  shipmentId: 'LGS-DEL-000999',
  legId,
  type,
  at,
  by: 'FS-RAVI',
  app: 'partnerApp',
})

describe('applyEvents', () => {
  const data = withTestShipment(buildBaseSeed())

  it('derives shipment and leg status from events', () => {
    const next = applyEvents(
      data,
      [ev('E1', 'legAssigned', '2026-11-23T10:10:00+05:30', 'JOB-000999-L1'), ev('E2', 'pickupConfirmed', '2026-11-23T14:30:00+05:30', 'JOB-000999-L1')],
      '2026-11-23T14:31:00+05:30',
    )
    expect(next.shipments['LGS-DEL-000999'].status).toBe('pickedUp')
    expect(next.shipments['LGS-DEL-000999'].updatedAt).toBe('2026-11-23T14:31:00+05:30')
    expect(next.legs['JOB-000999-L1'].status).toBe('inProgress')
    expect(next.legs['JOB-000999-L2'].status).toBe('offered')
    expect(Object.keys(next.events)).toEqual(['E1', 'E2'])
  })

  it('does not mutate its input', () => {
    applyEvents(data, [ev('E1', 'pickupConfirmed', NOW, 'JOB-000999-L1')], NOW)
    expect(data.shipments['LGS-DEL-000999'].status).toBe('booked')
    expect(data.events).toEqual({})
  })

  it('rejects events for unknown shipments or legs', () => {
    expect(() => applyEvents(data, [{ ...ev('E1', 'booked', NOW), shipmentId: 'NOPE' }], NOW)).toThrow(/unknown shipment/)
    expect(() => applyEvents(data, [ev('E1', 'pickupConfirmed', NOW, 'JOB-NOPE')], NOW)).toThrow(/unknown leg/)
  })
})

describe('nextLr', () => {
  it('gives the hero LR to the first Delhi booking', () => {
    expect(nextLr(buildSeed(), 'DEL')).toEqual({ lr: 'LGS-DEL-000781', lrSerials: { DEL: 782 } })
  })

  it('skips serials already used by seeded shipments', () => {
    const data = buildBaseSeed()
    data.lrSerials.DEL = 784
    data.shipments['LGS-DEL-000784'] = { id: 'LGS-DEL-000784' } as Shipment
    expect(nextLr(data, 'DEL').lr).toBe('LGS-DEL-000785')
  })

  it('keeps serials unique across origin codes (job ids carry only the serial)', () => {
    const data = buildBaseSeed()
    data.shipments['LGS-BLR-000900'] = { id: 'LGS-BLR-000900' } as Shipment
    expect(nextLr(data, 'MYS').lr).toBe('LGS-MYS-000901')
  })

  it('starts new origin codes at 000900, clear of the Delhi range', () => {
    expect(nextLr(buildBaseSeed(), 'BLR')).toEqual({ lr: 'LGS-BLR-000900', lrSerials: { DEL: 781, BLR: 901 } })
  })
})

describe('useDemoStore', () => {
  beforeEach(() => useDemoStore.getState().resetDemo())

  it('starts at the demo opening time', () => {
    expect(useDemoStore.getState().demoNow).toBe(NOW)
  })

  it('advances the demo clock and never goes back', () => {
    const { advanceTime } = useDemoStore.getState()
    advanceTime(60)
    expect(useDemoStore.getState().demoNow).toBe('2026-11-23T11:00:00+05:30')
    advanceTime(24 * 60)
    expect(useDemoStore.getState().demoNow).toBe('2026-11-24T11:00:00+05:30')
    advanceTime(-120)
    expect(useDemoStore.getState().demoNow).toBe('2026-11-24T11:00:00+05:30')
  })

  it('stamps changes with demoNow, not the real clock', () => {
    useDemoStore.setState((s) => ({ data: withTestShipment(s.data) }))
    useDemoStore.getState().advanceTime(90)
    useDemoStore.getState().addEvents([ev('E1', 'pickupConfirmed', '2026-11-23T11:20:00+05:30', 'JOB-000999-L1')])
    expect(useDemoStore.getState().data.shipments['LGS-DEL-000999'].updatedAt).toBe('2026-11-23T11:30:00+05:30')
  })

  it('persists to localStorage under logisco-demo-v1', () => {
    useDemoStore.getState().advanceTime(60)
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    expect(saved.version).toBe(STORE_VERSION)
    expect(saved.state.demoNow).toBe('2026-11-23T11:00:00+05:30')
  })

  it('resetDemo restores the seed, clock and flags', () => {
    const s = useDemoStore.getState()
    s.advanceTime(600)
    s.setFlag('offline', true)
    useDemoStore.setState((st) => ({ data: { ...st.data, customers: {} } }))
    useDemoStore.getState().resetDemo()
    const after = useDemoStore.getState()
    expect(after.demoNow).toBe(NOW)
    expect(after.flags.offline).toBe(false)
    expect(after.data.customers['C-SHARMA']).toBeDefined()
  })
})
