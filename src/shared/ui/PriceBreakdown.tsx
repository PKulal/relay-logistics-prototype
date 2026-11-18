/**
 * Price build-up table (CP spec §7.3): lines in source order, subtotal, GST, total.
 * Lines come from the pricing engine with their numbers (basis); labels and the
 * "how it was worked out" text are rendered here through i18n.
 */
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { formatINR, formatKg } from '@shared/lib/format'
import type { Price, PriceLine, ServiceKind } from '@shared/types'
import type { WeightResult } from '@shared/engines/chargeableWeight'

function basisText(t: TFunction, line: PriceLine): string {
  const b = line.basis
  switch (line.code) {
    case 'freight':
      return b.slabs !== undefined
        ? t('price.basis.freightParcel', { first: formatINR(b.first!), extra: b.slabs - 1, additional: formatINR(b.additional!) })
        : t('price.basis.freightPtl', { kg: formatKg(b.kg!), rate: formatINR(b.rate!) })
    case 'fuel':
      return t('price.basis.pctOfFreight', { pct: b.pct })
    case 'oda':
      return t('price.basis.oda', { rate: formatINR(b.rate!), min: formatINR(b.value!) })
    case 'cod':
      return t('price.basis.pctOf', { pct: b.pct, value: formatINR(b.value!) })
    case 'fov':
      return t('price.basis.pctOf', { pct: b.pct, value: formatINR(b.value!) })
    case 'specialHandling':
      return t('price.basis.perPiece', { pieces: b.pieces, rate: formatINR(b.rate!) })
    default:
      return t('price.basis.perShipment')
  }
}

export function PriceBreakdown({ price, gstPct, className }: { price: Price; gstPct: number; className?: string }) {
  const { t } = useTranslation()
  return (
    <table className={cn('w-full text-table', className)}>
      <tbody>
        {price.lines.map((line) => (
          <tr key={line.code} className="border-b border-gray-100">
            <td className="py-1.5 pr-2">
              <span className="font-medium">{t(`price.line.${line.code}`)}</span>
              <span className="block text-caption text-muted-foreground">{basisText(t, line)}</span>
            </td>
            <td className="tabular py-1.5 text-right align-top">{formatINR(line.amount)}</td>
          </tr>
        ))}
        <tr className="border-b border-gray-100">
          <td className="py-1.5 font-semibold">{t('price.subtotal')}</td>
          <td className="tabular py-1.5 text-right font-semibold">{formatINR(price.subtotal)}</td>
        </tr>
        <tr className="border-b border-gray-100">
          <td className="py-1.5">{t('price.gst', { pct: gstPct })}</td>
          <td className="tabular py-1.5 text-right">{formatINR(price.gst)}</td>
        </tr>
        <tr>
          <td className="pt-2 font-heading text-card-title font-bold">{t('price.total')}</td>
          <td className="tabular pt-2 text-right font-heading text-card-title font-bold" data-testid="price-total">
            {formatINR(price.total)}
          </td>
        </tr>
      </tbody>
    </table>
  )
}

/** "Actual 120 kg | CFT 162 kg → 162 kg" (PTL) or "Actual 6 kg | Volumetric 7.2 kg → 7.5 kg" (Parcel). */
export function WeightBreakdown({ weights, serviceKind, minKg }: { weights: WeightResult; serviceKind: ServiceKind; minKg?: number }) {
  const { t } = useTranslation()
  const minApplied = serviceKind === 'ptl' && minKg !== undefined && weights.chargeable === minKg && weights.chargeable > Math.max(weights.actual, weights.volumetricOrCft)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body">
      <span>
        {t('weight.actual')} <strong className="tabular">{formatKg(weights.actual)}</strong>
      </span>
      <span className="text-muted-foreground">|</span>
      <span>
        {serviceKind === 'ptl' ? t('weight.cft', { cuft: weights.cubicFeet }) : t('weight.volumetric')}{' '}
        <strong className="tabular">{formatKg(weights.volumetricOrCft)}</strong>
      </span>
      <span aria-hidden>→</span>
      <span className="rounded-md bg-primary-soft px-2 py-0.5 font-semibold text-primary">
        {t('weight.chargeable')} <span className="tabular">{formatKg(weights.chargeable)}</span>
      </span>
      {minApplied && <span className="text-caption text-muted-foreground">{t('weight.minApplied', { kg: minKg })}</span>}
    </div>
  )
}
