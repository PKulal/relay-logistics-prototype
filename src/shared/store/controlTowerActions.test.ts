import { buildSeed, DEMO_START } from '@data/seed'
import { canReassign, slaRisks } from '@shared/engines/controlTower'
import { dailyPack, pickupsBehind } from '@shared/engines/opsReview'
import { applyRiskSuggestion, closeTicket, dismissRisk, raiseAutoTickets, reassignLeg, ticketAction } from './controlTowerActions'

const now = DEMO_START
const L1 = 'JOB-000790-L1'

describe('Control Tower (source §8, §10, §11.1)', () => {
  it('ERP-06: 000790 L1 tops the list at 78% — Ravi has 7 pending pickups — suggestion: reassign to QuickLink', () => {
    const top = slaRisks(buildSeed(), now)[0]
    expect(top).toMatchObject({ shipmentId: 'LGS-DEL-000790', legId: L1, risk: 78, action: { kind: 'reassign', partnerId: 'P-QUICKLINK' } })
    expect(top.reasons[0]).toEqual({ code: 'staffLoad', staffId: 'FS-RAVI', pending: 7 })
  })

  it('apply: the leg moves to QuickLink at ₹220 and is offered in its inbox; Ravi’s other pickups get less risky', () => {
    const d = applyRiskSuggestion(buildSeed(), L1, 'LS-SANJAY', now)
    expect(d.legs[L1]).toMatchObject({ partnerId: 'P-QUICKLINK', status: 'offered', cost: 220, staffId: undefined })
    const evs = Object.values(d.events).filter((e) => e.legId === L1).map((e) => e.type)
    expect(evs.slice(-2)).toEqual(['legWithdrawn', 'legOffered'])
    expect(Object.values(d.auditLog).some((a) => a.action === 'leg.reassign' && (a.after as { reason: string }).reason === 'slaRisk')).toBe(true)
    expect(Object.values(d.notifications).some((n) => n.audience.partnerId === 'P-QUICKLINK' && n.title === 'New job offered')).toBe(true)
    const ravi = slaRisks(d, now).find((r) => r.legId === 'JOB-000720-L1')!
    expect(ravi.risk).toBe(70)
  })

  it('ERP-08: only before pickup; not to an ineligible partner', () => {
    const d = buildSeed()
    expect(canReassign(d.legs['JOB-000706-L1'])).toBe(false)
    expect(reassignLeg(d, { legId: 'JOB-000706-L1', partnerId: 'P-DOORSTEP', reason: 'other', notify: { oldPartner: false, newPartner: false, customer: false } }, 'LS-SANJAY', now)).toBe(d)
    expect(reassignLeg(d, { legId: L1, partnerId: 'P-METRODASH', reason: 'capacity', notify: { oldPartner: false, newPartner: false, customer: false } }, 'LS-SANJAY', now)).toBe(d)
  })

  it('dismiss with a reason hides the suggestion for the day', () => {
    const d = dismissRisk(buildSeed(), L1, 'Ravi has a helper today', 'LS-SANJAY', now)
    expect(slaRisks(d, now).some((r) => r.legId === L1)).toBe(false)
    expect(dismissRisk(d, 'JOB-000720-L1', ' ', 'LS-SANJAY', now)).toBe(d)
  })

  it('ERP-07: pickup missed is auto-ticketed after the window (cause: partner capacity), once; reassign moves it on', () => {
    let d = raiseAutoTickets(buildSeed(), '2026-11-23T14:30:00+05:30')
    const t = Object.values(d.exceptions).find((x) => x.legId === L1 && x.type === 'pickupMissed')!
    expect(t).toMatchObject({ auto: true, aiCause: 'partnerCapacity', ownerPartnerId: 'P-SWIFTCITY', actionDueAt: '2026-11-23T16:00:00+05:30', customerConfirmed: false })
    expect(raiseAutoTickets(d, '2026-11-23T14:45:00+05:30')).toBe(d)
    d = reassignLeg(d, { legId: L1, partnerId: 'P-QUICKLINK', reason: 'capacity', notify: { oldPartner: true, newPartner: true, customer: true } }, 'LS-SANJAY', '2026-11-23T14:40:00+05:30')
    expect(d.exceptions[t.id]).toMatchObject({ status: 'inProgress', log: [expect.objectContaining({ action: 'reassigned', note: 'QuickLink Express' })] })
    // Close needs the customer's confirmation
    expect(closeTicket(d, t.id, 'Picked up by QuickLink', 'LS-SANJAY', now)).toBe(d)
    d = ticketAction(d, t.id, 'customerConfirmed', 'Ramesh confirmed by phone', 'LS-SANJAY', now)
    d = closeTicket(d, t.id, 'Picked up by QuickLink', 'LS-SANJAY', now)
    expect(d.exceptions[t.id]).toMatchObject({ status: 'resolved', closedBy: 'LS-SANJAY', customerConfirmed: true })
  })

  it('seed tickets: the NDR, delays and an expired e-way bill', () => {
    const types = Object.values(buildSeed().exceptions).filter((x) => x.status !== 'resolved').map((x) => x.type)
    expect(types).toContain('ndr')
    expect(types).toContain('delay')
    expect(types).toContain('ewbExpiry')
  })

  it('ERP-09 / ERP-10: SwiftCity 7 pickups late at 15:00; the pack covers 22-Nov', () => {
    const d = buildSeed()
    expect(pickupsBehind(d, '2026-11-23T15:00:00+05:30')[0]).toMatchObject({ partnerId: 'P-SWIFTCITY', due: 7, late: 7 })
    expect(pickupsBehind(d, now).every((p) => p.late === 0)).toBe(true)
    const pack = dailyPack(d, now)
    expect(pack).toMatchObject({ date: '2026-11-22', generatedAt: '2026-11-23T09:00:00+05:30' })
    expect(pack.best.length).toBe(5)
    expect(dailyPack(d, '2026-11-23T08:00:00+05:30').date).toBe('2026-11-21')
  })
})
