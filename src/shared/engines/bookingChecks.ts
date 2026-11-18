/**
 * Booking checks — Customer Portal spec §7.4 and CP-13 business rules.
 * Returns everything that blocks a booking; an empty list means it can go ahead.
 * (Serviceability, lanes and services are checked by the quote engine.)
 */
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { Customer, DemoData, IsoDate, IsoDateTime, PaymentMode } from '@shared/types'

export type BookingBlock =
  | 'walletLow' // prepaid: wallet doesn't cover the total → Recharge (CP-23)
  | 'creditExceeded' // credit: total would exceed available credit → contact Finance
  | 'invoiceOverdue' // credit: an invoice is overdue beyond the grace period → contact Finance
  | 'codTooHigh' // COD amount above the invoice value
  | 'hsnRequired' // e-way bill needed but no HSN code
  | 'invoiceDateFuture' // invoice dated after today

export interface BookingCheckInput {
  total: number
  paymentMode: PaymentMode
  codAmount?: number
  invoiceValue: number
  invoiceDate: IsoDate
  ewbRequired: boolean
  hsn: string
}

export function bookingChecks(data: DemoData, customer: Customer, b: BookingCheckInput, now: IsoDateTime): BookingBlock[] {
  const blocks: BookingBlock[] = []
  const today = istDate(now)

  if (customer.billing === 'prepaid' && b.paymentMode === 'paid' && customer.walletBalance < b.total) blocks.push('walletLow')

  if (customer.billing === 'credit' && b.paymentMode === 'tbb') {
    if (customer.creditUsed + b.total > customer.creditLimit) blocks.push('creditExceeded')
  }
  if (customer.billing === 'credit') {
    const grace = data.settings.creditGraceDays
    const overdue = Object.values(data.invoices).some(
      (i) => i.customerId === customer.id && i.status !== 'paid' && addDaysToDate(i.dueDate, grace) < today,
    )
    if (overdue) blocks.push('invoiceOverdue')
  }

  if (b.paymentMode === 'cod' && (b.codAmount ?? 0) > b.invoiceValue) blocks.push('codTooHigh')
  if (b.ewbRequired && !/^\d{4,8}$/.test(b.hsn)) blocks.push('hsnRequired')
  if (b.invoiceDate > today) blocks.push('invoiceDateFuture')
  return blocks
}
