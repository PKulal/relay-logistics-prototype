/**
 * Claims (source §10 Step 4; §12 "Claims Liability & Fraud"): the chain of
 * custody per leg, the liability engine (which leg and partner held the
 * shipment at the fault point), claim and partner caps, and a SIMULATED fraud
 * signal.
 */
import { addDaysToDate, addHours, istDate } from '@shared/lib/time'
import type { Claim, ClaimType, DemoData, Id, IsoDate, IsoDateTime, Leg, Shipment, ShipmentEvent } from '@shared/types'

export const CLAIM_TYPES: ClaimType[] = ['damage', 'shortage', 'loss', 'pilferage']
/** Claim window after delivery and settlement time (seed-data.md §9: 7 days each). */
export const claimWindowDays = (data: DemoData) => data.settings.claimWindowDays
export const settlementDays = (data: DemoData) => data.settings.claimSettlementDays
export const CLAIM_DESCRIPTION_MAX = 1000
/** Reopen within this many days of settlement (assumed). */
export const REOPEN_DAYS = 7
/** Partner liability when the partner has no agreement on file (PP-08 default terms). */
const DEFAULT_PARTNER_LIABILITY = { perKg: 100, max: 10000 }

const IN_TYPES = ['pickupConfirmed', 'handoverReceived', 'hubInScan']
const OUT_TYPES = ['handoverGiven', 'bagSealed', 'delivered']

export interface CustodyLeg {
  leg: Leg
  piecesIn: Id[]
  piecesOut: Id[]
  sealsIn: string[]
  sealsOut: string[]
  photos: number
  staffIds: Id[]
  /** Short / damage / seal problems recorded on this leg */
  problems: ShipmentEvent[]
}

const eventsOf = (data: DemoData, lr: Id) =>
  Object.values(data.events)
    .filter((e) => e.shipmentId === lr)
    .sort((a, b) => a.at.localeCompare(b.at))

/** Pieces in and out of every leg, with seals, photos and staff (ERP-37, PP-22, CP-22). */
export function custodyChain(data: DemoData, s: Shipment): CustodyLeg[] {
  const evs = eventsOf(data, s.id)
  const legs = s.legIds.map((id) => data.legs[id])
  const chain = legs.map((leg) => {
    const own = evs.filter((e) => e.legId === leg.id)
    const ins = own.filter((e) => IN_TYPES.includes(e.type))
    const outs = own.filter((e) => OUT_TYPES.includes(e.type))
    return {
      leg,
      piecesIn: [...new Set(ins.flatMap((e) => e.pieceIds ?? []))],
      piecesOut: [...new Set(outs.flatMap((e) => e.pieceIds ?? []))],
      sealsIn: [...new Set(ins.flatMap((e) => e.sealNos ?? []))],
      sealsOut: [...new Set(outs.flatMap((e) => e.sealNos ?? []))],
      photos: own.reduce((n, e) => n + (e.photos?.length ?? 0), 0),
      staffIds: [...new Set(own.filter((e) => e.by.startsWith('FS-')).map((e) => e.by))],
      problems: own.filter((e) => e.type === 'exceptionReported'),
    }
  })
  // What the next leg received also left this one (a truck's hand-over is scanned by the receiver)
  return chain.map((c, i) => ({ ...c, piecesOut: [...new Set([...c.piecesOut, ...(chain[i + 1]?.piecesIn ?? [])])] }))
}

export interface Liability {
  legId: Id
  partnerId: Id
  /** i18n key under claims.why */
  why: 'notPassedOn' | 'damagedOnArrival' | 'damagedInCustody' | 'deliveredShort'
  in: number
  out: number
}

/**
 * Liability engine (SIMULATED AI): the leg holding the piece at the fault point.
 * Missing piece → the first leg that received it but did not pass it on.
 * Damage → the leg it was found damaged on; if found at a hand-over (recorded
 * with the receipt), the leg before.
 */
export function liableLeg(data: DemoData, s: Shipment, type: ClaimType, pieceIds: Id[]): Liability | undefined {
  const chain = custodyChain(data, s)
  if (type === 'damage') {
    for (const [i, c] of chain.entries()) {
      const dmg = c.problems.find((e) => e.exceptionKind === 'damage' && e.pieceIds?.some((p) => pieceIds.includes(p)))
      if (!dmg) continue
      const atReceipt = eventsOf(data, s.id).some((e) => e.legId === c.leg.id && e.type === 'handoverReceived' && Math.abs(Date.parse(e.at) - Date.parse(dmg.at)) < 15 * 60_000)
      const at = atReceipt && i > 0 ? chain[i - 1] : c
      return { legId: at.leg.id, partnerId: at.leg.partnerId, why: atReceipt && i > 0 ? 'damagedOnArrival' : 'damagedInCustody', in: at.piecesIn.length, out: at.piecesOut.length }
    }
    const last = chain.at(-1)!
    return { legId: last.leg.id, partnerId: last.leg.partnerId, why: 'damagedInCustody', in: last.piecesIn.length, out: last.piecesOut.length }
  }
  for (const c of chain) {
    if (pieceIds.some((p) => c.piecesIn.includes(p) && !c.piecesOut.includes(p))) {
      const last = c === chain.at(-1)
      return { legId: c.leg.id, partnerId: c.leg.partnerId, why: last ? 'deliveredShort' : 'notPassedOn', in: c.piecesIn.length, out: c.piecesOut.length }
    }
  }
  return undefined
}

/** When the shipment was delivered (claim window starts here). */
export const deliveredAt = (data: DemoData, lr: Id) => eventsOf(data, lr).filter((e) => e.type === 'delivered').at(-1)?.at

/** Delivered shipments of a customer still inside the claim window (CP-22 LR picker). */
export function claimableShipments(data: DemoData, customerId: Id, now: IsoDateTime): Shipment[] {
  return Object.values(data.shipments).filter((s) => {
    if (s.customerId !== customerId || (s.status !== 'delivered' && s.status !== 'deliveredWithException')) return false
    const at = deliveredAt(data, s.id)
    return !!at && Date.parse(now) <= Date.parse(addHours(at, claimWindowDays(data) * 24)) && !Object.values(data.claims).some((c) => c.shipmentId === s.id && c.status !== 'rejected')
  })
}

/**
 * Most the customer can claim: the invoice value of the affected pieces,
 * capped by the carrier liability on the rate card (₹ per kg of the shipment,
 * with a maximum) unless the shipment was insured (FOV).
 */
export function claimCap(data: DemoData, s: Shipment, pieceIds: Id[]): { invoiceShare: number; liabilityCap?: number; max: number } {
  const invoiceShare = Math.round((s.invoice.value / s.pieces.length) * pieceIds.length * 100) / 100
  if (s.addOns.insurance) return { invoiceShare, max: invoiceShare }
  const sur = data.rateCards[data.customers[s.customerId].rateCardId]?.surcharges
  const liabilityCap = sur ? Math.min(sur.liabilityPerKg * s.weights.chargeable, sur.liabilityMax) : invoiceShare
  return { invoiceShare, liabilityCap, max: Math.min(invoiceShare, liabilityCap) }
}

/** The partner's liability cap from its agreement (₹ per kg of the shipment, with a maximum). */
export function partnerCap(data: DemoData, partnerId: Id, s: Shipment): number {
  const g = Object.values(data.applications).find((a) => a.partnerId === partnerId)?.agreement
  const t = g ? { perKg: g.liabilityPerKg, max: g.liabilityMax } : DEFAULT_PARTNER_LIABILITY
  return Math.min(t.perKg * s.weights.chargeable, t.max)
}

/** Suggested recovery: the partner up to its cap, the rest from Logisco's insurer if insured, else the partner's insurer. */
export function suggestedRecovery(data: DemoData, s: Shipment, partnerId: Id | undefined, amount: number): Claim['recovery'] {
  const partner = partnerId ? Math.min(amount, partnerCap(data, partnerId, s)) : 0
  const rest = Math.round((amount - partner) * 100) / 100
  return s.addOns.insurance ? { partner, partnerInsurer: 0, insurer: rest } : { partner, partnerInsurer: rest, insurer: 0 }
}

export type FraudFlag = 'aboveInvoiceShare' | 'repeatClaims' | 'deliveredScanned'

/** SIMULATED fraud signal (source §12): amounts above the invoice share, repeated claims, "missing" pieces scanned as delivered. */
export function fraudSignals(data: DemoData, c: Claim): FraudFlag[] {
  const s = data.shipments[c.shipmentId]
  const flags: FraudFlag[] = []
  if (c.amountClaimed > claimCap(data, s, c.pieceIds).invoiceShare) flags.push('aboveInvoiceShare')
  const since = Date.parse(c.raisedAt) - 30 * 86_400_000
  if (Object.values(data.claims).filter((x) => x.customerId === c.customerId && Date.parse(x.raisedAt) >= since).length >= 3) flags.push('repeatClaims')
  if (c.type !== 'damage') {
    const delivered = eventsOf(data, s.id).filter((e) => e.type === 'delivered').flatMap((e) => e.pieceIds ?? [])
    if (c.pieceIds.every((p) => delivered.includes(p))) flags.push('deliveredScanned')
  }
  return flags
}

/** Payout the deduction falls in: the partner's next scheduled payout, else the next one by its tier cycle (§5.3). */
export function nextPayoutDate(data: DemoData, partnerId: Id, now: IsoDateTime): IsoDate {
  const today = istDate(now)
  const scheduled = Object.values(data.payouts)
    .filter((p) => p.partnerId === partnerId && p.status !== 'paid' && p.dueDate >= today)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  if (scheduled) return scheduled.dueDate
  const tier = data.partners[partnerId]?.tier
  if (tier === 'platinum') return addDaysToDate(today, 3)
  // Weekly (Gold, Silver) on Fridays; Bronze fortnightly: the Friday after next
  let d = addDaysToDate(today, 1)
  while (new Date(`${d}T12:00:00+05:30`).getUTCDay() !== 5) d = addDaysToDate(d, 1)
  return tier === 'gold' || tier === 'silver' ? d : addDaysToDate(d, 7)
}
