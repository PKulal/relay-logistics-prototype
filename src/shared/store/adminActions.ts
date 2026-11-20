/**
 * ERP administration (ERP-42 users and roles, ERP-44 system settings).
 * Source §14: role-based access, two-factor for staff, audit logs; tax and
 * e-way bill rules configurable without code. Every save is audited.
 */
import type { DemoData, ErpRole, Id, IsoDateTime, PermLevel, Settings, StaffUser } from '@shared/types'
import { audit } from './erpActions'

const log = (data: DemoData, by: Id, action: string, recordId: Id, at: IsoDateTime, before?: unknown, after?: unknown) => audit(data, { userId: by, app: 'erp', action, recordId, at, before, after })
const activeSuperAdmins = (data: DemoData) => Object.values(data.staff).filter((s) => s.role === 'superAdmin' && s.status !== 'disabled')

// ── ERP-42 users ────────────────────────────────────────────────────────────

export interface StaffInput {
  name: string
  email: string
  title: string
  role: ErpRole
  regions: string[]
}

export type StaffUserError = 'required' | 'emailTaken' | 'lastSuperAdmin' | 'self'

export function addStaffUser(data: DemoData, x: StaffInput, by: Id, at: IsoDateTime): { data: DemoData; id?: Id; error?: StaffUserError } {
  if (!x.name.trim() || !x.title.trim() || !/^\S+@logisco\.in$/i.test(x.email.trim())) return { data, error: 'required' }
  if (Object.values(data.staff).some((s) => s.email.toLowerCase() === x.email.trim().toLowerCase())) return { data, error: 'emailTaken' }
  const n = Math.max(0, ...Object.keys(data.staff).map((k) => Number(/^LS-U(\d+)$/.exec(k)?.[1] ?? 0))) + 1
  const id = `LS-U${String(n).padStart(3, '0')}`
  const user: StaffUser = { id, name: x.name.trim(), title: x.title.trim(), role: x.role, email: x.email.trim().toLowerCase(), regions: x.regions, status: 'active', addedAt: at }
  return { data: log({ ...data, staff: { ...data.staff, [id]: user } }, by, 'staff.add', id, at, undefined, { role: x.role, regions: x.regions }), id }
}

export function updateStaffUser(data: DemoData, id: Id, x: Omit<StaffInput, 'email'>, by: Id, at: IsoDateTime): { data: DemoData; error?: StaffUserError } {
  const u = data.staff[id]
  if (!u || !x.name.trim() || !x.title.trim()) return { data, error: 'required' }
  if (u.role === 'superAdmin' && x.role !== 'superAdmin' && activeSuperAdmins(data).length === 1) return { data, error: 'lastSuperAdmin' }
  const next: StaffUser = { ...u, name: x.name.trim(), title: x.title.trim(), role: x.role, regions: x.regions }
  return { data: log({ ...data, staff: { ...data.staff, [id]: next } }, by, 'staff.edit', id, at, { role: u.role, regions: u.regions ?? [] }, { role: x.role, regions: x.regions }) }
}

export function setStaffUserEnabled(data: DemoData, id: Id, enabled: boolean, by: Id, at: IsoDateTime): { data: DemoData; error?: StaffUserError } {
  const u = data.staff[id]
  if (!u) return { data }
  if (!enabled && id === by) return { data, error: 'self' }
  if (!enabled && u.role === 'superAdmin' && activeSuperAdmins(data).length === 1) return { data, error: 'lastSuperAdmin' }
  const status = enabled ? 'active' : 'disabled'
  if ((u.status ?? 'active') === status) return { data }
  return { data: log({ ...data, staff: { ...data.staff, [id]: { ...u, status } } }, by, enabled ? 'staff.enable' : 'staff.disable', id, at) }
}

// ── ERP-42 role editor ──────────────────────────────────────────────────────

/** Set one screen's level for a role. Super Admin always keeps Users and roles (no lock-out). */
export function setRolePermission(data: DemoData, role: ErpRole, screenId: string, level: PermLevel | undefined, by: Id, at: IsoDateTime): DemoData {
  if (role === 'superAdmin' && screenId === 'ERP-42' && level !== 'approve' && level !== undefined) return data
  const current = { ...(data.rolePermissions[role] ?? {}) }
  const before = current[screenId]
  if (before === level) return data
  if (level === undefined) delete current[screenId]
  else current[screenId] = level
  return log({ ...data, rolePermissions: { ...data.rolePermissions, [role]: current } }, by, 'role.permission', `${role} · ${screenId}`, at, before ?? 'default', level ?? 'default')
}

// ── ERP-44 settings ─────────────────────────────────────────────────────────

/** Fields ERP-44 edits directly. Pickup cut-off and leg windows go through ERP-20 (maker-checker). */
export type EditableSetting = Exclude<keyof Settings, 'pickupCutoff' | 'lineHaulArrival' | 'destHubHandoverBy' | 'intraRegionHubBy' | 'tierBands'>

export type SettingsPatch = Partial<Pick<Settings, EditableSetting | 'tierBands'>>

/** Limits that keep the demo sane (assumed). */
const RANGE: Partial<Record<EditableSetting, [number, number]>> = {
  ewayBillThreshold: [1000, 1000000],
  ewayBillKmPerDay: [50, 1000],
  targetMarginPct: [0, 60],
  riskBufferPct: [0, 20],
  partnerAcceptanceMinutes: [5, 240],
  arrivalGeofenceM: [50, 2000],
  weightTolerancePct: [0, 20],
  weightToleranceKg: [0, 20],
  ndrMaxAttempts: [1, 5],
  codDepositHours: [1, 72],
  codRemittanceDays: [0, 15],
  partnerDisputeSlaHours: [1, 240],
  claimSettlementDays: [1, 60],
  claimWindowDays: [1, 60],
  earlyPayFeePct: [0, 10],
  trialPassMark: [0, 100],
  probationVolumeCutPct: [0, 100],
  gstPct: [0, 28],
  volumetricDivisor: [1000, 10000],
  cftFactor: [1, 20],
}

export type SettingsError = { field: string; reason: 'range' | 'order' }

/** Save: effective immediately in every app; logged with before / after. */
export function updateSettings(data: DemoData, patch: SettingsPatch, by: Id, at: IsoDateTime): { data: DemoData; error?: SettingsError } {
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'tierBands') continue
    const r = RANGE[k as EditableSetting]
    if (r && (typeof v !== 'number' || Number.isNaN(v) || v < r[0] || v > r[1])) return { data, error: { field: k, reason: 'range' } }
  }
  if (patch.tierBands) {
    const b = patch.tierBands
    if (!(b.platinum <= 100 && b.platinum > b.gold && b.gold > b.silver && b.silver > b.bronze && b.bronze > 0)) return { data, error: { field: 'tierBands', reason: 'order' } }
  }
  const changed = Object.fromEntries(Object.entries(patch).filter(([k, v]) => JSON.stringify(data.settings[k as keyof Settings]) !== JSON.stringify(v)))
  if (!Object.keys(changed).length) return { data }
  const before = Object.fromEntries(Object.keys(changed).map((k) => [k, data.settings[k as keyof Settings]]))
  return { data: log({ ...data, settings: { ...data.settings, ...changed } }, by, 'settings.update', 'system-settings', at, before, changed) }
}
