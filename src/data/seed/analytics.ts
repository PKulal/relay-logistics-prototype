/**
 * CP-27 analytics history (spec prototype note: "pre-computed numbers in seed
 * data"). INVENTED, deterministic. The Delhi → Hubballi row follows the CP-27
 * samples (3.2 vs 3.5 days, ₹19.0 / kg); damage 0.8 per 1,000 and CO2 11.4 kg
 * per shipment are the samples for the quarter.
 */
import { addDaysToDate } from '@shared/lib/time'
import type { CustomerAnalytics, DemoData, InsurerClaim } from '@shared/types'

/** Monday of the demo week is 23-Nov-2026; 13 weeks back is the quarter. */
const weeks = (base: number, onTime: number[]) =>
  onTime.map((pct, i) => ({ week: addDaysToDate('2026-08-31', i * 7), shipments: base + ((i * 7) % 11) - 4, onTimePct: pct, damagePer1000: [0.6, 0.9, 0.7, 1.1, 0.8, 0.5, 0.9, 0.8, 0.7, 1.0, 0.8, 0.6, 0.9][i], co2PerShipment: [11.9, 11.6, 11.8, 11.4, 11.5, 11.2, 11.6, 11.3, 11.1, 11.4, 11.2, 11.0, 11.4][i] }))

const SHARMA: CustomerAnalytics = {
  weeks: weeks(98, [88, 90, 89, 91, 92, 90, 93, 91, 94, 92, 93, 95, 93]),
  lanes: [
    { origin: 'Delhi NCR', dest: 'Hubballi', destState: 'Karnataka', service: 'expressPtl', shipments: 412, avgTransit: 3.2, promised: 3.5, onTimePct: 92, damagePct: 0.07, costPerKg: 19.0, co2: 11.4 },
    { origin: 'Delhi NCR', dest: 'Bengaluru', destState: 'Karnataka', service: 'expressPtl', shipments: 268, avgTransit: 3.1, promised: 3.0, onTimePct: 89, damagePct: 0.11, costPerKg: 17.6, co2: 10.8 },
    { origin: 'Delhi NCR', dest: 'Belagavi', destState: 'Karnataka', service: 'standardPtl', shipments: 136, avgTransit: 4.6, promised: 5.0, onTimePct: 94, damagePct: 0.0, costPerKg: 15.2, co2: 12.1 },
    { origin: 'Delhi NCR', dest: 'Mumbai', destState: 'Maharashtra', service: 'expressPtl', shipments: 184, avgTransit: 2.4, promised: 2.5, onTimePct: 95, damagePct: 0.05, costPerKg: 14.8, co2: 8.9 },
    { origin: 'Delhi NCR', dest: 'Pune', destState: 'Maharashtra', service: 'standardPtl', shipments: 97, avgTransit: 3.8, promised: 4.0, onTimePct: 93, damagePct: 0.1, costPerKg: 13.9, co2: 9.6 },
    { origin: 'Delhi NCR', dest: 'Mysuru', destState: 'Karnataka', service: 'parcel', shipments: 54, avgTransit: 4.1, promised: 4.0, onTimePct: 87, damagePct: 0.19, costPerKg: 31.5, co2: 4.2 },
    { origin: 'Delhi NCR', dest: 'Noida', destState: 'Uttar Pradesh', service: 'parcel', shipments: 61, avgTransit: 1.1, promised: 1.0, onTimePct: 96, damagePct: 0.0, costPerKg: 24.0, co2: 1.3 },
  ],
}

const KAVERI: CustomerAnalytics = {
  weeks: weeks(14, [91, 93, 90, 94, 95, 92, 96, 94, 93, 95, 97, 94, 96]),
  lanes: [
    { origin: 'Mysuru', dest: 'Pune', destState: 'Maharashtra', service: 'parcel', shipments: 86, avgTransit: 3.3, promised: 3.0, onTimePct: 91, damagePct: 0.2, costPerKg: 74.8, co2: 2.6 },
    { origin: 'Mysuru', dest: 'Bengaluru', destState: 'Karnataka', service: 'parcel', shipments: 112, avgTransit: 1.2, promised: 1.0, onTimePct: 95, damagePct: 0.0, costPerKg: 52.1, co2: 0.8 },
    { origin: 'Mysuru', dest: 'Mumbai', destState: 'Maharashtra', service: 'parcel', shipments: 41, avgTransit: 3.1, promised: 3.0, onTimePct: 93, damagePct: 0.0, costPerKg: 78.4, co2: 2.9 },
  ],
}

/** ERP-38: CLM-2026-0142's ₹20,000 insurer share was filed as INS-88213 when the claim settled (seed-data.md §4). */
const INS_88213: InsurerClaim = {
  id: 'INS-88213',
  claimIds: ['CLM-2026-0142'],
  insurer: 'Shield General Insurance', // INVENTED
  policyNo: 'GIT/2026/LGS/00417', // INVENTED
  amount: 20000,
  filedAt: '2026-11-19T16:00:00+05:30',
  filedBy: 'LS-FARHAN',
  status: 'filed',
  log: [{ at: '2026-11-19T16:00:00+05:30', by: 'LS-FARHAN', text: 'Filed through the insurance API' }],
}

export const addAnalyticsSeed = (data: DemoData): DemoData => ({ ...data, customerAnalytics: { ...data.customerAnalytics, 'C-SHARMA': SHARMA, 'C-KAVERI': KAVERI }, insurerClaims: { ...data.insurerClaims, 'INS-88213': INS_88213 } })
