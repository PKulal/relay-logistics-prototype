/**
 * Partner money actions (source §9): self-billing, partner invoice upload and
 * the 3-way match (PP-26), the dispute desk with its 48-hour SLA (ERP-32),
 * payout batches with maker-checker and early pay (PP-27, ERP-33), and the
 * partner office's COD deposit to Logisco (PP-28). AI never pays on its own
 * (source §12): every payout needs a person to release it.
 */
import { batchPreview, disputeDue, earlyPayAvailable, isSelfBilling, matchLine, selfBillingPreview, selfBillNo, statusAfterLines, tiersDue, unbilledLegs } from '@shared/engines/payables'
import { round2 } from '@shared/engines/money'
import { istDate } from '@shared/lib/time'
import { simulateUtr } from '@shared/sim/payment'
import type { DemoData, Id, IsoDate, IsoDateTime, Notification, PartnerInvoice, Payout, PayoutBatch } from '@shared/types'
import { audit } from './erpActions'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const toPartner = (partnerId: Id) => ({ app: 'partnerPortal' as const, partnerId })
const toFinance = { app: 'erp' as const, role: 'finance' }
const setInvoice = (data: DemoData, inv: PartnerInvoice): DemoData => ({ ...data, partnerInvoices: { ...data.partnerInvoices, [inv.id]: inv } })
const gstOf = (data: DemoData, taxable: number) => round2((taxable * data.settings.gstPct) / 100)

// ── PP-26 / ERP-32 invoices ─────────────────────────────────────────────────

/** ERP-32: Logisco generates self-billed invoices for the finished cycle from completed legs (source §9). */
export function runSelfBilling(data: DemoData, cycle: string, by: Id, at: IsoDateTime): { data: DemoData; ids: Id[] } {
  const lines = selfBillingPreview(data, at).filter((l) => l.cycle === cycle)
  let next = data
  const ids: Id[] = []
  for (const l of lines) {
    const id = selfBillNo(next, l.partnerId)
    const matched = l.legIds.map((legId) => matchLine(data, legId))
    const taxable = round2(matched.reduce((s, x) => s + x.billed, 0))
    const inv: PartnerInvoice = { id, partnerId: l.partnerId, cycle, date: istDate(at), mode: 'selfBilled', lines: matched, taxable, gst: gstOf(data, taxable), total: round2(taxable + gstOf(data, taxable)), status: 'submitted', createdBy: by, createdAt: at }
    next = setInvoice(next, { ...inv, status: statusAfterLines(inv) })
    next = notify(next, toPartner(l.partnerId), `Self-billed invoice ${id}`, `${l.legIds.length} legs · ₹${inv.total}`, '/partner/finance/invoices', at)
    ids.push(id)
  }
  if (ids.length) next = audit(next, { userId: by, app: 'erp', action: 'Self-billing run', recordId: cycle, at, after: { invoices: ids } })
  return { data: next, ids }
}

export interface UploadInvoice {
  no: string
  date: IsoDate
  /** Before GST; must equal the line file */
  amount: number
  pdf: string
  lineFile: string
  lines: { legId: Id; billedWeight: number }[]
}

/** PP-26 upload (partners not on self-billing): each line is matched on arrival. */
export function uploadPartnerInvoice(data: DemoData, partnerId: Id, x: UploadInvoice, by: Id, at: IsoDateTime): { data: DemoData; id?: Id } {
  const no = x.no.trim()
  const open = new Set(unbilledLegs(data, partnerId).map((l) => l.id))
  if (isSelfBilling(data, partnerId) || !no || data.partnerInvoices[no] || !x.pdf || !x.lineFile || !x.lines.length || x.lines.some((l) => !open.has(l.legId) || !(l.billedWeight > 0))) return { data }
  const lines = x.lines.map((l) => matchLine(data, l.legId, l.billedWeight))
  const taxable = round2(lines.reduce((s, l) => s + l.billed, 0))
  if (round2(x.amount) !== taxable) return { data }
  const inv: PartnerInvoice = { id: no, partnerId, cycle: cycleLabel(data, lines.map((l) => l.legId)), date: x.date, mode: 'uploaded', lines, taxable, gst: gstOf(data, taxable), total: round2(taxable + gstOf(data, taxable)), status: 'submitted', pdf: x.pdf, lineFile: x.lineFile, createdBy: by, createdAt: at }
  const final = { ...inv, status: statusAfterLines(inv) }
  let next = setInvoice(data, final)
  const mismatches = lines.filter((l) => l.result === 'mismatch').length
  next = notify(next, toFinance, `Partner invoice ${no}`, `${data.partners[partnerId].shortName} · ₹${final.total}${mismatches ? ` · ${mismatches} mismatch` : ''}`, `/erp/finance/payables?invoice=${encodeURIComponent(no)}`, at)
  return { data: audit(next, { userId: by, app: 'partnerPortal', action: 'Partner invoice uploaded', recordId: no, at, after: { taxable, mismatches } }), id: no }
}

/** First and last day the legs on the invoice were completed. */
function cycleLabel(data: DemoData, legIds: Id[]): string {
  const days = Object.values(data.events)
    .filter((e) => e.legId && legIds.includes(e.legId))
    .map((e) => istDate(e.at))
    .sort()
  return `${days[0]}/${days.at(-1)}`
}

const updateLine = (data: DemoData, invoiceId: Id, legId: Id, f: (l: PartnerInvoice['lines'][number]) => PartnerInvoice['lines'][number] | undefined): DemoData | undefined => {
  const inv = data.partnerInvoices[invoiceId]
  const line = inv?.lines.find((l) => l.legId === legId)
  if (!inv || !line || inv.status === 'approved' || inv.status === 'paid') return undefined
  const changed = f(line)
  if (!changed) return undefined
  const lines = inv.lines.map((l) => (l.legId === legId ? changed : l))
  return setInvoice(data, { ...inv, lines, status: statusAfterLines({ ...inv, lines }) })
}

/** PP-26 "Accept matched amount": the line closes at the matched value. */
export function acceptMatchedLine(data: DemoData, invoiceId: Id, legId: Id, by: Id, at: IsoDateTime): DemoData {
  const next = updateLine(data, invoiceId, legId, (l) => (l.result === 'mismatch' && l.final === undefined && !l.dispute ? { ...l, partner: 'accepted', final: l.matched } : undefined))
  return next ? audit(next, { userId: by, app: 'partnerPortal', action: 'Matched amount accepted', recordId: `${invoiceId} · ${legId}`, at }) : data
}

/** PP-26 "Dispute line": reason and evidence → Logisco dispute desk (48-hour SLA). */
export function disputeLine(data: DemoData, invoiceId: Id, legId: Id, reason: string, files: string[], by: Id, at: IsoDateTime): DemoData {
  if (!reason.trim()) return data
  const next = updateLine(data, invoiceId, legId, (l) => (l.result === 'mismatch' && l.final === undefined && !l.dispute ? { ...l, partner: 'disputed', dispute: { reason: reason.trim(), files, at, by, dueAt: disputeDue(at) } } : undefined))
  if (!next) return data
  const inv = data.partnerInvoices[invoiceId]
  return notify(next, toFinance, 'Partner dispute (48 h)', `${inv.id} · ${legId} · ${data.partners[inv.partnerId].shortName}`, `/erp/finance/payables?invoice=${encodeURIComponent(invoiceId)}`, at)
}

/** ERP-32 decision: pay matched, pay billed, or a partial amount in between. The partner sees the outcome. */
export function resolveDispute(data: DemoData, invoiceId: Id, legId: Id, x: { decision: 'matched' | 'billed' | 'partial'; amount?: number; note: string }, by: Id, at: IsoDateTime): DemoData {
  const next = updateLine(data, invoiceId, legId, (l) => {
    if (!l.dispute || l.dispute.decision) return undefined
    const lo = Math.min(l.matched, l.billed)
    const hi = Math.max(l.matched, l.billed)
    const final = x.decision === 'matched' ? l.matched : x.decision === 'billed' ? l.billed : x.amount
    if (final === undefined || final < lo || final > hi || (x.decision === 'partial' && !x.note.trim())) return undefined
    return { ...l, final: round2(final), dispute: { ...l.dispute, decision: x.decision, amount: round2(final), note: x.note.trim() || undefined, decidedBy: by, decidedAt: at } }
  })
  if (!next) return data
  const inv = data.partnerInvoices[invoiceId]
  const line = next.partnerInvoices[invoiceId].lines.find((l) => l.legId === legId)!
  return audit(notify(next, toPartner(inv.partnerId), 'Dispute decided', `${invoiceId} · ${legId} · ₹${line.final}`, '/partner/finance/invoices', at), { userId: by, app: 'erp', action: 'Partner dispute resolved', recordId: `${invoiceId} · ${legId}`, at, after: { decision: x.decision, final: line.final } })
}

/** ERP-32 "Approve for payout": every line closed → the invoice goes into the partner's next batch. */
export function approvePartnerInvoice(data: DemoData, invoiceId: Id, by: Id, at: IsoDateTime): DemoData {
  const inv = data.partnerInvoices[invoiceId]
  if (!inv || inv.status !== 'matched') return data
  const next = setInvoice(data, { ...inv, status: 'approved', approvedBy: by, approvedAt: at })
  return audit(notify(next, toPartner(inv.partnerId), 'Invoice approved for payout', invoiceId, '/partner/finance/payouts', at), { userId: by, app: 'erp', action: 'Partner invoice approved', recordId: invoiceId, at })
}

// ── ERP-33 payout batches ───────────────────────────────────────────────────

const batchId = (date: IsoDate) => `PB-${date.slice(0, 4)}-${date.slice(5, 7)}${date.slice(8)}`
const nextPayoutNo = (data: DemoData, offset: number) => {
  const max = Math.max(0, ...Object.keys(data.payouts).map((k) => (/^PO-2026-\d{4}$/.test(k) ? Number(k.slice(-4)) : 0)))
  return `PO-2026-${String(max + 1 + offset).padStart(4, '0')}`
}

/** Maker: freeze the batch for the date and send it for approval. */
export function submitPayoutBatch(data: DemoData, date: IsoDate, by: Id, at: IsoDateTime): { data: DemoData; id?: Id } {
  const id = batchId(date)
  // A partner whose deductions exceed the earnings is carried forward to the next batch
  const lines = batchPreview(data, date).filter((l) => l.net > 0)
  if (data.payoutBatches[id] || !lines.length) return { data }
  const payouts = { ...data.payouts }
  const ids: Id[] = []
  lines.forEach((l, n) => {
    const pid = l.scheduledId ?? nextPayoutNo(data, n)
    payouts[pid] = { id: pid, batchId: id, partnerId: l.partnerId, kind: 'cycle', invoiceIds: l.invoiceIds, gross: l.gross, deductions: l.deductions, net: l.net, dueDate: date, mode: 'NEFT', status: 'pendingApproval' }
    ids.push(pid)
  })
  const batch: PayoutBatch = { id, date, tiers: tiersDue(date), payoutIds: ids, status: 'pendingApproval', makerId: by, submittedAt: at }
  let next: DemoData = { ...data, payouts, payoutBatches: { ...data.payoutBatches, [id]: batch } }
  const total = round2(lines.reduce((s, l) => s + l.net, 0))
  next = notify(next, { app: 'erp', role: 'leadership' }, 'Payout batch to approve', `${id} · ${lines.length} partners · ₹${total}`, '/erp/finance/payouts', at)
  return { data: audit(next, { userId: by, app: 'erp', action: 'Payout batch submitted', recordId: id, at, after: { partners: lines.length, total } }), id }
}

/**
 * Approver (not the maker): release → SIMULATED NEFT file and UTRs. Invoices
 * are paid; claim recoveries and COD shortages are marked deducted; early pay
 * is set off; partners are told.
 */
export function releasePayoutBatch(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const b = data.payoutBatches[id]
  if (!b || b.status !== 'pendingApproval' || b.makerId === by) return data
  const payouts = { ...data.payouts }
  const invoices = { ...data.partnerInvoices }
  const claims = { ...data.claims }
  const codRecords = { ...data.codRecords }
  let next = data
  for (const pid of b.payoutIds) {
    const p = payouts[pid]
    payouts[pid] = { ...p, status: 'paid', utr: simulateUtr(pid, istDate(at)), paidAt: at }
    for (const iid of p.invoiceIds ?? []) invoices[iid] = { ...invoices[iid], status: 'paid' }
    for (const d of p.deductions) {
      if (d.kind === 'claim' && d.ref && claims[d.ref]?.partner) claims[d.ref] = { ...claims[d.ref], partner: { ...claims[d.ref].partner!, status: 'deducted', payoutDate: b.date } }
      if (d.kind === 'codShortage') for (const r of Object.values(codRecords)) if (r.partnerId === p.partnerId && r.shipmentId === d.ref && r.shortage) codRecords[r.id] = { ...r, shortage: { ...r.shortage, status: 'deducted' } }
      if (d.kind === 'earlyPay' && d.ref && payouts[d.ref]) payouts[d.ref] = { ...payouts[d.ref], settledInBatch: id }
    }
    next = notify(next, toPartner(p.partnerId), 'Payout released', `${pid} · ₹${p.net} · UTR ${payouts[pid].utr}`, '/partner/finance/payouts', at)
  }
  next = { ...next, payouts, partnerInvoices: invoices, claims, codRecords, payoutBatches: { ...next.payoutBatches, [id]: { ...b, status: 'released', checkerId: by, releasedAt: at } } }
  return audit(next, { userId: by, app: 'erp', action: 'Payout batch released', recordId: id, at, after: { payouts: b.payoutIds.length } })
}

// ── PP-27 early pay ─────────────────────────────────────────────────────────

/** Gold and Silver (source §5.3): up to the matched, unpaid amount, at a small fee. Waits for release in ERP-33. */
export function requestEarlyPay(data: DemoData, partnerId: Id, amount: number, by: Id, at: IsoDateTime): { data: DemoData; id?: Id } {
  if (!(amount > 0) || amount > earlyPayAvailable(data, partnerId)) return { data }
  const fee = round2((amount * data.settings.earlyPayFeePct) / 100)
  const n = Object.keys(data.payouts).filter((k) => k.startsWith('EP-')).length + 1
  const id = `EP-2026-${String(n).padStart(4, '0')}`
  const p: Payout = { id, partnerId, kind: 'earlyPay', gross: round2(amount), fee, deductions: [{ kind: 'earlyPay', reason: 'Early-pay fee', amount: fee }], net: round2(amount - fee), dueDate: istDate(at), mode: 'IMPS', requestedBy: by, status: 'pendingApproval' }
  let next: DemoData = { ...data, payouts: { ...data.payouts, [id]: p } }
  next = notify(next, { app: 'erp', role: 'leadership' }, 'Early-pay request', `${data.partners[partnerId].shortName} · ₹${amount}`, '/erp/finance/payouts', at)
  return { data: audit(next, { userId: by, app: 'partnerPortal', action: 'Early pay requested', recordId: id, at, after: { amount, fee } }), id }
}

/** Approver releases an early-pay request by IMPS (SIMULATED UTR). */
export function releaseEarlyPay(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const p = data.payouts[id]
  if (!p || p.kind !== 'earlyPay' || p.status !== 'pendingApproval') return data
  const paid: Payout = { ...p, status: 'paid', utr: simulateUtr(id, istDate(at)), paidAt: at }
  const next = notify({ ...data, payouts: { ...data.payouts, [id]: paid } }, toPartner(p.partnerId), 'Early pay released', `${id} · ₹${p.net} · UTR ${paid.utr}`, '/partner/finance/payouts', at)
  return audit(next, { userId: by, app: 'erp', action: 'Early pay released', recordId: id, at })
}

// ── PP-28 COD deposit to Logisco ────────────────────────────────────────────

export interface PartnerCodDeposit {
  method: 'bankTransfer' | 'cashSlip' | 'upi'
  amount: number
  ref: string
  recordIds: Id[]
}

/** The partner office deposits the cash its riders handed in; the amount must equal the LRs covered. */
export function recordPartnerCodDeposit(data: DemoData, partnerId: Id, x: PartnerCodDeposit, by: Id, at: IsoDateTime): DemoData {
  const recs = x.recordIds.map((id) => data.codRecords[id])
  if (!recs.length || !x.ref.trim() || recs.some((r) => !r || r.partnerId !== partnerId || r.status !== 'atOffice')) return data
  const total = round2(recs.reduce((s, r) => s + r.amount, 0))
  if (round2(x.amount) !== total) return data
  const codRecords = { ...data.codRecords }
  for (const r of recs) codRecords[r.id] = { ...r, status: 'deposited', depositedAt: at, partnerDeposit: { method: x.method, ref: x.ref.trim(), by, at } }
  const next = notify({ ...data, codRecords }, toFinance, 'COD deposited by partner', `${data.partners[partnerId].shortName} · ₹${total} · ${recs.length} LR`, '/erp/finance/cod', at)
  return audit(next, { userId: by, app: 'partnerPortal', action: 'COD deposited', recordId: x.ref.trim(), at, after: { total, records: recs.length } })
}
