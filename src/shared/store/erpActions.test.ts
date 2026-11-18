import { buildSeed, DEMO_START } from '@data/seed'
import { extendEwayBill, logMaskedCall, messageCustomer, updatePartB } from './erpActions'

const data = buildSeed()

describe('ERP one-click actions', () => {
  it('extends an e-way bill by a full validity period for the lane and logs it', () => {
    const s = data.shipments['LGS-DEL-000784'] // Delhi → Mumbai, 1,420 km → 8 days
    const next = extendEwayBill(data, s.id, 'LS-SANJAY', DEMO_START)
    expect(next.shipments[s.id].ewb!.validTill > s.ewb!.validTill).toBe(true)
    const entry = Object.values(next.auditLog).at(-1)!
    expect(entry).toMatchObject({ action: 'ewb.extend', recordId: s.id, userId: 'LS-SANJAY', before: s.ewb!.validTill })
  })

  it('updates Part B once', () => {
    const next = updatePartB(data, 'LGS-DEL-000784', 'LS-SANJAY', DEMO_START)
    expect(next.shipments['LGS-DEL-000784'].ewb!.partBUpdated).toBe(true)
    expect(updatePartB(next, 'LGS-DEL-000784', 'LS-SANJAY', DEMO_START)).toBe(next)
  })

  it('a customer message becomes a customer notification and an audit entry', () => {
    const next = messageCustomer(data, 'LGS-DEL-000784', 'delay', 'Your shipment is delayed by 3 hours.', 'LS-SANJAY', DEMO_START)
    const n = Object.values(next.notifications).at(-1)!
    expect(n).toMatchObject({ audience: { app: 'customer', customerId: 'C-SHARMA' }, body: 'Your shipment is delayed by 3 hours.', read: false })
    expect(Object.values(next.auditLog).at(-1)!.action).toBe('message.delay')
  })

  it('a masked call is only logged', () => {
    const next = logMaskedCall(data, 'LGS-DEL-000784', 'P-WESTLINE', 'LS-SANJAY', DEMO_START)
    expect(next.shipments).toBe(data.shipments)
    expect(Object.values(next.auditLog).at(-1)).toMatchObject({ action: 'call.partner', after: 'P-WESTLINE' })
  })
})
