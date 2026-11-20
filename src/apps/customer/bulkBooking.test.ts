import { buildSeed, DEMO_START } from '@data/seed'
import { checkRow, sampleRows, summary } from './bulkBooking'

describe('CP-15 bulk booking', () => {
  it('validates the sample: 2 errors (missing invoice value, unknown pincode), warnings for e-way bills', () => {
    const d = buildSeed()
    const rows = sampleRows().map((r, i) => checkRow(d, d.customers['C-SHARMA'], d.customerUsers['CU-PRIYA'], r, i, 'PL-OKHLA', '2026-11-24', DEMO_START))
    const s = summary(rows)
    expect(s.errors).toBe(2)
    expect(rows.find((r) => r.index === 4)?.issues).toContain('invoiceValue')
    expect(rows.find((r) => r.index === 6)?.issues).toContain('pincodeUnknown')
    expect(s.valid + s.warnings).toBe(8)
    expect(s.total).toBeGreaterThan(0)
  })
})
