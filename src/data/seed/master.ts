/**
 * Master data: pincodes, hubs, lanes, rate cards, partner rates, settings.
 * Named values come from docs/seed-data.md (§2, §3, §5, §8, §9) and the
 * Customer Portal spec CP-08. Values marked INVENTED fill out the network so
 * the demo has ~10 cities and 8 lanes; they never contradict seed-data.md.
 */
import type {
  CustomerRateCard,
  Hub,
  Lane,
  ParcelRate,
  ParcelTier,
  ParcelZone,
  PartnerRateLine,
  Pincode,
  PtlRateLine,
  Settings,
  Surcharges,
} from '@shared/types'

// ─── Pincodes (~10 cities). Region + serving hub drive lanes; zone is computed per pair. ───

type P = Omit<Pincode, 'id' | 'serviceable' | 'special' | 'oda'> & Partial<Pick<Pincode, 'serviceable' | 'special' | 'oda'>>
const pin = (p: P): Pincode => ({ serviceable: true, special: false, oda: false, ...p, id: p.code })

export const pincodes: Pincode[] = [
  // Delhi NCR — served by NCR CrossDock, Gurugram
  pin({ code: '110020', area: 'Okhla Industrial Area Phase II', city: 'New Delhi', state: 'Delhi', region: 'Delhi NCR', hubId: 'HUB-GGN', metro: true, lat: 28.5355, lng: 77.2732 }),
  pin({ code: '110001', area: 'Connaught Place', city: 'New Delhi', state: 'Delhi', region: 'Delhi NCR', hubId: 'HUB-GGN', metro: true, lat: 28.6315, lng: 77.2167 }),
  pin({ code: '110037', area: 'Mahipalpur', city: 'New Delhi', state: 'Delhi', region: 'Delhi NCR', hubId: 'HUB-GGN', metro: true, lat: 28.545, lng: 77.13 }),
  pin({ code: '122001', area: 'Daulatabad Road', city: 'Gurugram', state: 'Haryana', region: 'Delhi NCR', hubId: 'HUB-GGN', metro: true, lat: 28.4595, lng: 77.0266 }),
  pin({ code: '122050', area: 'IMT Manesar', city: 'Gurugram', state: 'Haryana', region: 'Delhi NCR', hubId: 'HUB-GGN', metro: false, lat: 28.359, lng: 76.935 }),
  pin({ code: '201301', area: 'Sector 63', city: 'Noida', state: 'Uttar Pradesh', region: 'Delhi NCR', hubId: 'HUB-GGN', metro: true, lat: 28.585, lng: 77.315 }),
  // North Karnataka — served by Hubli Warehousing
  pin({ code: '580030', area: 'Amargol', city: 'Hubballi', state: 'Karnataka', region: 'Karnataka', hubId: 'HUB-HBL', metro: false, lat: 15.388, lng: 75.095 }),
  pin({ code: '580025', area: 'Tarihal Industrial Area', city: 'Hubballi', state: 'Karnataka', region: 'Karnataka', hubId: 'HUB-HBL', metro: false, lat: 15.34, lng: 75.07 }),
  pin({ code: '580020', area: 'Keshwapur', city: 'Hubballi', state: 'Karnataka', region: 'Karnataka', hubId: 'HUB-HBL', metro: false, lat: 15.35, lng: 75.14 }),
  pin({ code: '590001', area: 'Camp', city: 'Belagavi', state: 'Karnataka', region: 'Karnataka', hubId: 'HUB-HBL', metro: false, lat: 15.8497, lng: 74.4977 }),
  pin({ code: '581110', area: 'Haveri Town', city: 'Haveri', state: 'Karnataka', region: 'Karnataka', hubId: 'HUB-HBL', metro: false, oda: true, lat: 14.795, lng: 75.4 }),
  pin({ code: '591201', area: 'Chikodi', city: 'Chikodi', state: 'Karnataka', region: 'Karnataka', hubId: 'HUB-HBL', metro: false, oda: true, lat: 16.43, lng: 74.6 }),
  // South Karnataka — served by Peenya Hub Services, Bengaluru
  pin({ code: '560058', area: 'Peenya Industrial Area', city: 'Bengaluru', state: 'Karnataka', region: 'Karnataka', hubId: 'HUB-BLR', metro: true, lat: 13.028, lng: 77.519 }),
  pin({ code: '560001', area: 'MG Road', city: 'Bengaluru', state: 'Karnataka', region: 'Karnataka', hubId: 'HUB-BLR', metro: true, lat: 12.975, lng: 77.606 }),
  pin({ code: '570001', area: 'Devaraja Mohalla', city: 'Mysuru', state: 'Karnataka', region: 'Karnataka', hubId: 'HUB-BLR', metro: false, lat: 12.308, lng: 76.654 }),
  // Maharashtra — served by Bhiwandi Logistics Park
  pin({ code: '421302', area: 'Mankoli Naka', city: 'Bhiwandi', state: 'Maharashtra', region: 'Maharashtra', hubId: 'HUB-BOM', metro: false, lat: 19.296, lng: 73.063 }),
  pin({ code: '400093', area: 'Andheri East (MIDC)', city: 'Mumbai', state: 'Maharashtra', region: 'Maharashtra', hubId: 'HUB-BOM', metro: true, lat: 19.117, lng: 72.866 }),
  pin({ code: '400001', area: 'Fort', city: 'Mumbai', state: 'Maharashtra', region: 'Maharashtra', hubId: 'HUB-BOM', metro: true, lat: 18.933, lng: 72.835 }),
  pin({ code: '411001', area: 'Camp', city: 'Pune', state: 'Maharashtra', region: 'Maharashtra', hubId: 'HUB-BOM', metro: true, lat: 18.516, lng: 73.878 }),
  pin({ code: '413512', area: 'Latur MIDC', city: 'Latur', state: 'Maharashtra', region: 'Maharashtra', hubId: 'HUB-BOM', metro: false, oda: true, lat: 18.4, lng: 76.56 }),
  // Not yet serviceable — shows the "pincode not serviceable" check
  pin({ code: '600032', area: 'Guindy', city: 'Chennai', state: 'Tamil Nadu', region: 'Tamil Nadu', metro: true, serviceable: false, lat: 13.01, lng: 80.22 }),
  pin({ code: '781001', area: 'Pan Bazaar', city: 'Guwahati', state: 'Assam', region: 'North-East', metro: false, special: true, serviceable: false, lat: 26.184, lng: 91.746 }),
]

// ─── Hubs (Type F partners; Peenya and Bhiwandi are INVENTED) ───

export const hubs: Hub[] = [
  { id: 'HUB-GGN', partnerId: 'P-NCRXD', name: 'NCR CrossDock, Gurugram', address: 'Khasra 210, Daulatabad Road, Gurugram, Haryana', pincode: '122001', docks: 12, hours: '24×7', auditStatus: 'passed' },
  { id: 'HUB-HBL', partnerId: 'P-HUBLIWH', name: 'Hubli Warehousing, Hubballi', address: 'Plot 7, Tarihal Industrial Area, Hubballi, Karnataka', pincode: '580025', docks: 6, hours: '06:00–23:00', auditStatus: 'passed' },
  { id: 'HUB-BLR', partnerId: 'P-PEENYA', name: 'Peenya Hub Services, Bengaluru', address: 'Plot 14, 3rd Phase, Peenya Industrial Area, Bengaluru, Karnataka', pincode: '560058', docks: 10, hours: '24×7', auditStatus: 'passed' },
  { id: 'HUB-BOM', partnerId: 'P-BHIWANDI', name: 'Bhiwandi Logistics Park, Mumbai', address: 'Gala 22, Mankoli Naka, Bhiwandi, Maharashtra', pincode: '421302', docks: 14, hours: '24×7', auditStatus: 'passed' },
]

// ─── Lanes (8). Delhi → Hubballi is from seed-data.md §3 / ERP-19; the rest are INVENTED. ───

type T = Lane['transitDays']
const days = (economy: number, standard: number, express: number, expressPtl: number, standardPtl: number): T => ({
  economy,
  standard,
  express,
  expressPtl,
  standardPtl,
})

export const lanes: Lane[] = [
  { id: 'LN-DEL-HBL', originRegion: 'Delhi NCR', destRegion: 'Hubballi', originHubId: 'HUB-GGN', destHubId: 'HUB-HBL', distanceKm: 1880, transitDays: days(7, 5, 3, 3, 5), departureTime: '23:00', lineHaulPartnerIds: ['P-DECCAN'] },
  { id: 'LN-HBL-DEL', originRegion: 'Hubballi', destRegion: 'Delhi NCR', originHubId: 'HUB-HBL', destHubId: 'HUB-GGN', distanceKm: 1880, transitDays: days(7, 5, 3, 3, 5), departureTime: '22:00', lineHaulPartnerIds: ['P-DECCAN'] },
  { id: 'LN-DEL-BLR', originRegion: 'Delhi NCR', destRegion: 'Bengaluru', originHubId: 'HUB-GGN', destHubId: 'HUB-BLR', distanceKm: 2150, transitDays: days(8, 6, 3, 4, 6), departureTime: '21:00', lineHaulPartnerIds: ['P-SURYA'] },
  { id: 'LN-BLR-DEL', originRegion: 'Bengaluru', destRegion: 'Delhi NCR', originHubId: 'HUB-BLR', destHubId: 'HUB-GGN', distanceKm: 2150, transitDays: days(8, 6, 3, 4, 6), departureTime: '21:00', lineHaulPartnerIds: ['P-SURYA'] },
  { id: 'LN-DEL-BOM', originRegion: 'Delhi NCR', destRegion: 'Mumbai', originHubId: 'HUB-GGN', destHubId: 'HUB-BOM', distanceKm: 1420, transitDays: days(5, 4, 2, 2, 4), departureTime: '22:00', lineHaulPartnerIds: ['P-WESTLINE'] },
  { id: 'LN-BOM-DEL', originRegion: 'Mumbai', destRegion: 'Delhi NCR', originHubId: 'HUB-BOM', destHubId: 'HUB-GGN', distanceKm: 1420, transitDays: days(5, 4, 2, 2, 4), departureTime: '22:00', lineHaulPartnerIds: ['P-WESTLINE'] },
  { id: 'LN-BOM-BLR', originRegion: 'Mumbai', destRegion: 'Bengaluru', originHubId: 'HUB-BOM', destHubId: 'HUB-BLR', distanceKm: 985, transitDays: days(5, 4, 2, 2, 3), departureTime: '20:00', lineHaulPartnerIds: ['P-WESTLINE', 'P-SURYA'] },
  // Kaveri's Mysuru → Pune parcel runs here: Standard 4–5 days (CP-08 sample)
  { id: 'LN-BLR-BOM', originRegion: 'Bengaluru', destRegion: 'Mumbai', originHubId: 'HUB-BLR', destHubId: 'HUB-BOM', distanceKm: 985, transitDays: days(5, 4, 2, 2, 3), departureTime: '20:00', lineHaulPartnerIds: ['P-WESTLINE', 'P-SURYA'] },
]

// ─── Customer rate cards ───

/** seed-data.md §8 / CP-08 Tab 3 */
export const surcharges: Surcharges = {
  fuelPct: 10,
  odaPerKg: 3,
  odaMin: 250,
  docketPtl: 100,
  docketParcel: 30,
  appointment: 300,
  codPct: 1.5,
  codMin: 50,
  toPayFee: 150,
  fovPct: 0.1,
  specialHandlingPerPiece: 100,
  liabilityPerKg: 100,
  liabilityMax: 10000,
}

const r = (first: number, additional: number): ParcelRate => ({ first, additional })
const tiers = (e: ParcelRate, s: ParcelRate, x: ParcelRate): Record<ParcelTier, ParcelRate> => ({
  economy: e,
  standard: s,
  express: x,
})

/** Standard parcel grid. Zone D Standard ₹55 / ₹25 is from seed-data.md §5; the rest is INVENTED. */
const standardParcel: Record<ParcelZone, Record<ParcelTier, ParcelRate>> = {
  A: tiers(r(30, 12), r(35, 15), r(45, 20)),
  B: tiers(r(38, 16), r(42, 18), r(55, 25)),
  C: tiers(r(45, 20), r(50, 22), r(65, 30)),
  D: tiers(r(48, 22), r(55, 25), r(75, 35)),
  E: tiers(r(65, 30), r(75, 35), r(95, 45)),
}

const ptl = (laneId: string, expressPerKg: number, standardPerKg: number): PtlRateLine[] => [
  { laneId, service: 'expressPtl', perKg: expressPerKg, minKg: 50, cftFactor: 8 },
  { laneId, service: 'standardPtl', perKg: standardPerKg, minKg: 100, cftFactor: 8 },
]

export const rateCards: CustomerRateCard[] = [
  {
    id: 'RC-STANDARD',
    name: 'Logisco Standard 2026',
    type: 'standard',
    parcel: standardParcel,
    // INVENTED: standard PTL rates ~15% above the Sharma contract
    ptl: [
      ...ptl('LN-DEL-HBL', 16, 12),
      ...ptl('LN-HBL-DEL', 16, 12),
      ...ptl('LN-DEL-BLR', 17.25, 12.75),
      ...ptl('LN-BLR-DEL', 17.25, 12.75),
      ...ptl('LN-DEL-BOM', 14.5, 10.5),
      ...ptl('LN-BOM-DEL', 14.5, 10.5),
      ...ptl('LN-BOM-BLR', 12.75, 9.25),
      ...ptl('LN-BLR-BOM', 12.75, 9.25),
    ],
    surcharges,
    validFrom: '2026-04-01',
    validTo: '2027-03-31',
    status: 'live',
  },
  {
    id: 'RC-SHARMA-2026',
    name: 'Sharma Electricals 2026',
    customerId: 'C-SHARMA',
    type: 'contract',
    parcel: standardParcel,
    // Delhi NCR → Karnataka Express PTL ₹14.00/kg, min 50 kg, CFT 8 (seed-data.md §5); other lines INVENTED
    ptl: [
      ...ptl('LN-DEL-HBL', 14, 10.5),
      ...ptl('LN-HBL-DEL', 14, 10.5),
      ...ptl('LN-DEL-BLR', 15, 11),
      ...ptl('LN-BLR-DEL', 15, 11),
      ...ptl('LN-DEL-BOM', 12.5, 9),
      ...ptl('LN-BOM-DEL', 12.5, 9),
      ...ptl('LN-BOM-BLR', 11, 8),
      ...ptl('LN-BLR-BOM', 11, 8),
    ],
    surcharges,
    validFrom: '2026-04-01',
    validTo: '2027-03-31',
    status: 'live',
  },
]

// ─── Partner rate lines. Hero-shipment rates are from seed-data.md §3; the rest are INVENTED. ───

let n = 0
const line = (l: Omit<PartnerRateLine, 'id'>): PartnerRateLine => ({ id: `PRL-${String(++n).padStart(3, '0')}`, ...l })
/** First- and last-mile lines for a partner's cluster (the hub the pincodes feed). */
const mile = (partnerId: string, cluster: string, legType: 'firstMile' | 'lastMile', ptlRate: number, parcelRate: number, note?: string) => [
  line({ partnerId, legType, laneOrCluster: cluster, serviceKind: 'ptl', rate: ptlRate, unit: 'perShipment', maxKg: 200, note }),
  line({ partnerId, legType, laneOrCluster: cluster, serviceKind: 'parcel', rate: parcelRate, unit: 'perShipment' }),
]
const hub = (partnerId: string, hubId: string, perKg: number) =>
  (['originHub', 'destHub'] as const).map((legType) =>
    line({ partnerId, legType, laneOrCluster: hubId, rate: perKg, unit: 'perKg', minimum: 150 }),
  )
const lineHaul = (partnerId: string, laneId: string, perKg: number) =>
  line({ partnerId, legType: 'lineHaul', laneOrCluster: laneId, rate: perKg, unit: 'perKg', minKg: 50 })

export const partnerRates: PartnerRateLine[] = [
  // Delhi NCR first / last mile
  ...mile('P-SWIFTCITY', 'HUB-GGN', 'firstMile', 250, 35, 'PTL pickup up to 200 kg'),
  ...mile('P-SWIFTCITY', 'HUB-GGN', 'lastMile', 280, 40),
  ...mile('P-METRODASH', 'HUB-GGN', 'firstMile', 270, 38),
  ...mile('P-METRODASH', 'HUB-GGN', 'lastMile', 290, 42),
  ...mile('P-QUICKLINK', 'HUB-GGN', 'firstMile', 220, 30, 'PTL pickup up to 200 kg'),
  ...mile('P-QUICKLINK', 'HUB-GGN', 'lastMile', 240, 32),
  // Hubballi cluster
  ...mile('P-NKEXP', 'HUB-HBL', 'lastMile', 300, 35, 'PTL delivery with appointment'),
  ...mile('P-NKEXP', 'HUB-HBL', 'firstMile', 260, 35),
  // Bengaluru / Mysuru cluster
  ...mile('P-FASTTRACK', 'HUB-BLR', 'firstMile', 240, 32),
  ...mile('P-FASTTRACK', 'HUB-BLR', 'lastMile', 260, 34),
  // Mumbai / Pune cluster
  ...mile('P-DOORSTEP', 'HUB-BOM', 'firstMile', 250, 30),
  ...mile('P-DOORSTEP', 'HUB-BOM', 'lastMile', 260, 30),
  // Hubs: ₹1.00 / kg, min ₹150
  ...hub('P-NCRXD', 'HUB-GGN', 1),
  ...hub('P-HUBLIWH', 'HUB-HBL', 1),
  ...hub('P-PEENYA', 'HUB-BLR', 1),
  ...hub('P-BHIWANDI', 'HUB-BOM', 1.1),
  // Line-haul: Deccan ₹9.00 / kg, min 50 kg on Delhi → Hubballi
  lineHaul('P-DECCAN', 'LN-DEL-HBL', 9),
  lineHaul('P-DECCAN', 'LN-HBL-DEL', 8.5),
  lineHaul('P-SURYA', 'LN-DEL-BLR', 9.5),
  lineHaul('P-SURYA', 'LN-BLR-DEL', 9),
  lineHaul('P-SURYA', 'LN-BOM-BLR', 6.5),
  lineHaul('P-SURYA', 'LN-BLR-BOM', 6.5),
  lineHaul('P-WESTLINE', 'LN-DEL-BOM', 7.5),
  lineHaul('P-WESTLINE', 'LN-BOM-DEL', 7),
  lineHaul('P-WESTLINE', 'LN-BOM-BLR', 6),
  lineHaul('P-WESTLINE', 'LN-BLR-BOM', 6),
]

// ─── Settings (ERP-44) — seed-data.md §9 ───

export const settings: Settings = {
  ewayBillThreshold: 50000,
  ewayBillKmPerDay: 200,
  targetMarginPct: 15,
  riskBufferPct: 2,
  quoteValidityDays: 7,
  pickupCutoff: '14:00',
  partnerAcceptanceMinutes: 30,
  arrivalGeofenceM: 200,
  weightTolerancePct: 3,
  weightToleranceKg: 0.5,
  ndrMaxAttempts: 3,
  codDepositHours: 24,
  codRemittanceDays: 2,
  codRemittanceDaysTopTier: 1,
  partnerDisputeSlaHours: 48,
  claimSettlementDays: 7,
  claimWindowDays: 7,
  earlyPayFeePct: 1,
  creditGraceDays: 15,
  trialPassMark: 80,
  bronzeVolumeCapPct: 50,
  gstPct: 18,
  volumetricDivisor: 5000,
  ptlMinKgExpress: 50,
  ptlMinKgStandard: 100,
  cftFactor: 8,
  tierBands: { platinum: 90, gold: 80, silver: 70, bronze: 60 },
}
