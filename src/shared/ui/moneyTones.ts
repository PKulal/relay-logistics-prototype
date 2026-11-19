/** Status chip tones for invoices (CP-24, ERP-31) and COD remittances (CP-25, ERP-34). */
import type { CodRemittance, Invoice } from '@shared/types'
import type { Tone } from './tones'

export const INVOICE_TONE: Record<Invoice['status'], Tone> = { unpaid: 'warning', partlyPaid: 'warning', paid: 'success', overdue: 'danger' }
export const REMITTANCE_TONE: Record<CodRemittance['status'], Tone> = { pendingApproval: 'info', remitted: 'success', onHold: 'warning' }
