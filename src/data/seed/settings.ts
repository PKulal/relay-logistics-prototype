/**
 * Settings seed (CP-28 to CP-37): Sharma Electricals' integrations, billing
 * settings, KYC documents, last logins, consignee defaults and the first
 * notifications. seed-data.md §5 gives "Tally connected"; the key name, key
 * ending (lg_sbx_••••91af), webhook URL and dates follow the CP-32 samples.
 * Everything else here is INVENTED and does not contradict seed-data.md.
 */
import { WEBHOOK_EVENTS, type DemoData, type Notification } from '@shared/types'

const AT = (d: string, t = '10:00') => `${d}T${t}:00+05:30`

const notifications: Notification[] = [
  { id: 'NTF-00001', audience: { app: 'customer', customerId: 'C-SHARMA' }, title: 'Weight revision on LGS-DEL-000784', body: 'Hub weight is higher than booked. Accept or dispute within 48 h.', link: '/customer/exceptions/weight/LGS-DEL-000784', at: AT('2026-11-23', '08:40'), read: false },
  { id: 'NTF-00002', audience: { app: 'customer', customerId: 'C-SHARMA' }, title: 'Delivery failed: LGS-DEL-000776', body: 'Premises closed. Choose reattempt, new slot or return.', link: '/customer/exceptions/ndr/LGS-DEL-000776', at: AT('2026-11-22', '17:20'), read: false },
  { id: 'NTF-00003', audience: { app: 'customer', customerId: 'C-SHARMA' }, title: 'Invoice LGS/DL/25-26/04417 generated', body: '₹2,41,800 due 01-Dec-2026', link: '/customer/billing/invoices', at: AT('2026-11-01', '09:00'), read: true },
  { id: 'NTF-00004', audience: { app: 'customer', customerId: 'C-SHARMA' }, title: 'Claim CLM-2026-0142 settled', body: 'Credit note CN-2026-0088 for ₹30,000 on LGS-DEL-000769', link: '/customer/claims/CLM-2026-0142', at: AT('2026-11-12', '15:00'), read: true },
]

export function addSettingsSeed(data: DemoData): DemoData {
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
