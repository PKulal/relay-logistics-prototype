/**
 * Customers, their users, pickup locations, consignees and SKUs.
 * Source: docs/seed-data.md §3 and §5, Customer Portal spec §11.1.
 * Values marked INVENTED are not given in seed-data.md.
 */
import type { Consignee, Customer, CustomerUser, PickupLocation, Sku } from '@shared/types'

export const customers: Customer[] = [
  {
    id: 'C-SHARMA',
    legalName: 'Sharma Electricals Pvt Ltd',
    shortName: 'Sharma Electricals',
    gstin: '07AABCS1234F1Z5',
    pan: 'AABCS1234F',
    cin: 'U31200DL2008PTC123456',
    entityType: 'Private Ltd',
    type: 'manufacturer',
    track: 'enterprise',
    status: 'live',
    billing: 'credit',
    creditLimit: 500000,
    creditUsed: 344200, // available ₹1,55,800
    creditTermsDays: 30,
    securityDeposit: 50000,
    walletBalance: 0,
    spendMonthToDate: 102400, // "Nov unbilled to date ₹1,02,400" (seed-data.md §5)
    // ₹38,400 pending; seed-data.md says "next remittance 20-Nov", which is before the
    // demo opens (23-Nov). Shown as the next T+2 remittance instead (agreed).
    cod: { pending: 38400, nextRemittance: '2026-11-25', remittedThisMonth: 212600 },
    kamId: 'LS-ARJUN',
    rateCardId: 'RC-SHARMA-2026',
    bank: { name: 'HDFC Bank', branch: 'Okhla', ifsc: 'HDFC0001234', account: '50200012345678' },
    signatory: { name: 'Rajesh Sharma', designation: 'Director', email: 'rajesh@sharmaelectricals.in', mobile: '98110 45678' },
    integrations: { tally: true },
    city: 'New Delhi',
  },
  {
    id: 'C-KAVERI',
    legalName: 'Kaveri Handicrafts',
    shortName: 'Kaveri Handicrafts',
    gstin: '29ABKPG7781L1Z6', // INVENTED
    pan: 'ABKPG7781L', // INVENTED
    entityType: 'Proprietorship', // INVENTED
    type: 'sme',
    track: 'selfServe',
    status: 'live',
    billing: 'prepaid',
    creditLimit: 0,
    creditUsed: 0,
    creditTermsDays: 0,
    securityDeposit: 0,
    walletBalance: 8450,
    spendMonthToDate: 4820, // INVENTED; LGS-MYS-000112 is part of it
    rateCardId: 'RC-STANDARD',
    integrations: { tally: false },
    city: 'Mysuru',
  },
]

export const customerUsers: CustomerUser[] = [
  { id: 'CU-PRIYA', customerId: 'C-SHARMA', name: 'Priya Sharma', title: 'Logistics Head', email: 'priya@sharmaelectricals.in', mobile: '98100 23456', role: 'admin', locationIds: ['PL-OKHLA', 'PL-MANESAR'], language: 'en' },
  { id: 'CU-RAMESH', customerId: 'C-SHARMA', name: 'Ramesh Kumar', title: 'Dispatch Executive', email: 'ramesh@sharmaelectricals.in' /* INVENTED */, mobile: '98730 11223', role: 'dispatch', locationIds: ['PL-OKHLA'], language: 'hi' },
  { id: 'CU-KAVITA', customerId: 'C-SHARMA', name: 'Kavita Rao', title: 'Finance Manager', email: 'kavita@sharmaelectricals.in', mobile: '99100 77881', role: 'finance', locationIds: [], language: 'en' },
  { id: 'CU-SURESH', customerId: 'C-KAVERI', name: 'Suresh Gowda', title: 'Owner', email: 'suresh@kaverihandicrafts.in' /* INVENTED */, mobile: '98450 66120' /* INVENTED */, role: 'admin', locationIds: ['PL-KAVERI'], language: 'en' },
]

export const pickupLocations: PickupLocation[] = [
  {
    id: 'PL-OKHLA',
    customerId: 'C-SHARMA',
    name: 'Okhla Factory',
    address: 'Plot 42, Okhla Industrial Area Phase II, New Delhi',
    pincode: '110020',
    lat: 28.5355,
    lng: 77.2732,
    contact: { name: 'Ramesh Kumar', mobile: '98730 11223' },
    window: { from: '10:00', to: '17:00' },
    days: 'Mon–Sat',
    isDefault: true,
  },
  {
    id: 'PL-MANESAR',
    customerId: 'C-SHARMA',
    name: 'Manesar Warehouse',
    address: 'Plot 118, Sector 8, IMT Manesar, Gurugram, Haryana', // INVENTED address
    pincode: '122050',
    lat: 28.359,
    lng: 76.935,
    contact: { name: 'Ramesh Kumar', mobile: '98730 11223' },
    window: { from: '09:00', to: '18:00' },
    days: 'Mon–Sat',
    isDefault: false,
  },
  {
    id: 'PL-KAVERI',
    customerId: 'C-KAVERI',
    name: 'Mysuru Workshop', // INVENTED
    address: '2nd Cross, Devaraja Mohalla, Mysuru, Karnataka',
    pincode: '570001',
    lat: 12.308,
    lng: 76.654,
    contact: { name: 'Suresh Gowda', mobile: '98450 66120' },
    window: { from: '10:00', to: '18:00' },
    days: 'Mon–Sat',
    isDefault: true,
  },
]

/**
 * Consignees used by the key shipments. Hubli Electric Distributors is from
 * seed-data.md §3; the others are INVENTED. The rest of Sharma's 15 saved
 * consignees are added with the shipment seed (build-plan Phase 1b).
 */
export const consignees: Consignee[] = [
  { id: 'CN-HED', customerId: 'C-SHARMA', type: 'business', company: 'Hubli Electric Distributors', contact: 'Mahesh Patil', mobile: '94480 12345', address: 'Shop 14, APMC Yard, Amargol, Hubballi', pincode: '580030', gstin: '29AAFFH5678K1Z2', appointmentRequired: true },
  { id: 'CN-SKE', customerId: 'C-SHARMA', type: 'business', company: 'Shree Krishna Electricals', contact: 'Anand Joshi', mobile: '94481 55102', address: '12, Station Road, Keshwapur, Hubballi', pincode: '580020', gstin: '29AAKFS2231Q1Z8', appointmentRequired: false },
  { id: 'CN-BST', customerId: 'C-SHARMA', type: 'business', company: 'Bengaluru Switchgear Traders', contact: 'Ravi Shankar', mobile: '98450 33017', address: '45, Brigade Road, MG Road, Bengaluru', pincode: '560001', gstin: '29AABFB4410M1Z1', appointmentRequired: false },
  { id: 'CN-MEM', customerId: 'C-SHARMA', type: 'business', company: 'Mumbai Electric Mart', contact: 'Nitin Shah', mobile: '98200 41876', address: 'Unit 7, Marol MIDC, Andheri East, Mumbai', pincode: '400093', gstin: '27AAGFM9902P1Z4', appointmentRequired: false },
  { id: 'CN-BPC', customerId: 'C-SHARMA', type: 'business', company: 'Belgaum Power Controls', contact: 'Sunil Desai', mobile: '94482 70915', address: '88, Khanapur Road, Camp, Belagavi', pincode: '590001', gstin: '29AAHFB6631C1Z0', appointmentRequired: false },
  { id: 'CN-CBP', customerId: 'C-KAVERI', type: 'business', company: 'Craft Bazaar Pune', contact: 'Meghna Kulkarni', mobile: '98220 18456', address: 'Shop 3, MG Road, Camp, Pune', pincode: '411001', gstin: '27AAJFC5521H1Z7', appointmentRequired: false },
]

export const skus: Sku[] = [
  // seed-data.md §3: 6 cartons of 60 × 40 × 40 cm, 20 kg each; invoice ₹1,80,000 → ₹30,000 each
  { id: 'SKU-SG-LT-400', customerId: 'C-SHARMA', code: 'SG-LT-400', description: 'LT switchgear panel 400A', l: 60, b: 40, h: 40, weight: 20, hsn: '8537', unitValue: 30000, status: 'frozen' },
]
