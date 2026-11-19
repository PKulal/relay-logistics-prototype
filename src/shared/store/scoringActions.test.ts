import { buildSeed, DEMO_START } from '@data/seed'
import { liveKpis } from '@shared/engines/liveScore'
import { band, damagePct, points, proposeTier, runnableWeeks, runRows, scoresOf, toNextTier, totalOf } from '@shared/engines/scoring'
import { addDays } from '@shared/lib/time'
import { acknowledgePlan, approveClose, decideInFlight, freezePartner, moveToSettlement, openSuspensionCase, overrideTier, publishScores, requestClose, respondToCase, runWeeklyScoring } from './scoringActions'

const now = DEMO_START
const SWC = { pickup: 96, onTime: 91, firstAttempt: 88, damagePer10k: 4, damagePct: 85, scanCompliance: 95, responsiveness: 45 }

describe('scoring engine (source §5.2, §5.3; Partner Portal spec §7.3)', () => {
  it('SwiftCity Parcel: 14.4 + 22.8 + 13.2 + 17.0 + 14.3 + 4.5 = 86.2 → Gold', () => {
    expect(damagePct(4)).toBe(85)
    expect(points(SWC, 'parcel')).toEqual({ pickup: 14.4, onTime: 22.8, firstAttempt: 13.2, damage: 17, scanCompliance: 14.3, responsiveness: 4.5 })
    expect(totalOf(SWC, 'parcel')).toBe(86.2)
    expect(band(86.2)).toBe('gold')
    expect(toNextTier(86.2, 'gold')).toEqual({ next: 'platinum', points: 3.8 })
  })

  it('tier rules: up at once; Platinum grace for one week; Gold → plan; Silver → warning; Bronze → Probation; Probation twice → review', () => {
    expect(proposeTier('silver', 81)).toEqual({ tier: 'gold', rule: 'up' })
    expect(proposeTier('platinum', 88, 92)).toEqual({ tier: 'platinum', rule: 'platinumGrace' })
    expect(proposeTier('platinum', 88, 89)).toEqual({ tier: 'gold', rule: 'platinumDown' })
    expect(proposeTier('gold', 78)).toEqual({ tier: 'silver', rule: 'improvementPlan' })
    expect(proposeTier('silver', 68)).toEqual({ tier: 'bronze', rule: 'warning' })
    expect(proposeTier('bronze', 57)).toEqual({ tier: 'probation', rule: 'volumeCut' })
    expect(proposeTier('probation', 56)).toEqual({ tier: 'probation', rule: 'suspensionReview' })
  })

  it('seed: every scored partner has 12 published weeks ending at its score; 16–22 Nov waits to publish', () => {
    const d = buildSeed()
    for (const p of Object.values(d.partners).filter((x) => x.tier)) {
      const pub = scoresOf(d, p.id)
      expect(pub).toHaveLength(12)
      expect(Math.round(pub.at(-1)!.total)).toBe(p.score)
    }
    expect(runnableWeeks(d, now)).toEqual(['2026-11-16'])
    const rows = runRows(d, '2026-11-16')
    expect(rows.filter((r) => r.final !== r.current).map((r) => [r.partner.id, r.current, r.final, r.rule])).toEqual([
      ['P-FASTTRACK', 'bronze', 'probation', 'volumeCut'],
      ['P-BHIWANDI', 'gold', 'silver', 'improvementPlan'],
    ])
    expect(rows.find((r) => r.partner.id === 'P-SWIFTCITY')!.score.total).toBe(86.2)
  })

  it('live KPIs for this week come from the demo data', () => {
    const d = buildSeed()
    const live = liveKpis(d, 'P-SWIFTCITY', '2026-11-16', '2026-11-22')
    expect(live.detail.onTime.counted).toBeGreaterThan(0)
    expect(live.total).toBeGreaterThan(0)
  })
})

describe('scoring and suspension actions', () => {
  it('publish: scores and tiers change; Bhiwandi gets an improvement plan; overrides need a reason', () => {
    let d = buildSeed()
    const fast = runRows(d, '2026-11-16').find((r) => r.partner.id === 'P-FASTTRACK')!
    expect(overrideTier(d, fast.score.id, 'bronze', ' ', 'LS-MEERA', now)).toBe(d)
    const r = runWeeklyScoring(d, 'LS-MEERA', now)
    expect(r.week).toBe('2026-11-16')
    d = r.data
    expect(d.partners['P-FASTTRACK']).toMatchObject({ tier: 'probation', score: 57 })
    expect(d.partners['P-SWIFTCITY']).toMatchObject({ tier: 'gold', score: 86 })
    expect(d.partners['P-BHIWANDI'].tier).toBe('silver')
    const plan = Object.values(d.improvementPlans)[0]
    expect(plan).toMatchObject({ partnerId: 'P-BHIWANDI', deadline: '2026-12-21', coordinatorId: d.partners['P-BHIWANDI'].coordinatorId })
    expect(plan.targets).toHaveLength(2)
    d = acknowledgePlan(d, plan.id, 'PU-SAMEER', now)
    expect(d.improvementPlans[plan.id].acknowledgedBy).toBe('PU-SAMEER')
    expect(runnableWeeks(d, now)).toEqual([])
    expect(publishScores(d, '2026-11-16', 'LS-MEERA', now)).toBe(d)
  })

  it('an override with a reason replaces the proposed tier', () => {
    let d = buildSeed()
    const fast = runRows(d, '2026-11-16').find((r) => r.partner.id === 'P-FASTTRACK')!
    d = overrideTier(d, fast.score.id, 'bronze', 'Flood week in Bengaluru; one-off', 'LS-MEERA', now)
    d = publishScores(d, '2026-11-16', 'LS-MEERA', now)
    expect(d.partners['P-FASTTRACK'].tier).toBe('bronze')
  })

  it('FastTrack: a second week below 60 opens a review → freeze → transfer / finish → settle → checker closes', () => {
    let d = runWeeklyScoring(buildSeed(), 'LS-MEERA', now).data
    const later = addDays(now, 7)
    expect(runnableWeeks(d, later)).toEqual(['2026-11-23'])
    d = runWeeklyScoring(d, 'system', later).data
    const c = Object.values(d.suspensionCases)[0]
    expect(c).toMatchObject({ partnerId: 'P-FASTTRACK', trigger: 'scoreBelow60', auto: true, step: 1 })
    expect(openSuspensionCase(d, 'P-FASTTRACK', 'fraud', 'x', 'LS-MEERA', later)).toBe(d) // one open case per partner

    d = freezePartner(d, c.id, 'LS-MEERA', later)
    expect(d.partners['P-FASTTRACK'].status).toBe('suspended')
    let k = d.suspensionCases[c.id]
    expect(k.step).toBe(2)
    expect(k.inFlight.length).toBeGreaterThan(0)
    for (const i of k.inFlight) {
      const leg = d.legs[i.legId]
      const next = decideInFlight(d, c.id, i.legId, leg.status === 'inProgress' ? 'finish' : 'transfer', 'LS-MEERA', later)
      d = next === d ? decideInFlight(d, c.id, i.legId, 'finish', 'LS-MEERA', later) : next
    }
    k = d.suspensionCases[c.id]
    expect(k.inFlight.every((i) => i.decision)).toBe(true)
    expect(k.inFlight.some((i) => i.decision === 'transfer')).toBe(true)
    for (const i of k.inFlight.filter((x) => x.decision === 'transfer')) expect(d.legs[i.legId].partnerId).toBe(i.toPartnerId)
    d = moveToSettlement(d, c.id, 'LS-MEERA', later)
    expect(d.suspensionCases[c.id].settlement!.finalPayout).toBeGreaterThan(0)
    d = respondToCase(d, c.id, 'We are hiring two riders; please review', 'PU-IMRAN', later)
    d = requestClose(d, c.id, 'LS-MEERA', later)
    expect(approveClose(d, c.id, 'LS-MEERA', later)).toBe(d) // maker can't check
    d = approveClose(d, c.id, 'LS-RAHUL', later)
    expect(d.partners['P-FASTTRACK'].status).toBe('offboarded')
    expect(d.suspensionCases[c.id]).toMatchObject({ step: 'closed', checkerId: 'LS-RAHUL' })
    expect(d.payouts[d.suspensionCases[c.id].payoutId!]).toMatchObject({ kind: 'final', status: 'paid' })
    expect(d.suspensionCases[c.id].log.some((l) => l.app === 'partnerPortal')).toBe(true)
  })
})
