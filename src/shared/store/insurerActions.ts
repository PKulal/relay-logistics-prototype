/**
 * ERP-38 Insurer claims (source §11 Dept 10 insurer claims; §13 Insurance
 * API). SIMULATED insurance API: filing returns a claim number; the survey,
 * approval and payment are moved on by the claims officer in the demo.
 */
import { simulateUtr } from '@shared/sim/payment'
import type { DemoData, Id, InsurerClaim, IsoDateTime } from '@shared/types'
import { audit } from './erpActions'

export const POLICY = { insurer: 'Shield General Insurance', policyNo: 'GIT/2026/LGS/00417' }

/** Settled claims whose insurer share is not filed yet. */
export const fileableClaims = (data: DemoData) => Object.values(data.claims).filter((c) => (c.status === 'settled' || c.status === 'closed') && c.recovery.insurer > 0 && !c.recovery.insurerRef)

export function fileInsurerClaim(data: DemoData, claimIds: Id[], by: Id, at: IsoDateTime): { data: DemoData; id?: Id } {
  const claims = claimIds.map((id) => data.claims[id]).filter((c) => c && c.recovery.insurer > 0 && !c.recovery.insurerRef)
  if (!claims.length) return { data }
  const n = 88213 + Object.keys(data.insurerClaims).length
  let id = `INS-${n}`
  while (data.insurerClaims[id]) id = `INS-${Number(id.slice(4)) + 1}`
  const amount = claims.reduce((s, c) => s + c.recovery.insurer, 0)
  const ins: InsurerClaim = { id, claimIds: claims.map((c) => c.id), ...POLICY, amount, filedAt: at, filedBy: by, status: 'filed', log: [{ at, by, text: 'Filed through the insurance API' }] }
  const claimsNext = { ...data.claims }
  for (const c of claims) claimsNext[c.id] = { ...c, recovery: { ...c.recovery, insurerRef: id } }
  return { data: audit({ ...data, claims: claimsNext, insurerClaims: { ...data.insurerClaims, [id]: ins } }, { userId: by, app: 'erp', action: 'insurer.file', recordId: id, at, after: { amount, claims: ins.claimIds } }), id }
}

const NEXT: Record<InsurerClaim['status'], InsurerClaim['status'][]> = { filed: ['underSurvey', 'rejected'], underSurvey: ['approved', 'rejected'], approved: ['paid'], paid: [], rejected: [] }

/** Move the insurer claim on (survey → approved → paid with UTR, or rejected). */
export function advanceInsurerClaim(data: DemoData, id: Id, to: InsurerClaim['status'], note: string, by: Id, at: IsoDateTime, approvedAmount?: number): DemoData {
  const c = data.insurerClaims[id]
  if (!c || !NEXT[c.status].includes(to)) return data
  if (to === 'rejected' && !note.trim()) return data
  const amount = to === 'approved' ? Math.min(c.amount, approvedAmount && approvedAmount > 0 ? approvedAmount : c.amount) : c.approvedAmount
  const next: InsurerClaim = { ...c, status: to, approvedAmount: amount, utr: to === 'paid' ? simulateUtr(id, at.slice(0, 10)) : c.utr, log: [...c.log, { at, by, text: [to, note.trim()].filter(Boolean).join(': ') }] }
  return audit({ ...data, insurerClaims: { ...data.insurerClaims, [id]: next } }, { userId: by, app: 'erp', action: `insurer.${to}`, recordId: id, at, before: c.status, after: to })
}
