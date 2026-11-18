/**
 * SLA state for legs and shipments (ERP-05 / ERP-03 timers and the "SLA state" filter).
 * Rule (assumed, agreed): a leg is BREACHED once past its SLA time, AT RISK when
 * less than 25% of its window or under 2 hours remains, otherwise ON TRACK.
 */
import { ist } from '@shared/lib/time'
import type { DemoData, IsoDateTime, Leg, LegStatus, Shipment, ShipmentStatus } from '@shared/types'

export type SlaState = 'onTrack' | 'atRisk' | 'breached' | 'done'

const RANK: Record<SlaState, number> = { done: 0, onTrack: 1, atRisk: 2, breached: 3 }
export const AT_RISK_SHARE = 0.25
export const AT_RISK_MINUTES = 120

/** Legs whose work is finished for SLA purposes. */
export const DONE_LEG: LegStatus[] = ['handedOver', 'delivered', 'closed', 'withdrawn']
/** Shipments that no longer have an SLA running. */
export const DONE_SHIPMENT: ShipmentStatus[] = ['delivered', 'deliveredWithException', 'cancelled', 'returnToOrigin']

export function legSla(leg: Leg, now: IsoDateTime): SlaState {
  if (DONE_LEG.includes(leg.status)) return 'done'
  const left = Date.parse(leg.slaDueAt) - Date.parse(now)
  if (left < 0) return 'breached'
  const windowMs = Date.parse(leg.window.to) - Date.parse(leg.window.from)
  if (left < AT_RISK_MINUTES * 60_000 || left < windowMs * AT_RISK_SHARE) return 'atRisk'
  // A leg with a reported problem is at risk even with time left
  if (leg.status === 'exception' || leg.status === 'failedAttempt' || leg.status === 'flagged') return 'atRisk'
  return 'onTrack'
}

/** Worst state over the shipment's open legs; also breached once the ETA day has passed undelivered. */
export function shipmentSla(data: DemoData, s: Shipment, now: IsoDateTime): SlaState {
  if (DONE_SHIPMENT.includes(s.status)) return 'done'
  let worst: SlaState = 'onTrack'
  for (const id of s.legIds) {
    const st = legSla(data.legs[id], now)
    if (RANK[st] > RANK[worst]) worst = st
  }
  if (Date.parse(ist(s.eta, '23:59')) < Date.parse(now)) worst = 'breached'
  return worst
}

/** The leg currently responsible for the shipment: the first one not yet done. */
export function currentLeg(data: DemoData, s: Shipment): Leg | undefined {
  return s.legIds.map((id) => data.legs[id]).find((l) => !DONE_LEG.includes(l.status))
}
