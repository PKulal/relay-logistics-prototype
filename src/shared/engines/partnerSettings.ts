/**
 * Partner Portal settings rules (PP-29 to PP-35): the document register with
 * expiry status and 30 / 15 / 7-day alerts, vehicle and staff eligibility,
 * and portal-user admins.
 */
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { CompanyDocKey, DemoData, FieldStaff, Hub, Id, IsoDate, IsoDateTime, PartnerUser, Vehicle } from '@shared/types'

// ── PP-29 / PP-30 eligibility ───────────────────────────────────────────────

export const staffStatus = (s: FieldStaff) => s.status ?? 'active'

export const VEHICLE_DOCS = ['rc', 'fitness', 'permit', 'insurance'] as const
export type VehicleDoc = (typeof VEHICLE_DOCS)[number]

/** Earliest document expiry: the date the vehicle stops being assignable. */
export const vehicleExpiry = (v: Pick<Vehicle, 'docs' | 'docExpiry'>): IsoDate => (v.docs ? VEHICLE_DOCS.map((k) => v.docs![k]).sort()[0] : v.docExpiry)

export type VehicleBlock = 'inactive' | 'docsExpired'

/** PP-30 rule: a vehicle with an expired document (or deactivated) can't be assigned. */
export function vehicleBlock(v: Vehicle, now: IsoDateTime): VehicleBlock | undefined {
  if (v.active === false) return 'inactive'
  return vehicleExpiry(v) < istDate(now) ? 'docsExpired' : undefined
}

// ── PP-32 document register ─────────────────────────────────────────────────

export type DocOwner = 'company' | 'vehicle' | 'staff' | 'hub'
export type DocState = 'valid' | 'expiring' | 'expired' | 'underReview'
export type HubDoc = 'scaleCalibration' | 'fireNoc' | 'tradeLicence' | 'lease'
export type StaffDoc = 'licence' | 'police'

export interface DocRow {
  id: Id
  owner: DocOwner
  ownerId: Id
  ownerName: string
  kind: CompanyDocKey | VehicleDoc | HubDoc | StaffDoc
  number?: string
  expiry?: IsoDate
  status: DocState
  /** Alert band reached (assumed: 30, 15 and 7 days before expiry) */
  alert?: 30 | 15 | 7
  renewal?: { file: string; at: IsoDateTime }
}

export const HUB_DOC_FIELD: Record<HubDoc, keyof Hub> = { scaleCalibration: 'scaleCalibrationTill', fireNoc: 'fireNocTill', tradeLicence: 'tradeLicenceTill', lease: 'leaseTill' }

export function docState(expiry: IsoDate | undefined, now: IsoDateTime): Pick<DocRow, 'status' | 'alert'> {
  if (!expiry) return { status: 'valid' }
  const today = istDate(now)
  if (expiry < today) return { status: 'expired' }
  const band = ([7, 15, 30] as const).find((d) => expiry <= addDaysToDate(today, d))
  return band ? { status: 'expiring', alert: band } : { status: 'valid' }
}

/** Every company, vehicle, staff and hub document of a partner, worst first. */
export function docRegister(data: DemoData, partnerId: Id, now: IsoDateTime): DocRow[] {
  const p = data.partners[partnerId]
  if (!p) return []
  const rows: Omit<DocRow, 'status' | 'alert'>[] = []
  for (const d of p.companyDocs ?? []) rows.push({ id: `CO:${partnerId}:${d.key}`, owner: 'company', ownerId: partnerId, ownerName: p.shortName, kind: d.key, number: d.number, expiry: d.expiry })
  for (const v of Object.values(data.vehicles).filter((x) => x.partnerId === partnerId && x.active !== false)) {
    if (v.docs) for (const k of VEHICLE_DOCS) rows.push({ id: `VH:${v.id}:${k}`, owner: 'vehicle', ownerId: v.id, ownerName: v.regNo, kind: k, expiry: v.docs[k] })
    else rows.push({ id: `VH:${v.id}:insurance`, owner: 'vehicle', ownerId: v.id, ownerName: v.regNo, kind: 'insurance', expiry: v.docExpiry })
  }
  for (const s of Object.values(data.fieldStaff).filter((x) => x.partnerId === partnerId && staffStatus(x) !== 'inactive')) {
    if (s.role !== 'hub') rows.push({ id: `ST:${s.id}:licence`, owner: 'staff', ownerId: s.id, ownerName: s.name, kind: 'licence', number: s.licenceNo, expiry: s.licenceValidTill })
    rows.push({ id: `ST:${s.id}:police`, owner: 'staff', ownerId: s.id, ownerName: s.name, kind: 'police' })
  }
  for (const h of Object.values(data.hubs).filter((x) => x.partnerId === partnerId)) {
    for (const k of Object.keys(HUB_DOC_FIELD) as HubDoc[]) {
      const expiry = h[HUB_DOC_FIELD[k]] as IsoDate | undefined
      if (expiry) rows.push({ id: `HB:${h.id}:${k}`, owner: 'hub', ownerId: h.id, ownerName: h.name, kind: k, expiry })
    }
  }
  const rank: Record<DocState, number> = { expired: 0, expiring: 1, underReview: 2, valid: 3 }
  return rows
    .map((r): DocRow => {
      const ren = data.docRenewals[r.id]
      if (ren && ren.reviewDoneAt > now) return { ...r, status: 'underReview', renewal: { file: ren.file, at: ren.at } }
      // A police verification without a date is pending (PP-29)
      if (r.kind === 'police') {
        const s = data.fieldStaff[r.ownerId]
        return { ...r, status: s.policeVerified ? 'valid' : 'expired', number: s.policeVerifiedOn }
      }
      return { ...r, ...docState(r.expiry, now), ...(ren ? { renewal: { file: ren.file, at: ren.at } } : {}) }
    })
    .sort((a, b) => rank[a.status] - rank[b.status] || (a.expiry ?? '9999').localeCompare(b.expiry ?? '9999'))
}

// ── PP-34 portal users ──────────────────────────────────────────────────────

export const portalUserStatus = (u: PartnerUser) => u.status ?? 'active'

export const isLastPartnerAdmin = (data: DemoData, u: PartnerUser) =>
  u.role === 'admin' && portalUserStatus(u) === 'active' && Object.values(data.partnerUsers).filter((x) => x.partnerId === u.partnerId && x.role === 'admin' && portalUserStatus(x) === 'active').length === 1

/** PP-35 status update endpoint the partner calls (fixed). */
export const STATUS_ENDPOINT = 'POST /v1/legs/{id}/status'
