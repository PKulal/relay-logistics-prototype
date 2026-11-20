/**
 * Partner onboarding rules, Phases 1–2 (source §3, §4 Steps 1–4, §4.1):
 * legs by partner type, the document checklist, the AI network-gap fit score,
 * duplicate checks and the simulated KYC services (Vahan, Sarathi, OCR).
 */
import type {
  DemoData,
  Id,
  IsoDateTime,
  LegType,
  Partner,
  PartnerApplication,
  PartnerDocKey,
  PartnerDocument,
  PartnerServiceOffer,
  PartnerType,
  Service,
  TrialAnomaly,
  TrialJob,
  Trip,
} from '@shared/types'
import { addDaysToDate, istDate, minutesBetween } from '@shared/lib/time'

export const PARTNER_TYPES: PartnerType[] = ['A', 'B', 'C', 'D', 'E', 'F']

/** Legs pre-ticked by type (PP spec §2.2, source §2.2). */
export const TYPE_LEGS: Record<PartnerType, LegType[]> = {
  A: ['lineHaul'],
  B: ['firstMile', 'lastMile'],
  C: ['firstMile', 'lastMile'],
  D: ['lineHaul'],
  E: ['lineHaul'],
  F: ['originHub', 'destHub'],
}

export const TYPE_SERVICES: Record<PartnerType, PartnerServiceOffer[]> = {
  A: ['parcel'],
  B: ['parcel'],
  C: ['parcel'],
  D: ['expressPtl', 'standardPtl'],
  E: ['expressPtl', 'standardPtl'],
  F: ['parcel', 'expressPtl', 'standardPtl'],
}

/** Daily capacity unit (PP-04 Step 4). */
export const CAPACITY_UNIT: Record<PartnerType, 'shipments' | 'kg' | 'pieces'> = { A: 'shipments', B: 'shipments', C: 'shipments', D: 'kg', E: 'kg', F: 'pieces' }

/** How the type is paid (source §3), used as the indicative rate unit. */
export const RATE_UNIT: Record<PartnerType, 'perLeg' | 'perShipment' | 'perDelivery' | 'perKg' | 'perKgMin' | 'perPiece'> = {
  A: 'perLeg',
  B: 'perShipment',
  C: 'perDelivery',
  D: 'perKg',
  E: 'perKgMin',
  F: 'perPiece',
}

/** Which coverage fields a type fills (PP-04 Step 3). Hubs: F must; B and E may. */
export const needsPincodes = (t: PartnerType) => t === 'A' || t === 'B' || t === 'C'
export const needsLanes = (t: PartnerType) => t === 'A' || t === 'D' || t === 'E'
export const mayHaveHubs = (t: PartnerType) => t === 'B' || t === 'E' || t === 'F'

/** Hub audit: Type F, and Type E with a hub (source §4 Step 4). */
export const needsHubAudit = (type: PartnerType, hubs: number) => type === 'F' || (type === 'E' && hubs > 0)

export const AUDIT_ITEMS = ['security', 'cctv', 'fireSafety', 'docks', 'scale'] as const
/** Audit within 5 days (source §4 Step 4). */
export const AUDIT_WITHIN_DAYS = 5
/** Fit score at or above which Logisco invites the partner (assumed). */
export const FIT_INVITE = 60

export function servicesOf(offers: PartnerServiceOffer[]): Service[] {
  return offers.flatMap((o): Service[] => (o === 'parcel' ? ['economy', 'standard', 'express'] : [o]))
}

// ─── Document checklist (source §4.1) ─────────────────────────────────────────

export interface ChecklistRow {
  key: PartnerDocKey
  required: boolean
}

/**
 * The §4.1 rows for this applicant, in PP-06 order. Not-applicable rows are left
 * out; optional rows are kept with `required: false`. The signed agreement row
 * belongs to Phase 3 (PP-08).
 */
export function kycChecklist(a: Pick<PartnerApplication, 'gstRegistered' | 'constitution' | 'ownFleet' | 'hubs'>, type: PartnerType): ChecklistRow[] {
  const firm = a.constitution !== 'proprietorship'
  const cd = type === 'C' || type === 'D'
  const runsHub = type === 'F' || a.hubs.length > 0
  const rows: (ChecklistRow | false)[] = [
    (!cd || a.gstRegistered) && { key: 'gstin', required: true },
    { key: 'pan', required: true },
    (!cd || firm) && { key: 'incorporation', required: true },
    { key: 'udyam', required: false },
    // Transport licence "where applicable" (source §4 Step 3): goods carriers (assumed D, E)
    (type === 'D' || type === 'E') && { key: 'transportLicence', required: true },
    { key: 'bank', required: true },
    type === 'F' ? { key: 'premisesInsurance', required: true } : { key: 'insurance', required: type !== 'C' },
    (type === 'C' || type === 'D' || type === 'E' || (type === 'B' && !!a.ownFleet)) && { key: 'vehicles', required: true },
    ['B', 'C', 'D', 'E'].includes(type) && { key: 'driverLicence', required: true },
    type !== 'A' && { key: 'policeVerification', required: true },
    ((type === 'B' || type === 'E') && runsHub) || type === 'F' ? { key: 'hubDocs', required: true } : false,
  ]
  return rows.filter((r): r is ChecklistRow => !!r)
}

/** Automatic check that clears each document (ERP-12 "API checks"). */
export const DOC_CHECK: Partial<Record<PartnerDocKey, 'gstin' | 'pan' | 'pennyDrop' | 'vahan' | 'sarathi'>> = {
  gstin: 'gstin',
  pan: 'pan',
  bank: 'pennyDrop',
  vehicles: 'vahan',
  driverLicence: 'sarathi',
}

/** Required documents uploaded and their checks passed: ready to submit (PP-06). */
export function kycReadyToSubmit(app: PartnerApplication, type: PartnerType): { ready: boolean; missing: PartnerDocKey[] } {
  const missing = kycChecklist(app, type)
    .filter((r) => r.required)
    .filter((r) => {
      const d = app.documents.find((x) => x.key === r.key)
      const check = DOC_CHECK[r.key]
      return !d?.file || (check && !app.checks[check]?.ok)
    })
    .map((r) => r.key)
  return { ready: missing.length === 0, missing }
}

// ─── Duplicate check (source §4 Step 1) ───────────────────────────────────────

const digits = (s: string) => s.replace(/\D/g, '').slice(-10)

export function partnerDuplicate(data: DemoData, x: { gstin?: string; pan?: string; mobile?: string }): 'gstin' | 'pan' | 'mobile' | undefined {
  const partners = Object.values(data.partners)
  const g = x.gstin?.trim().toUpperCase()
  const p = x.pan?.trim().toUpperCase()
  const m = x.mobile ? digits(x.mobile) : ''
  if (g && partners.some((q) => q.gstin === g)) return 'gstin'
  if (p && partners.some((q) => q.pan === p)) return 'pan'
  if (m.length === 10 && (Object.values(data.partnerUsers).some((u) => digits(u.mobile) === m) || Object.values(data.applications).some((a) => a.contact && digits(a.contact.mobile) === m))) return 'mobile'
  return undefined
}

// ─── AI network-gap fit score (source §4 Step 2) ──────────────────────────────

const ACTIVE: Partner['status'][] = ['live', 'trial', 'probation']

export type FitInput = Pick<PartnerApplication, 'pincodes' | 'lanes' | 'hubs'> & { type: PartnerType; legs: LegType[] }

/** Network hub serving a city (via the pincode master). */
function hubOfCity(data: DemoData, city: string): Id | undefined {
  return Object.values(data.pincodes).find((p) => p.city === city && p.serviceable && p.hubId)?.hubId
}

/**
 * SIMULATED AI: "does Logisco need this partner for these legs, pincodes or
 * lanes?" Scored by how many active partners already serve each declared lane,
 * pincode or hub city. The best-scoring part gives the reason.
 */
export function networkFit(data: DemoData, x: FitInput): Pick<PartnerApplication, 'fitScore' | 'fitDetail'> {
  const partners = Object.values(data.partners).filter((p) => ACTIVE.includes(p.status))
  const parts: NonNullable<PartnerApplication['fitDetail']>[] = []
  const score: Record<string, number> = {}
  const add = (d: NonNullable<PartnerApplication['fitDetail']>, s: number) => {
    parts.push(d)
    score[parts.length - 1] = s
  }

  if (x.legs.includes('lineHaul'))
    for (const l of x.lanes) {
      const o = hubOfCity(data, l.origin)
      const d = hubOfCity(data, l.dest)
      if (!o || !d || o === d) continue
      const lane = Object.values(data.lanes).find((n) => n.originHubId === o && n.destHubId === d)
      const n = lane ? lane.lineHaulPartnerIds.filter((id) => partners.some((p) => p.id === id)).length : 0
      add({ kind: n >= 2 ? 'laneCovered' : 'laneGap', place: `${l.origin} → ${l.dest}`, partners: n }, n === 0 ? 92 : n === 1 ? 88 : 42)
    }

  const mile: LegType[] = x.legs.filter((g) => g === 'firstMile' || g === 'lastMile')
  if (mile.length && x.pincodes.length) {
    const counts = x.pincodes.map((pin) => ({ pin, n: partners.filter((p) => p.coveragePincodes.includes(pin) && p.legs.some((g) => mile.includes(g))).length }))
    const gap = counts.find((c) => c.n === 0) ?? counts.find((c) => c.n === 1)
    const city = (pin: string) => data.pincodes[pin]?.city ?? pin
    if (gap) add({ kind: 'pincodeGap', place: city(gap.pin), partners: gap.n }, gap.n === 0 ? 85 : 70)
    else add({ kind: 'pincodeCovered', place: city(counts[0].pin), partners: Math.min(...counts.map((c) => c.n)) }, 35)
  }

  for (const h of x.hubs) {
    const city = data.pincodes[h.pincode]?.city
    if (!city) continue
    const n = Object.values(data.hubs).filter((hub) => data.pincodes[hub.pincode]?.city === city).length
    add({ kind: n ? 'hubCovered' : 'hubGap', place: city, partners: n }, n ? 40 : 80)
  }

  if (!parts.length) return { fitScore: 25, fitDetail: { kind: 'none', place: '', partners: 0 } }
  const best = parts.map((_, i) => i).sort((a, b) => score[b] - score[a])[0]
  // ERP-21 recruitment needs raise the fit of applicants who would fill them
  const needs = Object.values(data.recruitmentNeeds ?? {}).filter((n) => n.open && x.legs.includes(n.legType))
  const laneIds = x.lanes.map((l) => Object.values(data.lanes).find((n) => n.originHubId === hubOfCity(data, l.origin) && n.destHubId === hubOfCity(data, l.dest))?.id)
  const meets = needs.some((n) => (n.legType === 'lineHaul' ? laneIds.includes(n.place) : x.pincodes.includes(n.place)))
  return { fitScore: meets ? Math.min(99, score[best] + 8) : score[best], fitDetail: parts[best] }
}

// ─── SIMULATED KYC services ───────────────────────────────────────────────────

const REG_NO = /^[A-Z]{2}\d{2}[A-Z]{1,3}\d{4}$/
const DL_NO = /^[A-Z]{2}-?\d{13}$/

/** SIMULATED: Vahan via ULIP. A number already on another partner's fleet comes back as a duplicate. */
export function vahanCheck(data: DemoData, regNo: string, partnerId: Id): { ok: boolean; detail: Record<string, string> } {
  const reg = regNo.replace(/\s/g, '').toUpperCase()
  if (!REG_NO.test(reg)) return { ok: false, detail: { reg, reason: 'format' } }
  const other = Object.values(data.vehicles).find((v) => v.regNo === reg && v.partnerId !== partnerId)
  if (other) return { ok: false, detail: { reg, reason: 'duplicate', partner: data.partners[other.partnerId]?.shortName ?? '' } }
  return { ok: true, detail: { reg, vehicleClass: 'Goods carrier (HGV)', fitnessTill: '2027-09-30', permitTill: '2028-03-31', insuranceTill: '2027-06-30' } }
}

/** SIMULATED: Sarathi via ULIP. */
export function sarathiCheck(dl: string): { ok: boolean; detail: Record<string, string> } {
  const n = dl.replace(/\s/g, '').toUpperCase()
  if (!DL_NO.test(n)) return { ok: false, detail: { dl: n, reason: 'format' } }
  return { ok: true, detail: { dl: n, licenceClass: 'Transport (HGV)', validTill: '2029-12-31' } }
}

/** Agreement start (assumed 30 days after today): insurance must run past it. */
export const agreementStart = (now: IsoDateTime) => addDaysToDate(istDate(now), 30)

/**
 * SIMULATED AI document OCR (source §4 Step 3): reads the file and flags
 * tampered, duplicate or mismatched documents. Scripted rules: insurance that
 * ends before the agreement start → expired; a vehicle on another partner's
 * fleet → duplicate; a bank holder name that doesn't match → mismatch; a GSTIN
 * whose PAN differs from the declared PAN → mismatch.
 */
export function ocrRead(data: DemoData, app: PartnerApplication, partner: Partner, doc: PartnerDocument, now: IsoDateTime): Pick<PartnerDocument, 'ocr' | 'flag' | 'note' | 'status'> {
  const ocr: { label: string; value: string }[] = []
  const ok = (): Pick<PartnerDocument, 'ocr' | 'flag' | 'note' | 'status'> => ({ ocr, status: 'verified', flag: undefined, note: undefined })
  const flagged = (flag: NonNullable<PartnerDocument['flag']>, note: string): Pick<PartnerDocument, 'ocr' | 'flag' | 'note' | 'status'> => ({ ocr, status: 'flagged', flag, note })
  switch (doc.key) {
    case 'gstin':
      ocr.push({ label: 'gstin', value: partner.gstin }, { label: 'legalName', value: partner.name })
      return partner.gstin.slice(2, 12) !== partner.pan ? flagged('mismatch', 'panMismatch') : ok()
    case 'pan':
      ocr.push({ label: 'pan', value: partner.pan }, { label: 'name', value: partner.name })
      return ok()
    case 'bank': {
      const c = app.checks.pennyDrop
      ocr.push({ label: 'holder', value: String(c?.detail.holder ?? '') }, { label: 'ifsc', value: String(c?.detail.ifsc ?? '') })
      return c && Number(c.detail.matchPct) < 80 ? flagged('mismatch', 'nameMismatch') : ok()
    }
    case 'insurance':
    case 'premisesInsurance':
      ocr.push({ label: 'policy', value: doc.number ?? '' }, { label: 'expiry', value: doc.expiry ?? '' })
      return doc.expiry && doc.expiry < agreementStart(now) ? flagged('expired', 'expiresBeforeStart') : ok()
    case 'vehicles': {
      ocr.push({ label: 'reg', value: doc.number ?? '' })
      const v = vahanCheck(data, doc.number ?? '', partner.id)
      return v.detail.reason === 'duplicate' ? flagged('duplicate', 'vehicleDuplicate') : ok()
    }
    case 'driverLicence':
      ocr.push({ label: 'dl', value: doc.number ?? '' })
      return ok()
    default:
      ocr.push({ label: 'name', value: partner.name })
      return ok()
  }
}

/** Waitlisted applications are re-scored monthly (source §4 Step 2). */
export const rescoreDate = (now: IsoDateTime) => addDaysToDate(istDate(now), 30)

// ─── Monitored trial (source §4 Step 7) ───────────────────────────────────────

/** 10 live parcel jobs, or 3 PTL / line-haul trips; Type F 3 hub cycles (assumed, PP spec §2.2). */
export function trialRequirement(type: PartnerType, legs: LegType[]): { unit: 'trips' | 'jobs' | 'cycles'; required: number } {
  if (type === 'F') return { unit: 'cycles', required: 3 }
  if (type === 'D' || type === 'E' || (type === 'A' && legs.includes('lineHaul'))) return { unit: 'trips', required: 3 }
  return { unit: 'jobs', required: 10 }
}

/**
 * Job score, 0–100 (assumed weights): on time 40, scan compliance 40, and 20
 * for a clean run, less 5 for each AI anomaly flag.
 */
export function trialJobScore(j: Pick<TrialJob, 'onTime' | 'scanPct' | 'anomalies'>): number {
  return Math.round((j.onTime ? 40 : 24) + 0.4 * j.scanPct + Math.max(0, 20 - 5 * j.anomalies.length))
}

/** Running trial score: the average of the job scores. */
export const trialScore = (jobs: TrialJob[]) => (jobs.length ? Math.round(jobs.reduce((a, j) => a + j.score, 0) / jobs.length) : 0)

/** Halts longer than this are flagged (assumed). */
const LONG_HALT_MIN = 60

/**
 * SIMULATED AI anomaly flags for an arrived line-haul trip: late against the
 * ETA, long halts, breakdowns, and legs left unscanned at loading.
 */
export function tripTrialJob(trip: Trip, at: IsoDateTime): TrialJob {
  const anomalies: TrialAnomaly[] = []
  const onTime = minutesBetween(trip.eta, trip.arrivedAt ?? at) <= 0
  if (!onTime) anomalies.push('lateArrival')
  if (trip.halts.some((h) => h.breakdown)) anomalies.push('breakdown')
  if (trip.halts.some((h) => !h.breakdown && h.minutes > LONG_HALT_MIN)) anomalies.push('longHalt')
  const loaded = trip.loadedLegIds?.length
  const scanPct = trip.legIds.length && loaded !== undefined ? Math.round((Math.min(loaded, trip.legIds.length) / trip.legIds.length) * 100) : 100
  if (scanPct < 100) anomalies.push('missedScan')
  const job = { ref: trip.id, date: istDate(trip.arrivedAt ?? at), leg: 'lineHaul' as const, onTime, scanPct, anomalies }
  return { ...job, score: trialJobScore(job) }
}
