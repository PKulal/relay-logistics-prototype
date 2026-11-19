/**
 * Failed delivery (NDR) rules — source §5.1, §7 Step 10, §10 Step 3; PA-35,
 * CP-21, CP-18. Assumed (CP-21 spec): reattempt within the next 3 working days
 * (Monday–Saturday); no response within 24 hours → reattempt the next working
 * day; after 3 failed attempts → RTO; RTO charge equal to the forward freight.
 */
import { addDaysToDate, addHours, istDate } from '@shared/lib/time'
import type { DemoData, Id, IsoDate, IsoDateTime, Ndr, NdrReason } from '@shared/types'
import { NDR_REASONS } from '@shared/types'
import { NDR_RESPONSE_HOURS } from './customerDashboard'
import { priceLine } from './pricing'

export const REATTEMPT_WORKING_DAYS = 3
/** Masked call log the rider needs before an NDR (PA-35, assumed). */
export const CALL_LOG_MINUTES = 15

const isSunday = (d: IsoDate) => new Date(`${d}T12:00:00+05:30`).getUTCDay() === 0

/** The next `n` working days after a date (Sundays off, assumed). */
export function nextWorkingDays(from: IsoDate, n = REATTEMPT_WORKING_DAYS): IsoDate[] {
  const out: IsoDate[] = []
  let d = from
  while (out.length < n) {
    d = addDaysToDate(d, 1)
    if (!isSunday(d)) out.push(d)
  }
  return out
}

export const asNdrReason = (r?: string): NdrReason => (NDR_REASONS as readonly string[]).includes(r ?? '') ? (r as NdrReason) : 'other'

/**
 * The NDRs of a shipment, oldest first. Background shipments from the seed
 * generator carry only the failed-delivery event: their NDR is derived from it.
 */
export function ndrsOf(data: DemoData, lr: Id): Ndr[] {
  const records = Object.values(data.ndrs)
    .filter((n) => n.shipmentId === lr)
    .sort((a, b) => a.attempt - b.attempt)
  if (records.length) return records
  const failed = Object.values(data.events)
    .filter((e) => e.shipmentId === lr && e.type === 'deliveryFailed')
    .sort((a, b) => a.at.localeCompare(b.at))
  return failed.map((e, i) => ({ id: `NDR-${lr.slice(-6)}-${i + 1}`, shipmentId: lr, legId: e.legId, attempt: i + 1, reason: asNdrReason(e.reason), note: e.note, photo: e.photos?.[0], at: e.at }))
}

/** The latest NDR still waiting for a response (shipment Undelivered). */
export function openNdr(data: DemoData, lr: Id): Ndr | undefined {
  const s = data.shipments[lr]
  if (s?.status !== 'undelivered') return undefined
  const last = ndrsOf(data, lr).at(-1)
  return last && !last.customerChoice ? last : undefined
}

/** When the response is due: the NDR ticket's target, else 24 hours after the attempt. */
export function ndrDueAt(data: DemoData, n: Ndr): IsoDateTime {
  const ticket = Object.values(data.exceptions).find((x) => x.shipmentId === n.shipmentId && x.type === 'ndr' && x.status !== 'resolved')
  return ticket?.actionDueAt ?? addHours(n.at, NDR_RESPONSE_HOURS)
}

/** RTO charge: equal to the forward freight (assumed, CP-21). */
export const rtoCharge = (data: DemoData, lr: Id) => priceLine(data.shipments[lr].price, 'freight')

/** Reattempt dates offered for an NDR: the next working days after today. */
export const reattemptDates = (now: IsoDateTime) => nextWorkingDays(istDate(now))
