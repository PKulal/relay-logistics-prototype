/**
 * Auto-tickets (source §10 Step 1 "Exception detected … AI classifies the root
 * cause"; Step 2 "Ticket created … owner = responsible leg partner + Logisco
 * desk"; Step 3 action targets). Detected here: pickup missed, ETA breach
 * (delay) and e-way bill near expiry. Tickets raised in the apps (NDR, seal
 * mismatch, short, damage, breakdown) come from their own actions.
 */
import { addHours, istDate } from '@shared/lib/time'
import type { DemoData, ExceptionKind, Id, IsoDateTime, Leg, RootCause, ShipmentException } from '@shared/types'
import { JOBS_PER_WINDOW } from './controlTower'
import { currentLeg, DONE_SHIPMENT, legSla } from './sla'

/** Action targets (source §10 Step 3; delay and e-way bill assumed). */
export const ACTION_HOURS: Partial<Record<ExceptionKind, number>> = { pickupMissed: 2, sealMismatch: 4, short: 4, excess: 4, damage: 4, delay: 2, breakdown: 2 }
/** E-way bills expiring within this many hours are ticketed. */
export const EWB_WARN_HOURS = 24

const PRE_PICKUP = ['offered', 'accepted', 'flagged', 'assigned']

/** SIMULATED AI root cause for a leg-level delay. */
function causeOf(data: DemoData, leg: Leg): RootCause {
  if (leg.type === 'firstMile') {
    // The rider's load in that window (all jobs given to them for it, done or not)
    const busy = leg.staffId && Object.values(data.legs).filter((l) => l.staffId === leg.staffId && l.status !== 'withdrawn' && l.window.from === leg.window.from).length > JOBS_PER_WINDOW
    if (!PRE_PICKUP.includes(leg.status)) return 'pickupDelay' // collected, not yet handed to the hub
    return busy ? 'partnerCapacity' : 'partnerNoShow'
  }
  if (leg.type === 'lineHaul') return data.trips[leg.tripId ?? '']?.halts.some((h) => h.breakdown) ? 'vehicle' : 'lineHaulDelay'
  if (leg.type === 'lastMile') return leg.status === 'failedAttempt' ? 'consignee' : 'lastMileDelay'
  return 'hubDwell'
}

/** Open tickets of a type for a shipment. */
const hasOpen = (data: DemoData, lr: Id, type: ExceptionKind) => Object.values(data.exceptions).some((x) => x.shipmentId === lr && x.type === type && x.status !== 'resolved')

/** New tickets to raise now (one open ticket per shipment and type). */
export function detectExceptions(data: DemoData, now: IsoDateTime): Omit<ShipmentException, 'id'>[] {
  const out: Omit<ShipmentException, 'id'>[] = []
  for (const s of Object.values(data.shipments)) {
    if (DONE_SHIPMENT.includes(s.status) || s.status === 'cancelled') continue
    const leg = currentLeg(data, s)
    const base = { shipmentId: s.id, status: 'open' as const, customerConfirmed: false, auto: true }

    // Pickup missed: the pickup window is over and nothing was picked up (§10: reassign within 2 h)
    if (leg?.type === 'firstMile' && PRE_PICKUP.includes(leg.status) && Date.parse(leg.window.to) < Date.parse(now) && !hasOpen(data, s.id, 'pickupMissed')) {
      out.push({ ...base, legId: leg.id, type: 'pickupMissed', raisedAt: leg.window.to, actionDueAt: addHours(leg.window.to, ACTION_HOURS.pickupMissed!), ownerPartnerId: leg.partnerId, aiCause: causeOf(data, leg) })
    } else if (leg && s.status !== 'undelivered' && legSla(leg, now) === 'breached' && !hasOpen(data, s.id, 'delay') && !hasOpen(data, s.id, 'pickupMissed')) {
      // ETA breach on the leg in charge (§10: new ETA to the customer)
      out.push({ ...base, legId: leg.id, type: 'delay', raisedAt: leg.slaDueAt, actionDueAt: addHours(leg.slaDueAt, ACTION_HOURS.delay!), ownerPartnerId: leg.partnerId, aiCause: causeOf(data, leg) })
    }

    // E-way bill near expiry (§10: extension prompt or Part B update)
    if (s.ewb && !hasOpen(data, s.id, 'ewbExpiry')) {
      const expiresAt = `${s.ewb.validTill}T23:59:00+05:30`
      if (Date.parse(expiresAt) - Date.parse(now) <= EWB_WARN_HOURS * 3_600_000) {
        out.push({ ...base, legId: leg?.id, type: 'ewbExpiry', raisedAt: addHours(expiresAt, -EWB_WARN_HOURS), actionDueAt: expiresAt, ownerPartnerId: leg?.partnerId, aiCause: 'longTransit' })
      }
    }
  }
  return out
}

/** Today's date helper for screens (tickets raised today). */
export const raisedToday = (x: ShipmentException, now: IsoDateTime) => istDate(x.raisedAt) === istDate(now)
