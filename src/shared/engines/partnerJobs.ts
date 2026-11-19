/**
 * Partner-side view of legs (jobs): Partner Portal PP-11 to PP-14.
 * Pure functions over the shared data.
 */
import { addMinutes, istDate } from '@shared/lib/time'
import type { DemoData, FieldStaff, Id, IsoDate, IsoDateTime, Leg, LegStatus, LegType, Partner, Shipment, Tier } from '@shared/types'
import { effectiveCapacity, partnerLoad } from './assignment'
import { legSla } from './sla'

// ─── Job types and inbox tabs ──────────────────────────────────────────────────

export type JobType = 'pickup' | 'hubOutbound' | 'lineHaul' | 'hubInbound' | 'delivery'

/** Origin hub consolidates and dispatches (outbound); destination hub receives and de-consolidates (inbound). */
export const JOB_TYPE: Record<LegType, JobType> = {
  firstMile: 'pickup',
  originHub: 'hubOutbound',
  lineHaul: 'lineHaul',
  destHub: 'hubInbound',
  lastMile: 'delivery',
}

export type JobTab = 'offered' | 'accepted' | 'assigned' | 'inProgress' | 'completed' | 'flagged'
export const JOB_TABS: JobTab[] = ['offered', 'accepted', 'assigned', 'inProgress', 'completed', 'flagged']

const TAB_OF: Record<LegStatus, JobTab> = {
  offered: 'offered',
  accepted: 'accepted',
  assigned: 'assigned',
  inProgress: 'inProgress',
  exception: 'inProgress',
  failedAttempt: 'inProgress',
  handedOver: 'completed',
  delivered: 'completed',
  closed: 'completed',
  flagged: 'flagged',
  withdrawn: 'flagged',
}
export const jobTab = (leg: Leg): JobTab => TAB_OF[leg.status]

export function partnerLegs(data: DemoData, partnerId: Id): Leg[] {
  return Object.values(data.legs).filter((l) => l.partnerId === partnerId)
}

// ─── Acceptance timer ──────────────────────────────────────────────────────────

/** When the job was (last) offered to the partner. */
export function offeredAt(data: DemoData, leg: Leg): IsoDateTime {
  const offers = Object.values(data.events).filter((e) => e.legId === leg.id && e.type === 'legOffered')
  return offers.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0]?.at ?? leg.updatedAt
}

/**
 * Accept-by time: offered + acceptance timer (30 min, ERP-44). In the prototype an
 * overdue job is NOT withdrawn automatically (agreed); it shows as overdue until the
 * Control Tower reassigns it (ERP-08, Phase 4).
 */
export function acceptBy(data: DemoData, leg: Leg): IsoDateTime {
  return addMinutes(offeredAt(data, leg), data.settings.partnerAcceptanceMinutes)
}

// ─── What the partner sees about a job ────────────────────────────────────────

export interface JobEnd {
  /** Company or hub name */
  name: string
  /** Area / city and pincode, or a hub's address */
  place: string
  pincode?: string
}

/**
 * From → to for a job. Only the partner's own pickup (shipper) or delivery
 * (consignee) leg reveals those parties; other legs see hubs and cities only
 * (PP-12 masking rule). The customer's price is never part of a job.
 */
export function jobEnds(data: DemoData, leg: Leg, s: Shipment): { from: JobEnd; to: JobEnd } {
  const origin = data.pincodes[s.originPincode]
  const dest = data.pincodes[s.destPincode]
  const hubEnd = (hubId?: string): JobEnd => {
    const h = hubId ? data.hubs[hubId] : undefined
    return h ? { name: h.name, place: h.address, pincode: h.pincode } : { name: '—', place: '' }
  }
  const city = (p: typeof origin): JobEnd => ({ name: p.city, place: `${p.area}, ${p.city}`, pincode: p.code })
  switch (leg.type) {
    case 'firstMile': {
      const loc = data.pickupLocations[s.pickupLocationId]
      const to = s.legIds.length > 2 ? hubEnd(origin.hubId) : city(dest)
      return { from: { name: data.customers[s.customerId].shortName, place: `${loc.name}, ${loc.address}`, pincode: loc.pincode }, to }
    }
    case 'originHub':
      return { from: hubEnd(origin.hubId), to: s.laneId ? hubEnd(data.lanes[s.laneId].destHubId) : city(dest) }
    case 'lineHaul':
      return { from: hubEnd(origin.hubId), to: hubEnd(dest.hubId) }
    case 'destHub':
      return { from: hubEnd(dest.hubId), to: city(dest) }
    case 'lastMile': {
      const c = data.consignees[s.consigneeId]
      const from = s.legIds.length > 2 ? hubEnd(dest.hubId) : city(origin)
      return { from, to: { name: c.company || c.contact, place: `${c.address}`, pincode: c.pincode } }
    }
  }
}

export type Special = 'cod' | 'appointment' | 'fragile' | 'oda' | 'ewb'

export function jobSpecials(data: DemoData, leg: Leg, s: Shipment): Special[] {
  const out: Special[] = []
  if (leg.type === 'lastMile' && s.paymentMode === 'cod') out.push('cod')
  if ((leg.type === 'lastMile' || leg.type === 'destHub') && s.addOns.appointment) out.push('appointment')
  if (s.addOns.specialHandling) out.push('fragile')
  const odaHere = leg.type === 'firstMile' ? data.pincodes[s.originPincode].oda : leg.type === 'lastMile' ? data.pincodes[s.destPincode].oda : false
  if (odaHere) out.push('oda')
  if (s.ewb) out.push('ewb')
  return out
}

/** Previous and next partners on the shipment (chain of custody). */
export function neighbours(data: DemoData, leg: Leg, s: Shipment): { prev?: Partner; next?: Partner } {
  const legs = s.legIds.map((id) => data.legs[id])
  const i = legs.findIndex((l) => l.id === leg.id)
  return { prev: i > 0 ? data.partners[legs[i - 1].partnerId] : undefined, next: i < legs.length - 1 ? data.partners[legs[i + 1].partnerId] : undefined }
}

// ─── Dashboard (PP-11) ─────────────────────────────────────────────────────────

export interface TodayTiles {
  assigned: number
  inProgress: number
  done: number
  failed: number
  atRisk: number
}

/** Today's jobs (window starting today) by status, plus how many are at risk or breached. */
export function todayTiles(data: DemoData, partnerId: Id, now: IsoDateTime): TodayTiles {
  const today = istDate(now)
  const tiles: TodayTiles = { assigned: 0, inProgress: 0, done: 0, failed: 0, atRisk: 0 }
  for (const l of partnerLegs(data, partnerId)) {
    if (istDate(l.window.from) !== today) continue
    if (l.status === 'assigned') tiles.assigned += 1
    if (l.status === 'inProgress') tiles.inProgress += 1
    if (['handedOver', 'delivered', 'closed'].includes(l.status)) tiles.done += 1
    if (l.status === 'failedAttempt' || l.status === 'exception') tiles.failed += 1
    const sla = legSla(l, now)
    if (sla === 'atRisk' || sla === 'breached') tiles.atRisk += 1
  }
  return tiles
}

export function capacityToday(data: DemoData, partnerId: Id, now: IsoDateTime): { used: number; capacity: number } {
  const p = data.partners[partnerId]
  return { used: partnerLoad(data, partnerId, istDate(now)), capacity: effectiveCapacity(p, data.settings.probationVolumeCutPct) }
}

/** Latest weekly score and the change from the week before. */
export function scoreTrend(data: DemoData, partnerId: Id): { score: number; tier: Tier | null; delta: number | null } {
  const p = data.partners[partnerId]
  const weeks = Object.values(data.weeklyScores)
    .filter((w) => w.partnerId === partnerId)
    .sort((a, b) => b.week.localeCompare(a.week))
  if (weeks.length === 0) return { score: p.score, tier: p.tier, delta: null }
  const delta = weeks[1] ? Math.round((weeks[0].total - weeks[1].total) * 10) / 10 : null
  return { score: weeks[0].total, tier: p.tier, delta }
}

export type PartnerAlert =
  | { kind: 'licenceExpiring'; staffId: Id; date: IsoDate }
  | { kind: 'vehicleDocsExpiring'; vehicleId: Id; date: IsoDate }
  | { kind: 'claimAttributed'; claimId: Id }

/** Documents expiring within 30 days, and claims where this partner is liable (PP-11 Alerts). */
export function partnerAlerts(data: DemoData, partnerId: Id, now: IsoDateTime): PartnerAlert[] {
  const soon = istDate(addMinutes(now, 30 * 24 * 60))
  const within = (d?: IsoDate) => !!d && d <= soon
  const alerts: PartnerAlert[] = []
  for (const s of Object.values(data.fieldStaff)) {
    if (s.partnerId === partnerId && within(s.licenceValidTill)) alerts.push({ kind: 'licenceExpiring', staffId: s.id, date: s.licenceValidTill! })
  }
  for (const v of Object.values(data.vehicles)) {
    if (v.partnerId === partnerId && within(v.docExpiry)) alerts.push({ kind: 'vehicleDocsExpiring', vehicleId: v.id, date: v.docExpiry })
  }
  for (const c of Object.values(data.claims)) {
    if (c.liablePartnerId === partnerId && c.status !== 'rejected') alerts.push({ kind: 'claimAttributed', claimId: c.id })
  }
  return alerts
}

// ─── Assignment (PP-14) ────────────────────────────────────────────────────────

export type StaffBlock = 'licenceExpired' | 'policeVerificationPending'

export interface StaffOption {
  staff: FieldStaff
  jobsToday: number
  /** Why this person can't be assigned (PP-14 rule) */
  block?: StaffBlock
}

const ROLE_FOR: Record<LegType, FieldStaff['role']> = { firstMile: 'rider', lastMile: 'rider', originHub: 'hub', destHub: 'hub', lineHaul: 'driver' }

/** Staff with the right role for these legs, with today's load and any block. */
export function staffOptions(data: DemoData, partnerId: Id, legType: LegType, now: IsoDateTime): StaffOption[] {
  const today = istDate(now)
  return Object.values(data.fieldStaff)
    .filter((s) => s.partnerId === partnerId && s.role === ROLE_FOR[legType])
    .map((staff) => {
      const jobsToday = Object.values(data.legs).filter((l) => l.staffId === staff.id && istDate(l.window.from) === today && !['withdrawn'].includes(l.status)).length
      const block: StaffBlock | undefined = staff.licenceValidTill && staff.licenceValidTill < today ? 'licenceExpired' : !staff.policeVerified ? 'policeVerificationPending' : undefined
      return { staff, jobsToday, block }
    })
}

/** Vehicle needed for pickups over 30 kg and for line-haul (PP-14, assumed). */
export function vehicleRequired(leg: Leg, s: Shipment): boolean {
  return leg.type === 'lineHaul' || (leg.type === 'firstMile' && s.weights.actual > 30)
}
