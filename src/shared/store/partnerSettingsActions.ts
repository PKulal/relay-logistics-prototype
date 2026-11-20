/**
 * Partner Portal settings (PP-29 to PP-36): field staff, vehicles, hubs,
 * document renewals, company bank and exit request, portal users and the
 * partner API. Every change is written to the audit log (ERP-43).
 */
import { pennyDrop } from '@shared/engines/onboarding'
import { sarathiCheck, vahanCheck } from '@shared/engines/partnerOnboarding'
import { HUB_DOC_FIELD, isLastPartnerAdmin, portalUserStatus, VEHICLE_DOCS, vehicleExpiry, type HubDoc, type VehicleDoc } from '@shared/engines/partnerSettings'
import { addHours } from '@shared/lib/time'
import { simulateApiKey, simulateSecret, simulateWebhookTest } from '@shared/sim/keys'
import type { ApiKey, DemoData, FieldStaff, Hub, Id, IsoDate, IsoDateTime, JobPushEvent, Notification, Partner, PartnerIntegration, PartnerRole, PartnerUser, Vehicle } from '@shared/types'
import { audit } from './erpActions'
import { openSuspensionCase } from './scoringActions'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const log = (data: DemoData, by: Id, action: string, recordId: Id, at: IsoDateTime, before?: unknown, after?: unknown) => audit(data, { userId: by, app: 'partnerPortal', action, recordId, at, before, after })
const nextNo = (keys: string[], prefix: string, pad = 2) => `${prefix}${String(Math.max(0, ...keys.filter((k) => k.startsWith(prefix)).map((k) => Number(/(\d+)$/.exec(k)?.[1] ?? 0))) + 1).padStart(pad, '0')}`
const digits = (m: string) => m.replace(/\D/g, '')
const setPartner = (data: DemoData, p: Partner): DemoData => ({ ...data, partners: { ...data.partners, [p.id]: p } })

/** SIMULATED Logisco review of an uploaded renewal (assumed 4 hours). */
export const RENEWAL_REVIEW_HOURS = 4

// ── PP-29 field staff ───────────────────────────────────────────────────────

export interface StaffInput {
  name: string
  role: FieldStaff['role']
  mobile: string
  photo: string
  idProof: NonNullable<FieldStaff['idProof']>
  licenceNo?: string
  /** Police verification certificate (file) and date */
  policeFile?: string
  policeDate?: IsoDate
  vehicleId?: Id
  hubId?: Id
  language: FieldStaff['language']
}

export type StaffError = 'required' | 'mobileTaken' | 'licence' | 'police'

/**
 * Add staff: SMS with the app download link (SIMULATED). The licence is checked
 * on Sarathi (SIMULATED) for riders and drivers. Without a valid licence and
 * police verification the person can be added but not assigned (PP-14 rule).
 */
export function createStaff(data: DemoData, partnerId: Id, x: StaffInput, by: Id, at: IsoDateTime): { data: DemoData; id?: Id; error?: StaffError } {
  if (!x.name.trim() || digits(x.mobile).length !== 10 || !x.photo || !x.idProof.last4) return { data, error: 'required' }
  if (Object.values(data.fieldStaff).some((s) => digits(s.mobile) === digits(x.mobile))) return { data, error: 'mobileTaken' }
  let licenceValidTill: IsoDate | undefined
  if (x.role !== 'hub' && x.licenceNo?.trim()) {
    const r = sarathiCheck(x.licenceNo)
    if (!r.ok) return { data, error: 'licence' }
    licenceValidTill = r.detail.validTill
  }
  if (x.policeFile && !x.policeDate) return { data, error: 'police' }
  const id = nextNo(Object.keys(data.fieldStaff), `FS-${partnerId.replace(/^P-/, '')}-`)
  const staff: FieldStaff = {
    id,
    partnerId,
    name: x.name.trim(),
    mobile: x.mobile.trim(),
    role: x.role,
    vehicleId: x.vehicleId || undefined,
    hubId: x.hubId || undefined,
    licenceNo: x.licenceNo?.trim().toUpperCase() || undefined,
    licenceValidTill,
    policeVerified: !!(x.policeFile && x.policeDate),
    policeVerifiedOn: x.policeFile ? x.policeDate : undefined,
    trained: false,
    language: x.language,
    photo: x.photo,
    idProof: x.idProof,
    status: 'active',
    appLinkSentAt: at,
  }
  return { data: log({ ...data, fieldStaff: { ...data.fieldStaff, [id]: staff } }, by, 'staff.add', id, at, undefined, { role: x.role }), id }
}

export type StaffEdit = Pick<StaffInput, 'vehicleId' | 'hubId' | 'language' | 'licenceNo' | 'policeFile' | 'policeDate'>

/** Edit: default vehicle, base, language; a new licence number is re-checked; police verification can be added. */
export function updateStaff(data: DemoData, id: Id, x: StaffEdit, by: Id, at: IsoDateTime): { data: DemoData; error?: StaffError } {
  const s = data.fieldStaff[id]
  if (!s) return { data }
  let next: FieldStaff = { ...s, vehicleId: x.vehicleId || undefined, hubId: x.hubId || undefined, language: x.language }
  const lic = x.licenceNo?.trim().toUpperCase()
  if (s.role !== 'hub' && lic && lic !== s.licenceNo) {
    const r = sarathiCheck(lic)
    if (!r.ok) return { data, error: 'licence' }
    next = { ...next, licenceNo: lic, licenceValidTill: r.detail.validTill }
  }
  if (x.policeFile) {
    if (!x.policeDate) return { data, error: 'police' }
    next = { ...next, policeVerified: true, policeVerifiedOn: x.policeDate }
  }
  return { data: log({ ...data, fieldStaff: { ...data.fieldStaff, [id]: next } }, by, 'staff.edit', id, at) }
}

/** Deactivate / block removes app access; reactivate restores it. */
export function setStaffStatus(data: DemoData, id: Id, status: NonNullable<FieldStaff['status']>, by: Id, at: IsoDateTime): DemoData {
  const s = data.fieldStaff[id]
  if (!s || (s.status ?? 'active') === status) return data
  return log({ ...data, fieldStaff: { ...data.fieldStaff, [id]: { ...s, status } } }, by, `staff.${status}`, id, at, s.status ?? 'active', status)
}

export function resendAppLink(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const s = data.fieldStaff[id]
  if (!s || (s.status ?? 'active') !== 'active') return data
  return log({ ...data, fieldStaff: { ...data.fieldStaff, [id]: { ...s, appLinkSentAt: at } } }, by, 'staff.appLink', id, at)
}

// ── PP-30 vehicles ──────────────────────────────────────────────────────────

export interface VehicleInput {
  regNo: string
  type: string
  payloadKg: number
  docs: Record<VehicleDoc, IsoDate>
  fastagId?: string
  gpsId?: string
  ownership: 'own' | 'attached'
}

export type VehicleError = 'required' | 'vahan' | 'duplicate' | 'fastag'

const LINE_HAUL_TYPES = ['14–17 ft', '19–24 ft', '32 ft']

/** Add / edit: the registration is verified on Vahan (SIMULATED); FASTag is needed for line-haul trucks. */
export function saveVehicle(data: DemoData, partnerId: Id, x: VehicleInput, id: Id | undefined, by: Id, at: IsoDateTime): { data: DemoData; id?: Id; error?: VehicleError } {
  const reg = x.regNo.replace(/\s/g, '').toUpperCase()
  if (!reg || !x.type || !(x.payloadKg > 0) || VEHICLE_DOCS.some((k) => !x.docs[k])) return { data, error: 'required' }
  const old = id ? data.vehicles[id] : undefined
  if (!old || old.regNo !== reg) {
    const v = vahanCheck(data, reg, partnerId)
    if (!v.ok) return { data, error: v.detail.reason === 'duplicate' ? 'duplicate' : 'vahan' }
    if (Object.values(data.vehicles).some((o) => o.regNo === reg && o.id !== id)) return { data, error: 'duplicate' }
  }
  if (LINE_HAUL_TYPES.includes(x.type) && !x.fastagId?.trim()) return { data, error: 'fastag' }
  const vid = old?.id ?? `V-${reg}`
  const vehicle: Vehicle = { ...old, id: vid, partnerId, regNo: reg, type: x.type, payloadKg: x.payloadKg, docs: x.docs, docExpiry: vehicleExpiry({ docs: x.docs, docExpiry: '' }), fastagId: x.fastagId?.trim() || undefined, gpsId: x.gpsId?.trim() || undefined, ownership: x.ownership, active: old?.active ?? true }
  return { data: log({ ...data, vehicles: { ...data.vehicles, [vid]: vehicle } }, by, old ? 'vehicle.edit' : 'vehicle.add', vid, at), id: vid }
}

export function setVehicleActive(data: DemoData, id: Id, active: boolean, by: Id, at: IsoDateTime): DemoData {
  const v = data.vehicles[id]
  if (!v || (v.active ?? true) === active) return data
  // Staff whose default vehicle is deactivated lose it as default
  const fieldStaff = active ? data.fieldStaff : Object.fromEntries(Object.entries(data.fieldStaff).map(([k, s]) => [k, s.vehicleId === id ? { ...s, vehicleId: undefined } : s]))
  return log({ ...data, fieldStaff, vehicles: { ...data.vehicles, [id]: { ...v, active } } }, by, active ? 'vehicle.activate' : 'vehicle.deactivate', id, at)
}

// ── PP-31 hubs ──────────────────────────────────────────────────────────────

export type HubInput = Pick<Hub, 'name' | 'address' | 'pincode' | 'docks' | 'hours' | 'areaSqft' | 'storagePallets' | 'scaleCalibrationTill' | 'fireNocTill' | 'tradeLicenceTill' | 'leaseTill' | 'cctv' | 'fireSafety'>

/** Add hub: triggers a new audit (source §4 Step 4); edit keeps the audit status. */
export function saveHub(data: DemoData, partnerId: Id, x: HubInput, id: Id | undefined, by: Id, at: IsoDateTime): { data: DemoData; id?: Id; error?: 'required' | 'notServiceable' | 'safety' } {
  if (!x.name.trim() || !x.address.trim() || !(x.docks > 0) || !x.hours.trim() || !(Number(x.areaSqft) > 0) || !x.scaleCalibrationTill) return { data, error: 'required' }
  if (!data.pincodes[x.pincode.trim()]?.serviceable) return { data, error: 'notServiceable' }
  if (!x.cctv || !x.fireSafety) return { data, error: 'safety' }
  const old = id ? data.hubs[id] : undefined
  const p = data.partners[partnerId]
  const hid = old?.id ?? nextNo(Object.keys(data.hubs), `H-${partnerId.replace(/^P-/, '')}-`)
  const hub: Hub = { ...old, ...x, id: hid, partnerId, name: x.name.trim(), address: x.address.trim(), pincode: x.pincode.trim(), auditStatus: old?.auditStatus ?? 'pending', addedAt: old?.addedAt ?? at }
  let next: DemoData = { ...data, hubs: { ...data.hubs, [hid]: hub } }
  if (!old) {
    next = setPartner(next, { ...p, hubIds: [...p.hubIds, hid] })
    next = notify(next, { app: 'erp', role: 'hubAuditor' }, 'Hub audit needed', `${p.shortName} · ${hub.name}`, '/erp/partners/kyc', at)
  }
  return { data: log(next, by, old ? 'hub.edit' : 'hub.add', hid, at), id: hid }
}

// ── PP-32 renewals ──────────────────────────────────────────────────────────

/**
 * Upload renewal: the new expiry is written to the document's owner at once
 * and the row shows Under review until Logisco's SIMULATED check is done.
 */
export function uploadRenewal(data: DemoData, partnerId: Id, docId: Id, file: string, newExpiry: IsoDate, by: Id, at: IsoDateTime): DemoData {
  if (!file || !newExpiry || newExpiry <= at.slice(0, 10)) return data
  const [owner, ownerId, kind] = docId.split(':')
  let next = data
  if (owner === 'CO') {
    const p = data.partners[ownerId]
    if (!p || p.id !== partnerId) return data
    next = setPartner(data, { ...p, companyDocs: (p.companyDocs ?? []).map((d) => (d.key === kind ? { ...d, expiry: newExpiry, file } : d)) })
  } else if (owner === 'VH') {
    const v = data.vehicles[ownerId]
    if (!v || v.partnerId !== partnerId) return data
    const docs = { ...(v.docs ?? { rc: v.docExpiry, fitness: v.docExpiry, permit: v.docExpiry, insurance: v.docExpiry }), [kind]: newExpiry }
    next = { ...data, vehicles: { ...data.vehicles, [v.id]: { ...v, docs, docExpiry: vehicleExpiry({ docs, docExpiry: v.docExpiry }) } } }
  } else if (owner === 'ST') {
    const s = data.fieldStaff[ownerId]
    if (!s || s.partnerId !== partnerId) return data
    const patch: Partial<FieldStaff> = kind === 'licence' ? { licenceValidTill: newExpiry } : { policeVerified: true, policeVerifiedOn: at.slice(0, 10) }
    next = { ...data, fieldStaff: { ...data.fieldStaff, [s.id]: { ...s, ...patch } } }
  } else if (owner === 'HB') {
    const h = data.hubs[ownerId]
    if (!h || h.partnerId !== partnerId || !(kind in HUB_DOC_FIELD)) return data
    next = { ...data, hubs: { ...data.hubs, [h.id]: { ...h, [HUB_DOC_FIELD[kind as HubDoc]]: newExpiry } } }
  } else return data
  next = { ...next, docRenewals: { ...next.docRenewals, [docId]: { id: docId, partnerId, file, newExpiry, at, by, reviewDoneAt: addHours(at, RENEWAL_REVIEW_HOURS) } } }
  return log(next, by, 'document.renew', docId, at, undefined, { newExpiry })
}

// ── PP-33 company ───────────────────────────────────────────────────────────

/** Bank change: OTP (checked by the screen) and a new SIMULATED penny-drop against the partner's legal name. */
export function changePartnerBank(data: DemoData, partnerId: Id, b: { holder: string; account: string; ifsc: string }, by: Id, at: IsoDateTime): { data: DemoData; ok: boolean; matchPct: number; nameReturned: string } {
  const p = data.partners[partnerId]
  if (!p?.profile || digits(b.account).length < 9 || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(b.ifsc.trim())) return { data, ok: false, matchPct: 0, nameReturned: '' }
  const r = pennyDrop(b.ifsc, b.holder, p.name)
  if (!r.ok) return { data, ok: false, matchPct: r.matchPct, nameReturned: r.nameReturned }
  const bank = { name: r.bankName, branch: r.branch, ifsc: b.ifsc.trim().toUpperCase(), account: digits(b.account) }
  return { data: log(setPartner(data, { ...p, profile: { ...p.profile, bank } }), by, 'bank.change', partnerId, at, `••${p.profile.bank.account.slice(-4)}`, `••${bank.account.slice(-4)}`), ok: true, matchPct: r.matchPct, nameReturned: r.nameReturned }
}

/** Request exit: starts partner-initiated offboarding (source §5.4 trigger "partner request"; PP-39). */
export function requestExit(data: DemoData, partnerId: Id, reason: string, by: Id, at: IsoDateTime): DemoData {
  if (!reason.trim()) return data
  const next = openSuspensionCase(data, partnerId, 'partnerRequest', `Partner asked to exit: ${reason.trim()}`, by, at)
  if (next === data) return data
  const c = Object.values(next.suspensionCases).find((x) => x.partnerId === partnerId && x.step !== 'closed')!
  return { ...next, suspensionCases: { ...next.suspensionCases, [c.id]: { ...c, log: c.log.map((l, i) => (i === 0 ? { ...l, app: 'partnerPortal' as const } : l)) } } }
}

// ── PP-34 portal users ──────────────────────────────────────────────────────

export interface PortalUserInput {
  name: string
  email: string
  mobile: string
  role: PartnerRole
  hubIds: Id[]
}

export type PortalUserError = 'required' | 'emailTaken' | 'lastAdmin'

export function invitePortalUser(data: DemoData, partnerId: Id, x: PortalUserInput, by: Id, at: IsoDateTime): { data: DemoData; id?: Id; error?: PortalUserError } {
  if (!x.name.trim() || !/^\S+@\S+\.\S+$/.test(x.email.trim()) || digits(x.mobile).length !== 10) return { data, error: 'required' }
  if (Object.values(data.partnerUsers).some((u) => u.email.toLowerCase() === x.email.trim().toLowerCase())) return { data, error: 'emailTaken' }
  const id = nextNo(Object.keys(data.partnerUsers), `PU-NEW-`, 3)
  const u: PartnerUser = { id, partnerId, name: x.name.trim(), email: x.email.trim(), mobile: x.mobile.trim(), role: x.role, hubIds: x.hubIds, status: 'invited', invitedAt: at }
  return { data: log({ ...data, partnerUsers: { ...data.partnerUsers, [id]: u } }, by, 'user.invite', id, at, undefined, { role: x.role }), id }
}

export function updatePortalUser(data: DemoData, id: Id, x: Pick<PortalUserInput, 'name' | 'mobile' | 'role' | 'hubIds'>, by: Id, at: IsoDateTime): { data: DemoData; error?: PortalUserError } {
  const u = data.partnerUsers[id]
  if (!u || !x.name.trim() || digits(x.mobile).length !== 10) return { data, error: 'required' }
  if (x.role !== 'admin' && isLastPartnerAdmin(data, u)) return { data, error: 'lastAdmin' }
  return { data: log({ ...data, partnerUsers: { ...data.partnerUsers, [id]: { ...u, name: x.name.trim(), mobile: x.mobile.trim(), role: x.role, hubIds: x.hubIds } } }, by, 'user.edit', id, at, u.role, x.role) }
}

export function setPortalUserEnabled(data: DemoData, id: Id, enabled: boolean, by: Id, at: IsoDateTime): { data: DemoData; error?: PortalUserError } {
  const u = data.partnerUsers[id]
  if (!u) return { data }
  if (!enabled && isLastPartnerAdmin(data, u)) return { data, error: 'lastAdmin' }
  const status = enabled ? (u.lastLoginAt || !u.invitedAt ? 'active' : 'invited') : 'disabled'
  if (status === portalUserStatus(u)) return { data }
  return { data: log({ ...data, partnerUsers: { ...data.partnerUsers, [id]: { ...u, status } } }, by, enabled ? 'user.enable' : 'user.disable', id, at) }
}

export function recordPartnerLogin(data: DemoData, id: Id, at: IsoDateTime): DemoData {
  const u = data.partnerUsers[id]
  if (!u || portalUserStatus(u) === 'disabled') return data
  return { ...data, partnerUsers: { ...data.partnerUsers, [id]: { ...u, status: 'active', lastLoginAt: at } } }
}

export function setPortalUserLanguage(data: DemoData, id: Id, language: 'en' | 'hi'): DemoData {
  const u = data.partnerUsers[id]
  return u ? { ...data, partnerUsers: { ...data.partnerUsers, [id]: { ...u, language } } } : data
}

// ── PP-35 API ───────────────────────────────────────────────────────────────

const integrationOf = (p: Partner): PartnerIntegration => p.integration ?? { apiKeys: [], statusMapping: [], errors: [] }
const setIntegration = (data: DemoData, p: Partner, patch: Partial<PartnerIntegration>) => setPartner(data, { ...p, integration: { ...integrationOf(p), ...patch } })

export function createPartnerApiKey(data: DemoData, partnerId: Id, name: string, env: ApiKey['env'], by: Id, at: IsoDateTime): { data: DemoData; key?: string } {
  const p = data.partners[partnerId]
  if (!p || !name.trim() || (env === 'production' && p.status !== 'live' && p.status !== 'trial')) return { data }
  const keys = integrationOf(p).apiKeys
  const id = `KEY-${keys.length + 1}`
  const key = simulateApiKey(env, `${partnerId}:${id}:${at}`).replace(/^lg_/, 'lg_p_')
  return { data: log(setIntegration(data, p, { apiKeys: [...keys, { id, name: name.trim(), env, last4: key.slice(-4), createdAt: at }] }), by, 'apiKey.create', `${partnerId} · ${id}`, at), key }
}

export function revokePartnerApiKey(data: DemoData, partnerId: Id, keyId: Id, by: Id, at: IsoDateTime): DemoData {
  const p = data.partners[partnerId]
  const keys = p ? integrationOf(p).apiKeys : []
  if (!p || !keys.some((k) => k.id === keyId && !k.revokedAt)) return data
  return log(setIntegration(data, p, { apiKeys: keys.map((k) => (k.id === keyId ? { ...k, revokedAt: at } : k)) }), by, 'apiKey.revoke', `${partnerId} · ${keyId}`, at)
}

/** Job push webhook: HTTPS only; returns the signing secret once. */
export function setJobWebhook(data: DemoData, partnerId: Id, url: string, events: JobPushEvent[], by: Id, at: IsoDateTime): { data: DemoData; secret?: string } {
  const p = data.partners[partnerId]
  if (!p || !/^https:\/\/[^\s/]+\.[^\s]+$/.test(url.trim()) || !events.length) return { data }
  const old = integrationOf(p).webhook
  const secret = old && old.url === url.trim() ? undefined : simulateSecret(`${partnerId}:${url}:${at}`)
  const webhook = { url: url.trim(), events, secretLast4: secret ? secret.slice(-4) : old!.secretLast4, lastTest: secret ? undefined : old?.lastTest }
  return { data: log(setIntegration(data, p, { webhook }), by, 'webhook.save', partnerId, at, old?.url, url.trim()), secret }
}

export function testJobWebhook(data: DemoData, partnerId: Id, at: IsoDateTime): { data: DemoData; status?: number; ms?: number } {
  const p = data.partners[partnerId]
  const w = p && integrationOf(p).webhook
  if (!p || !w) return { data }
  const r = simulateWebhookTest(w.url)
  return { data: setIntegration(data, p, { webhook: { ...w, lastTest: { at, status: r.status } } }), ...r }
}

export function saveStatusMapping(data: DemoData, partnerId: Id, mapping: PartnerIntegration['statusMapping'], by: Id, at: IsoDateTime): DemoData {
  const p = data.partners[partnerId]
  const clean = mapping.map((m) => ({ ...m, code: m.code.trim().toUpperCase() })).filter((m) => m.code)
  if (!p || new Set(clean.map((m) => m.code)).size !== clean.length) return data
  return log(setIntegration(data, p, { statusMapping: clean }), by, 'statusMapping.save', partnerId, at)
}
