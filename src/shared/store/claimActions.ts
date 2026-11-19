/**
 * Claims (source §10 Step 4): the customer raises a claim with evidence
 * (CP-22); the claims desk investigates, decides and settles within 7 days
 * (ERP-36/37); the liable partner accepts, contests or claims on its insurance
 * (PP-22). AI never closes a claim; a person approves (§12).
 */
import { claimableShipments, claimCap, liableLeg, nextPayoutDate, REOPEN_DAYS } from '@shared/engines/claims'
import { addDaysToDate, addHours, istDate } from '@shared/lib/time'
import type { Claim, ClaimType, DemoData, Id, IsoDateTime, Notification } from '@shared/types'
import { audit } from './erpActions'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const setClaim = (data: DemoData, c: Claim): DemoData => ({ ...data, claims: { ...data.claims, [c.id]: c } })
const nextNo = (ids: string[], prefix: string, year: string) => `${prefix}-${year}-${String(Math.max(0, ...ids.map((k) => Number(/(\d+)$/.exec(k)?.[1] ?? 0))) + 1).padStart(4, '0')}`
const toCustomer = (c: Claim) => ({ app: 'customer' as const, customerId: c.customerId })
const toDesk = { app: 'erp' as const, role: 'claims' }

export interface RaiseClaim {
  lr: Id
  type: ClaimType
  pieceIds: Id[]
  amount: number
  description: string
  files: string[]
}

/** CP-22 Submit: status Submitted; the claim goes to the Logisco claims desk with the liability engine's result. */
export function raiseClaim(data: DemoData, x: RaiseClaim, by: Id, at: IsoDateTime): { data: DemoData; claimId?: Id } {
  const s = data.shipments[x.lr]
  if (!s || !claimableShipments(data, s.customerId, at).some((c) => c.id === s.id)) return { data }
  if (!x.pieceIds.length || x.amount <= 0 || x.amount > claimCap(data, s, x.pieceIds).max || !x.description.trim() || !x.files.length) return { data }
  const id = nextNo(Object.keys(data.claims), 'CLM', at.slice(0, 4))
  const l = liableLeg(data, s, x.type, x.pieceIds)
  const claim: Claim = {
    id,
    shipmentId: s.id,
    customerId: s.customerId,
    type: x.type,
    pieceIds: x.pieceIds,
    amountClaimed: x.amount,
    description: x.description.trim(),
    files: x.files,
    raisedBy: by,
    liableLegId: l?.legId,
    liablePartnerId: l?.partnerId,
    recovery: { partner: 0, insurer: 0 },
    raisedAt: at,
    settleBy: addDaysToDate(istDate(at), data.settings.claimSettlementDays),
    status: 'raised',
  }
  let next = notify(setClaim(data, claim), toDesk, 'New claim', `${id} · ${s.id} · ₹${x.amount}`, `/erp/claims/${id}`, at)
  next = audit(next, { userId: by, app: 'customer', action: 'claim.raised', recordId: id, at, after: { type: x.type, amount: x.amount } })
  return { data: next, claimId: id }
}

/** CP-22 Add information: more files or a reply to Logisco's query. */
export function addClaimInfo(data: DemoData, id: Id, text: string, files: string[], by: Id, at: IsoDateTime): DemoData {
  const c = data.claims[id]
  if (!c || c.status === 'closed' || (!text.trim() && !files.length)) return data
  const next = setClaim(data, { ...c, info: [...(c.info ?? []), { at, by, text: text.trim(), files }] })
  return notify(next, toDesk, 'Claim: more information', id, `/erp/claims/${id}`, at)
}

/** ERP-37: the claims desk starts investigating. */
export function startInvestigation(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.claims[id]
  if (!c || c.status !== 'raised') return data
  return audit(setClaim(data, { ...c, status: 'investigating' }), { userId: by, app: 'erp', action: 'claim.investigating', recordId: id, at })
}

export interface Settle {
  /** 0 = reject */
  amount: number
  reason: string
  method: 'creditNote' | 'bank'
  recovery: Claim['recovery']
}

/**
 * ERP-37 Approve settlement (approver): the customer is settled by credit note
 * or bank transfer (SIMULATED UTR) and the partner's share is scheduled as a
 * deduction from its next payout (PP-22). Rejecting needs a reason.
 */
export function settleClaim(data: DemoData, id: Id, x: Settle, by: Id, at: IsoDateTime): DemoData {
  const c = data.claims[id]
  if (!c || !['raised', 'investigating'].includes(c.status) || !x.reason.trim()) return data
  const s = data.shipments[c.shipmentId]
  if (x.amount < 0 || x.amount > claimCap(data, s, c.pieceIds).max) return data
  const decision = { amount: x.amount, reason: x.reason.trim(), by, at }
  if (x.amount === 0) {
    const next = notify(setClaim(data, { ...c, status: 'rejected', decision, amountApproved: 0 }), toCustomer(c), 'Claim rejected', `${id}: ${decision.reason}`, `/customer/claims/${id}`, at)
    return audit(next, { userId: by, app: 'erp', action: 'claim.rejected', recordId: id, at, after: decision })
  }
  const split = Math.round((x.recovery.partner + (x.recovery.partnerInsurer ?? 0) + x.recovery.insurer) * 100) / 100
  if (split !== x.amount) return data
  let next = data
  let ref: string
  let creditNoteId: Id | undefined
  if (x.method === 'creditNote') {
    creditNoteId = nextNo(Object.keys(data.creditNotes), 'CN', at.slice(0, 4))
    ref = creditNoteId
    next = { ...next, creditNotes: { ...next.creditNotes, [creditNoteId]: { id: creditNoteId, customerId: c.customerId, claimId: id, date: istDate(at), amount: x.amount, reason: `${c.type} claim ${id}` } } }
  } else {
    // SIMULATED bank transfer reference
    ref = `UTR${at.replace(/\D/g, '').slice(2, 12)}${id.slice(-4)}`
  }
  const partnerShare = x.recovery.partner > 0 && c.liablePartnerId
  const claim: Claim = {
    ...c,
    status: 'settled',
    amountApproved: x.amount,
    decision,
    recovery: x.recovery,
    creditNoteId,
    settlement: { method: x.method, ref, by, at },
    partner: partnerShare ? { status: 'notified', payoutDate: nextPayoutDate(next, c.liablePartnerId!, at) } : c.partner,
  }
  next = setClaim(next, claim)
  next = notify(next, toCustomer(c), x.amount < c.amountClaimed ? 'Claim partly approved and settled' : 'Claim approved and settled', `${id} · ₹${x.amount} · ${ref}`, `/customer/claims/${id}`, at)
  if (partnerShare) next = notify(next, { app: 'partnerPortal', partnerId: c.liablePartnerId! }, 'Claim attributed to your leg', `${id} · ₹${x.recovery.partner}`, `/partner/claims/${id}`, at)
  return audit(next, { userId: by, app: 'erp', action: 'claim.settled', recordId: id, at, after: { ...decision, method: x.method, ref, recovery: x.recovery } })
}

/** ERP-37 Request customer confirmation (the ticket closes only after it). */
export function requestClaimConfirmation(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.claims[id]
  if (!c || (c.status !== 'settled' && c.status !== 'rejected')) return data
  const next = notify(setClaim(data, { ...c, confirmationRequestedAt: at }), toCustomer(c), 'Please confirm your claim is resolved', id, `/customer/claims/${id}`, at)
  return audit(next, { userId: by, app: 'erp', action: 'claim.confirmationRequested', recordId: id, at })
}

/** CP-22 Confirm resolution: closes the claim. */
export function confirmClaim(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.claims[id]
  if (!c || (c.status !== 'settled' && c.status !== 'rejected')) return data
  return audit(setClaim(data, { ...c, status: 'closed', confirmedAt: at }), { userId: by, app: 'customer', action: 'claim.confirmed', recordId: id, at })
}

/** Reopen within 7 days of the decision (assumed). */
export const canReopen = (c: Claim, now: IsoDateTime) => (c.status === 'settled' || c.status === 'rejected' || c.status === 'closed') && !!c.decision && Date.parse(now) <= Date.parse(addHours(c.decision.at, REOPEN_DAYS * 24))

export function reopenClaim(data: DemoData, id: Id, reason: string, by: Id, at: IsoDateTime): DemoData {
  const c = data.claims[id]
  if (!c || !canReopen(c, at) || !reason.trim()) return data
  let next = setClaim(data, { ...c, status: 'investigating', reopenedAt: at, confirmedAt: undefined, info: [...(c.info ?? []), { at, by, text: reason.trim(), files: [] }] })
  next = notify(next, toDesk, 'Claim reopened', id, `/erp/claims/${id}`, at)
  return audit(next, { userId: by, app: 'customer', action: 'claim.reopened', recordId: id, at, after: reason })
}

export type PartnerClaimResponse = { kind: 'accept' } | { kind: 'contest'; reason: string; files: string[] } | { kind: 'insurance'; insurer: string; policy: string }

/** PP-22 response: accept (deduction scheduled), contest (back to the desk) or claim on its insurance (deduction held). */
export function respondToClaim(data: DemoData, id: Id, r: PartnerClaimResponse, by: Id, at: IsoDateTime): DemoData {
  const c = data.claims[id]
  if (!c?.partner || c.partner.status !== 'notified') return data
  if (r.kind === 'contest' && !r.reason.trim()) return data
  if (r.kind === 'insurance' && (!r.insurer.trim() || !r.policy.trim())) return data
  const status = r.kind === 'accept' ? 'accepted' : r.kind === 'contest' ? 'contested' : 'insuranceClaim'
  const partner = { ...c.partner, status, respondedAt: at, ...(r.kind === 'contest' && { reason: r.reason.trim(), files: r.files }), ...(r.kind === 'insurance' && { insurer: r.insurer.trim(), policy: r.policy.trim() }) } as const
  let next = setClaim(data, { ...c, partner })
  if (r.kind !== 'accept') next = notify(next, toDesk, r.kind === 'contest' ? 'Partner contests a claim' : 'Partner claims on its insurance', id, `/erp/claims/${id}`, at)
  return audit(next, { userId: by, app: 'partnerPortal', action: `claim.partner.${status}`, recordId: id, at, after: r })
}

/**
 * ERP-37 decision on a contest: upheld (deduction stands) or waived (Logisco's
 * insurer takes the partner's share). Insurance claims are marked recovered.
 */
export function decidePartnerClaim(data: DemoData, id: Id, d: 'upheld' | 'waived' | 'recoveredFromInsurer', note: string, by: Id, at: IsoDateTime): DemoData {
  const c = data.claims[id]
  if (!c?.partner) return data
  if (d === 'recoveredFromInsurer' ? c.partner.status !== 'insuranceClaim' : c.partner.status !== 'contested') return data
  const recovery = d === 'waived' ? { ...c.recovery, partner: 0, insurer: Math.round((c.recovery.insurer + c.recovery.partner) * 100) / 100 } : c.recovery
  const partner = d === 'recoveredFromInsurer' ? { ...c.partner, status: 'recoveredFromInsurer' as const } : { ...c.partner, status: 'decided' as const, decision: d }
  let next = setClaim(data, { ...c, recovery, partner })
  next = notify(next, { app: 'partnerPortal', partnerId: c.liablePartnerId! }, d === 'waived' ? 'Claim deduction waived' : d === 'upheld' ? 'Claim deduction confirmed' : 'Claim recovered from your insurer', `${id}${note.trim() ? ` · ${note.trim()}` : ''}`, `/partner/claims/${id}`, at)
  return audit(next, { userId: by, app: 'erp', action: `claim.partner.${d}`, recordId: id, at, after: note })
}
