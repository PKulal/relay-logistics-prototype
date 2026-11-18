/**
 * Price build-up — Customer Portal spec §7.3 (source §8.1).
 * Order: base freight → surcharges → subtotal → GST → total. Every line is
 * rounded to paise; GST is computed on the rounded subtotal.
 */
import type { ParcelRate, ParcelZone, PaymentMode, Pincode, Price, PriceLine, ServiceKind, Surcharges } from '@shared/types'
import { pct, round2 } from './money'

/**
 * Parcel zone for a pair of pincodes (zones assumed in CP-08):
 * E special (North-East, J&K) · A same city · B same state · C metro → metro · D rest of India.
 */
export function parcelZone(origin: Pick<Pincode, 'city' | 'state' | 'metro' | 'special'>, dest: Pick<Pincode, 'city' | 'state' | 'metro' | 'special'>): ParcelZone {
  if (origin.special || dest.special) return 'E'
  if (origin.city === dest.city) return 'A'
  if (origin.state === dest.state) return 'B'
  if (origin.metro && dest.metro) return 'C'
  return 'D'
}

export interface PriceInput {
  serviceKind: ServiceKind
  chargeableKg: number
  /** Parcel: the zone × tier rate */
  parcelRate?: ParcelRate
  /** PTL: rate per kg on the lane */
  ptlPerKg?: number
  surcharges: Surcharges
  gstPct: number
  pieces: number
  declaredValue: number
  addOns: { appointment: boolean; insurance: boolean; specialHandling: boolean }
  paymentMode: PaymentMode
  codAmount?: number
  /** Origin or destination is an ODA pincode */
  oda: boolean
}

/** Parcel freight: first 0.5 kg + each additional 0.5 kg slab. */
function parcelFreight(kg: number, rate: ParcelRate) {
  const slabs = Math.max(1, Math.ceil(kg * 2))
  return { amount: round2(rate.first + (slabs - 1) * rate.additional), slabs }
}

export function buildPrice(input: PriceInput): Price {
  const { surcharges: s, chargeableKg: kg } = input
  const lines: PriceLine[] = []

  // 1. Base freight
  let freight: number
  if (input.serviceKind === 'ptl') {
    if (input.ptlPerKg === undefined) throw new Error('PTL price needs a per-kg rate')
    freight = round2(kg * input.ptlPerKg)
    lines.push({ code: 'freight', amount: freight, basis: { kg, rate: input.ptlPerKg } })
  } else {
    if (!input.parcelRate) throw new Error('Parcel price needs a zone rate')
    const f = parcelFreight(kg, input.parcelRate)
    freight = f.amount
    lines.push({ code: 'freight', amount: freight, basis: { kg, slabs: f.slabs, first: input.parcelRate.first, additional: input.parcelRate.additional } })
  }

  // 2. Surcharges
  lines.push({ code: 'fuel', amount: pct(freight, s.fuelPct), basis: { pct: s.fuelPct } })
  if (input.oda) {
    lines.push({ code: 'oda', amount: round2(Math.max(s.odaMin, kg * s.odaPerKg)), basis: { kg, rate: s.odaPerKg, value: s.odaMin } })
  }
  const docket = input.serviceKind === 'ptl' ? s.docketPtl : s.docketParcel
  lines.push({ code: 'docket', amount: docket, basis: {} })
  if (input.addOns.appointment) lines.push({ code: 'appointment', amount: s.appointment, basis: {} })
  if (input.paymentMode === 'cod') {
    const cod = input.codAmount ?? 0
    lines.push({ code: 'cod', amount: round2(Math.max(s.codMin, (cod * s.codPct) / 100)), basis: { pct: s.codPct, value: cod } })
  }
  if (input.paymentMode === 'toPay') lines.push({ code: 'toPay', amount: s.toPayFee, basis: {} })
  if (input.addOns.insurance) {
    lines.push({ code: 'fov', amount: pct(input.declaredValue, s.fovPct), basis: { pct: s.fovPct, value: input.declaredValue } })
  }
  if (input.addOns.specialHandling) {
    lines.push({ code: 'specialHandling', amount: round2(input.pieces * s.specialHandlingPerPiece), basis: { pieces: input.pieces, rate: s.specialHandlingPerPiece } })
  }

  // 3. Subtotal, GST, total
  const subtotal = round2(lines.reduce((sum, l) => sum + l.amount, 0))
  const gst = pct(subtotal, input.gstPct)
  return { lines, subtotal, gst, total: round2(subtotal + gst) }
}

/** Amount of one price line (0 if absent). */
export const priceLine = (price: Price, code: PriceLine['code']) => price.lines.find((l) => l.code === code)?.amount ?? 0
