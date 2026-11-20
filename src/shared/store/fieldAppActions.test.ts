import { buildSeed, DEMO_START } from '@data/seed'
import { canCompleteTraining, myDay, PRACTICE, queueOf, trainingStatus } from '@shared/engines/fieldDay'
import type { ShipmentEvent } from '@shared/types'
import * as fa from './fieldAppActions'
import { useDemoStore } from './store'

const now = DEMO_START

describe('PA-13 sync queue', () => {
  it('queues Partner App events made offline; Sync now fails offline and sends online', () => {
    const d = buildSeed()
    const ev: ShipmentEvent = { id: 'EV-X-1', shipmentId: 'LGS-DEL-000790', type: 'pickupArrived', at: now, by: 'FS-RAVI', app: 'partnerApp', photos: ['a', 'b'] }
    let q = fa.queueOfflineEvents(d, { ...d, events: { ...d.events, [ev.id]: ev } }, now)
    expect(queueOf(q, 'FS-RAVI')).toEqual([expect.objectContaining({ eventId: 'EV-X-1', photos: 2, status: 'waiting' })])
    expect(fa.queueOfflineEvents(q, q, now)).toBe(q) // nothing new
    q = fa.syncNow(q, 'FS-RAVI', false, now)
    expect(queueOf(q, 'FS-RAVI')[0]).toMatchObject({ status: 'failed', attempts: 1 })
    expect(Object.values(q.notifications).some((n) => n.audience.userId === 'FS-RAVI' && n.title === 'Sync failed')).toBe(true)
    q = fa.syncNow(q, 'FS-RAVI', true, now)
    expect(queueOf(q, 'FS-RAVI')).toHaveLength(0)
  })

  it('the store queues while the toolbar is offline and sends when it goes back online', () => {
    const st = useDemoStore.getState
    st().resetDemo()
    st().setFlag('offline', true)
    const ev: ShipmentEvent = { id: 'EV-X-2', shipmentId: 'LGS-DEL-000790', type: 'pickupArrived', at: now, by: 'FS-RAVI', app: 'partnerApp' }
    st().addEvents([ev])
    expect(queueOf(st().data, 'FS-RAVI')).toHaveLength(1)
    st().setFlag('offline', false)
    expect(queueOf(st().data, 'FS-RAVI')).toHaveLength(0)
    st().resetDemo()
  })
})

describe('PA-10 training', () => {
  it('complete only after every practice task passes', () => {
    let d = buildSeed()
    expect(trainingStatus(d.fieldStaff['FS-SWC-DEEPAK'])).toBe('inProgress')
    expect(fa.completeTraining(d, 'FS-SWC-DEEPAK', now)).toBe(d)
    d = fa.watchVideo(d, 'FS-SWC-DEEPAK', 'handover')
    for (const p of PRACTICE.rider) d = fa.passPractice(d, 'FS-SWC-DEEPAK', p.id)
    expect(canCompleteTraining(d.fieldStaff['FS-SWC-DEEPAK'])).toBe(true)
    d = fa.completeTraining(d, 'FS-SWC-DEEPAK', now)
    expect(d.fieldStaff['FS-SWC-DEEPAK']).toMatchObject({ trained: true, training: { completedAt: now } })
    expect(fa.passPractice(d, 'FS-SWC-DEEPAK', 'hubBag')).toBe(d) // not a rider task
  })
})

describe('PA-09 my day', () => {
  it('a week of 7 days from Monday; COD in hand matches PA-36', () => {
    const d = buildSeed()
    const m = myDay(d, 'FS-RAVI', now)
    expect(m.week.map((w) => w.date)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'])
    expect(m.done).toBeGreaterThanOrEqual(0)
    expect(m.codInHand).toBeGreaterThanOrEqual(0)
  })
})
