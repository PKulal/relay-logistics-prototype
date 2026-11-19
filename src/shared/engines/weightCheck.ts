/**
 * Weight revisions (source §7 Step 4; §12 "Weight & Dimension Checks: booked
 * vs scanned weight and photos; flags errors / fraud"): the booked vs verified
 * comparison shown on CP-20 and ERP-31, and the SIMULATED AI check.
 */
import type { DemoData, Id, Shipment, WeightDisputeReason, WeightRevision } from '@shared/types'
import { quote } from './quote'

export const DISPUTE_REASONS: WeightDisputeReason[] = ['dimensions', 'weight', 'wrongPiece', 'skuFrozen', 'other']
export const DISPUTE_REMARKS_MAX = 500
export const DISPUTE_FILES_MAX = 5

export interface PieceComparison {
  id: Id
  booked: { l: number; b: number; h: number; weight: number }
  verified: { l: number; b: number; h: number; weight: number }
  changed: boolean
  skuCode?: string
}

export interface SideTotals {
  actual: number
  volumetricOrCft: number
  chargeable: number
  total: number
}

export interface WeightComparison {
  pieces: PieceComparison[]
  booked: SideTotals
  verified: SideTotals
  /** Price difference including GST */
  difference: number
}

/** Booked vs verified, per piece and in total, priced on the customer's rate card. */
export function compareWeights(data: DemoData, s: Shipment): WeightComparison {
  const pieces = s.pieces.map((p): PieceComparison => {
    const v = { l: p.verifiedDims?.l ?? p.l, b: p.verifiedDims?.b ?? p.b, h: p.verifiedDims?.h ?? p.h, weight: p.verifiedWeight ?? p.weight }
    return { id: p.id, booked: { l: p.l, b: p.b, h: p.h, weight: p.weight }, verified: v, changed: v.l !== p.l || v.b !== p.b || v.h !== p.h || v.weight !== p.weight, skuCode: p.skuCode }
  })
  const q = quote(data, {
    customerId: s.customerId,
    originPincode: s.originPincode,
    destPincode: s.destPincode,
    serviceKind: s.serviceKind,
    service: s.service,
    pieces: pieces.map((p) => p.verified),
    declaredValue: s.invoice.value,
    addOns: s.addOns,
    paymentMode: s.paymentMode,
    codAmount: s.codAmount,
  })
  const booked = { ...s.weights, total: s.price.total }
  const verified = { actual: q.weights.actual, volumetricOrCft: q.weights.volumetricOrCft, chargeable: q.weights.chargeable, total: q.price.total }
  return { pieces, booked, verified, difference: Math.round((verified.total - booked.total) * 100) / 100 }
}

export type WeightFlag = 'photosMissing' | 'skuFrozenDiffers' | 'largeJump'

export interface AiWeightCheck {
  /** Changed pieces with a scale and a tape photo */
  photoCoverage: { withPhotos: number; changed: number }
  flags: WeightFlag[]
  /** consistent: evidence supports the revision; review: a person should look */
  verdict: 'consistent' | 'review'
}

/** A jump above this share of the booked chargeable weight is flagged (assumed). */
const LARGE_JUMP_PCT = 25

/**
 * SIMULATED AI check: photos for every changed piece, frozen SKU dimensions
 * (source §6 Step 7: "SKU master … → weight freeze") that disagree with the
 * measurement, and unusually large jumps.
 */
export function aiWeightCheck(data: DemoData, s: Shipment, wr: WeightRevision): AiWeightCheck {
  const cmp = compareWeights(data, s)
  const changed = cmp.pieces.filter((p) => p.changed)
  const withPhotos = changed.filter((p) => wr.photos.some((ph) => ph.startsWith(`${p.id}-scale`)) && (!dimsChanged(p) || wr.photos.some((ph) => ph.startsWith(`${p.id}-tape`)))).length
  const flags: WeightFlag[] = []
  if (withPhotos < changed.length) flags.push('photosMissing')
  const frozen = (code?: string) => Object.values(data.skus).find((k) => k.customerId === s.customerId && k.code === code && k.status === 'frozen')
  if (changed.some((p) => frozen(p.skuCode))) flags.push('skuFrozenDiffers')
  if (wr.booked > 0 && ((wr.verified - wr.booked) / wr.booked) * 100 > LARGE_JUMP_PCT) flags.push('largeJump')
  return { photoCoverage: { withPhotos, changed: changed.length }, flags, verdict: flags.length ? 'review' : 'consistent' }
}

const dimsChanged = (p: PieceComparison) => p.verified.l !== p.booked.l || p.verified.b !== p.booked.b || p.verified.h !== p.booked.h
