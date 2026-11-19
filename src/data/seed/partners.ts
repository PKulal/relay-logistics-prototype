/**
 * The eight partners named in docs/seed-data.md §6 and their people.
 * Extra partners that fill out the network live in partners-extra.ts.
 * GSTINs, mobiles and emails not given in seed-data.md are INVENTED
 * (none ends in "Z9", which is reserved for failing GST verification).
 */
import type { FieldStaff, Partner, PartnerApplication, PartnerInvoice, PartnerUser, Payout, Vehicle, WeeklyScore } from '@shared/types'

const NCR = ['110020', '110001', '110037', '122001', '122050', '201301']
const HUBBALLI = ['580030', '580025', '580020', '590001', '581110', '591201']
const BENGALURU = ['560058', '560001', '570001']

export const namedPartners: Partner[] = [
  {
    id: 'P-SWIFTCITY',
    name: 'SwiftCity Couriers Pvt Ltd',
    shortName: 'SwiftCity Couriers',
    type: 'B',
    legs: ['firstMile', 'lastMile'],
    services: ['economy', 'standard', 'express', 'expressPtl', 'standardPtl'],
    gstin: '07AAGCS4521M1Z3',
    pan: 'AAGCS4521M',
    city: 'Delhi NCR',
    status: 'live',
    tier: 'gold',
    score: 86,
    capacityPerDay: 400,
    baseLoadToday: 180,
    coveragePincodes: NCR,
    laneIds: [],
    hubIds: [],
    coordinatorId: 'LS-MEERA',
    autoAccept: false,
  },
  {
    id: 'P-METRODASH',
    name: 'MetroDash Logistics Pvt Ltd',
    shortName: 'MetroDash',
    type: 'B',
    legs: ['firstMile', 'lastMile'],
    services: ['economy', 'standard', 'express', 'expressPtl', 'standardPtl'],
    gstin: '07AAKCM7710R1Z2',
    pan: 'AAKCM7710R',
    city: 'Delhi NCR',
    status: 'live',
    tier: 'platinum',
    score: 92,
    capacityPerDay: 300,
    baseLoadToday: 300, // at capacity → skipped for LGS-DEL-000781 (seed-data.md §6)
    coveragePincodes: NCR,
    laneIds: [],
    hubIds: [],
    coordinatorId: 'LS-MEERA',
    autoAccept: true,
  },
  {
    id: 'P-QUICKLINK',
    name: 'QuickLink Express',
    shortName: 'QuickLink Express',
    type: 'B',
    legs: ['firstMile', 'lastMile'],
    services: ['economy', 'standard', 'express', 'expressPtl', 'standardPtl'],
    gstin: '06AAFFQ3398D1Z6',
    pan: 'AAFFQ3398D',
    city: 'Delhi NCR',
    status: 'live',
    tier: 'silver',
    score: 74,
    capacityPerDay: 250,
    baseLoadToday: 90,
    coveragePincodes: NCR,
    laneIds: [],
    hubIds: [],
    coordinatorId: 'LS-MEERA',
    autoAccept: false,
  },
  {
    id: 'P-NCRXD',
    name: 'NCR CrossDock Pvt Ltd',
    shortName: 'NCR CrossDock',
    type: 'F',
    legs: ['originHub', 'destHub'],
    services: ['economy', 'standard', 'express', 'expressPtl', 'standardPtl'],
    gstin: '06AADCN8823K1Z1',
    pan: 'AADCN8823K',
    city: 'Gurugram',
    status: 'live',
    tier: 'silver',
    score: 76,
    capacityPerDay: 1500,
    baseLoadToday: 620,
    coveragePincodes: [],
    laneIds: [],
    hubIds: ['HUB-GGN'],
    coordinatorId: 'LS-MEERA',
    autoAccept: true,
  },
  {
    id: 'P-DECCAN',
    name: 'Deccan Roadlines',
    shortName: 'Deccan Roadlines',
    type: 'E',
    legs: ['lineHaul'],
    services: ['expressPtl', 'standardPtl', 'economy', 'standard', 'express'],
    gstin: '29AAFFD6104E1Z5',
    pan: 'AAFFD6104E',
    city: 'Hubballi',
    status: 'trial', // 2 of 3 trial trips done; goes live at Bronze after the third
    tier: null,
    score: 84,
    capacityPerDay: 60,
    baseLoadToday: 0,
    coveragePincodes: [],
    laneIds: ['LN-DEL-HBL', 'LN-HBL-DEL'],
    hubIds: [],
    coordinatorId: 'LS-MEERA',
    autoAccept: true,
    trial: { tripsDone: 2, tripsRequired: 3, score: 84 },
  },
  {
    id: 'P-HUBLIWH',
    name: 'Hubli Warehousing',
    shortName: 'Hubli Warehousing',
    type: 'F',
    legs: ['originHub', 'destHub'],
    services: ['economy', 'standard', 'express', 'expressPtl', 'standardPtl'],
    gstin: '29AAEFH2290J1Z4',
    pan: 'AAEFH2290J',
    city: 'Hubballi',
    status: 'live',
    tier: 'gold',
    score: 82,
    capacityPerDay: 600,
    baseLoadToday: 180,
    coveragePincodes: [],
    laneIds: [],
    hubIds: ['HUB-HBL'],
    coordinatorId: 'LS-MEERA',
    autoAccept: true,
  },
  {
    id: 'P-NKEXP',
    name: 'NK Express',
    shortName: 'NK Express',
    type: 'B',
    legs: ['firstMile', 'lastMile'],
    services: ['economy', 'standard', 'express', 'expressPtl', 'standardPtl'],
    gstin: '29AAIFN5512G1Z3',
    pan: 'AAIFN5512G',
    city: 'Hubballi',
    status: 'live',
    tier: 'silver',
    score: 78,
    capacityPerDay: 150,
    baseLoadToday: 40,
    coveragePincodes: HUBBALLI,
    laneIds: [],
    hubIds: [],
    coordinatorId: 'LS-MEERA',
    autoAccept: true,
  },
  {
    id: 'P-FASTTRACK',
    name: 'FastTrack Logistics',
    shortName: 'FastTrack Logistics',
    type: 'B',
    legs: ['firstMile', 'lastMile'],
    services: ['economy', 'standard', 'express', 'expressPtl', 'standardPtl'],
    gstin: '29AAGFF8876B1Z2',
    pan: 'AAGFF8876B',
    city: 'Bengaluru', // INVENTED location
    status: 'live',
    tier: 'bronze', // Bronze 61 → Probation 57 after the weekly scoring run
    score: 61,
    capacityPerDay: 200,
    baseLoadToday: 70,
    coveragePincodes: BENGALURU,
    laneIds: [],
    hubIds: [],
    coordinatorId: 'LS-MEERA',
    autoAccept: true,
  },
]

export const namedPartnerUsers: PartnerUser[] = [
  { id: 'PU-VIKRAM', partnerId: 'P-SWIFTCITY', name: 'Vikram Singh', mobile: '98111 22334', email: 'vikram@swiftcity.in', role: 'admin' },
  { id: 'PU-NEHA', partnerId: 'P-SWIFTCITY', name: 'Neha Verma', mobile: '98111 22335', email: 'neha@swiftcity.in', role: 'operations' },
  { id: 'PU-ANIL', partnerId: 'P-SWIFTCITY', name: 'Anil Gupta', mobile: '98111 22336', email: 'anil@swiftcity.in', role: 'finance' },
  { id: 'PU-ROHIT', partnerId: 'P-NCRXD', name: 'Rohit Malik', mobile: '98100 66721', email: 'rohit@ncrcrossdock.in', role: 'operations' },
]

export const namedFieldStaff: FieldStaff[] = [
  { id: 'FS-RAVI', partnerId: 'P-SWIFTCITY', name: 'Ravi Kumar', mobile: '98730 44556', role: 'rider', vehicleId: 'V-DL01LT4521', licenceValidTill: '2029-06-30', policeVerified: true, trained: true, language: 'hi' },
  { id: 'FS-POOJA', partnerId: 'P-NCRXD', name: 'Pooja S.', mobile: '98102 33871', role: 'hub', hubId: 'HUB-GGN', policeVerified: true, trained: true, language: 'hi' },
  { id: 'FS-BASAVARAJ', partnerId: 'P-DECCAN', name: 'Basavaraj H.', mobile: '94485 21907', role: 'driver', vehicleId: 'V-KA25AB1234', licenceValidTill: '2028-03-31', policeVerified: true, trained: true, language: 'kn' },
  { id: 'FS-MANJU', partnerId: 'P-NKEXP', name: 'Manju R.', mobile: '94486 40213', role: 'rider', vehicleId: 'V-KA63A4471', licenceValidTill: '2030-01-31', policeVerified: true, trained: true, language: 'kn' },
]

export const namedVehicles: Vehicle[] = [
  { id: 'V-DL01LT4521', partnerId: 'P-SWIFTCITY', regNo: 'DL01LT4521', type: 'Mini truck (Tata Ace)', payloadKg: 750, docExpiry: '2027-08-31' },
  { id: 'V-KA25AB1234', partnerId: 'P-DECCAN', regNo: 'KA25AB1234', type: '32 ft container truck', payloadKg: 9000, fastagId: 'FT-KA25AB1234', gpsId: 'GPS-DR-07', docExpiry: '2027-02-28' },
  { id: 'V-KA63A4471', partnerId: 'P-NKEXP', regNo: 'KA63A4471', type: 'Pickup van (Mahindra Jeeto)', payloadKg: 600, docExpiry: '2027-11-30' },
]

const AT = (d: string, t: string) => `${d}T${t}:00+05:30`
const gurugramPhoto = (t: string) => ({ lat: 28.4595, lng: 77.0266, at: AT('2026-03-05', t) })

/**
 * Partner applications (source §4 Phases 1–2). Deccan: in trial, with the flagged
 * insurance still an open condition (seed-data.md §6). NCR CrossDock: the
 * completed hub audit (PP-07 prototype note). Dates, numbers, documents and the
 * NCR application id are INVENTED.
 */
export const applications: PartnerApplication[] = [
  {
    id: 'APP-2026-0412',
    partnerId: 'P-DECCAN',
    ref: 'APP-2026-0412',
    receivedAt: AT('2026-10-12', '10:20'),
    source: 'sales',
    services: ['expressPtl', 'standardPtl', 'parcel'],
    constitution: 'partnership',
    contact: { name: 'Prakash Kulkarni', designation: 'Managing Partner', mobile: '94480 77302', email: 'prakash@deccanroadlines.in' },
    address: 'Survey 88, Gokul Road, Hubballi, Karnataka 580030',
    gstRegistered: true,
    states: ['Karnataka', 'Delhi'],
    cities: ['Hubballi', 'Belagavi', 'New Delhi'],
    pincodes: [],
    lanes: [
      { origin: 'New Delhi', dest: 'Hubballi', frequency: 'daily', transitHours: 52 },
      { origin: 'New Delhi', dest: 'Belagavi', frequency: 'alternate', transitHours: 56 },
    ],
    hubs: [],
    fleet: { truck19: 4, truck32: 6 },
    capacity: 60000,
    indicativeRates: [{ leg: 'lineHaul', rate: 9 }],
    fitScore: 88,
    fitReason: 'Runs Delhi NCR ↔ Hubballi weekly; fills a single-partner gap on the lane.',
    fitDetail: { kind: 'laneGap', place: 'New Delhi → Hubballi', partners: 1 },
    status: 'trial',
    decision: { by: 'LS-MEERA', at: AT('2026-10-12', '16:05') },
    documents: [
      { key: 'gstin', status: 'verified', file: 'digilocker_gstin.pdf', viaDigilocker: true, ocr: [{ label: 'gstin', value: '29AAFFD6104E1Z5' }, { label: 'legalName', value: 'Deccan Roadlines' }] },
      { key: 'pan', status: 'verified', file: 'digilocker_pan.pdf', viaDigilocker: true, ocr: [{ label: 'pan', value: 'AAFFD6104E' }, { label: 'name', value: 'Deccan Roadlines' }] },
      { key: 'incorporation', status: 'verified', file: 'partnership_deed.pdf', ocr: [{ label: 'name', value: 'Deccan Roadlines' }] },
      { key: 'transportLicence', status: 'verified', file: 'transport_permit.pdf', ocr: [{ label: 'name', value: 'Deccan Roadlines' }] },
      { key: 'bank', status: 'verified', file: 'cancelled_cheque.jpg', ocr: [{ label: 'holder', value: 'Deccan Roadlines' }, { label: 'ifsc', value: 'CNRB0001234' }] },
      { key: 'insurance', status: 'flagged', file: 'git_policy_2025.pdf', number: 'GIT/KA/2025/7741', expiry: '2026-11-30', flag: 'expired', note: 'expiresBeforeStart', ocr: [{ label: 'policy', value: 'GIT/KA/2025/7741' }, { label: 'expiry', value: '2026-11-30' }] },
      { key: 'vehicles', status: 'verified', file: 'rc_fitness_KA25AB1234.pdf', number: 'KA25AB1234', ocr: [{ label: 'reg', value: 'KA25AB1234' }] },
      { key: 'driverLicence', status: 'verified', file: 'dl_basavaraj.pdf', number: 'KA-2520150034567', ocr: [{ label: 'dl', value: 'KA-2520150034567' }] },
      { key: 'policeVerification', status: 'verified', file: 'pv_basavaraj.pdf', ocr: [{ label: 'name', value: 'Basavaraj H.' }] },
    ],
    checks: {
      gstin: { ok: true, detail: { gstin: '29AAFFD6104E1Z5', state: 'Karnataka', active: 1 }, at: AT('2026-10-13', '11:02') },
      pan: { ok: true, detail: { pan: 'AAFFD6104E', name: 'Deccan Roadlines' }, at: AT('2026-10-13', '11:02') },
      digilocker: { ok: true, detail: { fetched: 3 }, at: AT('2026-10-13', '11:02') },
      pennyDrop: { ok: true, detail: { holder: 'Deccan Roadlines', account: 'XXXX4471', ifsc: 'CNRB0001234', bank: 'Canara Bank', matchPct: 100 }, at: AT('2026-10-13', '11:20') },
      vahan: { ok: true, detail: { reg: 'KA25AB1234', vehicleClass: 'Goods carrier (HGV)', fitnessTill: '2027-02-28', permitTill: '2027-08-31', insuranceTill: '2027-02-28' }, at: AT('2026-10-13', '11:31') },
      sarathi: { ok: true, detail: { dl: 'KA-2520150034567', licenceClass: 'Transport (HGV)', validTill: '2028-03-31' }, at: AT('2026-10-13', '11:34') },
    },
    kycSubmittedAt: AT('2026-10-13', '11:40'),
    outcome: {
      result: 'conditional',
      conditions: [{ text: '', due: '2026-11-26', docKey: 'insurance' }],
      by: 'LS-MEERA',
      at: AT('2026-10-14', '15:10'),
    },
  },
  {
    id: 'APP-2026-0118',
    partnerId: 'P-NCRXD',
    ref: 'APP-2026-0118',
    receivedAt: AT('2026-02-23', '09:45'),
    source: 'website',
    services: ['parcel', 'expressPtl', 'standardPtl'],
    constitution: 'privateLtd',
    contact: { name: 'Deepak Chauhan', designation: 'Director', mobile: '98100 66720', email: 'deepak@ncrcrossdock.in' },
    address: 'Khasra 210, Daulatabad Road, Gurugram, Haryana 122001',
    gstRegistered: true,
    states: ['Haryana'],
    cities: ['Gurugram'],
    pincodes: [],
    lanes: [],
    hubs: [{ name: 'NCR CrossDock, Gurugram', address: 'Khasra 210, Daulatabad Road, Gurugram', pincode: '122001', areaSqft: 42000, docks: 12 }],
    fleet: {},
    capacity: 1500,
    indicativeRates: [
      { leg: 'originHub', rate: 6 },
      { leg: 'destHub', rate: 6 },
    ],
    fitScore: 80,
    fitReason: 'No Logisco hub in Gurugram.',
    fitDetail: { kind: 'hubGap', place: 'Gurugram', partners: 0 },
    status: 'live',
    decision: { by: 'LS-MEERA', at: AT('2026-02-23', '15:30') },
    documents: [
      { key: 'gstin', status: 'verified', file: 'gst_certificate.pdf' },
      { key: 'pan', status: 'verified', file: 'pan.pdf' },
      { key: 'incorporation', status: 'verified', file: 'coi.pdf' },
      { key: 'bank', status: 'verified', file: 'cancelled_cheque.jpg' },
      { key: 'premisesInsurance', status: 'verified', file: 'premises_policy.pdf', number: 'FIRE/HR/2026/1180', expiry: '2027-02-28' },
      { key: 'policeVerification', status: 'verified', file: 'pv_hub_staff.pdf' },
      { key: 'hubDocs', status: 'verified', file: 'lease_fire_noc_trade.pdf' },
    ],
    checks: {
      gstin: { ok: true, detail: { gstin: '06AADCN8823K1Z1', state: 'Haryana', active: 1 }, at: AT('2026-02-24', '10:00') },
      pan: { ok: true, detail: { pan: 'AADCN8823K', name: 'NCR CrossDock Pvt Ltd' }, at: AT('2026-02-24', '10:00') },
      pennyDrop: { ok: true, detail: { holder: 'NCR CrossDock Pvt Ltd', account: 'XXXX2210', ifsc: 'HDFC0001102', bank: 'HDFC Bank', matchPct: 100 }, at: AT('2026-02-24', '10:12') },
    },
    kycSubmittedAt: AT('2026-02-24', '10:30'),
    outcome: { result: 'approved', conditions: [], by: 'system', at: AT('2026-02-24', '10:30') },
    hubAudit: {
      date: '2026-03-05',
      window: 'morning',
      contact: 'Rohit Malik',
      phone: '98990 55667',
      auditorId: 'LS-KIRAN',
      items: {
        security: { result: 'pass', photo: gurugramPhoto('10:05') },
        cctv: { result: 'pass', photo: gurugramPhoto('10:18') },
        fireSafety: { result: 'pass', photo: gurugramPhoto('10:34') },
        docks: { result: 'pass', photo: gurugramPhoto('10:51') },
        scale: { result: 'pass', note: 'Calibrated 12-Feb-2026', photo: gurugramPhoto('11:07') },
      },
      result: 'approved',
      completedAt: AT('2026-03-05', '11:20'),
    },
  },
]

/** SwiftCity last week, Parcel profile (seed-data.md §6, Partner Portal spec §7.3). */
export const weeklyScores: WeeklyScore[] = [
  // INVENTED: the week before, so the dashboard can show the trend (86.2 vs 85.2 → ↑1)
  {
    id: 'WS-SWIFTCITY-2026-11-09',
    partnerId: 'P-SWIFTCITY',
    week: '2026-11-09',
    profile: 'parcel',
    kpis: { pickup: 95, onTime: 90, firstAttempt: 87, damagePer10k: 5, damagePct: 83, scanCompliance: 94, responsiveness: 45 },
    total: 85.2,
    tierBefore: 'gold',
    tierAfter: 'gold',
  },
  {
    id: 'WS-SWIFTCITY-2026-11-16',
    partnerId: 'P-SWIFTCITY',
    week: '2026-11-16',
    profile: 'parcel',
    kpis: { pickup: 96, onTime: 91, firstAttempt: 88, damagePer10k: 4, damagePct: 85, scanCompliance: 95, responsiveness: 45 },
    total: 86.2,
    tierBefore: 'gold',
    tierAfter: 'gold',
  },
]

/**
 * SwiftCity's next payout (seed-data.md §6): self-billed SB/SWC/25-26/047,
 * ₹1,56,240 + GST ₹28,123 = ₹1,84,363, less a ₹300 deduction → ₹1,84,063 on 27-Nov.
 */
export const partnerInvoices: PartnerInvoice[] = [
  { id: 'SB/SWC/25-26/047', partnerId: 'P-SWIFTCITY', cycle: '2026-11-16/2026-11-22', mode: 'selfBilled', lines: [], taxable: 156240, gst: 28123, total: 184363, status: 'approved' },
]

export const payouts: Payout[] = [
  {
    id: 'PO-SWC-2026-1127',
    batchId: 'PB-2026-1127',
    partnerId: 'P-SWIFTCITY',
    invoiceId: 'SB/SWC/25-26/047',
    gross: 184363,
    deductions: [{ reason: 'Late pickup penalty', amount: 300 }],
    net: 184063,
    dueDate: '2026-11-27',
    status: 'scheduled',
  },
]
