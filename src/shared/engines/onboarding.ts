/**
 * Customer onboarding rules (source §6 Phases 1–2; Customer Portal CP-04 to
 * CP-07; ERP-26/27/30). Pure functions: identity checks, the AI lead score,
 * the onboarding track, lane serviceability and margin preview, and the AI
 * credit-risk score. Scores are SIMULATED stand-ins for the AI models.
 */
import type { CustomerTrack, CustomerType, DemoData, Id, Pincode, Qualification, SpendBand } from '@shared/types'
import { planAssignment } from './assignment'
import { computeMargin } from './margin'
import { priceLine } from './pricing'
import { findLane, quote } from './quote'
import { legPattern } from './schedule'

/** Source §6 customer types, and the industries used for the lead score. */
export const BUSINESS_TYPES: CustomerType[] = ['sme', 'manufacturer', 'distributor', 'brand', 'enterprise', 'marketplace']
export const INDUSTRIES = ['electricals', 'pharma', 'fmcg', 'auto', 'textiles', 'industrial', 'ecommerce', 'other']

/** GST state codes (first two GSTIN digits) for the states the demo serves and their neighbours. */
export const GST_STATES: Record<string, string> = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi',
  '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh', '24': 'Gujarat', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa', '32': 'Kerala', '33': 'Tamil Nadu', '36': 'Telangana', '37': 'Andhra Pradesh',
}

const GSTIN_FORMAT = /^(\d{2})([A-Z]{5}\d{4}[A-Z])[1-9A-Z]Z[0-9A-Z]$/
const PAN_FORMAT = /^[A-Z]{5}\d{4}[A-Z]$/

/** GSTIN format (state code + PAN + entity + Z + check character). The check character itself is not validated (assumed). */
export function gstinCheck(gstin: string): { ok: boolean; state?: string; pan?: string } {
  const m = GSTIN_FORMAT.exec(gstin.trim().toUpperCase())
  if (!m || !GST_STATES[m[1]]) return { ok: false }
  return { ok: true, state: GST_STATES[m[1]], pan: m[2] }
}

export const panValid = (pan: string) => PAN_FORMAT.test(pan.trim().toUpperCase())

/** Source §6 Step 1: duplicate check by GSTIN (accounts and open leads). */
export function gstinTaken(data: DemoData, gstin: string): boolean {
  const g = gstin.trim().toUpperCase()
  return Object.values(data.customers).some((c) => c.gstin === g) || Object.values(data.leads).some((l) => l.gstin === g && l.stage !== 'lost')
}

/** Constitution from the PAN's 4th character (C company, P person, F firm …). */
export function constitutionOf(pan: string): string {
  switch (pan[3]) {
    case 'C':
      return 'Private Ltd'
    case 'P':
      return 'Proprietorship'
    case 'F':
      return 'Partnership'
    default:
      return 'Other'
  }
}

/** Stable small hash for deterministic simulated answers. */
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7)

/**
 * SIMULATED GST API (CP-06): registered details for a GSTIN. A GSTIN ending in
 * "Z9" comes back cancelled, so the flagged path can be shown.
 */
export function gstLookup(gstin: string, legalName: string, city: string, cin?: string) {
  const g = gstin.trim().toUpperCase()
  const pan = g.slice(2, 12)
  const year = cin && /^[UL]\d{5}[A-Z]{2}(\d{4})/.test(cin) ? Number(/^[UL]\d{5}[A-Z]{2}(\d{4})/.exec(cin)![1]) : 2008 + (hash(g) % 15)
  return {
    legalName,
    tradeName: legalName.replace(/\b(Pvt\.?|Private|Ltd\.?|Limited|LLP)\b/gi, '').replace(/\s+/g, ' ').trim(),
    address: `${city}, ${GST_STATES[g.slice(0, 2)] ?? ''}`,
    active: !g.endsWith('Z9'),
    registeredOn: `${year}-04-01`,
    constitution: constitutionOf(pan),
  }
}

const BANKS: Record<string, string> = { HDFC: 'HDFC Bank', ICIC: 'ICICI Bank', SBIN: 'State Bank of India', UTIB: 'Axis Bank', KKBK: 'Kotak Mahindra Bank', PUNB: 'Punjab National Bank', CNRB: 'Canara Bank' }
export const IFSC_FORMAT = /^[A-Z]{4}0[A-Z0-9]{6}$/

const words = (s: string) =>
  s
    .toUpperCase()
    .replace(/\b(PVT|PRIVATE|LTD|LIMITED|LLP|M\/S)\b/g, '')
    .replace(/[^A-Z ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

/**
 * SIMULATED penny-drop (CP-06): ₹1 credit, the bank returns the account
 * holder's name; we score it against the legal name. IFSC FAIL0000000 fails.
 */
export function pennyDrop(ifsc: string, holder: string, legalName: string) {
  const code = ifsc.trim().toUpperCase()
  if (code === 'FAIL0000000') return { ok: false, bankName: 'Unknown bank', branch: '', nameReturned: '', matchPct: 0 }
  const a = words(holder)
  const b = words(legalName)
  const matchPct = b.length ? Math.round((a.filter((w) => b.includes(w)).length / Math.max(a.length, b.length)) * 100) : 0
  return { ok: matchPct >= 80, bankName: BANKS[code.slice(0, 4)] ?? 'Bank', branch: code.slice(5), nameReturned: holder.trim().toUpperCase(), matchPct }
}

const INDUSTRY_WEIGHT: Record<string, number> = { electricals: 18, pharma: 15, fmcg: 14, auto: 14, textiles: 10, industrial: 16, ecommerce: 12, other: 6 }

/** SIMULATED AI lead score (source §6 Step 1: industry, lanes and declared volume), 0–100. */
export function leadScore(industry: string, lanes: number, shipmentsPerMonth: number): number {
  return Math.min(99, 35 + (INDUSTRY_WEIGHT[industry] ?? 6) + Math.min(30, Math.round(shipmentsPerMonth / 15)) + Math.min(16, lanes * 4))
}

const SPEND_ORDER: SpendBand[] = ['lt50k', '50kTo2l', '2lTo10l', '10lTo50l', 'gt50l']

/**
 * Track (source §6 customer types): SME self-serve unless volume is above the
 * threshold (assumed: ₹2 lakh a month or 300 shipments) → inside sales;
 * manufacturer / distributor → inside sales; brand → KAM; enterprise → KAM +
 * solutions; marketplace → API / ONDC self-serve.
 */
export function trackFor(type: CustomerType, shipmentsPerMonth: number, spend: SpendBand): CustomerTrack {
  switch (type) {
    case 'sme':
      return shipmentsPerMonth >= 300 || SPEND_ORDER.indexOf(spend) >= 2 ? 'insideSales' : 'selfServe'
    case 'manufacturer':
    case 'distributor':
      return 'insideSales'
    case 'brand':
      return 'kam'
    case 'enterprise':
      return 'kamSolutions'
    case 'marketplace':
      return 'apiOndc'
  }
}

/** An account manager is assigned on the assisted tracks. */
export const assisted = (t: CustomerTrack) => t === 'insideSales' || t === 'kam' || t === 'kamSolutions'

/**
 * Billing (source §6 table): SME starts prepaid (small credit after 3 months);
 * the others take credit (TBB) when they ask for it.
 */
export function billingFor(type: CustomerType, payment: Qualification['payment']): 'prepaid' | 'credit' {
  if (type === 'sme') return 'prepaid'
  return payment.includes('tbb') ? 'credit' : 'prepaid'
}

/** Cities on the network, for the qualification lanes. */
export function networkCities(data: DemoData): { city: string; state: string }[] {
  const seen = new Map<string, string>()
  for (const p of Object.values(data.pincodes)) if (!seen.has(p.city)) seen.set(p.city, p.state)
  return [...seen.entries()].map(([city, state]) => ({ city, state })).sort((a, b) => a.city.localeCompare(b.city))
}

export type LaneVerdict = 'serviceable' | 'oda' | 'notServiceable'

/** A destination city's representative pincode: serviceable and not ODA where possible. */
function cityPincode(data: DemoData, city: string): Pincode | undefined {
  const pins = Object.values(data.pincodes).filter((p) => p.city === city)
  return pins.find((p) => p.serviceable && !p.oda) ?? pins.find((p) => p.serviceable) ?? pins[0]
}

/** CP-05 lane check: what the customer sees (never Logisco's costs). */
export function laneVerdict(data: DemoData, originPincode: string, destCity: string): LaneVerdict {
  const o = data.pincodes[originPincode]
  const d = cityPincode(data, destCity)
  if (!o?.serviceable || !d?.serviceable) return 'notServiceable'
  // Between hub regions there must be a line-haul lane (same rule as quoting)
  if (legPattern(o, d).includes('lineHaul') && !findLane(data, o, d)) return 'notServiceable'
  return d.oda || Object.values(data.pincodes).filter((p) => p.city === destCity).every((p) => p.oda) ? 'oda' : 'serviceable'
}

/**
 * SIMULATED AI lane-cost preview (source §6 Step 2, ERP-27): price a typical
 * shipment on the standard rate card, plan the legs and compute the margin.
 * PTL-heavy accounts are tested with 100 kg Express PTL, others with a 5 kg
 * Standard parcel.
 */
export function laneMargin(data: DemoData, originPincode: string, destCity: string, parcelPct: number): { marginPct: number; belowTarget: boolean; sample: 'parcel' | 'ptl' } | undefined {
  const d = cityPincode(data, destCity)
  if (!d || laneVerdict(data, originPincode, destCity) === 'notServiceable') return undefined
  const ptl = parcelPct < 50
  const sample = ptl ? { l: 80, b: 60, h: 60, weight: 100 } : { l: 30, b: 25, h: 20, weight: 5 }
  const probe = { ...data, customers: { ...data.customers, PROBE: { ...Object.values(data.customers)[0], id: 'PROBE', rateCardId: 'RC-STANDARD' } } }
  try {
    const q = quote(probe, {
      customerId: 'PROBE',
      originPincode,
      destPincode: d.code,
      serviceKind: ptl ? 'ptl' : 'parcel',
      service: ptl ? 'expressPtl' : 'standard',
      pieces: [sample],
      declaredValue: ptl ? 50000 : 5000,
      addOns: { appointment: false, insurance: false, specialHandling: false },
      paymentMode: 'tbb',
    })
    const plan = planAssignment(probe, { pattern: q.pattern, origin: q.origin, dest: q.dest, lane: q.lane, serviceKind: ptl ? 'ptl' : 'parcel', service: ptl ? 'expressPtl' : 'standard', chargeableKg: q.weights.chargeable, pieces: 1, date: '2026-11-24' })
    const m = computeMargin({ subtotal: q.price.subtotal, legCosts: plan.map((p) => p.cost), insurance: priceLine(q.price, 'fov'), riskBufferPct: data.settings.riskBufferPct, targetMarginPct: data.settings.targetMarginPct })
    return { marginPct: m.grossPct, belowTarget: m.belowTarget, sample: ptl ? 'ptl' : 'parcel' }
  } catch {
    return undefined
  }
}

export interface CreditScore {
  score: number
  /** i18n keys under credit.reason with their points */
  reasons: { key: string; points: number }[]
}

/**
 * SIMULATED AI credit-risk score (source §6 Step 4, §12): GST filing regularity,
 * business age and payment behaviour, plus willingness to give a deposit.
 */
export function creditScore(i: { yearsInBusiness: number; gstConsent: boolean; gstActive: boolean; depositWilling: boolean; paidInvoices?: number; overdueInvoices?: number }): CreditScore {
  const age = i.yearsInBusiness >= 10 ? 30 : i.yearsInBusiness >= 5 ? 20 : i.yearsInBusiness >= 2 ? 10 : 0
  const gst = !i.gstActive ? 5 : i.gstConsent ? 32 : 15
  const history = (i.paidInvoices ?? 0) > 0 ? Math.max(0, 25 - (i.overdueInvoices ?? 0) * 8) : 12
  const deposit = i.depositWilling ? 10 : 0
  return {
    score: Math.min(100, age + gst + history + deposit),
    reasons: [
      { key: `age.${age >= 30 ? 'long' : age >= 20 ? 'medium' : age >= 10 ? 'short' : 'new'}`, points: age },
      { key: `gst.${!i.gstActive ? 'inactive' : i.gstConsent ? 'regular' : 'noConsent'}`, points: gst },
      { key: `history.${(i.paidInvoices ?? 0) > 0 ? 'known' : 'none'}`, points: history },
      { key: `deposit.${i.depositWilling ? 'yes' : 'no'}`, points: deposit },
    ],
  }
}

/** Suggested decision for a score (used by automatic approval and pre-filled in ERP-30). */
export function suggestedCredit(score: number, requested: number): { status: 'approved' | 'approvedLower' | 'declined'; limit: number; deposit: number } {
  if (score >= 70) return { status: 'approved', limit: requested, deposit: Math.round(requested / 10) }
  if (score >= 50) {
    const limit = Math.round(requested / 2 / 1000) * 1000
    return { status: 'approvedLower', limit, deposit: Math.round(limit / 10) }
  }
  return { status: 'declined', limit: 0, deposit: 0 }
}

/** Years since a date (business age from the GST registration date). */
export function yearsSince(date: string, now: string): number {
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(date)) / (365.25 * 86_400_000)))
}

/** The account manager for assisted tracks (seed: Arjun Mehta, KAM). */
export const DEFAULT_KAM: Id = 'LS-ARJUN'
