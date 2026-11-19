/**
 * Operations Control Tower (source §8 "Manual Override: Control Tower can
 * override any leg"; §11.1 "SLA Timers: AI ranks the 20 shipments most likely
 * to fail today"; §12 ETA & SLA breach prediction): reassign options (ERP-08)
 * and the SIMULATED risk model (ERP-06).
 */
import { istDate, minutesBetween } from '@shared/lib/time'
import type { DemoData, Id, IsoDateTime, Leg, LegStatus, Shipment } from '@shared/types'
import { effectiveCapacity, partnerLoad, rankCandidates, type AssignmentInput, type Candidate } from './assignment'
import { findLane } from './quote'
import { currentLeg, DONE_SHIPMENT, legSla } from './sla'

/** Legs that can still move to another partner: nothing picked up or started on them yet. */
const BEFORE_START: LegStatus[] = ['offered', 'accepted', 'flagged', 'assigned']
/** Before work starts, or a first-mile leg whose pickup failed (PA-18; source §10: reassign within 2 hours). */
export const canReassign = (leg: Leg) => BEFORE_START.includes(leg.status) || (leg.type === 'firstMile' && leg.status === 'exception')

/** The assignment engine's input for one leg of a booked shipment. */
export function assignmentInputFor(data: DemoData, s: Shipment, leg: Leg): AssignmentInput {
  const origin = data.pincodes[s.originPincode]
  const dest = data.pincodes[s.destPincode]
  return {
    pattern: s.legIds.map((id) => data.legs[id].type),
    origin,
    dest,
    lane: findLane(data, origin, dest),
    serviceKind: s.serviceKind,
    service: s.service,
    chargeableKg: s.weights.verifiedChargeable ?? s.weights.chargeable,
    pieces: s.pieces.length,
    date: istDate(leg.window.from),
  }
}

export interface ReassignOption extends Candidate {
  current: boolean
  /** Jobs still free today against effective capacity */
  capacityLeft: number
  /** Cost against the current partner's cost on this leg */
  costDiff: number
}

/** ERP-08: the engine's ranking for this leg (score ↓, cost ↑, transit ↑), with capacity and cost difference. */
export function reassignOptions(data: DemoData, legId: Id): ReassignOption[] {
  const leg = data.legs[legId]
  const s = data.shipments[leg.shipmentId]
  const input = assignmentInputFor(data, s, leg)
  return rankCandidates(data, leg.type, input).map((c) => {
    const p = data.partners[c.partnerId]
    const current = c.partnerId === leg.partnerId
    const capacityLeft = effectiveCapacity(p, data.settings.probationVolumeCutPct) - partnerLoad(data, p.id, input.date)
    return { ...c, current, capacityLeft, costDiff: Math.round((c.cost - leg.cost) * 100) / 100, eligible: c.eligible || current }
  })
}

/** Best eligible partner other than the current one. */
export const bestBackup = (data: DemoData, legId: Id) => reassignOptions(data, legId).find((o) => !o.current && o.eligible)

// ─── ERP-06 SLA risk (SIMULATED AI) ───────────────────────────────────────────

/** Jobs one rider / driver can do in one time window before the rest slip (assumed). */
export const JOBS_PER_WINDOW = 3

export type RiskReason =
  | { code: 'staffLoad'; staffId: Id; pending: number }
  | { code: 'timeLeft'; minutes: number }
  | { code: 'partnerScore'; score: number }
  | { code: 'tripHalt'; minutes: number }
  | { code: 'notAccepted'; status: LegStatus }

export type RiskAction = { kind: 'reassign'; partnerId: Id } | { kind: 'callPartner' } | { kind: 'informCustomer' }

export interface SlaRisk {
  shipmentId: Id
  legId: Id
  /** 0–100 */
  risk: number
  reasons: RiskReason[]
  action: RiskAction
}

/** Pending jobs of the same person in the same day and window as this one. */
function sameWindowLoad(data: DemoData, leg: Leg): number {
  if (!leg.staffId) return 0
  const day = istDate(leg.window.from)
  return Object.values(data.legs).filter((l) => l.staffId === leg.staffId && (l.status === 'assigned' || l.status === 'accepted') && istDate(l.window.from) === day && l.window.from === leg.window.from).length
}

const timeFactor = (minutes: number) => (minutes <= 60 ? 0.5 : minutes <= 120 ? 0.35 : minutes <= 240 ? 0.25 : minutes <= 480 ? 0.1 : 0.03)

/** Risk of one open leg missing its SLA, with the factors behind it. */
export function legRisk(data: DemoData, leg: Leg, now: IsoDateTime): { risk: number; reasons: { r: RiskReason; p: number }[] } {
  const factors: { r: RiskReason; p: number }[] = []
  const load = sameWindowLoad(data, leg)
  if (load > JOBS_PER_WINDOW) factors.push({ r: { code: 'staffLoad', staffId: leg.staffId!, pending: load }, p: Math.min(0.7, 0.2 * (load - JOBS_PER_WINDOW)) })
  const minutes = minutesBetween(now, leg.slaDueAt)
  factors.push({ r: { code: 'timeLeft', minutes }, p: timeFactor(minutes) })
  const score = data.partners[leg.partnerId].score
  if (score < 85) factors.push({ r: { code: 'partnerScore', score }, p: (85 - score) / 100 })
  if (leg.status === 'offered' || leg.status === 'flagged') factors.push({ r: { code: 'notAccepted', status: leg.status }, p: leg.status === 'flagged' ? 0.4 : 0.15 })
  const trip = leg.tripId ? data.trips[leg.tripId] : undefined
  const halt = trip?.halts.at(-1)
  if (trip?.status === 'inTransit' && halt && (halt.breakdown || halt.minutes >= 60)) factors.push({ r: { code: 'tripHalt', minutes: halt.minutes }, p: halt.breakdown ? 0.6 : 0.35 })
  const risk = 1 - factors.reduce((keep, f) => keep * (1 - f.p), 1)
  return { risk: Math.round(risk * 100 + 1e-9), reasons: factors.sort((a, b) => b.p - a.p) }
}

/**
 * The 20 open legs most likely to miss their SLA today. Already-breached legs
 * are tickets (ERP-07), not predictions; dismissed suggestions are hidden for
 * the day.
 */
export function slaRisks(data: DemoData, now: IsoDateTime, limit = 20): SlaRisk[] {
  const today = istDate(now)
  const out: SlaRisk[] = []
  for (const s of Object.values(data.shipments)) {
    if (DONE_SHIPMENT.includes(s.status) || s.status === 'undelivered') continue
    const leg = currentLeg(data, s)
    if (!leg || legSla(leg, now) === 'breached' || istDate(leg.slaDueAt) > today) continue
    const d = data.riskDismissals[leg.id]
    if (d && istDate(d.at) === today) continue
    const { risk, reasons } = legRisk(data, leg, now)
    const top = reasons[0]?.r.code
    const backup = canReassign(leg) && (top === 'staffLoad' || top === 'notAccepted' || top === 'partnerScore') ? bestBackup(data, leg.id) : undefined
    const action: RiskAction = backup ? { kind: 'reassign', partnerId: backup.partnerId } : top === 'tripHalt' ? { kind: 'informCustomer' } : { kind: 'callPartner' }
    out.push({ shipmentId: s.id, legId: leg.id, risk, reasons: reasons.slice(0, 2).map((f) => f.r), action })
  }
  return out.sort((a, b) => b.risk - a.risk || Date.parse(data.legs[a.legId].slaDueAt) - Date.parse(data.legs[b.legId].slaDueAt) || b.shipmentId.localeCompare(a.shipmentId)).slice(0, limit)
}
