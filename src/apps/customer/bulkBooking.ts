/**
 * CP-15 Bulk booking: Excel rows → validated booking forms (source §7.2 Bulk
 * Booking: "Excel upload, multi-piece booking, saved consignees and SKU
 * dimensions"). Each row becomes the same BookingForm CP-13 uses, so prices,
 * e-way bill rules and the booking itself are identical to a single booking.
 */
import * as XLSX from 'xlsx'
import { skuOutlier } from '@shared/store/contractActions'
import type { Customer, CustomerUser, DemoData, IsoDateTime, ParcelTier } from '@shared/types'
import { emptyBooking, ewbRequired, quoteFor, withDefaultSlot, type BookingForm } from './bookingForm'
import { destinationCheck, num, positive, type QuoteResult, type ServiceChoice } from './quoteForm'

export const BULK_COLUMNS = ['customerRef', 'consignee', 'contact', 'mobile', 'address', 'pincode', 'service', 'tier', 'pieces', 'l', 'b', 'h', 'weight', 'skuCode', 'invoiceNo', 'invoiceDate', 'invoiceValue', 'hsn', 'ewbNo'] as const
export type BulkRow = Record<(typeof BULK_COLUMNS)[number], string>

export const MAX_ROWS = 500
export const MAX_MB = 5

export type RowIssue = 'consignee' | 'mobile' | 'pincodeUnknown' | 'notServiceable' | 'pieces' | 'dims' | 'invoiceNo' | 'invoiceValue' | 'service' | 'quote' | 'ewbAuto' | 'oda' | 'outlier'
const WARNINGS: RowIssue[] = ['ewbAuto', 'oda', 'outlier']

export interface CheckedRow {
  index: number
  row: BulkRow
  form: BookingForm
  quote: QuoteResult | null
  issues: RowIssue[]
  status: 'valid' | 'warning' | 'error'
}

const SERVICES: ServiceChoice[] = ['parcel', 'expressPtl', 'standardPtl']
const TIERS: ParcelTier[] = ['economy', 'standard', 'express']
const s = (v: unknown) => String(v ?? '').trim()

/** Row → the CP-13 form (pickup location and date apply to the whole batch). */
export function rowToForm(data: DemoData, customer: Customer, user: CustomerUser, r: BulkRow, locationId: string, pickupDate: string, now: IsoDateTime): BookingForm {
  const base = emptyBooking(data, customer, now, user)
  const sku = r.skuCode ? Object.values(data.skus).find((x) => x.customerId === customer.id && x.code.toLowerCase() === r.skuCode.toLowerCase()) : undefined
  // A saved consignee with the same company and pincode is reused (address book)
  const saved = Object.values(data.consignees).find((c) => c.customerId === customer.id && c.saved !== false && c.company.toLowerCase() === r.consignee.toLowerCase() && c.pincode === r.pincode)
  const service = (SERVICES.find((x) => x === r.service) ?? base.service) as ServiceChoice
  const form: BookingForm = {
    ...base,
    locationId,
    pickupDate,
    consigneeId: saved?.id ?? '',
    consignee: { ...base.consignee, company: r.consignee, contact: r.contact || saved?.contact || '', mobile: r.mobile || saved?.mobile || '', address: r.address || saved?.address || '', pincode: r.pincode, gstin: saved?.gstin ?? '', category: saved?.category ?? 'distributor', appointmentRequired: saved?.appointmentRequired ?? false },
    saveToBook: false,
    service,
    tier: TIERS.find((x) => x === r.tier) ?? 'standard',
    rows: [{ key: 1, skuCode: sku?.code ?? '', qty: r.pieces || '1', l: r.l || String(sku?.l ?? ''), b: r.b || String(sku?.b ?? ''), h: r.h || String(sku?.h ?? ''), weight: r.weight || String(sku?.weight ?? '') }],
    invoiceNo: r.invoiceNo,
    invoiceDate: r.invoiceDate || base.invoiceDate,
    invoiceValue: r.invoiceValue,
    hsn: r.hsn || sku?.hsn || '',
    goods: sku?.description ?? 'Goods',
    ewbOption: r.ewbNo ? 'existing' : 'auto',
    existingEwbNo: r.ewbNo,
  }
  return withDefaultSlot(data, form, now)
}

export function checkRow(data: DemoData, customer: Customer, user: CustomerUser, r: BulkRow, index: number, locationId: string, pickupDate: string, now: IsoDateTime): CheckedRow {
  const form = rowToForm(data, customer, user, r, locationId, pickupDate, now)
  const issues: RowIssue[] = []
  const c = form.consignee
  const row0 = form.rows[0]
  if (!c.company.trim() || !c.address.trim()) issues.push('consignee')
  if (c.mobile.replace(/\D/g, '').length !== 10) issues.push('mobile')
  const dest = destinationCheck(data, c.pincode)
  if (dest === 'unknown' || dest === 'empty') issues.push('pincodeUnknown')
  if (dest === 'notServiceable') issues.push('notServiceable')
  if (dest === 'oda') issues.push('oda')
  if (r.service && !SERVICES.includes(r.service as ServiceChoice)) issues.push('service')
  if (!(Number.isInteger(num(row0.qty)) && num(row0.qty) > 0)) issues.push('pieces')
  if (![row0.l, row0.b, row0.h, row0.weight].every(positive)) issues.push('dims')
  else if (skuOutlier({ l: num(row0.l), b: num(row0.b), h: num(row0.h), weight: num(row0.weight) })) issues.push('outlier')
  if (!form.invoiceNo.trim()) issues.push('invoiceNo')
  if (!positive(form.invoiceValue)) issues.push('invoiceValue')
  const quote = issues.some((i) => !WARNINGS.includes(i)) ? null : quoteFor(data, customer.id, form)
  if (quote && !quote.ok) issues.push('quote')
  if (quote?.ok && !r.ewbNo && ewbRequired(data, form, quote).required) issues.push('ewbAuto')
  const status = issues.some((i) => !WARNINGS.includes(i)) ? 'error' : issues.length ? 'warning' : 'valid'
  return { index, row: r, form, quote, issues, status }
}

export function summary(rows: CheckedRow[]) {
  const ok = rows.filter((r) => r.status !== 'error' && r.quote?.ok)
  return {
    valid: rows.filter((r) => r.status === 'valid').length,
    warnings: rows.filter((r) => r.status === 'warning').length,
    errors: rows.filter((r) => r.status === 'error').length,
    weight: Math.round(ok.reduce((t, r) => t + (r.quote?.ok ? r.quote.quote.weights.chargeable : 0), 0) * 10) / 10,
    total: Math.round(ok.reduce((t, r) => t + (r.quote?.ok ? r.quote.quote.price.total : 0), 0) * 100) / 100,
  }
}

export async function readBulkFile(file: File): Promise<BulkRow[]> {
  const book = XLSX.read(await file.arrayBuffer())
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: '' })
  return json.slice(0, MAX_ROWS).map((x) => Object.fromEntries(BULK_COLUMNS.map((k) => [k, s(x[k])])) as BulkRow)
}

export function downloadBulkTemplate() {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(sampleRows().slice(0, 2), { header: [...BULK_COLUMNS] }), 'Bookings')
  XLSX.writeFile(book, 'logisco-bulk-booking-template.xlsx')
}

export function downloadErrorFile(rows: CheckedRow[], message: (r: CheckedRow) => string) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows.filter((r) => r.status !== 'valid').map((r) => ({ row: r.index + 1, ...r.row, status: r.status, message: message(r) }))), 'Errors')
  XLSX.writeFile(book, 'bulk-booking-errors.xlsx')
}

const R = (x: Partial<BulkRow>): BulkRow => ({ ...(Object.fromEntries(BULK_COLUMNS.map((k) => [k, ''])) as BulkRow), ...x })

/**
 * Sample upload for the demo (INVENTED): 10 dispatches from Sharma
 * Electricals' address book and SKUs; one has no invoice value and one goes
 * to an unserviceable pincode (errors), two need an e-way bill (warning).
 */
export function sampleRows(): BulkRow[] {
  return [
    R({ customerRef: 'SE/DSP/2411-01', consignee: 'Hubli Electric Distributors', pincode: '580030', service: 'expressPtl', pieces: '4', skuCode: 'SG-LT-250', invoiceNo: 'SE/25-26/1201', invoiceValue: '88000', hsn: '8537' }),
    R({ customerRef: 'SE/DSP/2411-02', consignee: 'Shree Krishna Electricals', pincode: '580020', service: 'standardPtl', pieces: '6', skuCode: 'DB-8W-TPN', invoiceNo: 'SE/25-26/1202', invoiceValue: '39000' }),
    R({ customerRef: 'SE/DSP/2411-03', consignee: 'Bengaluru Switchgear Traders', pincode: '560001', service: 'expressPtl', pieces: '2', skuCode: 'ACB-800', invoiceNo: 'SE/25-26/1203', invoiceValue: '136000' }),
    R({ customerRef: 'SE/DSP/2411-04', consignee: 'Mumbai Electric Mart', pincode: '400093', service: 'parcel', tier: 'standard', pieces: '1', skuCode: 'MCB-32-4P', invoiceNo: 'SE/25-26/1204', invoiceValue: '9600' }),
    R({ customerRef: 'SE/DSP/2411-05', consignee: 'Belgaum Power Controls', pincode: '590001', service: 'standardPtl', pieces: '3', skuCode: 'CAP-25KVAR', invoiceNo: 'SE/25-26/1205', invoiceValue: '' }),
    R({ customerRef: 'SE/DSP/2411-06', consignee: 'Pune Power Solutions', pincode: '411001', service: 'parcel', tier: 'express', pieces: '1', skuCode: 'RELAY-EF', invoiceNo: 'SE/25-26/1206', invoiceValue: '9500' }),
    R({ customerRef: 'SE/DSP/2411-07', consignee: 'Patel Traders', contact: 'Hiren Patel', mobile: '98250 11223', address: '22, Relief Road, Ahmedabad', pincode: '380015', service: 'expressPtl', pieces: '2', skuCode: 'DB-12W-TPN', invoiceNo: 'SE/25-26/1207', invoiceValue: '16400' }),
    R({ customerRef: 'SE/DSP/2411-08', consignee: 'Peenya Panel Works', pincode: '560058', service: 'expressPtl', pieces: '5', skuCode: 'ENC-IP65-L', invoiceNo: 'SE/25-26/1208', invoiceValue: '34000' }),
    R({ customerRef: 'SE/DSP/2411-09', consignee: 'Mysore Electric Stores', pincode: '570001', service: 'parcel', tier: 'economy', pieces: '1', skuCode: 'METER-MFM', invoiceNo: 'SE/25-26/1209', invoiceValue: '12000' }),
    R({ customerRef: 'SE/DSP/2411-10', consignee: 'Hubli Motor Works', pincode: '580025', service: 'standardPtl', pieces: '8', skuCode: 'CBL-GLAND', invoiceNo: 'SE/25-26/1210', invoiceValue: '30400' }),
  ]
}
