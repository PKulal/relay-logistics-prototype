/**
 * Partner health (ERP-09) and the daily review pack (ERP-10) — source §11.1:
 * "Partner Health: who is behind on pickups, which hubs have high dwell time,
 * which trucks have stopped"; "Daily Review Pack: auto-generated at 9 am".
 */
import { addDaysToDate, istDate, minutesBetween } from '@shared/lib/time'
import type { DemoData, ExceptionKind, Id, IsoDate, IsoDateTime, Leg } from '@shared/types'
import { DONE_LEG } from './sla'

const PRE_PICKUP = ['offered', 'accepted', 'flagged', 'assigned']
/** Hub dwell above this is flagged (spec: items over 12 h). */
export const DWELL_FLAG_HOURS = 12
/** A truck with no movement for this long counts as stopped (assumed). */
export const STOPPED_MINUTES = 60

export interface PickupsBehind {
  partnerId: Id
  due: number
  done: number
  late: number
  oldestLate?: IsoDateTime
}

/** Today's pickups per first-mile partner; late = window over and not picked up. */
export function pickupsBehind(data: DemoData, now: IsoDateTime): PickupsBehind[] {
  const today = istDate(now)
  const by: Record<Id, PickupsBehind> = {}
  for (const l of Object.values(data.legs)) {
    if (l.type !== 'firstMile' || l.status === 'withdrawn' || istDate(l.window.from) !== today) continue
    const row = (by[l.partnerId] ??= { partnerId: l.partnerId, due: 0, done: 0, late: 0 })
    row.due += 1
    if (!PRE_PICKUP.includes(l.status)) row.done += 1
    else if (Date.parse(l.window.to) < Date.parse(now)) {
      row.late += 1
      if (!row.oldestLate || l.window.to < row.oldestLate) row.oldestLate = l.window.to
    }
  }
  return Object.values(by).sort((a, b) => b.late - a.late || b.due - b.done - (a.due - a.done))
}

/** When the hub took the goods (hand-over received on the hub leg). */
function hubArrival(data: DemoData, leg: Leg): IsoDateTime | undefined {
  return Object.values(data.events)
    .filter((e) => e.legId === leg.id && (e.type === 'handoverReceived' || e.type === 'hubInScan'))
    .map((e) => e.at)
    .sort()[0]
}

export interface HubDwell {
  hubId: Id
  shipments: number
  avgHours: number
  over: number
}

/** Shipments now inside each hub, how long they have been there on average, and how many over 12 h. */
export function hubDwell(data: DemoData, now: IsoDateTime): HubDwell[] {
  const by: Record<Id, { hours: number[] }> = {}
  for (const l of Object.values(data.legs)) {
    if ((l.type !== 'originHub' && l.type !== 'destHub') || l.status !== 'inProgress') continue
    const s = data.shipments[l.shipmentId]
    const hubId = data.pincodes[l.type === 'originHub' ? s.originPincode : s.destPincode]?.hubId
    const since = hubArrival(data, l)
    if (!hubId || !since) continue
    ;(by[hubId] ??= { hours: [] }).hours.push(minutesBetween(since, now) / 60)
  }
  return Object.entries(by)
    .map(([hubId, { hours }]) => ({ hubId, shipments: hours.length, avgHours: Math.round((hours.reduce((a, h) => a + h, 0) / hours.length) * 10) / 10, over: hours.filter((h) => h > DWELL_FLAG_HOURS).length }))
    .sort((a, b) => b.avgHours - a.avgHours)
}

export interface StoppedTruck {
  tripId: Id
  lastMovement: IsoDateTime
  minutes: number
  reason?: string
  breakdown: boolean
}

/** Trips on the road whose last position is more than an hour old. */
export function stoppedTrucks(data: DemoData, now: IsoDateTime): StoppedTruck[] {
  return Object.values(data.trips)
    .filter((t) => t.status === 'inTransit')
    .map((t) => {
      const last = t.positions.at(-1)?.at ?? t.startedAt ?? t.departAt
      const halt = t.halts.at(-1)
      return { tripId: t.id, lastMovement: last, minutes: minutesBetween(last, now), reason: halt?.reason, breakdown: !!halt?.breakdown }
    })
    .filter((x) => x.minutes >= STOPPED_MINUTES)
    .sort((a, b) => b.minutes - a.minutes)
}

// ─── ERP-10 daily review pack ─────────────────────────────────────────────────

/** The pack is generated at 9:00 for the previous day. */
export const PACK_HOUR = 9
export const packDate = (now: IsoDateTime): IsoDate => addDaysToDate(istDate(now), Number(now.slice(11, 13)) >= PACK_HOUR ? -1 : -2)

export interface PartnerLeague {
  partnerId: Id
  legs: number
  onTimePct: number
}

export interface DailyPack {
  date: IsoDate
  generatedAt: IsoDateTime
  booked: number
  delivered: number
  onTimePct: number
  exceptions: Partial<Record<ExceptionKind, number>>
  claims: number
  best: PartnerLeague[]
  worst: PartnerLeague[]
  carriedOver: Partial<Record<ExceptionKind, number>>
  stopped: number
  hubsOverDwell: Id[]
}

/**
 * When a leg's work finished and the deadline it is measured against: a pickup
 * by its confirmation against the pickup window (PA-17); other legs by their
 * last event against the leg SLA.
 */
function finished(data: DemoData, l: Leg): { at: IsoDateTime; due: IsoDateTime } | undefined {
  let at: IsoDateTime | undefined
  for (const e of Object.values(data.events)) {
    if (e.legId !== l.id) continue
    if (l.type === 'firstMile' ? e.type === 'pickupConfirmed' : !at || e.at > at) at = e.at
  }
  return at ? { at, due: l.type === 'firstMile' ? l.window.to : l.slaDueAt } : undefined
}

export function dailyPack(data: DemoData, now: IsoDateTime): DailyPack {
  const date = packDate(now)
  const on = (iso?: IsoDateTime) => !!iso && istDate(iso) === date
  const events = Object.values(data.events)
  const booked = events.filter((e) => e.type === 'booked' && on(e.at)).length
  const deliveredEv = events.filter((e) => e.type === 'delivered' && on(e.at))
  const onTime = deliveredEv.filter((e) => {
    const s = data.shipments[e.shipmentId]
    const last = data.legs[s.legIds.at(-1)!]
    return Date.parse(e.at) <= Date.parse(last.slaDueAt)
  }).length
  const tickets = Object.values(data.exceptions)
  const count = (xs: typeof tickets) => xs.reduce<Partial<Record<ExceptionKind, number>>>((m, x) => ({ ...m, [x.type]: (m[x.type] ?? 0) + 1 }), {})

  // Partner league: legs finished in the 7 days to the pack date, on time against the leg SLA
  const from = addDaysToDate(date, -6)
  const per: Record<Id, { n: number; ok: number }> = {}
  for (const l of Object.values(data.legs)) {
    if (!DONE_LEG.includes(l.status) || l.status === 'withdrawn') continue
    const f = finished(data, l)
    if (!f || istDate(f.at) < from || istDate(f.at) > date) continue
    const p = (per[l.partnerId] ??= { n: 0, ok: 0 })
    p.n += 1
    if (Date.parse(f.at) <= Date.parse(f.due)) p.ok += 1
  }
  const league = Object.entries(per)
    .filter(([, v]) => v.n >= 3)
    .map(([partnerId, v]) => ({ partnerId, legs: v.n, onTimePct: Math.round((v.ok / v.n) * 100) }))
    .sort((a, b) => b.onTimePct - a.onTimePct || b.legs - a.legs)

  return {
    date,
    generatedAt: `${addDaysToDate(date, 1)}T0${PACK_HOUR}:00:00+05:30`,
    booked,
    delivered: deliveredEv.length,
    onTimePct: deliveredEv.length ? Math.round((onTime / deliveredEv.length) * 100) : 0,
    exceptions: count(tickets.filter((x) => on(x.raisedAt))),
    claims: Object.values(data.claims).filter((c) => on(c.raisedAt)).length,
    best: league.slice(0, 5),
    worst: league.slice(-5).reverse(),
    carriedOver: count(tickets.filter((x) => x.status !== 'resolved' && istDate(x.raisedAt) <= date)),
    stopped: stoppedTrucks(data, now).length,
    hubsOverDwell: hubDwell(data, now).filter((h) => h.over > 0).map((h) => h.hubId),
  }
}
