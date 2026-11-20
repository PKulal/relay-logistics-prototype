/**
 * End-to-end: the ERP spec §11.3 demo script, played through the store exactly
 * as the guided tour's "Do it for me" does. Each step checks the outcome the
 * script promises to the reviewer.
 */
import i18n from '@shared/i18n'
import { slaRisks } from '@shared/engines/controlTower'
import { computeMargin } from '@shared/engines/margin'
import { priceLine } from '@shared/engines/pricing'
import { dataTitle } from '@shared/i18n/dataText'
import { useDemoStore } from '@shared/store'
import { HERO, TOUR_STEPS } from './steps'

const get = useDemoStore.getState
const d = () => get().data
const step = (id: string) => {
  const s = TOUR_STEPS.find((x) => x.id === id)!
  expect(!s.needs || s.needs(d())).toBe(true)
  s.prepare?.(get)
  s.run?.(get)
  return s
}

describe('Demo script (ERP §11.3) end to end', () => {
  beforeAll(() => get().resetDemo())

  it('1. Priya books LGS-DEL-000781 for ₹3,628.26', () => {
    expect(step('book').done(d())).toBe(true)
    expect(d().shipments[HERO].price.total).toBe(3628.26)
  })

  it('2. the shipment has 5 legs and an 18.3% margin', () => {
    step('shipment360')
    const legs = Object.values(d().legs).filter((l) => l.shipmentId === HERO)
    expect(legs).toHaveLength(5)
    const s = d().shipments[HERO]
    const m = computeMargin({ subtotal: s.price.subtotal, legCosts: legs.map((l) => l.cost), insurance: priceLine(s.price, 'fov'), riskBufferPct: d().settings.riskBufferPct, targetMarginPct: d().settings.targetMarginPct })
    expect(m.grossPct).toBe(18.3)
  })

  it('3. SwiftCity assigns Ravi; Ravi picks up and hands over at NCR CrossDock', () => {
    const s = step('firstMile')
    expect(d().legs['JOB-000781-L1']).toMatchObject({ partnerId: 'P-SWIFTCITY', staffId: 'FS-RAVI' })
    expect(s.done(d())).toBe(true)
  })

  it('4. the line-haul halt puts the shipment on the at-risk list; the customer is told', () => {
    expect(step('halt').done(d())).toBe(true)
    expect(slaRisks(d(), get().demoNow, 100).some((r) => r.shipmentId === HERO)).toBe(true)
    expect(Object.values(d().notifications).some((n) => n.audience.app === 'customer' && n.title === `${HERO}: delay`)).toBe(true)
  })

  it('5. a missed pickup is reassigned to QuickLink and lands in its inbox', () => {
    expect(step('reassign').done(d())).toBe(true)
    expect(Object.values(d().notifications).some((n) => n.audience.partnerId === 'P-QUICKLINK' && n.title === 'New job offered')).toBe(true)
  })

  it('6. Manju delivers with OTP; the customer sees Delivered and the e-POD', () => {
    expect(step('deliver').done(d())).toBe(true)
    expect(Object.values(d().notifications).find((n) => n.title === `${HERO}: delivered`)?.body).toBe('e-POD: received by Mahesh Patil · GRN-HED-55120')
  })

  it('7. the seeded shortage claim is settled against Leg 2', () => {
    expect(step('claim').done(d())).toBe(true)
    expect(d().claims['CLM-2026-0151'].liablePartnerId).toBe('P-NCRXD')
  })

  it('8. Deccan’s ₹72 mismatch is resolved and the payout batch released with UTRs', () => {
    expect(step('payouts').done(d())).toBe(true)
    expect(d().partnerInvoices['DR/0099'].lines[0].final).toBe(450)
    expect(d().payouts['PO-SWC-2026-1127'].utr).toMatch(/^HDFCN/)
  })

  it('9. weekly scoring drops FastTrack to Probation and its case opens', () => {
    expect(step('scoring').done(d())).toBe(true)
  })

  it('10. leadership dashboard step needs nothing further; every notification raised has Hindi wording', () => {
    step('leadership')
    const hi = i18n.getFixedT('hi')
    const untranslated = [...new Set(Object.values(d().notifications).map((n) => n.title))].filter((t) => dataTitle(t, hi) === t && !/^JOB-/.test(t))
    expect(untranslated).toEqual([])
  })
})
