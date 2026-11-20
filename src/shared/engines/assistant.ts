/**
 * AI assistant (CP-35, PP-37, PA-11, ERP-02). Source §12: "Tracks,
 * reschedules, raises claims, downloads documents — text and voice", Hindi +
 * English, for segments A, B and C; guardrails: the AI never pays money,
 * closes a claim, completes a delivery or changes COD — a person confirms.
 *
 * SIMULATED AI: scripted intents matched by keyword in English, Hinglish and
 * Hindi. Answers read the shared data, so they follow the demo. Replies are
 * structured (i18n keys + values + cards); the panel words them.
 */
import { formatDate, formatINR } from '@shared/lib/format'
import { istDate } from '@shared/lib/time'
import { APPOINTMENT_SLOTS } from '@shared/store/appointmentActions'
import type { AppKey, CustomerRole, DemoData, ErpRole, Id, IsoDate, IsoDateTime, PartnerRole, Shipment } from '@shared/types'
import { claimableShipments } from './claims'
import { slaRisks, legRisk } from './controlTower'
import { openNdr, reattemptDates } from './ndr'
import { docRegister } from './partnerSettings'
import { nextPayout } from './payables'
import { laneRows } from './pricingMonitor'
import { codSummary, collectionsPriority, customerInvoices, isOpen } from './receivables'
import { kpiPct, scoresOf, weakestKpis } from './scoring'

export type Lang = 'en' | 'hi'

export interface AssistantCtx {
  app: AppKey
  userId: Id
  role: CustomerRole | PartnerRole | ErpRole | 'rider' | 'driver' | 'hub'
  customerId?: Id
  partnerId?: Id
}

export type Row = { key: string; params?: Record<string, unknown>; to?: string }

export type AssistantCard =
  | { kind: 'shipment'; lr: Id; status: Shipment['status']; eta: IsoDate; to: string }
  /** Reschedule a failed delivery: the person picks a date and slot, then confirms */
  | { kind: 'slots'; lr: Id; dates: IsoDate[]; slots: { from: string; to: string }[] }
  /** Start a damage claim: opens CP-22 prefilled; the customer submits */
  | { kind: 'claim'; lr: Id; to: string }
  | { kind: 'list'; rows: Row[] }
  | { kind: 'steps'; keys: string[] }

export interface Reply {
  intent: string
  /** i18n key under ai.* and its values */
  key: string
  params?: Record<string, unknown>
  cards?: AssistantCard[]
  link?: { to: string; key: string }
  /** 0–1: keyword match strength */
  confidence: number
  lang: Lang
  /** The reply prepares an action a person must confirm (logged in ERP-43) */
  prepares?: boolean
  recordId?: Id
}

// ── Language and entities ───────────────────────────────────────────────────

const HINGLISH = /\b(kahan|kahaan|kidhar|kab|kaise|kya|kyun|kyon|mera|meri|mere|hai|hain|nahi|nahin|aayega|ayega|karna|karo|kar|dobara|phir|fir|paisa|paise|gira|bhai|wala|wali|hoga|chahiye|batao)\b/

/** Answer in the question's language: Devanagari or Hinglish → Hindi; otherwise the screen language. */
export function detectLang(q: string, screen: Lang): Lang {
  if (/[ऀ-ॿ]/.test(q)) return 'hi'
  if (HINGLISH.test(q.toLowerCase())) return 'hi'
  return screen
}

/** "LR 781", "LGS-DEL-000781", "000781" → the shipment the asker may see. */
export function findLr(data: DemoData, q: string, scope?: (s: Shipment) => boolean): Shipment | undefined {
  const full = /LGS-[A-Z]{3}-\d{6}/i.exec(q)?.[0]?.toUpperCase()
  if (full) {
    const s = data.shipments[full]
    return s && (!scope || scope(s)) ? s : undefined
  }
  const m = /(?:\blr\b|\blgs\b|#|\bawb\b|\bशिपमेंट\b)?\s*-?(\d{3,6})\b/i.exec(q)
  if (!m) return undefined
  const serial = m[1].padStart(6, '0')
  return Object.values(data.shipments)
    .filter((s) => s.id.endsWith(`-${serial}`) && (!scope || scope(s)))
    .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt))[0]
}

const has = (q: string, re: RegExp) => re.test(q)

// ── Customer (CP-35) ────────────────────────────────────────────────────────

const C = {
  pay: /\b(pay|payment|refund)\b.*\b(invoice|bill|for me|now|my)\b|\bpay (my|the|it)\b|bhugtan kar|pay kar|भुगतान कर/,
  reschedule: /reschedul|new slot|another (day|slot|time)|change (the )?(slot|date|time|delivery)|re-?attempt|deliver (it )?(again|tomorrow|later)|dobara|phir se|fir se|slot badal|दोबारा|फिर से|स्लॉट/,
  claim: /claim|damag|broken|missing|shortage|toot|tuta|toota|kharab|क्लेम|टूट|खराब|नुकसान|गायब/,
  invoice: /invoice|\bbills?\b|statement|इनवॉइस|बिल/,
  cod: /\bcod\b|remit|cash on delivery|रेमिट/,
  wallet: /wallet|balance|recharge|वॉलेट|बैलेंस/,
  book: /\bbook|new shipment|booking|send (a )?(parcel|shipment)|बुक/,
  track: /where|track|status|kahan|kahaan|kidhar|\beta\b|kab (tak|aayega|ayega|pahunch)|delivered\?|कहाँ|कहां|स्थिति|ट्रैक|कब/,
}

function customerReply(data: DemoData, q: string, ctx: AssistantCtx, now: IsoDateTime, lang: Lang): Reply {
  const cid = ctx.customerId!
  const role = ctx.role as CustomerRole
  const mine = (s: Shipment) => s.customerId === cid
  const lr = findLr(data, q, mine)
  const base = { lang }

  if (has(q, C.pay)) return { ...base, intent: 'pay', key: 'ai.c.pay', link: { to: '/customer/billing/invoices', key: 'ai.open.invoices' }, confidence: 0.9 }

  if (has(q, C.reschedule)) {
    const target = lr ?? Object.values(data.shipments).find((s) => mine(s) && openNdr(data, s.id))
    if (!target) return { ...base, intent: 'reschedule', key: 'ai.c.noFailed', link: { to: '/customer/exceptions', key: 'ai.open.exceptions' }, confidence: 0.7 }
    if (!openNdr(data, target.id)) return { ...base, intent: 'reschedule', key: 'ai.c.notFailed', params: { lr: target.id, status: target.status }, cards: [shipmentCard(target, 'customer')], confidence: 0.75 }
    if (role === 'finance') return { ...base, intent: 'reschedule', key: 'ai.c.role', confidence: 0.9 }
    return { ...base, intent: 'reschedule', key: 'ai.c.reschedule', params: { lr: target.id }, cards: [{ kind: 'slots', lr: target.id, dates: reattemptDates(now), slots: APPOINTMENT_SLOTS }], confidence: lr ? 0.92 : 0.8, prepares: true, recordId: target.id }
  }

  if (has(q, C.claim)) {
    const eligible = claimableShipments(data, cid, now)
    const target = lr ?? (eligible.length === 1 ? eligible[0] : undefined)
    if (!target) return { ...base, intent: 'claim', key: eligible.length ? 'ai.c.whichClaim' : 'ai.c.noClaimable', cards: eligible.length ? [{ kind: 'list', rows: eligible.slice(0, 5).map((s) => ({ key: 'ai.row.shipment', params: { lr: s.id, status: s.status }, to: `/customer/claims/new?lr=${s.id}&type=damage` })) }] : undefined, confidence: 0.7 }
    if (!eligible.some((s) => s.id === target.id)) return { ...base, intent: 'claim', key: 'ai.c.notClaimable', params: { lr: target.id }, confidence: 0.8 }
    return { ...base, intent: 'claim', key: 'ai.c.claim', params: { lr: target.id }, cards: [{ kind: 'claim', lr: target.id, to: `/customer/claims/new?lr=${target.id}&type=damage` }], confidence: 0.9, prepares: true, recordId: target.id }
  }

  if (has(q, C.invoice)) {
    if (role === 'dispatch') return { ...base, intent: 'invoice', key: 'ai.c.role', confidence: 0.9 }
    const open = customerInvoices(data, cid).filter(isOpen)
    return {
      ...base,
      intent: 'invoice',
      key: open.length ? 'ai.c.invoices' : 'ai.c.noInvoices',
      params: { count: open.length },
      cards: open.length ? [{ kind: 'list', rows: open.map((i) => ({ key: 'ai.row.invoice', params: { id: i.id, amount: formatINR(i.total), due: formatDate(i.dueDate) }, to: `/customer/billing/invoices?invoice=${encodeURIComponent(i.id)}` })) }] : undefined,
      link: { to: '/customer/billing/invoices', key: 'ai.open.invoices' },
      confidence: 0.9,
    }
  }

  if (has(q, C.cod)) {
    const c = codSummary(data, cid, now)
    return { ...base, intent: 'cod', key: 'ai.c.cod', params: { pending: formatINR(c.pending), next: c.nextRemittance ? formatDate(c.nextRemittance) : '—', month: formatINR(c.remittedThisMonth) }, link: { to: '/customer/billing/cod', key: 'ai.open.cod' }, confidence: 0.9 }
  }

  if (has(q, C.wallet)) {
    const c = data.customers[cid]
    if (c.billing !== 'prepaid') return { ...base, intent: 'wallet', key: 'ai.c.credit', params: { limit: formatINR(c.creditLimit), available: formatINR(c.creditLimit - c.creditUsed) }, confidence: 0.85 }
    return { ...base, intent: 'wallet', key: 'ai.c.wallet', params: { amount: formatINR(c.walletBalance) }, link: { to: '/customer/billing/wallet', key: 'ai.open.wallet' }, confidence: 0.9 }
  }

  if (has(q, C.book) && !lr) {
    if (role === 'finance') return { ...base, intent: 'book', key: 'ai.c.role', confidence: 0.9 }
    return { ...base, intent: 'book', key: 'ai.c.book', cards: [{ kind: 'steps', keys: ['ai.steps.book.1', 'ai.steps.book.2', 'ai.steps.book.3', 'ai.steps.book.4'] }], link: { to: '/customer/book', key: 'ai.open.book' }, confidence: 0.85 }
  }

  if (lr || has(q, C.track)) {
    if (!lr) return { ...base, intent: 'track', key: /\d{3,}/.test(q) ? 'ai.c.lrNotFound' : 'ai.c.whichLr', confidence: 0.6 }
    return { ...base, intent: 'track', key: `ai.c.track.${lr.status}`, params: { lr: lr.id, eta: formatDate(lr.eta) }, cards: [shipmentCard(lr, 'customer')], confidence: 0.92, recordId: lr.id }
  }

  return { ...base, intent: 'help', key: 'ai.c.help', confidence: 0.2 }
}

const shipmentCard = (s: Shipment, app: 'customer' | 'erp'): AssistantCard => ({ kind: 'shipment', lr: s.id, status: s.status, eta: s.eta, to: app === 'customer' ? `/customer/shipments/${s.id}` : `/erp/shipments/${s.id}` })

// ── Partner Portal (PP-37) ──────────────────────────────────────────────────

const P = {
  guard: /close (the |this )?claim|claim (band|close)|pay (me|now)|release (my |the )?(payout|money)/,
  score: /score|tier|rating|platinum|gold|silver|bronze|स्कोर|टियर|रेटिंग/,
  payout: /payout|payment|paisa|paise|money|पेआउट|भुगतान|पैसा|kab aayega|kab ayega/,
  addRider: /(add|new|naya|nayi|jod|register).*(rider|driver|staff)|(rider|driver|staff).*(add|jod|kaise|join)|राइडर|ड्राइवर/,
  atRisk: /risk|late|delay|breach|\bder\b|देर|जोखिम/,
  docs: /document|expir|licen[cs]e|insurance|fitness|permit|\bnoc\b|दस्तावेज़|दस्तावेज|बीमा|लाइसेंस/,
}

function partnerReply(data: DemoData, q: string, ctx: AssistantCtx, now: IsoDateTime, lang: Lang): Reply {
  const pid = ctx.partnerId!
  const role = ctx.role as PartnerRole
  const base = { lang }
  if (has(q, P.guard)) return { ...base, intent: 'guard', key: 'ai.guard.money', link: { to: '/partner/finance/payouts', key: 'ai.open.payouts' }, confidence: 0.9 }

  if (has(q, P.score)) {
    const scores = scoresOf(data, pid).filter((w) => w.published)
    const last = scores.at(-1)
    const prev = scores.at(-2)
    if (!last) return { ...base, intent: 'score', key: 'ai.p.noScore', confidence: 0.8 }
    const weak = weakestKpis(last)
    const delta = prev ? Math.round((last.total - prev.total) * 10) / 10 : undefined
    return {
      ...base,
      intent: 'score',
      key: delta !== undefined && delta < 0 ? 'ai.p.scoreDown' : 'ai.p.score',
      params: { total: last.total, delta: delta !== undefined ? Math.abs(delta) : 0, tier: last.tierAfter ?? data.partners[pid].tier ?? 'trial' },
      cards: [{ kind: 'list', rows: weak.map((k) => ({ key: 'ai.row.kpi', params: { kpi: k, value: kpiPct(last.kpis, k) } })) }],
      link: { to: '/partner/scorecard', key: 'ai.open.scorecard' },
      confidence: 0.9,
    }
  }

  if (has(q, P.payout)) {
    if (role === 'operations') return { ...base, intent: 'payout', key: 'ai.c.role', confidence: 0.9 }
    const n = nextPayout(data, pid, now)
    const amount = n.payout?.net ?? n.line?.net
    return { ...base, intent: 'payout', key: amount !== undefined ? 'ai.p.payout' : 'ai.p.noPayout', params: { date: formatDate(n.date), amount: amount !== undefined ? formatINR(amount) : '' }, link: { to: '/partner/finance/payouts', key: 'ai.open.payouts' }, confidence: 0.92 }
  }

  if (has(q, P.addRider)) {
    if (role === 'finance') return { ...base, intent: 'addRider', key: 'ai.c.role', confidence: 0.9 }
    return { ...base, intent: 'addRider', key: 'ai.p.addRider', cards: [{ kind: 'steps', keys: ['ai.steps.rider.1', 'ai.steps.rider.2', 'ai.steps.rider.3', 'ai.steps.rider.4'] }], link: { to: '/partner/staff', key: 'ai.open.staff' }, confidence: 0.9 }
  }

  if (has(q, P.docs)) {
    const due = docRegister(data, pid, now).filter((r) => r.status === 'expired' || r.status === 'expiring')
    return {
      ...base,
      intent: 'docs',
      key: due.length ? 'ai.p.docs' : 'ai.p.docsOk',
      params: { count: due.length },
      cards: due.length ? [{ kind: 'list', rows: due.slice(0, 6).map((r) => ({ key: r.status === 'expired' ? 'ai.row.docExpired' : 'ai.row.docExpiring', params: { doc: r.kind, owner: r.ownerName, date: r.expiry ? formatDate(r.expiry) : '—' }, to: '/partner/compliance' })) }] : undefined,
      link: { to: '/partner/compliance', key: 'ai.open.compliance' },
      confidence: 0.88,
    }
  }

  if (has(q, P.atRisk)) {
    if (role === 'finance') return { ...base, intent: 'atRisk', key: 'ai.c.role', confidence: 0.9 }
    const legs = Object.values(data.legs)
      .filter((l) => l.partnerId === pid && ['offered', 'accepted', 'assigned', 'inProgress'].includes(l.status))
      .map((l) => ({ l, r: legRisk(data, l, now).risk }))
      .filter((x) => x.r >= 50)
      .sort((a, b) => b.r - a.r)
    return {
      ...base,
      intent: 'atRisk',
      key: legs.length ? 'ai.p.atRisk' : 'ai.p.noRisk',
      params: { count: legs.length },
      cards: legs.length ? [{ kind: 'list', rows: legs.slice(0, 5).map(({ l, r }) => ({ key: 'ai.row.risk', params: { job: l.id, lr: l.shipmentId, risk: r }, to: `/partner/jobs/${l.id}` })) }] : undefined,
      link: { to: '/partner/jobs', key: 'ai.open.jobs' },
      confidence: 0.85,
    }
  }

  return { ...base, intent: 'help', key: 'ai.p.help', confidence: 0.2 }
}

// ── Partner App (PA-11) ─────────────────────────────────────────────────────

/** About 10 scripted "how do I…" answers, each with steps (PA-11 prototype note). */
const A: [string, RegExp][] = [
  ['guard', /(mark|complete|finish|close).*(deliver|done|task)|deliver(ed)? (kar|mark) (do|de)|(change|kam|badal|reduce).*\bcod\b|\bcod\b.*(change|kam|badal|reduce)|डिलीवर कर दो|cod बदल/],
  ['otp', /\botp\b|ओटीपी/],
  ['noAnswer', /(not|nahi|nahin|no) (answer|answering|picking)|phone (nahi|not)|call (nahi|not)|(customer|consignee|grahak).*(not|nahi|nahin).*(answer|utha|available|mil)|नहीं उठा|फ़ोन नहीं|फोन नहीं/],
  ['labelTorn', /label|लेबल/],
  ['sealWrong', /seal|सील/],
  ['scale', /scale|weigh|kaanta|kanta|tarazu|वज़न|वजन|काँटा|कांटा/],
  ['breakdown', /breakdown|break down|puncture|accident|tyre|tire|gaadi|gadi|vehicle|पंचर|ब्रेकडाउन|गाड़ी|गाडी/],
  ['damaged', /damag|broken|toot|tuta|toota|टूट|फटा|damage/],
  ['offline', /offline|network|internet|signal|sync|नेटवर्क|इंटरनेट|सिग्नल/],
  ['wrongAddress', /address|\bpata\b|पता|location|ghar nahi mil|मकान/],
  ['codShort', /cash|\bcod\b|chutta|khulle|change nahi|नकद|पैसे कम|खुल्ले/],
]

function fieldReply(q: string, lang: Lang): Reply {
  for (const [intent, re] of A) {
    if (!re.test(q)) continue
    if (intent === 'guard') return { intent, key: 'ai.guard.field', confidence: 0.95, lang }
    return { intent, key: `ai.a.${intent}`, cards: [{ kind: 'steps', keys: [1, 2, 3].map((n) => `ai.a.${intent}Steps.${n}`) }], confidence: 0.85, lang }
  }
  return { intent: 'help', key: 'ai.a.help', confidence: 0.2, lang }
}

// ── ERP (ERP-02 floating panel) ─────────────────────────────────────────────

const E = {
  guard: /(pay|release|approve) (the )?(payout|partner|money)|close (the |this )?claim|settle (the )?claim|refund/,
  lanes: /lane|lost money|losing|\bloss|margin|घाटा|नुकसान|मार्जिन/,
  risk: /risk|breach|late|delay|देर|जोखिम/,
  sos: /\bsos\b|emergency|आपात/,
  overdue: /overdue|receivable|collection|unpaid|outstanding|बकाया/,
  probation: /probation|weak partner|low score|suspen|प्रोबेशन/,
  track: /where|track|status|कहाँ|कहां/,
}

function erpReply(data: DemoData, q: string, now: IsoDateTime, lang: Lang): Reply {
  const base = { lang }
  if (has(q, E.guard)) return { ...base, intent: 'guard', key: 'ai.guard.erp', confidence: 0.9 }
  const lr = findLr(data, q)
  if (has(q, E.lanes)) {
    const rows = laneRows(data, now).filter((r) => r.margin < 0 || r.belowTarget)
    return {
      ...base,
      intent: 'lanes',
      key: rows.length ? 'ai.e.lanes' : 'ai.e.lanesOk',
      params: { count: rows.length },
      cards: rows.length ? [{ kind: 'list', rows: rows.slice(0, 5).map((r) => ({ key: 'ai.row.lane', params: { lane: r.key, pct: r.marginPct, margin: formatINR(r.margin), n: r.shipments.length } })) }] : undefined,
      link: { to: '/erp/pricing/margin', key: 'ai.open.margin' },
      confidence: 0.88,
    }
  }
  if (has(q, E.sos)) {
    const active = Object.values(data.sosAlerts).filter((a) => a.status === 'active')
    return { ...base, intent: 'sos', key: active.length ? 'ai.e.sos' : 'ai.e.noSos', params: { count: active.length }, cards: active.length ? [{ kind: 'list', rows: active.map((a) => ({ key: 'ai.row.sos', params: { name: data.fieldStaff[a.staffId]?.name, partner: data.partners[data.fieldStaff[a.staffId]?.partnerId]?.shortName } })) }] : undefined, link: { to: '/erp/control-tower/partner-health', key: 'ai.open.health' }, confidence: 0.9 }
  }
  if (has(q, E.risk)) {
    const risks = slaRisks(data, now, 5)
    return { ...base, intent: 'risk', key: risks.length ? 'ai.e.risk' : 'ai.e.noRisk', params: { count: risks.length }, cards: risks.length ? [{ kind: 'list', rows: risks.map((r) => ({ key: 'ai.row.risk', params: { job: r.legId, lr: r.shipmentId, risk: r.risk }, to: `/erp/shipments/${r.shipmentId}` })) }] : undefined, link: { to: '/erp/control-tower/at-risk', key: 'ai.open.atRisk' }, confidence: 0.88 }
  }
  if (has(q, E.overdue)) {
    const list = collectionsPriority(data, now).slice(0, 5)
    return { ...base, intent: 'overdue', key: list.length ? 'ai.e.overdue' : 'ai.e.noOverdue', params: { count: list.length }, cards: list.length ? [{ kind: 'list', rows: list.map((c) => ({ key: 'ai.row.overdue', params: { customer: data.customers[c.customerId]?.shortName, amount: formatINR(c.amount), days: c.daysOverdue } })) }] : undefined, link: { to: '/erp/finance/invoicing?tab=collections', key: 'ai.open.collections' }, confidence: 0.88 }
  }
  if (has(q, E.probation)) {
    const ps = Object.values(data.partners).filter((p) => p.tier === 'probation' || p.status === 'suspended')
    return { ...base, intent: 'probation', key: ps.length ? 'ai.e.probation' : 'ai.e.noProbation', params: { count: ps.length }, cards: ps.length ? [{ kind: 'list', rows: ps.map((p) => ({ key: 'ai.row.partner', params: { name: p.shortName, score: p.score } })) }] : undefined, link: { to: '/erp/partners/scoring', key: 'ai.open.scoring' }, confidence: 0.88 }
  }
  if (lr || has(q, E.track)) {
    if (!lr) return { ...base, intent: 'track', key: 'ai.c.whichLr', confidence: 0.6 }
    return { ...base, intent: 'track', key: `ai.c.track.${lr.status}`, params: { lr: lr.id, eta: formatDate(lr.eta) }, cards: [shipmentCard(lr, 'erp')], confidence: 0.92, recordId: lr.id }
  }
  return { ...base, intent: 'help', key: 'ai.e.help', confidence: 0.2 }
}

// ── Entry point ─────────────────────────────────────────────────────────────

export const MAX_CHARS = 500

export function answer(data: DemoData, question: string, ctx: AssistantCtx, now: IsoDateTime, screen: Lang): Reply {
  const q = question.slice(0, MAX_CHARS).toLowerCase().trim()
  const lang = detectLang(q, screen)
  if (ctx.app === 'customer') return customerReply(data, q, ctx, now, lang)
  if (ctx.app === 'partnerPortal') return partnerReply(data, q, ctx, now, lang)
  if (ctx.app === 'partnerApp') return fieldReply(q, lang)
  return erpReply(data, q, now, lang)
}

/** Suggestion chips per app (CP-35, PP-37, PA-11 specs; ERP-02 example). Keys under ai.chip.* */
export const CHIPS: Record<AppKey, string[]> = {
  customer: ['track', 'reschedule', 'claim', 'invoice'],
  partnerPortal: ['score', 'payout', 'addRider', 'atRisk'],
  partnerApp: ['noAnswer', 'labelTorn', 'sealWrong', 'scale'],
  erp: ['lanes', 'risk', 'overdue', 'probation'],
}

/** Today in IST, for answers that name a day. */
export const today = (now: IsoDateTime) => istDate(now)
