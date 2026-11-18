/**
 * ~120 background shipments over the 8 lanes (and intra-region routes) in every
 * status, so lists, boards and dashboards look lived-in.
 *
 * Deterministic: a fixed-seed PRNG and fixed dates, so every reset is identical.
 * Every shipment is booked with bookShipment() and moved with simulated events.
 * Background LRs use serials below the key shipments (e.g. LGS-DEL-000600…) so the
 * next live Delhi booking still gets the hero's LGS-DEL-000781.
 */
import { LR_CODES } from '@data/seed/master'
import { quote, QuoteError } from '@shared/engines/quote'
import { earliestPickupDate } from '@shared/engines/schedule'
import { addDaysToDate, ist, istParts } from '@shared/lib/time'
import { runJourney, type Outcome } from '@shared/sim/journey'
import { bookShipment, type BookingInput } from '@shared/store/booking'
import type { DemoData, Id, IsoDateTime, Service, ServiceKind } from '@shared/types'

/** Small, fast, seedable PRNG (mulberry32). */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Profile {
  customerId: Id
  userIds: Id[]
  locationIds: Id[]
  /** Share of PTL bookings (rest parcel) */
  ptlShare: number
  count: number
  /** Bookings made this morning, before the demo opens (still waiting for pickup) */
  today: number
  /**
   * Booked Saturday after the cut-off with an early Monday pickup, so at 10:00
   * they are Picked Up (08:30 slot) or At Origin Hub (07:00 slot).
   */
  early: ('07:00' | '08:30')[]
  /** Share of parcel bookings paid by COD */
  codShare: number
  goods: { description: string; hsn: string }
}

/** 120 shipments. Sharma ends up with ~40 and Kaveri with ~8 including the key shipments (CP spec §11.2). */
const PROFILES: Profile[] = [
  { customerId: 'C-SHARMA', early: [], userIds: ['CU-PRIYA', 'CU-RAMESH', 'CU-RAMESH'], locationIds: ['PL-OKHLA', 'PL-OKHLA', 'PL-OKHLA', 'PL-MANESAR'], ptlShare: 0.85, count: 36, today: 4, codShare: 0, goods: { description: 'Electrical switchgear', hsn: '8537' } },
  { customerId: 'C-KAVERI', early: [], userIds: ['CU-SURESH'], locationIds: ['PL-KAVERI'], ptlShare: 0, count: 7, today: 0, codShare: 0, goods: { description: 'Wooden handicrafts', hsn: '4420' } },
  { customerId: 'C-ANKUR', early: ['07:00'], userIds: ['CU-ANKUR'], locationIds: ['PL-ANKUR'], ptlShare: 0.5, count: 13, today: 1, codShare: 0, goods: { description: 'Pharmaceutical products', hsn: '3004' } },
  { customerId: 'C-URBANLOOM', early: ['08:30'], userIds: ['CU-URBANLOOM'], locationIds: ['PL-URBANLOOM'], ptlShare: 0.2, count: 13, today: 1, codShare: 0, goods: { description: 'Readymade garments', hsn: '6205' } },
  { customerId: 'C-TRIVENI', early: [], userIds: ['CU-TRIVENI'], locationIds: ['PL-TRIVENI'], ptlShare: 0.9, count: 13, today: 2, codShare: 0, goods: { description: 'Auto components', hsn: '8708' } },
  { customerId: 'C-KRAFTKART', early: ['07:00', '08:30'], userIds: ['CU-KRAFTKART'], locationIds: ['PL-KRAFTKART'], ptlShare: 0, count: 13, today: 1, codShare: 0.35, goods: { description: 'Home décor items', hsn: '9403' } },
  { customerId: 'C-GREENLEAF', early: ['08:30'], userIds: ['CU-GREENLEAF'], locationIds: ['PL-GREENLEAF'], ptlShare: 0, count: 12, today: 0, codShare: 0, goods: { description: 'Organic food products', hsn: '2106' } },
  { customerId: 'C-DECCANSTEEL', early: ['07:00'], userIds: ['CU-DECCANSTEEL'], locationIds: ['PL-DECCANSTEEL'], ptlShare: 0.9, count: 13, today: 1, codShare: 0, goods: { description: 'Fabricated steel structures', hsn: '7308' } },
]

/**
 * Background LR serials: one counter across all city codes (job ids carry only the
 * serial, so serials must be unique). 000601–000720 sits below the key shipments
 * (000769–000790) and the hero's 000781, and clear of 000112.
 */
const FIRST_SERIAL = 601

/** SwiftCity riders; Ravi carries this morning's pickups (7 pending with LGS-DEL-000790). */
const SWIFTCITY_RIDERS = ['FS-RAVI', 'FS-SWC-AJAY', 'FS-SWC-DEEPAK']

interface Plan {
  input: BookingInput
  at: IsoDateTime
  outcome: Outcome
  assignees?: Record<number, Id>
}

export function generateShipments(seed: DemoData, until: IsoDateTime): DemoData {
  const rand = mulberry32(781)
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1))
  const today = until.slice(0, 10)

  const plans: Plan[] = []
  for (const profile of PROFILES) {
    const consignees = Object.values(seed.consignees).filter((c) => c.customerId === profile.customerId)
    const skus = Object.values(seed.skus).filter((s) => s.customerId === profile.customerId && s.status === 'frozen')

    for (let i = 0; i < profile.count; i++) {
      const isToday = i < profile.today
      const early = !isToday ? profile.early[i - profile.today] : undefined
      const at = isToday ? bookingTimeToday(today, rand) : early ? ist(addDaysToDate(today, -2), '16:30') : bookingTimeEarlier(today, rand)

      // Find a route + service this customer can actually book (retry other consignees).
      let built: Omit<Plan, 'at' | 'outcome'> | undefined
      for (let attempt = 0; attempt < 8 && !built; attempt++) {
        const consignee = pick(consignees)
        const locationId = pick(profile.locationIds)
        let kind: ServiceKind = rand() < profile.ptlShare ? 'ptl' : 'parcel'
        for (const k of kind === 'ptl' ? (['ptl', 'parcel'] as const) : (['parcel'] as const)) {
          kind = k
          const service: Service = kind === 'ptl' ? (rand() < 0.55 ? 'expressPtl' : 'standardPtl') : pick(['economy', 'standard', 'standard', 'express'] as Service[])
          const pieces =
            kind === 'ptl'
              ? Array.from({ length: between(2, 8) }, () => {
                  const s = skus.length ? pick(skus) : undefined
                  return s ? { l: s.l, b: s.b, h: s.h, weight: s.weight, skuCode: s.code } : { l: 50, b: 40, h: 35, weight: between(12, 25) }
                })
              : Array.from({ length: between(1, 3) }, () => ({ l: between(20, 45), b: between(15, 35), h: between(10, 30), weight: between(1, 8) }))
          const value =
            kind === 'ptl'
              ? pieces.reduce((sum, p) => sum + (skus.find((s) => s.code === (p as { skuCode?: string }).skuCode)?.unitValue ?? between(8, 25) * 1000), 0)
              : pieces.length * between(8, 60) * 100
          const location = seed.pickupLocations[locationId]
          try {
            quote(seed, {
              customerId: profile.customerId,
              originPincode: location.pincode,
              destPincode: consignee.pincode,
              serviceKind: kind,
              service,
              pieces,
              declaredValue: value,
              addOns: { appointment: false, insurance: false, specialHandling: false },
              paymentMode: 'tbb',
            })
          } catch (e) {
            if (e instanceof QuoteError) continue
            throw e
          }
          const customer = seed.customers[profile.customerId]
          const cod = kind === 'parcel' && rand() < profile.codShare
          const appointment = kind === 'ptl' && consignee.appointmentRequired
          const pickupDate = earliestPickupDate(at, seed.settings.pickupCutoff)
          const pickupSlot = early
            ? { date: pickupDate, from: early, to: early === '07:00' ? '08:00' : '09:30' }
            : pickupDate !== at.slice(0, 10)
              ? { date: pickupDate, from: '10:00', to: '12:00' }
              : istParts(at).hour < 11
                ? { date: pickupDate, from: '12:00', to: '14:00' }
                : { date: pickupDate, from: '14:00', to: '16:00' }
          built = {
            input: {
              customerId: profile.customerId,
              bookedByUserId: pick(profile.userIds),
              pickupLocationId: locationId,
              consigneeId: consignee.id,
              serviceKind: kind,
              service,
              paymentMode: customer.billing === 'prepaid' ? 'paid' : cod ? 'cod' : 'tbb',
              codAmount: cod ? value : undefined,
              addOns: { appointment, insurance: value > 100000 && rand() < 0.4, specialHandling: false },
              invoice: { no: `${customer.shortName.split(' ')[0].toUpperCase().slice(0, 4)}/25-26/${between(1000, 9999)}`, date: at.slice(0, 10), value },
              hsn: profile.goods.hsn,
              goodsDescription: profile.goods.description,
              pieces,
              pickupSlot,
              appointment: appointment ? { from: '11:00', to: '13:00', dock: 'Dock 1' } : undefined,
              applyMoney: false, // seeded balances are snapshots
            },
          }
          break
        }
      }
      if (!built) throw new Error(`Seed: no bookable route for ${profile.customerId}`)

      plans.push({ ...built, at, outcome: isToday || early ? 'normal' : pickOutcome(rand), assignees: isToday ? { 1: 'FS-RAVI' } : undefined })
    }
  }

  // Book in time order so LR serials rise with booking time.
  plans.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
  ensureEveryOutcome(plans, until)
  let serial = FIRST_SERIAL
  let data = seed
  for (const plan of plans) {
    const code = LR_CODES[seed.pincodes[seed.pickupLocations[plan.input.pickupLocationId].pincode].city]
    const lr = `LGS-${code}-${String(serial++).padStart(6, '0')}`
    const result = bookShipment(data, { ...plan.input, lr }, plan.at)
    data = result.data

    // Only this morning's NCR pickups go to Ravi; other SwiftCity pickups are spread across its riders.
    const firstLeg = data.legs[data.shipments[lr].legIds[0]]
    const assignees = firstLeg.partnerId === 'P-SWIFTCITY' ? (plan.assignees ?? { 1: pick(SWIFTCITY_RIDERS) }) : undefined
    data = runJourney(data, lr, { until, outcome: plan.outcome, assignees, closeAfterDays: 5 })
  }
  return data
}

/**
 * Random outcomes can miss a rare case. Make sure each exception outcome occurs at
 * least once, on a shipment booked 8+ days ago so its journey has reached that point.
 */
function ensureEveryOutcome(plans: Plan[], until: IsoDateTime) {
  const cutoff = Date.parse(until) - 8 * 86_400_000
  const old = plans.filter((p) => Date.parse(p.at) < cutoff)
  for (const outcome of ['cancel', 'pickupFailed', 'ndr', 'rto', 'short'] as Outcome[]) {
    if (old.some((p) => p.outcome === outcome)) continue // a recent one may not have got that far yet
    const target = old.find((p) => p.outcome === 'normal')
    if (target) target.outcome = outcome
  }
}

function pickOutcome(rand: () => number): Outcome {
  const r = rand()
  if (r < 0.03) return 'cancel'
  if (r < 0.06) return 'pickupFailed'
  if (r < 0.12) return 'ndr'
  if (r < 0.14) return 'rto'
  if (r < 0.17) return 'short'
  return 'normal'
}

/** This morning, 08:00–09:29, so the rider is assigned (booking + 25 min) before the demo opens at 10:00. */
function bookingTimeToday(today: string, rand: () => number): IsoDateTime {
  const minutes = 8 * 60 + Math.floor(rand() * 90)
  return ist(today, `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`)
}

/** 1–20 days ago (skewed to recent), 09:00–13:45, never on a Sunday. */
function bookingTimeEarlier(today: string, rand: () => number): IsoDateTime {
  const daysAgo = rand() < 0.45 ? 8 + Math.floor(rand() * 13) : 1 + Math.floor(rand() * 7)
  let date = addDaysToDate(today, -daysAgo)
  if (istParts(ist(date, '12:00')).weekday === 0) date = addDaysToDate(date, -1)
  const minutes = 9 * 60 + Math.floor(rand() * 285)
  return ist(date, `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`)
}
