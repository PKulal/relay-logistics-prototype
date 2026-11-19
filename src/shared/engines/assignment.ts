/**
 * Partner assignment — ERP spec §7.1, Partner Portal spec §7.5 (source §8).
 * Per leg:
 *  1. Eligibility: registered for the leg's pincodes / lane / hub, offers the
 *     service, active, and within today's declared capacity
 *     (Bronze partners are capped at 50% of capacity — seed-data.md §9).
 *  2. Ranking: score ↓, then cost ↑, then transit time ↑.
 *  3. Auto-assign the top partner. (Control Tower can override later.)
 */
import { istDate } from '@shared/lib/time'
import type { DemoData, Id, IsoDate, Lane, LegType, Partner, PartnerRateLine, Pincode, Service, ServiceKind } from '@shared/types'
import { round2 } from './money'

export type SkipReason = 'notActive' | 'noCoverage' | 'serviceNotOffered' | 'noRate' | 'atCapacity'

export interface Candidate {
  partnerId: Id
  score: number
  cost: number
  transitDays: number
  eligible: boolean
  reason?: SkipReason
}

export interface LegPlan {
  type: LegType
  partnerId: Id
  cost: number
  rateLineId: Id
  /** Every partner considered for the leg, ranked; skipped ones carry a reason (for the ERP's "why"). */
  candidates: Candidate[]
}

export interface AssignmentInput {
  pattern: LegType[]
  origin: Pincode
  dest: Pincode
  lane?: Lane
  serviceKind: ServiceKind
  service: Service
  chargeableKg: number
  pieces: number
  /** Day the work happens (pickup date) — capacity is counted per day */
  date: IsoDate
}

/** Active statuses that can receive work. Trial partners run their monitored trial trips. */
const ACTIVE: Partner['status'][] = ['live', 'trial', 'probation']

/** Cost of one leg from a partner rate line. */
export function legCost(rate: PartnerRateLine, kg: number, pieces: number): number {
  switch (rate.unit) {
    case 'perShipment':
    case 'perTrip':
      return rate.rate
    case 'perKg': {
      const billedKg = Math.max(kg, rate.minKg ?? 0)
      return round2(Math.max(billedKg * rate.rate, rate.minimum ?? 0))
    }
    case 'perPiece':
      return round2(Math.max(pieces * rate.rate, rate.minimum ?? 0))
    case 'storagePerDay':
      return rate.rate
  }
}

/** Where the leg happens, as used by coverage and rate lines. */
function legPlace(type: LegType, i: AssignmentInput): string | undefined {
  switch (type) {
    case 'firstMile':
      return i.origin.hubId
    case 'lastMile':
      return i.dest.hubId
    case 'originHub':
      return i.origin.hubId
    case 'destHub':
      return i.dest.hubId
    case 'lineHaul':
      return i.lane?.id
  }
}

function covers(p: Partner, type: LegType, i: AssignmentInput): boolean {
  switch (type) {
    case 'firstMile':
      return p.coveragePincodes.includes(i.origin.code)
    case 'lastMile':
      return p.coveragePincodes.includes(i.dest.code)
    case 'originHub':
      return !!i.origin.hubId && p.hubIds.includes(i.origin.hubId)
    case 'destHub':
      return !!i.dest.hubId && p.hubIds.includes(i.dest.hubId)
    case 'lineHaul':
      return !!i.lane && p.laneIds.includes(i.lane.id)
  }
}

/** Jobs a partner already has on a day: outside work (baseLoadToday) + modelled legs that day. */
export function partnerLoad(data: DemoData, partnerId: Id, date: IsoDate): number {
  const partner = data.partners[partnerId]
  let load = partner.baseLoadToday
  for (const leg of Object.values(data.legs)) {
    if (leg.partnerId === partnerId && leg.status !== 'withdrawn' && istDate(leg.window.from) === date) load += 1
  }
  return load
}

/**
 * Capacity after tier consequences (source §5.3): Bronze is capped at its
 * declared capacity; a partner whose score falls below Bronze (Probation) has
 * its volume cut by 50%.
 */
export function effectiveCapacity(p: Partner, probationCutPct: number): number {
  return p.tier === 'probation' ? Math.floor((p.capacityPerDay * (100 - probationCutPct)) / 100) : p.capacityPerDay
}

export function rankCandidates(data: DemoData, type: LegType, i: AssignmentInput): Candidate[] {
  const place = legPlace(type, i)
  const transit = type === 'lineHaul' && i.lane ? i.lane.transitDays[i.service] : 0
  const rates = Object.values(data.partnerRates)

  const candidates = Object.values(data.partners)
    .filter((p) => p.legs.includes(type))
    .map((p): Candidate & { rateLineId?: Id } => {
      const base = { partnerId: p.id, score: p.score, transitDays: transit }
      // A destination-specific line (destCity) wins over the lane's general line for drops in that city
      const lines = rates.filter(
        (r) => r.partnerId === p.id && r.legType === type && r.laneOrCluster === place && (!r.serviceKind || r.serviceKind === i.serviceKind) && (!r.destCity || r.destCity === i.dest.city),
      )
      const rate = lines.find((r) => r.destCity) ?? lines[0]
      const cost = rate ? legCost(rate, i.chargeableKg, i.pieces) : 0
      const skip = (reason: SkipReason) => ({ ...base, cost, eligible: false, reason })

      if (!covers(p, type, i)) return skip('noCoverage')
      if (!ACTIVE.includes(p.status)) return skip('notActive')
      if (!p.services.includes(i.service)) return skip('serviceNotOffered')
      if (!rate) return skip('noRate')
      if (partnerLoad(data, p.id, i.date) >= effectiveCapacity(p, data.settings.probationVolumeCutPct)) return skip('atCapacity')
      return { ...base, cost, eligible: true, rateLineId: rate.id }
    })
    // Partners that don't cover this place are noise for the "why" list.
    .filter((c) => c.reason !== 'noCoverage')

  return candidates.sort(
    (a, b) => Number(b.eligible) - Number(a.eligible) || b.score - a.score || a.cost - b.cost || a.transitDays - b.transitDays,
  )
}

export class NoPartnerError extends Error {
  readonly legType: LegType
  constructor(legType: LegType) {
    super(`No eligible partner for the ${legType} leg`)
    this.legType = legType
  }
}

/** Plan every leg of a shipment. Throws NoPartnerError if a leg has no eligible partner. */
export function planAssignment(data: DemoData, input: AssignmentInput): LegPlan[] {
  return input.pattern.map((type) => {
    const candidates = rankCandidates(data, type, input) as (Candidate & { rateLineId?: Id })[]
    const top = candidates[0]
    if (!top?.eligible || !top.rateLineId) throw new NoPartnerError(type)
    return {
      type,
      partnerId: top.partnerId,
      cost: top.cost,
      rateLineId: top.rateLineId,
      candidates: candidates.map(({ rateLineId: _drop, ...c }) => c),
    }
  })
}
