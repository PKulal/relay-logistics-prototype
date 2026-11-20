import { buildSeed, DEMO_START } from '@data/seed'
import { churnRisk, contractsExpiring, dailyBriefing, ewbMonitor, liveTiles, ndrFollowUps, periodStart, proposalDraft, scenario, ticketPriority, upsell } from '@shared/engines/departments'
import { closeDpdpRequest, createRfq, draftProposal, logAccountNote, replyTicket, scheduleQbr, setRfqStatus } from './departmentActions'

const now = DEMO_START

describe('departments engine', () => {
  it('ERP-04: periods, live tiles, scenario (fuel +5% → −0.8 pt)', () => {
    const d = buildSeed()
    expect([periodStart('today', now), periodStart('mtd', now), periodStart('qtd', now)]).toEqual(['2026-11-23', '2026-11-01', '2026-10-01'])
    const live = liveTiles(d, 'mtd', now)
    expect(live.booked).toBeGreaterThan(0)
    expect(live.receivables).toBe(551800) // Sharma ₹2,41,800 + Triveni ₹3,10,000
    expect(scenario({ revenue: 19200000, marginPct: 17.6 }, { volumePct: 0, fuelPct: 5, partnerCostPct: 0 })).toMatchObject({ marginPct: 16.8, deltaPts: -0.8 })
    expect(scenario({ revenue: 19200000, marginPct: 17.6 }, { volumePct: 10, fuelPct: 0, partnerCostPct: 0 })).toMatchObject({ revenue: 21120000, marginPct: 17.6 })
  })

  it('daily briefing names the overdue account and the COD held longest', () => {
    const b = dailyBriefing(buildSeed(), now)
    expect(b).toContainEqual({ kind: 'overdue', customer: 'Triveni Auto', amount: 310000, days: 38 })
    expect(b.find((x) => x.kind === 'codLate')).toMatchObject({ partner: 'MetroDash', amount: 3150 })
    expect(b.length).toBeLessThanOrEqual(7)
  })

  it('accounts: Triveni is high churn risk (overdue, low NPS); upsell offers lanes the network serves', () => {
    const d = buildSeed()
    expect(churnRisk(d, 'C-TRIVENI', now)).toMatchObject({ level: 'high', reasons: expect.arrayContaining(['overdue', 'lowNps']) })
    expect(upsell(d, 'C-KAVERI')).toContainEqual({ kind: 'lane', origin: 'Bengaluru', dest: 'Mumbai' })
  })

  it('ticket triage, NDR follow-up, RFQ draft, e-way bills and contract expiries', () => {
    const d = buildSeed()
    expect(ticketPriority(d, d.tickets['TKT-2026-3381'], now)).toBe('high')
    expect(ticketPriority(d, d.tickets['TKT-2026-3368'], now)).toBe('low')
    expect(Array.isArray(ndrFollowUps(d, now))).toBe(true)
    const draft = proposalDraft(d, d.rfqs['RFQ-2026-011'])
    expect(draft.lines[0]).toMatchObject({ laneId: 'LN-DEL-HBL', transitDays: 5 })
    expect(draft.lines[0].perKg).toBeGreaterThan(0)
    expect(ewbMonitor(d, now).every((e, i, a) => i === 0 || a[i - 1].hoursLeft <= e.hoursLeft)).toBe(true)
    expect(contractsExpiring(d, now).map((c) => c.id)).toEqual(['CT-1', 'CT-2', 'CT-3', 'CT-4'])
  })
})

describe('department actions', () => {
  it('QBR and notes; RFQ create → pricing → submitted → lost needs a reason; AI draft', () => {
    let d = buildSeed()
    expect(scheduleQbr(d, 'C-SHARMA', '2026-11-01', 'x', 'LS-ARJUN', now)).toBe(d) // in the past
    d = scheduleQbr(d, 'C-SHARMA', '2026-12-10', 'Q3 review and Mumbai lane', 'LS-ARJUN', now)
    d = logAccountNote(d, 'C-SHARMA', 'Priya asked for a Mumbai quote', 'LS-ARJUN', now)
    expect(Object.values(d.qbrs).some((q) => q.date === '2026-12-10')).toBe(true)
    expect(Object.keys(d.accountNotes)).toHaveLength(1)
    const r = createRfq(d, { prospect: 'Orbit Pumps', title: 'Pune dealers', dueDate: '2026-12-12', lanes: [{ origin: 'Delhi NCR', dest: 'Pune', monthlyShipments: 60, service: 'standardPtl' }] }, 'LS-ARJUN', now)
    expect(r.id).toBe('RFQ-2026-015')
    d = r.data
    expect(setRfqStatus(d, r.id!, 'won', '', 'LS-ARJUN', now)).toBe(d)
    d = setRfqStatus(d, r.id!, 'pricing', '', 'LS-ARJUN', now)
    d = draftProposal(d, r.id!, 'LS-ARJUN', now)
    d = setRfqStatus(d, r.id!, 'submitted', '', 'LS-ARJUN', now)
    expect(setRfqStatus(d, r.id!, 'lost', ' ', 'LS-ARJUN', now)).toBe(d)
    d = setRfqStatus(d, r.id!, 'lost', 'Lost on price', 'LS-ARJUN', now)
    expect(d.rfqs[r.id!]).toMatchObject({ status: 'lost', proposalAt: now })
  })

  it('ticket reply resolves and notifies the customer; DPDP request closes', () => {
    let d = buildSeed()
    d = replyTicket(d, 'TKT-2026-3381', 'Rider reassigned; pickup by 12:00', true, 'LS-FARAH', now)
    expect(d.tickets['TKT-2026-3381']).toMatchObject({ status: 'resolved', ownerId: 'LS-FARAH' })
    expect(Object.values(d.notifications).some((n) => n.audience.customerId === 'C-SHARMA' && n.title === 'Ticket TKT-2026-3381 resolved')).toBe(true)
    d = closeDpdpRequest(d, 'DPR-0004', 'LS-NEETA', now)
    expect(d.dpdpRequests['DPR-0004']).toMatchObject({ status: 'done', doneBy: 'LS-NEETA' })
  })
})
