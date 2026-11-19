import { buildSeed, DEMO_START } from '@data/seed'
import { bookShipment } from '@shared/store/booking'
import { acceptLegs, assignLegs } from '@shared/store/partnerActions'
import { arriveAtPickup, confirmPickup, outsideTolerance, verifiedOutcome, type VerifiedPiece } from '@shared/store/pickupActions'
import { nextTask, riderCounts, taskDistance, tasksFor } from './fieldTasks'

/** Hero booked, SwiftCity accepts and assigns Ravi with "Use Gate 2" (as in PP-12 / PP-14). */
function heroWithRavi() {
  let { data } = bookShipment(
    buildSeed(),
    {
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
      pieces: Array.from({ length: 6 }, () => ({ l: 60, b: 40, h: 40, weight: 20 })),
      pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' },
      autoAccept: true,
    },
    DEMO_START,
  )
  data = acceptLegs(data, ['JOB-000781-L1'], 'PU-NEHA', DEMO_START)
  data = assignLegs(data, ['JOB-000781-L1'], 'FS-RAVI', 'V-DL01LT4521', 'PU-NEHA', DEMO_START)
  return data
}

const data = heroWithRavi()
const asBooked = (lr: string): VerifiedPiece[] => data.shipments[lr].pieces.map((p) => ({ id: p.id, l: p.l, b: p.b, h: p.h, weight: p.weight }))
const larger = (lr: string): VerifiedPiece[] => asBooked(lr).map((p, i) => (i >= 4 ? { ...p, l: 62, b: 42, h: 42 } : p))

describe('PA-05 / PA-06 tasks', () => {
  const tasks = tasksFor(data, 'FS-RAVI', DEMO_START)
  const hero = tasks.find((t) => t.leg.id === 'JOB-000781-L1')!

  it('Ravi sees the hero pickup as a new to-do task with its place and tags', () => {
    expect(hero).toMatchObject({ kind: 'pickup', state: 'todo', place: 'Sharma Electricals, Okhla Industrial Area Phase II', tags: ['ewb'] })
    expect(hero.newNotificationIds).toHaveLength(1)
  })

  it('has 8 pickups to do today (the 7 seeded plus the hero); deliveries already out come first', () => {
    expect(riderCounts(tasks).pickupsTodo).toBe(8)
    // Ravi also delivers for SwiftCity in Delhi NCR: anything in progress is the next task
    expect(nextTask(tasks)).toMatchObject({ kind: 'delivery', state: 'inProgress' })
  })

  it('only lists work finished or failed today, not earlier days', () => {
    const doneDays = tasks.filter((t) => t.state === 'done' || t.state === 'failed').map((t) => t.leg.id)
    expect(doneDays.every((id) => Object.values(data.events).some((e) => e.legId === id && e.at.startsWith('2026-11-23')))).toBe(true)
  })

  it('shows a simulated distance from the Gurugram hub', () => {
    expect(taskDistance(data, data.fieldStaff['FS-RAVI'], hero)).toBeGreaterThan(10)
  })

  it('a driver sees the line-haul trip even though it starts later', () => {
    expect(tasksFor(data, 'FS-BASAVARAJ', DEMO_START).find((t) => t.leg.id === 'JOB-000781-L3')).toMatchObject({ kind: 'trip', state: 'todo' })
  })

  it('a rider does not see the Thursday delivery on Monday', () => {
    expect(tasksFor(data, 'FS-MANJU', DEMO_START).some((t) => t.leg.id === 'JOB-000781-L5')).toBe(false)
  })
})

describe('PA-16 weight verification (Partner App spec §7.4)', () => {
  it('as booked: 162 kg, no revision', () => {
    expect(verifiedOutcome(data, 'LGS-DEL-000781', asBooked('LGS-DEL-000781'))).toMatchObject({ booked: 162, verified: 162, revision: false, amountDiff: 0 })
  })

  it('"Measure larger": two boxes bigger → 170 kg, outside the 3% tolerance, + ₹145.38', () => {
    expect(verifiedOutcome(data, 'LGS-DEL-000781', larger('LGS-DEL-000781'))).toMatchObject({ booked: 162, verified: 170, revision: true, amountDiff: 145.38 })
  })

  it('tolerance is 3% or 0.5 kg, whichever is higher', () => {
    expect(outsideTolerance(data, 162, 166.8)).toBe(false) // 4.8 kg ≤ 4.86
    expect(outsideTolerance(data, 162, 167)).toBe(true)
    expect(outsideTolerance(data, 7.5, 8)).toBe(false) // 0.5 kg floor
    expect(outsideTolerance(data, 7.5, 8.5)).toBe(true)
  })
})

describe('PA-14 → PA-17 pickup', () => {
  const confirm = (verified: VerifiedPiece[]) =>
    confirmPickup(
      arriveAtPickup(data, 'JOB-000781-L1', 'FS-RAVI', '2026-11-23T14:20:00+05:30'),
      {
        legId: 'JOB-000781-L1',
        staffId: 'FS-RAVI',
        pieceIds: data.shipments['LGS-DEL-000781'].pieces.map((p) => p.id),
        verified,
        photos: ['invoice-1', 'scale-1', 'tape-1'],
        handedOverBy: 'Ramesh Kumar',
        confirmation: 'signature',
        packagingDamaged: false,
        labelledBy: 'shipper',
      },
      '2026-11-23T14:40:00+05:30',
    )

  it('confirming makes the shipment Picked Up and the task a hand-over', () => {
    const after = confirm(asBooked('LGS-DEL-000781'))
    expect(after.shipments['LGS-DEL-000781'].status).toBe('pickedUp')
    expect(after.legs['JOB-000781-L1'].status).toBe('inProgress')
    const types = Object.values(after.events).filter((e) => e.legId === 'JOB-000781-L1').map((e) => e.type)
    expect(types).toEqual(expect.arrayContaining(['pickupArrived', 'pickupConfirmed']))
    expect(after.weightRevisions['WR-000781']).toBeUndefined()
    expect(tasksFor(after, 'FS-RAVI', '2026-11-23T14:40:00+05:30').find((t) => t.leg.id === 'JOB-000781-L1')).toMatchObject({ kind: 'handover', state: 'inProgress' })
  })

  it('measured larger: a pending weight revision of + ₹145.38 for the customer', () => {
    const after = confirm(larger('LGS-DEL-000781'))
    expect(after.weightRevisions['WR-000781']).toMatchObject({ booked: 162, verified: 170, amountDiff: 145.38, status: 'pending' })
    expect(after.shipments['LGS-DEL-000781'].weights.verifiedChargeable).toBe(170)
    expect(after.shipments['LGS-DEL-000781'].pieces[5].verifiedDims).toEqual({ l: 62, b: 42, h: 42 })
  })
})
