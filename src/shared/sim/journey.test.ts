import { buildSeed, DEMO_START } from '@data/seed'
import { addHours } from '@shared/lib/time'
import { deriveStatus } from '@shared/engines/status'
import type { DemoData } from '@shared/types'
import { advanceJourneys } from './journey'

const seed = buildSeed()
const statuses = (d: DemoData) => Object.fromEntries(Object.values(d.shipments).map((s) => [s.id, s.status]))
const eventsOf = (d: DemoData, id: string) => Object.values(d.events).filter((e) => e.shipmentId === id)

describe('advancing the demo clock moves background shipments', () => {
  const tomorrow = addHours(DEMO_START, 24)
  const oneStep = advanceJourneys(seed, DEMO_START, tomorrow)

  it('changes the status of some shipments over a day', () => {
    const before = statuses(seed)
    const after = statuses(oneStep)
    const moved = Object.keys(after).filter((id) => after[id] !== before[id])
    expect(moved.length).toBeGreaterThan(10)
  })

  it('gives the same result in small steps as in one step', () => {
    let stepped = seed
    let t = DEMO_START
    for (let i = 0; i < 24; i++) {
      const next = addHours(t, 1)
      stepped = advanceJourneys(stepped, t, next)
      t = next
    }
    expect(statuses(stepped)).toEqual(statuses(oneStep))
    expect(Object.keys(stepped.events).length).toBe(Object.keys(oneStep.events).length)
  })

  it('never writes an event later than the new time, or twice', () => {
    const late = Object.values(oneStep.events).filter((e) => Date.parse(e.at) > Date.parse(tomorrow))
    expect(late).toEqual([])
    for (const s of Object.values(oneStep.shipments)) {
      const keys = eventsOf(oneStep, s.id).map((e) => `${e.type}|${e.legId}|${e.at}`)
      expect(new Set(keys).size, s.id).toBe(keys.length)
    }
  })

  it('keeps stored statuses equal to a replay of the events', () => {
    for (const s of Object.values(oneStep.shipments)) {
      const r = deriveStatus({ legs: s.legIds.map((id) => oneStep.legs[id]), events: eventsOf(oneStep, s.id) })
      expect(r.shipmentStatus, s.id).toBe(s.status)
      expect(r.ignoredEventIds, s.id).toEqual([])
    }
  })

  it('leaves shipments without a plan alone (LGS-DEL-000790 waits for the reassignment demo)', () => {
    expect(seed.shipments['LGS-DEL-000790'].sim).toBeUndefined()
    expect(eventsOf(oneStep, 'LGS-DEL-000790')).toEqual(eventsOf(seed, 'LGS-DEL-000790'))
    expect(oneStep.shipments['LGS-DEL-000790'].status).toBe('booked')
  })

  it('moves the open weight revision shipment on to its delivery', () => {
    const later = advanceJourneys(seed, DEMO_START, addHours(DEMO_START, 72))
    expect(later.shipments['LGS-DEL-000784'].status).toBe('delivered')
  })

  it('does nothing when time does not move forward', () => {
    expect(advanceJourneys(seed, DEMO_START, DEMO_START)).toBe(seed)
  })
})
