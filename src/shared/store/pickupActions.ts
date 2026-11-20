/**
 * Partner App pickup actions (PA-14 to PA-17) and weight verification (Partner
 * App spec §7.4). Pure state changes; every step is a chain-of-custody event.
 */
import { logAiData } from './aiLogActions'
import { quote } from '@shared/engines/quote'
import { round2 } from '@shared/engines/money'
import type { DemoData, Id, IsoDateTime, Piece, ShipmentEvent } from '@shared/types'
import { applyEvents } from './actions'
import { eventIdFactory } from './booking'

/** What the rider measured for one piece. */
export interface VerifiedPiece {
  id: Id
  l: number
  b: number
  h: number
  weight: number
}

/**
 * Tolerance before a weight revision: 3% or 0.5 kg, whichever is higher
 * (Partner App spec §7.2, ERP-44 settings).
 */
export function outsideTolerance(data: DemoData, booked: number, verified: number): boolean {
  const allowed = Math.max((booked * data.settings.weightTolerancePct) / 100, data.settings.weightToleranceKg)
  return Math.abs(verified - booked) > allowed
}

/** Verified chargeable weight and the price difference it would make. */
export function verifiedOutcome(data: DemoData, lr: Id, verified: VerifiedPiece[]) {
  const s = data.shipments[lr]
  const byId = new Map(verified.map((v) => [v.id, v]))
  const revised = quote(data, {
    customerId: s.customerId,
    originPincode: s.originPincode,
    destPincode: s.destPincode,
    serviceKind: s.serviceKind,
    service: s.service,
    pieces: s.pieces.map((p) => byId.get(p.id) ?? p),
    declaredValue: s.invoice.value,
    addOns: s.addOns,
    paymentMode: s.paymentMode,
    codAmount: s.codAmount,
  })
  const booked = s.weights.chargeable
  const now = revised.weights.chargeable
  return {
    booked,
    verified: now,
    weights: revised.weights,
    amountDiff: round2(revised.price.total - s.price.total),
    revision: outsideTolerance(data, booked, now),
  }
}

/**
 * Store the rider's measurements on the pieces and, when outside tolerance,
 * raise a pending weight revision for the customer (CP-20) with a weightRevised event.
 * Used by PA-17 and by the seed (LGS-DEL-000784).
 */
export function applyVerifiedWeights(data: DemoData, lr: Id, verified: VerifiedPiece[], staffId: Id, at: IsoDateTime, photos: string[] = []): DemoData {
  const s = data.shipments[lr]
  const outcome = verifiedOutcome(data, lr, verified)
  const byId = new Map(verified.map((v) => [v.id, v]))
  const pieces: Piece[] = s.pieces.map((p) => {
    const v = byId.get(p.id)
    return v ? { ...p, verifiedDims: { l: v.l, b: v.b, h: v.h }, verifiedWeight: v.weight } : p
  })
  let next: DemoData = {
    ...data,
    shipments: { ...data.shipments, [lr]: { ...s, pieces, weights: { ...s.weights, verifiedChargeable: outcome.verified }, updatedAt: at } },
  }
  if (!outcome.revision) return next

  const changed = verified.filter((v) => {
    const p = s.pieces.find((x) => x.id === v.id)!
    return p.l !== v.l || p.b !== v.b || p.h !== v.h || p.weight !== v.weight
  })
  const ev: ShipmentEvent = {
    id: eventIdFactory(next, lr)(),
    shipmentId: lr,
    legId: s.legIds[0],
    type: 'weightRevised',
    at,
    by: staffId,
    app: 'partnerApp',
    pieceIds: changed.map((c) => c.id),
    photos,
    note: changed.map((c) => `${c.id.slice(-2)}: ${c.l} × ${c.b} × ${c.h} cm, ${c.weight} kg`).join('; '),
  }
  next = applyEvents(next, [ev], at)
  next = logAiData(next, { kind: 'weightCheck', recordId: lr, at, confidence: 0.95, flag: 'outsideTolerance', score: outcome.amountDiff, app: 'partnerApp' })
  const id = `WR-${lr.slice(-6)}`
  return {
    ...next,
    weightRevisions: {
      ...next.weightRevisions,
      [id]: { id, shipmentId: lr, booked: outcome.booked, verified: outcome.verified, amountDiff: outcome.amountDiff, photos, raisedAt: at, status: 'pending' },
    },
  }
}

/** PA-14 "I've arrived": geo-fenced arrival at the pickup point. */
export function arriveAtPickup(data: DemoData, legId: Id, staffId: Id, at: IsoDateTime): DemoData {
  const leg = data.legs[legId]
  if (!leg || leg.status !== 'assigned') return data
  const loc = data.pickupLocations[data.shipments[leg.shipmentId].pickupLocationId]
  // SIMULATED GPS: the phone reports the pickup pin itself (inside the 200 m geo-fence)
  const ev: ShipmentEvent = { id: eventIdFactory(data, leg.shipmentId)(), shipmentId: leg.shipmentId, legId, type: 'pickupArrived', at, by: staffId, app: 'partnerApp', lat: loc.lat, lng: loc.lng }
  return applyEvents(data, [ev], at)
}

export interface PickupConfirmation {
  legId: Id
  staffId: Id
  /** Pieces scanned at pickup */
  pieceIds: Id[]
  verified: VerifiedPiece[]
  /** Photo ids: invoice, scale, tape, packaging */
  photos: string[]
  /** Shipper staff who handed over */
  handedOverBy: string
  confirmation: 'signature' | 'otp'
  packagingDamaged: boolean
  labelledBy: 'shipper' | 'rider'
}

/**
 * PA-17 "Confirm pickup": records the weights (and any revision), then the
 * pickupConfirmed event → leg In progress, shipment Picked Up in every app.
 */
export function confirmPickup(data: DemoData, c: PickupConfirmation, at: IsoDateTime): DemoData {
  const leg = data.legs[c.legId]
  if (!leg || !['assigned'].includes(leg.status)) return data
  const s = data.shipments[leg.shipmentId]
  const loc = data.pickupLocations[s.pickupLocationId]
  let next = applyVerifiedWeights(data, s.id, c.verified, c.staffId, at, c.photos.filter((p) => p.includes('scale') || p.includes('tape')))
  const ev: ShipmentEvent = {
    id: eventIdFactory(next, s.id)(),
    shipmentId: s.id,
    legId: c.legId,
    type: 'pickupConfirmed',
    at,
    by: c.staffId,
    app: 'partnerApp',
    lat: loc.lat, // SIMULATED GPS
    lng: loc.lng,
    pieceIds: c.pieceIds,
    photos: c.photos,
    vehicleNo: leg.vehicleId ? data.vehicles[leg.vehicleId]?.regNo : undefined,
    note: [`Handed over by ${c.handedOverBy}`, c.confirmation === 'otp' ? 'OTP verified' : 'Signed', c.labelledBy === 'rider' ? 'Labels attached by rider' : '', c.packagingDamaged ? 'Packaging damaged' : '']
      .filter(Boolean)
      .join(' · '),
  }
  next = applyEvents(next, [ev], at)
  return next
}

/** Mark notifications read (Partner App "New" badges). */
export function markRead(data: DemoData, ids: Id[]): DemoData {
  if (ids.length === 0) return data
  const notifications = { ...data.notifications }
  for (const id of ids) if (notifications[id]) notifications[id] = { ...notifications[id], read: true }
  return { ...data, notifications }
}
