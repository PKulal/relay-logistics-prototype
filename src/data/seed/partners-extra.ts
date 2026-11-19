/**
 * INVENTED partners and people — not in docs/seed-data.md.
 *
 * The ERP spec (§11.2) asks for ~12 partners covering types A–F, and the
 * Partner Portal needs a login for every partner, but seed-data.md names only
 * eight partners and only SwiftCity's office users. Everything here fills
 * those gaps and must never contradict seed-data.md. Safe to rename.
 */
import type { FieldStaff, Partner, PartnerUser, Vehicle } from '@shared/types'

const MUMBAI = ['421302', '400093', '400001', '411001', '413512']
const ALL_SERVICES: Partner['services'] = ['economy', 'standard', 'express', 'expressPtl', 'standardPtl']

export const extraPartners: Partner[] = [
  {
    id: 'P-SURYA',
    name: 'Surya Freight Movers Ltd',
    shortName: 'Surya Freight',
    type: 'A',
    legs: ['lineHaul'],
    services: ALL_SERVICES,
    gstin: '07AAECS3381N1Z2',
    pan: 'AAECS3381N',
    city: 'New Delhi',
    status: 'live',
    tier: 'gold',
    score: 84,
    capacityPerDay: 120,
    baseLoadToday: 45,
    coveragePincodes: [],
    laneIds: ['LN-DEL-BLR', 'LN-BLR-DEL', 'LN-BOM-BLR', 'LN-BLR-BOM'],
    hubIds: [],
    coordinatorId: 'LS-MEERA',
    autoAccept: true,
  },
  {
    id: 'P-WESTLINE',
    name: 'Westline Carriers',
    shortName: 'Westline Carriers',
    type: 'D',
    legs: ['lineHaul'],
    services: ALL_SERVICES,
    gstin: '27AAFFW7720K1Z8',
    pan: 'AAFFW7720K',
    city: 'Mumbai',
    status: 'live',
    tier: 'silver',
    score: 73,
    capacityPerDay: 90,
    baseLoadToday: 30,
    coveragePincodes: [],
    laneIds: ['LN-DEL-BOM', 'LN-BOM-DEL', 'LN-BOM-BLR', 'LN-BLR-BOM'],
    hubIds: [],
    coordinatorId: 'LS-MEERA',
    autoAccept: true,
  },
  {
    id: 'P-PEENYA',
    name: 'Peenya Hub Services',
    shortName: 'Peenya Hub',
    type: 'F',
    legs: ['originHub', 'destHub'],
    services: ALL_SERVICES,
    gstin: '29AAJFP4417L1Z6',
    pan: 'AAJFP4417L',
    city: 'Bengaluru',
    status: 'live',
    tier: 'silver',
    score: 77,
    capacityPerDay: 1000,
    baseLoadToday: 410,
    coveragePincodes: [],
    laneIds: [],
    hubIds: ['HUB-BLR'],
    coordinatorId: 'LS-MEERA',
    autoAccept: true,
  },
  {
    id: 'P-BHIWANDI',
    name: 'Bhiwandi Logistics Park',
    shortName: 'Bhiwandi Logistics',
    type: 'F',
    legs: ['originHub', 'destHub'],
    services: ALL_SERVICES,
    gstin: '27AAKFB9034F1Z1',
    pan: 'AAKFB9034F',
    city: 'Bhiwandi',
    status: 'live',
    tier: 'gold',
    score: 80,
    capacityPerDay: 1400,
    baseLoadToday: 560,
    coveragePincodes: [],
    laneIds: [],
    hubIds: ['HUB-BOM'],
    coordinatorId: 'LS-MEERA',
    autoAccept: true,
  },
  {
    id: 'P-DOORSTEP',
    name: 'Doorstep Dash',
    shortName: 'Doorstep Dash',
    type: 'C',
    legs: ['firstMile', 'lastMile'],
    services: ALL_SERVICES,
    gstin: '27AALFD2276C1Z4',
    pan: 'AALFD2276C',
    city: 'Mumbai',
    status: 'live',
    tier: 'silver',
    score: 71,
    capacityPerDay: 300,
    baseLoadToday: 120,
    coveragePincodes: MUMBAI,
    laneIds: [],
    hubIds: [],
    coordinatorId: 'LS-MEERA',
    autoAccept: true,
  },
]

/** One admin login per partner that seed-data.md leaves without office users. */
export const extraPartnerUsers: PartnerUser[] = [
  { id: 'PU-KARAN', partnerId: 'P-METRODASH', name: 'Karan Malhotra', mobile: '98112 40981', email: 'karan@metrodash.in', role: 'admin' },
  { id: 'PU-SUNIL', partnerId: 'P-QUICKLINK', name: 'Sunil Yadav', mobile: '98113 52267', email: 'sunil@quicklinkexpress.in', role: 'admin' },
  { id: 'PU-DEEPAK', partnerId: 'P-NCRXD', name: 'Deepak Chauhan', mobile: '98100 66720', email: 'deepak@ncrcrossdock.in', role: 'admin' },
  { id: 'PU-PRAKASH', partnerId: 'P-DECCAN', name: 'Prakash Kulkarni', mobile: '94480 77302', email: 'prakash@deccanroadlines.in', role: 'admin' },
  { id: 'PU-GIRISH', partnerId: 'P-HUBLIWH', name: 'Girish Hiremath', mobile: '94481 20476', email: 'girish@hubliwarehousing.in', role: 'admin' },
  { id: 'PU-NAVEEN', partnerId: 'P-NKEXP', name: 'Naveen Kamath', mobile: '94482 11590', email: 'naveen@nkexpress.in', role: 'admin' },
  { id: 'PU-IMRAN', partnerId: 'P-FASTTRACK', name: 'Imran Sheikh', mobile: '98451 76630', email: 'imran@fasttracklogistics.in', role: 'admin' },
  { id: 'PU-AMIT', partnerId: 'P-SURYA', name: 'Amit Saxena', mobile: '98115 09214', email: 'amit@suryafreight.in', role: 'admin' },
  { id: 'PU-HARISH', partnerId: 'P-WESTLINE', name: 'Harish Patel', mobile: '98201 66453', email: 'harish@westlinecarriers.in', role: 'admin' },
  { id: 'PU-LOKESH', partnerId: 'P-PEENYA', name: 'Lokesh Gowda', mobile: '98452 30871', email: 'lokesh@peenyahub.in', role: 'admin' },
  { id: 'PU-SAMEER', partnerId: 'P-BHIWANDI', name: 'Sameer Shaikh', mobile: '98202 74419', email: 'sameer@bhiwandilogistics.in', role: 'admin' },
  { id: 'PU-RITU', partnerId: 'P-DOORSTEP', name: 'Ritu Desai', mobile: '98203 81102', email: 'ritu@doorstepdash.in', role: 'admin' },
]

/**
 * Field staff so every partner can carry out its legs in the seeded journeys.
 * (Named personas Ravi, Pooja, Basavaraj and Manju are in partners.ts.)
 */
const fs = (id: string, partnerId: string, name: string, mobile: string, role: FieldStaff['role'], extra: Partial<FieldStaff> = {}): FieldStaff => ({
  id,
  partnerId,
  name,
  mobile,
  role,
  policeVerified: true,
  trained: true,
  language: 'hi',
  ...extra,
})

export const extraFieldStaff: FieldStaff[] = [
  fs('FS-SWC-AJAY', 'P-SWIFTCITY', 'Ajay Yadav', '98730 44557', 'rider', { licenceValidTill: '2028-09-30' }),
  fs('FS-SWC-DEEPAK', 'P-SWIFTCITY', 'Deepak Rawat', '98730 44558', 'rider', { licenceValidTill: '2029-01-31' }),
  fs('FS-MD-SANDEEP', 'P-METRODASH', 'Sandeep Kumar', '98112 40990', 'rider', { licenceValidTill: '2028-05-31' }),
  fs('FS-QL-MOHIT', 'P-QUICKLINK', 'Mohit Sharma', '98113 52270', 'rider', { licenceValidTill: '2029-04-30' }),
  fs('FS-NCR-RAKESH', 'P-NCRXD', 'Rakesh Tomar', '98102 33872', 'hub', { hubId: 'HUB-GGN' }),
  fs('FS-HWH-SHIVA', 'P-HUBLIWH', 'Shivakumar B.', '94481 20480', 'hub', { hubId: 'HUB-HBL', language: 'kn' }),
  fs('FS-NK-PRAKASH', 'P-NKEXP', 'Prakash Naik', '94486 40214', 'rider', { licenceValidTill: '2028-12-31', language: 'kn' }),
  fs('FS-FT-ARIF', 'P-FASTTRACK', 'Syed Arif', '98451 76640', 'rider', { licenceValidTill: '2028-07-31', language: 'kn' }),
  fs('FS-SUR-GURPREET', 'P-SURYA', 'Gurpreet Singh', '98115 09220', 'driver', { vehicleId: 'V-HR55AK7731', licenceValidTill: '2029-02-28' }),
  fs('FS-WL-DATTA', 'P-WESTLINE', 'Dattatray Pawar', '98201 66460', 'driver', { vehicleId: 'V-MH04KL2209', licenceValidTill: '2028-10-31' }),
  fs('FS-PNY-MANJUNATH', 'P-PEENYA', 'Manjunath K.', '98452 30880', 'hub', { hubId: 'HUB-BLR', language: 'kn' }),
  fs('FS-BHW-GANESH', 'P-BHIWANDI', 'Ganesh More', '98202 74420', 'hub', { hubId: 'HUB-BOM' }),
  fs('FS-DD-RAHUL', 'P-DOORSTEP', 'Rahul Jadhav', '98203 81110', 'rider', { licenceValidTill: '2029-06-30' }),
  fs('FS-DD-SNEHA', 'P-DOORSTEP', 'Sneha Patil', '98203 81111', 'rider', { licenceValidTill: '2030-03-31' }),
]

export const extraVehicles: Vehicle[] = [
  { id: 'V-HR55AK7731', partnerId: 'P-SURYA', regNo: 'HR55AK7731', type: '32 ft container truck', payloadKg: 9000, fastagId: 'FT-HR55AK7731', gpsId: 'GPS-SF-02', docExpiry: '2027-05-31' },
  { id: 'V-MH04KL2209', partnerId: 'P-WESTLINE', regNo: 'MH04KL2209', type: '24 ft truck', payloadKg: 7000, fastagId: 'FT-MH04KL2209', gpsId: 'GPS-WL-11', docExpiry: '2027-09-30' },
]
