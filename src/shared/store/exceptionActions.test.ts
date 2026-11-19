import { buildSeed, DEMO_START } from '@data/seed'
import { canReassign } from '@shared/engines/controlTower'
import { escalationsFor, responsiveness } from '@shared/engines/escalations'
import { hubItems } from '@shared/engines/hub'
import { addMinutes } from '@shared/lib/time'
import { reassignLeg } from './controlTowerActions'
import { acknowledgeTicket, assignReattempt, cancelSos, injectEscalation, reportHubException, reportPickupFailed, resolvePartnerTicket, resolveSos, triggerSos } from './exceptionActions'
import { respondNdr } from './ndrActions'

const now = DEMO_START
const L1 = 'JOB-000790-L1'

describe('PA-18 pickup failed', () => {
  it('needs a photo and a call to the shipper in the last 15 minutes; then the desk can reassign within 2 hours', () => {
    const base = buildSeed()
    const x = { legId: L1, staffId: 'FS-RAVI', reason: 'goodsNotReady' as const, photo: 'p.jpg', note: 'Ready at 17:00', calledAt: addMinutes(now, -5) }
    expect(reportPickupFailed(base, { ...x, calledAt: addMinutes(now, -20) }, now)).toBe(base)
    expect(reportPickupFailed(base, { ...x, photo: '' }, now)).toBe(base)
    expect(reportPickupFailed(base, { ...x, staffId: 'FS-MANJU' }, now)).toBe(base)
    let d = reportPickupFailed(base, x, now)
    expect(d.legs[L1].status).toBe('exception')
    expect(d.shipments['LGS-DEL-000790'].status).toBe('booked')
    const t = Object.values(d.exceptions).find((e) => e.legId === L1 && e.type === 'pickupMissed')!
    expect(t).toMatchObject({ ownerPartnerId: 'P-SWIFTCITY', aiCause: 'consignee', report: { reason: 'goodsNotReady', photos: ['p.jpg'] }, actionDueAt: '2026-11-23T12:00:00+05:30' })
    expect(Object.values(d.notifications).some((n) => n.audience.partnerId === 'P-SWIFTCITY' && n.title === 'Pickup failed')).toBe(true)
    // ERP-08 can now reassign the failed pickup
    expect(canReassign(d.legs[L1])).toBe(true)
    d = reassignLeg(d, { legId: L1, partnerId: 'P-QUICKLINK', reason: 'partnerRequest', notify: { oldPartner: true, newPartner: true, customer: false } }, 'LS-SANJAY', now)
    expect(d.legs[L1].partnerId).toBe('P-QUICKLINK')
  })
})

describe('PA-30 hub report', () => {
  it('raises a ticket against the previous leg with photos; 1–5 photos only', () => {
    const base = buildSeed()
    const hubId = base.fieldStaff['FS-POOJA'].hubId!
    const item = hubItems(base, hubId, now).find((i) => i.stage !== 'expected')!
    const x = { legId: item.leg.id, staffId: 'FS-POOJA', kind: 'short' as const, pieceIds: [item.pieceIds[0]], photos: ['a', 'b', 'c'], note: 'Bag seal intact, 5 of 6' }
    expect(reportHubException(base, { ...x, photos: [] }, now).id).toBeUndefined()
    expect(reportHubException(base, { ...x, photos: ['1', '2', '3', '4', '5', '6'] }, now).id).toBeUndefined()
    const r = reportHubException(base, x, now)
    expect(r.data.exceptions[r.id!]).toMatchObject({ type: 'short', legId: item.from.id, ownerPartnerId: item.from.partnerId, report: { pieceIds: x.pieceIds, photos: ['a', 'b', 'c'] }, actionDueAt: '2026-11-23T14:00:00+05:30' })
    expect(r.data.legs[item.leg.id].status).toBe(base.legs[item.leg.id].status)
  })
})

describe('PP-20 escalations', () => {
  it('injected missed scan → acknowledge stops the timer → resolve with root cause; responsiveness counts it', () => {
    const base = buildSeed()
    const r = injectEscalation(base, 'P-SWIFTCITY', now)
    let d = r.data
    const e = escalationsFor(d, 'P-SWIFTCITY', now).find((x) => x.x.id === r.id)!
    expect(e).toMatchObject({ status: 'new', ackLeft: 120, ackDueAt: '2026-11-23T12:00:00+05:30' })
    expect(d.exceptions[r.id!]).toMatchObject({ type: 'missedScan', auto: true })
    d = acknowledgeTicket(d, r.id!, 'PU-NEHA', addMinutes(now, 30))
    expect(escalationsFor(d, 'P-SWIFTCITY', now).find((x) => x.x.id === r.id)).toMatchObject({ status: 'acknowledged', ackLeft: undefined })
    expect(resolvePartnerTicket(d, r.id!, { response: ' ', rootCause: 'vehicleIssue', evidence: [] }, 'PU-NEHA', now)).toBe(d)
    d = resolvePartnerTicket(d, r.id!, { response: 'Scanner battery died; re-scanned at 11:10', rootCause: 'other', evidence: ['scan.jpg'] }, 'PU-NEHA', addMinutes(now, 70))
    expect(d.exceptions[r.id!]).toMatchObject({ status: 'inProgress', partner: { rootCause: 'other', resolvedBy: 'PU-NEHA' } })
    expect(d.exceptions[r.id!].log!.map((l) => l.action)).toEqual(['partnerAck', 'partnerResolved'])
    expect(responsiveness(d, 'P-SWIFTCITY')).toEqual({ tickets: 1, ackOnTime: 1, resolvedOnTime: 1 })
  })
})

describe('PP-21 reattempt assignment', () => {
  it('after the customer picks a new slot, NK Express gives the job to another rider', () => {
    let d = buildSeed()
    expect(assignReattempt(d, 'JOB-000776-L5', 'FS-NK-PRAKASH', 'PU-NAVEEN', now)).toBe(d) // still awaiting the customer
    d = respondNdr(d, 'LGS-DEL-000776', { kind: 'changeSlot', date: '2026-11-27', from: '11:00', to: '13:00' }, 'CU-PRIYA', now)
    expect(assignReattempt(d, 'JOB-000776-L5', 'FS-RAVI', 'PU-NAVEEN', now)).toBe(d) // not their rider
    d = assignReattempt(d, 'JOB-000776-L5', 'FS-NK-PRAKASH', 'PU-NAVEEN', now)
    expect(d.legs['JOB-000776-L5']).toMatchObject({ staffId: 'FS-NK-PRAKASH', status: 'assigned', window: { from: '2026-11-27T11:00:00+05:30' } })
  })
})

describe('PA-12 SOS', () => {
  it('raises an alert with location for the Control Tower and the partner; one at a time; cancel or resolve', () => {
    const base = buildSeed()
    const r = triggerSos(base, 'FS-MANJU', now)
    let d = r.data
    expect(d.sosAlerts[r.id!]).toMatchObject({ staffId: 'FS-MANJU', partnerId: 'P-NKEXP', status: 'active' })
    expect(d.sosAlerts[r.id!].lat).toBeGreaterThan(0)
    expect(triggerSos(d, 'FS-MANJU', now).id).toBeUndefined()
    expect(Object.values(d.notifications).filter((n) => n.title === 'SOS: Manju R.').length).toBe(2)
    expect(cancelSos(d, r.id!, addMinutes(now, 1))).toBe(d) // after 10 seconds
    const c = cancelSos(d, r.id!, now)
    expect(c.sosAlerts[r.id!].status).toBe('cancelled')
    d = resolveSos(d, r.id!, 'Called; minor fall, safe', 'LS-SANJAY', now)
    expect(d.sosAlerts[r.id!]).toMatchObject({ status: 'resolved', resolvedBy: 'LS-SANJAY' })
  })
})
