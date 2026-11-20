/**
 * Partner money (source §5.1 Daily Reconciliation, §5.3 payout speed by tier,
 * §9 Partner Invoicing, 3-Way Match, Platform Pays Partner): which legs are
 * billed, the 3-way match per leg, payout batches by tier, early pay and the
 * partner's daily reconciliation. Pure functions over DemoData.
 */
import { addDaysToDate, addHours, istDate, minutesBetween } from '@shared/lib/time'
import type { DemoData, Id, IsoDate, IsoDateTime, Leg, PartnerInvoice, PartnerInvoiceLine, Payout, PayoutDeductionKind, Tier } from '@shared/types'
import { legCost } from './assignment'
import { round2 } from './money'

/** Legs completed before this date were settled in earlier payouts (the seeded payout history). */
export const BILLING_FROM: IsoDate = '2026-11-16'
/** Source §9: mismatches go to the dispute desk with a 48-hour SLA. */
export const DISPUTE_SLA_HOURS = 48
const DONE = new Set(['handedOver', 'delivered', 'closed'])

// ── Legs ────────────────────────────────────────────────────────────────────

/** When each leg's work finished: its last event. */
export function legDoneAt(data: DemoData): Map<Id, IsoDateTime> {
  const out = new Map<Id, IsoDateTime>()
  for (const e of Object.values(data.events)) if (e.legId && DONE.has(data.legs[e.legId]?.status) && (out.get(e.legId) ?? '') < e.at) out.set(e.legId, e.at)
  return out
}

export const verifiedKg = (data: DemoData, leg: Leg) => {
  const s = data.shipments[leg.shipmentId]
  return s.weights.verifiedChargeable ?? s.weights.chargeable
}

/** Rate card × verified weight (source §9 3-way match). */
export function matchedAmount(data: DemoData, leg: Leg, kg = verifiedKg(data, leg)): number {
  const rate = leg.rateLineId ? data.partnerRates[leg.rateLineId] : undefined
  return rate ? legCost(rate, kg, data.shipments[leg.shipmentId].pieces.length) : leg.cost
}

/** e-POD for the last mile, the hand-over scan for every other leg. */
export function hasPod(data: DemoData, leg: Leg): boolean {
  const next = data.shipments[leg.shipmentId].legIds[leg.seq]
  return Object.values(data.events).some((e) => (e.legId === leg.id && (e.type === 'delivered' || e.type === 'handoverGiven')) || (!!next && e.legId === next && e.type === 'handoverReceived'))
}

/** Logisco generates the partner's invoice unless the signed agreement opted out (source §9). */
export function isSelfBilling(data: DemoData, partnerId: Id): boolean {
  const app = Object.values(data.applications).find((a) => a.partnerId === partnerId && a.agreement?.signed)
  return app ? app.agreement!.signed!.selfBilling : true
}

/** Monday–Sunday payout cycle containing the date: "2026-11-16/2026-11-22". */
export function cycleOf(date: IsoDate): string {
  const dow = (new Date(`${date}T12:00:00+05:30`).getUTCDay() + 6) % 7
  const from = addDaysToDate(date, -dow)
  return `${from}/${addDaysToDate(from, 6)}`
}
const inCycle = (cycle: string, date: IsoDate) => {
  const [from, to] = cycle.split('/')
  return date >= from && date <= to
}

/** Legs already on an invoice: its lines, or for seeded invoices without lines, everything done in its cycle. */
function billedLegs(data: DemoData, partnerId: Id, done: Map<Id, IsoDateTime>): Set<Id> {
  const out = new Set<Id>()
  for (const inv of Object.values(data.partnerInvoices)) {
    if (inv.partnerId !== partnerId) continue
    if (inv.lines.length) inv.lines.forEach((l) => out.add(l.legId))
    else for (const [legId, at] of done) if (data.legs[legId].partnerId === partnerId && inCycle(inv.cycle, istDate(at))) out.add(legId)
  }
  return out
}

/** Completed, not yet invoiced legs of a partner (oldest first). */
export function unbilledLegs(data: DemoData, partnerId: Id): (Leg & { doneAt: IsoDateTime })[] {
  const done = legDoneAt(data)
  const billed = billedLegs(data, partnerId, done)
  return [...done.entries()]
    .filter(([id, at]) => data.legs[id].partnerId === partnerId && !billed.has(id) && istDate(at) >= BILLING_FROM)
    .map(([id, at]) => ({ ...data.legs[id], doneAt: at }))
    .sort((a, b) => a.doneAt.localeCompare(b.doneAt))
}

// ── 3-way match ─────────────────────────────────────────────────────────────

/** Match one leg. Without billed figures (self-billing) the partner is billed exactly the matched amount. */
export function matchLine(data: DemoData, legId: Id, billedWeight?: number): PartnerInvoiceLine {
  const leg = data.legs[legId]
  const rate = leg.rateLineId ? data.partnerRates[leg.rateLineId] : undefined
  const kg = verifiedKg(data, leg)
  const matched = matchedAmount(data, leg, kg)
  const billed = billedWeight === undefined ? matched : matchedAmount(data, leg, billedWeight)
  const pod = hasPod(data, leg)
  const reason = !pod ? 'noPod' : billedWeight !== undefined && billedWeight !== kg && billed !== matched ? 'weight' : billed !== matched ? 'amount' : undefined
  return {
    legId,
    rate: rate?.rate ?? leg.cost,
    unit: rate?.unit ?? 'perShipment',
    verifiedWeight: kg,
    billedWeight,
    billed,
    matched: pod ? matched : 0,
    pod,
    result: reason ? 'mismatch' : 'match',
    reason,
    final: reason ? undefined : matched,
  }
}

/** What Logisco pays on the invoice, GST included: closed lines at their final value, open ones at the matched value. */
export function invoicePayable(data: DemoData, inv: PartnerInvoice): number {
  if (!inv.lines.length) return inv.total
  const taxable = inv.lines.reduce((s, l) => s + (l.final ?? l.matched), 0)
  return round2(taxable * (1 + data.settings.gstPct / 100))
}

export type MatchStatus = 'matched' | 'partlyMatched' | 'disputed'
export function matchStatus(inv: PartnerInvoice): MatchStatus {
  if (inv.lines.some((l) => l.dispute && !l.dispute.decision)) return 'disputed'
  if (inv.lines.some((l) => l.result === 'mismatch')) return 'partlyMatched'
  return 'matched'
}

/** Status after a line changes: open mismatches wait for the partner, disputes for the desk. */
export function statusAfterLines(inv: PartnerInvoice): PartnerInvoice['status'] {
  if (inv.status === 'approved' || inv.status === 'paid') return inv.status
  if (inv.lines.some((l) => l.dispute && !l.dispute.decision)) return 'disputed'
  if (inv.lines.some((l) => l.final === undefined)) return 'submitted'
  return 'matched'
}

export interface OpenDispute {
  invoiceId: Id
  partnerId: Id
  line: PartnerInvoiceLine
  amount: number
  hoursLeft: number
}
/** ERP-32 dispute queue, most urgent first. */
export function openDisputes(data: DemoData, now: IsoDateTime): OpenDispute[] {
  return Object.values(data.partnerInvoices)
    .flatMap((inv) =>
      inv.lines
        .filter((l) => l.dispute && !l.dispute.decision)
        .map((l) => ({ invoiceId: inv.id, partnerId: inv.partnerId, line: l, amount: round2(l.billed - l.matched), hoursLeft: Math.floor(minutesBetween(now, l.dispute!.dueAt) / 60) })),
    )
    .sort((a, b) => a.hoursLeft - b.hoursLeft)
}
/** ERP-44 setting partnerDisputeSlaHours (48 h, source §9) */
export const disputeDue = (at: IsoDateTime, hours = DISPUTE_SLA_HOURS) => addHours(at, hours)

// ── Self-billing run (ERP-32) ───────────────────────────────────────────────

export interface SelfBillLine {
  partnerId: Id
  cycle: string
  legIds: Id[]
  taxable: number
  gst: number
  total: number
}

/** Finished cycles with unbilled legs of self-billing partners. */
export function selfBillingPreview(data: DemoData, now: IsoDateTime): SelfBillLine[] {
  const out: SelfBillLine[] = []
  const today = istDate(now)
  for (const p of Object.values(data.partners)) {
    if (!isSelfBilling(data, p.id)) continue
    const by = new Map<string, Id[]>()
    for (const l of unbilledLegs(data, p.id)) {
      const c = cycleOf(istDate(l.doneAt))
      // Only finished cycles are billed
      if (c.split('/')[1] >= today) continue
      by.set(c, [...(by.get(c) ?? []), l.id])
    }
    for (const [cycle, legIds] of by) {
      const taxable = round2(legIds.reduce((s, id) => s + matchedAmount(data, data.legs[id]), 0))
      const gst = round2((taxable * data.settings.gstPct) / 100)
      out.push({ partnerId: p.id, cycle, legIds, taxable, gst, total: round2(taxable + gst) })
    }
  }
  return out.sort((a, b) => a.cycle.localeCompare(b.cycle) || b.total - a.total)
}

/** Self-billed numbering: SB/<partner code>/25-26/<serial>, continuing the partner's existing series. */
export function selfBillNo(data: DemoData, partnerId: Id, offset = 0): string {
  const mine = Object.keys(data.partnerInvoices).filter((k) => k.startsWith('SB/') && data.partnerInvoices[k].partnerId === partnerId)
  const code = mine[0]?.split('/')[1] ?? partnerId.slice(2).replace(/[AEIOU]/g, '').slice(0, 3)
  const max = Math.max(0, ...mine.map((k) => Number(k.split('/').at(-1))))
  return `SB/${code}/25-26/${String(max + 1 + offset).padStart(3, '0')}`
}

// ── Payouts (PP-27, ERP-33) ─────────────────────────────────────────────────

const isFriday = (d: IsoDate) => new Date(`${d}T12:00:00+05:30`).getUTCDay() === 5
/** Bronze (and partners in trial or probation) are paid fortnightly: every other Friday from 04-Dec-2026. */
const bronzeFriday = (d: IsoDate) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse('2026-12-04T00:00:00Z')) / 86_400_000) % 14 === 0

/** Tiers paid in the batch on this date (source §5.3): Platinum every batch; Gold and Silver weekly; Bronze fortnightly. */
export function tiersDue(date: IsoDate): Tier[] {
  return ['platinum', 'gold', 'silver', ...(bronzeFriday(date) ? (['bronze', 'probation'] as Tier[]) : [])]
}
const tierOf = (data: DemoData, partnerId: Id): Tier => data.partners[partnerId]?.tier ?? 'bronze'

/** The next Friday batch on or after today. */
export function nextBatchDate(now: IsoDateTime): IsoDate {
  let d = istDate(now)
  while (!isFriday(d)) d = addDaysToDate(d, 1)
  return d
}

/** Next batch date that pays this partner's tier. */
export function partnerPayoutDate(data: DemoData, partnerId: Id, now: IsoDateTime): IsoDate {
  let d = nextBatchDate(now)
  while (!tiersDue(d).includes(tierOf(data, partnerId))) d = addDaysToDate(d, 7)
  return d
}

const inPayout = (data: DemoData) => {
  const ids = new Set<Id>()
  for (const p of Object.values(data.payouts)) if (p.kind !== 'earlyPay' && p.status !== 'scheduled') [...(p.invoiceIds ?? []), ...(p.invoiceId ? [p.invoiceId] : [])].forEach((i) => ids.add(i))
  return ids
}

export interface PayoutLine {
  partnerId: Id
  invoiceIds: Id[]
  gross: number
  deductions: { kind: PayoutDeductionKind; reason: string; amount: number; ref?: string }[]
  net: number
  /** Seeded scheduled payout this line replaces */
  scheduledId?: Id
}

/** What a partner is owed in a batch: approved invoices, less deductions with evidence. */
export function payoutLine(data: DemoData, partnerId: Id, date: IsoDate): PayoutLine | undefined {
  const taken = inPayout(data)
  const invoices = Object.values(data.partnerInvoices).filter((i) => i.partnerId === partnerId && i.status === 'approved' && !taken.has(i.id))
  const gross = round2(invoices.reduce((s, i) => s + invoicePayable(data, i), 0))
  const scheduled = Object.values(data.payouts).find((p) => p.partnerId === partnerId && p.status === 'scheduled')
  const deductions: PayoutLine['deductions'] = []
  for (const d of scheduled?.deductions ?? []) if ((d.kind ?? 'penalty') === 'penalty') deductions.push({ ...d, kind: 'penalty' })
  for (const c of Object.values(data.claims)) {
    const ps = c.partner
    const due = ps && (ps.status === 'notified' || ps.status === 'accepted' || (ps.status === 'decided' && ps.decision === 'upheld'))
    if (c.liablePartnerId === partnerId && due && (c.recovery?.partner ?? 0) > 0 && (ps!.payoutDate ?? date) <= date) deductions.push({ kind: 'claim', reason: `Claim ${c.id}`, amount: c.recovery!.partner, ref: c.id })
  }
  for (const r of Object.values(data.codRecords)) if (r.partnerId === partnerId && r.shortage?.status === 'raised') deductions.push({ kind: 'codShortage', reason: `COD shortage ${r.shipmentId}`, amount: r.shortage.amount, ref: r.shipmentId })
  for (const p of Object.values(data.payouts)) if (p.partnerId === partnerId && p.kind === 'earlyPay' && p.status === 'paid' && !p.settledInBatch) deductions.push({ kind: 'earlyPay', reason: `Early pay ${p.id}`, amount: p.gross, ref: p.id })
  if (!invoices.length && !deductions.length) return undefined
  const net = round2(gross - deductions.reduce((s, d) => s + d.amount, 0))
  return { partnerId, invoiceIds: invoices.map((i) => i.id), gross, deductions, net, scheduledId: scheduled?.id }
}

/** ERP-33: the batch for a date, partners of the tiers due. */
export function batchPreview(data: DemoData, date: IsoDate): PayoutLine[] {
  const tiers = tiersDue(date)
  return Object.values(data.partners)
    .filter((p) => tiers.includes(tierOf(data, p.id)))
    .map((p) => payoutLine(data, p.id, date))
    .filter((l): l is PayoutLine => !!l)
    .sort((a, b) => b.net - a.net)
}

/** PP-27 next payout: the frozen payout if the batch is submitted, else the live preview. */
export function nextPayout(data: DemoData, partnerId: Id, now: IsoDateTime): { date: IsoDate; line?: PayoutLine; payout?: Payout } {
  const pending = Object.values(data.payouts).find((p) => p.partnerId === partnerId && p.kind !== 'earlyPay' && (p.status === 'pendingApproval' || p.status === 'approved'))
  if (pending) return { date: pending.dueDate, payout: pending }
  const date = partnerPayoutDate(data, partnerId, now)
  return { date, line: payoutLine(data, partnerId, date) }
}

/** Early pay (Gold and Silver, source §5.3): matched, approved earnings not yet paid or advanced. */
export function earlyPayAvailable(data: DemoData, partnerId: Id): number {
  const tier = tierOf(data, partnerId)
  if (tier !== 'gold' && tier !== 'silver') return 0
  const taken = inPayout(data)
  const owed = Object.values(data.partnerInvoices)
    .filter((i) => i.partnerId === partnerId && i.status === 'approved' && !taken.has(i.id))
    .reduce((s, i) => s + invoicePayable(data, i), 0)
  const advanced = Object.values(data.payouts)
    .filter((p) => p.partnerId === partnerId && p.kind === 'earlyPay' && p.status !== 'onHold' && !p.settledInBatch)
    .reduce((s, p) => s + p.gross, 0)
  return round2(Math.max(0, owed - advanced))
}

// ── PP-25 daily reconciliation ──────────────────────────────────────────────

export type DayPayoutStatus = 'pendingMatch' | 'matched' | 'inBatch' | 'paid'
export interface DayRow {
  date: IsoDate
  legs: (Omit<Leg, 'status'> & { doneAt: IsoDateTime; earning: number; status: DayPayoutStatus; invoiceId?: Id })[]
  earnings: number
  deductions: { kind: PayoutDeductionKind; reason: string; amount: number; ref?: string }[]
  codCollected: number
  codDeposited: number
  net: number
  status: DayPayoutStatus
}

const ORDER: DayPayoutStatus[] = ['pendingMatch', 'matched', 'inBatch', 'paid']

/** Legs completed, earnings, deductions, COD and payout status per day, newest first. */
export function dailyReconciliation(data: DemoData, partnerId: Id, now: IsoDateTime, days = 7): DayRow[] {
  const today = istDate(now)
  const done = legDoneAt(data)
  const invoiceOf = new Map<Id, PartnerInvoice>()
  for (const inv of Object.values(data.partnerInvoices)) if (inv.partnerId === partnerId) for (const l of inv.lines) invoiceOf.set(l.legId, inv)
  const seeded = Object.values(data.partnerInvoices).filter((i) => i.partnerId === partnerId && !i.lines.length)
  const payoutStatus = (inv?: PartnerInvoice): DayPayoutStatus => {
    if (!inv) return 'pendingMatch'
    if (inv.status === 'paid') return 'paid'
    const p = Object.values(data.payouts).find((x) => x.kind !== 'earlyPay' && x.status !== 'scheduled' && ((x.invoiceIds ?? []).includes(inv.id) || x.invoiceId === inv.id))
    if (p) return p.status === 'paid' ? 'paid' : 'inBatch'
    return inv.status === 'approved' || inv.status === 'matched' ? 'matched' : 'pendingMatch'
  }
  const rows: DayRow[] = []
  for (let i = 0; i < days; i++) {
    const date = addDaysToDate(today, -i)
    const legs = [...done.entries()]
      .filter(([id, at]) => data.legs[id].partnerId === partnerId && istDate(at) === date)
      .map(([id, at]) => {
        const leg = data.legs[id]
        const inv = invoiceOf.get(id) ?? seeded.find((s) => inCycle(s.cycle, date))
        const line = inv?.lines.find((l) => l.legId === id)
        // Before billing started, the legs were paid in the seeded payout history
        const status = date < BILLING_FROM ? 'paid' : payoutStatus(inv)
        return { ...leg, doneAt: at, earning: line?.final ?? line?.matched ?? matchedAmount(data, leg), status, invoiceId: inv?.id }
      })
      .sort((a, b) => a.doneAt.localeCompare(b.doneAt))
    const deductions: DayRow['deductions'] = []
    for (const c of Object.values(data.claims))
      if (c.liablePartnerId === partnerId && c.settlement && istDate(c.settlement.at) === date && (c.recovery?.partner ?? 0) > 0) deductions.push({ kind: 'claim', reason: `Claim ${c.id}`, amount: c.recovery!.partner, ref: c.id })
    for (const r of Object.values(data.codRecords)) if (r.partnerId === partnerId && r.shortage && istDate(r.shortage.at) === date) deductions.push({ kind: 'codShortage', reason: `COD shortage ${r.shipmentId}`, amount: r.shortage.amount, ref: r.shipmentId })
    const cod = Object.values(data.codRecords).filter((r) => r.partnerId === partnerId)
    const codCollected = round2(cod.filter((r) => r.collectedAt && istDate(r.collectedAt) === date).reduce((s, r) => s + r.amount, 0))
    const codDeposited = round2(cod.filter((r) => r.depositedAt && (r.status === 'deposited' || r.status === 'remitted') && istDate(r.depositedAt) === date).reduce((s, r) => s + r.amount, 0))
    const earnings = round2(legs.reduce((s, l) => s + l.earning, 0))
    if (!legs.length && !deductions.length && !codCollected && !codDeposited) continue
    const status = legs.length ? ORDER[Math.min(...legs.map((l) => ORDER.indexOf(l.status)))] : 'pendingMatch'
    rows.push({ date, legs, earnings, deductions, codCollected, codDeposited, net: round2(earnings - deductions.reduce((s, d) => s + d.amount, 0)), status })
  }
  return rows
}

// ── PP-28 COD with the partner ──────────────────────────────────────────────

/** COD the partner still owes Logisco: with riders (collected) or at the office (atOffice). */
export function partnerCodOutstanding(data: DemoData, partnerId: Id) {
  const recs = Object.values(data.codRecords).filter((r) => r.partnerId === partnerId && (r.status === 'collected' || r.status === 'atOffice'))
  const oldest = recs.map((r) => r.collectedAt!).sort()[0]
  return { records: recs, amount: round2(recs.reduce((s, r) => s + r.amount, 0)), oldest, dueBy: oldest ? addHours(oldest, 24) : undefined }
}
