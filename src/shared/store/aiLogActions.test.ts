import { buildSeed, DEMO_START } from '@data/seed'
import { acceptAi, logAi } from './aiLogActions'
import { saveSku } from './customerSettingsActions'

describe('AI decision log (ERP-43)', () => {
  it('the seeded weight revision on LGS-DEL-000784 is logged by the weight check', () => {
    const d = buildSeed()
    expect(Object.values(d.aiDecisions).find((x) => x.kind === 'weightCheck')).toMatchObject({ recordId: 'LGS-DEL-000784', model: 'weight-check-v1', flag: 'outsideTolerance' })
  })

  it('a flagged SKU is logged; a plausible one is not', () => {
    const d = buildSeed()
    const n = Object.keys(d.aiDecisions).length
    const ok = saveSku(d, 'C-SHARMA', { code: 'OK-1', description: 'Box', l: 30, b: 30, h: 30, weight: 8, hsn: '', unitValue: 0 }, undefined, 'CU-PRIYA', DEMO_START).data
    expect(Object.keys(ok.aiDecisions)).toHaveLength(n)
    const bad = saveSku(d, 'C-SHARMA', { code: 'BAD-1', description: 'Box', l: 100, b: 100, h: 100, weight: 1, hsn: '', unitValue: 0 }, undefined, 'CU-PRIYA', DEMO_START).data
    expect(Object.values(bad.aiDecisions).find((x) => x.kind === 'skuOutlier')).toMatchObject({ recordId: 'BAD-1', flag: 'density' })
  })

  it('assistant decisions are accepted once, by the person who confirmed', () => {
    const r = logAi(buildSeed(), { kind: 'assistant', app: 'customer', intent: 'reschedule', recordId: 'LGS-DEL-000776', at: DEMO_START, confidence: 0.92 })
    const a = acceptAi(r.data, r.id, 'CU-PRIYA')
    expect(a.aiDecisions[r.id]).toMatchObject({ model: 'assistant-v1', acceptedByUserId: 'CU-PRIYA' })
    expect(acceptAi(a, r.id, 'CU-RAMESH')).toBe(a)
  })
})
