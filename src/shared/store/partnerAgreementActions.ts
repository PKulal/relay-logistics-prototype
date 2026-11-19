/**
 * Partner onboarding, Phases 3–5 (source §4 Steps 5–8): rate card, terms and
 * agreement with the AI margin check and counter-proposals (PP-08, ERP-13);
 * go-live setup (PP-09); monitored trial and go-live at Bronze (PP-10, ERP-14).
 */
import { CAPACITY_UNIT, trialJobScore, trialRequirement, trialScore, tripTrialJob } from '@shared/engines/partnerOnboarding'
import { partnerLineMargin } from '@shared/engines/rateCardMargin'
import { istDate } from '@shared/lib/time'
import type {
  ApiTestStep,
  DemoData,
  FieldStaff,
  Id,
  IsoDateTime,
  LegType,
  Notification,
  Partner,
  PartnerAgreement,
  PartnerAgreementLine,
  PartnerApplication,
  PartnerRateLine,
  TrialJob,
  Trip,
} from '@shared/types'
import { audit } from './erpActions'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const toPartner = (a: PartnerApplication) => ({ app: 'partnerPortal' as const, partnerId: a.partnerId })
const toDesk = { app: 'erp' as const, role: 'partnerManagement' }
const setApp = (data: DemoData, a: PartnerApplication): DemoData => ({ ...data, applications: { ...data.applications, [a.id]: a } })
const setPartner = (data: DemoData, p: Partner): DemoData => ({ ...data, partners: { ...data.partners, [p.id]: p } })
const appOf = (data: DemoData, partnerId: Id) =>
  Object.values(data.applications)
    .filter((a) => a.partnerId === partnerId)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0]

// ─── PP-08 / ERP-13 rate card, terms and agreement ───────────────────────────

/** Default terms (source §4 Step 5; values assumed, "to be confirmed" in the PP spec). */
export const DEFAULT_TERMS: Omit<PartnerAgreement, 'lines' | 'status'> = {
  cutoffs: { firstMile: '18:00', originHub: '21:00', lineHaul: '23:00', destHub: '06:00', lastMile: '10:00' },
  ticketAckHours: 2,
  penalties: { missedPickup: 100, lateArrival: 500, lateDelivery: 50, missedScan: 25, lateTicket: 200 },
  liabilityPerKg: 100,
  liabilityMax: 10000,
}

/** Network hub serving a city (via the pincode master). */
const hubOfCity = (data: DemoData, city: string) => Object.values(data.pincodes).find((p) => p.city === city && p.serviceable && p.hubId)?.hubId

/**
 * Draft lines from the application: one per declared lane (line-haul), per hub
 * cluster of the declared pincodes (first / last mile, parcel and PTL), and per
 * hub (hub legs), at the indicative rates.
 */
export function draftLines(data: DemoData, a: PartnerApplication): PartnerAgreementLine[] {
  const p = data.partners[a.partnerId]
  const rate = (leg: LegType) => a.indicativeRates.find((r) => r.leg === leg)?.rate ?? 0
  const lines: Omit<PartnerAgreementLine, 'id'>[] = []
  for (const leg of p.legs) {
    if (leg === 'lineHaul') {
      for (const l of a.lanes) {
        const o = hubOfCity(data, l.origin)
        const d = hubOfCity(data, l.dest)
        const lane = Object.values(data.lanes).find((n) => n.originHubId === o && n.destHubId === d)
        if (!lane) continue
        const destCity = data.hubs[lane.destHubId] && data.pincodes[data.hubs[lane.destHubId].pincode]?.city !== l.dest ? l.dest : undefined
        if (lines.some((x) => x.laneOrCluster === lane.id && x.destCity === destCity)) continue
        lines.push({ leg, laneOrCluster: lane.id, destCity, serviceKind: 'ptl', rate: rate(leg), unit: 'perKg', minKg: p.type === 'E' ? 50 : undefined, status: 'accepted' })
      }
    } else if (leg === 'firstMile' || leg === 'lastMile') {
      const clusters = [...new Set(a.pincodes.map((pin) => data.pincodes[pin]?.hubId).filter((h): h is Id => !!h))]
      for (const c of clusters) {
        if (a.services.includes('parcel')) lines.push({ leg, laneOrCluster: c, serviceKind: 'parcel', rate: rate(leg), unit: 'perShipment', status: 'accepted' })
        if (a.services.some((s) => s !== 'parcel')) lines.push({ leg, laneOrCluster: c, serviceKind: 'ptl', rate: Math.round(rate(leg) * 8), unit: 'perShipment', maxKg: 200, status: 'accepted' })
      }
    } else {
      const clusters = [...new Set(a.hubs.map((h) => data.pincodes[h.pincode]?.hubId).filter((h): h is Id => !!h))]
      for (const c of clusters) lines.push({ leg, laneOrCluster: c, rate: rate(leg), unit: CAPACITY_UNIT[p.type] === 'pieces' ? 'perPiece' : 'perKg', minimum: 150, status: 'accepted' })
    }
  }
  return lines.map((l, i) => ({ ...l, id: `${a.id}-L${i + 1}` }))
}

const agreementOf = (data: DemoData, a: PartnerApplication): PartnerAgreement => a.agreement ?? { ...DEFAULT_TERMS, lines: draftLines(data, a), status: 'draft' }

/** ERP-13: start the commercials from the application's indicative rates. */
export function draftPartnerAgreement(data: DemoData, appId: Id, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a || a.agreement || a.status !== 'agreement') return data
  return audit(setApp(data, { ...a, agreement: agreementOf(data, a) }), { userId: by, app: 'erp', action: 'partner.agreementDrafted', recordId: appId, at })
}

export type LineEdit = Partial<Pick<PartnerAgreementLine, 'rate' | 'minKg' | 'minimum'>>

/** ERP-13: edit a line while drafting or negotiating (a changed rate needs a fresh margin check / approval). */
export function editAgreementLine(data: DemoData, appId: Id, lineId: Id, e: LineEdit): DemoData {
  const a = data.applications[appId]
  const g = a?.agreement
  if (!g) return data
  const editable = (l: PartnerAgreementLine) => g.status !== 'signed' || l.status === 'notAccepted'
  return setApp(data, { ...a, agreement: { ...g, lines: g.lines.map((l) => (l.id === lineId && editable(l) ? { ...l, ...e, pricingApproval: e.rate !== undefined && e.rate !== l.rate ? undefined : l.pricingApproval } : l)) } })
}

export function editAgreementTerms(data: DemoData, appId: Id, t: Partial<Omit<PartnerAgreement, 'lines' | 'status'>>): DemoData {
  const a = data.applications[appId]
  if (!a?.agreement || a.agreement.status === 'signed') return data
  return setApp(data, { ...a, agreement: { ...a.agreement, ...t } })
}

/** ERP-13 checker: Pricing approves a line below target margin (maker-checker, assumed). */
export function approveLineBelowTarget(data: DemoData, appId: Id, lineId: Id, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a?.agreement) return data
  let next = setApp(data, { ...a, agreement: { ...a.agreement, lines: a.agreement.lines.map((l) => (l.id === lineId ? { ...l, pricingApproval: { by, at } } : l)) } })
  next = audit(next, { userId: by, app: 'erp', action: 'partner.lineApprovedBelowTarget', recordId: appId, at, after: { lineId } })
  return a.agreement.status === 'signed' ? settleSignedLine(next, appId, lineId, at) : next
}

/** Margin check result for a line: OK, or below target (approved or not), or no check possible. */
export function lineCheck(data: DemoData, partnerId: Id, l: PartnerAgreementLine): { m?: ReturnType<typeof partnerLineMargin>; ok: boolean } {
  const m = partnerLineMargin(data, partnerId, l)
  return { m, ok: !m || !m.belowTarget || !!l.pricingApproval }
}

/** ERP-13 Issue agreement: lines that fail the margin check go out as "not accepted". */
export function issuePartnerAgreement(data: DemoData, appId: Id, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a || a.status !== 'agreement') return data
  const g = agreementOf(data, a)
  if (g.status === 'signed') return data
  const lines = g.lines.map((l): PartnerAgreementLine => ({ ...l, counter: undefined, status: lineCheck(data, a.partnerId, l).ok ? 'accepted' : 'notAccepted' }))
  let next = setApp(data, { ...a, agreement: { ...g, lines, status: 'issued', issuedAt: at, issuedBy: by } })
  next = notify(next, toPartner(a), 'Rate card and agreement ready', a.ref, '/partner/onboarding/agreement', at)
  return audit(next, { userId: by, app: 'erp', action: 'partner.agreementIssued', recordId: appId, at, after: { notAccepted: lines.filter((l) => l.status === 'notAccepted').length } })
}

/** PP-08 Propose changes: counter-proposals go to the coordinator ("Under negotiation"). */
export function proposePartnerChanges(data: DemoData, appId: Id, counters: { lineId: Id; rate: number; remark: string }[], by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  const g = a?.agreement
  if (!g || !counters.length || !['issued', 'signed'].includes(g.status)) return data
  const lines = g.lines.map((l) => {
    const c = counters.find((x) => x.lineId === l.id)
    return c && (g.status !== 'signed' || l.status === 'notAccepted') ? { ...l, counter: { rate: c.rate, remark: c.remark.trim(), at } } : l
  })
  let next = setApp(data, { ...a, agreement: { ...g, lines, status: g.status === 'signed' ? 'signed' : 'negotiation' } })
  next = notify(next, toDesk, 'Partner counter-proposal', `${data.partners[a.partnerId].shortName} · ${counters.length}`, `/erp/partners/commercials?app=${appId}`, at)
  return audit(next, { userId: by, app: 'partnerPortal', action: 'partner.counterProposed', recordId: appId, at, after: counters })
}

/** Load one accepted line into the rate engine (after signature). */
function loadLine(data: DemoData, partnerId: Id, l: PartnerAgreementLine): DemoData {
  const id = `PR-${l.id}`
  const r: PartnerRateLine = { id, partnerId, legType: l.leg, laneOrCluster: l.laneOrCluster, serviceKind: l.serviceKind, rate: l.rate, unit: l.unit, minKg: l.minKg, minimum: l.minimum, maxKg: l.maxKg, destCity: l.destCity }
  // Replace the partner's existing line for the same lane / cluster and destination
  const others = Object.fromEntries(
    Object.entries(data.partnerRates).filter(([, x]) => !(x.partnerId === partnerId && x.legType === l.leg && x.laneOrCluster === l.laneOrCluster && x.destCity === l.destCity && (x.serviceKind ?? '') === (l.serviceKind ?? ''))),
  )
  return { ...data, partnerRates: { ...others, [id]: r } }
}

/** After signature, a line agreed later (negotiation) is accepted and loaded straight into the rate engine. */
function settleSignedLine(data: DemoData, appId: Id, lineId: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  const l = a.agreement!.lines.find((x) => x.id === lineId)!
  if (l.status === 'accepted' || !lineCheck(data, a.partnerId, l).ok) return data
  let next = setApp(data, { ...a, agreement: { ...a.agreement!, lines: a.agreement!.lines.map((x) => (x.id === lineId ? { ...x, status: 'accepted' } : x)) } })
  next = loadLine(next, a.partnerId, { ...l, status: 'accepted' })
  return notify(next, toPartner(a), 'Revised rate accepted', a.ref, '/partner/onboarding/agreement', at)
}

/**
 * ERP-13: answer a counter-proposal. Accepting sets the line to the partner's
 * rate (the margin check then decides). With no counters left the agreement is
 * re-issued; on a signed agreement an accepted line goes into the rate engine.
 */
export function answerCounter(data: DemoData, appId: Id, lineId: Id, accept: boolean, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  const g = a?.agreement
  const l = g?.lines.find((x) => x.id === lineId)
  if (!g || !l?.counter) return data
  const lines = g.lines.map((x) => (x.id === lineId ? { ...x, rate: accept ? l.counter!.rate : x.rate, counter: undefined, pricingApproval: accept ? undefined : x.pricingApproval } : x))
  let next = setApp(data, { ...a, agreement: { ...g, lines } })
  next = audit(next, { userId: by, app: 'erp', action: accept ? 'partner.counterAccepted' : 'partner.counterDeclined', recordId: appId, at, after: { lineId, rate: l.counter.rate } })
  if (g.status === 'signed') {
    if (!accept) return notify(next, toPartner(a), 'Revised rate not accepted', a.ref, '/partner/onboarding/agreement', at)
    return settleSignedLine(next, appId, lineId, at)
  }
  return lines.some((x) => x.counter) ? next : issuePartnerAgreement(next, appId, by, at)
}

/**
 * PP-08 Accept & e-sign (SIMULATED Aadhaar OTP / DSC): accepted lines are
 * loaded into the rate engine; the partner moves to go-live setup.
 */
export function signPartnerAgreement(data: DemoData, appId: Id, method: 'aadhaarOtp' | 'dsc', selfBilling: boolean, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  const g = a?.agreement
  if (!g || g.status !== 'issued') return data
  let next = setApp(data, { ...a, status: 'integration', agreement: { ...g, status: 'signed', signed: { at, by, method, selfBilling } } })
  next = setPartner(next, { ...next.partners[a.partnerId], status: 'integration' })
  for (const l of g.lines.filter((x) => x.status === 'accepted')) next = loadLine(next, a.partnerId, l)
  next = notify(next, toDesk, 'Partner agreement signed', `${data.partners[a.partnerId].shortName} · ${a.ref}`, `/erp/partners/commercials?app=${appId}`, at)
  return audit(next, { userId: by, app: 'partnerPortal', action: 'partner.agreementSigned', recordId: appId, at, after: { method, selfBilling } })
}

// ─── PP-09 go-live setup ──────────────────────────────────────────────────────

/** SIMULATED sandbox API key (PP-35 keeps the real keys later). */
export function generateSandboxKey(data: DemoData, appId: Id): DemoData {
  const a = data.applications[appId]
  if (!a) return data
  const tail = [...a.partnerId].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(16).slice(-4)
  return setApp(data, { ...a, setup: { ...a.setup, apiKey: `lg_p_sbx_${tail}` } })
}

export function setWebhook(data: DemoData, appId: Id, url: string): DemoData {
  const a = data.applications[appId]
  return a ? setApp(data, { ...a, setup: { ...a.setup, webhookUrl: url.trim(), tests: undefined } }) : data
}

export const API_TEST_STEPS: ApiTestStep[] = ['receive', 'accept', 'status', 'pod']

/** SIMULATED: a test job through the sandbox; every step passes on an HTTPS webhook. */
export function recordApiTest(data: DemoData, appId: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a?.setup?.apiKey || !a.setup.webhookUrl) return data
  const ok = /^https:\/\/\S+\.\S+/.test(a.setup.webhookUrl)
  return setApp(data, { ...a, setup: { ...a.setup, tests: API_TEST_STEPS.map((step, i) => ({ step, ok: ok || i === 0, at })) } })
}

export interface NewStaff {
  name: string
  mobile: string
  role: FieldStaff['role']
  language: FieldStaff['language']
  photo: string
  idProof: NonNullable<FieldStaff['idProof']>
}

/** Source §4 Step 6: add riders, drivers and hub staff with photo and ID. */
export function addFieldStaff(data: DemoData, partnerId: Id, s: NewStaff): DemoData {
  const n = Object.values(data.fieldStaff).filter((f) => f.partnerId === partnerId).length + 1
  const id = `FS-${partnerId.replace(/^P-/, '')}-${String(n).padStart(2, '0')}`
  const staff: FieldStaff = { id, partnerId, name: s.name.trim(), mobile: s.mobile.trim(), role: s.role, language: s.language, photo: s.photo, idProof: s.idProof, policeVerified: false, trained: false }
  return { ...data, fieldStaff: { ...data.fieldStaff, [id]: staff } }
}

/** SIMULATED: the staff member finishes practice mode in the Partner App. */
export function completePractice(data: DemoData, staffId: Id): DemoData {
  const s = data.fieldStaff[staffId]
  return s ? { ...data, fieldStaff: { ...data.fieldStaff, [staffId]: { ...s, trained: true } } } : data
}

/** API path for Types A and E; Partner App for the others (source §4 Step 6). */
export const usesApi = (p: Partner) => p.type === 'A' || p.type === 'E'

export function setupReady(data: DemoData, a: PartnerApplication): boolean {
  const p = data.partners[a.partnerId]
  if (usesApi(p)) return !!a.setup?.tests?.length && a.setup.tests.every((t) => t.ok)
  return Object.values(data.fieldStaff).some((s) => s.partnerId === p.id)
}

/**
 * PP-09 Mark ready for trial: the monitored trial starts. The partner can now
 * receive live jobs on its signed lanes (it joins the lane's partners).
 */
export function markReadyForTrial(data: DemoData, appId: Id, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a || a.status !== 'integration' || !setupReady(data, a)) return data
  const p = data.partners[a.partnerId]
  const req = trialRequirement(p.type, p.legs)
  const laneIds = [...new Set((a.agreement?.lines ?? []).filter((l) => l.leg === 'lineHaul' && l.status === 'accepted').map((l) => l.laneOrCluster))]
  let next = setApp(data, { ...a, status: 'trial', setup: { ...a.setup, readyAt: at } })
  next = setPartner(next, { ...p, status: 'trial', laneIds: [...new Set([...p.laneIds, ...laneIds])], trial: { tripsDone: 0, tripsRequired: req.required, score: 0, unit: req.unit, startedAt: at, jobs: [] } })
  next = { ...next, lanes: { ...next.lanes, ...Object.fromEntries(laneIds.map((id) => [id, { ...next.lanes[id], lineHaulPartnerIds: [...new Set([...next.lanes[id].lineHaulPartnerIds, p.id])] }])) } }
  next = notify(next, toDesk, 'Partner trial started', `${p.shortName} · ${req.required} ${req.unit}`, '/erp/partners/trials', at)
  return audit(next, { userId: by, app: 'partnerPortal', action: 'partner.trialStarted', recordId: appId, at })
}

// ─── PP-10 / ERP-14 monitored trial and go-live ──────────────────────────────

function addTrialJob(data: DemoData, partnerId: Id, job: TrialJob, at: IsoDateTime): DemoData {
  const p = data.partners[partnerId]
  if (!p?.trial || p.status !== 'trial' || p.trial.jobs?.some((j) => j.ref === job.ref)) return data
  const jobs = [...(p.trial.jobs ?? []), job]
  let next = setPartner(data, { ...p, trial: { ...p.trial, jobs, tripsDone: jobs.length, score: trialScore(jobs) } })
  if (jobs.length === p.trial.tripsRequired) next = notify(next, toDesk, 'Partner trial complete', `${p.shortName} · ${trialScore(jobs)}`, '/erp/partners/trials', at)
  return next
}

/** A line-haul trip of a partner in trial arrives: it is scored as a trial job. */
export function recordTripForTrial(data: DemoData, trip: Trip, at: IsoDateTime, simulated?: boolean): DemoData {
  const partnerId = data.vehicles[trip.vehicleId]?.partnerId
  return partnerId ? addTrialJob(data, partnerId, { ...tripTrialJob(trip, at), ...(simulated && { simulated }) }, at) : data
}

/** Demo tooling: a scored trial job for a partner with no live work in the demo data. */
const DEMO_JOB_SHAPES: Pick<TrialJob, 'onTime' | 'scanPct' | 'anomalies'>[] = [
  { onTime: true, scanPct: 100, anomalies: [] },
  { onTime: true, scanPct: 95, anomalies: ['weightGap'] },
  { onTime: false, scanPct: 100, anomalies: ['lateArrival'] },
]
export function simulateTrialJob(data: DemoData, partnerId: Id, at: IsoDateTime): DemoData {
  const p = data.partners[partnerId]
  if (!p?.trial) return data
  const n = (p.trial.jobs?.length ?? 0) + 1
  const shape = DEMO_JOB_SHAPES[(n - 1) % DEMO_JOB_SHAPES.length]
  const leg: LegType = p.legs.includes('lineHaul') ? 'lineHaul' : p.legs[0]
  return addTrialJob(data, partnerId, { ref: `TRIAL-${partnerId.replace(/^P-/, '')}-${String(n).padStart(2, '0')}`, date: istDate(at), leg, ...shape, score: trialJobScore(shape), simulated: true }, at)
}

export const trialComplete = (p: Partner) => !!p.trial && p.trial.tripsDone >= p.trial.tripsRequired

/**
 * ERP-14 decision (source §4 Steps 7–8): score ≥ pass mark → go live at
 * Bronze; below → extend the trial or decline with reasons.
 */
export function decideTrial(data: DemoData, partnerId: Id, d: 'live' | 'extend' | 'decline', reasons: string, by: Id, at: IsoDateTime): DemoData {
  const p = data.partners[partnerId]
  const a = appOf(data, partnerId)
  if (!p?.trial || p.status !== 'trial') return data
  if (d === 'live' && (!trialComplete(p) || p.trial.score < data.settings.trialPassMark)) return data
  const decision = { result: d === 'extend' ? ('extended' as const) : d === 'live' ? ('live' as const) : ('declined' as const), reasons: reasons.trim() || undefined, by, at }
  let next: DemoData
  if (d === 'live') {
    next = setPartner(data, { ...p, status: 'live', tier: 'bronze', score: p.trial.score, trial: { ...p.trial, decision } })
    if (a) next = setApp(next, { ...a, status: 'live' })
    next = notify(next, { app: 'partnerPortal', partnerId }, 'You are live on Logisco (Bronze)', p.shortName, '/partner', at)
  } else if (d === 'extend') {
    const base = trialRequirement(p.type, p.legs).required
    next = setPartner(data, { ...p, trial: { ...p.trial, tripsRequired: p.trial.tripsRequired + base, decision } })
    next = notify(next, { app: 'partnerPortal', partnerId }, 'Trial extended', reasons, '/partner/onboarding', at)
  } else {
    next = setPartner(data, { ...p, status: 'offboarded', trial: { ...p.trial, decision } })
    if (a) next = setApp(next, { ...a, status: 'rejected' })
    next = notify(next, { app: 'partnerPortal', partnerId }, 'Trial not passed', reasons, '/partner/onboarding', at)
  }
  return audit(next, { userId: by, app: 'erp', action: `partner.trial.${d}`, recordId: partnerId, at, after: { score: p.trial.score, reasons } })
}

// ─── SIMULATED back office (automatic approvals) ─────────────────────────────

export type CommercialDecisionKind = 'commercials' | 'counter' | 'trial'

export function pendingCommercialDecisions(data: DemoData): { id: Id; kind: CommercialDecisionKind }[] {
  const out: { id: Id; kind: CommercialDecisionKind }[] = []
  for (const a of Object.values(data.applications)) {
    if (a.status === 'agreement' && (!a.agreement || a.agreement.status === 'draft')) out.push({ id: a.id, kind: 'commercials' })
    if (a.agreement?.lines.some((l) => l.counter)) out.push({ id: a.id, kind: 'counter' })
  }
  // An extension raises the requirement, so a trial is "complete" again only after new jobs
  for (const p of Object.values(data.partners)) if (p.status === 'trial' && trialComplete(p)) out.push({ id: p.id, kind: 'trial' })
  return out
}

/**
 * SIMULATED decisions by the rules. Pricing approves a below-target line only
 * if Logisco still makes money on it (margin ≥ 0); the agreement is then
 * (re-)issued. A counter is accepted on the same rule. A complete trial at or
 * above the pass mark goes live; below it is extended once, then declined.
 */
export function autoDecideCommercial(data: DemoData, id: Id, kind: CommercialDecisionKind, at: IsoDateTime): DemoData {
  if (kind === 'trial') {
    const p = data.partners[id]
    if (!p?.trial) return data
    if (p.trial.score >= data.settings.trialPassMark) return decideTrial(data, id, 'live', '', 'system', at)
    return decideTrial(data, id, p.trial.decision?.result === 'extended' ? 'decline' : 'extend', `Trial score ${p.trial.score} is below ${data.settings.trialPassMark}`, 'system', at)
  }
  let next = kind === 'commercials' ? draftPartnerAgreement(data, id, 'system', at) : data
  if (kind === 'counter')
    for (const l of next.applications[id].agreement?.lines.filter((x) => x.counter) ?? []) {
      const m = partnerLineMargin(next, next.applications[id].partnerId, { ...l, rate: l.counter!.rate })
      next = answerCounter(next, id, l.id, !m || m.marginPct >= 0, 'system', at)
    }
  // Pricing (simulated): approve the lines that are below target but still profitable
  const a = next.applications[id]
  for (const l of a.agreement?.lines ?? []) {
    const m = partnerLineMargin(next, a.partnerId, l)
    // Unsigned: every profitable line; signed: only lines still waiting (Belagavi)
    if (m?.belowTarget && m.marginPct >= 0 && !l.pricingApproval && (a.agreement!.status !== 'signed' || l.status === 'notAccepted')) next = approveLineBelowTarget(next, id, l.id, 'system', at)
  }
  const g = next.applications[id].agreement
  return g && g.status !== 'signed' && g.status !== 'negotiation' ? issuePartnerAgreement(next, id, 'system', at) : next
}
