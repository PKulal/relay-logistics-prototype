/** Status chip tones for invoices, COD remittances, partner invoices and payouts. */
import type { MatchStatus } from '@shared/engines/payables'
import type { CodRemittance, Invoice, PartnerInvoice, Payout } from '@shared/types'
import type { Tone } from './tones'

export const INVOICE_TONE: Record<Invoice['status'], Tone> = { unpaid: 'warning', partlyPaid: 'warning', paid: 'success', overdue: 'danger' }
export const REMITTANCE_TONE: Record<CodRemittance['status'], Tone> = { pendingApproval: 'info', remitted: 'success', onHold: 'warning' }

export const MATCH_TONE: Record<MatchStatus, Tone> = { matched: 'success', partlyMatched: 'warning', disputed: 'danger' }
export const PARTNER_INVOICE_TONE: Record<PartnerInvoice['status'], Tone> = { submitted: 'warning', matched: 'info', disputed: 'danger', approved: 'info', paid: 'success' }
export const PAYOUT_TONE: Record<Payout['status'], Tone> = { scheduled: 'neutral', pendingApproval: 'info', approved: 'info', paid: 'success', onHold: 'warning' }
