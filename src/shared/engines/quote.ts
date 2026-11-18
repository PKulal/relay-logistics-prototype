/**
 * Quote: resolves pincodes, lane, zone and the customer's rate card from the
 * data set, then runs the weight and pricing engines. Used by CP-12 (get quote),
 * CP-13 (booking) and the seed generator.
 */
import type { CustomerRateCard, DemoData, Lane, LegType, ParcelZone, PaymentMode, Pincode, Price, Service, ServiceKind } from '@shared/types'
import { parcelChargeable, ptlChargeable, type Dims, type WeightResult } from './chargeableWeight'
import { buildPrice, parcelZone } from './pricing'
import { legPattern, transitDays } from './schedule'

export interface QuoteInput {
  customerId: string
  originPincode: string
  destPincode: string
  serviceKind: ServiceKind
  service: Service
  pieces: Dims[]
  declaredValue: number
  addOns: { appointment: boolean; insurance: boolean; specialHandling: boolean }
  paymentMode: PaymentMode
  codAmount?: number
}

export interface Quote {
  origin: Pincode
  dest: Pincode
  pattern: LegType[]
  lane?: Lane
  zone?: ParcelZone
  rateCard: CustomerRateCard
  weights: WeightResult
  price: Price
  transitDays: number
}

export type QuoteErrorCode =
  | 'unknownPincode'
  | 'originNotServiceable'
  | 'destNotServiceable'
  | 'serviceMismatch'
  | 'noLane'
  | 'serviceNotOnLane'

export class QuoteError extends Error {
  readonly code: QuoteErrorCode
  constructor(code: QuoteErrorCode) {
    super(code)
    this.code = code
  }
}

const PTL_SERVICES: Service[] = ['expressPtl', 'standardPtl']

export function findLane(data: DemoData, origin: Pincode, dest: Pincode): Lane | undefined {
  return Object.values(data.lanes).find((l) => l.originHubId === origin.hubId && l.destHubId === dest.hubId)
}

export function quote(data: DemoData, input: QuoteInput): Quote {
  const origin = data.pincodes[input.originPincode]
  const dest = data.pincodes[input.destPincode]
  if (!origin || !dest) throw new QuoteError('unknownPincode')
  if (!origin.serviceable) throw new QuoteError('originNotServiceable')
  if (!dest.serviceable) throw new QuoteError('destNotServiceable')
  if ((input.serviceKind === 'ptl') !== PTL_SERVICES.includes(input.service)) throw new QuoteError('serviceMismatch')

  const customer = data.customers[input.customerId]
  const rateCard = data.rateCards[customer.rateCardId]
  const pattern = legPattern(origin, dest)
  const lane = pattern.includes('lineHaul') ? findLane(data, origin, dest) : undefined
  if (pattern.includes('lineHaul') && !lane) throw new QuoteError('noLane')

  const common = {
    surcharges: rateCard.surcharges,
    gstPct: data.settings.gstPct,
    pieces: input.pieces.length,
    declaredValue: input.declaredValue,
    addOns: input.addOns,
    paymentMode: input.paymentMode,
    codAmount: input.codAmount,
    oda: origin.oda || dest.oda,
  }

  if (input.serviceKind === 'ptl') {
    // PTL is priced per lane; within a region there is no line-haul lane to price on.
    const line = lane && rateCard.ptl.find((l) => l.laneId === lane.id && l.service === input.service)
    if (!line) throw new QuoteError(lane ? 'serviceNotOnLane' : 'noLane')
    const weights = ptlChargeable(input.pieces, line.cftFactor, line.minKg)
    const price = buildPrice({ ...common, serviceKind: 'ptl', chargeableKg: weights.chargeable, ptlPerKg: line.perKg })
    return { origin, dest, pattern, lane, rateCard, weights, price, transitDays: transitDays(pattern, input.service, lane) }
  }

  const zone = parcelZone(origin, dest)
  const weights = parcelChargeable(input.pieces, data.settings.volumetricDivisor)
  const parcelRate = rateCard.parcel[zone][input.service as 'economy' | 'standard' | 'express']
  const price = buildPrice({ ...common, serviceKind: 'parcel', chargeableKg: weights.chargeable, parcelRate })
  return { origin, dest, pattern, lane, zone, rateCard, weights, price, transitDays: transitDays(pattern, input.service, lane) }
}
