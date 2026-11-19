/**
 * Weekly scores (ERP-16, PP-23, PP-24). seed-data.md fixes SwiftCity's last-
 * week scorecard (16–22 Nov: 96 / 91 / 88 / 4 per 10k / 95 / 45 → 86.2) and
 * FastTrack "Bronze 61 → Probation 57 after the scoring run"; every partner's
 * current score is the total of its last published week.
 * INVENTED: the 12 published weeks of history (24-Aug to 09–15 Nov), every
 * other partner's KPIs, Bhiwandi's drop to 78 (improvement plan demo) and the
 * 23–29 Nov week (FastTrack's second week below 60).
 */
import { damagePct, profileOf, totalOf } from '@shared/engines/scoring'
import { addDaysToDate } from '@shared/lib/time'
import type { DemoData, Partner, PartnerRateLine, Tier, WeeklyScore } from '@shared/types'

const HISTORY_FROM = '2026-08-24'
const HISTORY_WEEKS = 12
const RUN_WEEK = '2026-11-16'
const NEXT_WEEK = '2026-11-23'

type Kpis = WeeklyScore['kpis']

/** Small deterministic wobble per partner and week. */
function wobble(id: string, n: number): number {
  let h = 7
  for (const ch of `${id}#${n}`) h = (h * 31 + ch.charCodeAt(0)) % 9973
  return (h % 21) / 10 - 1 // −1.0 … +1.0
}

const clamp = (n: number) => Math.max(20, Math.min(100, Math.round(n)))

/** KPIs whose total rounds to `target` (integer search on the weighted KPIs). */
function kpisFor(id: string, target: number, profile: WeeklyScore['profile'], n: number, min = 0): Kpis {
  const shift = (target - 85) * 1.1
  const base = { pickup: 94 + shift + wobble(id, n) * 2, onTime: 89 + shift, firstAttempt: 87 + shift * 0.8, scan: 93 + shift * 0.9, resp: 55 + shift * 2 + wobble(id, n + 50) * 8 }
  let per10k = Math.max(1, Math.round(5 - shift / 6))
  const make = (onTime: number): Kpis => ({ pickup: clamp(base.pickup), onTime: clamp(onTime), firstAttempt: clamp(base.firstAttempt), damagePer10k: per10k, damagePct: damagePct(per10k), scanCompliance: clamp(base.scan), responsiveness: clamp(base.resp) })
  let best = make(base.onTime)
  for (let tries = 0; tries < 2; tries++) {
    for (let d = 0; d <= 60; d++) {
      for (const s of [d, -d]) {
        const k = make(base.onTime + s)
        if (Math.round(totalOf(k, profile)) === target && totalOf(k, profile) >= min) return k
        if (Math.abs(totalOf(k, profile) - target) < Math.abs(totalOf(best, profile) - target)) best = k
      }
    }
    per10k = Math.max(0, per10k + (totalOf(best, profile) > target ? 3 : -2))
  }
  return best
}

/** Stay inside the tier's band so history doesn't flip tiers. */
const BANDS: Record<Tier, [number, number]> = { platinum: [90, 98], gold: [80, 89], silver: [70, 79], bronze: [60, 69], probation: [45, 59] }

function score(p: Partner, week: string, kpis: Kpis, published: boolean, tier: Tier | null): WeeklyScore {
  const profile = profileOf(p)
  return { id: `WS-${p.id.slice(2)}-${week}`, partnerId: p.id, week, profile, kpis, total: totalOf(kpis, profile), tierBefore: tier, tierAfter: published ? tier : null, published, ...(published ? { publishedAt: `${addDaysToDate(week, 7)}T10:00:00+05:30`, publishedBy: 'LS-MEERA', rule: 'same' as const } : {}) }
}

/** seed-data.md §6 */
const SWIFTCITY_LAST: Kpis = { pickup: 96, onTime: 91, firstAttempt: 88, damagePer10k: 4, damagePct: 85, scanCompliance: 95, responsiveness: 45 }
/** 85.6 (rounds to the seeded 86) so the run's 86.2 shows a small rise */
const SWIFTCITY_PREV: Kpis = { pickup: 93, onTime: 91, firstAttempt: 88, damagePer10k: 4, damagePct: 85, scanCompliance: 94, responsiveness: 45 }

const RUN_TARGET: Record<string, number> = { 'P-FASTTRACK': 57, 'P-BHIWANDI': 78 }
const NEXT_TARGET: Record<string, number> = { 'P-FASTTRACK': 56, 'P-BHIWANDI': 78 }

export function buildWeeklyScores(partners: Partner[]): WeeklyScore[] {
  const out: WeeklyScore[] = []
  for (const p of partners) {
    if (!p.tier) continue // partners in trial are not scored yet
    const [lo, hi] = BANDS[p.tier]
    for (let n = 0; n < HISTORY_WEEKS; n++) {
      const week = addDaysToDate(HISTORY_FROM, n * 7)
      const last = n === HISTORY_WEEKS - 1
      const target = last ? p.score : Math.max(lo + 1, Math.min(hi - 1, Math.round(p.score + wobble(p.id, n) * 2.5)))
      out.push(score(p, week, p.id === 'P-SWIFTCITY' && last ? SWIFTCITY_PREV : kpisFor(p.id, target, profileOf(p), n, lo), true, p.tier))
    }
    const runTarget = RUN_TARGET[p.id] ?? Math.max(lo + 1, Math.min(hi - 1, Math.round(p.score + wobble(p.id, 20))))
    out.push(score(p, RUN_WEEK, p.id === 'P-SWIFTCITY' ? SWIFTCITY_LAST : kpisFor(p.id, runTarget, profileOf(p), 20, RUN_TARGET[p.id] ? 0 : lo), false, null))
    // Next week: the tier after the run (FastTrack is on Probation by then)
    const nextTarget = NEXT_TARGET[p.id] ?? Math.max(lo + 1, Math.min(hi - 1, Math.round(p.score + wobble(p.id, 21))))
    out.push(score(p, NEXT_WEEK, kpisFor(p.id, nextTarget, profileOf(p), 21, NEXT_TARGET[p.id] ? 0 : lo), false, null))
  }
  return out
}

/**
 * INVENTED: Doorstep Dash expanded into Bengaluru on 21-Nov, after the seeded
 * jobs were assigned. It is the backup the Control Tower can transfer
 * FastTrack's in-flight jobs to (ERP-17 step 2). New Bengaluru bookings rank
 * it above FastTrack (higher score).
 */
export function addBengaluruBackup(data: DemoData): DemoData {
  const p = data.partners['P-DOORSTEP']
  if (!p) return data
  const n = Object.keys(data.partnerRates).length
  const rate = (i: number, legType: 'firstMile' | 'lastMile', serviceKind: 'ptl' | 'parcel', r: number): PartnerRateLine => ({ id: `PRL-${String(n + i).padStart(3, '0')}`, partnerId: p.id, legType, laneOrCluster: 'HUB-BLR', serviceKind, rate: r, unit: 'perShipment', ...(serviceKind === 'ptl' ? { maxKg: 200 } : {}) })
  // Same rates as FastTrack, so lane costs and margins don't move
  const lines = [rate(1, 'firstMile', 'ptl', 240), rate(2, 'firstMile', 'parcel', 32), rate(3, 'lastMile', 'ptl', 260), rate(4, 'lastMile', 'parcel', 34)]
  return {
    ...data,
    partners: { ...data.partners, [p.id]: { ...p, coveragePincodes: [...p.coveragePincodes, '560058', '560001', '570001'] } },
    partnerRates: { ...data.partnerRates, ...Object.fromEntries(lines.map((l) => [l.id, l])) },
  }
}
