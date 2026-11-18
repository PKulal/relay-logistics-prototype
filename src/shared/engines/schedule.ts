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
