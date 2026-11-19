/**
 * Customer onboarding, Phases 3–4 (source §6 Steps 5–8): rate card and
 * margin approval (ERP-22/23), contract issue and e-sign (ERP-27, CP-08),
 * integration and SKU weight freeze (CP-09), pilot under hyper-care and
 * go-live (CP-10, ERP-27).
 */
import { assisted } from '@shared/engines/onboarding'
import { cardMargins, linesBelowTarget } from '@shared/engines/rateCardMargin'
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { ContractRecord, Customer, CustomerRateCard, DemoData, Id, IsoDateTime, ParcelTier, ParcelZone, Sku } from '@shared/types'
import { audit } from './erpActions'

const ob = (c: Customer) => c.onboarding!
const notify = (data: DemoData, audience: DemoData['notifications'][string]['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const setCustomer = (data: DemoData, c: Customer): DemoData => ({ ...data, customers: { ...data.customers, [c.id]: c } })
const setLeadStage = (data: DemoData, customerId: Id, stage: 'pilot' | 'live', by: Id, at: IsoDateTime): DemoData => {
  const l = Object.values(data.leads).find((x) => x.customerId === customerId)
  return l ? { ...data, leads: { ...data.leads, [l.id]: { ...l, stage, activities: [...l.activities, { at, by, kind: 'stage', note: stage }] } } } : data
}

// ─── ERP-22 / ERP-23 rate cards ───────────────────────────────────────────────

/** ERP-22: a negotiated card for a customer, cloned from the standard card (or another card). */
export function createNegotiatedCard(data: DemoData, customerId: Id, fromId: Id, by: Id, at: IsoDateTime): { data: DemoData; cardId: Id } {
  const from = data.rateCards[fromId]
  const c = data.customers[customerId]
  const n = Object.values(data.rateCards).filter((r) => r.customerId === customerId).length + 1
  const cardId = `RC-${customerId.replace(/^C-/, '')}-${n}`
  const year = at.slice(0, 4)
  const card: CustomerRateCard = { ...structuredClone(from), id: cardId, name: `${c.shortName} ${year}`, customerId, type: 'negotiated', status: 'draft', validFrom: istDate(at), validTo: addDaysToDate(istDate(at), 364), approval: undefined }
  return { data: audit({ ...data, rateCards: { ...data.rateCards, [cardId]: card } }, { userId: by, app: 'erp', action: 'rateCard.create', recordId: cardId, at, after: fromId }), cardId }
}

export type RateEdit =
  | { kind: 'ptl'; index: number; field: 'perKg' | 'minKg' | 'cftFactor'; value: number }
  | { kind: 'parcel'; zone: ParcelZone; tier: ParcelTier; field: 'first' | 'additional'; value: number }
  | { kind: 'surcharge'; field: keyof CustomerRateCard['surcharges']; value: number }

/** ERP-22: edit a line of a draft card. */
export function editRateCard(data: DemoData, cardId: Id, e: RateEdit): DemoData {
  const card = data.rateCards[cardId]
  if (!card || card.status !== 'draft' || !(e.value >= 0)) return data
  const next = structuredClone(card)
  if (e.kind === 'ptl') next.ptl[e.index] = { ...next.ptl[e.index], [e.field]: e.value }
  else if (e.kind === 'parcel') next.parcel[e.zone][e.tier] = { ...next.parcel[e.zone][e.tier], [e.field]: e.value }
  else next.surcharges = { ...next.surcharges, [e.field]: e.value }
  return { ...data, rateCards: { ...data.rateCards, [cardId]: next } }
}

/**
 * ERP-22 Submit: every line is checked (AI margin engine). All at or above
 * target → the card goes live; any below → Pricing Head approval (ERP-23).
 */
export function submitRateCard(data: DemoData, cardId: Id, by: Id, at: IsoDateTime): DemoData {
  const card = data.rateCards[cardId]
  if (!card || card.status !== 'draft') return data
  const below = linesBelowTarget(cardMargins(data, card)).length
  const next: CustomerRateCard = { ...card, status: below ? 'pendingApproval' : 'live', approval: { requestedBy: by, requestedAt: at } }
  return audit({ ...data, rateCards: { ...data.rateCards, [cardId]: next } }, { userId: by, app: 'erp', action: 'rateCard.submit', recordId: cardId, at, after: { linesBelowTarget: below } })
}

/** ERP-23 decision: approve → live; reject or send back → draft with the comment. */
export function decideRateCard(data: DemoData, cardId: Id, decision: 'approve' | 'reject' | 'sendBack', comment: string, by: Id, at: IsoDateTime): DemoData {
  const card = data.rateCards[cardId]
  if (!card || card.status !== 'pendingApproval') return data
  const next: CustomerRateCard = { ...card, status: decision === 'approve' ? 'live' : 'draft', approval: { ...card.approval!, decidedBy: by, decidedAt: at, decision, comment: comment.trim() || undefined } }
  let out = audit({ ...data, rateCards: { ...data.rateCards, [cardId]: next } }, { userId: by, app: 'erp', action: `rateCard.${decision}`, recordId: cardId, at, after: comment })
  if (card.approval?.requestedBy) out = notify(out, { app: 'erp', userId: card.approval.requestedBy }, 'Rate card decision', `${card.name}: ${decision}`, `/erp/pricing/rate-cards/${cardId}`, at)
  return out
}

// ─── Contract (ERP-27 issue, CP-08 sign) ─────────────────────────────────────

/** The 1st of next month (contract effective date). */
const nextMonthStart = (at: IsoDateTime) => {
  const [y, m] = istDate(at).split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

/** The card a customer is offered: their live negotiated card, else the standard card. */
export function offerCardFor(data: DemoData, customerId: Id): Id {
  return Object.values(data.rateCards).find((r) => r.customerId === customerId && r.status === 'live')?.id ?? 'RC-STANDARD'
}

/** ERP-27 Issue contract: the customer sees it on CP-08 for e-sign. Only a live card can be offered. */
export function issueContract(data: DemoData, customerId: Id, rateCardId: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c?.onboarding || c.status !== 'contract' || data.rateCards[rateCardId]?.status !== 'live') return data
  const prev = c.onboarding.contract
  if (prev?.status === 'signed') return data
  const contract: ContractRecord = { rateCardId, issuedAt: at, issuedBy: by, status: 'issued', effectiveDate: nextMonthStart(at), termMonths: 12, changeRequests: prev?.changeRequests ?? [] }
  let next = setCustomer(data, { ...c, onboarding: { ...c.onboarding, contract } })
  for (const u of Object.values(next.customerUsers).filter((x) => x.customerId === customerId && x.role === 'admin')) next = notify(next, { app: 'customer', userId: u.id }, 'Contract ready', data.rateCards[rateCardId].name, '/customer/onboarding/contract', at)
  return audit(next, { userId: by, app: 'erp', action: 'contract.issue', recordId: customerId, at, after: rateCardId })
}

/** CP-08 Request changes (assisted tracks): goes to the account manager. */
export function requestContractChanges(data: DemoData, customerId: Id, line: string, remark: string, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  const k = c?.onboarding?.contract
  if (!k || k.status === 'signed' || !remark.trim() || !assisted(c.track)) return data
  let next = setCustomer(data, { ...c, onboarding: { ...ob(c), contract: { ...k, status: 'changesRequested', changeRequests: [...k.changeRequests, { at, by, line: line.trim(), remark: remark.trim() }] } } })
  if (c.kamId) next = notify(next, { app: 'erp', userId: c.kamId }, 'Contract changes requested', `${c.shortName}: ${line} — ${remark}`, `/erp/sales/onboarding/${c.id}`, at)
  return audit(next, { userId: by, app: 'customer', action: 'contract.changes', recordId: customerId, at, after: { line, remark } })
}

/**
 * CP-08 Accept & e-sign (SIMULATED e-sign). Self-serve tracks click-wrap the
 * standard card. The card goes live for the customer; next is integration.
 */
export function signContract(data: DemoData, customerId: Id, method: 'aadhaarOtp' | 'dsc' | 'clickWrap', by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c?.onboarding || c.status !== 'contract') return data
  let k = c.onboarding.contract
  if (!k && !assisted(c.track)) k = { rateCardId: 'RC-STANDARD', issuedAt: at, issuedBy: 'system', status: 'issued', effectiveDate: istDate(at), termMonths: 12, changeRequests: [] }
  if (!k || k.status !== 'issued') return data
  const contract: ContractRecord = { ...k, status: 'signed', signedAt: at, signedBy: by, method }
  return audit(setCustomer(data, { ...c, rateCardId: k.rateCardId, status: 'integration', onboarding: { ...c.onboarding, contract } }), { userId: by, app: 'customer', action: 'contract.sign', recordId: customerId, at, after: method })
}

// ─── CP-09 integration ────────────────────────────────────────────────────────

export type IntegrationStep = { kind: 'apiKey' } | { kind: 'erp'; erp: 'tally' | 'sap' | 'zoho' } | { kind: 'ondc'; sellerId: string } | { kind: 'template' }

export function setIntegration(data: DemoData, customerId: Id, s: IntegrationStep, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c) return data
  const i = { ...c.integrations }
  if (s.kind === 'apiKey') i.apiKey = `sk_sandbox_${customerId.toLowerCase().replace(/[^a-z0-9]/g, '')}_${Date.parse(at).toString(36)}` // SIMULATED key
  if (s.kind === 'erp') {
    i.erp = s.erp
    i.tally = s.erp === 'tally'
  }
  if (s.kind === 'ondc') i.ondcSellerId = s.sellerId.trim()
  if (s.kind === 'template') i.templateDownloaded = true
  return setCustomer(data, { ...c, integrations: i })
}

/**
 * SIMULATED AI outlier check (source §6 Step 6: "AI flags dimension
 * outliers"): implausible density (below 20 or above 3,000 kg per m³) or a
 * side over 300 cm.
 */
export function skuOutlier(s: Pick<Sku, 'l' | 'b' | 'h' | 'weight'>): 'density' | 'size' | undefined {
  if (Math.max(s.l, s.b, s.h) > 300) return 'size'
  const m3 = (s.l * s.b * s.h) / 1_000_000
  const density = m3 > 0 ? s.weight / m3 : Infinity
  return density < 20 || density > 3000 ? 'density' : undefined
}

export interface SkuRow {
  code: string
  description: string
  l: number
  b: number
  h: number
  weight: number
  hsn: string
  unitValue: number
}

/**
 * CP-09 SKU master upload: each SKU is checked; plausible ones are verified by
 * Logisco and their weight frozen (fewer weight disputes); outliers are flagged
 * for the customer to correct.
 */
export function uploadSkus(data: DemoData, customerId: Id, rows: SkuRow[], by: Id, at: IsoDateTime): DemoData {
  const skus = { ...data.skus }
  for (const r of rows) {
    if (!r.code?.trim()) continue
    const id = `SKU-${customerId.replace(/^C-/, '')}-${r.code.trim()}`
    skus[id] = { id, customerId, code: r.code.trim(), description: r.description?.trim() ?? '', l: r.l, b: r.b, h: r.h, weight: r.weight, hsn: String(r.hsn ?? ''), unitValue: r.unitValue, status: skuOutlier(r) ? 'flagged' : 'frozen' }
  }
  return audit({ ...data, skus }, { userId: by, app: 'customer', action: 'sku.upload', recordId: customerId, at, after: rows.length })
}

/** Correct a flagged SKU's dimensions / weight; it is re-checked. */
export function fixSku(data: DemoData, skuId: Id, d: Pick<Sku, 'l' | 'b' | 'h' | 'weight'>): DemoData {
  const s = data.skus[skuId]
  if (!s || s.status === 'frozen') return data
  const next = { ...s, ...d }
  return { ...data, skus: { ...data.skus, [skuId]: { ...next, status: skuOutlier(next) ? 'flagged' : 'frozen' } } }
}

/** Pilot KPIs (assumed; source §6 Step 7 gives "early warning on SLA risk" without numbers). */
export const PILOT_KPIS = { onTimePct: 95, maxExceptionPct: 2 }
export const PILOT_DAYS = 14

/** CP-09 Mark integration complete (or Skip: portal booking only) → the 2-week pilot starts. */
export function completeIntegration(data: DemoData, customerId: Id, skipped: boolean, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c?.onboarding || c.status !== 'integration') return data
  const start = istDate(at)
  const customer: Customer = { ...c, status: 'pilot', onboarding: { ...c.onboarding, integrationDone: { at, skipped }, pilot: { start, end: addDaysToDate(start, PILOT_DAYS - 1), kpis: PILOT_KPIS } } }
  return audit(setLeadStage(setCustomer(data, customer), customerId, 'pilot', by, at), { userId: by, app: 'customer', action: skipped ? 'integration.skip' : 'integration.complete', recordId: customerId, at })
}

/** Day of the pilot (1–14), or 0 before it starts. */
export function pilotDay(c: Customer, now: IsoDateTime): number {
  const p = c.onboarding?.pilot
  if (!p) return 0
  return Math.max(0, Math.min(PILOT_DAYS, Math.floor((Date.parse(istDate(now)) - Date.parse(p.start)) / 86_400_000) + 1))
}

/** ERP-27 Mark live: after the 2-week pilot (source §6 Step 8). */
export function markLive(data: DemoData, customerId: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  const p = c?.onboarding?.pilot
  if (!c || c.status !== 'pilot' || !p || istDate(at) <= p.end) return data
  let next = setLeadStage(setCustomer(data, { ...c, status: 'live', onboarding: { ...c.onboarding!, liveAt: at } }), customerId, 'live', by, at)
  for (const u of Object.values(next.customerUsers).filter((x) => x.customerId === customerId && x.role === 'admin')) next = notify(next, { app: 'customer', userId: u.id }, 'Account live', c.shortName, '/customer', at)
  return audit(next, { userId: by, app: 'erp', action: 'customer.live', recordId: customerId, at })
}
