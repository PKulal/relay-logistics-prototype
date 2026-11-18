import { computeMargin } from './margin'

describe('margin (ERP spec §7.2)', () => {
  const hero = computeMargin({
    subtotal: 3074.8,
    legCosts: [250, 162, 1458, 162, 300],
    insurance: 180,
    riskBufferPct: 2,
    targetMarginPct: 15,
  })

  it('hero: legs ₹2,332 → gross ₹562.80 (18.3%)', () => {
    expect(hero.legTotal).toBe(2332)
    expect(hero.gross).toBe(562.8)
    expect(hero.grossPct).toBe(18.3)
  })

  it('hero: 2% risk buffer ₹61.50 → ₹501.30 (16.3%), above the 15% target', () => {
    expect(hero.buffer).toBe(61.5)
    expect(hero.net).toBe(501.3)
    expect(hero.netPct).toBe(16.3)
    expect(hero.belowTarget).toBe(false)
  })

  it('flags a shipment below target', () => {
    const r = computeMargin({ subtotal: 1000, legCosts: [900], insurance: 0, riskBufferPct: 2, targetMarginPct: 15 })
    expect(r.netPct).toBe(8)
    expect(r.belowTarget).toBe(true)
  })
})
