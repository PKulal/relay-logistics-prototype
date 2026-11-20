/**
 * Network planning actions (source §11 Dept 6; §5.1 declare capacity; §8).
 * ERP-18 pincode edits, ERP-19 lane edits, ERP-20 leg-time changes
 * (maker-checker), PP-18 capacity calendar, PP-19 coverage change requests
 * decided in ERP-21, and ERP-21 recruitment needs. Every edit is audited.
 */
import type { DemoData, Id, IsoDate, IsoDateTime, Lane, LegType, Notification, Pincode, SettingsChange } from '@shared/types'
import { audit } from './erpActions'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

// ── ERP-18 ──────────────────────────────────────────────────────────────────

export type PincodeEdit = Partial<Pick<Pincode, 'oda' | 'serviceable' | 'hubId'>>

export function updatePincode(data: DemoData, code: string, edit: PincodeEdit, by: Id, at: IsoDateTime): DemoData {
  const p = data.pincodes[code]
  if (!p) return data
  return audit({ ...data, pincodes: { ...data.pincodes, [code]: { ...p, ...edit } } }, { userId: by, app: 'erp', action: 'pincode.edit', recordId: code, at, before: { oda: p.oda, serviceable: p.serviceable, hubId: p.hubId }, after: edit })
}

export type NewPincode = Pick<Pincode, 'code' | 'area' | 'city' | 'state' | 'region' | 'hubId' | 'oda' | 'metro'>

/** A new pincode, placed at its hub's location until a geocode is available (SIMULATED). */
export function addPincode(data: DemoData, x: NewPincode, by: Id, at: IsoDateTime): DemoData {
  if (!/^\d{6}$/.test(x.code) || data.pincodes[x.code] || !x.area.trim() || !x.city.trim() || !x.state.trim()) return data
  const hubPin = x.hubId ? data.pincodes[data.hubs[x.hubId]?.pincode ?? ''] : undefined
  const p: Pincode = { ...x, id: x.code, area: x.area.trim(), city: x.city.trim(), state: x.state.trim(), special: false, serviceable: true, lat: hubPin?.lat ?? 20.6, lng: hubPin?.lng ?? 78.9 }
  return audit({ ...data, pincodes: { ...data.pincodes, [x.code]: p } }, { userId: by, app: 'erp', action: 'pincode.add', recordId: x.code, at, after: p })
}

// ── ERP-19 ──────────────────────────────────────────────────────────────────

export type LaneEdit = Partial<Pick<Lane, 'transitDays' | 'distanceKm' | 'departureTime'>>

/** Quotes and ETAs for new bookings use the new values. */
export function updateLane(data: DemoData, id: Id, edit: LaneEdit, by: Id, at: IsoDateTime): DemoData {
  const l = data.lanes[id]
  if (!l || (edit.departureTime && !HHMM.test(edit.departureTime)) || (edit.distanceKm !== undefined && !(edit.distanceKm > 0)) || (edit.transitDays && Object.values(edit.transitDays).some((d) => !(d >= 1)))) return data
  return audit({ ...data, lanes: { ...data.lanes, [id]: { ...l, ...edit } } }, { userId: by, app: 'erp', action: 'lane.edit', recordId: id, at, before: { transitDays: l.transitDays, distanceKm: l.distanceKm, departureTime: l.departureTime }, after: edit })
}

// ── ERP-20 ──────────────────────────────────────────────────────────────────

/** Maker: propose new cut-off / hand-over times; they apply once approved. */
export function proposeSettings(data: DemoData, changes: SettingsChange['changes'], reason: string, by: Id, at: IsoDateTime): { data: DemoData; id?: Id } {
  const entries = Object.entries(changes).filter(([k, v]) => v !== data.settings[k as keyof typeof changes])
  if (!entries.length || entries.some(([, v]) => !HHMM.test(String(v))) || !reason.trim() || Object.values(data.settingsChanges).some((c) => c.status === 'pending')) return { data }
  const id = `SET-${String(Object.keys(data.settingsChanges).length + 1).padStart(3, '0')}`
  const change: SettingsChange = { id, changes: Object.fromEntries(entries), reason: reason.trim(), by, at, status: 'pending' }
  let next: DemoData = { ...data, settingsChanges: { ...data.settingsChanges, [id]: change } }
  next = notify(next, { app: 'erp', role: 'leadership' }, 'Leg rule change to approve', `${id} · ${reason.trim()}`, '/erp/network/rules', at)
  return { data: audit(next, { userId: by, app: 'erp', action: 'settings.propose', recordId: id, at, after: change.changes }), id }
}

/** Checker (not the maker): approve applies the change to new bookings. */
export function decideSettings(data: DemoData, id: Id, approve: boolean, by: Id, at: IsoDateTime): DemoData {
  const c = data.settingsChanges[id]
  if (!c || c.status !== 'pending' || c.by === by) return data
  const next: DemoData = {
    ...data,
    settings: approve ? { ...data.settings, ...c.changes } : data.settings,
    settingsChanges: { ...data.settingsChanges, [id]: { ...c, status: approve ? 'approved' : 'rejected', checkerId: by, decidedAt: at } },
  }
  return audit(next, { userId: by, app: 'erp', action: approve ? 'settings.approve' : 'settings.reject', recordId: id, at, after: c.changes })
}

// ── PP-18 capacity calendar ─────────────────────────────────────────────────

export interface CapacityEdit {
  capacityPerDay?: number
  /** date → capacity; null removes the override */
  overrides?: Record<IsoDate, number | null>
  /** date → closed or open */
  closed?: Record<IsoDate, boolean>
}

/** The assignment engine uses the new capacity for future offers. */
export function setCapacity(data: DemoData, partnerId: Id, x: CapacityEdit, by: Id, at: IsoDateTime): DemoData {
  const p = data.partners[partnerId]
  if (!p || (x.capacityPerDay !== undefined && !(x.capacityPerDay > 0)) || Object.values(x.overrides ?? {}).some((v) => v !== null && !(v >= 0))) return data
  const overrides = { ...p.capacityOverrides }
  for (const [d, v] of Object.entries(x.overrides ?? {})) {
    if (v === null) delete overrides[d]
    else overrides[d] = v
  }
  const closed = new Set(p.closedDates ?? [])
  for (const [d, v] of Object.entries(x.closed ?? {})) {
    if (v) closed.add(d)
    else closed.delete(d)
  }
  const next = { ...p, capacityPerDay: x.capacityPerDay ?? p.capacityPerDay, capacityOverrides: overrides, closedDates: [...closed].sort() }
  return audit({ ...data, partners: { ...data.partners, [p.id]: next } }, { userId: by, app: 'partnerPortal', action: 'capacity.edit', recordId: p.id, at, after: x })
}

// ── PP-19 → ERP-21 coverage change requests ─────────────────────────────────

export interface CoverageChange {
  action: 'add' | 'remove'
  pincodes: string[]
  laneIds: Id[]
  effectiveFrom: IsoDate
  reason: string
}

export function requestCoverageChange(data: DemoData, partnerId: Id, x: CoverageChange, by: Id, at: IsoDateTime): { data: DemoData; id?: Id } {
  const p = data.partners[partnerId]
  const pins = [...new Set(x.pincodes.map((c) => c.trim()).filter(Boolean))]
  if (!p || (!pins.length && !x.laneIds.length) || !x.reason.trim() || pins.some((c) => !data.pincodes[c]) || x.laneIds.some((l) => !data.lanes[l])) return { data }
  const id = `CR-${String(Object.keys(data.coverageRequests).length + 1).padStart(4, '0')}`
  let next: DemoData = { ...data, coverageRequests: { ...data.coverageRequests, [id]: { id, partnerId, action: x.action, pincodes: pins, laneIds: x.laneIds, effectiveFrom: x.effectiveFrom, reason: x.reason.trim(), requestedBy: by, requestedAt: at, status: 'pending' } } }
  next = notify(next, { app: 'erp', role: 'networkPlanning' }, 'Coverage change request', `${p.shortName} · ${id}`, '/erp/network/gaps', at)
  return { data: next, id }
}

/** Approve: the partner's pincodes / lanes change, so assignment eligibility changes (source §8). */
export function decideCoverageChange(data: DemoData, id: Id, approve: boolean, note: string, by: Id, at: IsoDateTime): DemoData {
  const r = data.coverageRequests[id]
  if (!r || r.status !== 'pending' || (!approve && !note.trim())) return data
  let next: DemoData = { ...data, coverageRequests: { ...data.coverageRequests, [id]: { ...r, status: approve ? 'approved' : 'rejected', decidedBy: by, decidedAt: at, note: note.trim() || undefined } } }
  if (approve) {
    const p = next.partners[r.partnerId]
    const pins = new Set(p.coveragePincodes)
    const lanes = new Set(p.laneIds)
    for (const c of r.pincodes) {
      if (r.action === 'add') pins.add(c)
      else pins.delete(c)
    }
    for (const l of r.laneIds) {
      if (r.action === 'add') lanes.add(l)
      else lanes.delete(l)
    }
    const laneMap = { ...next.lanes }
    for (const l of r.laneIds) {
      const lane = laneMap[l]
      const ids = new Set(lane.lineHaulPartnerIds)
      if (r.action === 'add') ids.add(p.id)
      else ids.delete(p.id)
      laneMap[l] = { ...lane, lineHaulPartnerIds: [...ids] }
    }
    next = { ...next, lanes: laneMap, partners: { ...next.partners, [p.id]: { ...p, coveragePincodes: [...pins], laneIds: [...lanes] } } }
  }
  next = notify(next, { app: 'partnerPortal', partnerId: r.partnerId }, approve ? 'Coverage change approved' : 'Coverage change rejected', `${id}${note.trim() ? ` · ${note.trim()}` : ''}`, '/partner/coverage', at)
  return audit(next, { userId: by, app: 'erp', action: approve ? 'coverage.approve' : 'coverage.reject', recordId: id, at, after: { note } })
}

// ── ERP-21 recruitment needs ────────────────────────────────────────────────

export function createRecruitmentNeed(data: DemoData, legType: LegType, place: string, by: Id, at: IsoDateTime): DemoData {
  if (Object.values(data.recruitmentNeeds).some((n) => n.open && n.legType === legType && n.place === place)) return data
  const id = `RN-${String(Object.keys(data.recruitmentNeeds).length + 1).padStart(3, '0')}`
  const next = { ...data, recruitmentNeeds: { ...data.recruitmentNeeds, [id]: { id, legType, place, createdBy: by, createdAt: at, open: true } } }
  return audit(notify(next, { app: 'erp', role: 'partnerManagement' }, 'Recruitment need', `${legType} · ${place}`, '/erp/partners/applications', at), { userId: by, app: 'erp', action: 'recruitment.need', recordId: id, at, after: { legType, place } })
}
