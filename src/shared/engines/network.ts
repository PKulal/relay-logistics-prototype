/**
 * Network planning (source §11 Dept 6: pincode / ODA master, lanes, hubs,
 * coverage-gap maps, lane forecasts; §8 pincode serviceability and capacity
 * check; §5.1 declared capacity and holidays).
 */
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { DemoData, Id, IsoDate, IsoDateTime, LegType, Partner } from '@shared/types'
import { effectiveCapacity, partnerLoad } from './assignment'

/** Partners that can be offered work (as in the assignment engine). */
const ACTIVE: Partner['status'][] = ['live', 'trial', 'probation']

export interface PincodeCoverage {
  firstMile: Id[]
  lastMile: Id[]
}

/** Who covers each pincode for first and last mile (source §8: only registered partners are eligible). */
export function pincodeCoverage(data: DemoData): Record<string, PincodeCoverage> {
  const out: Record<string, PincodeCoverage> = {}
  for (const code of Object.keys(data.pincodes)) out[code] = { firstMile: [], lastMile: [] }
  for (const p of Object.values(data.partners)) {
    if (!ACTIVE.includes(p.status)) continue
    for (const code of p.coveragePincodes) {
      if (!out[code]) continue
      if (p.legs.includes('firstMile')) out[code].firstMile.push(p.id)
      if (p.legs.includes('lastMile')) out[code].lastMile.push(p.id)
    }
  }
  return out
}

/** Line-haul partners on a lane that can still be offered work. */
export const lanePartners = (data: DemoData, laneId: Id) => (data.lanes[laneId]?.lineHaulPartnerIds ?? []).filter((id) => ACTIVE.includes(data.partners[id]?.status))

export interface Gap {
  key: string
  legType: LegType
  /** Pincode or lane id */
  place: string
  partners: Id[]
  /** Shipments touching it in the last 30 days */
  demand: number
  action: 'recruit' | 'backup'
}

/**
 * ERP-21 gap list: serviceable pincodes with fewer than two first- or last-mile
 * partners, and lanes with fewer than two line-haul partners. Busiest first.
 */
export function coverageGaps(data: DemoData, now: IsoDateTime): Gap[] {
  const since = addDaysToDate(istDate(now), -30)
  const recent = Object.values(data.shipments).filter((s) => istDate(s.bookedAt) >= since)
  const cov = pincodeCoverage(data)
  const out: Gap[] = []
  for (const pin of Object.values(data.pincodes)) {
    if (!pin.serviceable) continue
    for (const legType of ['firstMile', 'lastMile'] as const) {
      const partners = cov[pin.code][legType]
      if (partners.length >= 2) continue
      const demand = recent.filter((s) => (legType === 'firstMile' ? s.originPincode : s.destPincode) === pin.code).length
      out.push({ key: `${legType}-${pin.code}`, legType, place: pin.code, partners, demand, action: partners.length ? 'backup' : 'recruit' })
    }
  }
  for (const lane of Object.values(data.lanes)) {
    const partners = lanePartners(data, lane.id)
    if (partners.length >= 2) continue
    const demand = recent.filter((s) => s.laneId === lane.id).length
    out.push({ key: `lineHaul-${lane.id}`, legType: 'lineHaul', place: lane.id, partners, demand, action: partners.length ? 'backup' : 'recruit' })
  }
  return out.sort((a, b) => a.partners.length - b.partners.length || b.demand - a.demand)
}

/** PP-18 utilisation: jobs vs capacity per day. */
export function utilisation(data: DemoData, partnerId: Id, from: IsoDate, days: number) {
  const p = data.partners[partnerId]
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysToDate(from, i)
    const capacity = effectiveCapacity(p, data.settings.probationVolumeCutPct, date)
    const jobs = capacity ? partnerLoad(data, partnerId, date) : 0
    return { date, jobs, capacity, pct: capacity ? Math.round((jobs / capacity) * 100) : 0, closed: !!p.closedDates?.includes(date), override: p.capacityOverrides?.[date] }
  })
}

/**
 * SIMULATED demand forecast (source §12 "Demand forecasting", Phase 2;
 * ERP spec: seeded values): next 14 days of shipments per lane, growing with
 * the lane's recent volume, against the line-haul partners' declared capacity.
 */
export function laneForecast(data: DemoData, laneId: Id, now: IsoDateTime) {
  const lane = data.lanes[laneId]
  const since = addDaysToDate(istDate(now), -14)
  const recent = Object.values(data.shipments).filter((s) => s.laneId === laneId && istDate(s.bookedAt) >= since).length
  const base = Math.max(4, Math.round((recent / 14) * 40)) // modelled shipments stand in for ~40× real volume
  const growth = lane.originRegion === 'Delhi NCR' && lane.destRegion !== 'Mumbai' ? 0.18 : 0.06
  const capacity = lanePartners(data, laneId).reduce((s, id) => s + data.partners[id].capacityPerDay, 0)
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = addDaysToDate(istDate(now), i + 1)
    const weekday = new Date(`${date}T12:00:00+05:30`).getUTCDay()
    const season = weekday === 0 ? 0.4 : weekday === 6 ? 0.8 : 1
    return { date, volume: Math.round(base * (1 + (growth * (i + 1)) / 7) * season), capacity }
  })
  return { days, growthPct: Math.round(growth * 100) }
}
