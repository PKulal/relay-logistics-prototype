import { buildSeed, DEMO_START } from '@data/seed'
import { bookableLocations, skuWeights } from '@shared/engines/customerSettings'
import { actionNeeded, notificationsFor, unreadCount } from '@shared/engines/notifications'
import { skuOutlier } from './contractActions'
import * as cs from './customerSettingsActions'
import { replyTicket } from './departmentActions'

const now = DEMO_START
const by = 'CU-PRIYA'

describe('CP-28 users', () => {
  it('invites (unique email), the last Admin cannot be disabled or downgraded, first login activates', () => {
    let d = buildSeed()
    const x = { name: 'Neha Jain', email: 'neha@sharmaelectricals.in', mobile: '98100 55667', role: 'dispatch' as const, locationIds: ['PL-MANESAR'], language: 'hi' as const }
    expect(cs.inviteCustomerUser(d, 'C-SHARMA', { ...x, email: 'kavita@sharmaelectricals.in' }, by, now).error).toBe('emailTaken')
    const r = cs.inviteCustomerUser(d, 'C-SHARMA', x, by, now)
    d = r.data
    expect(d.customerUsers[r.id!]).toMatchObject({ status: 'invited', invitedAt: now })
    expect(cs.setCustomerUserEnabled(d, 'CU-PRIYA', false, by, now).error).toBe('lastAdmin')
    expect(cs.updateCustomerUser(d, 'CU-PRIYA', { ...x, name: 'Priya Sharma', mobile: '98100 23456', role: 'finance' }, by, now).error).toBe('lastAdmin')
    // A second Admin makes it possible
    d = cs.updateCustomerUser(d, 'CU-KAVITA', { name: 'Kavita Rao', mobile: '99100 77881', role: 'admin', locationIds: [], language: 'en' }, by, now).data
    expect(cs.setCustomerUserEnabled(d, 'CU-PRIYA', false, by, now).error).toBeUndefined()
    d = cs.recordCustomerLogin(d, r.id!, now)
    expect(d.customerUsers[r.id!]).toMatchObject({ status: 'active', lastLoginAt: now })
    expect(Object.values(d.auditLog).some((a) => a.action === 'user.invite' && a.app === 'customer')).toBe(true)
  })

  it('CP-13 offers only active locations in the user\'s access', () => {
    let d = buildSeed()
    const sharma = d.customers['C-SHARMA']
    expect(bookableLocations(d, sharma, d.customerUsers['CU-RAMESH']).map((l) => l.id)).toEqual(['PL-OKHLA'])
    expect(bookableLocations(d, sharma, d.customerUsers['CU-KAVITA']).map((l) => l.id)).toEqual(['PL-OKHLA', 'PL-MANESAR'])
    expect(cs.setLocationActive(d, 'PL-OKHLA', false, by, now)).toBe(d) // default can't be deactivated
    d = cs.setLocationActive(d, 'PL-MANESAR', false, by, now)
    expect(bookableLocations(d, sharma).map((l) => l.id)).toEqual(['PL-OKHLA'])
    expect(cs.setDefaultLocation(d, 'PL-MANESAR', by, now)).toBe(d) // inactive can't be default
  })
})

describe('CP-29 / CP-30 / CP-31', () => {
  it('a location needs a serviceable pincode', () => {
    const d = buildSeed()
    const loc = { name: 'Faridabad Store', address: 'Sector 24', pincode: '999999', contact: { name: 'Ramesh Kumar', mobile: '98730 11223' }, window: { from: '10:00', to: '17:00' }, days: 'Mon–Sat' }
    expect(cs.savePickupLocation(d, 'C-SHARMA', loc, undefined, by, now).error).toBe('notServiceable')
    const r = cs.savePickupLocation(d, 'C-SHARMA', { ...loc, pincode: '110020' }, undefined, by, now)
    expect(r.data.pickupLocations[r.id!]).toMatchObject({ isDefault: false, active: true, customerId: 'C-SHARMA' })
  })

  it('address book: delete keeps the record; Excel import skips bad rows', () => {
    let d = buildSeed()
    d = cs.removeAddress(d, 'CN-BPC', by, now)
    expect(d.consignees['CN-BPC'].saved).toBe(false)
    const good = { type: 'business' as const, company: 'Dharwad Electricals', contact: 'Ravi', mobile: '94480 11122', address: 'PB Road', pincode: '580030', appointmentRequired: false, defaultService: 'standardPtl' as const }
    const r = cs.importAddresses(d, 'C-SHARMA', [good, { ...good, pincode: '999999' }, { ...good, company: '' }], by, now)
    expect([r.added, r.skipped]).toEqual([1, 2])
  })

  it('SKU weights and the AI outlier check flag exactly the 2 seeded outliers', () => {
    const d = buildSeed()
    const skus = Object.values(d.skus).filter((s) => s.customerId === 'C-SHARMA')
    expect(skus).toHaveLength(20)
    expect(skus.filter((s) => skuOutlier(s)).map((s) => s.code).sort()).toEqual(['LUG-KIT', 'SG-LT-1600'])
    expect(skuWeights(d.skus['SKU-SG-LT-400'], d.settings)).toEqual({ volumetric: 19.2, cft: 27.1 }) // spec sample "27 kg"
  })

  it('SKU save freezes a plausible SKU, flags an outlier, Accept as is → with Logisco', () => {
    let d = buildSeed()
    expect(cs.saveSku(d, 'C-SHARMA', { code: 'sg-lt-400', description: 'x', l: 1, b: 1, h: 1, weight: 1, hsn: '', unitValue: 0 }, undefined, by, now).error).toBe('codeTaken')
    let r = cs.saveSku(d, 'C-SHARMA', { code: 'MCB-63-4P', description: 'MCB 63A 4-pole (box of 6)', l: 30, b: 25, h: 20, weight: 5, hsn: '8536', unitValue: 9000 }, undefined, by, now)
    expect(r.data.skus[r.id!].status).toBe('frozen')
    d = r.data
    r = cs.saveSku(d, 'C-SHARMA', { code: 'SG-LT-1600', description: 'LT switchgear panel 1600A', l: 80, b: 60, h: 60, weight: 120, hsn: '8537', unitValue: 160000 }, 'SKU-SG-LT-1600', by, now)
    expect(r.data.skus['SKU-SG-LT-1600'].status).toBe('frozen') // corrected size fits the weight
    d = cs.acceptSkuFlag(r.data, 'SKU-LUG-KIT', by, now)
    expect(d.skus['SKU-LUG-KIT'].status).toBe('draft')
  })
})

describe('CP-32 / CP-33', () => {
  it('API keys show once and keep only the last 4; production after go-live; webhooks are HTTPS only', () => {
    let d = buildSeed()
    const r = cs.createApiKey(d, 'C-SHARMA', 'Website', 'production', by, now)
    expect(r.key).toMatch(/^lg_live_[0-9a-f]{32}$/)
    d = r.data
    expect(d.customers['C-SHARMA'].integrations.apiKeys!.at(-1)).toMatchObject({ name: 'Website', env: 'production', last4: r.key!.slice(-4) })
    expect(cs.addWebhook(d, 'C-SHARMA', 'http://x.in/hook', ['booked'], by, now).secret).toBeUndefined()
    expect(cs.testWebhook(d, 'C-SHARMA', 'WH-1', now)).toMatchObject({ status: 200 })
    d = cs.setErpConnector(d, 'C-SHARMA', undefined, by, now)
    expect(d.customers['C-SHARMA'].integrations).toMatchObject({ tally: false, erp: undefined })
  })

  it('bank change needs a matching penny-drop name', () => {
    const d = buildSeed()
    expect(cs.changeBank(d, 'C-SHARMA', { holder: 'Ravi Traders', account: '123456789012', ifsc: 'ICIC0004567' }, by, now)).toMatchObject({ ok: false })
    const r = cs.changeBank(d, 'C-SHARMA', { holder: 'Sharma Electricals Pvt Ltd', account: '123456789012', ifsc: 'ICIC0004567' }, by, now)
    expect(r.ok).toBe(true)
    expect(r.data.customers['C-SHARMA'].bank).toMatchObject({ account: '123456789012', ifsc: 'ICIC0004567' })
  })
})

describe('CP-36 / CP-37', () => {
  it('notifications: Sharma sees its own; action needed for weight revision and NDR', () => {
    const d = buildSeed()
    const v = { app: 'customer' as const, customerId: 'C-SHARMA', userId: by }
    const list = notificationsFor(d.notifications, v)
    expect(list.map((n) => n.id)).toEqual(['NTF-00001', 'NTF-00002', 'NTF-00004', 'NTF-00003'])
    expect(list.filter(actionNeeded).map((n) => n.id)).toEqual(['NTF-00001', 'NTF-00002'])
    expect(unreadCount(d.notifications, { app: 'customer', customerId: 'C-KAVERI' })).toBe(0)
  })

  it('ticket: raise → Logisco reply waits for you → customer reply → resolved → only the customer closes it', () => {
    let d = buildSeed()
    const r = cs.raiseTicket(d, 'C-SHARMA', { category: 'billing', subject: 'GST on Oct invoice', description: 'Please share the GST breakup.', invoiceId: 'LGS/DL/25-26/04417' }, 'CU-KAVITA', now)
    expect(r.id).toBe('TKT-2026-3382')
    d = r.data
    expect(d.tickets[r.id!]).toMatchObject({ status: 'open', dueAt: '2026-11-23T18:00:00+05:30' })
    d = replyTicket(d, r.id!, 'Which line items?', false, 'LS-FARAH', now)
    expect(d.tickets[r.id!].status).toBe('waiting')
    expect(Object.values(d.notifications).find((n) => n.title === `Reply on ${r.id}`)?.link).toBe(`/customer/help?ticket=${r.id}`)
    d = cs.customerReplyTicket(d, r.id!, 'All of them', 'breakup.xlsx', 'CU-KAVITA', now)
    expect(d.tickets[r.id!].status).toBe('inProgress')
    expect(cs.confirmResolved(d, r.id!, 'CU-KAVITA', now)).toBe(d) // not resolved yet
    d = replyTicket(d, r.id!, 'Breakup attached', true, 'LS-FARAH', now)
    d = cs.confirmResolved(d, r.id!, 'CU-KAVITA', now)
    expect(d.tickets[r.id!].status).toBe('closed')
  })
})
