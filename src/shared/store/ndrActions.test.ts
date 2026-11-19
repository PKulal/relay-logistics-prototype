import { buildSeed, DEMO_START } from '@data/seed'
import { ndrsOf, nextWorkingDays, openNdr, rtoCharge } from '@shared/engines/ndr'
import type { DemoData } from '@shared/types'
import { startRun } from './deliveryActions'
import { autoReattempt, canReportNdr, reportNdr, respondNdr } from './ndrActions'

const now = DEMO_START
const LR = 'LGS-DEL-000776'
const LEG = 'JOB-000776-L5'

const fail = (d: DemoData, at: string) => reportNdr(d, { legId: LEG, staffId: 'FS-MANJU', reason: 'notAvailable', photo: 'p:Gate', calledAt: at }, at)

describe('NDR (source §5.1, §7 Step 10, §10 Step 3)', () => {
  it('working days skip Sunday; the seed NDR is open (Premises closed, attempt 1)', () => {
    expect(nextWorkingDays('2026-11-28')).toEqual(['2026-11-30', '2026-12-01', '2026-12-02'])
    const d = buildSeed()
    expect(openNdr(d, LR)).toMatchObject({ attempt: 1, reason: 'premisesClosed', note: 'Shutter down' })
  })

  it('PA-35 needs a location photo and a call in the last 15 minutes', () => {
    expect(canReportNdr({ photo: 'p', calledAt: '2026-11-23T09:50:00+05:30' }, now)).toBe(true)
    expect(canReportNdr({ photo: 'p', calledAt: '2026-11-23T09:40:00+05:30' }, now)).toBe(false)
    expect(canReportNdr({ photo: '', calledAt: now }, now)).toBe(false)
  })

  it('shipper reattempt → job window moves, ticket closes, back to the rider; a later consignee answer is ignored', () => {
    let d = respondNdr(buildSeed(), LR, { kind: 'reattempt', date: '2026-11-24', from: '11:00', to: '13:00', instructions: 'Call before arriving' }, 'CU-PRIYA', now)
    expect(d.legs[LEG]).toMatchObject({ status: 'assigned', window: { from: '2026-11-24T11:00:00+05:30', to: '2026-11-24T13:00:00+05:30' } })
    expect(d.shipments[LR].status).toBe('undelivered')
    expect(d.ndrs['NDR-000776-1']).toMatchObject({ customerChoice: 'reattempt', choiceBy: 'CU-PRIYA', newSlot: { date: '2026-11-24' }, instructions: 'Call before arriving' })
    expect(Object.values(d.exceptions).find((x) => x.shipmentId === LR && x.type === 'ndr')).toMatchObject({ status: 'resolved', customerConfirmed: true })
    expect(respondNdr(d, LR, { kind: 'rto' }, 'consignee', now)).toBe(d)
    // Manju starts the run again
    d = startRun(d, [LEG], 'FS-MANJU', '2026-11-24T10:30:00+05:30')
    expect(d.shipments[LR].status).toBe('outForDelivery')
  })

  it('attempts 2 and 3 fail → the third goes to RTO by itself, with the RTO charge on the invoice', () => {
    const base = buildSeed()
    const credit = base.customers['C-SHARMA'].creditUsed
    let d = respondNdr(base, LR, { kind: 'reattempt', date: '2026-11-24', from: '11:00', to: '13:00' }, 'CU-PRIYA', now)
    d = startRun(d, [LEG], 'FS-MANJU', '2026-11-24T10:30:00+05:30')
    d = fail(d, '2026-11-24T11:30:00+05:30')
    expect(openNdr(d, LR)).toMatchObject({ attempt: 2, reason: 'notAvailable' })
    expect(d.shipments[LR].status).toBe('undelivered')
    d = respondNdr(d, LR, { kind: 'changeSlot', date: '2026-11-25', from: '14:00', to: '16:00', address: 'Gate 2, Amargol', contact: '94480 99887' }, 'consignee', '2026-11-24T12:00:00+05:30')
    expect(ndrsOf(d, LR).at(-1)).toMatchObject({ customerChoice: 'changeSlot', choiceBy: 'consignee', updatedAddress: 'Gate 2, Amargol' })
    d = startRun(d, [LEG], 'FS-MANJU', '2026-11-25T13:30:00+05:30')
    d = fail(d, '2026-11-25T14:30:00+05:30')
    expect(d.shipments[LR].status).toBe('returnToOrigin')
    expect(ndrsOf(d, LR).at(-1)).toMatchObject({ attempt: 3, customerChoice: 'rto', choiceBy: 'system', rtoCharge: rtoCharge(d, LR) })
    expect(d.customers['C-SHARMA'].creditUsed).toBeCloseTo(credit + rtoCharge(d, LR), 2)
  })

  it('consignee chooses RTO; the shipper is told', () => {
    const d = respondNdr(buildSeed(), LR, { kind: 'rto' }, 'consignee', now)
    expect(d.shipments[LR].status).toBe('returnToOrigin')
    expect(Object.values(d.notifications).some((n) => n.audience.userId === 'CU-PRIYA' && n.title === 'The consignee answered the failed delivery')).toBe(true)
  })

  it('no response by the due time → reattempt next working day in the original window; generator NDRs are left alone', () => {
    const d = buildSeed()
    expect(autoReattempt(d, now)).toBe(d)
    const window = d.legs[LEG].window
    const next = autoReattempt(d, '2026-11-24T18:30:00+05:30')
    expect(next.ndrs['NDR-000776-1']).toMatchObject({ customerChoice: 'reattempt', choiceBy: 'system', newSlot: { date: '2026-11-25', from: window.from.slice(11, 16), to: window.to.slice(11, 16) } })
    const others = Object.values(next.shipments).filter((s) => s.status === 'undelivered' && s.id !== LR)
    expect(others.every((s) => !next.ndrs[`NDR-${s.id.slice(-6)}-1`]?.customerChoice)).toBe(true)
  })
})
