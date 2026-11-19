/**
 * CP-19 Exception queue (source §7.2 "Exception Queue: shipments on hold
 * needing customer input, NDR actions, weight disputes, claims"; §10).
 */
import { addHours } from '@shared/lib/time'
import type { DemoData, ExceptionKind, Id, IsoDateTime, ShipmentStatus } from '@shared/types'
import { actionsNeeded, WEIGHT_REVISION_RESPONSE_HOURS } from './customerDashboard'

export type QueueTab = 'action' | 'ndr' | 'weight' | 'hold' | 'claims'

export interface QueueRow {
  key: string
  tab: Exclude<QueueTab, 'action'>
  shipmentId: Id
  /** i18n key under cp19.type */
  type: 'weightRevision' | 'weightDisputed' | 'ndr' | 'ewbExpiry' | ExceptionKind | 'claim'
  raisedAt: IsoDateTime
  /** Plain details: a reason, an amount, or empty */
  details?: string
  amount?: number
  /** Present when the customer must respond (Needs my action) */
  dueAt?: IsoDateTime
  totalMinutes?: number
  /** Where Take action goes */
  to: string
}

/** E-way bills expiring within this many hours put a moving shipment on hold (assumed). */
const EWB_WARN_HOURS = 24
const DONE: ShipmentStatus[] = ['delivered', 'deliveredWithException', 'cancelled', 'returnToOrigin']

export function exceptionQueue(data: DemoData, customerId: Id, now: IsoDateTime): QueueRow[] {
  const rows: QueueRow[] = []
  const mine = (lr: Id) => data.shipments[lr]?.customerId === customerId

  for (const w of Object.values(data.weightRevisions)) {
    if (!mine(w.shipmentId) || (w.status !== 'pending' && w.status !== 'disputed')) continue
    rows.push({
      key: w.id,
      tab: 'weight',
      shipmentId: w.shipmentId,
      type: w.status === 'pending' ? 'weightRevision' : 'weightDisputed',
      raisedAt: w.raisedAt,
      amount: w.amountDiff,
      dueAt: w.status === 'pending' ? addHours(w.raisedAt, WEIGHT_REVISION_RESPONSE_HOURS) : undefined,
      totalMinutes: WEIGHT_REVISION_RESPONSE_HOURS * 60,
      to: `/customer/exceptions/weight/${w.shipmentId}`,
    })
  }

  for (const a of actionsNeeded(data, customerId)) {
    if (a.kind === 'ndr') {
      const failed = Object.values(data.events).filter((e) => e.shipmentId === a.shipmentId && e.type === 'deliveryFailed').at(-1)
      rows.push({ key: `ndr-${a.shipmentId}`, tab: 'ndr', shipmentId: a.shipmentId, type: 'ndr', raisedAt: failed?.at ?? a.dueAt, details: a.reason, dueAt: a.dueAt, totalMinutes: 24 * 60, to: `/customer/exceptions/ndr/${a.shipmentId}` })
    }
    if (a.kind === 'claim') {
      const delivered = Object.values(data.events).filter((e) => e.shipmentId === a.shipmentId && e.type === 'delivered').at(-1)
      rows.push({ key: `claim-${a.shipmentId}`, tab: 'claims', shipmentId: a.shipmentId, type: 'claim', raisedAt: delivered?.at ?? a.dueAt, dueAt: a.dueAt, totalMinutes: data.settings.claimWindowDays * 24 * 60, to: '/customer/claims' })
    }
  }

  // On hold: open exceptions Logisco is working on (no customer timer), and e-way bills about to expire
  for (const x of Object.values(data.exceptions)) {
    if (!mine(x.shipmentId) || x.status === 'resolved' || x.type === 'ndr') continue
    rows.push({ key: x.id, tab: 'hold', shipmentId: x.shipmentId, type: x.type, raisedAt: x.raisedAt, details: x.rootCause, to: `/customer/shipments/${x.shipmentId}` })
  }
  for (const s of Object.values(data.shipments)) {
    if (s.customerId !== customerId || !s.ewb || DONE.includes(s.status)) continue
    const expiresAt = `${s.ewb.validTill}T23:59:00+05:30`
    const hoursLeft = (Date.parse(expiresAt) - Date.parse(now)) / 3_600_000
    if (hoursLeft <= EWB_WARN_HOURS)
      rows.push({ key: `ewb-${s.id}`, tab: 'hold', shipmentId: s.id, type: 'ewbExpiry', raisedAt: addHours(expiresAt, -EWB_WARN_HOURS), details: s.ewb.no, to: `/customer/shipments/${s.id}` })
  }

  for (const c of Object.values(data.claims)) {
    if (c.customerId !== customerId || c.status === 'settled' || c.status === 'rejected') continue
    rows.push({ key: c.id, tab: 'claims', shipmentId: c.shipmentId, type: 'claim', raisedAt: c.raisedAt, to: '/customer/claims' })
  }

  return rows.sort((a, b) => (a.dueAt && b.dueAt ? Date.parse(a.dueAt) - Date.parse(b.dueAt) : a.dueAt ? -1 : b.dueAt ? 1 : Date.parse(b.raisedAt) - Date.parse(a.raisedAt)))
}

export const inTab = (rows: QueueRow[], tab: QueueTab) => (tab === 'action' ? rows.filter((r) => r.dueAt) : rows.filter((r) => r.tab === tab))
