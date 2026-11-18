/**
 * Shipment printouts shared by the Customer Portal (CP-14) and the ERP (ERP-03):
 * one QR label per piece, and the LR (consignment note).
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { formatDate, formatDateLong, formatDateTime, formatINR, formatKg } from '@shared/lib/format'
import type { DemoData, Shipment } from '@shared/types'
import { PriceBreakdown } from '@shared/ui/PriceBreakdown'
import { QrCode } from '@shared/ui/QrCode'

/** One piece label: LR, piece n/N, consignee, pincode, QR (CP-14). */
export function PieceLabel({ data, s, index, large }: { data: DemoData; s: Shipment; index: number; large?: boolean }) {
  const { t } = useTranslation()
  const piece = s.pieces[index]
  const consignee = data.consignees[s.consigneeId]
  const dest = data.pincodes[s.destPincode]
  const origin = data.pincodes[s.originPincode]
  return (
    <article className={cn('flex flex-col gap-2 rounded-lg border-2 border-ink bg-white p-3 text-ink', large && 'h-[5.6in] p-4 text-[14pt]')} aria-label={t('cp14.labelFor', { n: index + 1, total: s.pieces.length })}>
      <div className="flex items-center justify-between border-b border-ink pb-2">
        <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-7" />
        <span className="font-heading text-section font-bold">{t(`service.${s.service}`)}</span>
      </div>
      <div className="flex gap-3">
        <QrCode value={`${s.id}|${piece.id}|${s.destPincode}`} label={t('cp14.qrFor', { piece: piece.id })} className={large ? 'w-40' : 'w-24'} />
        <div className="min-w-0 flex-1">
          <p className="tabular font-heading text-card-title font-bold">{s.id}</p>
          <p className="tabular font-heading text-page-title font-bold">
            {index + 1}/{s.pieces.length}
          </p>
          <p className="tabular text-caption">{piece.id}</p>
        </div>
      </div>
      <div className="border-t border-ink pt-2 text-table">
        <p className="text-caption font-semibold uppercase">{t('cp14.to')}</p>
        <p className="font-semibold">{consignee.company}</p>
        <p>{consignee.address}</p>
        <p className="tabular font-heading text-section font-bold">
          {dest?.city} {s.destPincode}
        </p>
      </div>
      <div className="flex justify-between border-t border-ink pt-2 text-caption">
        <span>
          {t('cp14.from')}: {origin?.city} {s.originPincode}
        </span>
        <span className="tabular">{formatKg(piece.weight)}</span>
      </div>
    </article>
  )
}

/** Printable LR (consignment note). */
export function LrDocument({ data, s }: { data: DemoData; s: Shipment }) {
  const { t } = useTranslation()
  const customer = data.customers[s.customerId]
  const loc = data.pickupLocations[s.pickupLocationId]
  const consignee = data.consignees[s.consigneeId]
  const dest = data.pincodes[s.destPincode]
  const row = (label: string, value: React.ReactNode) => (
    <tr className="border-b border-gray-100">
      <th className="py-1 pr-4 text-left align-top font-semibold">{label}</th>
      <td className="py-1">{value}</td>
    </tr>
  )
  return (
    <div className="text-ink">
      <div className="mb-4 flex items-start justify-between">
        <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-12" />
        <div className="text-right">
          <p className="font-heading text-page-title font-bold">{t('cp14.lrTitle')}</p>
          <p className="tabular font-heading text-section">{s.id}</p>
          <p className="text-caption">{formatDateTime(s.bookedAt)}</p>
        </div>
      </div>
      <table className="w-full text-table">
        <tbody>
          {row(t('cp14.consignor'), `${customer.legalName}, ${loc.address} ${loc.pincode} · GSTIN ${customer.gstin}`)}
          {row(t('cp14.consignee'), `${consignee.company}, ${consignee.contact}, ${consignee.address}, ${dest?.city} ${s.destPincode}${consignee.gstin ? ` · GSTIN ${consignee.gstin}` : ''}`)}
          {row(t('cp14.serviceRow'), `${t(`service.${s.service}`)} · ${t(`payment.${s.paymentMode}`)}`)}
          {row(t('cp14.packagesRow'), `${t('cp13.pieces', { count: s.pieces.length })} · ${formatKg(s.weights.actual)} ${t('weight.actual').toLowerCase()} · ${formatKg(s.weights.chargeable)} ${t('weight.chargeable').toLowerCase()}`)}
          {row(t('cp14.invoiceRow'), `${s.invoice.no} · ${formatDate(s.invoice.date)} · ${formatINR(s.invoice.value)}${s.invoice.po ? ` · PO ${s.invoice.po}` : ''}`)}
          {row(t('cp14.goodsRow'), `${s.goodsDescription} · HSN ${s.hsn}`)}
          {row(t('cp14.ewb'), s.ewb ? `${s.ewb.no} · ${t('cp14.ewbValid', { date: formatDate(s.ewb.validTill) })}` : t('cp14.ewbNone'))}
          {row(t('cp14.pickup'), `${formatDateLong(s.pickupSlot.date)}, ${s.pickupSlot.from}–${s.pickupSlot.to}`)}
          {row(t('cp14.eta'), formatDateLong(s.eta))}
        </tbody>
      </table>
      <PriceBreakdown price={s.price} gstPct={data.settings.gstPct} className="mt-4 max-w-md" />
    </div>
  )
}
