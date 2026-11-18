/**
 * Book a shipment: quote → e-way bill → leg plan → shipment + legs + opening events.
 * Pure (returns new data). Used by CP-13 and by the seed to create every
 * shipment the same way, so seeded and live shipments can't drift apart.
 */
import { LR_CODES } from '@data/seed/master'
import { planAssignment } from '@shared/engines/assignment'
import type { Dims } from '@shared/engines/chargeableWeight'
import { ewayBillCheck } from '@shared/engines/ewayBill'
import { quote } from '@shared/engines/quote'
import { computeEta, legWindows, type Slot } from '@shared/engines/schedule'
import { simulateEwbNumber } from '@shared/sim/ewayBill'
import type { DemoData, Id, IsoDate, IsoDateTime, Leg, PaymentMode, Service, ServiceKind, Shipment, ShipmentEvent } from '@shared/types'
import { applyEvents, nextLr } from './actions'

export interface BookingInput {
  customerId: Id
  bookedByUserId: Id
  pickupLocationId: Id
  consigneeId: Id
  serviceKind: ServiceKind
  service: Service
  paymentMode: PaymentMode
  codAmount?: number
  addOns: { appointment: boolean; insurance: boolean; specialHandling: boolean }
  invoice: { no: string; date: IsoDate; value: number; po?: string }
  hsn: string
  goodsDescription: string
  pieces: (Dims & { skuCode?: string })[]
  pickupSlot: Slot
  /** Appointment slot on the ETA date (when addOns.appointment) */
  appointment?: { from: string; to: string; dock?: string }
  /** Seed only: a fixed LR (e.g. LGS-DEL-000784). Live bookings take the next free LR. */
  lr?: Id
  /** Seed only: false skips wallet / credit movements (seeded balances are snapshots). Default true. */
  applyMoney?: boolean
}

/** Distance used for e-way bill validity when there is no line-haul lane (assumed). */
const LOCAL_KM = { intraCity: 25, intraRegion: 120 }

/** Event ids are per shipment: LGS-DEL-000781-E01, -E02 … */
export function eventIdFactory(data: DemoData, shipmentId: Id) {
  let n = Object.values(data.events).filter((e) => e.shipmentId === shipmentId).length
  return () => `${shipmentId}-E${String(++n).padStart(2, '0')}`
}

export function bookShipment(data: DemoData, input: BookingInput, at: IsoDateTime): { data: DemoData; shipmentId: Id } {
  const location = data.pickupLocations[input.pickupLocationId]
  const consignee = data.consignees[input.consigneeId]
  const q = quote(data, {
    customerId: input.customerId,
    originPincode: location.pincode,
    destPincode: consignee.pincode,
    serviceKind: input.serviceKind,
    service: input.service,
    pieces: input.pieces,
    declaredValue: input.invoice.value,
    addOns: input.addOns,
    paymentMode: input.paymentMode,
    codAmount: input.codAmount,
  })

  const eta = computeEta(input.pickupSlot.date, q.transitDays)
  const deliverySlot = input.addOns.appointment && input.appointment ? { date: eta, ...input.appointment } : undefined
  const windows = legWindows(q.pattern, { pickupSlot: input.pickupSlot, eta, lane: q.lane, deliverySlot })
  const plan = planAssignment(data, {
    pattern: q.pattern,
    origin: q.origin,
    dest: q.dest,
    lane: q.lane,
    serviceKind: input.serviceKind,
    service: input.service,
    chargeableKg: q.weights.chargeable,
    pieces: input.pieces.length,
    date: input.pickupSlot.date,
  })

  // LR
  let lr = input.lr
  let lrSerials = data.lrSerials
  if (!lr) {
    const code = LR_CODES[q.origin.city]
    if (!code) throw new Error(`No LR code for ${q.origin.city}`)
    ;({ lr, lrSerials } = nextLr(data, code))
  }
  if (data.shipments[lr]) throw new Error(`LR ${lr} already exists`)
  const serial = lr.slice(-6)

  const distanceKm = q.lane?.distanceKm ?? (q.pattern.length === 2 ? LOCAL_KM.intraCity : LOCAL_KM.intraRegion)
  const ewb = ewayBillCheck({
    goodsValue: input.invoice.value,
    originState: q.origin.state,
    destState: q.dest.state,
    distanceKm,
    generatedOn: input.invoice.date,
    threshold: data.settings.ewayBillThreshold,
    kmPerDay: data.settings.ewayBillKmPerDay,
  })

  const legs: Leg[] = plan.map((p, i) => ({
    id: `JOB-${serial}-L${i + 1}`,
    shipmentId: lr,
    seq: i + 1,
    type: p.type,
    partnerId: p.partnerId,
    status: 'offered',
    window: windows[i],
    slaDueAt: windows[i].to,
    cost: p.cost,
    updatedAt: at,
  }))

  const shipment: Shipment = {
    id: lr,
    customerId: input.customerId,
    bookedByUserId: input.bookedByUserId,
    bookedAt: at,
    pickupLocationId: input.pickupLocationId,
    consigneeId: input.consigneeId,
    originPincode: q.origin.code,
    destPincode: q.dest.code,
    laneId: q.lane?.id,
    serviceKind: input.serviceKind,
    service: input.service,
    paymentMode: input.paymentMode,
    codAmount: input.codAmount,
    addOns: input.addOns,
    invoice: input.invoice,
    hsn: input.hsn,
    goodsDescription: input.goodsDescription,
    ewb: ewb.required ? { no: simulateEwbNumber(lr), validTill: ewb.validTill!, partBUpdated: false } : undefined,
    pickupSlot: input.pickupSlot,
    pieces: input.pieces.map((p, i) => ({ id: `${lr}-${String(i + 1).padStart(2, '0')}`, l: p.l, b: p.b, h: p.h, weight: p.weight, skuCode: p.skuCode })),
    weights: { actual: q.weights.actual, volumetricOrCft: q.weights.volumetricOrCft, chargeable: q.weights.chargeable },
    price: q.price,
    status: 'booked',
    eta,
    appointment: deliverySlot,
    legIds: legs.map((l) => l.id),
    updatedAt: at,
  }

  let next: DemoData = {
    ...data,
    lrSerials,
    shipments: { ...data.shipments, [lr]: shipment },
    legs: { ...data.legs, ...Object.fromEntries(legs.map((l) => [l.id, l])) },
  }

  // Money: prepaid pays from the wallet now; credit (TBB) uses the credit line.
  if (input.applyMoney !== false) next = applyBookingMoney(next, shipment, at)

  const newId = eventIdFactory(next, lr)
  const events: ShipmentEvent[] = [
    { id: newId(), shipmentId: lr, type: 'booked', at, by: input.bookedByUserId, app: 'customer' },
    ...legs.map((l): ShipmentEvent => ({ id: newId(), shipmentId: lr, legId: l.id, type: 'legOffered', at, by: 'system', app: 'erp' })),
  ]
  return { data: applyEvents(next, events, at), shipmentId: lr }
}

function applyBookingMoney(data: DemoData, s: Shipment, at: IsoDateTime): DemoData {
  const customer = data.customers[s.customerId]
  const total = s.price.total
  if (customer.billing === 'prepaid' && s.paymentMode === 'paid') {
    const balanceAfter = Math.round((customer.walletBalance - total) * 100) / 100
    const txnId = `WT-${s.id}`
    return {
      ...data,
      customers: { ...data.customers, [customer.id]: { ...customer, walletBalance: balanceAfter } },
      walletTxns: { ...data.walletTxns, [txnId]: { id: txnId, customerId: customer.id, type: 'debit', ref: s.id, amount: -total, balanceAfter, at } },
    }
  }
  if (customer.billing === 'credit' && s.paymentMode === 'tbb') {
    const creditUsed = Math.round((customer.creditUsed + total) * 100) / 100
    return { ...data, customers: { ...data.customers, [customer.id]: { ...customer, creditUsed } } }
  }
  return data
}
