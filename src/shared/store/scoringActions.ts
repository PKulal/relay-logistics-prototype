/**
 * Scoring and suspension (source §5.2 scorecard, §5.3 tiers and consequences,
 * §5.4 suspension and offboarding; §4 Step 8 weekly tier review).
 * ERP-16 publish (and the demo toolbar's "Run weekly scoring"), PP-24
 * improvement-plan acknowledgement, ERP-17 / PP-39 suspension cases.
 */
import { invoicePayable, matchedAmount, payoutLine, unbilledLegs } from '@shared/engines/payables'
import { round2 } from '@shared/engines/money'
import { bestBackup } from '@shared/engines/controlTower'
import { runnableWeeks, runRows, weakestKpis } from '@shared/engines/scoring'
import { addDaysToDate, istDate } from '@shared/lib/time'
import { simulateUtr } from '@shared/sim/payment'
import type { AppKey, DemoData, Id, IsoDate, IsoDateTime, Notification, Payout, SuspensionCase, SuspensionTrigger, Tier } from '@shared/types'
import { reassignLeg } from './controlTowerActions'
import { audit } from './erpActions'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const toPartner = (partnerId: Id) => ({ app: 'partnerPortal' as const, partnerId })
const PLAN_WEEKS = 4

// ── ERP-16 ──────────────────────────────────────────────────────────────────

/** Change a proposed tier with a reason before publishing (assumed). Empty reason clears it. */
export function overrideTier(data: DemoData, scoreId: Id, tier: Tier | undefined, reason: string, by: Id, at: IsoDateTime): DemoData {
  const w = data.weeklyScores[scoreId]
  if (!w || w.published || (tier && !reason.trim())) return data
  const next = { ...data, weeklyScores: { ...data.weeklyScores, [scoreId]: { ...w, override: tier ? { tier, reason: reason.trim(), by } : undefined } } }
  return audit(next, { userId: by, app: 'erp', action: 'score.override', recordId: scoreId, at, after: { tier, reason } })
}

/**
 * Publish a week: scores and tiers go to the Partner Portal; the score drives
 * assignment ranking and the tier the payout cycle (no other change needed).
 * Gold below band → improvement plan; Probation for a second week → a
 * suspension review case opens.
 */
export function publishScores(data: DemoData, week: IsoDate, by: Id, at: IsoDateTime): DemoData {
  const rows = runRows(data, week).filter((r) => !r.score.published)
  if (!rows.length) return data
  let next = data
  for (const r of rows) {
    const p = next.partners[r.partner.id]
    next = {
      ...next,
      partners: { ...next.partners, [p.id]: { ...p, score: Math.round(r.score.total), tier: r.final } },
      weeklyScores: { ...next.weeklyScores, [r.score.id]: { ...r.score, published: true, publishedAt: at, publishedBy: by, tierBefore: r.current, tierAfter: r.final, rule: r.rule } },
    }
    const label = `${r.score.total} · ${r.current} → ${r.final}`
    next = notify(next, toPartner(p.id), 'Weekly scorecard published', label, '/partner/scorecard', at)
    if (r.rule === 'improvementPlan' && r.final !== r.current) {
      const id = `IP-${p.id.slice(2)}-${week}`
      next = { ...next, improvementPlans: { ...next.improvementPlans, [id]: { id, partnerId: p.id, week, targets: weakestKpis(r.score), deadline: addDaysToDate(istDate(at), PLAN_WEEKS * 7), coordinatorId: p.coordinatorId ?? by, createdAt: at } } }
      next = notify(next, toPartner(p.id), 'Improvement plan', `${PLAN_WEEKS} weeks`, '/partner/scorecard/tier', at)
    }
    if (r.rule === 'suspensionReview' && !openCaseOf(next, p.id)) next = openSuspensionCase(next, p.id, 'scoreBelow60', `Probation for 2 weeks (${r.score.total})`, 'system', at, true)
  }
  return audit(next, { userId: by, app: 'erp', action: 'scores.publish', recordId: week, at, after: { partners: rows.length } })
}

/** Demo toolbar "Run weekly scoring": publish the oldest finished week with the proposed tiers. */
export function runWeeklyScoring(data: DemoData, by: Id, at: IsoDateTime): { data: DemoData; week?: IsoDate } {
  const week = runnableWeeks(data, at)[0]
  return week ? { data: publishScores(data, week, by, at), week } : { data }
}

/** PP-24 "Acknowledge improvement plan". */
export function acknowledgePlan(data: DemoData, planId: Id, by: Id, at: IsoDateTime): DemoData {
  const p = data.improvementPlans[planId]
  if (!p || p.acknowledgedAt) return data
  return audit({ ...data, improvementPlans: { ...data.improvementPlans, [planId]: { ...p, acknowledgedAt: at, acknowledgedBy: by } } }, { userId: by, app: 'partnerPortal', action: 'plan.acknowledge', recordId: planId, at })
}

// ── ERP-17 / PP-39 suspension and offboarding ───────────────────────────────

export const openCaseOf = (data: DemoData, partnerId: Id) => Object.values(data.suspensionCases).find((c) => c.partnerId === partnerId && c.step !== 'closed')
const IN_FLIGHT = ['offered', 'accepted', 'flagged', 'assigned', 'inProgress']
const setCase = (data: DemoData, c: SuspensionCase): DemoData => ({ ...data, suspensionCases: { ...data.suspensionCases, [c.id]: c } })
const logged = (c: SuspensionCase, by: Id, app: AppKey, text: string, at: IsoDateTime): SuspensionCase => ({ ...c, log: [...c.log, { at, by, app, text }] })

export function openSuspensionCase(data: DemoData, partnerId: Id, trigger: SuspensionTrigger, reason: string, by: Id, at: IsoDateTime, auto = false): DemoData {
  const p = data.partners[partnerId]
  if (!p || openCaseOf(data, partnerId) || !reason.trim() || p.status === 'offboarded') return data
  const id = `SUS-${String(Object.keys(data.suspensionCases).length + 1).padStart(4, '0')}`
  const c: SuspensionCase = { id, partnerId, trigger, reason: reason.trim(), auto, openedAt: at, openedBy: by, step: 1, inFlight: [], log: [{ at, by, app: 'erp', text: `Case opened: ${reason.trim()}` }] }
  let next = setCase(data, c)
  next = notify(next, toPartner(partnerId), 'Suspension review opened', reason.trim(), '/partner/case', at)
  next = notify(next, { app: 'erp', role: 'partnerManagement' }, 'Suspension review', `${p.shortName} · ${id}`, `/erp/partners/suspensions?case=${id}`, at)
  return audit(next, { userId: by, app: 'erp', action: 'suspension.open', recordId: id, at, after: { trigger, reason } })
}

/** Step 1: freeze new allocations; list the in-flight legs for step 2. */
export function freezePartner(data: DemoData, caseId: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.suspensionCases[caseId]
  if (!c || c.step !== 1) return data
  const p = data.partners[c.partnerId]
  const inFlight = Object.values(data.legs)
    .filter((l) => l.partnerId === p.id && IN_FLIGHT.includes(l.status))
    .map((l) => ({ legId: l.id }))
  let next: DemoData = { ...data, partners: { ...data.partners, [p.id]: { ...p, status: 'suspended' } } }
  next = setCase(next, logged({ ...c, step: 2, frozenAt: at, inFlight }, by, 'erp', `Step 1: new allocations frozen; ${inFlight.length} in-flight jobs`, at))
  next = notify(next, toPartner(p.id), 'New allocations frozen', caseId, '/partner/case', at)
  return audit(next, { userId: by, app: 'erp', action: 'suspension.freeze', recordId: caseId, at })
}

/** Step 2: the partner finishes the job, or it moves to the best eligible backup partner (ERP-08). */
export function decideInFlight(data: DemoData, caseId: Id, legId: Id, decision: 'finish' | 'transfer', by: Id, at: IsoDateTime): DemoData {
  const c = data.suspensionCases[caseId]
  const item = c?.inFlight.find((i) => i.legId === legId)
  if (!c || c.step !== 2 || !item || item.decision) return data
  let next = data
  let toPartnerId: Id | undefined
  if (decision === 'transfer') {
    const backup = bestBackup(data, legId)
    if (!backup) return data
    toPartnerId = backup.partnerId
    next = reassignLeg(next, { legId, partnerId: backup.partnerId, reason: 'quality', notify: { oldPartner: true, newPartner: true, customer: false } }, by, at)
    if (next.legs[legId].partnerId !== backup.partnerId) return data
  }
  const inFlight = c.inFlight.map((i) => (i.legId === legId ? { ...i, decision, toPartnerId } : i))
  const text = decision === 'transfer' ? `${legId} transferred to ${data.partners[toPartnerId!].shortName}` : `${legId}: partner finishes`
  return setCase(next, logged({ ...c, inFlight }, by, 'erp', text, at))
}

/** What the partner is owed at exit: approved invoices and completed, unbilled legs (with GST), less deductions with evidence. */
export function finalSettlement(data: DemoData, partnerId: Id, at: IsoDateTime): NonNullable<SuspensionCase['settlement']> {
  const line = payoutLine(data, partnerId, addDaysToDate(istDate(at), 365))
  const invoices = Object.values(data.partnerInvoices).filter((i) => i.partnerId === partnerId && (i.status === 'approved' || i.status === 'matched')).reduce((s, i) => s + invoicePayable(data, i), 0)
  const legs = unbilledLegs(data, partnerId).reduce((s, l) => s + matchedAmount(data, data.legs[l.id]), 0) * (1 + data.settings.gstPct / 100)
  const earnings = round2(invoices + legs)
  const deductions = line?.deductions ?? []
  return { earnings, deductions, finalPayout: round2(earnings - deductions.reduce((s, d) => s + d.amount, 0)) }
}

/** Step 2 → 3 once every in-flight job has a decision. */
export function moveToSettlement(data: DemoData, caseId: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.suspensionCases[caseId]
  if (!c || c.step !== 2 || c.inFlight.some((i) => !i.decision)) return data
  const settlement = finalSettlement(data, c.partnerId, at)
  const done = c.inFlight.filter((i) => i.decision === 'finish').length
  return setCase(data, logged({ ...c, step: 3, settlement }, by, 'erp', `Step 2 done: ${done} finish, ${c.inFlight.length - done} transferred. Final payout ₹${settlement.finalPayout}`, at))
}

/** Maker asks to close; the checker (a different person) approves. */
export function requestClose(data: DemoData, caseId: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.suspensionCases[caseId]
  if (!c || c.step !== 3 || c.closeRequestedBy) return data
  const next = setCase(data, logged({ ...c, closeRequestedBy: by, closeRequestedAt: at }, by, 'erp', 'Step 3: settlement submitted for approval', at))
  return notify(next, { app: 'erp', role: 'leadership' }, 'Offboarding to approve', `${data.partners[c.partnerId].shortName} · ${caseId}`, `/erp/partners/suspensions?case=${caseId}`, at)
}

/**
 * Checker: final payout (SIMULATED NEFT / UTR), app and API access revoked,
 * records archived; the partner is offboarded.
 */
export function approveClose(data: DemoData, caseId: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.suspensionCases[caseId]
  if (!c || c.step !== 3 || !c.closeRequestedBy || c.closeRequestedBy === by || !c.settlement) return data
  const p = data.partners[c.partnerId]
  const pid = `PO-FINAL-${p.id.slice(2)}`
  const payout: Payout = { id: pid, partnerId: p.id, kind: 'final', gross: c.settlement.earnings, deductions: c.settlement.deductions, net: c.settlement.finalPayout, dueDate: istDate(at), mode: 'NEFT', utr: simulateUtr(pid, istDate(at)), paidAt: at, status: 'paid' }
  let next: DemoData = { ...data, payouts: { ...data.payouts, [pid]: payout }, partners: { ...data.partners, [p.id]: { ...p, status: 'offboarded', autoAccept: false } } }
  next = setCase(next, logged({ ...c, step: 'closed', checkerId: by, closedAt: at, payoutId: pid }, by, 'erp', `Closed: final payout ₹${payout.net} (UTR ${payout.utr}); app and API access revoked; records archived`, at))
  next = notify(next, toPartner(p.id), 'Offboarding complete', `Final payout ₹${payout.net} · UTR ${payout.utr}`, '/partner/case', at)
  return audit(next, { userId: by, app: 'erp', action: 'suspension.close', recordId: caseId, at, after: { finalPayout: payout.net } })
}

/** PP-39 "Respond / appeal": added to the case log (assumed). */
export function respondToCase(data: DemoData, caseId: Id, text: string, by: Id, at: IsoDateTime): DemoData {
  const c = data.suspensionCases[caseId]
  if (!c || !text.trim()) return data
  const next = setCase(data, logged(c, by, 'partnerPortal', text.trim(), at))
  return notify(next, { app: 'erp', role: 'partnerManagement' }, 'Partner responded to a suspension case', `${data.partners[c.partnerId].shortName} · ${caseId}`, `/erp/partners/suspensions?case=${caseId}`, at)
}
