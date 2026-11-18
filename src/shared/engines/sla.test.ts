import { buildSeed, DEMO_START } from '@data/seed'
import { addHours } from '@shared/lib/time'
import type { Leg } from '@shared/types'
import { routeStops, shipmentPosition } from './position'
import { currentLeg, legSla, shipmentSla } from './sla'

const data = buildSeed()
const leg = (over: Partial<Leg>): Leg =>
  ({ id: 'L', status: 'assigned', window: { from: '2026-11-23T14:00:00+05:30', to: '2026-11-23T16:00:00+05:30' }, slaDueAt: '2026-11-23T16:00:00+05:30', ...over }) as Leg

describe('leg SLA state', () => {
  it('on track with plenty of time, at risk under 2 hours, breached once past', () => {
    expect(legSla(leg({}), DEMO_START)).toBe('onTrack') // 6 h left
    expect(legSla(leg({}), '2026-11-23T14:30:00+05:30')).toBe('atRisk') // 1.5 h left
    expect(legSla(leg({}), '2026-11-23T16:01:00+05:30')).toBe('breached')
  })

  it('at risk when under 25% of a long window remains', () => {
    const long = leg({ window: { from: '2026-11-23T23:00:00+05:30', to: '2026-11-26T06:00:00+05:30' }, slaDueAt: '2026-11-26T06:00:00+05:30' })
    expect(legSla(long, '2026-11-24T12:00:00+05:30')).toBe('onTrack')
    expect(legSla(long, '2026-11-25T18:00:00+05:30')).toBe('atRisk') // 12 h of a 55 h window left
  })

  it('finished legs are done; legs with a problem are at least at risk', () => {
    expect(legSla(leg({ status: 'handedOver' }), '2026-11-30T00:00:00+05:30')).toBe('done')
    expect(legSla(leg({ status: 'exception' }), DEMO_START)).toBe('atRisk')
  })
})

describe('shipment SLA state', () => {
  it('done once delivered; breached when the ETA day has passed undelivered', () => {
    expect(shipmentSla(data, data.shipments['LGS-DEL-000769'], DEMO_START)).toBe('done')
    expect(shipmentSla(data, data.shipments['LGS-DEL-000776'], DEMO_START)).toBe('breached') // NDR, ETA 21-Nov
  })

  it('follows its worst open leg', () => {
    const s = data.shipments['LGS-DEL-000790'] // pickup 12:00–14:00 today
    expect(shipmentSla(data, s, DEMO_START)).toBe('onTrack')
    expect(shipmentSla(data, s, addHours(DEMO_START, 3))).toBe('atRisk')
    expect(shipmentSla(data, s, addHours(DEMO_START, 5))).toBe('breached')
    expect(currentLeg(data, s)?.id).toBe('JOB-000790-L1')
  })
})

describe('map position', () => {
  it('a long-haul route has origin, both hubs and destination', () => {
    expect(routeStops(data, data.shipments['LGS-DEL-000784']).map((x) => x.kind)).toEqual(['origin', 'originHub', 'destHub', 'dest'])
  })

  it('a booked shipment is at its pickup point; delivered at its destination', () => {
    const booked = data.shipments['LGS-DEL-000790']
    expect(shipmentPosition(data, booked, DEMO_START)).toMatchObject({ lat: 28.5355, lng: 77.2732 })
    const delivered = data.shipments['LGS-DEL-000769']
    const dest = data.pincodes[delivered.destPincode]
    expect(shipmentPosition(data, delivered, DEMO_START)).toMatchObject({ lat: dest.lat, lng: dest.lng })
  })

  it('in transit: between the two hubs, moving on as time passes', () => {
    const s = data.shipments['LGS-DEL-000784'] // Gurugram → Bhiwandi, departed 21-Nov 22:00
    const ggn = data.pincodes['122001']
    const bom = data.pincodes['421302']
    const now = shipmentPosition(data, s, DEMO_START)
    const later = shipmentPosition(data, s, addHours(DEMO_START, 24))
    expect(now.lat).toBeLessThan(ggn.lat)
    expect(now.lat).toBeGreaterThan(bom.lat)
    expect(later.lat).toBeLessThan(now.lat) // heading south
  })
})
