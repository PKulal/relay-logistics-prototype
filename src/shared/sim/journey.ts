/**
 * SIMULATED: moves a booked shipment along its legs by writing the
 * chain-of-custody events the partner apps would have produced, timed from the
 * leg windows. Used by the seed (background shipments) and later by the demo
 * toolbar's "advance time". Live demo actions (PA screens) add real events instead.
 *
 * Statuses are never set here: events go through applyEvents → status engine.
 */
import { addHours, addMinutes, isBefore } from '@shared/lib/time'
import { applyEvents } from '@shared/store/actions'
import { eventIdFactory } from '@shared/store/booking'
import type { AppKey, DemoData, FieldRole, Id, IsoDateTime, Leg, LegType, ShipmentEvent } from '@shared/types'

export type Outcome = 'normal' | 'ndr' | 'short' | 'cancel' | 'pickupFailed' | 'rto'

export interface JourneyOptions {
  /** Only events at or before this time are written (usually demoNow). */
  until: IsoDateTime
  outcome?: Outcome
  /** Override who gets each leg, by leg seq (e.g. { 1: 'FS-RAVI' }) */
  assignees?: Partial<Record<number, Id>>
  /** Reason codes */
  ndrReason?: string
  pickupFailReason?: string
  /** Pieces found missing (outcome "short"); defaults to the last piece */
  shortPieceIds?: Id[]
  /** Close legs for payout this many days after delivery (0 = never) */
  closeAfterDays?: number
}

const ROLE_FOR: Record<LegType, FieldRole> = {
  firstMile: 'rider',
  lastMile: 'rider',
  originHub: 'hub',
  destHub: 'hub',
  lineHaul: 'driver',
}

export function defaultAssignee(data: DemoData, leg: Leg): Id | undefined {
  return Object.values(data.fieldStaff).find((s) => s.partnerId === leg.partnerId && s.role === ROLE_FOR[leg.type])?.id
}

/** The partner office user who accepts jobs: Operations if there is one, else Admin. */
export function partnerOpsUser(data: DemoData, partnerId: Id): Id {
  const users = Object.values(data.partnerUsers).filter((u) => u.partnerId === partnerId)
  return (users.find((u) => u.role === 'operations') ?? users.find((u) => u.role === 'admin'))?.id ?? 'system'
}

type Step = Omit<ShipmentEvent, 'id' | 'shipmentId' | 'app' | 'by'> & { by?: Id; app?: AppKey }

export function journeyEvents(data: DemoData, shipmentId: Id, opts: JourneyOptions): ShipmentEvent[] {
  const s = data.shipments[shipmentId]
  const legs = s.legIds.map((id) => data.legs[id])
  const outcome = opts.outcome ?? 'normal'
  const steps: Step[] = []

  const staffOf = (leg: Leg) => opts.assignees?.[leg.seq] ?? defaultAssignee(data, leg)
  const vehicleOf = (staffId?: Id) => (staffId ? data.fieldStaff[staffId]?.vehicleId : undefined)
  const act = (leg: Leg, type: ShipmentEvent['type'], at: IsoDateTime, extra: Partial<Step> = {}) =>
    steps.push({ legId: leg.id, type, at, by: staffOf(leg) ?? partnerOpsUser(data, leg.partnerId), app: 'partnerApp', ...extra })
  const assign = (leg: Leg, at: IsoDateTime) => {
    const staffId = staffOf(leg)
    if (staffId) {
      act(leg, 'legAssigned', at, { by: partnerOpsUser(data, leg.partnerId), app: 'partnerPortal', assigneeStaffId: staffId, assigneeVehicleId: vehicleOf(staffId) })
    }
  }
  const allPieces = s.pieces.map((p) => p.id)

  // Partners accept their jobs soon after booking.
  legs.forEach((leg, i) =>
    act(leg, 'legAccepted', addMinutes(s.bookedAt, 8 + i * 2), { by: partnerOpsUser(data, leg.partnerId), app: 'partnerPortal' }),
  )

  if (outcome === 'cancel') {
    steps.push({ type: 'cancelled', at: addMinutes(s.bookedAt, 40), by: s.bookedByUserId, app: 'customer', note: 'Order cancelled by consignee' })
    return finish(steps)
  }

  const [first, ...rest] = legs
  const last = legs[legs.length - 1]
  const hub1 = legs.find((l) => l.type === 'originHub')
  const truck = legs.find((l) => l.type === 'lineHaul')
  const hub2 = legs.find((l) => l.type === 'destHub')

  // ── First mile
  assign(first, addMinutes(s.bookedAt, 25))
  act(first, 'pickupArrived', addMinutes(first.window.from, 20))
  if (outcome === 'pickupFailed') {
    act(first, 'pickupFailed', addMinutes(first.window.from, 35), { reason: opts.pickupFailReason ?? 'Goods not ready' })
    return finish(steps)
  }
  const pickedAt = addMinutes(first.window.from, 40)
  act(first, 'pickupConfirmed', pickedAt, { pieceIds: allPieces })

  // ── Origin hub
  let pieceIds = allPieces
  let handedAt = addMinutes(first.window.to, 60)
  if (hub1) {
    act(first, 'handoverGiven', handedAt, { pieceIds })
    act(hub1, 'handoverReceived', addMinutes(handedAt, 5), { pieceIds, counterpartStaffId: staffOf(first) })
    act(hub1, 'hubInScan', addMinutes(handedAt, 10), { pieceIds })
    const sealAt = truck ? addHours(hub1.window.to, -2) : addHours(handedAt, 2)
    if (outcome === 'short') {
      const missing = opts.shortPieceIds ?? [allPieces[allPieces.length - 1]]
      pieceIds = allPieces.filter((p) => !missing.includes(p))
      act(hub1, 'exceptionReported', addMinutes(sealAt, -10), {
        exceptionKind: 'short',
        pieceIds: missing,
        note: `${allPieces.length} in, ${pieceIds.length} sealed out`,
      })
    }
    act(hub1, 'bagSealed', sealAt, { pieceIds, sealNos: [sealFor(s.id)] })
    handedAt = hub1.window.to
  }

  // ── Line-haul
  if (truck && hub2) {
    assign(truck, addHours(truck.window.from, -3))
    act(truck, 'handoverReceived', addHours(truck.window.from, -1), { pieceIds, sealNos: [sealFor(s.id)], counterpartStaffId: hub1 && staffOf(hub1) })
    act(truck, 'tripStarted', truck.window.from, { vehicleNo: vehicleOf(staffOf(truck)) })
    act(truck, 'tripArrived', addMinutes(truck.window.to, -30))
    act(hub2, 'handoverReceived', truck.window.to, { pieceIds, sealNos: [sealFor(s.id)], counterpartStaffId: staffOf(truck) })
    act(hub2, 'hubInScan', addMinutes(truck.window.to, 10), { pieceIds })
    handedAt = addMinutes(hub2.window.to, -20)
  } else if (!hub1) {
    handedAt = addMinutes(first.window.to, 60)
  } else {
    handedAt = addMinutes(hub1.window.to, -20)
  }

  // ── Last mile
  if (rest.length > 0) {
    assign(last, addHours(last.window.from, -2))
    const giver = hub2 ?? hub1 ?? first
    act(last, 'handoverReceived', handedAt, { pieceIds, counterpartStaffId: staffOf(giver) })
    act(last, 'runStarted', last.window.from)
    if (outcome === 'ndr' || outcome === 'rto') {
      act(last, 'deliveryFailed', addMinutes(last.window.from, 120), { reason: opts.ndrReason ?? 'Consignee not available' })
      if (outcome === 'rto') steps.push({ legId: last.id, type: 'rtoInitiated', at: addHours(last.window.from, 26), by: s.bookedByUserId, app: 'customer' })
      return finish(steps)
    }
    const deliveredAt = addMinutes(last.window.from, 70)
    act(last, 'delivered', deliveredAt, { pieceIds, receivedBy: data.consignees[s.consigneeId].contact })
    if (opts.closeAfterDays) {
      for (const leg of legs) {
        steps.push({ legId: leg.id, type: 'legClosed', at: addHours(deliveredAt, 24 * opts.closeAfterDays), by: 'LS-LAKSHMI', app: 'erp' })
      }
    }
  }
  return finish(steps)

  function finish(list: Step[]): ShipmentEvent[] {
    const newId = eventIdFactory(data, shipmentId)
    return list
      .filter((st) => !isBefore(opts.until, st.at))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
      .map((st) => ({ ...st, id: newId(), shipmentId, by: st.by ?? 'system', app: st.app ?? 'partnerApp' }))
  }
}

/** Seal numbers SL-##### derived from the LR (seed-data.md §2 format). */
export function sealFor(lr: string): string {
  if (lr === 'LGS-DEL-000781') return 'SL-44817' // hero (seed-data.md §3)
  return `SL-${String(40000 + (Number(lr.slice(-6)) * 7) % 10000).padStart(5, '0')}`
}

/** Write a shipment's journey up to `opts.until`. */
export function runJourney(data: DemoData, shipmentId: Id, opts: JourneyOptions): DemoData {
  return applyEvents(data, journeyEvents(data, shipmentId, opts), opts.until)
}
