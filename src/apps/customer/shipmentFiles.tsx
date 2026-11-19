/**
 * Document Centre downloads (source §7.2: "LR, label, e-way bill, invoices,
 * e-POD, GRN, photos — one ZIP per shipment or month") and the Excel export of
 * the shipment list. SIMULATED: each document in the ZIP is a text stand-in.
 */
import { useEffect, useState } from 'react'
import type { TFunction } from 'i18next'
import * as XLSX from 'xlsx'
import { LrDocument, PieceLabel } from '@shared/docs/ShipmentDocs'
import { shipmentDocs } from '@shared/engines/tracking'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import { makeZip, saveBlob } from '@shared/sim/zip'
import type { DemoData, Shipment } from '@shared/types'
import { PrintArea } from '@shared/ui/PrintArea'

/** Text stand-ins for one shipment's documents, in a folder named after the LR. */
function docFiles(data: DemoData, s: Shipment, t: TFunction): { name: string; content: string }[] {
  const c = data.consignees[s.consigneeId]
  return shipmentDocs(data, s).map((d) => ({
    name: `${s.id}/${t(`cp17.doc.${d.key}`)}.txt`,
    content: [`${t(`cp17.doc.${d.key}`)} · ${s.id}`, d.detail ?? '', d.count ? `${d.count}` : '', `${c.company || c.contact}, ${data.pincodes[s.destPincode].city}`, t('cp17.simulatedDoc')].filter(Boolean).join('\n'),
  }))
}

/** One ZIP for one or many shipments. */
export function downloadDocuments(data: DemoData, shipments: Shipment[], t: TFunction) {
  const files = shipments.flatMap((s) => docFiles(data, s, t))
  saveBlob(makeZip(files), shipments.length === 1 ? `${shipments[0].id}-documents.zip` : `shipments-documents-${shipments.length}.zip`)
}

/** Excel export of the chosen rows (the columns of CP-16). */
export function exportShipments(data: DemoData, shipments: Shipment[], t: TFunction) {
  const rows = shipments.map((s) => {
    const c = data.consignees[s.consigneeId]
    const delivered = Object.values(data.events).find((e) => e.shipmentId === s.id && e.type === 'delivered')
    return {
      [t('cp16.col.lr')]: s.id,
      [t('cp16.col.booked')]: formatDate(s.bookedAt),
      [t('cp16.col.consignee')]: `${c.company || c.contact}, ${data.pincodes[s.destPincode].city}`,
      [t('cp16.col.pieces')]: s.pieces.length,
      [t('weight.chargeable')]: s.weights.verifiedChargeable ?? s.weights.chargeable,
      [t('cp16.col.service')]: t(`service.${s.service}`),
      [t('cp16.col.status')]: t(`status.shipment.${s.status}`),
      [t('cp16.col.eta')]: delivered ? formatDateTime(delivered.at) : formatDate(s.eta),
      [t('cp16.col.amount')]: formatINR(s.price.total),
    }
  })
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Shipments')
  XLSX.writeFile(book, `shipments-${shipments.length}.xlsx`)
}

/** Print labels or the LR for some shipments: renders the print view, prints, then clears. */
export function usePrintShipments(data: DemoData) {
  const [job, setJob] = useState<{ kind: 'labels' | 'lr'; shipments: Shipment[] } | null>(null)
  useEffect(() => {
    if (!job) return
    const done = () => setJob(null)
    window.addEventListener('afterprint', done, { once: true })
    const id = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(id)
      window.removeEventListener('afterprint', done)
    }
  }, [job])
  const view = job ? (
    <PrintArea>
      {job.shipments.map((s) =>
        job.kind === 'lr' ? (
          <LrDocument key={s.id} data={data} s={s} />
        ) : (
          <div key={s.id} className="grid grid-cols-2 gap-4 p-4">
            {s.pieces.map((_, i) => (
              <PieceLabel key={i} data={data} s={s} index={i} />
            ))}
          </div>
        ),
      )}
    </PrintArea>
  ) : null
  return { print: (kind: 'labels' | 'lr', shipments: Shipment[]) => setJob({ kind, shipments }), view }
}
