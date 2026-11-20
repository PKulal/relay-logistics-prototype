/**
 * Settings seed (CP-28 to CP-37): Sharma Electricals' integrations, billing
 * settings, KYC documents, last logins, consignee defaults and the first
 * notifications. seed-data.md §5 gives "Tally connected"; the key name, key
 * ending (lg_sbx_••••91af), webhook URL and dates follow the CP-32 samples.
 * Everything else here is INVENTED and does not contradict seed-data.md.
 *
 * Partner side (PP-29 to PP-35): SwiftCity's profile follows the PP-33
 * samples (Type B since 12-Mar-2026, Axis ••5678, ₹25,000 deposit); the NCR
 * CrossDock fire NOC expiring 30-Nov is the PP-32 sample; Deccan's API key,
 * webhook URL and DEP → In transit mapping are the PP-35 samples.
 */
import { JOB_PUSH_EVENTS, WEBHOOK_EVENTS, type DemoData, type Hub, type Notification, type PartnerProfile } from '@shared/types'

const AT = (d: string, t = '10:00') => `${d}T${t}:00+05:30`

const notifications: Notification[] = [
  { id: 'NTF-00001', audience: { app: 'customer', customerId: 'C-SHARMA' }, title: 'Weight revision on LGS-DEL-000784', body: 'Hub weight is higher than booked. Accept or dispute within 48 h.', link: '/customer/exceptions/weight/LGS-DEL-000784', at: AT('2026-11-23', '08:40'), read: false },
  { id: 'NTF-00002', audience: { app: 'customer', customerId: 'C-SHARMA' }, title: 'Delivery failed: LGS-DEL-000776', body: 'Premises closed. Choose reattempt, new slot or return.', link: '/customer/exceptions/ndr/LGS-DEL-000776', at: AT('2026-11-22', '17:20'), read: false },
  { id: 'NTF-00003', audience: { app: 'customer', customerId: 'C-SHARMA' }, title: 'Invoice LGS/DL/25-26/04417 generated', body: '₹2,41,800 due 01-Dec-2026', link: '/customer/billing/invoices', at: AT('2026-11-01', '09:00'), read: true },
  { id: 'NTF-00004', audience: { app: 'customer', customerId: 'C-SHARMA' }, title: 'Claim CLM-2026-0142 settled', body: 'Credit note CN-2026-0088 for ₹30,000 on LGS-DEL-000769', link: '/customer/claims/CLM-2026-0142', at: AT('2026-11-12', '15:00'), read: true },
]

const partnerNotifications: Notification[] = [
  { id: 'NTF-00005', audience: { app: 'partnerPortal', partnerId: 'P-SWIFTCITY' }, title: 'Goods-in-transit insurance expires 08-Dec-2026', body: 'Upload the renewal in Documents and compliance.', link: '/partner/compliance', at: AT('2026-11-23', '08:00'), read: false },
  { id: 'NTF-00006', audience: { app: 'partnerPortal', partnerId: 'P-SWIFTCITY' }, title: 'Payout scheduled for 27-Nov', body: 'SB/SWC/25-26/047 · ₹1,84,063', link: '/partner/finance/payouts', at: AT('2026-11-23', '07:30'), read: true },
  { id: 'NTF-00007', audience: { app: 'partnerPortal', partnerId: 'P-NCRXD' }, title: 'Fire NOC expires 30-Nov-2026', body: 'NCR CrossDock, Gurugram · upload the renewal', link: '/partner/compliance', at: AT('2026-11-23', '08:00'), read: false },
]

const BANKS = [
  { name: 'Axis Bank', ifsc: 'UTIB0000043' },
  { name: 'HDFC Bank', ifsc: 'HDFC0000201' },
  { name: 'ICICI Bank', ifsc: 'ICIC0000045' },
  { name: 'State Bank of India', ifsc: 'SBIN0001234' },
]

const HUB_PROFILE: Record<string, Partial<Hub>> = {
  'HUB-GGN': { areaSqft: 24000, storagePallets: 300, scaleCalibrationTill: '2027-06-30', fireNocTill: '2026-11-30', tradeLicenceTill: '2027-03-31', leaseTill: '2029-03-31', cctv: true, fireSafety: true },
  'HUB-HBL': { areaSqft: 18000, storagePallets: 220, scaleCalibrationTill: '2027-04-30', fireNocTill: '2027-08-31', tradeLicenceTill: '2027-03-31', leaseTill: '2028-06-30', cctv: true, fireSafety: true },
  'HUB-BLR': { areaSqft: 30000, storagePallets: 400, scaleCalibrationTill: '2027-05-31', fireNocTill: '2027-10-31', tradeLicenceTill: '2027-03-31', leaseTill: '2030-01-31', cctv: true, fireSafety: true },
  'HUB-BOM': { areaSqft: 36000, storagePallets: 500, scaleCalibrationTill: '2027-02-28', fireNocTill: '2027-09-30', tradeLicenceTill: '2027-03-31', leaseTill: '2029-12-31', cctv: true, fireSafety: true },
}

const plusYears = (d: string, y: number) => `${Number(d.slice(0, 4)) + y}${d.slice(4)}`

function addPartnerSettings(data: DemoData): DemoData {
  const partners = { ...data.partners }
  Object.values(partners).forEach((p, i) => {
    const bank = BANKS[i % BANKS.length]
    const swift = p.id === 'P-SWIFTCITY'
    const profile: PartnerProfile = {
      address: swift ? 'B-41, Okhla Industrial Area Phase I, New Delhi 110020' : p.city,
      onboardedOn: swift ? '2026-03-12' : '2026-04-01',
      bank: swift ? { name: 'Axis Bank', branch: 'Okhla', ifsc: 'UTIB0000043', account: '917020045675678' } : { name: bank.name, branch: p.city, ifsc: bank.ifsc, account: `5010${String(1000000000 + i * 7919).slice(-10)}` },
      deposit: swift ? 25000 : 0,
      agreementSignedOn: swift ? '2026-03-10' : '2026-03-28',
    }
    const companyDocs = [
      { key: 'gst' as const, number: p.gstin, file: 'GST-certificate.pdf' },
      { key: 'pan' as const, number: p.pan, file: 'PAN.pdf' },
      { key: 'transportLicence' as const, file: 'Transport-licence.pdf', expiry: '2027-03-31' },
      { key: 'insurance' as const, file: 'Goods-in-transit-insurance.pdf', expiry: swift ? '2026-12-08' : '2027-04-30' },
    ]
    // Partners still onboarding get these from their application
    if (p.status === 'live' || p.status === 'suspended') partners[p.id] = { ...p, profile: p.profile ?? profile, companyDocs: p.companyDocs ?? companyDocs }
  })
  const deccan = partners['P-DECCAN']
  if (deccan)
    partners['P-DECCAN'] = {
      ...deccan,
      integration: {
        apiKeys: [
          { id: 'KEY-1', name: 'Deccan TMS (sandbox)', env: 'sandbox', last4: '7c03', createdAt: AT('2026-10-20', '12:00'), lastUsedAt: AT('2026-10-29', '16:40') },
          { id: 'KEY-2', name: 'Deccan TMS', env: 'production', last4: '19ab', createdAt: AT('2026-11-02', '11:00'), lastUsedAt: AT('2026-11-23', '09:50') },
        ],
        webhook: { url: 'https://api.deccanroadlines.in/logisco', events: [...JOB_PUSH_EVENTS], secretLast4: 'a41d', lastTest: { at: AT('2026-11-02', '11:20'), status: 200 } },
        statusMapping: [
          { code: 'ACK', status: 'accepted' },
          { code: 'LDD', status: 'pickedUp' },
          { code: 'DEP', status: 'inTransit' },
          { code: 'ARR', status: 'arrived' },
          { code: 'POD', status: 'delivered' },
        ],
        errors: [{ at: AT('2026-11-21', '18:42'), call: 'POST /v1/legs/{id}/status', reason: 'Unknown status code HLT (not in the mapping)' }],
      },
    }

  // Fitness is the earliest document, so docExpiry (what PP-11 alerts read) stays as seeded
  const vehicles = Object.fromEntries(Object.entries(data.vehicles).map(([id, v]) => [id, { ...v, ownership: v.ownership ?? 'own', docs: v.docs ?? { rc: plusYears(v.docExpiry, 8), fitness: v.docExpiry, permit: plusYears(v.docExpiry, 1), insurance: plusYears(v.docExpiry, 1) } }]))
  const hubs = Object.fromEntries(Object.entries(data.hubs).map(([id, h]) => [id, { ...h, ...HUB_PROFILE[id] }]))
  let n = 0
  const fieldStaff = Object.fromEntries(
    Object.entries(data.fieldStaff).map(([id, f]) => {
      n++
      const licenceNo = f.role !== 'hub' && f.licenceValidTill ? (f.licenceNo ?? `DL-04${String(20190000000 + n * 104729).slice(-11)}`) : f.licenceNo
      return [id, { ...f, status: f.status ?? 'active', licenceNo, policeVerifiedOn: f.policeVerified ? (f.policeVerifiedOn ?? '2026-03-08') : undefined }]
    }),
  )
  // PA-10: one SwiftCity rider is still in training (videos started, practice not done)
  if (fieldStaff['FS-SWC-DEEPAK']) fieldStaff['FS-SWC-DEEPAK'] = { ...fieldStaff['FS-SWC-DEEPAK'], trained: false, training: { videos: ['scan'], practice: [] } }
  const partnerUsers = { ...data.partnerUsers }
  const logins: Record<string, string> = { 'PU-VIKRAM': AT('2026-11-23', '09:05'), 'PU-NEHA': AT('2026-11-23', '08:50'), 'PU-ANIL': AT('2026-11-22', '18:10') }
  for (const u of Object.values(partnerUsers)) partnerUsers[u.id] = { ...u, status: 'active', lastLoginAt: logins[u.id], language: u.id === 'PU-NEHA' ? 'hi' : 'en' }
  return { ...data, partners, vehicles, hubs, fieldStaff, partnerUsers, notifications: { ...data.notifications, ...Object.fromEntries(partnerNotifications.map((x) => [x.id, x])) } }
}

export function addSettingsSeed(data: DemoData): DemoData {
  return addPartnerSettings(addCustomerSettings(data))
}

function addCustomerSettings(data: DemoData): DemoData {
  const sharma = data.customers['C-SHARMA']
  const users = { ...data.customerUsers }
  const logins: Record<string, string> = { 'CU-PRIYA': AT('2026-11-23', '09:40'), 'CU-RAMESH': AT('2026-11-23', '09:12'), 'CU-KAVITA': AT('2026-11-22', '17:30') }
  for (const [id, at] of Object.entries(logins)) users[id] = { ...users[id], status: 'active', lastLoginAt: at }

  const consignees = { ...data.consignees }
  const defaults: Record<string, Pick<DemoData['consignees'][string], 'defaultService' | 'receivingHours'>> = {
    'CN-HED': { defaultService: 'expressPtl', receivingHours: 'Mon–Sat 10:00–18:00 · Sunday closed' },
    'CN-SKE': { defaultService: 'standardPtl', receivingHours: 'Sunday closed' },
    'CN-MEM': { defaultService: 'expressPtl', receivingHours: 'Mon–Fri 09:30–17:30' },
  }
  for (const [id, d] of Object.entries(defaults)) if (consignees[id]) consignees[id] = { ...consignees[id], ...d }

  return {
    ...data,
    customerUsers: users,
    consignees,
    customers: {
      ...data.customers,
      'C-SHARMA': {
        ...sharma,
        integrations: {
          ...sharma.integrations,
          erp: 'tally',
          erpSync: { lastAt: AT('2026-11-23', '09:45'), everyMinutes: 15 },
          apiKeys: [{ id: 'KEY-1', name: 'Tally connector', env: 'sandbox', last4: '91af', createdAt: AT('2026-11-20', '11:00'), lastUsedAt: AT('2026-11-23', '09:45') }],
          webhooks: [{ id: 'WH-1', url: 'https://erp.sharmaelectricals.in/logisco', events: [...WEBHOOK_EVENTS], secretLast4: '7c2e', createdAt: AT('2026-11-20', '11:05') }],
        },
        billingPrefs: { address: 'Plot 42, Okhla Industrial Area Phase II, New Delhi 110020', frequency: 'monthly', emails: 'kavita@sharmaelectricals.in', poMandatory: false },
        kycDocs: [
          { kind: 'gst', file: 'GST-certificate.pdf', uploadedAt: AT('2026-03-10', '11:00') },
          { kind: 'pan', file: 'PAN-AABCS1234F.pdf', uploadedAt: AT('2026-03-10', '11:00') },
          { kind: 'coi', file: 'Certificate-of-incorporation.pdf', uploadedAt: AT('2026-03-10', '11:00') },
          { kind: 'cheque', file: 'Cancelled-cheque-HDFC.pdf', uploadedAt: AT('2026-03-10', '11:00') },
        ],
        reKycDue: '2027-03-10',
      },
    },
    notifications: { ...data.notifications, ...Object.fromEntries(notifications.map((n) => [n.id, n])) },
  }
}
