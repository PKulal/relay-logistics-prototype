/**
 * Partner Portal operations views: PP-15 live board (source §5.1, partner-side
 * control tower), PP-16 line-haul trips (§5.1 Line-Haul Trip, §7 Step 6) and
 * PP-17 hub operations (§5.1 Hub Operations, §7 Steps 5 and 7).
 */
import { istDate, minutesBetween } from '@shared/lib/time'
import type { DemoData, FieldStaff, Id, IsoDateTime, Leg, Trip } from '@shared/types'
import { legRisk, type RiskReason } from './controlTower'
import { hubItems } from './hub'
import { hubDwell } from './opsReview'
import { legDoneAt } from './payables'
import { shipmentPosition, type Point } from './position'
import { activeHalt, etaAtRisk, loadedLegs, tripEta } from './trip'

// ── PP-15 ───────────────────────────────────────────────────────────────────

export const BOARD_COLUMNS = ['accepted', 'assigned', 'inProgress', 'done', 'failed'] as const
export type BoardColumn = (typeof BOARD_COLUMNS)[number]

const COLUMN_OF: Partial<Record<Leg['status'], BoardColumn>> = { accepted: 'accepted', assigned: 'assigned', inProgress: 'inProgress', handedOver: 'done', delivered: 'done', closed: 'done', failedAttempt: 'failed', exception: 'failed' }

/** The partner's jobs for today, by board column. */
export function liveBoard(data: DemoData, partnerId: Id, now: IsoDateTime): Record<BoardColumn, Leg[]> {
  const today = istDate(now)
  const out = Object.fromEntries(BOARD_COLUMNS.map((c) => [c, [] as Leg[]])) as Record<BoardColumn, Leg[]>
  const doneAt = legDoneAt(data)
  for (const l of Object.values(data.legs)) {
    if (l.partnerId !== partnerId) continue
    const col = COLUMN_OF[l.status]
    if (!col) continue
    const live = col === 'accepted' || col === 'assigned' || col === 'inProgress' || col === 'failed'
    // Finished today = its last hand-over / delivery event is today
    if (!live && istDate(doneAt.get(l.id) ?? l.window.to) !== today) continue
    if (live && istDate(l.window.from) > today) continue
    out[col].push(l)
  }
  for (const c of BOARD_COLUMNS) out[c].sort((a, b) => a.window.to.localeCompare(b.window.to))
  return out
}

export interface AtRiskJob {
  leg: Leg
  risk: number
  minutesLeft: number
  reason?: RiskReason
}

/** Jobs likely to miss their SLA (risk 50%+), most urgent first. */
export function partnerAtRisk(data: DemoData, partnerId: Id, now: IsoDateTime): AtRiskJob[] {
  return Object.values(data.legs)
    .filter((l) => l.partnerId === partnerId && ['accepted', 'assigned', 'inProgress'].includes(l.status))
    .map((leg) => {
      const r = legRisk(data, leg, now)
      return { leg, risk: r.risk, minutesLeft: minutesBetween(now, leg.window.to), reason: r.reasons[0]?.r }
    })
    .filter((x) => x.risk >= 50)
    .sort((a, b) => b.risk - a.risk || a.minutesLeft - b.minutesLeft)
}

export type StaffState = 'onDuty' | 'idle' | 'offline'

export interface StaffRow {
  staff: FieldStaff
  done: number
  total: number
  lastScan?: IsoDateTime
  state: StaffState
  position?: Point
}

/** Staff today: jobs done / total, last scan, on duty (scan in the last hour) / idle / offline. */
export function staffToday(data: DemoData, partnerId: Id, now: IsoDateTime): StaffRow[] {
  const today = istDate(now)
  return Object.values(data.fieldStaff)
    .filter((s) => s.partnerId === partnerId && (s.status ?? 'active') === 'active')
    .map((staff) => {
      const legs = Object.values(data.legs).filter((l) => l.staffId === staff.id && istDate(l.window.from) === today)
      const done = legs.filter((l) => ['handedOver', 'delivered', 'closed'].includes(l.status)).length
      const scans = Object.values(data.events)
        .filter((e) => e.by === staff.id)
        .sort((a, b) => b.at.localeCompare(a.at))
      const last = scans[0]
      const lastToday = last && istDate(last.at) === today ? last : undefined
      const state: StaffState = lastToday && minutesBetween(lastToday.at, now) <= 60 ? 'onDuty' : legs.length ? 'idle' : 'offline'
      const position = last?.lat != null && last.lng != null ? { lat: last.lat, lng: last.lng } : staff.hubId ? hubPoint(data, staff.hubId) : undefined
      return { staff, done, total: legs.length, lastScan: last?.at, state, position }
    })
    .sort((a, b) => b.total - a.total || a.staff.name.localeCompare(b.staff.name))
}

const hubPoint = (data: DemoData, hubId: Id): Point | undefined => {
  const pin = data.pincodes[data.hubs[hubId]?.pincode]
  return pin ? { lat: pin.lat, lng: pin.lng } : undefined
}

/** Job pins for the board map. */
export const jobPins = (data: DemoData, legs: Leg[], now: IsoDateTime) => legs.map((l) => ({ leg: l, ...shipmentPosition(data, data.shipments[l.shipmentId], now) }))

// ── PP-16 ───────────────────────────────────────────────────────────────────

export type TripState = 'planned' | 'loading' | 'inTransit' | 'halted' | 'breakdown' | 'arrived' | 'closed'

export function tripsOf(data: DemoData, partnerId: Id): Trip[] {
  return Object.values(data.trips)
    .filter((t) => data.vehicles[t.vehicleId]?.partnerId === partnerId || t.legIds.some((id) => data.legs[id]?.partnerId === partnerId))
    .sort((a, b) => b.departAt.localeCompare(a.departAt))
}

export function tripState(data: DemoData, trip: Trip, now: IsoDateTime): TripState {
  if (trip.status === 'arrived') return trip.legIds.every((id) => ['handedOver', 'closed', 'delivered'].includes(data.legs[id]?.status)) ? 'closed' : 'arrived'
  if (trip.status !== 'inTransit') return trip.status
  const h = activeHalt(trip, now)
  return h ? (h.breakdown ? 'breakdown' : 'halted') : 'inTransit'
}

export function tripLoad(data: DemoData, trip: Trip) {
  const legs = loadedLegs(data, trip).length ? loadedLegs(data, trip) : trip.legIds.map((id) => data.legs[id]).filter(Boolean)
  const shipments = legs.map((l) => data.shipments[l.shipmentId])
  return {
    shipments: shipments.length,
    pieces: shipments.reduce((n, s) => n + s.pieces.length, 0),
    kg: Math.round(shipments.reduce((n, s) => n + (s.weights.verifiedChargeable ?? s.weights.chargeable), 0)),
    legs,
  }
}

export const tripEtaInfo = (trip: Trip) => ({ eta: tripEta(trip), atRisk: etaAtRisk(trip) })

// ── PP-17 ───────────────────────────────────────────────────────────────────

export interface HubSummary {
  hubId: Id
  expected: number
  expectedPieces: number
  inScanned: number
  sorted: number
  sealed: number
  outScanned: number
  dwellHours?: number
  shortExcess: number
  /** Shipments in the hub for more than a day (storage is billable for Type F, source §3) */
  stored: { lr: Id; days: number }[]
}

/** ₹ per shipment per day in storage (assumed). */
export const STORAGE_RATE = 40

export function hubSummary(data: DemoData, hubId: Id, now: IsoDateTime): HubSummary {
  const items = hubItems(data, hubId, now)
  const count = (stages: string[]) => items.filter((i) => stages.includes(i.stage)).length
  const legIds = new Set(items.flatMap((i) => [i.leg.id, i.from.id]))
  const dwell = hubDwell(data, now).find((d) => d.hubId === hubId)
  const stored = items
    .filter((i) => ['toSort', 'sorted', 'sealed'].includes(i.stage))
    .map((i) => {
      const inScan = Object.values(data.events).find((e) => e.legId === i.leg.id && e.type === 'hubInScan')
      return { lr: i.shipment.id, days: inScan ? Math.floor(minutesBetween(inScan.at, now) / 1440) : 0 }
    })
    .filter((x) => x.days >= 1)
  return {
    hubId,
    expected: items.length,
    expectedPieces: items.reduce((n, i) => n + i.pieceIds.length, 0),
    inScanned: count(['toSort', 'sorted', 'sealed', 'dispatched']),
    sorted: count(['sorted', 'sealed', 'dispatched']),
    sealed: count(['sealed', 'dispatched']),
    outScanned: count(['dispatched']),
    dwellHours: dwell?.avgHours,
    shortExcess: Object.values(data.exceptions).filter((x) => x.status !== 'resolved' && (x.type === 'short' || x.type === 'excess') && x.legId && legIds.has(x.legId)).length,
    stored,
  }
}
