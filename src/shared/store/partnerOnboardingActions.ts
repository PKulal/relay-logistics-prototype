/**
 * Partner onboarding, Phases 1–2 (source §4 Steps 1–4): application with
 * duplicate check, AI network-gap fit (invite / waitlist), digital KYC with
 * automatic checks and OCR, manual verification desk and hub audit
 * (PP-04 to PP-07; ERP-11, ERP-12). Every decision is written to the audit log.
 */
import { gstinCheck, gstLookup, panValid, pennyDrop } from '@shared/engines/onboarding'
import {
  FIT_INVITE,
  needsHubAudit,
  networkFit,
  ocrRead,
  rescoreDate,
  sarathiCheck,
  servicesOf,
  vahanCheck,
  type FitInput,
} from '@shared/engines/partnerOnboarding'
import { addDaysToDate, istDate } from '@shared/lib/time'
import type {
  AuditItem,
  DemoData,
  Id,
  IsoDate,
  IsoDateTime,
  LegType,
  Notification,
  Partner,
  PartnerApplication,
  PartnerCheckKey,
  PartnerDocKey,
  PartnerDocument,
  PartnerType,
  VerificationResult,
} from '@shared/types'
import { audit } from './erpActions'

export const DEFAULT_COORDINATOR: Id = 'LS-MEERA'
export const DEFAULT_AUDITOR: Id = 'LS-KIRAN'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const toPartner = (app: PartnerApplication) => ({ app: 'partnerPortal' as const, partnerId: app.partnerId })
const toDesk = { app: 'erp' as const, role: 'partnerManagement' }

const setApp = (data: DemoData, a: PartnerApplication): DemoData => ({ ...data, applications: { ...data.applications, [a.id]: a } })
const setPartner = (data: DemoData, p: Partner): DemoData => ({ ...data, partners: { ...data.partners, [p.id]: p } })

// ─── PP-04 application ────────────────────────────────────────────────────────

export interface PartnerApplyInput extends Omit<PartnerApplication, 'id' | 'partnerId' | 'ref' | 'receivedAt' | 'fitScore' | 'fitReason' | 'fitDetail' | 'status' | 'documents' | 'checks'> {
  type: PartnerType
  legs: LegType[]
  companyName: string
  gstin: string
  pan: string
}

/** Short name for menus: the company name without "Pvt Ltd" and the like. */
const shortName = (name: string) => name.replace(/\b(Pvt\.?|Private|Ltd\.?|Limited|LLP)\b/gi, '').replace(/\s+/g, ' ').trim()

/**
 * Source §4 Step 1: the application reference is created, the applicant becomes
 * the Partner Admin, and the acknowledgement goes out on WhatsApp and email
 * (SIMULATED: a notification). The fit score is computed at once (Step 2).
 */
export function applyAsPartner(data: DemoData, x: PartnerApplyInput, at: IsoDateTime): { data: DemoData; applicationId: Id; partnerId: Id; userId: Id } {
  const serial = Math.max(0, ...Object.keys(data.applications).map((k) => Number(/(\d+)$/.exec(k)?.[1] ?? 0))) + 1
  const ref = `APP-${at.slice(0, 4)}-${String(serial).padStart(4, '0')}`
  const partnerId = `P-APP${String(serial).padStart(4, '0')}`
  const userId = `PU-APP${String(serial).padStart(4, '0')}`
  const fitInput: FitInput = { type: x.type, legs: x.legs, pincodes: x.pincodes, lanes: x.lanes, hubs: x.hubs }
  const fit = networkFit(data, fitInput)
  const partner: Partner = {
    id: partnerId,
    name: x.companyName.trim(),
    shortName: shortName(x.companyName),
    type: x.type,
    legs: x.legs,
    services: servicesOf(x.services),
    gstin: x.gstin.trim().toUpperCase(),
    pan: x.pan.trim().toUpperCase(),
    city: x.cities[0] ?? '',
    status: 'applied',
    tier: null,
    score: 0,
    capacityPerDay: x.capacity,
    baseLoadToday: 0,
    coveragePincodes: x.pincodes,
    laneIds: [],
    hubIds: [],
    autoAccept: false,
  }
  const { type: _t, legs: _l, companyName: _c, gstin: _g, pan: _p, ...rest } = x
  const app: PartnerApplication = { ...rest, id: ref, partnerId, ref, receivedAt: at, ...fit, fitReason: '', status: 'new', documents: [], checks: {} }
  let next: DemoData = setPartner(setApp(data, app), partner)
  next = {
    ...next,
    partnerUsers: { ...next.partnerUsers, [userId]: { id: userId, partnerId, name: x.contact.name.trim(), mobile: x.contact.mobile.trim(), email: x.contact.email.trim(), role: 'admin' } },
  }
  next = notify(next, toPartner(app), 'Application received (WhatsApp and email)', ref, '/partner/onboarding', at)
  next = notify(next, toDesk, 'New partner application', `${partner.name} · ${ref}`, '/erp/partners/applications', at)
  next = audit(next, { userId, app: 'partnerPortal', action: 'partner.applied', recordId: ref, at, after: { type: x.type, fitScore: fit.fitScore } })
  return { data: next, applicationId: ref, partnerId, userId }
}

// ─── ERP-11 fit decision ──────────────────────────────────────────────────────

export function decideFit(data: DemoData, appId: Id, decision: 'invite' | 'waitlist' | 'reject', o: { coordinatorId?: Id; reason?: string }, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a || !['new', 'waitlisted'].includes(a.status)) return data
  const p = data.partners[a.partnerId]
  const status = decision === 'invite' ? 'invited' : decision === 'waitlist' ? 'waitlisted' : 'rejected'
  let next = setApp(data, { ...a, status, decision: { by, at, reason: o.reason?.trim() || undefined }, rescoreOn: decision === 'waitlist' ? rescoreDate(at) : undefined })
  if (decision === 'invite') next = setPartner(next, { ...p, status: 'kyc', coordinatorId: o.coordinatorId ?? DEFAULT_COORDINATOR })
  next = notify(next, toPartner(a), status === 'invited' ? 'Invited to onboard' : status === 'waitlisted' ? 'Application waitlisted' : 'Application not accepted', a.ref, '/partner/onboarding', at)
  return audit(next, { userId: by, app: 'erp', action: `partner.${status}`, recordId: appId, at, before: a.status, after: { status, reason: o.reason } })
}

// ─── PP-06 documents and checks ───────────────────────────────────────────────

const afterSubmit = (a: PartnerApplication) => !!a.kycSubmittedAt

function putDoc(a: PartnerApplication, doc: PartnerDocument): PartnerApplication {
  const others = a.documents.filter((d) => d.key !== doc.key)
  return { ...a, documents: [...others, doc] }
}

/**
 * Upload (or re-upload) a document. Before submission it is just Uploaded;
 * afterwards OCR runs at once, and a clean re-upload closes the condition tied
 * to it (PP-07 "Upload evidence").
 */
export function uploadPartnerDoc(data: DemoData, appId: Id, key: PartnerDocKey, f: { file: string; number?: string; expiry?: IsoDate }, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a) return data
  const prev = a.documents.find((d) => d.key === key)
  let doc: PartnerDocument = { key, status: 'submitted', file: f.file, number: f.number ?? prev?.number, expiry: f.expiry ?? prev?.expiry, uploadedAt: at }
  let app = a
  if (afterSubmit(a)) {
    doc = { ...doc, ...ocrRead(data, a, data.partners[a.partnerId], doc, at) }
    if (doc.status === 'verified' && a.outcome)
      app = { ...a, outcome: { ...a.outcome, conditions: a.outcome.conditions.map((c) => (c.docKey === key && !c.closedAt ? { ...c, closedAt: at } : c)) } }
  }
  let next = setApp(data, putDoc(app, doc))
  if (afterSubmit(a)) next = notify(next, toDesk, 'Partner document re-uploaded', `${data.partners[a.partnerId].shortName} · ${key}`, `/erp/partners/kyc?app=${appId}`, at)
  return next
}

export type CheckInput =
  | { kind: 'gstin' }
  | { kind: 'pan' }
  | { kind: 'pennyDrop'; holder: string; account: string; ifsc: string }
  | { kind: 'vahan'; regNo: string }
  | { kind: 'sarathi'; dl: string }
  | { kind: 'digilocker' }

/** SIMULATED API checks: GSTIN, PAN, penny-drop, Vahan and Sarathi via ULIP, DigiLocker fetch (source §4 Step 3). */
export function runPartnerCheck(data: DemoData, appId: Id, c: CheckInput, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a) return data
  const p = data.partners[a.partnerId]
  const put = (app: PartnerApplication, key: PartnerCheckKey, ok: boolean, detail: Record<string, string | number>) => ({ ...app, checks: { ...app.checks, [key]: { ok, detail, at } } })
  let app = a
  switch (c.kind) {
    case 'gstin': {
      const g = gstinCheck(p.gstin)
      const l = gstLookup(p.gstin, p.name, p.city)
      app = put(app, 'gstin', g.ok && l.active, { gstin: p.gstin, state: g.state ?? '', active: l.active ? 1 : 0 })
      break
    }
    case 'pan':
      app = put(app, 'pan', panValid(p.pan), { pan: p.pan, name: p.name })
      break
    case 'pennyDrop': {
      const r = pennyDrop(c.ifsc, c.holder, p.name)
      app = put(app, 'pennyDrop', r.ok, { holder: c.holder.trim(), account: `XXXX${c.account.slice(-4)}`, ifsc: c.ifsc.toUpperCase(), bank: r.bankName, matchPct: r.matchPct })
      break
    }
    case 'vahan': {
      const r = vahanCheck(data, c.regNo, p.id)
      app = put(app, 'vahan', r.ok, r.detail)
      const d = app.documents.find((x) => x.key === 'vehicles')
      app = putDoc(app, { ...(d ?? { key: 'vehicles', status: 'pending' }), number: r.detail.reg })
      break
    }
    case 'sarathi': {
      const r = sarathiCheck(c.dl)
      app = put(app, 'sarathi', r.ok, r.detail)
      const d = app.documents.find((x) => x.key === 'driverLicence')
      app = putDoc(app, { ...(d ?? { key: 'driverLicence', status: 'pending' }), number: r.detail.dl })
      break
    }
    case 'digilocker': {
      // Consent given: GSTIN, PAN and incorporation certificate come back verified at source
      for (const key of ['gstin', 'pan', 'incorporation'] as const) {
        const d = app.documents.find((x) => x.key === key)
        if (!d?.file) app = putDoc(app, { key, status: 'submitted', file: `digilocker_${key}.pdf`, viaDigilocker: true, uploadedAt: at })
      }
      app = put(app, 'digilocker', true, { fetched: 3 })
      app = put(app, 'gstin', gstinCheck(p.gstin).ok, { gstin: p.gstin, state: gstinCheck(p.gstin).state ?? '', active: 1 })
      app = put(app, 'pan', panValid(p.pan), { pan: p.pan, name: p.name })
      break
    }
  }
  return setApp(data, app)
}

/** Move to Agreement once the outcome (and the hub audit, if needed) allow it. */
function advance(data: DemoData, appId: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  const p = data.partners[a.partnerId]
  if (a.status !== 'kyc' || !a.outcome) return data
  const audit = needsHubAudit(p.type, a.hubs.length)
  if (a.outcome.result === 'rejected' || a.hubAudit?.result === 'rejected') {
    return notify(setApp(data, { ...a, status: 'rejected' }), toPartner(a), 'Verification: rejected', a.ref, '/partner/onboarding/verification', at)
  }
  if (audit && !a.hubAudit?.result) return data
  let next = setPartner(setApp(data, { ...a, status: 'agreement' }), { ...p, status: 'agreement' })
  next = notify(next, toPartner(a), a.outcome.result === 'approved' ? 'Verification: approved' : 'Verification: conditionally approved', a.ref, '/partner/onboarding/verification', at)
  return next
}

/**
 * PP-06 Submit for verification: OCR reads every upload. Clean files are
 * Verified; with nothing flagged the outcome is Approved at once, otherwise the
 * case goes to the manual desk (ERP-12; source §4 Step 4 "only if flagged").
 */
export function submitPartnerKyc(data: DemoData, appId: Id, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a || a.status !== 'invited') return data
  const p = data.partners[a.partnerId]
  const documents = a.documents.map((d) => (d.file ? { ...d, ...ocrRead(data, a, p, d, at) } : d))
  const flagged = documents.some((d) => d.status === 'flagged')
  let next = setApp(data, { ...a, documents, status: 'kyc', kycSubmittedAt: at, outcome: flagged ? undefined : { result: 'approved', conditions: [], by: 'system', at } })
  next = audit(next, { userId: by, app: 'partnerPortal', action: 'partner.kycSubmitted', recordId: appId, at, after: { flagged: documents.filter((d) => d.status === 'flagged').map((d) => d.key) } })
  if (flagged) next = notify(next, toDesk, 'Partner KYC flagged for review', `${p.shortName} · ${a.ref}`, `/erp/partners/kyc?app=${appId}`, at)
  return advance(next, appId, at)
}

/** ERP-12 Request re-upload: the document is flagged with the reason. */
export function requestReupload(data: DemoData, appId: Id, key: PartnerDocKey, reason: string, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  const d = a?.documents.find((x) => x.key === key)
  if (!a || !d) return data
  let next = setApp(data, putDoc(a, { ...d, status: 'flagged', note: reason.trim() }))
  next = notify(next, toPartner(a), 'Please re-upload a document', reason.trim(), '/partner/onboarding/documents', at)
  return audit(next, { userId: by, app: 'erp', action: 'partner.reuploadRequested', recordId: appId, at, after: { key, reason } })
}

export interface VerificationDecision {
  result: VerificationResult
  conditions: { text: string; due: IsoDate; docKey?: PartnerDocKey }[]
  reasons?: string
}

/** ERP-12 Save decision (source §4 Step 4: Approved / Conditionally approved / Rejected with reasons). */
export function decideVerification(data: DemoData, appId: Id, d: VerificationDecision, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a || a.status !== 'kyc') return data
  let next = setApp(data, { ...a, outcome: { result: d.result, conditions: d.result === 'conditional' ? d.conditions : [], reasons: d.reasons?.trim() || undefined, by, at } })
  next = audit(next, { userId: by, app: 'erp', action: 'partner.verification', recordId: appId, at, before: a.outcome, after: d })
  return advance(next, appId, at)
}

// ─── Hub audit (PP-07, ERP-12) ────────────────────────────────────────────────

export function bookHubAudit(data: DemoData, appId: Id, b: { date: IsoDate; window: 'morning' | 'afternoon'; contact: string; phone: string }, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a || a.hubAudit?.result) return data
  let next = setApp(data, { ...a, hubAudit: { ...b, auditorId: a.hubAudit?.auditorId ?? DEFAULT_AUDITOR } })
  next = notify(next, { app: 'erp', userId: DEFAULT_AUDITOR }, 'Hub audit booked', `${data.partners[a.partnerId].shortName} · ${b.date}`, `/erp/partners/kyc?app=${appId}`, at)
  return audit(next, { userId: by, app: 'partnerPortal', action: 'partner.auditBooked', recordId: appId, at, after: b })
}

export type AuditItems = NonNullable<NonNullable<PartnerApplication['hubAudit']>['items']>

/** Geo-tagged audit photo at the hub (SIMULATED camera + GPS). */
export function auditPhoto(data: DemoData, a: PartnerApplication, at: IsoDateTime) {
  const pin = data.pincodes[a.hubs[0]?.pincode ?? '']
  return { lat: pin?.lat ?? 0, lng: pin?.lng ?? 0, at }
}

export function recordHubAudit(data: DemoData, appId: Id, items: AuditItems, result: VerificationResult, by: Id, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a?.hubAudit) return data
  let next = setApp(data, { ...a, hubAudit: { ...a.hubAudit, auditorId: by, items, result, completedAt: at } })
  next = notify(next, toPartner(a), 'Hub audit completed', a.ref, '/partner/onboarding/verification', at)
  next = audit(next, { userId: by, app: 'erp', action: 'partner.hubAudit', recordId: appId, at, after: { result } })
  return advance(next, appId, at)
}

// ─── SIMULATED back office (automatic approvals) ─────────────────────────────

export type PartnerDecisionKind = 'fit' | 'kyc' | 'audit'

export function pendingPartnerDecisions(data: DemoData): { applicationId: Id; kind: PartnerDecisionKind }[] {
  return Object.values(data.applications).flatMap((a): { applicationId: Id; kind: PartnerDecisionKind }[] => {
    if (a.status === 'new') return [{ applicationId: a.id, kind: 'fit' }]
    if (a.status !== 'kyc') return []
    const out: { applicationId: Id; kind: PartnerDecisionKind }[] = []
    if (!a.outcome) out.push({ applicationId: a.id, kind: 'kyc' })
    if (a.hubAudit && !a.hubAudit.result) out.push({ applicationId: a.id, kind: 'audit' })
    return out
  })
}

/**
 * SIMULATED decisions by the rules: invite at or above the fit threshold, else
 * waitlist; flagged KYC → conditionally approved with a re-upload condition per
 * flagged document (tampered → rejected); hub audit → all five checks pass.
 */
export function autoDecidePartner(data: DemoData, appId: Id, kind: PartnerDecisionKind, at: IsoDateTime): DemoData {
  const a = data.applications[appId]
  if (!a) return data
  if (kind === 'fit') return decideFit(data, appId, a.fitScore >= FIT_INVITE ? 'invite' : 'waitlist', {}, 'system', at)
  if (kind === 'kyc') {
    const flagged = a.documents.filter((d) => d.status === 'flagged')
    if (flagged.some((d) => d.flag === 'tampered')) return decideVerification(data, appId, { result: 'rejected', conditions: [], reasons: 'tampered' }, 'system', at)
    const due = addDaysToDate(istDate(at), 7)
    return decideVerification(data, appId, { result: flagged.length ? 'conditional' : 'approved', conditions: flagged.map((d) => ({ text: '', due, docKey: d.key })) }, 'system', at)
  }
  const photo = auditPhoto(data, a, at)
  const items = Object.fromEntries((['security', 'cctv', 'fireSafety', 'docks', 'scale'] as AuditItem[]).map((k) => [k, { result: 'pass' as const, photo }])) as AuditItems
  return recordHubAudit(data, appId, items, 'approved', a.hubAudit?.auditorId ?? DEFAULT_AUDITOR, at)
}

