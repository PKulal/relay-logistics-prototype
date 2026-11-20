/**
 * Customer Portal settings and support (CP-28 to CP-34, CP-37). Notifications
 * are marked read with pickupActions.markRead.
 * Every change is written to the audit log (ERP-43).
 */
import { isLastAdmin, serviceable, skuCodeTaken, userStatus } from '@shared/engines/customerSettings'
import { pennyDrop } from '@shared/engines/onboarding'
import { ticketDue } from '@shared/engines/departments'
import { simulateApiKey, simulateSecret, simulateWebhookTest } from '@shared/sim/keys'
import type { ApiKey, Consignee, Customer, CustomerRole, CustomerUser, DemoData, Id, IsoDateTime, Notification, PickupLocation, Sku, Ticket, TicketCategory, Webhook, WebhookEvent } from '@shared/types'
import { skuOutlier } from './contractActions'
import { audit } from './erpActions'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const setCustomer = (data: DemoData, c: Customer): DemoData => ({ ...data, customers: { ...data.customers, [c.id]: c } })
const log = (data: DemoData, by: Id, action: string, recordId: Id, at: IsoDateTime, before?: unknown, after?: unknown) => audit(data, { userId: by, app: 'customer', action, recordId, at, before, after })
const nextNo = (keys: string[], prefix: string, pad = 3) => `${prefix}${String(Math.max(0, ...keys.filter((k) => k.startsWith(prefix)).map((k) => Number(/(\d+)$/.exec(k)?.[1] ?? 0))) + 1).padStart(pad, '0')}`

// ── CP-28 users ─────────────────────────────────────────────────────────────

export interface UserInput {
  name: string
  email: string
  mobile: string
  role: CustomerRole
  locationIds: Id[]
  language: 'en' | 'hi'
}

export type UserError = 'required' | 'emailTaken' | 'lastAdmin'

const emailTaken = (data: DemoData, email: string, exceptId?: Id) => Object.values(data.customerUsers).some((u) => u.id !== exceptId && u.email.toLowerCase() === email.trim().toLowerCase())

/** Invite: Email and SMS invite (SIMULATED); status Invited until first login. */
export function inviteCustomerUser(data: DemoData, customerId: Id, x: UserInput, by: Id, at: IsoDateTime): { data: DemoData; id?: Id; error?: UserError } {
  if (!x.name.trim() || !/^\S+@\S+\.\S+$/.test(x.email.trim()) || x.mobile.replace(/\D/g, '').length !== 10) return { data, error: 'required' }
  if (emailTaken(data, x.email)) return { data, error: 'emailTaken' }
  const id = nextNo(Object.keys(data.customerUsers), 'CU-NEW-')
  const user: CustomerUser = { id, customerId, name: x.name.trim(), email: x.email.trim(), mobile: x.mobile.trim(), role: x.role, locationIds: x.locationIds, language: x.language, status: 'invited', invitedAt: at }
  return { data: log({ ...data, customerUsers: { ...data.customerUsers, [id]: user } }, by, 'user.invite', id, at, undefined, { role: x.role }), id }
}

/** Edit / change role: takes effect on the user's next action. The last Admin can't be downgraded. */
export function updateCustomerUser(data: DemoData, id: Id, x: Omit<UserInput, 'email'>, by: Id, at: IsoDateTime): { data: DemoData; error?: UserError } {
  const u = data.customerUsers[id]
  if (!u || !x.name.trim() || x.mobile.replace(/\D/g, '').length !== 10) return { data, error: 'required' }
  if (x.role !== 'admin' && isLastAdmin(data, u)) return { data, error: 'lastAdmin' }
  const next: CustomerUser = { ...u, name: x.name.trim(), mobile: x.mobile.trim(), role: x.role, locationIds: x.locationIds, language: x.language }
  return { data: log({ ...data, customerUsers: { ...data.customerUsers, [id]: next } }, by, 'user.edit', id, at, { role: u.role, locationIds: u.locationIds }, { role: x.role, locationIds: x.locationIds }) }
}

/** Disable / enable. Disabled users can't log in; the last active Admin can't be disabled. */
export function setCustomerUserEnabled(data: DemoData, id: Id, enabled: boolean, by: Id, at: IsoDateTime): { data: DemoData; error?: UserError } {
  const u = data.customerUsers[id]
  if (!u) return { data }
  if (!enabled && isLastAdmin(data, u)) return { data, error: 'lastAdmin' }
  const status = enabled ? (u.lastLoginAt || !u.invitedAt ? 'active' : 'invited') : 'disabled'
  if (status === userStatus(u)) return { data }
  return { data: log({ ...data, customerUsers: { ...data.customerUsers, [id]: { ...u, status } } }, by, enabled ? 'user.enable' : 'user.disable', id, at, userStatus(u), status) }
}

export function resendInvite(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const u = data.customerUsers[id]
  if (!u || userStatus(u) === 'disabled') return data
  return log({ ...data, customerUsers: { ...data.customerUsers, [id]: { ...u, invitedAt: userStatus(u) === 'invited' ? at : u.invitedAt } } }, by, userStatus(u) === 'invited' ? 'user.resendInvite' : 'user.resetPassword', id, at)
}

/** Persona login: an invited user becomes active on first login. */
export function recordCustomerLogin(data: DemoData, id: Id, at: IsoDateTime): DemoData {
  const u = data.customerUsers[id]
  if (!u || userStatus(u) === 'disabled') return data
  return { ...data, customerUsers: { ...data.customerUsers, [id]: { ...u, status: 'active', lastLoginAt: at } } }
}

// ── CP-29 pickup locations ──────────────────────────────────────────────────

export type LocationInput = Pick<PickupLocation, 'name' | 'address' | 'pincode' | 'contact' | 'window' | 'days'>

export function savePickupLocation(data: DemoData, customerId: Id, x: LocationInput, id: Id | undefined, by: Id, at: IsoDateTime): { data: DemoData; id?: Id; error?: 'required' | 'notServiceable' } {
  if (!x.name.trim() || !x.address.trim() || !x.contact.name.trim() || x.contact.mobile.replace(/\D/g, '').length !== 10 || x.window.from >= x.window.to) return { data, error: 'required' }
  if (!serviceable(data, x.pincode)) return { data, error: 'notServiceable' }
  const pin = data.pincodes[x.pincode.trim()]
  const old = id ? data.pickupLocations[id] : undefined
  const lid = old?.id ?? nextNo(Object.keys(data.pickupLocations), `PL-${customerId.replace(/^C-/, '')}-`, 2)
  const own = Object.values(data.pickupLocations).filter((l) => l.customerId === customerId)
  // A new address is pinned at the pincode centre (SIMULATED geocode); an unchanged pincode keeps its pin
  const keepPin = old && old.pincode === x.pincode.trim()
  const loc: PickupLocation = { ...old, ...x, name: x.name.trim(), address: x.address.trim(), pincode: x.pincode.trim(), id: lid, customerId, lat: keepPin ? old.lat : pin.lat, lng: keepPin ? old.lng : pin.lng, isDefault: old?.isDefault ?? own.length === 0, active: old?.active ?? true }
  return { data: log({ ...data, pickupLocations: { ...data.pickupLocations, [lid]: loc } }, by, old ? 'location.edit' : 'location.add', lid, at), id: lid }
}

/** Deactivate / activate. The default location can't be deactivated (set another default first). */
export function setLocationActive(data: DemoData, id: Id, active: boolean, by: Id, at: IsoDateTime): DemoData {
  const l = data.pickupLocations[id]
  if (!l || (!active && l.isDefault)) return data
  return log({ ...data, pickupLocations: { ...data.pickupLocations, [id]: { ...l, active } } }, by, active ? 'location.activate' : 'location.deactivate', id, at)
}

export function setDefaultLocation(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const l = data.pickupLocations[id]
  if (!l || l.active === false || l.isDefault) return data
  const locs = { ...data.pickupLocations }
  for (const x of Object.values(locs)) if (x.customerId === l.customerId) locs[x.id] = { ...x, isDefault: x.id === id }
  return log({ ...data, pickupLocations: locs }, by, 'location.default', id, at)
}

// ── CP-30 address book ──────────────────────────────────────────────────────

export type ConsigneeInput = Omit<Consignee, 'id' | 'customerId' | 'saved'>

export function saveAddress(data: DemoData, customerId: Id, x: ConsigneeInput, id: Id | undefined, by: Id, at: IsoDateTime): { data: DemoData; id?: Id; error?: 'required' | 'notServiceable' } {
  if (!x.company.trim() || !x.contact.trim() || x.mobile.replace(/\D/g, '').length !== 10 || !x.address.trim()) return { data, error: 'required' }
  if (!serviceable(data, x.pincode)) return { data, error: 'notServiceable' }
  const cid = id && data.consignees[id] ? id : nextNo(Object.keys(data.consignees), `CN-${customerId.replace(/^C-/, '')}-`)
  const c: Consignee = { ...x, company: x.company.trim(), contact: x.contact.trim(), pincode: x.pincode.trim(), receivingHours: x.receivingHours?.trim() || undefined, id: cid, customerId, saved: true }
  return { data: log({ ...data, consignees: { ...data.consignees, [cid]: c } }, by, id ? 'consignee.edit' : 'consignee.add', cid, at), id: cid }
}

/** Delete from the address book; the record stays for the shipments that used it. */
export function removeAddress(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.consignees[id]
  if (!c || c.saved === false) return data
  return log({ ...data, consignees: { ...data.consignees, [id]: { ...c, saved: false } } }, by, 'consignee.delete', id, at)
}

/** Import from Excel: rows with a missing field or an unserviceable pincode are skipped. */
export function importAddresses(data: DemoData, customerId: Id, rows: ConsigneeInput[], by: Id, at: IsoDateTime): { data: DemoData; added: number; skipped: number } {
  let next = data
  let added = 0
  for (const r of rows) {
    const res = saveAddress(next, customerId, r, undefined, by, at)
    if (res.id) {
      next = res.data
      added++
    }
  }
  return { data: next, added, skipped: rows.length - added }
}

// ── CP-31 SKU master ────────────────────────────────────────────────────────

export type SkuInput = Pick<Sku, 'code' | 'description' | 'l' | 'b' | 'h' | 'weight' | 'hsn' | 'unitValue'>

/**
 * Add / edit a SKU. The SIMULATED AI check runs on every save: an outlier is
 * Flagged; a plausible SKU is verified by Logisco (SIMULATED, instant) and its
 * weight Frozen. Editing a Frozen SKU's size or weight re-runs verification.
 */
export function saveSku(data: DemoData, customerId: Id, x: SkuInput, id: Id | undefined, by: Id, at: IsoDateTime): { data: DemoData; id?: Id; error?: 'required' | 'codeTaken' } {
  if (!x.code.trim() || !x.description.trim() || ![x.l, x.b, x.h, x.weight].every((n) => n > 0)) return { data, error: 'required' }
  if (skuCodeTaken(data, customerId, x.code, id)) return { data, error: 'codeTaken' }
  const old = id ? data.skus[id] : undefined
  const sid = old?.id ?? `SKU-${customerId.replace(/^C-/, '')}-${x.code.trim()}`
  const sameSize = old && old.l === x.l && old.b === x.b && old.h === x.h && old.weight === x.weight
  const status: Sku['status'] = sameSize ? old.status : skuOutlier(x) ? 'flagged' : 'frozen'
  const sku: Sku = { id: sid, customerId, ...x, code: x.code.trim(), description: x.description.trim(), hsn: x.hsn.trim(), status }
  return { data: log({ ...data, skus: { ...data.skus, [sid]: sku } }, by, old ? 'sku.edit' : 'sku.add', sid, at, old && { l: old.l, b: old.b, h: old.h, weight: old.weight, status: old.status }, { l: x.l, b: x.b, h: x.h, weight: x.weight, status }), id: sid }
}

/** Review AI flag → Accept as is: goes to Logisco for a manual check (Draft). */
export function acceptSkuFlag(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const s = data.skus[id]
  if (!s || s.status !== 'flagged') return data
  return log({ ...data, skus: { ...data.skus, [id]: { ...s, status: 'draft' } } }, by, 'sku.acceptFlag', id, at)
}

export function importSkus(data: DemoData, customerId: Id, rows: SkuInput[], by: Id, at: IsoDateTime): { data: DemoData; added: number; flagged: number; skipped: number } {
  let next = data
  let added = 0
  let flagged = 0
  for (const r of rows) {
    const existing = Object.values(next.skus).find((s) => s.customerId === customerId && s.code === String(r.code ?? '').trim())
    const res = saveSku(next, customerId, r, existing?.id, by, at)
    if (res.id) {
      next = res.data
      added++
      if (next.skus[res.id].status === 'flagged') flagged++
    }
  }
  return { data: next, added, flagged, skipped: rows.length - added }
}

// ── CP-32 integrations ──────────────────────────────────────────────────────

const setIntegrations = (data: DemoData, c: Customer, patch: Partial<Customer['integrations']>) => setCustomer(data, { ...c, integrations: { ...c.integrations, ...patch } })

/** Generate key. Production keys only after go-live. Returns the full key once. */
export function createApiKey(data: DemoData, customerId: Id, name: string, env: ApiKey['env'], by: Id, at: IsoDateTime): { data: DemoData; key?: string } {
  const c = data.customers[customerId]
  if (!c || !name.trim() || (env === 'production' && c.status !== 'live')) return { data }
  const keys = c.integrations.apiKeys ?? []
  const id = `KEY-${keys.length + 1}`
  const key = simulateApiKey(env, `${customerId}:${id}:${at}`)
  const next = setIntegrations(data, c, { apiKeys: [...keys, { id, name: name.trim(), env, last4: key.slice(-4), createdAt: at }] })
  return { data: log(next, by, 'apiKey.create', `${customerId} · ${id}`, at, undefined, { env }), key }
}

export function revokeApiKey(data: DemoData, customerId: Id, keyId: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  const k = c?.integrations.apiKeys?.find((x) => x.id === keyId)
  if (!c || !k || k.revokedAt) return data
  return log(setIntegrations(data, c, { apiKeys: c.integrations.apiKeys!.map((x) => (x.id === keyId ? { ...x, revokedAt: at } : x)) }), by, 'apiKey.revoke', `${customerId} · ${keyId}`, at)
}

/** Add webhook: HTTPS only, at least one event. Returns the signing secret once. */
export function addWebhook(data: DemoData, customerId: Id, url: string, events: WebhookEvent[], by: Id, at: IsoDateTime): { data: DemoData; secret?: string } {
  const c = data.customers[customerId]
  if (!c || !/^https:\/\/[^\s/]+\.[^\s]+$/.test(url.trim()) || !events.length) return { data }
  const hooks = c.integrations.webhooks ?? []
  const id = `WH-${hooks.length + 1}`
  const secret = simulateSecret(`${customerId}:${id}:${at}`)
  const next = setIntegrations(data, c, { webhooks: [...hooks, { id, url: url.trim(), events, secretLast4: secret.slice(-4), createdAt: at }] })
  return { data: log(next, by, 'webhook.add', `${customerId} · ${id}`, at, undefined, { url: url.trim(), events }), secret }
}

export function removeWebhook(data: DemoData, customerId: Id, id: Id, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c?.integrations.webhooks?.some((w) => w.id === id)) return data
  return log(setIntegrations(data, c, { webhooks: c.integrations.webhooks.filter((w) => w.id !== id) }), by, 'webhook.remove', `${customerId} · ${id}`, at)
}

const patchHook = (data: DemoData, c: Customer, id: Id, patch: Partial<Webhook>) => setIntegrations(data, c, { webhooks: (c.integrations.webhooks ?? []).map((w) => (w.id === id ? { ...w, ...patch } : w)) })

export function regenerateSecret(data: DemoData, customerId: Id, id: Id, by: Id, at: IsoDateTime): { data: DemoData; secret?: string } {
  const c = data.customers[customerId]
  if (!c?.integrations.webhooks?.some((w) => w.id === id)) return { data }
  const secret = simulateSecret(`${customerId}:${id}:${at}:regen`)
  return { data: log(patchHook(data, c, id, { secretLast4: secret.slice(-4) }), by, 'webhook.secret', `${customerId} · ${id}`, at), secret }
}

/** Send test event: mock response 200 OK (SIMULATED). */
export function testWebhook(data: DemoData, customerId: Id, id: Id, at: IsoDateTime): { data: DemoData; status?: number; ms?: number } {
  const c = data.customers[customerId]
  const w = c?.integrations.webhooks?.find((x) => x.id === id)
  if (!c || !w) return { data }
  const r = simulateWebhookTest(w.url)
  return { data: patchHook(data, c, id, { lastTest: { at, status: r.status } }), ...r }
}

/** Connect / disconnect ERP (Tally / SAP / Zoho). SIMULATED connector, syncs every 15 minutes. */
export function setErpConnector(data: DemoData, customerId: Id, erp: 'tally' | 'sap' | 'zoho' | undefined, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c) return data
  const next = setIntegrations(data, c, { erp, tally: erp === 'tally', erpSync: erp ? { lastAt: at, everyMinutes: 15 } : undefined })
  return log(next, by, erp ? 'erp.connect' : 'erp.disconnect', customerId, at, c.integrations.erp, erp)
}

export function setOndcLink(data: DemoData, customerId: Id, sellerId: string | undefined, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c || (sellerId !== undefined && !sellerId.trim())) return data
  return log(setIntegrations(data, c, { ondcSellerId: sellerId?.trim() || undefined }), by, sellerId ? 'ondc.connect' : 'ondc.disconnect', customerId, at)
}

// ── CP-33 company profile ───────────────────────────────────────────────────

export function saveBillingPrefs(data: DemoData, customerId: Id, prefs: NonNullable<Customer['billingPrefs']>, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  const emails = prefs.emails.split(/[,;\s]+/).filter(Boolean)
  if (!c || !prefs.address.trim() || !emails.length || emails.some((e) => !/^\S+@\S+\.\S+$/.test(e))) return data
  return log(setCustomer(data, { ...c, billingPrefs: { ...prefs, address: prefs.address.trim(), emails: emails.join(', ') } }), by, 'billing.settings', customerId, at, c.billingPrefs, prefs)
}

/**
 * Bank change: OTP (checked by the screen) and a new SIMULATED penny-drop;
 * the account is changed only when the bank's name matches the legal name.
 */
export function changeBank(data: DemoData, customerId: Id, b: { holder: string; account: string; ifsc: string }, by: Id, at: IsoDateTime): { data: DemoData; ok: boolean; matchPct: number; nameReturned: string } {
  const c = data.customers[customerId]
  if (!c || b.account.replace(/\D/g, '').length < 9 || !/^[A-Z]{4}0[A-Z0-9]{6}$/i.test(b.ifsc.trim())) return { data, ok: false, matchPct: 0, nameReturned: '' }
  const r = pennyDrop(b.ifsc, b.holder, c.legalName)
  if (!r.ok) return { data, ok: false, matchPct: r.matchPct, nameReturned: r.nameReturned }
  const bank = { name: r.bankName, branch: r.branch, ifsc: b.ifsc.trim().toUpperCase(), account: b.account.replace(/\D/g, '') }
  return { data: log(setCustomer(data, { ...c, bank }), by, 'bank.change', customerId, at, c.bank && `••${c.bank.account.slice(-4)}`, `••${bank.account.slice(-4)}`), ok: true, matchPct: r.matchPct, nameReturned: r.nameReturned }
}

/** KYC document Replace: the new file goes to Logisco for review (upload SIMULATED). */
export function replaceKycDoc(data: DemoData, customerId: Id, kind: NonNullable<Customer['kycDocs']>[number]['kind'], file: string, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c || !file) return data
  const docs = (c.kycDocs ?? []).filter((d) => d.kind !== kind)
  const old = c.kycDocs?.find((d) => d.kind === kind)
  return log(setCustomer(data, { ...c, kycDocs: [...docs, { kind, file, uploadedAt: at, expiresOn: old?.expiresOn }] }), by, 'kyc.replace', customerId, at, old?.file, file)
}

// ── CP-34 preferences ───────────────────────────────────────────────────────

export function setUserLanguage(data: DemoData, userId: Id, language: 'en' | 'hi'): DemoData {
  const u = data.customerUsers[userId]
  if (!u || u.language === language) return data
  return { ...data, customerUsers: { ...data.customerUsers, [userId]: { ...u, language } } }
}

export function setConsigneeMessages(data: DemoData, customerId: Id, on: boolean, by: Id, at: IsoDateTime): DemoData {
  const c = data.customers[customerId]
  if (!c || (c.consigneeMessages ?? true) === on) return data
  return log(setCustomer(data, { ...c, consigneeMessages: on }), by, on ? 'consigneeMessages.on' : 'consigneeMessages.off', customerId, at)
}

// ── CP-37 help tickets ──────────────────────────────────────────────────────

export interface TicketInput {
  category: TicketCategory
  subject: string
  description: string
  shipmentId?: Id
  invoiceId?: Id
  attachment?: string
}

const ticketNo = (data: DemoData) => {
  const n = Math.max(0, ...Object.keys(data.tickets).map((k) => Number(/^TKT-\d{4}-(\d+)$/.exec(k)?.[1] ?? 0))) + 1
  return `TKT-2026-${n}`
}

/** Submit: ticket created; lands in the ERP-39 queue with its response SLA. */
export function raiseTicket(data: DemoData, customerId: Id, x: TicketInput, by: Id, at: IsoDateTime): { data: DemoData; id?: Id } {
  if (!data.customers[customerId] || !x.subject.trim() || !x.description.trim()) return { data }
  const shipmentId = x.shipmentId?.trim() || undefined
  if (shipmentId && data.shipments[shipmentId]?.customerId !== customerId) return { data }
  const id = ticketNo(data)
  const t: Ticket = {
    id,
    raisedBy: by,
    app: 'customer',
    customerId,
    category: x.category,
    subject: x.subject.trim(),
    shipmentId,
    invoiceId: x.invoiceId?.trim() || undefined,
    createdAt: at,
    dueAt: ticketDue(at, x.category),
    status: 'open',
    thread: [{ at, by, text: x.description.trim(), attachment: x.attachment || undefined }],
  }
  const next = notify({ ...data, tickets: { ...data.tickets, [id]: t } }, { app: 'erp', role: 'customerSuccess' }, 'New ticket', `${id} · ${data.customers[customerId].shortName}`, '/erp/customer-success', at)
  return { data: log(next, by, 'ticket.raise', id, at), id }
}

/** Customer reply: the ticket goes back to Logisco (In progress), reopening a Resolved one. */
export function customerReplyTicket(data: DemoData, id: Id, text: string, attachment: string | undefined, by: Id, at: IsoDateTime): DemoData {
  const t = data.tickets[id]
  if (!t || t.status === 'closed' || !text.trim()) return data
  const ticket: Ticket = { ...t, status: t.status === 'open' ? 'open' : 'inProgress', thread: [...t.thread, { at, by, text: text.trim(), attachment: attachment || undefined }] }
  return notify({ ...data, tickets: { ...data.tickets, [id]: ticket } }, { app: 'erp', role: 'customerSuccess' }, 'Customer replied', id, '/erp/customer-success', at)
}

/** Confirm resolved: only the customer can close a ticket (source §9 Auto-Ticket rule). */
export function confirmResolved(data: DemoData, id: Id, by: Id, at: IsoDateTime): DemoData {
  const t = data.tickets[id]
  if (!t || t.status !== 'resolved') return data
  return log({ ...data, tickets: { ...data.tickets, [id]: { ...t, status: 'closed' } } }, by, 'ticket.close', id, at)
}
