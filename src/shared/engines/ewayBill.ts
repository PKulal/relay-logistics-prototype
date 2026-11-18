/**
 * E-way bill check — source §7 / seed-data.md §9:
 * required for inter-state movement of goods worth more than ₹50,000;
 * validity is 1 day per 200 km (rounded up), counted from the generation date.
 */
import { addDaysToDate } from '@shared/lib/time'
import type { IsoDate } from '@shared/types'

export interface EwayBillInput {
  goodsValue: number
  originState: string
  destState: string
  distanceKm: number
  generatedOn: IsoDate
  threshold: number
  kmPerDay: number
}

export interface EwayBillResult {
  required: boolean
  reason: 'belowThreshold' | 'intraState' | 'required'
  validityDays: number
  validTill?: IsoDate
}

export function ewayBillCheck(i: EwayBillInput): EwayBillResult {
  const validityDays = Math.max(1, Math.ceil(i.distanceKm / i.kmPerDay))
  if (i.goodsValue <= i.threshold) return { required: false, reason: 'belowThreshold', validityDays }
  if (i.originState === i.destState) return { required: false, reason: 'intraState', validityDays }
  return { required: true, reason: 'required', validityDays, validTill: addDaysToDate(i.generatedOn, validityDays) }
}
