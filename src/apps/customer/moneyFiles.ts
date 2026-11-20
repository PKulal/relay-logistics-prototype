/** Excel downloads for CP-24 (invoice line items) and CP-25 (COD remittance report, source §7.2). */
import type { TFunction } from 'i18next'
import * as XLSX from 'xlsx'
import { remitDate } from '@shared/engines/receivables'
import { formatDate, formatDateTime } from '@shared/lib/format'
import type { CodRecord, DemoData, Invoice } from '@shared/types'

const save = (rows: Record<string, unknown>[], sheet: string, file: string) => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), sheet)
  XLSX.writeFile(book, file)
}

export function exportInvoiceLines(data: DemoData, inv: Invoice, t: TFunction) {
  const rows = (inv.lrs ?? []).map((lr) => {
    const s = data.shipments[lr]
    return {
      [t('cp24.line.lr')]: lr,
      [t('cp24.line.date')]: formatDate(s.bookedAt),
      [t('cp24.line.lane')]: `${data.pincodes[s.originPincode].city} → ${data.pincodes[s.destPincode].city}`,
      [t('cp24.line.weight')]: s.weights.verifiedChargeable ?? s.weights.chargeable,
      [t('cp24.line.taxable')]: s.price.subtotal,
      [t('cp24.line.gst')]: s.price.gst,
      [t('cp24.line.total')]: s.price.total,
    }
  })
  save(rows, 'Lines', `${inv.id.replaceAll('/', '-')}-lines.xlsx`)
}

/** All COD records of the customer, or one remittance's. */
export function exportCodReport(records: CodRecord[], t: TFunction, name: string, remitDays: number) {
  const rows = records.map((r) => ({
    [t('cp25.col.lr')]: r.shipmentId,
    [t('cp25.col.delivered')]: r.deliveredAt ? formatDateTime(r.deliveredAt) : '',
    [t('cp25.col.cod')]: r.amount,
    [t('cp25.col.status')]: t(`cp25.rec.${r.status}`),
    [t('cp25.col.remittance')]: r.remittanceId ?? '',
    [t('cp25.col.remitDate')]: r.remittedAt ? formatDate(r.remittedAt) : formatDate(remitDate(r, remitDays)),
  }))
  save(rows, 'COD', `${name}.xlsx`)
}
