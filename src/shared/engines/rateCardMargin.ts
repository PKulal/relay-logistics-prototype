/**
 * AI margin engine for rate cards (source §6 Step 5: "AI margin engine checks
 * every rate line against partner costs and target margin"; §8.1; ERP-22/23).
 * SIMULATED stand-in for the AI: a typical shipment is priced on the card,
 * the legs are planned with today's partner rates, and the margin is compared
 * with the target. PTL lines use 100 kg Express / Standard PTL on the lane;
 * parcel lines a 5 kg parcel on a route of that zone.
 */
import type { CustomerRateCard, DemoData, Id, ParcelTier, ParcelZone, Pincode, PtlService } from '@shared/types'
import { planAssignment } from './assignment'
import { computeMargin } from './margin'
import { parcelZone, priceLine } from './pricing'
import { km } from './fieldTasks'
import { findLane, quote } from './quote'
import { legPattern } from './schedule'

export interface LineMargin {
  /** Margin after the risk buffer: the figure checked against the target */
  marginPct: number
  belowTarget: boolean
  /** Points below the target (0 when at or above) */
  gap: number
}

/** Margin of one typical shipment priced on a rate card. */
export function sampleMargin(
  data: DemoData,
  rateCard: CustomerRateCard,
  origin: Pincode,
  dest: Pincode,
  kind: 'parcel' | 'ptl',
  service: ParcelTier | PtlService,
): LineMargin | undefined {
  const sample = kind === 'ptl' ? { l: 80, b: 60, h: 60, weight: 100 } : { l: 30, b: 25, h: 20, weight: 5 }
  const probe: DemoData = {
    ...data,
    rateCards: { ...data.rateCards, [rateCard.id]: rateCard },
    customers: { ...data.customers, PROBE: { ...Object.values(data.customers)[0], id: 'PROBE', rateCardId: rateCard.id } },
  }
  try {
    const q = quote(probe, {
      customerId: 'PROBE',
      originPincode: origin.code,
      destPincode: dest.code,
      serviceKind: kind,
      service,
      pieces: [sample],
      declaredValue: kind === 'ptl' ? 50000 : 5000,
      addOns: { appointment: false, insurance: false, specialHandling: false },
      paymentMode: 'tbb',
    })
    const plan = planAssignment(probe, { pattern: q.pattern, origin: q.origin, dest: q.dest, lane: q.lane, serviceKind: kind, service, chargeableKg: q.weights.chargeable, pieces: 1, date: '2026-11-24' })
    const m = computeMargin({ subtotal: q.price.subtotal, legCosts: plan.map((p) => p.cost), insurance: priceLine(q.price, 'fov'), riskBufferPct: data.settings.riskBufferPct, targetMarginPct: data.settings.targetMarginPct })
    return { marginPct: m.netPct, belowTarget: m.belowTarget, gap: m.belowTarget ? Math.round((data.settings.targetMarginPct - m.netPct) * 10) / 10 : 0 }
  } catch {
    return undefined
  }
}

/** A serviceable, non-ODA pincode at a hub (the lane's typical origin / destination). */
function hubPincode(data: DemoData, hubId: Id): Pincode | undefined {
  const pins = Object.values(data.pincodes).filter((p) => p.hubId === hubId && p.serviceable)
  return pins.find((p) => !p.oda) ?? pins[0]
}

/**
 * A typical route for each parcel zone: the longest one in the pincode master
 * that the network can carry (a line-haul lane where one is needed).
 */
export function zoneRoutes(data: DemoData): Partial<Record<ParcelZone, [Pincode, Pincode]>> {
  const pins = Object.values(data.pincodes).filter((p) => p.serviceable && !p.oda)
  const out: Partial<Record<ParcelZone, [Pincode, Pincode]>> = {}
  const best: Partial<Record<ParcelZone, number>> = {}
  for (const a of pins)
    for (const b of pins) {
      if (a.code === b.code) continue
      if (legPattern(a, b).includes('lineHaul') && !findLane(data, a, b)) continue
      const z = parcelZone(a, b)
      const d = km(a, b)
      if (best[z] === undefined || d > best[z]!) {
        best[z] = d
        out[z] = [a, b]
      }
    }
  return out
}

export interface CardMargins {
  ptl: { laneId: Id; service: PtlService; m?: LineMargin }[]
  parcel: { zone: ParcelZone; tier: ParcelTier; m?: LineMargin }[]
}

/** Every line of a card, checked. */
export function cardMargins(data: DemoData, card: CustomerRateCard): CardMargins {
  const routes = zoneRoutes(data)
  const ptl = card.ptl.map((line) => {
    const lane = data.lanes[line.laneId]
    const o = lane && hubPincode(data, lane.originHubId)
    const d = lane && hubPincode(data, lane.destHubId)
    return { laneId: line.laneId, service: line.service, m: o && d ? sampleMargin(data, card, o, d, 'ptl', line.service) : undefined }
  })
  const parcel = (Object.keys(card.parcel) as ParcelZone[]).flatMap((zone) =>
    (Object.keys(card.parcel[zone]) as ParcelTier[]).map((tier) => {
      const r = routes[zone]
      return { zone, tier, m: r ? sampleMargin(data, card, r[0], r[1], 'parcel', tier) : undefined }
    }),
  )
  return { ptl, parcel }
}

/** Lines below the target margin (ERP-23 "Lines below target"). */
export type BelowTargetLine = { key: string; m: LineMargin } & ({ kind: 'ptl'; laneId: Id; service: PtlService } | { kind: 'parcel'; zone: ParcelZone; tier: ParcelTier })

export function linesBelowTarget(m: CardMargins): BelowTargetLine[] {
  return [
    ...m.ptl.filter((l) => l.m?.belowTarget).map((l, i) => ({ key: `ptl-${i}-${l.laneId}-${l.service}`, kind: 'ptl' as const, laneId: l.laneId, service: l.service, m: l.m! })),
    ...m.parcel.filter((l) => l.m?.belowTarget).map((l) => ({ key: `parcel-${l.zone}-${l.tier}`, kind: 'parcel' as const, zone: l.zone, tier: l.tier, m: l.m! })),
  ]
}
