/**
 * Chargeable weight — Customer Portal spec §7.2 (source §8.1).
 *  Parcel: per piece, higher of actual and volumetric (L×B×H ÷ 5,000), rounded UP to the next 0.5 kg.
 *  PTL:    higher of total actual and CFT weight (total cu ft × CFT factor), never below the minimum.
 *
 * CFT rounding (confirmed for the demo): total cubic feet is rounded to 1 decimal,
 * then CFT kg to the nearest whole kg. 6 cartons of 60×40×40 = 20.34 → 20.3 cu ft × 8 = 162.4 → 162 kg.
 */
import { round2 } from './money'

export interface Dims {
  l: number
  b: number
  h: number
  weight: number
}

export const CM3_PER_CUFT = 28317

/** Round up to the next 0.5 kg slab (7.2 → 7.5, 7.5 → 7.5). */
export function roundUpToHalf(kg: number): number {
  return Math.ceil(round2(kg) * 2) / 2
}

export const volumetricKg = (p: Dims, divisor = 5000) => (p.l * p.b * p.h) / divisor
export const cubicFeet = (p: Dims) => (p.l * p.b * p.h) / CM3_PER_CUFT

export interface WeightResult {
  actual: number
  /** Parcel: total volumetric kg. PTL: CFT kg. */
  volumetricOrCft: number
  chargeable: number
  /** PTL only: total cubic feet as used (1 decimal) */
  cubicFeet?: number
}

export function parcelChargeable(pieces: Dims[], divisor = 5000): WeightResult {
  let actual = 0
  let volumetric = 0
  let chargeable = 0
  for (const p of pieces) {
    const vol = volumetricKg(p, divisor)
    actual += p.weight
    volumetric += vol
    chargeable += roundUpToHalf(Math.max(p.weight, vol))
  }
  return { actual: round2(actual), volumetricOrCft: round2(volumetric), chargeable: round2(chargeable) }
}

export function ptlChargeable(pieces: Dims[], cftFactor: number, minKg: number): WeightResult {
  const actual = round2(pieces.reduce((sum, p) => sum + p.weight, 0))
  const cuft = Math.round(pieces.reduce((sum, p) => sum + cubicFeet(p), 0) * 10) / 10
  const cftKg = Math.round(cuft * cftFactor)
  return { actual, volumetricOrCft: cftKg, cubicFeet: cuft, chargeable: Math.max(actual, cftKg, minKg) }
}
