/**
 * Quote form model shared by CP-12 (Get quote) and CP-13 (Book shipment, which
 * opens pre-filled from a quote). Pure helpers, no React.
 */
import { quote, QuoteError, type Quote, type QuoteInput } from '@shared/engines/quote'
import type { DemoData, ParcelTier, PaymentMode, PtlService } from '@shared/types'

// ─── Form model ────────────────────────────────────────────────────────────────

export type ServiceChoice = 'parcel' | PtlService
export const OTHER_PINCODE = '__pincode'

export interface Row {
  key: number
  skuCode: string
  qty: string
  l: string
  b: string
  h: string
  weight: string
}

export interface QuoteForm {
  service: ServiceChoice
  tier: ParcelTier
  /** Saved pickup location id, or OTHER_PINCODE */
  origin: string
  originPincode: string
  destPincode: string
  rows: Row[]
  value: string
  paymentMode: PaymentMode
  codAmount: string
  addOns: { appointment: boolean; insurance: boolean; specialHandling: boolean }
}

let rowKey = 0
export const emptyRow = (): Row => ({ key: ++rowKey, skuCode: '', qty: '1', l: '', b: '', h: '', weight: '' })

export function emptyForm(defaultLocation: string, credit: boolean): QuoteForm {
  return {
    service: credit ? 'expressPtl' : 'parcel',
    tier: 'standard',
    origin: defaultLocation,
    originPincode: '',
    destPincode: '',
    rows: [emptyRow()],
    value: '',
    paymentMode: credit ? 'tbb' : 'paid',
    codAmount: '',
    addOns: { appointment: false, insurance: false, specialHandling: false },
  }
}

/** Demo samples from the spec's worked examples (CP spec §7.3). */
export const SAMPLES: Record<string, (f: QuoteForm) => QuoteForm> = {
  'C-SHARMA': (f) => ({
    ...f,
    service: 'expressPtl',
    origin: 'PL-OKHLA',
    destPincode: '580030',
    rows: [{ key: ++rowKey, skuCode: 'SG-LT-400', qty: '6', l: '60', b: '40', h: '40', weight: '20' }],
    value: '180000',
    paymentMode: 'tbb',
    addOns: { appointment: true, insurance: true, specialHandling: false },
  }),
  'C-KAVERI': (f) => ({
    ...f,
    service: 'parcel',
    tier: 'standard',
    origin: 'PL-KAVERI',
    destPincode: '411001',
    rows: [{ key: ++rowKey, skuCode: '', qty: '1', l: '40', b: '30', h: '30', weight: '6' }],
    value: '4500',
    paymentMode: 'paid',
    addOns: { appointment: false, insurance: false, specialHandling: false },
  }),
}

export const num = (s: string) => (s.trim() === '' ? NaN : Number(s))
export const positive = (s: string) => Number.isFinite(num(s)) && num(s) > 0

export type DestCheck = 'empty' | 'unknown' | 'notServiceable' | 'oda' | 'serviceable'

export function destinationCheck(data: DemoData, pincode: string): DestCheck {
  if (!/^\d{6}$/.test(pincode)) return 'empty'
  const p = data.pincodes[pincode]
  if (!p) return 'unknown'
  if (!p.serviceable) return 'notServiceable'
  return p.oda ? 'oda' : 'serviceable'
}

/** Turn the form into a quote request, or null while it is incomplete. */
export function toQuoteInput(data: DemoData, customerId: string, f: QuoteForm, tierOverride?: ParcelTier): QuoteInput | null {
  const originPincode = f.origin === OTHER_PINCODE ? f.originPincode : data.pickupLocations[f.origin]?.pincode
  if (!originPincode || !/^\d{6}$/.test(originPincode) || !/^\d{6}$/.test(f.destPincode)) return null
  if (!positive(f.value)) return null
  const pieces = []
  for (const r of f.rows) {
    if (![r.qty, r.l, r.b, r.h, r.weight].every(positive)) return null
    for (let i = 0; i < Math.floor(num(r.qty)); i++) pieces.push({ l: num(r.l), b: num(r.b), h: num(r.h), weight: num(r.weight) })
  }
  return {
    customerId,
    originPincode,
    destPincode: f.destPincode,
    serviceKind: f.service === 'parcel' ? 'parcel' : 'ptl',
    service: f.service === 'parcel' ? (tierOverride ?? f.tier) : f.service,
    pieces,
    declaredValue: num(f.value),
    addOns: f.addOns,
    paymentMode: f.paymentMode,
    codAmount: f.paymentMode === 'cod' && positive(f.codAmount) ? num(f.codAmount) : undefined,
  }
}

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; code: QuoteError['code'] }

export function tryQuote(data: DemoData, input: QuoteInput): QuoteResult {
  try {
    return { ok: true, quote: quote(data, input) }
  } catch (e) {
    if (e instanceof QuoteError) return { ok: false, code: e.code }
    throw e
  }
}
