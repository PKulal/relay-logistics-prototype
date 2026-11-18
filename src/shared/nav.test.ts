import { customerNav, type CustomerCtx } from '@apps/customer/nav'
import { erpNav } from '@apps/erp/nav'
import { TABS } from '@apps/partner-app/nav'
import { partnerNav, type PartnerCtx } from '@apps/partner-portal/nav'
import { buildBaseSeed } from '@data/seed'
import { personasFor } from '@shared/personas'
import type { CustomerRole, ErpRole, PartnerRole } from '@shared/types'
import { navPages, visibleNav, type NavGroup } from './nav'

const data = buildBaseSeed()

/** Every visible page label, flattened. */
const pages = <Ctx,>(nav: NavGroup<Ctx>[], ctx: Ctx) => navPages(visibleNav(nav, ctx)).map((p) => p.labelKey.split('.').pop())

describe('Customer Portal menu (CP §4.2, §3.3)', () => {
  const ctx = (role: CustomerRole, customerId = 'C-SHARMA'): CustomerCtx => ({ role, customer: data.customers[customerId] })

  it('Admin sees booking, invoices, users and integrations', () => {
    expect(pages(customerNav, ctx('admin'))).toEqual(
      expect.arrayContaining(['dashboard', 'quote', 'bookSingle', 'bookBulk', 'shipments', 'invoices', 'users', 'integrations']),
    )
  })

  it('Finance cannot book; Dispatch cannot see invoices, users or integrations', () => {
    expect(pages(customerNav, ctx('finance'))).not.toContain('bookSingle')
    const dispatch = pages(customerNav, ctx('dispatch'))
    expect(dispatch).toContain('bookSingle')
    expect(dispatch).not.toEqual(expect.arrayContaining(['invoices']))
    expect(dispatch).not.toContain('users')
    expect(dispatch).not.toContain('integrations')
  })

  it('shows the wallet to prepaid customers only', () => {
    expect(pages(customerNav, ctx('admin', 'C-KAVERI'))).toContain('wallet')
    expect(pages(customerNav, ctx('admin', 'C-SHARMA'))).not.toContain('wallet')
  })
})

describe('Partner Portal menu (PP §4.2, §3.3)', () => {
  const ctx = (role: PartnerRole, partnerId: string): PartnerCtx => ({ role, partner: data.partners[partnerId] })

  it('Type B courier: delivery exceptions and COD, no trips or hub screens', () => {
    const p = pages(partnerNav, ctx('admin', 'P-SWIFTCITY'))
    expect(p).toEqual(expect.arrayContaining(['jobs', 'deliveryExceptions', 'cod', 'fleet']))
    expect(p).not.toContain('trips')
    expect(p).not.toContain('hub')
  })

  it('Type F hub: hub operations and hubs, no delivery exceptions or COD', () => {
    const p = pages(partnerNav, ctx('admin', 'P-NCRXD'))
    expect(p).toEqual(expect.arrayContaining(['hub', 'hubs']))
    expect(p).not.toContain('deliveryExceptions')
    expect(p).not.toContain('cod')
  })

  it('Type E in trial: trips and the onboarding tracker', () => {
    const p = pages(partnerNav, ctx('admin', 'P-DECCAN'))
    expect(p).toEqual(expect.arrayContaining(['trips', 'onboarding', 'integration']))
  })

  it('Operations has no money screens; Finance has no job inbox', () => {
    const ops = pages(partnerNav, ctx('operations', 'P-SWIFTCITY'))
    expect(ops).toContain('jobs')
    expect(ops).not.toContain('payouts')
    expect(ops).not.toContain('users')
    const fin = pages(partnerNav, ctx('finance', 'P-SWIFTCITY'))
    expect(fin).toContain('payouts')
    expect(fin).not.toContain('jobs')
  })
})

describe('ERP menu (ERP §2.2, §3.2)', () => {
  const groups = (role: ErpRole) => visibleNav(erpNav, { role }).flatMap((g) => g.items.map((i) => i.labelKey.split('.').pop()))

  it('Super Admin and Leadership see all 17 departments, placeholders included', () => {
    expect(groups('superAdmin')).toHaveLength(17)
    expect(groups('leadership')).toHaveLength(17)
  })

  it('Control Tower sees its department plus partner directory and hub monitor, but no placeholders', () => {
    const g = groups('controlTower')
    expect(g).toEqual(expect.arrayContaining(['controlTower', 'partners', 'hubOps']))
    expect(g).not.toContain('marketing')
    expect(g).not.toContain('finance')
  })

  it('Finance sees finance, claims (view), partner and account 360', () => {
    expect(groups('finance')).toEqual(expect.arrayContaining(['finance', 'claims', 'partners', 'sales']))
  })
})

describe('Partner App tabs (PA §4.1)', () => {
  it('differ by role', () => {
    const labels = (r: keyof typeof TABS) => TABS[r].map((t) => t.labelKey.split('.').pop())
    expect(labels('rider')).toEqual(['home', 'tasks', 'scan', 'myDay', 'more'])
    expect(labels('driver')).toEqual(['home', 'trip', 'scan', 'myDay', 'more'])
    expect(labels('hub')).toEqual(['home', 'inbound', 'scan', 'outbound', 'more'])
  })
})

describe('personas', () => {
  it('lists the spec demo personas first', () => {
    expect(personasFor('customer', data).slice(0, 4).map((p) => p.name)).toEqual(['Priya Sharma', 'Ramesh Kumar', 'Kavita Rao', 'Suresh Gowda'])
    expect(personasFor('partnerApp', data).slice(0, 4).map((p) => p.name)).toEqual(['Ravi Kumar', 'Pooja S.', 'Basavaraj H.', 'Manju R.'])
    expect(personasFor('erp', data)[0].name).toBe('Sanjay Rao')
  })

  it('offers every user of the app', () => {
    expect(personasFor('partnerPortal', data)).toHaveLength(Object.keys(data.partnerUsers).length)
    expect(personasFor('erp', data)).toHaveLength(13)
  })
})
