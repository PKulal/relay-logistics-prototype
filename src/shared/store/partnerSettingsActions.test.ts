import { buildSeed, DEMO_START } from '@data/seed'
import { staffOptions } from '@shared/engines/partnerJobs'
import { docRegister, vehicleBlock } from '@shared/engines/partnerSettings'
import { addHours } from '@shared/lib/time'
import { assignLegs } from './partnerActions'
import * as ps from './partnerSettingsActions'

const now = DEMO_START
const by = 'PU-VIKRAM'
const staffIn = (x: Partial<ps.StaffInput> = {}): ps.StaffInput => ({ name: 'Sohan Lal', role: 'rider', mobile: '98730 55001', photo: 'p:Sohan', idProof: { kind: 'aadhaar', last4: '4321' }, licenceNo: 'DL-0420210098765', language: 'hi', ...x })

describe('PP-29 staff', () => {
  it('add checks the licence on Sarathi; no assignment until police verification', () => {
    let d = buildSeed()
    expect(ps.createStaff(d, 'P-SWIFTCITY', staffIn({ mobile: '98730 44556' }), by, now).error).toBe('mobileTaken') // Ravi's
    expect(ps.createStaff(d, 'P-SWIFTCITY', staffIn({ licenceNo: 'X1' }), by, now).error).toBe('licence')
    const r = ps.createStaff(d, 'P-SWIFTCITY', staffIn(), by, now)
    d = r.data
    expect(d.fieldStaff[r.id!]).toMatchObject({ status: 'active', licenceValidTill: '2029-12-31', policeVerified: false, appLinkSentAt: now })
    expect(staffOptions(d, 'P-SWIFTCITY', 'firstMile', now).find((o) => o.staff.id === r.id)?.block).toBe('policeVerificationPending')
    d = ps.updateStaff(d, r.id!, { language: 'hi', policeFile: 'pv.pdf', policeDate: '2026-11-20' }, by, now).data
    expect(staffOptions(d, 'P-SWIFTCITY', 'firstMile', now).find((o) => o.staff.id === r.id)?.block).toBeUndefined()
  })

  it('a blocked rider loses assignment', () => {
    let d = buildSeed()
    d = ps.setStaffStatus(d, 'FS-RAVI', 'blocked', by, now)
    expect(staffOptions(d, 'P-SWIFTCITY', 'firstMile', now).find((o) => o.staff.id === 'FS-RAVI')?.block).toBe('inactive')
    const leg = Object.values(d.legs).find((l) => l.partnerId === 'P-SWIFTCITY' && l.status === 'accepted')
    if (leg) expect(assignLegs(d, [leg.id], 'FS-RAVI', undefined, by, now)).toBe(d)
  })
})

describe('PP-30 vehicles', () => {
  it('Vahan check, FASTag for line-haul, expired document blocks assignment', () => {
    let d = buildSeed()
    const docs = { rc: '2034-01-31', fitness: '2027-09-30', permit: '2028-03-31', insurance: '2027-06-30' }
    expect(ps.saveVehicle(d, 'P-SWIFTCITY', { regNo: 'BAD', type: 'Tempo', payloadKg: 1000, docs, ownership: 'own' }, undefined, by, now).error).toBe('vahan')
    expect(ps.saveVehicle(d, 'P-SWIFTCITY', { regNo: 'KA25AB1234', type: 'Tempo', payloadKg: 1000, docs, ownership: 'own' }, undefined, by, now).error).toBe('duplicate') // Deccan's
    expect(ps.saveVehicle(d, 'P-SWIFTCITY', { regNo: 'DL01AB1111', type: '32 ft', payloadKg: 9000, docs, ownership: 'own' }, undefined, by, now).error).toBe('fastag')
    const r = ps.saveVehicle(d, 'P-SWIFTCITY', { regNo: 'dl01 ab 1111', type: 'Tempo', payloadKg: 1500, docs: { ...docs, insurance: '2026-11-20' }, ownership: 'attached' }, undefined, by, now)
    d = r.data
    expect(d.vehicles['V-DL01AB1111']).toMatchObject({ docExpiry: '2026-11-20', ownership: 'attached' })
    expect(vehicleBlock(d.vehicles['V-DL01AB1111'], now)).toBe('docsExpired')
    d = ps.uploadRenewal(d, 'P-SWIFTCITY', 'VH:V-DL01AB1111:insurance', 'ins.pdf', '2027-11-19', by, now)
    expect(vehicleBlock(d.vehicles['V-DL01AB1111'], now)).toBeUndefined()
  })
})

describe('PP-31 / PP-32', () => {
  it('adding a hub starts an audit and tells the hub auditor', () => {
    const d = buildSeed()
    const x = { name: 'Okhla mini hub', address: 'Okhla Phase I', pincode: '110020', docks: 2, hours: '08:00–22:00', areaSqft: 4000, scaleCalibrationTill: '2027-06-30', cctv: true, fireSafety: false }
    expect(ps.saveHub(d, 'P-SWIFTCITY', x, undefined, by, now).error).toBe('safety')
    const r = ps.saveHub(d, 'P-SWIFTCITY', { ...x, fireSafety: true }, undefined, by, now)
    expect(r.data.hubs[r.id!].auditStatus).toBe('pending')
    expect(r.data.partners['P-SWIFTCITY'].hubIds).toContain(r.id)
    expect(Object.values(r.data.notifications).some((n) => n.audience.role === 'hubAuditor' && n.title === 'Hub audit needed')).toBe(true)
  })

  it('register: fire NOC 30-Nov is in the 7-day band; renewal is under review for 4 h then valid', () => {
    let d = buildSeed()
    const ncr = docRegister(d, 'P-NCRXD', now)
    expect(ncr[0]).toMatchObject({ id: 'HB:HUB-GGN:fireNoc', status: 'expiring', alert: 7 })
    expect(docRegister(d, 'P-SWIFTCITY', now).find((r) => r.id === 'CO:P-SWIFTCITY:insurance')).toMatchObject({ status: 'expiring', alert: 15 })
    d = ps.uploadRenewal(d, 'P-NCRXD', 'HB:HUB-GGN:fireNoc', 'noc-2027.pdf', '2027-11-30', 'PU-DEEPAK', now)
    expect(docRegister(d, 'P-NCRXD', now).find((r) => r.id === 'HB:HUB-GGN:fireNoc')?.status).toBe('underReview')
    expect(docRegister(d, 'P-NCRXD', addHours(now, 4)).find((r) => r.id === 'HB:HUB-GGN:fireNoc')).toMatchObject({ status: 'valid', expiry: '2027-11-30' })
  })
})

describe('PP-33 / PP-34 / PP-35', () => {
  it('exit request opens a partner-request case; bank change needs a name match', () => {
    let d = buildSeed()
    expect(ps.changePartnerBank(d, 'P-SWIFTCITY', { holder: 'Someone Else', account: '123456789012', ifsc: 'HDFC0001234' }, by, now).ok).toBe(false)
    expect(ps.changePartnerBank(d, 'P-SWIFTCITY', { holder: 'SwiftCity Couriers Pvt Ltd', account: '123456789012', ifsc: 'HDFC0001234' }, by, now).ok).toBe(true)
    d = ps.requestExit(d, 'P-SWIFTCITY', 'Moving to own network', by, now)
    const c = Object.values(d.suspensionCases).find((x) => x.partnerId === 'P-SWIFTCITY')!
    expect(c).toMatchObject({ trigger: 'partnerRequest', step: 1 })
    expect(c.log[0].app).toBe('partnerPortal')
    expect(ps.requestExit(d, 'P-SWIFTCITY', 'again', by, now)).toBe(d) // one open case
  })

  it('portal users: last Partner Admin stays; invite is unique by email', () => {
    const d = buildSeed()
    expect(ps.setPortalUserEnabled(d, 'PU-VIKRAM', false, by, now).error).toBe('lastAdmin')
    expect(ps.updatePortalUser(d, 'PU-VIKRAM', { name: 'Vikram Singh', mobile: '98111 22334', role: 'operations', hubIds: [] }, by, now).error).toBe('lastAdmin')
    expect(ps.invitePortalUser(d, 'P-SWIFTCITY', { name: 'X', email: 'neha@swiftcity.in', mobile: '98111 00000', role: 'finance', hubIds: [] }, by, now).error).toBe('emailTaken')
  })

  it('API: production key, webhook test 200, duplicate status codes refused', () => {
    let d = buildSeed()
    expect(d.partners['P-DECCAN'].integration!.statusMapping.find((m) => m.code === 'DEP')?.status).toBe('inTransit')
    const k = ps.createPartnerApiKey(d, 'P-DECCAN', 'Backup TMS', 'sandbox', 'PU-PRAKASH', now)
    expect(k.key).toMatch(/^lg_p_sbx_/)
    d = k.data
    expect(ps.testJobWebhook(d, 'P-DECCAN', now)).toMatchObject({ status: 200 })
    expect(ps.saveStatusMapping(d, 'P-DECCAN', [{ code: 'dep', status: 'inTransit' }, { code: 'DEP', status: 'arrived' }], 'PU-PRAKASH', now)).toBe(d)
  })
})
