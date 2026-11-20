/**
 * Excel templates and imports for Customer Portal settings (CP-30 address
 * book, CP-31 SKU master, CP-32 templates). Column keys are fixed codes so a
 * file filled in Hindi or English imports the same way.
 */
import * as XLSX from 'xlsx'
import type { ConsigneeInput, SkuInput } from '@shared/store/customerSettingsActions'
import type { ConsigneeCategory } from '@shared/types'

export const ADDRESS_COLUMNS = ['company', 'contact', 'mobile', 'email', 'address', 'landmark', 'pincode', 'gstin', 'category', 'defaultService', 'receivingHours'] as const
export const SKU_COLUMNS = ['code', 'description', 'l', 'b', 'h', 'weight', 'hsn', 'unitValue'] as const
export const BOOKING_COLUMNS = ['consigneeCompany', 'pincode', 'service', 'skuCode', 'pieces', 'invoiceNo', 'invoiceValue'] as const

export type TemplateKind = 'booking' | 'address' | 'sku'

const SAMPLE: Record<TemplateKind, Record<string, string | number>> = {
  booking: { consigneeCompany: 'Hubli Electric Distributors', pincode: '580030', service: 'expressPtl', skuCode: 'SG-LT-400', pieces: 6, invoiceNo: 'SE/25-26/1187', invoiceValue: 180000 },
  address: { company: 'Hubli Electric Distributors', contact: 'Mahesh Patil', mobile: '94480 12345', email: '', address: 'Shop 14, APMC Yard, Amargol, Hubballi', landmark: '', pincode: '580030', gstin: '29AAFFH5678K1Z2', category: 'distributor', defaultService: 'expressPtl', receivingHours: 'Sunday closed' },
  sku: { code: 'SG-LT-400', description: 'LT switchgear panel 400A', l: 60, b: 40, h: 40, weight: 20, hsn: '8537', unitValue: 30000 },
}

const COLUMNS: Record<TemplateKind, readonly string[]> = { booking: BOOKING_COLUMNS, address: ADDRESS_COLUMNS, sku: SKU_COLUMNS }

export function downloadTemplate(kind: TemplateKind) {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet([SAMPLE[kind]], { header: [...COLUMNS[kind]] }), 'Template')
  XLSX.writeFile(book, `logisco-${kind}-template.xlsx`)
}

async function readRows(file: File): Promise<Record<string, unknown>[]> {
  const book = XLSX.read(await file.arrayBuffer())
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]], { defval: '' })
}

const str = (v: unknown) => String(v ?? '').trim()
const SERVICES = ['parcel', 'expressPtl', 'standardPtl'] as const
const CATEGORIES: ConsigneeCategory[] = ['distributor', 'retailer', 'dc', 'modernTrade', 'factory', 'otherBusiness']

export async function readAddressFile(file: File): Promise<ConsigneeInput[]> {
  return (await readRows(file)).map((r) => {
    const category = CATEGORIES.find((c) => c === str(r.category))
    const service = SERVICES.find((s) => s === str(r.defaultService))
    return {
      type: 'business',
      category: category ?? 'distributor',
      company: str(r.company),
      contact: str(r.contact),
      mobile: str(r.mobile),
      email: str(r.email) || undefined,
      address: str(r.address),
      landmark: str(r.landmark) || undefined,
      pincode: str(r.pincode),
      gstin: str(r.gstin) || undefined,
      appointmentRequired: category === 'dc' || category === 'modernTrade',
      defaultService: service,
      receivingHours: str(r.receivingHours) || undefined,
    }
  })
}

export async function readSkuFile(file: File): Promise<SkuInput[]> {
  return (await readRows(file)).map((r) => ({ code: str(r.code), description: str(r.description), l: Number(r.l), b: Number(r.b), h: Number(r.h), weight: Number(r.weight), hsn: str(r.hsn), unitValue: Number(r.unitValue) || 0 }))
}
