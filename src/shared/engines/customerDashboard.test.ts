import { buildSeed, DEMO_START } from '@data/seed'
import { addHours } from '@shared/lib/time'
import type { DemoData } from '@shared/types'
import { actionsNeeded, banners, customerShipments, customerShipmentsDue, onTimeRate, onTimeTrend, periods, statusTiles } from './customerDashboard'

const data = buildSeed()

describe('periods', () => {
  it('last 7 days runs from the start of 17-Nov to now, previous is the 7 days before', () => {
    const { current, previous } = periods('7d', DEMO_START)
    expect(current).toEqual({ from: '2026-11-17T00:00:00+05:30', to: DEMO_START })
    expect(Date.parse(previous.to)).toBe(Date.parse(current.from))
    expect(Date.parse(current.to) - Date.parse(current.from)).toBe(Date.parse(previous.to) - Date.parse(previous.from))
  })

  it('this month starts on the 1st', () => {
    expect(periods('month', DEMO_START).current.from).toBe('2026-11-01T00:00:00+05:30')
  })
})

describe('status tiles', () => {
  const month = customerShipments(data, 'C-SHARMA', periods('month', DEMO_START).current)
  const tiles = statusTiles(data, month)

  it('counts Sharma Electricals shipments by status', () => {
    const live = month.filter((s) => s.status !== 'cancelled')
    const statusTotal = tiles.booked + tiles.pickedUp + tiles.inTransit + tiles.atDestinationHub + tiles.outForDelivery + tiles.delivered
    const exceptionStatuses = live.filter((s) => ['undelivered', 'deliveredWithException', 'returnToOrigin'].includes(s.status)).length
    expect(statusTotal + exceptionStatuses).toBe(live.length)
    expect(tiles.booked).toBeGreaterThan(0)
  })

  it('counts the open weight revision (000784) and the NDR (000776) as exceptions', () => {
    const only = (ids: string[]) => statusTiles(data, ids.map((id) => data.shipments[id]))
    expect(only(['LGS-DEL-000784']).exceptions).toBe(1)
    expect(only(['LGS-DEL-000784']).inTransit).toBe(1)
    expect(only(['LGS-DEL-000776']).exceptions).toBe(1)
  })

  it('filters by pickup location', () => {
    const okhla = customerShipments(data, 'C-SHARMA', periods('month', DEMO_START).current, 'PL-OKHLA')
    expect(okhla.length).toBeGreaterThan(0)
    expect(okhla.length).toBeLessThan(month.length)
    expect(okhla.every((s) => s.pickupLocationId === 'PL-OKHLA')).toBe(true)
  })

  it('updates as shipments move', () => {
    const moved: DemoData = structuredClone(data)
    moved.shipments['LGS-DEL-000790'].status = 'pickedUp'
    const before = statusTiles(data, [data.shipments['LGS-DEL-000790']])
    const after = statusTiles(moved, [moved.shipments['LGS-DEL-000790']])
    expect([before.booked, after.booked, after.pickedUp]).toEqual([1, 0, 1])
  })
})

describe('on-time delivery', () => {
  it('is measured on shipments due in the period, by promised date', () => {
    const p = periods('7d', DEMO_START).current
    const due = customerShipmentsDue(data, 'C-SHARMA', p)
    expect(due.length).toBeGreaterThan(0)
    expect(due.every((s) => s.eta >= '2026-11-17' && s.eta <= '2026-11-22')).toBe(true)
    // the trend has a point for every day of the week, and values on days with deliveries due
    const trend = onTimeTrend(data, due, p, DEMO_START)
    expect(trend).toHaveLength(7)
    expect(trend.filter((d) => d.pct !== null).length).toBeGreaterThan(2)
  })

  it('is a realistic share: failed deliveries and returns count as late', () => {
    const month = customerShipmentsDue(data, 'C-SHARMA', periods('month', DEMO_START).current)
    const r = onTimeRate(data, month, DEMO_START)
    expect(r.due).toBeGreaterThan(10)
    expect(r.pct).toBeGreaterThan(60)
    expect(r.pct).toBeLessThan(100)
  })

  it('ignores shipments not yet due and returns null when nothing is due', () => {
    expect(onTimeRate(data, [data.shipments['LGS-DEL-000790']], DEMO_START)).toEqual({ due: 0, onTime: 0, pct: null })
  })
})

describe('exceptions needing action', () => {
  const items = actionsNeeded(data, 'C-SHARMA')

  it('includes the weight revision on 000784, due 48 h after it was raised', () => {
    const wr = items.find((i) => i.shipmentId === 'LGS-DEL-000784')!
    expect(wr).toMatchObject({ kind: 'weightRevision', screenId: 'CP-20' })
    expect(wr.dueAt).toBe(addHours(data.weightRevisions['WR-000784'].raisedAt, 48))
  })

  it('includes the NDR on 000776 with its action-due time', () => {
    expect(items.find((i) => i.shipmentId === 'LGS-DEL-000776')).toMatchObject({
      kind: 'ndr',
      screenId: 'CP-21',
      reason: 'premisesClosed',
      dueAt: '2026-11-24T18:00:00+05:30',
    })
  })

  it('leaves out the shortage on 000769: its claim is already settled', () => {
    expect(items.some((i) => i.shipmentId === 'LGS-DEL-000769')).toBe(false)
  })

  it('is sorted by due time and only shows this customer', () => {
    expect(items.map((i) => Date.parse(i.dueAt))).toEqual([...items.map((i) => Date.parse(i.dueAt))].sort((a, b) => a - b))
    expect(items.every((i) => data.shipments[i.shipmentId].customerId === 'C-SHARMA')).toBe(true)
  })

  it('drops an NDR once the customer has chosen what to do', () => {
    const answered: DemoData = structuredClone(data)
    answered.ndrs['NDR-000776-1'].customerChoice = 'changeSlot'
    expect(actionsNeeded(answered, 'C-SHARMA').some((i) => i.shipmentId === 'LGS-DEL-000776')).toBe(false)
  })
})

describe('banners', () => {
  it('none for Sharma (credit 68.8% used) or Kaveri (₹8,450 in the wallet)', () => {
    expect(banners(data, data.customers['C-SHARMA'])).toEqual([])
    expect(banners(data, data.customers['C-KAVERI'])).toEqual([])
  })

  it('warns on credit above 80%, a low wallet and pilot accounts', () => {
    expect(banners(data, { ...data.customers['C-SHARMA'], creditUsed: 410000 })).toEqual(['creditHigh'])
    expect(banners(data, { ...data.customers['C-KAVERI'], walletBalance: 1500 })).toEqual(['walletLow'])
    expect(banners(data, { ...data.customers['C-KAVERI'], status: 'pilot' })).toEqual(['pilot'])
  })
})
