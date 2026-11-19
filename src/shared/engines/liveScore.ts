/**
 * PP-23 "This week": the six KPIs (source §5.2) calculated live from the demo
 * data, with the jobs behind each number. Earlier weeks are the published
 * scores (seeded before the demo data starts).
 */
import { istDate } from '@shared/lib/time'
import type { DemoData, Id, IsoDate, IsoDateTime, KpiKey, WeeklyScore } from '@shared/types'
import { ackDueAt } from './escalations'
import { damagePct, profileOf, totalOf } from './scoring'

export interface KpiDetail {
  counted: number
  failed: { ref: Id; reason: string }[]
  /** %, or claims per 10k pieces for damage */
  value: number
}

const pct = (counted: number, failed: number) => (counted ? Math.round(((counted - failed) / counted) * 1000) / 10 : 100)

/** KPIs for a partner over [from, to] (inclusive dates). */
export function liveKpis(data: DemoData, partnerId: Id, from: IsoDate, to: IsoDate): { kpis: WeeklyScore['kpis']; detail: Record<KpiKey, KpiDetail>; total: number; profile: WeeklyScore['profile'] } {
  const inRange = (at?: IsoDateTime) => !!at && istDate(at) >= from && istDate(at) <= to
  const legs = Object.values(data.legs).filter((l) => l.partnerId === partnerId)
  const evs = Object.values(data.events)
  const byLeg = new Map<Id, typeof evs>()
  for (const e of evs) if (e.legId) byLeg.set(e.legId, [...(byLeg.get(e.legId) ?? []), e])

  // Pickup adherence: picked up within the promised window (a failed pickup counts as missed)
  const pickup: KpiDetail = { counted: 0, failed: [], value: 0 }
  for (const l of legs.filter((x) => x.type === 'firstMile')) {
    const e = (byLeg.get(l.id) ?? []).find((x) => (x.type === 'pickupConfirmed' || x.type === 'pickupFailed') && inRange(x.at))
    if (!e) continue
    pickup.counted++
    if (e.type === 'pickupFailed') pickup.failed.push({ ref: l.id, reason: 'pickupFailed' })
    else if (e.at > l.window.to) pickup.failed.push({ ref: l.id, reason: 'late' })
  }

  // On-time: the leg's work finished by its SLA time
  const onTime: KpiDetail = { counted: 0, failed: [], value: 0 }
  const scan: KpiDetail = { counted: 0, failed: [], value: 0 }
  let pieces = 0
  for (const l of legs) {
    const done = (byLeg.get(l.id) ?? []).filter((x) => x.type === 'handoverGiven' || x.type === 'delivered').at(-1)
    if (!done || !inRange(done.at)) continue
    onTime.counted++
    if (done.at > l.slaDueAt) onTime.failed.push({ ref: l.id, reason: 'late' })
    // Scan & e-POD compliance: the hand-over / delivery has photo evidence
    scan.counted++
    if (!done.photos?.length) scan.failed.push({ ref: l.id, reason: 'noPhoto' })
    pieces += data.shipments[l.shipmentId].pieces.length
  }

  // First attempt: delivered with no failed attempt before
  const first: KpiDetail = { counted: 0, failed: [], value: 0 }
  for (const l of legs.filter((x) => x.type === 'lastMile')) {
    const mine = byLeg.get(l.id) ?? []
    const end = mine.find((x) => (x.type === 'delivered' || x.type === 'deliveryFailed') && inRange(x.at))
    if (!end) continue
    first.counted++
    if (mine.some((x) => x.type === 'deliveryFailed')) first.failed.push({ ref: l.id, reason: 'ndr' })
  }

  // Damage, loss & shortage: claims on this partner's legs per 10,000 pieces handled
  const claims = Object.values(data.claims).filter((c) => c.liablePartnerId === partnerId && inRange(c.raisedAt))
  const per10k = pieces ? Math.round((claims.length / pieces) * 10000 * 10) / 10 : 0
  const damage: KpiDetail = { counted: pieces, failed: claims.map((c) => ({ ref: c.id, reason: c.type })), value: per10k }

  // Responsiveness: tickets acknowledged and resolved within SLA
  const resp: KpiDetail = { counted: 0, failed: [], value: 0 }
  for (const x of Object.values(data.exceptions)) {
    if (x.ownerPartnerId !== partnerId || !inRange(x.raisedAt)) continue
    resp.counted++
    const ack = x.partner?.ackAt
    if (!ack || ack > ackDueAt(data, x)) resp.failed.push({ ref: x.id, reason: 'ackLate' })
    else if (!x.partner?.resolvedAt || x.partner.resolvedAt > x.actionDueAt) resp.failed.push({ ref: x.id, reason: 'resolveLate' })
  }

  for (const k of [pickup, onTime, first, scan, resp]) k.value = pct(k.counted, k.failed.length)
  const kpis: WeeklyScore['kpis'] = { pickup: pickup.value, onTime: onTime.value, firstAttempt: first.value, damagePer10k: per10k, damagePct: damagePct(per10k), scanCompliance: scan.value, responsiveness: resp.value }
  const profile = profileOf(data.partners[partnerId])
  return { kpis, detail: { pickup, onTime, firstAttempt: first, damage, scanCompliance: scan, responsiveness: resp }, total: totalOf(kpis, profile), profile }
}
