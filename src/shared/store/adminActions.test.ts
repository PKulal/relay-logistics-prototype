import { buildSeed, DEMO_START } from '@data/seed'
import { defaultLevel, erpScreens, withPermissions } from '@apps/erp/access'
import { erpNav } from '@apps/erp/nav'
import { auditRows, decisionRows } from '@shared/engines/aiLog'
import { notDeposited, remitDate } from '@shared/engines/receivables'
import { band, floorsOf } from '@shared/engines/scoring'
import { navPages, visibleNav } from '@shared/nav'
import * as adm from './adminActions'

const now = DEMO_START
const by = 'LS-ADMIN'

describe('ERP-42 users', () => {
  it('adds staff with a logisco.in email; the last Super Admin stays; nobody disables themselves', () => {
    let d = buildSeed()
    expect(adm.addStaffUser(d, { name: 'Ritu Nair', email: 'ritu@gmail.com', title: 'Analyst', role: 'controlTower', regions: [] }, by, now).error).toBe('required')
    const r = adm.addStaffUser(d, { name: 'Ritu Nair', email: 'ritu.nair@logisco.in', title: 'Control Tower Operator', role: 'controlTower', regions: ['Delhi NCR'] }, by, now)
    d = r.data
    expect(d.staff[r.id!]).toMatchObject({ status: 'active', regions: ['Delhi NCR'] })
    expect(adm.setStaffUserEnabled(d, by, false, by, now).error).toBe('self')
    expect(adm.updateStaffUser(d, by, { name: 'Admin', title: 'Super Admin', role: 'finance', regions: [] }, 'LS-OTHER', now).error).toBe('lastSuperAdmin')
    expect(auditRows(d)[0]).toMatchObject({ action: 'staff.add', app: 'erp', userId: by })
  })
})

describe('ERP-42 role editor drives the menu', () => {
  it('None hides a default screen; View opens one the role could not see', () => {
    let d = buildSeed()
    const pages = (role: 'controlTower') => navPages(visibleNav(withPermissions(erpNav, d.rolePermissions[role]), { role })).map((p) => p.screenId)
    expect(pages('controlTower')).toContain('ERP-05')
    expect(pages('controlTower')).not.toContain('ERP-31')
    d = adm.setRolePermission(d, 'controlTower', 'ERP-05', 'none', by, now)
    d = adm.setRolePermission(d, 'controlTower', 'ERP-31', 'view', by, now)
    expect(pages('controlTower')).not.toContain('ERP-05')
    expect(pages('controlTower')).toContain('ERP-31')
    // Super Admin can't lock itself out of ERP-42
    expect(adm.setRolePermission(d, 'superAdmin', 'ERP-42', 'none', by, now)).toBe(d)
    const s = erpScreens(erpNav).find((x) => x.screenId === 'ERP-31')!
    expect([defaultLevel(s.visible, 'finance'), defaultLevel(s.visible, 'controlTower')]).toEqual(['act', 'none'])
  })
})

describe('ERP-44 settings change behaviour everywhere', () => {
  it('validates ranges and tier order; logs before / after', () => {
    const d = buildSeed()
    expect(adm.updateSettings(d, { gstPct: 99 }, by, now).error).toEqual({ field: 'gstPct', reason: 'range' })
    expect(adm.updateSettings(d, { tierBands: { platinum: 80, gold: 85, silver: 70, bronze: 60 } }, by, now).error?.reason).toBe('order')
    const r = adm.updateSettings(d, { codDepositHours: 48 }, by, now)
    expect(auditRows(r.data)[0]).toMatchObject({ action: 'settings.update', before: { codDepositHours: 24 }, after: { codDepositHours: 48 } })
  })

  it('COD deposit window, remittance days and tier bands are read from settings', () => {
    let d = buildSeed()
    const lateBefore = notDeposited(d, now).filter((x) => x.late).length
    d = adm.updateSettings(d, { codDepositHours: 72, codRemittanceDays: 1 }, by, now).data
    expect(notDeposited(d, now).filter((x) => x.late).length).toBeLessThanOrEqual(lateBefore)
    const rec = Object.values(d.codRecords).find((x) => x.deliveredAt)!
    expect(remitDate(rec, d.settings.codRemittanceDays) < remitDate(rec)).toBe(true)
    expect(band(86.2, floorsOf(d.settings.tierBands))).toBe('gold')
    d = adm.updateSettings(d, { tierBands: { platinum: 85, gold: 75, silver: 65, bronze: 55 } }, by, now).data
    expect(band(86.2, floorsOf(d.settings.tierBands))).toBe('platinum')
  })
})

describe('ERP-43 AI decision log', () => {
  it('lists assignment decisions with the chosen partner and its reason', () => {
    const rows = decisionRows(buildSeed())
    const a = rows.find((r) => r.kind === 'legAssignment')
    expect(a?.decision.partner).toBeTruthy()
    expect(a?.reason.candidates).toBeGreaterThan(0)
  })
})
