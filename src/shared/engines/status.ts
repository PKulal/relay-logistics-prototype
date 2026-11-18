/**
 * Status engine — the ONLY place shipment and leg statuses are decided.
 * Apps add chain-of-custody events; this reducer replays them in time order
 * and returns each leg's status plus the single customer-facing shipment status.
 *
 * Mapping source: Partner App spec §8 (app events → leg status → shipment status),
 * Partner Portal spec §8 (leg statuses), Customer Portal spec §7.5 / §8.
 */
import type { ExceptionKind, Id, Leg, LegStatus, LegType, ShipmentEvent, ShipmentStatus } from '@shared/types'

export interface StatusInput {
  legs: Pick<Leg, 'id' | 'seq' | 'type'>[]
  events: ShipmentEvent[]
}

export interface StatusResult {
  shipmentStatus: ShipmentStatus
  legStatuses: Record<Id, LegStatus>
  /** Events that were not valid at the point they occurred (e.g. cancel after pickup). */
  ignoredEventIds: Id[]
}

/** Piece-level problems that make a delivery "Delivered with Exception". */
const PIECE_EXCEPTIONS: ExceptionKind[] = ['short', 'damage']

/** Statuses after which a shipment is finished and ignores further movement events. */
const TERMINAL: ShipmentStatus[] = ['delivered', 'deliveredWithException', 'cancelled']

const HUB_ARRIVAL_STATUS: Partial<Record<LegType, ShipmentStatus>> = {
  originHub: 'atOriginHub',
  destHub: 'atDestinationHub',
}

/** Sort events by time; ties keep their original (insertion) order. */
export function sortEvents(events: ShipmentEvent[]): ShipmentEvent[] {
  return events
    .map((e, i) => ({ e, i }))
    .sort((a, b) => Date.parse(a.e.at) - Date.parse(b.e.at) || a.i - b.i)
    .map(({ e }) => e)
}

export function deriveStatus({ legs, events }: StatusInput): StatusResult {
  const ordered = [...legs].sort((a, b) => a.seq - b.seq)
  const legById = new Map(ordered.map((l) => [l.id, l]))
  const legStatuses: Record<Id, LegStatus> = Object.fromEntries(ordered.map((l) => [l.id, 'offered' as LegStatus]))
  const ignoredEventIds: Id[] = []

  let status: ShipmentStatus = 'booked'
  let pieceException = false

  const previousLeg = (legId: Id) => {
    const leg = legById.get(legId)
    return leg ? ordered.find((l) => l.seq === leg.seq - 1) : undefined
  }
  const setLeg = (legId: Id | undefined, s: LegStatus) => {
    if (legId && legId in legStatuses) legStatuses[legId] = s
  }

  for (const ev of sortEvents(events)) {
    const leg = ev.legId ? legById.get(ev.legId) : undefined

    // A finished shipment only accepts bookkeeping events.
    if (TERMINAL.includes(status) && !['legClosed', 'exceptionReported', 'weightRevised'].includes(ev.type)) {
      ignoredEventIds.push(ev.id)
      continue
    }

    switch (ev.type) {
      case 'booked':
        status = 'booked'
        break

      // ── Partner Portal job handling ─────────────────────────────
      case 'legOffered':
        setLeg(ev.legId, 'offered')
        break
      case 'legAccepted':
        setLeg(ev.legId, 'accepted')
        break
      case 'legFlagged':
        setLeg(ev.legId, 'flagged')
        break
      case 'legWithdrawn':
        setLeg(ev.legId, 'withdrawn')
        break
      case 'legAssigned':
        setLeg(ev.legId, 'assigned')
        break
      case 'legUnassigned':
        setLeg(ev.legId, 'accepted') // PP-14 "Unassign": back to accepted, no staff
        break

      // ── First mile ──────────────────────────────────────────────
      case 'pickupArrived':
        break // geo-fenced arrival; no status change
      case 'pickupConfirmed':
        setLeg(ev.legId, 'inProgress')
        status = 'pickedUp'
        break
      case 'pickupFailed':
        setLeg(ev.legId, 'exception')
        status = 'booked' // pickup rescheduled
        break
      case 'weightRevised':
        break // money only; handled by WeightRevision records

      // ── Hand-overs and hubs ─────────────────────────────────────
      case 'handoverGiven':
        break // the receiving side's scan completes the hand-over
      case 'handoverReceived': {
        // legId = the RECEIVING leg. The previous leg is now handed over.
        const prev = ev.legId ? previousLeg(ev.legId) : undefined
        if (prev) setLeg(prev.id, 'handedOver')
        if (leg && HUB_ARRIVAL_STATUS[leg.type]) {
          setLeg(leg.id, 'inProgress')
          status = HUB_ARRIVAL_STATUS[leg.type]!
        }
        // Receivers that are vehicles (line-haul, last mile) start with their own event.
        break
      }
      case 'hubInScan':
      case 'bagSealed':
      case 'hubOutScan':
        setLeg(ev.legId, 'inProgress')
        if (leg && HUB_ARRIVAL_STATUS[leg.type]) status = HUB_ARRIVAL_STATUS[leg.type]!
        break

      // ── Line-haul ───────────────────────────────────────────────
      case 'tripStarted':
        setLeg(ev.legId, 'inProgress')
        status = 'inTransit'
        break
      case 'haltReported':
        if (ev.etaAtRisk) setLeg(ev.legId, 'exception')
        break // shipment stays In Transit; ETA may be revised
      case 'tripArrived':
        break // hand-over at the destination hub follows

      // ── Last mile ───────────────────────────────────────────────
      case 'runStarted':
        setLeg(ev.legId, 'inProgress')
        status = 'outForDelivery'
        break
      case 'delivered':
        setLeg(ev.legId, 'delivered')
        status = pieceException ? 'deliveredWithException' : 'delivered'
        break
      case 'deliveryFailed':
        setLeg(ev.legId, 'failedAttempt')
        status = 'undelivered'
        break
      case 'reattemptScheduled':
        setLeg(ev.legId, 'assigned')
        break // stays Undelivered until the next run starts

      // ── Exceptions and terminal actions ────────────────────────
      case 'exceptionReported':
        setLeg(ev.legId, 'exception')
        if (ev.exceptionKind && PIECE_EXCEPTIONS.includes(ev.exceptionKind)) pieceException = true
        break
      case 'rtoInitiated':
        status = 'returnToOrigin'
        break
      case 'cancelled':
        // Cancellation is allowed only while Booked (Customer Portal spec §7.5).
        if (status !== 'booked') {
          ignoredEventIds.push(ev.id)
          break
        }
        for (const l of ordered) legStatuses[l.id] = 'withdrawn'
        status = 'cancelled'
        break
      case 'legClosed':
        setLeg(ev.legId, 'closed')
        break
    }
  }

  return { shipmentStatus: status, legStatuses, ignoredEventIds }
}

/** True when the customer may still cancel. */
export const canCancel = (status: ShipmentStatus) => status === 'booked'
