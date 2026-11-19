/**
 * Charging a customer after booking (weight revision, RTO): a prepaid customer's
 * wallet is debited with an entry; a credit customer has it added to the
 * invoice (credit used goes up). Either way it counts towards this month's spend.
 */
import type { DemoData, Id, IsoDateTime } from '@shared/types'

const round2 = (n: number) => Math.round(n * 100) / 100

export function chargeCustomer(data: DemoData, customerId: Id, amount: number, ref: string, at: IsoDateTime): { data: DemoData; chargedTo: 'wallet' | 'invoice' } {
  const c = data.customers[customerId]
  const spend = round2(c.spendMonthToDate + amount)
  if (c.billing === 'prepaid') {
    const balanceAfter = round2(c.walletBalance - amount)
    const txnId = `WT-${String(Object.keys(data.walletTxns).length + 1).padStart(5, '0')}`
    return {
      data: {
        ...data,
        customers: { ...data.customers, [c.id]: { ...c, walletBalance: balanceAfter, spendMonthToDate: spend } },
        walletTxns: { ...data.walletTxns, [txnId]: { id: txnId, customerId: c.id, type: 'adjustment', ref, amount: -amount, balanceAfter, at } },
      },
      chargedTo: 'wallet',
    }
  }
  return { data: { ...data, customers: { ...data.customers, [c.id]: { ...c, creditUsed: round2(c.creditUsed + amount), spendMonthToDate: spend } } }, chargedTo: 'invoice' }
}
