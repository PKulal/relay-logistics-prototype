/**
 * Customer onboarding, Phases 1–2 (source §6): sign-up → lead, qualification
 * → track, digital KYC, credit application and decision; plus the Sales
 * pipeline actions (ERP-26). Every decision is written to the audit log.
 */
import { assisted, billingFor, constitutionOf, creditScore, DEFAULT_KAM, gstinCheck, gstLookup, leadScore, pennyDrop, suggestedCredit, trackFor, yearsSince } from '@shared/engines/onboarding'
import type { CreditApplication, Customer, CustomerOnboarding, CustomerStatus, CustomerType, DemoData, Id, IsoDateTime, KycRecord, Lead, LeadSource, LeadStage, PickupLocation, Qualification } from '@shared/types'
import { issueContract, offerCardFor } from './contractActions'
import { audit } from './erpActions'

const pad = (n: number, w = 4) => String(n).padStart(w, '0')

export interface SignUpInput {
  legalName: string
  gstin: string
  businessType: CustomerType
  industry: string
  city: string
  contact: { name: string; designation?: string; email: string; mobile: string }
  source: LeadSource
  referralCode?: string
  privacyConsent: boolean
  gstConsent: boolean
  language: 'en' | 'hi'
}

/** Lead stage that matches an onboarding status (ERP-26 columns). */
const STAGE_OF: Partial<Record<CustomerStatus, LeadStage>> = { lead: 'new', qualified: 'qualified', kyc: 'kyc', credit: 'credit', contract: 'contract', integration: 'contract', pilot: 'pilot', live: 'live' }

function setCustomer(data: DemoData, c: Customer, at: IsoDateTime, note?: string, by: Id = 'system'): DemoData {
  let next: DemoData = { ...data, customers: { ...data.customers, [c.id]: c } }
  const lead = Object.values(next.leads).find((l) => l.customerId === c.id)
  const stage = STAGE_OF[c.status]
  if (lead && stage && lead.stage !== stage && lead.stage !== 'lost') {
    next = { ...next, leads: { ...next.leads, [lead.id]: { ...lead, stage, activities: [...lead.activities, { at, by, kind: 'stage', note: note ?? stage }] } } }
  }
  return next
}

const ob = (c: Customer): CustomerOnboarding => c.onboarding!

/** CP-04: the account (Onboarding), its first Admin, and a lead in the CRM with its source. */
export function signUp(data: DemoData, x: SignUpInput, at: IsoDateTime): { data: DemoData; customerId: Id; userId: Id } {
  const n = Object.values(data.customers).filter((c) => c.id.startsWith('C-ON-')).length + 1
  const customerId = `C-ON-${pad(n)}`
  const userId = `CU-ON-${pad(n)}`
  const leadId = `LD-${pad(Object.keys(data.leads).length + 1)}`
  const gstin = x.gstin.trim().toUpperCase()
  const pan = gstinCheck(gstin).pan ?? ''
  const shortName = x.legalName.replace(/\b(Pvt\.?|Private|Ltd\.?|Limited|LLP)\b/gi, '').replace(/\s+/g, ' ').trim()
  const customer: Customer = {
    id: customerId,
    legalName: x.legalName.trim(),
    shortName,
    gstin,
    pan,
    entityType: constitutionOf(pan),
    type: x.businessType,
    track: 'selfServe',
    status: 'lead',
    billing: 'prepaid',
    creditLimit: 0,
    creditUsed: 0,
    creditTermsDays: 0,
    securityDeposit: 0,
    walletBalance: 0,
    spendMonthToDate: 0,
    rateCardId: 'RC-STANDARD',
    integrations: { tally: false },
    city: x.city.trim(),
    onboarding: { source: x.source, referralCode: x.referralCode?.trim() || undefined, industry: x.industry, createdAt: at, privacyConsent: x.privacyConsent, gstConsent: x.gstConsent },
  }
  const lead: Lead = {
    id: leadId,
    company: customer.legalName,
    gstin,
    source: x.source,
    industry: x.industry,
    businessType: x.businessType,
    aiScore: leadScore(x.industry, 0, 0),
    stage: 'new',
    customerId,
    contact: { name: x.contact.name.trim(), email: x.contact.email.trim(), mobile: x.contact.mobile.trim() },
    createdAt: at,
    activities: [{ at, by: userId, kind: 'stage', note: `Signed up on the portal (${x.source})` }],
  }
  const next: DemoData = {
    ...data,
    customers: { ...data.customers, [customerId]: customer },
    customerUsers: { ...data.customerUsers, [userId]: { id: userId, customerId, name: x.contact.name.trim(), title: x.contact.designation?.trim() || undefined, email: x.contact.email.trim(), mobile: x.contact.mobile.trim(), role: 'admin', locationIds: [], language: x.language } },
    leads: { ...data.leads, [leadId]: lead },
  }
  return { data: audit(next, { userId, app: 'customer', action: 'customer.signUp', recordId: customerId, at, after: { gstin, source: x.source } }), customerId, userId }
}

/** CP-05: the shipping profile sets the track, billing and (assisted tracks) the account manager. */
export function saveQualification(data: DemoData, customerId: Id, q: Qualification, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c?.onboarding) return data
  const track = trackFor(c.type, q.shipmentsPerMonth, q.spendBand)
  const customer: Customer = {
    ...c,
    track,
    billing: billingFor(c.type, q.payment),
    kamId: assisted(track) ? (c.kamId ?? DEFAULT_KAM) : c.kamId,
    status: c.status === 'lead' ? 'qualified' : c.status,
    onboarding: { ...ob(c), qualification: q },
  }
  let next = setCustomer(data, customer, at, 'Qualified', by)
  const lead = Object.values(next.leads).find((l) => l.customerId === customerId)
  if (lead) {
    next = {
      ...next,
      leads: { ...next.leads, [lead.id]: { ...lead, declaredVolume: q.shipmentsPerMonth, aiScore: leadScore(lead.industry, q.lanes.length, q.shipmentsPerMonth), ownerId: lead.ownerId ?? customer.kamId } },
    }
  }
  return audit(next, { userId: by, app: 'customer', action: 'customer.qualify', recordId: customerId, at, after: { track, billing: customer.billing } })
}

const emptyKyc = (pan: string): KycRecord => ({ gstin: { state: 'notStarted' }, pan: { state: 'notStarted', value: pan }, bank: { state: 'notStarted' }, status: 'notStarted' })
const kycOf = (c: Customer) => ob(c).kyc ?? emptyKyc(c.pan)
const withKyc = (data: DemoData, c: Customer, kyc: KycRecord, at: IsoDateTime) => setCustomer(data, { ...c, status: c.status === 'qualified' ? 'kyc' : c.status, onboarding: { ...ob(c), kyc } }, at)

/** CP-06 GSTIN verify (SIMULATED GST API). */
export function verifyGstin(data: DemoData, customerId: Id, cin: string | undefined, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c?.onboarding) return data
  const r = gstLookup(c.gstin, c.legalName, c.city, cin)
  const kyc = kycOf(c)
  return withKyc(data, { ...c, cin: cin?.trim() || c.cin, entityType: r.constitution }, { ...kyc, cin: cin?.trim() || kyc.cin, gstin: { state: r.active ? 'verified' : 'flagged', ...r } }, at)
}

/** CP-06 PAN verify (SIMULATED): must be valid and match the GSTIN's PAN. */
export function verifyPan(data: DemoData, customerId: Id, pan: string, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c?.onboarding) return data
  const value = pan.trim().toUpperCase()
  return withKyc(data, c, { ...kycOf(c), pan: { state: value === c.pan ? 'verified' : 'flagged', value } }, at)
}

/** CP-06 bank penny-drop (SIMULATED). */
export function verifyBank(data: DemoData, customerId: Id, b: { holder: string; account: string; ifsc: string; type: 'current' | 'savings' }, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c?.onboarding) return data
  const r = pennyDrop(b.ifsc, b.holder, c.legalName)
  return withKyc(data, c, { ...kycOf(c), bank: { state: r.ok ? 'verified' : 'flagged', holder: b.holder.trim(), account: b.account.trim(), ifsc: b.ifsc.trim().toUpperCase(), type: b.type, bankName: r.bankName, branch: r.branch, nameReturned: r.nameReturned, matchPct: r.matchPct } }, at)
}

export function saveSignatory(data: DemoData, customerId: Id, s: NonNullable<KycRecord['signatory']>, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c?.onboarding) return data
  return withKyc(data, c, { ...kycOf(c), signatory: s }, at)
}

/** CP-06 pickup address (repeatable); the first one is the default. */
export function savePickupLocation(data: DemoData, customerId: Id, loc: Omit<PickupLocation, 'id' | 'customerId' | 'isDefault'> & { isDefault?: boolean }): DemoData {
  const mine = Object.values(data.pickupLocations).filter((l) => l.customerId === customerId)
  const id = `PL-${customerId.slice(2)}-${mine.length + 1}`
  const isDefault = mine.length === 0 || !!loc.isDefault
  const pickupLocations = { ...data.pickupLocations }
  if (isDefault) for (const l of mine) pickupLocations[l.id] = { ...l, isDefault: false }
  pickupLocations[id] = { ...loc, id, customerId, isDefault }
  // The Admin can book from every location
  const users = { ...data.customerUsers }
  for (const u of Object.values(users)) if (u.customerId === customerId && u.role === 'admin') users[u.id] = { ...u, locationIds: [...u.locationIds, id] }
  return { ...data, pickupLocations, customerUsers: users }
}

export function removePickupLocation(data: DemoData, id: Id): DemoData {
  const loc = data.pickupLocations[id]
  if (!loc) return data
  const pickupLocations = { ...data.pickupLocations }
  delete pickupLocations[id]
  const rest = Object.values(pickupLocations).filter((l) => l.customerId === loc.customerId)
  if (loc.isDefault && rest[0]) pickupLocations[rest[0].id] = { ...rest[0], isDefault: true }
  return { ...data, pickupLocations }
}

/** Ready to submit: GSTIN, PAN and bank checked (verified or flagged), signatory, ≥1 pickup address. */
export function kycReady(data: DemoData, customerId: Id): boolean {
  const c = data.customers[customerId]
  const k = c?.onboarding?.kyc
  if (!k) return false
  const checked = (s: string) => s === 'verified' || s === 'flagged'
  const companyNeedsCin = c.entityType === 'Private Ltd' || c.entityType === 'Public Ltd'
  return checked(k.gstin.state) && checked(k.pan.state) && checked(k.bank.state) && !!k.signatory && (!companyNeedsCin || !!k.cin) && Object.values(data.pickupLocations).some((l) => l.customerId === customerId)
}

/** After KYC: credit customers go to the credit step, others to the contract. */
function afterKyc(c: Customer): CustomerStatus {
  return c.billing === 'credit' ? 'credit' : 'contract'
}

/** CP-06 Submit KYC: all checks verified → KYC verified; any flagged → Under review (manual check by Logisco). */
export function submitKyc(data: DemoData, customerId: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c?.onboarding?.kyc || !kycReady(data, customerId)) return data
  const k = c.onboarding.kyc
  const flagged = [k.gstin.state, k.pan.state, k.bank.state].includes('flagged')
  const kyc: KycRecord = { ...k, status: flagged ? 'underReview' : 'verified', submittedAt: at }
  const bank = k.bank.state === 'verified' ? { name: k.bank.bankName!, branch: k.bank.branch!, ifsc: k.bank.ifsc!, account: k.bank.account! } : c.bank
  const customer: Customer = { ...c, bank, signatory: k.signatory, status: flagged ? 'kyc' : afterKyc(c), onboarding: { ...c.onboarding, kyc } }
  return audit(setCustomer(data, customer, at, flagged ? 'KYC under review' : 'KYC verified', by), { userId: by, app: 'customer', action: 'kyc.submit', recordId: customerId, at, after: kyc.status })
}

/** ERP-27 (or automatic): a flagged KYC item is checked by Logisco and cleared. */
export function clearKyc(data: DemoData, customerId: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  const k = c?.onboarding?.kyc
  if (!k || k.status !== 'underReview') return data
  const kyc: KycRecord = { ...k, status: 'verified', reviewedBy: by }
  const bank = k.bank.ifsc ? { name: k.bank.bankName ?? 'Bank', branch: k.bank.branch ?? '', ifsc: k.bank.ifsc, account: k.bank.account ?? '' } : c.bank
  return audit(setCustomer(data, { ...c, bank, status: afterKyc(c), onboarding: { ...c.onboarding!, kyc } }, at, 'KYC verified after review', by), { userId: by, app: 'erp', action: 'kyc.clear', recordId: customerId, at })
}

export interface CreditRequest {
  requestedLimit: number
  termsDays: 15 | 30 | 45
  yearsInBusiness: number
  gstConsent: boolean
  depositWilling: boolean
}

/** CP-07 Submit: Under review; Logisco's AI credit-risk score is attached (never shown to the customer). */
export function submitCredit(data: DemoData, customerId: Id, r: CreditRequest, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c?.onboarding || c.billing !== 'credit') return data
  const s = creditScore({ yearsInBusiness: r.yearsInBusiness, gstConsent: r.gstConsent, gstActive: c.onboarding.kyc?.gstin.active !== false, depositWilling: r.depositWilling })
  const credit: CreditApplication = { ...r, submittedAt: at, status: 'underReview', score: s.score, scoreReasons: s.reasons.map((x) => `${x.key}:${x.points}`) }
  return audit(setCustomer(data, { ...c, status: 'credit', onboarding: { ...c.onboarding, credit } }, at, 'Credit application submitted', by), { userId: by, app: 'customer', action: 'credit.submit', recordId: customerId, at, after: r })
}

export interface CreditDecision {
  status: 'approved' | 'approvedLower' | 'declined'
  limit: number
  termsDays: 15 | 30 | 45
  deposit: number
  remarks?: string
}

/** ERP-30 decision (or automatic): the customer sees it on CP-07 and accepts. */
export function decideCredit(data: DemoData, customerId: Id, d: CreditDecision, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  const app = c?.onboarding?.credit
  if (!app || app.status !== 'underReview') return data
  const credit: CreditApplication = { ...app, status: d.status, approvedLimit: d.status === 'declined' ? 0 : d.limit, approvedTerms: d.termsDays, deposit: d.status === 'declined' ? 0 : d.deposit, remarks: d.remarks?.trim() || undefined, decidedBy: by, decidedAt: at }
  let next = setCustomer(data, { ...c, onboarding: { ...c.onboarding!, credit } }, at)
  const users = Object.values(next.customerUsers).filter((u) => u.customerId === customerId && (u.role === 'admin' || u.role === 'finance'))
  const notifications = { ...next.notifications }
  for (const u of users) {
    const id = `NTF-${pad(Object.keys(notifications).length + 1, 5)}`
    notifications[id] = { id, audience: { app: 'customer', userId: u.id }, title: 'Credit decision', body: d.status, link: '/customer/onboarding/credit', at, read: false }
  }
  next = { ...next, notifications }
  return audit(next, { userId: by, app: 'erp', action: `credit.${d.status}`, recordId: customerId, at, after: d })
}

/** CP-07 Accept terms (credit active → TBB), or Continue on prepaid after a decline. Then the contract step. */
export function acceptCredit(data: DemoData, customerId: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  const app = c?.onboarding?.credit
  if (!app || app.status === 'underReview' || app.accepted) return data
  const declined = app.status === 'declined'
  const customer: Customer = {
    ...c,
    billing: declined ? 'prepaid' : 'credit',
    creditLimit: declined ? 0 : app.approvedLimit!,
    creditTermsDays: declined ? 0 : app.approvedTerms!,
    securityDeposit: declined ? 0 : app.deposit!,
    status: 'contract',
    onboarding: { ...c.onboarding!, credit: { ...app, accepted: true } },
  }
  return audit(setCustomer(data, customer, at, declined ? 'Continues on prepaid' : 'Credit accepted', by), { userId: by, app: 'customer', action: declined ? 'credit.prepaid' : 'credit.accept', recordId: customerId, at })
}

// ─── ERP-26 pipeline ──────────────────────────────────────────────────────────

export function assignLead(data: DemoData, leadId: Id, ownerId: Id, by: Id, at: IsoDateTime): DemoData {
  const l = data.leads[leadId]
  if (!l) return data
  const next = { ...data, leads: { ...data.leads, [leadId]: { ...l, ownerId, activities: [...l.activities, { at, by, kind: 'note' as const, note: `Owner: ${data.staff[ownerId]?.name ?? ownerId}` }] } } }
  const c = l.customerId ? next.customers[l.customerId] : undefined
  const withKam = c ? { ...next, customers: { ...next.customers, [c.id]: { ...c, kamId: ownerId } } } : next
  return audit(withKam, { userId: by, app: 'erp', action: 'lead.assign', recordId: leadId, at, after: ownerId })
}

export function moveLead(data: DemoData, leadId: Id, stage: LeadStage, by: Id, at: IsoDateTime): DemoData {
  const l = data.leads[leadId]
  if (!l || l.stage === stage) return data
  return audit({ ...data, leads: { ...data.leads, [leadId]: { ...l, stage, activities: [...l.activities, { at, by, kind: 'stage', note: stage }] } } }, { userId: by, app: 'erp', action: 'lead.stage', recordId: leadId, at, before: l.stage, after: stage })
}

export function logLeadActivity(data: DemoData, leadId: Id, kind: 'call' | 'visit' | 'email', note: string, by: Id, at: IsoDateTime): DemoData {
  const l = data.leads[leadId]
  if (!l || !note.trim()) return data
  return { ...data, leads: { ...data.leads, [leadId]: { ...l, activities: [...l.activities, { at, by, kind, note: note.trim() }] } } }
}

// ─── Automatic decisions (demo default; the toolbar's "Manual approvals" turns them off) ──

export type DecisionKind = 'kyc' | 'credit' | 'contract'

/** Pending onboarding decisions: KYC under review, credit applications, contracts to issue (assisted tracks). */
export function pendingDecisions(data: DemoData): { customerId: Id; kind: DecisionKind }[] {
  return Object.values(data.customers).flatMap((c) => [
    ...(c.onboarding?.kyc?.status === 'underReview' ? [{ customerId: c.id, kind: 'kyc' as const }] : []),
    ...(c.onboarding?.credit?.status === 'underReview' ? [{ customerId: c.id, kind: 'credit' as const }] : []),
    ...(c.onboarding && c.status === 'contract' && assisted(c.track) && !c.onboarding.contract ? [{ customerId: c.id, kind: 'contract' as const }] : []),
  ])
}

/** SIMULATED: Logisco decides by the rules (KYC cleared; credit by the AI score). */
export function autoDecide(data: DemoData, customerId: Id, kind: DecisionKind, at: IsoDateTime): DemoData {
  if (kind === 'kyc') return clearKyc(data, customerId, 'system', at)
  if (kind === 'contract') return issueContract(data, customerId, offerCardFor(data, customerId), 'system', at)
  const app = data.customers[customerId]?.onboarding?.credit
  if (!app) return data
  const s = suggestedCredit(app.score, app.requestedLimit)
  return decideCredit(data, customerId, { status: s.status, limit: s.limit, termsDays: app.termsDays, deposit: s.deposit, remarks: 'Decided automatically by the credit rules' }, 'system', at)
}

/** Business age from the GST registration date (CP-07 pre-fill). */
export function businessAge(data: DemoData, customerId: Id, now: IsoDateTime): number {
  const d = data.customers[customerId]?.onboarding?.kyc?.gstin.registeredOn
  return d ? yearsSince(d, now) : 0
}

/** ERP-27: Sales sets the track (an assisted track gets an account manager). */
export function setTrack(data: DemoData, customerId: Id, track: Customer['track'], by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c || c.track === track) return data
  const kamId = assisted(track) ? (c.kamId ?? DEFAULT_KAM) : c.kamId
  return audit({ ...data, customers: { ...data.customers, [customerId]: { ...c, track, kamId } } }, { userId: by, app: 'erp', action: 'customer.track', recordId: customerId, at, before: c.track, after: track })
}
