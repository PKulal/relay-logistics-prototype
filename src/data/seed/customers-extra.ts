/**
 * INVENTED customers, consignees and SKUs — not in docs/seed-data.md.
 *
 * ERP spec §11.2 asks for ~8 customers across the customer types; seed-data.md
 * names two. CP spec §11.2 asks for 15 saved consignees and 20 SKUs (2 flagged)
 * for Sharma Electricals; seed-data.md names one of each. These fill the gaps
 * for the background shipments and must never contradict seed-data.md.
 */
import type { Consignee, Customer, CustomerUser, PickupLocation, Sku } from '@shared/types'

type C = Pick<Customer, 'id' | 'legalName' | 'shortName' | 'gstin' | 'type' | 'billing' | 'city'> & Partial<Customer>

const customer = (c: C): Customer => ({
  pan: c.gstin.slice(2, 12),
  entityType: 'Private Ltd',
  track: c.type === 'sme' ? 'selfServe' : 'enterprise',
  status: 'live',
  creditLimit: c.billing === 'credit' ? 300000 : 0,
  creditUsed: c.billing === 'credit' ? 96000 : 0,
  creditTermsDays: c.billing === 'credit' ? 30 : 0,
  securityDeposit: 0,
  walletBalance: c.billing === 'prepaid' ? 12500 : 0,
  kamId: c.type === 'sme' ? undefined : 'LS-ARJUN',
  rateCardId: 'RC-STANDARD',
  integrations: { tally: false },
  ...c,
})

export const extraCustomers: Customer[] = [
  customer({ id: 'C-ANKUR', legalName: 'Ankur Pharma Distributors Pvt Ltd', shortName: 'Ankur Pharma', gstin: '27AAFCA1123B1Z5', type: 'distributor', billing: 'credit', city: 'Mumbai' }),
  customer({ id: 'C-URBANLOOM', legalName: 'UrbanLoom Apparel Pvt Ltd', shortName: 'UrbanLoom', gstin: '29AACCU7745D1Z2', type: 'brand', billing: 'credit', city: 'Bengaluru' }),
  customer({ id: 'C-TRIVENI', legalName: 'Triveni Auto Components Ltd', shortName: 'Triveni Auto', gstin: '09AABCT3390H1Z8', type: 'enterprise', billing: 'credit', city: 'Noida', entityType: 'Public Ltd', creditLimit: 1000000, creditUsed: 412000, creditTermsDays: 45 }),
  customer({ id: 'C-KRAFTKART', legalName: 'KraftKart Marketplace Pvt Ltd', shortName: 'KraftKart', gstin: '29AAHCK5512J1Z4', type: 'marketplace', billing: 'credit', city: 'Bengaluru' }),
  customer({ id: 'C-GREENLEAF', legalName: 'Greenleaf Organics', shortName: 'Greenleaf Organics', gstin: '27ACDPG4471K1Z6', type: 'sme', billing: 'prepaid', city: 'Pune', entityType: 'Proprietorship' }),
  customer({ id: 'C-DECCANSTEEL', legalName: 'Deccan Steel Fabricators Pvt Ltd', shortName: 'Deccan Steel', gstin: '29AABCD8823L1Z1', type: 'manufacturer', billing: 'credit', city: 'Hubballi' }),
]

export const extraCustomerUsers: CustomerUser[] = [
  { id: 'CU-ANKUR', customerId: 'C-ANKUR', name: 'Vivek Ankur', email: 'vivek@ankurpharma.in', mobile: '98201 33450', role: 'admin', locationIds: ['PL-ANKUR'], language: 'en' },
  { id: 'CU-URBANLOOM', customerId: 'C-URBANLOOM', name: 'Shalini Rao', email: 'shalini@urbanloom.in', mobile: '98450 21876', role: 'admin', locationIds: ['PL-URBANLOOM'], language: 'en' },
  { id: 'CU-TRIVENI', customerId: 'C-TRIVENI', name: 'Alok Verma', email: 'alok.verma@triveniauto.in', mobile: '98110 87342', role: 'admin', locationIds: ['PL-TRIVENI'], language: 'hi' },
  { id: 'CU-KRAFTKART', customerId: 'C-KRAFTKART', name: 'Nikhil Menon', email: 'nikhil@kraftkart.in', mobile: '98451 90021', role: 'admin', locationIds: ['PL-KRAFTKART'], language: 'en' },
  { id: 'CU-GREENLEAF', customerId: 'C-GREENLEAF', name: 'Asha Gokhale', email: 'asha@greenleaforganics.in', mobile: '98220 64410', role: 'admin', locationIds: ['PL-GREENLEAF'], language: 'en' },
  { id: 'CU-DECCANSTEEL', customerId: 'C-DECCANSTEEL', name: 'Mallikarjun Patil', email: 'mallikarjun@deccansteel.in', mobile: '94480 31177', role: 'admin', locationIds: ['PL-DECCANSTEEL'], language: 'en' },
]

const loc = (id: string, customerId: string, name: string, address: string, pincode: string, lat: number, lng: number, contact: string, mobile: string): PickupLocation => ({
  id,
  customerId,
  name,
  address,
  pincode,
  lat,
  lng,
  contact: { name: contact, mobile },
  window: { from: '10:00', to: '18:00' },
  days: 'Mon–Sat',
  isDefault: true,
})

export const extraPickupLocations: PickupLocation[] = [
  loc('PL-ANKUR', 'C-ANKUR', 'Andheri Warehouse', 'B-12, Marol MIDC, Andheri East, Mumbai', '400093', 19.117, 72.866, 'Vivek Ankur', '98201 33450'),
  loc('PL-URBANLOOM', 'C-URBANLOOM', 'Peenya Factory', '42, 2nd Phase, Peenya Industrial Area, Bengaluru', '560058', 13.028, 77.519, 'Shalini Rao', '98450 21876'),
  loc('PL-TRIVENI', 'C-TRIVENI', 'Noida Plant', 'C-56, Sector 63, Noida', '201301', 28.585, 77.315, 'Alok Verma', '98110 87342'),
  loc('PL-KRAFTKART', 'C-KRAFTKART', 'MG Road Fulfilment Centre', '18, Residency Road, Bengaluru', '560001', 12.975, 77.606, 'Nikhil Menon', '98451 90021'),
  loc('PL-GREENLEAF', 'C-GREENLEAF', 'Pune Packing Unit', '7, East Street, Camp, Pune', '411001', 18.516, 73.878, 'Asha Gokhale', '98220 64410'),
  loc('PL-DECCANSTEEL', 'C-DECCANSTEEL', 'Tarihal Works', 'Plot 31, Tarihal Industrial Area, Hubballi', '580025', 15.34, 75.07, 'Mallikarjun Patil', '94480 31177'),
]

const cn = (id: string, customerId: string, company: string, contact: string, mobile: string, address: string, pincode: string, gstin?: string, appointmentRequired = false): Consignee => ({
  id,
  customerId,
  type: gstin ? 'business' : 'individual',
  company,
  contact,
  mobile,
  address,
  pincode,
  gstin,
  appointmentRequired,
})

export const extraConsignees: Consignee[] = [
  // Sharma Electricals: 10 more (15 with the 5 in customers.ts)
  cn('CN-SH06', 'C-SHARMA', 'Pune Power Solutions', 'Rohan Deshpande', '98220 11870', '21, Moledina Road, Camp, Pune', '411001', '27AAGFP1180Q1Z3'),
  cn('CN-SH07', 'C-SHARMA', 'Fort Switchgear Co', 'Imtiaz Merchant', '98200 55621', '9, Perin Nariman Street, Fort, Mumbai', '400001', '27AABFF7731R1Z5', true),
  cn('CN-SH08', 'C-SHARMA', 'Latur Electricals', 'Balaji Shinde', '98220 90311', 'MIDC Road, Latur', '413512', '27AAKFL2219S1Z7'),
  cn('CN-SH09', 'C-SHARMA', 'Peenya Panel Works', 'Kiran Hegde', '98450 77120', '17, 1st Stage, Peenya Industrial Area, Bengaluru', '560058', '29AAGFP3390T1Z1'),
  cn('CN-SH10', 'C-SHARMA', 'Mysore Electric Stores', 'Prasanna Rao', '98451 40987', 'Sayyaji Rao Road, Devaraja Mohalla, Mysuru', '570001', '29AAHFM6612U1Z2'),
  cn('CN-SH11', 'C-SHARMA', 'Haveri Agro Pumps', 'Basavaraj Angadi', '94482 66310', 'PB Road, Haveri', '581110', '29AAIFH4401V1Z6'),
  cn('CN-SH12', 'C-SHARMA', 'Chikodi Electricals', 'Ramesh Kamble', '94483 10776', 'Main Road, Chikodi', '591201', '29AAJFC9902W1Z8'),
  cn('CN-SH13', 'C-SHARMA', 'Bhiwandi Industrial Supplies', 'Feroz Ansari', '98202 44190', 'Kalyan Road, Bhiwandi', '421302', '27AALFB5530X1Z4'),
  cn('CN-SH14', 'C-SHARMA', 'Noida Control Systems', 'Pankaj Arora', '98110 33519', 'B-88, Sector 63, Noida', '201301', '09AAMFN2287Y1Z0'),
  cn('CN-SH15', 'C-SHARMA', 'Hubli Motor Works', 'Vinayak Kulkarni', '94480 55621', '5, Gokul Road, Hubballi', '580025', '29AANFH8814Z1Z2', true),
  // Kaveri Handicrafts
  cn('CN-KV02', 'C-KAVERI', 'Lakshmi Gift House', 'Lakshmi Narayan', '98450 66871', '23, Commercial Street, Bengaluru', '560001', '29AAOFL1123A1Z5'),
  cn('CN-KV03', 'C-KAVERI', 'Dilli Haat Crafts', 'Gurmeet Kaur', '98100 71230', 'Janpath, Connaught Place, New Delhi', '110001', '07AAPFD4456B1Z7'),
  // Invented customers: three each
  cn('CN-AK01', 'C-ANKUR', 'Capital Medicos', 'Rajiv Bhatia', '98100 22771', 'Bhagirath Palace, New Delhi', '110001', '07AAQFC7789C1Z1'),
  cn('CN-AK02', 'C-ANKUR', 'Southern Pharma Agencies', 'Venkatesh Iyer', '98450 31142', 'Avenue Road, Bengaluru', '560001', '29AARFS1122D1Z3'),
  cn('CN-AK03', 'C-ANKUR', 'Hubli Medical Distributors', 'Girish Joshi', '94480 61290', 'Koppikar Road, Hubballi', '580020', '29AASFH3345E1Z5'),
  cn('CN-UL01', 'C-URBANLOOM', 'UrbanLoom Store Delhi', 'Tanya Kapoor', '98100 90876', 'Aerocity, Mahipalpur, New Delhi', '110037', '07AACCU7745D1Z4'),
  cn('CN-UL02', 'C-URBANLOOM', 'UrbanLoom Store Mumbai', 'Zoya Khan', '98200 77105', 'Kala Ghoda, Fort, Mumbai', '400001', '27AACCU7745D1Z6'),
  cn('CN-UL03', 'C-URBANLOOM', 'Style Avenue Pune', 'Kunal Joshi', '98220 30965', 'MG Road, Camp, Pune', '411001', '27AATFS6678F1Z8'),
  cn('CN-TR01', 'C-TRIVENI', 'Karnataka Tractors Ltd', 'Santosh Hiremath', '94481 77450', 'Tarihal Industrial Area, Hubballi', '580025', '29AAUCK9901G1Z2', true),
  cn('CN-TR02', 'C-TRIVENI', 'Peenya Engineering Works', 'Suresh Babu', '98450 12093', '4th Phase, Peenya, Bengaluru', '560058', '29AAVFP2234H1Z4'),
  cn('CN-TR03', 'C-TRIVENI', 'Bhiwandi Auto Parts', 'Sachin Patil', '98202 61187', 'Anjur Phata, Bhiwandi', '421302', '27AAWFB5567J1Z6'),
  cn('CN-KK01', 'C-KRAFTKART', '', 'Ananya Sharma', '98100 45512', 'Flat 402, Connaught Place, New Delhi', '110001'),
  cn('CN-KK02', 'C-KRAFTKART', '', 'Rahul Mehta', '98200 33876', '12, Marol, Andheri East, Mumbai', '400093'),
  cn('CN-KK03', 'C-KRAFTKART', '', 'Pooja Kulkarni', '98220 54390', 'Koregaon Park Road, Camp, Pune', '411001'),
  cn('CN-GL01', 'C-GREENLEAF', 'Namma Organic Mart', 'Deepa Gowda', '98450 99102', 'Church Street, Bengaluru', '560001', '29AAXFN8890K1Z8'),
  cn('CN-GL02', 'C-GREENLEAF', 'Delhi Organic Bazaar', 'Arvind Goel', '98100 63481', 'Connaught Place, New Delhi', '110001', '07AAYFD1123L1Z2'),
  cn('CN-GL03', 'C-GREENLEAF', 'Mysuru Naturals', 'Shreya Urs', '98451 26674', 'Devaraja Urs Road, Mysuru', '570001', '29AAZFM4456M1Z2'),
  cn('CN-DS01', 'C-DECCANSTEEL', 'Gurugram Steel Traders', 'Manish Yadav', '98100 41157', 'Daulatabad Road, Gurugram', '122001', '06ABAFG7789N1Z4', true),
  cn('CN-DS02', 'C-DECCANSTEEL', 'Manesar Fabrication Hub', 'Ajit Chauhan', '98110 64302', 'Sector 8, IMT Manesar', '122050', '06ABBFM1122P1Z6'),
  cn('CN-DS03', 'C-DECCANSTEEL', 'Belgaum Structurals', 'Nitin Desai', '94482 20981', 'Udyambag, Belagavi', '590001', '29ABCFB3345Q1Z8'),
]

/** Sharma Electricals SKUs: 19 more (20 with SG-LT-400); 2 flagged as outliers (CP spec §11.2). */
const sku = (code: string, description: string, l: number, b: number, h: number, weight: number, hsn: string, unitValue: number, status: Sku['status'] = 'frozen'): Sku => ({
  id: `SKU-${code}`,
  customerId: 'C-SHARMA',
  code,
  description,
  l,
  b,
  h,
  weight,
  hsn,
  unitValue,
  status,
})

export const extraSkus: Sku[] = [
  sku('SG-LT-250', 'LT switchgear panel 250A', 55, 40, 40, 17, '8537', 22000),
  sku('SG-LT-630', 'LT switchgear panel 630A', 70, 45, 45, 28, '8537', 42000),
  sku('DB-8W-TPN', 'Distribution board 8-way TPN', 45, 35, 20, 7, '8537', 6500),
  sku('DB-12W-TPN', 'Distribution board 12-way TPN', 50, 40, 22, 9, '8537', 8200),
  sku('MCB-32-4P', 'MCB 32A 4-pole (box of 12)', 30, 25, 20, 4, '8536', 9600),
  sku('MCCB-100', 'MCCB 100A 3-pole', 35, 25, 20, 5, '8536', 7800),
  sku('MCCB-250', 'MCCB 250A 3-pole', 40, 30, 25, 8, '8536', 14500),
  sku('ACB-800', 'Air circuit breaker 800A', 60, 50, 50, 45, '8536', 68000),
  sku('CT-200-5', 'Current transformer 200/5 (box of 6)', 30, 30, 20, 6, '8504', 5400),
  sku('CAP-25KVAR', 'Capacitor bank 25 kVAR', 50, 40, 40, 22, '8532', 18500),
  sku('APFC-100', 'APFC panel 100 kVAR', 80, 60, 50, 60, '8537', 95000),
  sku('BB-CU-1000', 'Copper busbar 1000A (set)', 120, 20, 15, 30, '7407', 36000),
  sku('ENC-IP65-M', 'IP65 enclosure, medium', 50, 40, 25, 8, '8538', 4200),
  sku('ENC-IP65-L', 'IP65 enclosure, large', 70, 50, 30, 13, '8538', 6800),
  sku('METER-MFM', 'Multi-function meter (box of 10)', 35, 30, 20, 4, '9028', 12000),
  sku('RELAY-EF', 'Earth fault relay (box of 10)', 30, 25, 20, 3, '8536', 9500),
  sku('CBL-GLAND', 'Cable glands, assorted (carton)', 40, 30, 30, 15, '8547', 3800),
  // Outliers flagged by the AI SKU check: weight doesn't fit the size
  sku('SG-LT-1600', 'LT switchgear panel 1600A', 60, 40, 40, 120, '8537', 160000, 'flagged'),
  sku('LUG-KIT', 'Cable lug kit', 150, 100, 80, 2, '8536', 1500, 'flagged'),
]
