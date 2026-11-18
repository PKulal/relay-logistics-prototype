import type { EventType, LegType, ShipmentEvent } from '@shared/types'
import { deriveStatus } from './status'

/** Hero shipment legs (seed-data.md §3): 5 legs. */
const TYPES: LegType[] = ['firstMile', 'originHub', 'lineHaul', 'destHub', 'lastMile']
const legs = TYPES.map((type, i) => ({ id: `JOB-000781-L${i + 1}`, seq: i + 1, type }))
const L = (n: number) => `JOB-000781-L${n}`

let clock = 0
function ev(type: EventType, legN?: number, extra: Partial<ShipmentEvent> = {}): ShipmentEvent {
  clock += 1
  const at = new Date(Date.parse('2026-11-23T10:05:00+05:30') + clock * 60_000).toISOString()
  return {
    id: `EV-${clock}`,
    shipmentId: 'LGS-DEL-000781',
    legId: legN ? L(legN) : undefined,
    type,
    at,
    by: 'test',
    app: 'partnerApp',
    ...extra,
  }
}

/** The happy path up to (and including) each step, per Partner App spec §8. */
function journey() {
  return {
    booked: [ev('booked'), ...[1, 2, 3, 4, 5].map((n) => ev('legOffered', n))],
    accepted: [ev('legAccepted', 1), ev('legAssigned', 1)],
    pickup: [ev('pickupConfirmed', 1)],
    originHub: [ev('handoverGiven', 1), ev('handoverReceived', 2)],
    sealed: [ev('bagSealed', 2)],
    toTruck: [ev('handoverReceived', 3)],
    trip: [ev('tripStarted', 3)],
    destHub: [ev('tripArrived', 3), ev('handoverReceived', 4)],
    toRider: [ev('handoverReceived', 5)],
    run: [ev('runStarted', 5)],
    delivered: [ev('delivered', 5, { receivedBy: 'Mahesh Patil', grn: 'GRN-HED-55120' })],
  }
}

function upTo(step: keyof ReturnType<typeof journey>) {
  const j = journey()
  const out: ShipmentEvent[] = []
  for (const [k, list] of Object.entries(j)) {
    out.push(...list)
    if (k === step) break
  }
  return out
}

describe('status engine — hero shipment happy path', () => {
  it('starts Booked with every leg Offered', () => {
    const r = deriveStatus({ legs, events: upTo('booked') })
    expect(r.shipmentStatus).toBe('booked')
    expect(Object.values(r.legStatuses)).toEqual(Array(5).fill('offered'))
  })

  it('accept and assign move only the leg', () => {
    const r = deriveStatus({ legs, events: upTo('accepted') })
    expect(r.shipmentStatus).toBe('booked')
    expect(r.legStatuses[L(1)]).toBe('assigned')
  })

  it('pickup confirmed → leg 1 In progress, shipment Picked Up', () => {
    const r = deriveStatus({ legs, events: upTo('pickup') })
    expect(r.shipmentStatus).toBe('pickedUp')
    expect(r.legStatuses[L(1)]).toBe('inProgress')
  })

  it('hand-over received at origin hub → leg 1 Handed over, leg 2 In progress, At Origin Hub', () => {
    const r = deriveStatus({ legs, events: upTo('originHub') })
    expect(r.shipmentStatus).toBe('atOriginHub')
    expect(r.legStatuses[L(1)]).toBe('handedOver')
    expect(r.legStatuses[L(2)]).toBe('inProgress')
  })

  it('bag sealed keeps At Origin Hub; loading on the truck hands leg 2 over', () => {
    expect(deriveStatus({ legs, events: upTo('sealed') }).shipmentStatus).toBe('atOriginHub')
    const r = deriveStatus({ legs, events: upTo('toTruck') })
    expect(r.shipmentStatus).toBe('atOriginHub')
    expect(r.legStatuses[L(2)]).toBe('handedOver')
  })

  it('trip started → leg 3 In progress, In Transit', () => {
    const r = deriveStatus({ legs, events: upTo('trip') })
    expect(r.shipmentStatus).toBe('inTransit')
    expect(r.legStatuses[L(3)]).toBe('inProgress')
  })

  it('arrival and hand-over at destination hub → leg 3 Handed over, leg 4 In progress', () => {
    const r = deriveStatus({ legs, events: upTo('destHub') })
    expect(r.shipmentStatus).toBe('atDestinationHub')
    expect(r.legStatuses[L(3)]).toBe('handedOver')
    expect(r.legStatuses[L(4)]).toBe('inProgress')
  })

  it('run started → Out for Delivery; delivered → Delivered', () => {
    expect(deriveStatus({ legs, events: upTo('toRider') }).shipmentStatus).toBe('atDestinationHub')
    expect(deriveStatus({ legs, events: upTo('run') }).shipmentStatus).toBe('outForDelivery')
    const r = deriveStatus({ legs, events: upTo('delivered') })
    expect(r.shipmentStatus).toBe('delivered')
    expect(r.legStatuses[L(5)]).toBe('delivered')
    expect(r.legStatuses[L(4)]).toBe('handedOver')
  })

  it('replays events by time, not by array order', () => {
    const events = upTo('trip').reverse()
    expect(deriveStatus({ legs, events }).shipmentStatus).toBe('inTransit')
  })
})

describe('status engine — exceptions', () => {
  it('pickup failed → leg Exception, shipment back to Booked', () => {
    const r = deriveStatus({ legs, events: [...upTo('accepted'), ev('pickupFailed', 1, { reason: 'Shop closed' })] })
    expect(r.shipmentStatus).toBe('booked')
    expect(r.legStatuses[L(1)]).toBe('exception')
  })

  it('halt that puts ETA at risk → leg Exception, shipment stays In Transit', () => {
    const r = deriveStatus({ legs, events: [...upTo('trip'), ev('haltReported', 3, { etaAtRisk: true })] })
    expect(r.shipmentStatus).toBe('inTransit')
    expect(r.legStatuses[L(3)]).toBe('exception')
  })

  it('short halt without ETA risk changes nothing', () => {
    const r = deriveStatus({ legs, events: [...upTo('trip'), ev('haltReported', 3, { etaAtRisk: false })] })
    expect(r.legStatuses[L(3)]).toBe('inProgress')
  })

  it('failed delivery → Undelivered (NDR); reattempt run → Out for Delivery again', () => {
    const failed = [...upTo('run'), ev('deliveryFailed', 5, { reason: 'Premises closed' })]
    const r1 = deriveStatus({ legs, events: failed })
    expect(r1.shipmentStatus).toBe('undelivered')
    expect(r1.legStatuses[L(5)]).toBe('failedAttempt')

    const r2 = deriveStatus({ legs, events: [...failed, ev('reattemptScheduled', 5)] })
    expect(r2.shipmentStatus).toBe('undelivered')
    expect(r2.legStatuses[L(5)]).toBe('assigned')

    const r3 = deriveStatus({ legs, events: [...failed, ev('reattemptScheduled', 5), ev('runStarted', 5)] })
    expect(r3.shipmentStatus).toBe('outForDelivery')
  })

  it('a shortage found on the way → Delivered with Exception', () => {
    const events = [...upTo('sealed'), ev('exceptionReported', 2, { exceptionKind: 'short' })]
    const rest = journey()
    events.push(...rest.toTruck, ...rest.trip, ...rest.destHub, ...rest.toRider, ...rest.run, ...rest.delivered)
    expect(deriveStatus({ legs, events }).shipmentStatus).toBe('deliveredWithException')
  })

  it('a seal mismatch alone leaves status unchanged and marks the leg', () => {
    const r = deriveStatus({ legs, events: [...upTo('destHub'), ev('exceptionReported', 4, { exceptionKind: 'sealMismatch' })] })
    expect(r.shipmentStatus).toBe('atDestinationHub')
    expect(r.legStatuses[L(4)]).toBe('exception')
  })

  it('RTO → Return to Origin', () => {
    const r = deriveStatus({ legs, events: [...upTo('run'), ev('deliveryFailed', 5), ev('rtoInitiated', 5)] })
    expect(r.shipmentStatus).toBe('returnToOrigin')
  })
})

describe('status engine — cancellation', () => {
  it('cancel while Booked → Cancelled, every leg Withdrawn', () => {
    const r = deriveStatus({ legs, events: [...upTo('accepted'), ev('cancelled')] })
    expect(r.shipmentStatus).toBe('cancelled')
    expect(Object.values(r.legStatuses)).toEqual(Array(5).fill('withdrawn'))
  })

  it('cancel after pickup is ignored and reported', () => {
    const before = upTo('pickup')
    const cancel = ev('cancelled')
    const r = deriveStatus({ legs, events: [...before, cancel] })
    expect(r.shipmentStatus).toBe('pickedUp')
    expect(r.ignoredEventIds).toEqual([cancel.id])
  })

  it('movement events after delivery are ignored, but legs can still be closed', () => {
    const before = upTo('delivered')
    const late = ev('runStarted', 5)
    const r = deriveStatus({ legs, events: [...before, late, ev('legClosed', 1)] })
    expect(r.shipmentStatus).toBe('delivered')
    expect(r.ignoredEventIds).toEqual([late.id])
    expect(r.legStatuses[L(1)]).toBe('closed')
  })
})
