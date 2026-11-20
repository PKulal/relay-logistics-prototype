import { buildSeed, DEMO_START } from '@data/seed'
import en from '@shared/i18n/en.json'
import hi from '@shared/i18n/hi.json'
import { answer, detectLang, findLr, type AssistantCtx } from './assistant'

const now = DEMO_START
const d = buildSeed()
const priya: AssistantCtx = { app: 'customer', userId: 'CU-PRIYA', role: 'admin', customerId: 'C-SHARMA' }
const vikram: AssistantCtx = { app: 'partnerPortal', userId: 'PU-VIKRAM', role: 'admin', partnerId: 'P-SWIFTCITY' }
const ravi: AssistantCtx = { app: 'partnerApp', userId: 'FS-RAVI', role: 'rider', partnerId: 'P-SWIFTCITY' }
const erp: AssistantCtx = { app: 'erp', userId: 'LS-ADMIN', role: 'superAdmin' }
const ask = (q: string, ctx: AssistantCtx) => answer(d, q, ctx, now, 'en')

describe('language and LR', () => {
  it('Hindi script or Hinglish answers in Hindi', () => {
    expect(detectLang('LR 790 kahan hai?', 'en')).toBe('hi')
    expect(detectLang('मेरा पेआउट कब आएगा', 'en')).toBe('hi')
    expect(detectLang('Where is LR 790?', 'en')).toBe('en')
  })
  it('finds an LR by its serial, only among the asker’s shipments', () => {
    expect(findLr(d, 'where is lr 790', (s) => s.customerId === 'C-SHARMA')?.id).toBe('LGS-DEL-000790')
    expect(findLr(d, 'where is lr 790', (s) => s.customerId === 'C-KAVERI')).toBeUndefined()
  })
})

describe('Customer (CP-35)', () => {
  it('tracks an LR in English and Hinglish', () => {
    const r = ask('Where is LR 790?', priya)
    expect(r).toMatchObject({ intent: 'track', recordId: 'LGS-DEL-000790', lang: 'en' })
    expect(ask('LR 790 kahan hai?', priya)).toMatchObject({ intent: 'track', lang: 'hi' })
  })
  it('reschedule finds the open failed delivery (000776) and prepares a slot picker', () => {
    const r = ask('Reschedule my failed delivery', priya)
    expect(r).toMatchObject({ intent: 'reschedule', recordId: 'LGS-DEL-000776', prepares: true })
    expect(r.cards?.[0]).toMatchObject({ kind: 'slots', lr: 'LGS-DEL-000776' })
    expect(ask('LR 776 dobara bhejo', priya).intent).toBe('reschedule')
  })
  it('claim, invoices and roles; the AI never pays', () => {
    expect(ask('raise a damage claim', priya).intent).toBe('claim')
    expect(ask('show my invoices', priya)).toMatchObject({ intent: 'invoice', key: 'ai.c.invoices' })
    expect(ask('show my invoices', { ...priya, role: 'dispatch', userId: 'CU-RAMESH' }).key).toBe('ai.c.role')
    expect(ask('pay my invoice now', priya)).toMatchObject({ intent: 'pay', key: 'ai.c.pay' })
    expect(ask('COD remittance?', priya).intent).toBe('cod')
  })
})

describe('Partner Portal (PP-37)', () => {
  it('next payout ₹1,84,063 on 27-Nov; score; add rider; operations cannot see payouts', () => {
    expect(ask('Mera payout kab aayega?', vikram)).toMatchObject({ intent: 'payout', params: { date: '27-Nov-2026', amount: '₹1,84,063.00' }, lang: 'hi' })
    expect(ask('Why did my score drop?', vikram).intent).toBe('score')
    expect(ask('How do I add a rider?', vikram).intent).toBe('addRider')
    expect(ask('When is my next payout?', { ...vikram, role: 'operations', userId: 'PU-NEHA' }).key).toBe('ai.c.role')
    expect(ask('which documents are expiring', vikram)).toMatchObject({ intent: 'docs', key: 'ai.p.docs' })
  })
})

describe('Partner App (PA-11)', () => {
  it('scripted answers with steps; never completes a delivery or changes COD', () => {
    expect(ask('OTP नहीं आ रहा, क्या करूँ?', ravi)).toMatchObject({ intent: 'otp', lang: 'hi' })
    expect(ask('Customer not answering', ravi).intent).toBe('noAnswer')
    expect(ask('Label is torn', ravi).intent).toBe('labelTorn')
    expect(ask('Seal number wrong', ravi).intent).toBe('sealWrong')
    expect(ask('Scale not working', ravi).intent).toBe('scale')
    expect(ask('gaadi ka puncture ho gaya', ravi).intent).toBe('breakdown')
    expect(ask('mark it delivered for me', ravi)).toMatchObject({ intent: 'guard', key: 'ai.guard.field' })
    expect(ask('change the COD amount', ravi).intent).toBe('guard')
  })
})

describe('ERP', () => {
  it('lanes that lost money, at-risk, overdue, probation; refuses to pay', () => {
    expect(ask('Which lanes lost money last week?', erp).intent).toBe('lanes')
    expect(ask('show at-risk shipments', erp).intent).toBe('risk')
    expect(ask('overdue invoices', erp)).toMatchObject({ intent: 'overdue', key: 'ai.e.overdue' })
    expect(ask('partners on probation', erp).intent).toBe('probation')
    expect(ask('release the payout to SwiftCity', erp)).toMatchObject({ intent: 'guard', key: 'ai.guard.erp' })
    expect(ask('LGS-DEL-000790', erp)).toMatchObject({ intent: 'track', recordId: 'LGS-DEL-000790' })
  })
})

describe('suggestion chips route to their intent in English and Hindi', () => {
  const ctxs = { customer: priya, partnerPortal: vikram, partnerApp: ravi, erp } as const
  const expected: Record<string, Record<string, string>> = {
    customer: { track: 'track', reschedule: 'reschedule', claim: 'claim', invoice: 'invoice' },
    partnerPortal: { score: 'score', payout: 'payout', addRider: 'addRider', atRisk: 'atRisk' },
    partnerApp: { noAnswer: 'noAnswer', labelTorn: 'labelTorn', sealWrong: 'sealWrong', scale: 'scale' },
    erp: { lanes: 'lanes', risk: 'risk', overdue: 'overdue', probation: 'probation' },
  }
  for (const lang of ['en', 'hi'] as const) {
    it(lang, () => {
      const chips = (lang === 'en' ? en : hi).ai.chip as Record<string, Record<string, string>>
      for (const [app, map] of Object.entries(expected))
        for (const [chip, intent] of Object.entries(map)) expect([app, chip, answer(d, chips[app][chip], ctxs[app as keyof typeof ctxs], now, lang).intent]).toEqual([app, chip, intent])
    })
  }
})
