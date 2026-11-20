/**
 * CP-26 Document centre (source §7.2: "LR, label, e-way bill, invoices, e-POD,
 * GRN, photos — one ZIP per shipment or month"). Rows come from each shipment's
 * documents (CP-17) plus the customer's Logisco invoices and credit notes.
 * Sizes are SIMULATED.
 */
import { istDate } from '@shared/lib/time'
import type { CustomerRole, DemoData, Id, IsoDate } from '@shared/types'
import { customerInvoices } from './receivables'
import { shipmentDocs } from './tracking'

export const DOC_TYPES = ['lr', 'label', 'ewb', 'invoice', 'creditNote', 'epod', 'grn', 'photos'] as const
export type DocType = (typeof DOC_TYPES)[number]

export interface DocRow {
  id: string
  type: DocType
  /** i18n key under cp17.doc / cp26.name */
  nameKey: string
  ref: string
  lr?: Id
  date: IsoDate
  kb: number
  count?: number
}

const KEY_TYPE: Record<string, DocType> = { lr: 'lr', labels: 'label', ewb: 'ewb', invoice: 'invoice', pickupPhotos: 'photos', epod: 'epod', grn: 'grn', deliveryPhotos: 'photos' }
const SHIPMENT_TYPES: DocType[] = ['lr', 'label', 'ewb', 'epod', 'grn', 'photos', 'invoice']
const FINANCE_TYPES: DocType[] = ['invoice', 'creditNote']

/** Dispatch sees shipment documents; Finance invoices and credit notes; Admin everything (CP-26 "Used by"). */
export const typesFor = (role: CustomerRole): DocType[] => (role === 'dispatch' ? SHIPMENT_TYPES : role === 'finance' ? FINANCE_TYPES : [...DOC_TYPES])

export function documentRows(data: DemoData, customerId: Id, role: CustomerRole): DocRow[] {
  const allowed = typesFor(role)
  const rows: DocRow[] = []
  if (role !== 'finance')
    for (const s of Object.values(data.shipments).filter((x) => x.customerId === customerId)) {
      for (const d of shipmentDocs(data, s)) {
        const type = KEY_TYPE[d.key]
        rows.push({ id: `${s.id}:${d.key}`, type, nameKey: `cp17.doc.${d.key}`, ref: d.detail ?? s.id, lr: s.id, date: istDate(s.bookedAt), kb: d.count ? d.count * 420 : 60 + (s.id.charCodeAt(s.id.length - 1) % 9) * 11, count: d.count })
      }
    }
  for (const i of customerInvoices(data, customerId)) rows.push({ id: `INV:${i.id}`, type: 'invoice', nameKey: 'cp26.name.taxInvoice', ref: i.id, date: i.date, kb: 120 + (i.lrs?.length ?? 0) * 2 })
  for (const c of Object.values(data.creditNotes).filter((x) => x.customerId === customerId)) rows.push({ id: `CN:${c.id}`, type: 'creditNote', nameKey: 'cp26.name.creditNote', ref: c.id, date: c.date, kb: 64 })
  return rows.filter((r) => allowed.includes(r.type)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export const months = (rows: DocRow[]) => [...new Set(rows.map((r) => r.date.slice(0, 7)))].sort().reverse()
