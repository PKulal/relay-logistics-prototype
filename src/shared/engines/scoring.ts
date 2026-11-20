/**
 * Partner scoring (source §5.2 six KPIs with Parcel / PTL weights; §5.3 tiers
 * and consequences). KPI-to-points: KPI % × weight; damage % = 100 − 3.75 ×
 * claims per 10,000 pieces (Partner Portal spec §7.2, assumed). The total is
 * the sum of the rounded points (SwiftCity: 86.2).
 */
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { DemoData, Id, IsoDate, IsoDateTime, KpiKey, Partner, Tier, TierRule, WeeklyScore } from '@shared/types'

export const KPI_KEYS: KpiKey[] = ['pickup', 'onTime', 'firstAttempt', 'damage', 'scanCompliance', 'responsiveness']

export const WEIGHTS: Record<WeeklyScore['profile'], Record<KpiKey, number>> = {
  parcel: { pickup: 15, onTime: 25, firstAttempt: 15, damage: 20, scanCompliance: 15, responsiveness: 10 },
  ptl: { pickup: 15, onTime: 30, firstAttempt: 10, damage: 25, scanCompliance: 10, responsiveness: 10 },
}

/** Parcel profile for courier-type partners (A, B, C); PTL & line-haul for transporters and hubs (assumed). */
export const profileOf = (p: Partner): WeeklyScore['profile'] => (['A', 'B', 'C'].includes(p.type) ? 'parcel' : 'ptl')

export const damagePct = (per10k: number) => Math.max(0, Math.round((100 - 3.75 * per10k) * 10) / 10)
const r1 = (n: number) => Math.round(n * 10) / 10

export function kpiPct(k: WeeklyScore['kpis'], key: KpiKey): number {
  return key === 'damage' ? k.damagePct : k[key]
}

export function points(k: WeeklyScore['kpis'], profile: WeeklyScore['profile']): Record<KpiKey, number> {
  const w = WEIGHTS[profile]
  return Object.fromEntries(KPI_KEYS.map((key) => [key, r1((kpiPct(k, key) * w[key]) / 100)])) as Record<KpiKey, number>
}

export const totalOf = (k: WeeklyScore['kpis'], profile: WeeklyScore['profile']) => r1(Object.values(points(k, profile)).reduce((s, x) => s + x, 0))

// ── Tiers ───────────────────────────────────────────────────────────────────

export const TIERS: Tier[] = ['platinum', 'gold', 'silver', 'bronze', 'probation']
export const BAND_FLOOR: Record<Tier, number> = { platinum: 90, gold: 80, silver: 70, bronze: 60, probation: 0 }
/** Tier for a score; `floors` = the ERP-44 tier bands (data.settings.tierBands) */
export const band = (score: number, floors: Record<Tier, number> = BAND_FLOOR): Tier => TIERS.find((t) => score >= floors[t])!

/** ERP-44 tier bands as floors (Probation below Bronze). */
export const floorsOf = (bands: { platinum: number; gold: number; silver: number; bronze: number }): Record<Tier, number> => ({ ...bands, probation: 0 })
const rank = (t: Tier) => TIERS.indexOf(t)

/** The tier engine (source §5.3). `prevTotal` is the week before, for Platinum's 2-week grace. */
export function proposeTier(current: Tier, total: number, prevTotal?: number, floors: Record<Tier, number> = BAND_FLOOR): { tier: Tier; rule: TierRule } {
  const target = band(total, floors)
  if (rank(target) < rank(current)) return { tier: target, rule: 'up' }
  if (target === current) return { tier: current, rule: current === 'probation' ? 'suspensionReview' : 'same' }
  switch (current) {
    case 'platinum':
      return prevTotal !== undefined && prevTotal < floors.platinum ? { tier: 'gold', rule: 'platinumDown' } : { tier: 'platinum', rule: 'platinumGrace' }
    case 'gold':
      return { tier: target, rule: 'improvementPlan' }
    case 'silver':
      return { tier: target, rule: 'warning' }
    default:
      return { tier: 'probation', rule: 'volumeCut' }
  }
}

export const BENEFITS: Record<Tier, string[]> = {
  platinum: ['firstChoice', 'payout3Days', 'volumeCommitments', 'coBranding'],
  gold: ['priorityAssignment', 'weeklyPayout', 'earlyPay'],
  silver: ['normalAssignment', 'weeklyPayout', 'earlyPay'],
  bronze: ['cappedVolume', 'fortnightlyPayout'],
  probation: ['essentialOnly'],
}

// ── Weeks and runs ──────────────────────────────────────────────────────────

export const weekEnd = (week: IsoDate) => addDaysToDate(week, 6)

export const scoresOf = (data: DemoData, partnerId: Id, publishedOnly = true) =>
  Object.values(data.weeklyScores)
    .filter((w) => w.partnerId === partnerId && (!publishedOnly || w.published))
    .sort((a, b) => a.week.localeCompare(b.week))

/** Finished weeks with scores waiting to publish (oldest first). */
export function runnableWeeks(data: DemoData, now: IsoDateTime): IsoDate[] {
  const today = istDate(now)
  return [...new Set(Object.values(data.weeklyScores).filter((w) => !w.published && weekEnd(w.week) < today).map((w) => w.week))].sort()
}

export interface RunRow {
  score: WeeklyScore
  partner: Partner
  points: Record<KpiKey, number>
  current: Tier
  proposed: Tier
  rule: TierRule
  final: Tier
}

/** ERP-16 results for a week: published rows show what was applied, others what would be. */
export function runRows(data: DemoData, week: IsoDate): RunRow[] {
  return Object.values(data.weeklyScores)
    .filter((w) => w.week === week)
    .map((w) => {
      const partner = data.partners[w.partnerId]
      const prev = scoresOf(data, w.partnerId).filter((x) => x.week < week).at(-1)
      const current = (w.published ? w.tierBefore : partner.tier) ?? 'bronze'
      const p = w.published && w.rule ? { tier: w.tierAfter!, rule: w.rule } : proposeTier(current, w.total, prev?.total, floorsOf(data.settings.tierBands))
      return { score: w, partner, points: points(w.kpis, w.profile), current, proposed: p.tier, rule: p.rule, final: w.override?.tier ?? p.tier }
    })
    .sort((a, b) => Number(b.final !== b.current) - Number(a.final !== a.current) || a.score.total - b.score.total)
}

/** The KPIs furthest below their weight's full marks: improvement plan targets. */
export function weakestKpis(w: WeeklyScore, n = 2): KpiKey[] {
  const p = points(w.kpis, w.profile)
  const wt = WEIGHTS[w.profile]
  return [...KPI_KEYS].sort((a, b) => wt[b] - p[b] - (wt[a] - p[a])).slice(0, n)
}

/** Points to the next tier up, if any. */
export function toNextTier(score: number, tier: Tier | null, floors: Record<Tier, number> = BAND_FLOOR): { next: Tier; points: number } | undefined {
  const t = tier ?? 'bronze'
  const i = rank(t)
  if (i === 0) return undefined
  const next = TIERS[i - 1]
  return { next, points: r1(Math.max(0, floors[next] - score)) }
}
