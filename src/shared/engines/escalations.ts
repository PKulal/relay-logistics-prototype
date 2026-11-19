/**
 * Partner escalations (source §5.1: tickets land in the partner's inbox with a
 * response timer; a missed timer reduces the score; §5.2 Responsiveness 10%).
 * Every ticket owned by a partner is an escalation: auto-tickets, PA-18 pickup
 * failures, PA-30 hub reports, NDRs and injected demo tickets.
 */
import { addHours, minutesBetween } from '@shared/lib/time'
import type { DemoData, Id, IsoDateTime, ShipmentException } from '@shared/types'

/** Default acknowledgement time when the partner's agreement doesn't set one (seeded agreements use 2 hours). */
export const DEFAULT_ACK_HOURS = 2
/** Timers turn amber under this many minutes (PP-20). */
export const AMBER_MINUTES = 30

export const PIPELINE = ['new', 'acknowledged', 'resolved', 'closed'] as const
export type EscalationStatus = (typeof PIPELINE)[number]

export function ackHours(data: DemoData, partnerId: Id): number {
  const app = Object.values(data.applications).find((a) => a.partnerId === partnerId && a.agreement)
  return app?.agreement?.ticketAckHours ?? DEFAULT_ACK_HOURS
}

export const ackDueAt = (data: DemoData, x: ShipmentException) => x.partner?.ackDueAt ?? addHours(x.raisedAt, ackHours(data, x.ownerPartnerId!))

export function escalationStatus(x: ShipmentException): EscalationStatus {
  if (x.status === 'resolved') return 'closed'
  if (x.partner?.resolvedAt) return 'resolved'
  if (x.partner?.ackAt) return 'acknowledged'
  return 'new'
}

export interface Escalation {
  x: ShipmentException
  status: EscalationStatus
  ackDueAt: IsoDateTime
  /** Minutes left; negative when missed. Undefined once done. */
  ackLeft?: number
  resolveLeft?: number
}

/** PP-20 inbox: open first, most urgent timer first. */
export function escalationsFor(data: DemoData, partnerId: Id, now: IsoDateTime): Escalation[] {
  return Object.values(data.exceptions)
    .filter((x) => x.ownerPartnerId === partnerId)
    .map((x) => {
      const status = escalationStatus(x)
      const due = ackDueAt(data, x)
      return {
        x,
        status,
        ackDueAt: due,
        ackLeft: status === 'new' ? minutesBetween(now, due) : undefined,
        resolveLeft: status === 'new' || status === 'acknowledged' ? minutesBetween(now, x.actionDueAt) : undefined,
      }
    })
    .sort((a, b) => PIPELINE.indexOf(a.status) - PIPELINE.indexOf(b.status) || (a.ackLeft ?? a.resolveLeft ?? 0) - (b.ackLeft ?? b.resolveLeft ?? 0) || b.x.raisedAt.localeCompare(a.x.raisedAt))
}

/** Responsiveness inputs for scoring (Phase 5): acknowledged and resolved within SLA. */
export function responsiveness(data: DemoData, partnerId: Id) {
  const mine = Object.values(data.exceptions).filter((x) => x.ownerPartnerId === partnerId && x.partner?.ackAt)
  const ackOnTime = mine.filter((x) => x.partner!.ackAt! <= ackDueAt(data, x)).length
  const resolved = mine.filter((x) => x.partner?.resolvedAt)
  return { tickets: mine.length, ackOnTime, resolvedOnTime: resolved.filter((x) => x.partner!.resolvedAt! <= x.actionDueAt).length }
}

/** Ticket kinds the customer never sees (partner-internal). */
export const INTERNAL_KINDS: ShipmentException['type'][] = ['missedScan']

export const activeSos = (alerts: DemoData['sosAlerts']) => Object.values(alerts).filter((a) => a.status === 'active').sort((a, b) => b.at.localeCompare(a.at))
