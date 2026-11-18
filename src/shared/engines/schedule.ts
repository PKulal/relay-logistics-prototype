/**
 * Leg pattern, ETA and leg time windows — ERP spec §7.1 and §12 #8:
 * intra-city 2 legs, intra-region 3 legs, long-haul 5 legs. Cut-offs and
 * hand-over windows are aligned so the legs connect.
 */
import { addDaysToDate, ist, istDate, istParts, isBefore, addDays } from '@shared/lib/time'
import type { IsoDate, IsoDateTime, Lane, LegType, Pincode, Service } from '@shared/types'

export function legPattern(origin: Pick<Pincode, 'city' | 'hubId'>, dest: Pick<Pincode, 'city' | 'hubId'>): LegType[] {
  if (origin.city === dest.city) return ['firstMile', 'lastMile']
  if (origin.hubId && origin.hubId === dest.hubId) return ['firstMile', 'originHub', 'lastMile']
  return ['firstMile', 'originHub', 'lineHaul', 'destHub', 'lastMile']
}

/** Transit days: the lane's promise for long-haul; next day within a city or region (assumed). */
export function transitDays(pattern: LegType[], service: Service, lane?: Lane): number {
  if (pattern.includes('lineHaul')) {
    if (!lane) throw new Error('Long-haul shipment needs a lane')
    return lane.transitDays[service]
  }
  return 1
}

/**
 * Earliest pickup date for a booking: same day before the cut-off, otherwise
 * the next working day (Sunday is not a working day — assumed).
 */
export function earliestPickupDate(bookedAt: IsoDateTime, cutoff: string): IsoDate {
  const p = istParts(bookedAt)
  const [ch, cm] = cutoff.split(':').map(Number)
  let date = istDate(bookedAt)
  if (p.hour * 60 + p.minute >= ch * 60 + cm) date = addDaysToDate(date, 1)
  if (istParts(ist(date, '12:00')).weekday === 0) date = addDaysToDate(date, 1)
  return date
}

/** ETA = pickup date + transit days (calendar days). Booked Mon, 3-day Express PTL → Thu. */
export const computeEta = (pickupDate: IsoDate, days: number): IsoDate => addDaysToDate(pickupDate, days)

export interface Slot {
  date: IsoDate
  from: string
  to: string
}

export interface Window {
  from: IsoDateTime
  to: IsoDateTime
}

/** Default delivery window when there is no appointment (assumed). */
export const DEFAULT_DELIVERY = { from: '10:00', to: '18:00' }

/** Time windows for each leg, in pattern order. Each leg's SLA is its window end. */
export function legWindows(pattern: LegType[], opts: { pickupSlot: Slot; eta: IsoDate; lane?: Lane; deliverySlot?: Slot }): Window[] {
  const pickup: Window = { from: ist(opts.pickupSlot.date, opts.pickupSlot.from), to: ist(opts.pickupSlot.date, opts.pickupSlot.to) }
  const delivery = opts.deliverySlot ?? { date: opts.eta, ...DEFAULT_DELIVERY }
  const lastMile: Window = { from: ist(delivery.date, delivery.from), to: ist(delivery.date, delivery.to) }

  if (pattern.length === 2) return [pickup, lastMile]

  if (pattern.length === 3) {
    return [pickup, { from: pickup.to, to: ist(opts.eta, '09:00') }, lastMile]
  }

  if (!opts.lane) throw new Error('Long-haul shipment needs a lane')
  // Line-haul departs on the lane's daily schedule; if pickup ends after departure, take the next day's truck.
  let departure = ist(opts.pickupSlot.date, opts.lane.departureTime)
  if (!isBefore(pickup.to, departure)) departure = addDays(departure, 1)
  const arrival = ist(opts.eta, '06:00')
  const destHubOut = ist(opts.eta, '10:00')

  return [
    pickup,
    { from: pickup.to, to: departure },
    { from: departure, to: arrival },
    // Destination hub hands over by 10:00, or earlier if the delivery window starts earlier
    { from: arrival, to: isBefore(lastMile.from, destHubOut) ? lastMile.from : destHubOut },
    lastMile,
  ]
}

// ─── Pickup slots (CP-13 Step 1) ──────────────────────────────────────────────

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
const toHhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** Sunday is not a working day (assumed; every seeded location works Mon–Sat). */
export const isWorkingDay = (date: IsoDate) => istParts(ist(date, '12:00')).weekday !== 0

/**
 * 2-hour pickup slots inside a location's pickup window, e.g. 10:00–17:00 →
 * 10–12, 12–14, 14–16. Today only before the cut-off, and only slots that haven't started.
 */
export function pickupSlots(window: { from: string; to: string }, date: IsoDate, now: IsoDateTime, cutoff: string): Slot[] {
  if (!isWorkingDay(date)) return []
  const today = istDate(now)
  if (date < today) return []
  const p = istParts(now)
  const nowMin = p.hour * 60 + p.minute
  if (date === today && nowMin >= toMin(cutoff)) return []
  const slots: Slot[] = []
  for (let start = toMin(window.from); start + 120 <= toMin(window.to); start += 120) {
    if (date === today && start <= nowMin) continue
    slots.push({ date, from: toHhmm(start), to: toHhmm(start + 120) })
  }
  return slots
}

/** The next `count` dates a pickup can be booked for, starting from the earliest allowed. */
export function pickupDates(now: IsoDateTime, cutoff: string, count = 7): IsoDate[] {
  const dates: IsoDate[] = []
  for (let d = earliestPickupDate(now, cutoff); dates.length < count; d = addDaysToDate(d, 1)) {
    if (isWorkingDay(d)) dates.push(d)
  }
  return dates
}
