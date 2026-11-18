/**
 * Customer Portal dashboard figures (CP-11). Pure functions over the shared
 * data, so the dashboard updates live as shipments move in the other apps.
 */
import { addDays, addHours, addDaysToDate, ist, istDate, istParts } from '@shared/lib/time'
import type { Customer, DemoData, Id, IsoDate, IsoDateTime, Shipment, ShipmentStatus } from '@shared/types'

// ─── Date range filter ─────────────────────────────────────────────────────────

export type DateRange = 'today' | '7d' | '30d' | 'month'

export interface Period {
  from: IsoDateTime
  to: IsoDateTime
}

/** The selected period and the one just before it (same length), for "vs previous". */
export function periods(range: DateRange, now: IsoDateTime): { current: Period; previous: Period } {
  const today = istDate(now)
  let from: IsoDateTime
  switch (range) {
    case 'today':
      from = ist(today, '00:00')
      break
    case '7d':
      from = ist(addDaysToDate(today, -6), '00:00')
      break
    case '30d':
      from = ist(addDaysToDate(today, -29), '00:00')
      break
    case 'month':
      from = ist(`${today.slice(0, 8)}01`, '00:00')
      break
  }
  const lengthMs = Date.parse(now) - Date.parse(from)
  const prevFrom = new Date(Date.parse(from) - lengthMs).toISOString()
  return { current: { from, to: now }, previous: { from: prevFrom, to: from } }
}

const inPeriod = (at: IsoDateTime, p: Period) => Date.parse(at) >= Date.parse(p.from) && Date.parse(at) <= Date.parse(p.to)

/** A customer's shipments booked in a period, optionally from one pickup location. */
export function customerShipments(data: DemoData, customerId: Id, period: Period, locationId?: Id): Shipment[] {
  return Object.values(data.shipments).filter(
    (s) => s.customerId === customerId && inPeriod(s.bookedAt, period) && (!locationId || s.pickupLocationId === locationId),
  )
}

// ─── Status tiles ──────────────────────────────────────────────────────────────

export type TileKey = 'booked' | 'pickedUp' | 'inTransit' | 'atDestinationHub' | 'outForDelivery' | 'delivered' | 'exceptions'

/** Statuses behind each tile. At Origin Hub counts as In Transit (agreed; the spec lists no tile for it). */
export const TILE_STATUSES: Record<Exclude<TileKey, 'exceptions'>, ShipmentStatus[]> = {
  booked: ['booked'],
  pickedUp: ['pickedUp'],
  inTransit: ['atOriginHub', 'inTransit'],
  atDestinationHub: ['atDestinationHub'],
  outForDelivery: ['outForDelivery'],
  delivered: ['delivered'],
}

/** Statuses that are exceptions in their own right. */
export const EXCEPTION_STATUSES: ShipmentStatus[] = ['undelivered', 'deliveredWithException', 'returnToOrigin']

/** A shipment needs attention if its status is an exception or it has a pending weight revision. */
export function hasException(data: DemoData, s: Shipment): boolean {
  return (
    EXCEPTION_STATUSES.includes(s.status) ||
    Object.values(data.weightRevisions).some((w) => w.shipmentId === s.id && w.status === 'pending')
  )
}

export function statusTiles(data: DemoData, shipments: Shipment[]): Record<TileKey, number> {
  const tiles = { booked: 0, pickedUp: 0, inTransit: 0, atDestinationHub: 0, outForDelivery: 0, delivered: 0, exceptions: 0 }
  for (const s of shipments) {
    for (const [tile, statuses] of Object.entries(TILE_STATUSES)) {
      if (statuses.includes(s.status)) tiles[tile as keyof typeof TILE_STATUSES] += 1
    }
    if (hasException(data, s)) tiles.exceptions += 1
  }
  return tiles
}

// ─── SLA: on-time delivery ─────────────────────────────────────────────────────

export interface OnTime {
  /** Shipments whose promised date has come (cancelled excluded) */
  due: number
  onTime: number
  /** Whole percent, or null when nothing was due */
  pct: number | null
}

/**
 * On-time delivery %: of the shipments whose ETA date has arrived, the share
 * delivered by the end of the ETA day. Failed deliveries, returns and anything
 * still moving past its ETA count as late.
 */
export function onTimeRate(data: DemoData, shipments: Shipment[], now: IsoDateTime): OnTime {
  let due = 0
  let onTime = 0
  for (const s of shipments) {
    if (s.status === 'cancelled') continue
    const deadline = ist(s.eta, '23:59')
    if (Date.parse(deadline) > Date.parse(now) && !['delivered', 'deliveredWithException'].includes(s.status)) continue
    due += 1
    const deliveredAt = deliveredTime(data, s.id)
    if (deliveredAt && Date.parse(deliveredAt) <= Date.parse(deadline)) onTime += 1
  }
  return { due, onTime, pct: due === 0 ? null : Math.round((onTime / due) * 100) }
}

function deliveredTime(data: DemoData, shipmentId: Id): IsoDateTime | undefined {
  return Object.values(data.events).find((e) => e.shipmentId === shipmentId && e.type === 'delivered')?.at
}

/**
 * A customer's shipments DUE in a period: promised date (end of the ETA day) falls
 * inside it. On-time delivery is measured on these, not on bookings.
 */
export function customerShipmentsDue(data: DemoData, customerId: Id, period: Period, locationId?: Id): Shipment[] {
  return Object.values(data.shipments).filter(
    (s) => s.customerId === customerId && inPeriod(ist(s.eta, '23:59'), period) && (!locationId || s.pickupLocationId === locationId),
  )
}

/** On-time % for each day of the period, by promised date (for the trend line). */
export function onTimeTrend(data: DemoData, due: Shipment[], period: Period, now: IsoDateTime): { date: IsoDate; pct: number | null }[] {
  const days: { date: IsoDate; pct: number | null }[] = []
  for (let d = istDate(period.from); d <= istDate(period.to); d = addDaysToDate(d, 1)) {
    days.push({ date: d, pct: onTimeRate(data, due.filter((s) => s.eta === d), now).pct })
  }
  return days
}

// ─── Exceptions needing action ─────────────────────────────────────────────────

export type ActionKind = 'weightRevision' | 'ndr' | 'claim'

export interface ActionItem {
  kind: ActionKind
  shipmentId: Id
  dueAt: IsoDateTime
  /** Screen that handles it: CP-20 weight, CP-21 NDR, CP-22 claim */
  screenId: 'CP-20' | 'CP-21' | 'CP-22'
  reason?: string
}

/** Hours a customer has to respond to a weight revision before it is auto-accepted (agreed assumption). */
export const WEIGHT_REVISION_RESPONSE_HOURS = 48
/** Hours to respond to a failed delivery when no exception record sets a due time (assumed). */
export const NDR_RESPONSE_HOURS = 24

export function actionsNeeded(data: DemoData, customerId: Id): ActionItem[] {
  const items: ActionItem[] = []
  const mine = (shipmentId: Id) => data.shipments[shipmentId]?.customerId === customerId

  for (const w of Object.values(data.weightRevisions)) {
    if (w.status === 'pending' && mine(w.shipmentId)) {
      items.push({ kind: 'weightRevision', shipmentId: w.shipmentId, dueAt: addHours(w.raisedAt, WEIGHT_REVISION_RESPONSE_HOURS), screenId: 'CP-20' })
    }
  }

  for (const s of Object.values(data.shipments)) {
    if (s.customerId !== customerId) continue

    if (s.status === 'undelivered') {
      const answered = Object.values(data.ndrs).some((n) => n.shipmentId === s.id && n.customerChoice)
      if (answered) continue
      const failed = latestEvent(data, s.id, 'deliveryFailed')
      const exception = Object.values(data.exceptions).find((e) => e.shipmentId === s.id && e.type === 'ndr' && e.status !== 'resolved')
      const dueAt = exception?.actionDueAt ?? (failed ? addHours(failed.at, NDR_RESPONSE_HOURS) : s.updatedAt)
      items.push({ kind: 'ndr', shipmentId: s.id, dueAt, screenId: 'CP-21', reason: failed?.reason })
    }

    // Delivered with short / damaged pieces and no claim yet: raise one within the claim window
    if (s.status === 'deliveredWithException' && !Object.values(data.claims).some((c) => c.shipmentId === s.id)) {
      const delivered = latestEvent(data, s.id, 'delivered')
      if (delivered) items.push({ kind: 'claim', shipmentId: s.id, dueAt: addDays(delivered.at, data.settings.claimWindowDays), screenId: 'CP-22' })
    }
  }

  return items.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt))
}

function latestEvent(data: DemoData, shipmentId: Id, type: string) {
  return Object.values(data.events)
    .filter((e) => e.shipmentId === shipmentId && e.type === type)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]
}

// ─── Banners ───────────────────────────────────────────────────────────────────

/** Wallet balance below which prepaid customers are warned (assumed; spec gives no figure). */
export const LOW_WALLET_THRESHOLD = 2000
export const CREDIT_WARNING_PCT = 80

export type Banner = 'walletLow' | 'creditHigh' | 'invoiceOverdue' | 'pilot'

export function banners(data: DemoData, customer: Customer): Banner[] {
  const out: Banner[] = []
  if (customer.billing === 'prepaid' && customer.walletBalance < LOW_WALLET_THRESHOLD) out.push('walletLow')
  if (customer.billing === 'credit' && customer.creditLimit > 0 && (customer.creditUsed / customer.creditLimit) * 100 > CREDIT_WARNING_PCT) out.push('creditHigh')
  if (Object.values(data.invoices).some((i) => i.customerId === customer.id && i.status === 'overdue')) out.push('invoiceOverdue')
  if (customer.status === 'pilot') out.push('pilot')
  return out
}

/** Short date label for chart axes: "23 Nov" */
export function dayLabel(date: IsoDate): string {
  const p = istParts(ist(date, '12:00'))
  return `${p.day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][p.month - 1]}`
}
