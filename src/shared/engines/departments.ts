/**
 * Leadership, Sales, Customer Success, Hub Ops and Compliance views (source
 * §11 department table: Dept 0 command dashboard, daily AI briefing, scenario
 * modelling; Dept 1 RFQ / tender, proposal drafts; Dept 4 tickets, account
 * health, NPS, churn prediction, ticket triage; Dept 8 hub scans, manifests,
 * seals, appointment desk; Dept 11 e-way bill monitor, DPDP register,
 * statutory calendar, contract expiry alerts).
 */
import { addDaysToDate, addHours, istDate, minutesBetween } from '@shared/lib/time'
import type { DemoData, Id, IsoDate, IsoDateTime, LeadershipSnapshot, Rfq, Service, Ticket, Tier } from '@shared/types'
import { coverageGaps } from './network'
import { ndrDueAt } from './ndr'
import { hubDwell } from './opsReview'
import { isWorkingDay } from './schedule'
import { batchPreview, nextBatchDate } from './payables'
import { round2 } from './money'

type Period = keyof LeadershipSnapshot['periods']
const DELIVERED = ['delivered', 'deliveredWithException']

/** Start date of the period: today, month to date, quarter to date (Indian FY quarters). */
export function periodStart(period: Period, now: IsoDateTime): IsoDate {
  const today = istDate(now)
  if (period === 'today') return today
  if (period === 'mtd') return `${today.slice(0, 7)}-01`
  const m = Number(today.slice(5, 7))
  const q = [1, 4, 7, 10].filter((x) => x <= m).at(-1)!
  return `${today.slice(0, 4)}-${String(q).padStart(2, '0')}-01`
}

/** ERP-04 live tiles: shipments and cash. */
export function liveTiles(data: DemoData, period: Period, now: IsoDateTime) {
  const from = periodStart(period, now)
  const shipments = Object.values(data.shipments)
  const booked = shipments.filter((s) => istDate(s.bookedAt) >= from).length
  const deliveredIds = new Set(Object.values(data.events).filter((e) => e.type === 'delivered' && istDate(e.at) >= from).map((e) => e.shipmentId))
  const delivered = shipments.filter((s) => deliveredIds.has(s.id) && DELIVERED.includes(s.status)).length
  const receivables = round2(Object.values(data.invoices).filter((i) => i.status !== 'paid').reduce((s, i) => s + i.total, 0))
  const payouts = round2(batchPreview(data, nextBatchDate(now)).filter((l) => l.net > 0).reduce((s, l) => s + l.net, 0))
  const codHeld = round2(Object.values(data.codRecords).filter((r) => r.status !== 'remitted' && r.status !== 'pending').reduce((s, r) => s + r.amount, 0))
  return { booked, delivered, receivables, payouts, codHeld }
}

export type BriefingItem =
  | { kind: 'booked'; date: IsoDate; count: number; avg: number }
  | { kind: 'nearProbation'; partners: string[] }
  | { kind: 'probation'; partners: string[] }
  | { kind: 'overdue'; customer: string; amount: number; days: number }
  | { kind: 'codLate'; partner: string; amount: number; hours: number }
  | { kind: 'breaches'; count: number }
  | { kind: 'gaps'; count: number }
  | { kind: 'sos'; count: number }

/** SIMULATED daily AI briefing: what changed, risks and actions, from live data. */
export function dailyBriefing(data: DemoData, now: IsoDateTime): BriefingItem[] {
  const today = istDate(now)
  const out: BriefingItem[] = []
  // The last working day (Sundays are off; schedule.ts)
  let yesterday = addDaysToDate(today, -1)
  while (!isWorkingDay(yesterday)) yesterday = addDaysToDate(yesterday, -1)
  const byDay = (d: IsoDate) => Object.values(data.shipments).filter((s) => istDate(s.bookedAt) === d).length
  const last7 = Array.from({ length: 7 }, (_, i) => byDay(addDaysToDate(today, -i - 2)))
  out.push({ kind: 'booked', date: yesterday, count: byDay(yesterday), avg: Math.round(last7.reduce((a, b) => a + b, 0) / 7) })
  const sos = Object.values(data.sosAlerts).filter((a) => a.status === 'active').length
  if (sos) out.push({ kind: 'sos', count: sos })
  const probation = Object.values(data.partners).filter((p) => p.tier === 'probation' && p.status !== 'offboarded')
  if (probation.length) out.push({ kind: 'probation', partners: probation.map((p) => p.shortName) })
  const near = Object.values(data.partners).filter((p) => p.tier === 'bronze' && p.score < 64)
  if (near.length) out.push({ kind: 'nearProbation', partners: near.map((p) => p.shortName) })
  const overdue = Object.values(data.invoices)
    .filter((i) => i.status !== 'paid' && i.dueDate < today)
    .sort((a, b) => b.total - a.total)[0]
  if (overdue) out.push({ kind: 'overdue', customer: data.customers[overdue.customerId].shortName, amount: overdue.total, days: Math.round(minutesBetween(`${overdue.dueDate}T00:00:00+05:30`, `${today}T00:00:00+05:30`) / 1440) })
  const cod = Object.values(data.codRecords)
    .filter((r) => (r.status === 'collected' || r.status === 'atOffice') && r.partnerId && r.collectedAt)
    .sort((a, b) => a.collectedAt!.localeCompare(b.collectedAt!))
  if (cod.length) {
    const p = cod[0].partnerId!
    const mine = cod.filter((r) => r.partnerId === p)
    out.push({ kind: 'codLate', partner: data.partners[p].shortName, amount: round2(mine.reduce((s, r) => s + r.amount, 0)), hours: Math.floor(minutesBetween(cod[0].collectedAt!, now) / 60) })
  }
  const breaches = Object.values(data.exceptions).filter((x) => x.status !== 'resolved' && x.actionDueAt < now).length
  if (breaches) out.push({ kind: 'breaches', count: breaches })
  const gaps = coverageGaps(data, now).filter((g) => !g.partners.length).length
  if (gaps) out.push({ kind: 'gaps', count: gaps })
  return out.slice(0, 7)
}

/** ERP-04 network health: partners by tier, uncovered places, hub dwell. */
export function networkHealth(data: DemoData, now: IsoDateTime) {
  const tiers: Record<Tier | 'trial', number> = { platinum: 0, gold: 0, silver: 0, bronze: 0, probation: 0, trial: 0 }
  for (const p of Object.values(data.partners)) {
    if (!['live', 'trial', 'probation', 'suspended'].includes(p.status)) continue
    tiers[p.tier ?? 'trial']++
  }
  const gaps = coverageGaps(data, now)
  const dwell = hubDwell(data, now)
  return { tiers, recruit: gaps.filter((g) => !g.partners.length).length, backup: gaps.filter((g) => g.partners.length === 1).length, dwell }
}

/** Leg costs that move with fuel (assumed; reproduces the spec's "fuel +5% → −0.8 pt"). */
export const FUEL_SHARE = 0.2

/** ERP-04 scenario: volume, fuel and partner cost changes → projected revenue and margin. */
export function scenario(base: { revenue: number; marginPct: number }, x: { volumePct: number; fuelPct: number; partnerCostPct: number }) {
  const revenue = base.revenue * (1 + x.volumePct / 100)
  const costShare = (1 - base.marginPct / 100) * (1 + (FUEL_SHARE * x.fuelPct) / 100 + x.partnerCostPct / 100)
  const marginPct = Math.round((1 - costShare) * 1000) / 10
  return { revenue: Math.round(revenue), marginPct, margin: Math.round((revenue * marginPct) / 100), deltaPts: Math.round((marginPct - base.marginPct) * 10) / 10 }
}

// ── Accounts (ERP-28, ERP-39) ───────────────────────────────────────────────

export function accountStats(data: DemoData, customerId: Id, now: IsoDateTime) {
  const today = istDate(now)
  const mine = Object.values(data.shipments).filter((s) => s.customerId === customerId)
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const to = addDaysToDate(today, -i * 7)
    const from = addDaysToDate(to, -6)
    return { from, count: mine.filter((s) => istDate(s.bookedAt) >= from && istDate(s.bookedAt) <= to).length }
  }).reverse()
  const delivered = mine.filter((s) => DELIVERED.includes(s.status))
  const onTime = delivered.filter((s) => {
    const ev = Object.values(data.events).find((e) => e.shipmentId === s.id && e.type === 'delivered')
    const last = data.legs[s.legIds.at(-1)!]
    return ev && last && ev.at <= last.slaDueAt
  }).length
  const lanes = new Map<string, { shipments: number; claims: number }>()
  for (const s of mine) {
    const k = `${data.pincodes[s.originPincode].city} → ${data.pincodes[s.destPincode].city}`
    const row = lanes.get(k) ?? { shipments: 0, claims: 0 }
    row.shipments++
    row.claims += Object.values(data.claims).filter((c) => c.shipmentId === s.id).length
    lanes.set(k, row)
  }
  return {
    weeks,
    onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 1000) / 10 : undefined,
    lanes: [...lanes.entries()].map(([lane, r]) => ({ lane, ...r, damagePct: Math.round((r.claims / r.shipments) * 1000) / 10 })).sort((a, b) => b.shipments - a.shipments),
  }
}

export type ChurnReason = 'volumeDrop' | 'overdue' | 'claims' | 'ndr' | 'lowNps' | 'openTickets'

/** SIMULATED churn prediction (source §6 Step 8, §12): weighted signals → low / medium / high. */
export function churnRisk(data: DemoData, customerId: Id, now: IsoDateTime): { level: 'low' | 'medium' | 'high'; reasons: ChurnReason[] } {
  const c = data.customers[customerId]
  const today = istDate(now)
  const reasons: ChurnReason[] = []
  let score = 0
  const add = (r: ChurnReason, w: number) => {
    reasons.push(r)
    score += w
  }
  const mine = Object.values(data.shipments).filter((s) => s.customerId === customerId)
  const recent = mine.filter((s) => istDate(s.bookedAt) > addDaysToDate(today, -14)).length
  const before = mine.filter((s) => istDate(s.bookedAt) <= addDaysToDate(today, -14) && istDate(s.bookedAt) > addDaysToDate(today, -28)).length
  if (before >= 3 && recent < before * 0.7) add('volumeDrop', 30)
  if (Object.values(data.invoices).some((i) => i.customerId === customerId && i.status !== 'paid' && i.dueDate < today)) add('overdue', 25)
  if (Object.values(data.claims).filter((x) => x.customerId === customerId && x.raisedAt >= `${addDaysToDate(today, -30)}`).length >= 2) add('claims', 15)
  if (Object.values(data.ndrs).filter((n) => data.shipments[n.shipmentId]?.customerId === customerId).length >= 2) add('ndr', 10)
  if (c?.nps !== undefined && c.nps < 45) add('lowNps', 20)
  if (Object.values(data.tickets).filter((t) => t.customerId === customerId && (t.status === 'open' || t.status === 'inProgress')).length >= 2) add('openTickets', 10)
  return { level: score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low', reasons }
}

export type Upsell = { kind: 'lane'; origin: string; dest: string } | { kind: 'parcel' } | { kind: 'ptl' }

/** SIMULATED upsell suggestions: lanes the network serves that the account hasn't used; the Parcel / PTL mix. */
export function upsell(data: DemoData, customerId: Id): Upsell[] {
  const mine = Object.values(data.shipments).filter((s) => s.customerId === customerId)
  // Lanes leaving the hubs that serve the account's pickup locations
  const hubs = new Set(Object.values(data.pickupLocations).filter((l) => l.customerId === customerId).map((l) => data.pincodes[l.pincode]?.hubId))
  // A lane counts as used with 3+ shipments (one-off shipments are an opening, not a relationship)
  const perLane = new Map<Id, number>()
  for (const s of mine) if (s.laneId) perLane.set(s.laneId, (perLane.get(s.laneId) ?? 0) + 1)
  const used = new Set([...perLane.entries()].filter(([, n]) => n >= 3).map(([id]) => id))
  const out: Upsell[] = Object.values(data.lanes)
    .filter((l) => hubs.has(l.originHubId) && !used.has(l.id))
    .slice(0, 2)
    .map((l) => ({ kind: 'lane', origin: l.originRegion, dest: l.destRegion }))
  const ptl = mine.filter((s) => s.serviceKind === 'ptl')
  if (ptl.length && ptl.filter((s) => s.weights.chargeable < 30).length / ptl.length >= 0.3) out.push({ kind: 'parcel' })
  const parcel = mine.filter((s) => s.serviceKind === 'parcel')
  if (parcel.length && parcel.filter((s) => s.weights.chargeable > 40).length / parcel.length >= 0.3) out.push({ kind: 'ptl' })
  return out
}

/** SIMULATED ticket triage: urgency of the category, time left on the SLA, and the account's size. */
export function ticketPriority(data: DemoData, t: Ticket, now: IsoDateTime): 'high' | 'medium' | 'low' {
  if (t.status === 'resolved' || t.status === 'closed') return 'low'
  const left = t.dueAt ? minutesBetween(now, t.dueAt) : Infinity
  const big = t.customerId && ['kam', 'kamSolutions'].includes(data.customers[t.customerId]?.track)
  if (left < 120 || ((t.category === 'pickup' || t.category === 'delivery') && big)) return 'high'
  if (left < 8 * 60 || t.category === 'damage' || big) return 'medium'
  return 'low'
}

/** ERP-39 NDR follow-up: failed deliveries with no customer answer by the cut-off. */
export function ndrFollowUps(data: DemoData, now: IsoDateTime) {
  return Object.values(data.ndrs)
    .filter((n) => !n.customerChoice && ndrDueAt(data, n) < now)
    .map((n) => ({ ndr: n, dueAt: ndrDueAt(data, n) }))
}

// ── RFQ proposal draft (ERP-29) ─────────────────────────────────────────────

/** SIMULATED AI first draft: rate per kg, minimum and transit for each RFQ lane from the customer's (or standard) card. */
export function proposalDraft(data: DemoData, rfq: Rfq) {
  const card = data.rateCards[(rfq.customerId && data.customers[rfq.customerId]?.rateCardId) || 'RC-STANDARD'] ?? data.rateCards['RC-STANDARD']
  return {
    cardId: card.id,
    lines: rfq.lanes.map((l) => {
      const lane = Object.values(data.lanes).find((x) => x.originRegion === l.origin && (x.destRegion === l.dest || Object.values(data.pincodes).some((p) => p.city === l.dest && p.hubId === x.destHubId)))
      const rate = lane && card.ptl.find((r) => r.laneId === lane.id && r.service === l.service)
      return { ...l, laneId: lane?.id, perKg: rate?.perKg, minKg: rate?.minKg, transitDays: lane?.transitDays[l.service as Service] }
    }),
  }
}

/** ERP-41: e-way bills by validity left. */
export function ewbMonitor(data: DemoData, now: IsoDateTime) {
  return Object.values(data.shipments)
    .filter((s) => s.ewb && !DELIVERED.includes(s.status) && s.status !== 'cancelled')
    .map((s) => ({ shipment: s, hoursLeft: Math.floor(minutesBetween(now, `${s.ewb!.validTill}T23:59:00+05:30`) / 60) }))
    .sort((a, b) => a.hoursLeft - b.hoursLeft)
}

export const contractsExpiring = (data: DemoData, now: IsoDateTime, days = 60) => data.compliance.contracts.filter((c) => c.end >= istDate(now) && c.end <= addDaysToDate(istDate(now), days)).sort((a, b) => a.end.localeCompare(b.end))

export const ticketDue = (createdAt: IsoDateTime, category: string) => addHours(createdAt, category === 'pickup' || category === 'delivery' ? 2 : 8)
