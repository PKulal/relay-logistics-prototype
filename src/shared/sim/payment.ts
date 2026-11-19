/**
 * SIMULATED payment gateway, NIC e-invoice and bank references (source §12:
 * Razorpay / PayU, GST e-invoice API). Deterministic from the record id so the
 * demo is repeatable; swap for the real services later.
 */
const hash = (s: string) => {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return h
}
const hex = (s: string, n: number) => {
  let out = ''
  for (let i = 0; out.length < n; i++) out += hash(`${s}:${i}`).toString(16).padStart(8, '0')
  return out.slice(0, n)
}
const digits = (s: string, n: number) => {
  let out = ''
  for (let i = 0; out.length < n; i++) out += String(hash(`${s}#${i}`)).padStart(10, '0')
  return out.slice(0, n)
}

export type PayMethod = 'upi' | 'netBanking' | 'card'
export const PAY_METHODS: PayMethod[] = ['upi', 'netBanking', 'card']

/** SIMULATED gateway payment id shown on receipts and wallet entries. */
export function simulatePaymentRef(method: PayMethod, seed: string): string {
  if (method === 'upi') return `UPI ${digits(seed, 12)}`
  return `pay_${hex(seed, 14)}`
}

/** SIMULATED IRN from the NIC e-invoice portal. */
export const simulateIrn = (invoiceId: string) => `IRN-${hex(invoiceId, 16)}`

/** SIMULATED bank UTR for a NEFT / RTGS payment out of the nodal account. */
export const simulateUtr = (id: string, date: string) => `HDFCN5${date.replaceAll('-', '')}${digits(id, 5)}`

/** SIMULATED UPI reference when the consignee pays COD by UPI (PA-34). */
export const simulateUpiRef = (lr: string, at: string) => digits(`${lr}@${at}`, 12)
