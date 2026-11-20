/**
 * Margin monitor and simulator (source §8: sum of leg rates vs customer price,
 * risk buffer, target margin; §8.1 AI margin engine "checks every quote;
 * suggests a different model or flags the rate line; learns loss-making
 * lanes"; §9 lane-level P&L; §11 Dept 3 lane-loss alerts).
 */
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { DemoData, Id, IsoDateTime, LegType, Service, Shipment } from '@shared/types'
import { NoPartnerError, planAssignment, rankCandidates, type AssignmentInput, type Candidate } from './assignment'
import { computeMargin, type MarginResult } from './margin'
import { round2 } from './money'
import { priceLine } from './pricing'
import { quote, QuoteError, type Quote, type QuoteInput } from './quote'

const share = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0)

/** "Delhi NCR → Hubballi": origin region, destination city. */
export function laneKey(data: DemoData, s: Shipment): string {
  const o = data.pincodes[s.originPincode]
  const d = data.pincodes[s.destPincode]
  return `${s.laneId ? data.lanes[s.laneId].originRegion : o.region} → ${d.city}`
}

/** What a settled claim cost Logisco after recovering from the partner and its insurer. */
function claimCost(data: DemoData, s: Shipment): number {
  return Object.values(data.claims)
    .filter((c) => c.shipmentId === s.id && c.amountApproved && (c.status === 'settled' || c.status === 'closed'))
    .reduce((sum, c) => sum + c.amountApproved! - (c.recovery?.partner ?? 0) - (c.recovery?.partnerInsurer ?? 0), 0)
}

export interface ShipmentPnl {
  shipment: Shipment
  revenue: number
  legCosts: number
  insurance: number
  claims: number
  margin: number
  marginPct: number
}

export function shipmentPnl(data: DemoData, s: Shipment): ShipmentPnl {
  const revenue = s.price.subtotal
  const legCosts = round2(s.legIds.reduce((sum, id) => sum + (data.legs[id].status === 'withdrawn' ? 0 : data.legs[id].cost), 0))
  const insurance = priceLine(s.price, 'fov')
  const claims = round2(claimCost(data, s))
  const margin = round2(revenue - legCosts - insurance - claims)
  return { shipment: s, revenue, legCosts, insurance, claims, margin, marginPct: share(margin, revenue) }
}

export interface LaneRow {
  key: string
  shipments: ShipmentPnl[]
  revenue: number
  legCosts: number
  insurance: number
  claims: number
  margin: number
  marginPct: number
  /** Margin % after the risk buffer, compared with target */
  belowTarget: boolean
  /** Last 7 days vs the 4 weeks before (percentage points); undefined without both */
  trend?: number
}

/** ERP-24 lane table, lowest margin first. */
export function laneRows(data: DemoData, now: IsoDateTime): LaneRow[] {
  const today = istDate(now)
  const weekAgo = addDaysToDate(today, -7)
  const monthAgo = addDaysToDate(today, -35)
  const by = new Map<string, ShipmentPnl[]>()
  for (const s of Object.values(data.shipments)) {
    if (s.status === 'cancelled') continue
    const k = laneKey(data, s)
    by.set(k, [...(by.get(k) ?? []), shipmentPnl(data, s)])
  }
  const sum = (list: ShipmentPnl[], f: (p: ShipmentPnl) => number) => round2(list.reduce((t, p) => t + f(p), 0))
  const pctOf = (list: ShipmentPnl[]) => share(sum(list, (p) => p.margin), sum(list, (p) => p.revenue))
  return [...by.entries()]
    .map(([key, list]) => {
      const revenue = sum(list, (p) => p.revenue)
      const margin = sum(list, (p) => p.margin)
      const marginPct = share(margin, revenue)
      const recent = list.filter((p) => istDate(p.shipment.bookedAt) > weekAgo)
      const earlier = list.filter((p) => istDate(p.shipment.bookedAt) <= weekAgo && istDate(p.shipment.bookedAt) > monthAgo)
      return {
        key,
        shipments: list.sort((a, b) => b.shipment.bookedAt.localeCompare(a.shipment.bookedAt)),
        revenue,
        legCosts: sum(list, (p) => p.legCosts),
        insurance: sum(list, (p) => p.insurance),
        claims: sum(list, (p) => p.claims),
        margin,
        marginPct,
        belowTarget: marginPct - data.settings.riskBufferPct < data.settings.targetMarginPct,
        trend: recent.length && earlier.length ? Math.round((pctOf(recent) - pctOf(earlier)) * 10) / 10 : undefined,
      }
    })
    .sort((a, b) => a.marginPct - b.marginPct)
}

export type LaneAlert = { kind: 'belowTarget'; lane: string; pct: number } | { kind: 'partnerCost'; lane: string; risePct: number } | { kind: 'weightRevisions'; lane: string; count: number; of: number }

/** SIMULATED AI lane-loss alerts (source §11 Dept 3). */
export function laneAlerts(data: DemoData, rows: LaneRow[], now: IsoDateTime): LaneAlert[] {
  const weekAgo = addDaysToDate(istDate(now), -7)
  const out: LaneAlert[] = []
  for (const r of rows) {
    if (r.belowTarget) out.push({ kind: 'belowTarget', lane: r.key, pct: r.marginPct })
    const perKg = (list: ShipmentPnl[]) => {
      const kg = list.reduce((t, p) => t + p.shipment.weights.chargeable, 0)
      return kg ? list.reduce((t, p) => t + p.legCosts, 0) / kg : 0
    }
    const recent = r.shipments.filter((p) => istDate(p.shipment.bookedAt) > weekAgo)
    const earlier = r.shipments.filter((p) => istDate(p.shipment.bookedAt) <= weekAgo)
    if (recent.length && earlier.length && perKg(earlier) > 0) {
      const rise = Math.round(((perKg(recent) - perKg(earlier)) / perKg(earlier)) * 100)
      if (rise >= 5) out.push({ kind: 'partnerCost', lane: r.key, risePct: rise })
    }
    const ids = new Set(r.shipments.map((p) => p.shipment.id))
    const revisions = Object.values(data.weightRevisions).filter((w) => ids.has(w.shipmentId)).length
    if (r.shipments.length >= 3 && revisions / r.shipments.length >= 0.1) out.push({ kind: 'weightRevisions', lane: r.key, count: revisions, of: r.shipments.length })
  }
  return out
}

// ── Simulator (ERP-25) ──────────────────────────────────────────────────────

export interface SimLeg {
  type: LegType
  options: Candidate[]
  partnerId?: Id
  cost: number
}

export interface Simulation {
  quote: Quote
  legs: SimLeg[]
  margin: MarginResult
  insurance: number
}

export type SimError = QuoteError['code'] | 'noPartner'

/** Quote + engine-planned legs + margin. `mix` swaps a leg's partner (index → partnerId) for "try another partner mix". */
export function simulate(data: DemoData, input: QuoteInput, date: string, mix: Record<number, Id> = {}): { ok: true; sim: Simulation } | { ok: false; code: SimError } {
  let q: Quote
  try {
    q = quote(data, input)
  } catch (e) {
    if (e instanceof QuoteError) return { ok: false, code: e.code }
    throw e
  }
  const a: AssignmentInput = { pattern: q.pattern, origin: q.origin, dest: q.dest, lane: q.lane, serviceKind: input.serviceKind, service: input.service, chargeableKg: q.weights.chargeable, pieces: input.pieces.length, date }
  try {
    planAssignment(data, a)
  } catch (e) {
    if (e instanceof NoPartnerError) return { ok: false, code: 'noPartner' }
    throw e
  }
  const legs: SimLeg[] = q.pattern.map((type, i) => {
    const options = rankCandidates(data, type, a).filter((c) => c.eligible)
    const chosen = options.find((c) => c.partnerId === mix[i]) ?? options[0]
    return { type, options, partnerId: chosen?.partnerId, cost: chosen?.cost ?? 0 }
  })
  const insurance = priceLine(q.price, 'fov')
  const margin = computeMargin({ subtotal: q.price.subtotal, legCosts: legs.map((l) => l.cost), insurance, riskBufferPct: data.settings.riskBufferPct, targetMarginPct: data.settings.targetMarginPct })
  return { ok: true, sim: { quote: q, legs, margin, insurance } }
}

/** A booked shipment as a quote request (for "a different model"). */
export function inputFromShipment(s: Shipment): QuoteInput {
  return {
    customerId: s.customerId,
    originPincode: s.originPincode,
    destPincode: s.destPincode,
    serviceKind: s.serviceKind,
    service: s.service,
    pieces: s.pieces.map((p) => ({ l: p.l, b: p.b, h: p.h, weight: p.weight })),
    declaredValue: s.invoice.value,
    addOns: s.addOns,
    paymentMode: s.paymentMode,
    codAmount: s.codAmount,
  }
}

const ALTERNATIVE: Record<Service, { kind: QuoteInput['serviceKind']; service: Service }> = {
  economy: { kind: 'ptl', service: 'standardPtl' },
  standard: { kind: 'ptl', service: 'standardPtl' },
  express: { kind: 'ptl', service: 'expressPtl' },
  expressPtl: { kind: 'parcel', service: 'express' },
  standardPtl: { kind: 'parcel', service: 'standard' },
}

export interface QuoteCheck {
  shipment: Shipment
  netPct: number
  at: IsoDateTime
  /** Booking it under the other model would clear target */
  alternative?: { service: Service; netPct: number }
  /** Otherwise: the rate line to review */
  rateCardId: Id
}

/** ERP-24 quote checks: bookings the margin engine flagged, with its suggestion. */
export function quoteChecks(data: DemoData, limit = 12): QuoteCheck[] {
  return Object.values(data.aiDecisions)
    .filter((d) => d.kind === 'marginCheck' && d.margin?.belowTarget && data.shipments[d.recordId])
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit)
    .map((d) => {
      const s = data.shipments[d.recordId]
      const alt = ALTERNATIVE[s.service]
      const r = simulate(data, { ...inputFromShipment(s), serviceKind: alt.kind, service: alt.service }, istDate(s.bookedAt))
      const better = r.ok && r.sim.margin.netPct > d.margin!.netPct && !r.sim.margin.belowTarget ? { service: alt.service, netPct: r.sim.margin.netPct } : undefined
      return { shipment: s, netPct: d.margin!.netPct, at: d.at, alternative: better, rateCardId: data.customers[s.customerId].rateCardId }
    })
}
