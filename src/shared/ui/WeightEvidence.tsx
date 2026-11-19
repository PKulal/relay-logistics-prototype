/**
 * Booked vs verified weight with photo evidence and the AI check — shared by
 * CP-20 (customer) and ERP-31 (Finance). Source §7 Step 4 "evidence on screen";
 * §12 Weight & Dimension Checks.
 */
import { Bot, MapPin } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { aiWeightCheck, compareWeights, type SideTotals } from '@shared/engines/weightCheck'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime, formatINR, formatKg } from '@shared/lib/format'
import { photoThumb } from '@shared/sim/photos'
import type { Shipment, WeightRevision } from '@shared/types'
import { SimulatedTag } from './SimulatedTag'
import { Chip } from './StatusChip'

export function WeightEvidence({ shipment: s, revision: w }: { shipment: Shipment; revision: WeightRevision }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const cmp = useMemo(() => compareWeights(data, s), [data, s])
  const ai = useMemo(() => aiWeightCheck(data, s, w), [data, s, w])
  const loc = data.pickupLocations[s.pickupLocationId]
  const event = Object.values(data.events).find((e) => e.shipmentId === s.id && e.type === 'weightRevised')
  const frozen = Object.values(data.skus).filter((k) => k.customerId === s.customerId && k.status === 'frozen' && s.pieces.some((p) => p.skuCode === k.code))
  // For a reversed revision the booked weight stands; the amount shown is the revision's own difference
  const diff = w.amountDiff

  const side = (title: string, x: SideTotals, which: 'booked' | 'verified') => (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card" aria-label={title} data-testid={`side-${which}`}>
      <h3 className="font-semibold">{title}</h3>
      <table className="w-full text-table">
        <tbody>
          {cmp.pieces.map((p) => {
            const v = p[which]
            return (
              <tr key={p.id} className={cn('border-b last:border-0', which === 'verified' && p.changed && 'bg-status-warning-bg font-semibold')}>
                <td className="py-1">{p.id.slice(-2)}</td>
                <td className="tabular">
                  {v.l} × {v.b} × {v.h} cm
                </td>
                <td className="tabular text-right">{formatKg(v.weight)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-table">
        <dt className="text-muted-foreground">{t('weightEv.actual')}</dt>
        <dd className="tabular text-right">{formatKg(x.actual)}</dd>
        <dt className="text-muted-foreground">{s.serviceKind === 'ptl' ? t('weightEv.cft') : t('weightEv.volumetric')}</dt>
        <dd className="tabular text-right">{formatKg(x.volumetricOrCft)}</dd>
        <dt className="font-semibold">{t('weightEv.chargeable')}</dt>
        <dd className="tabular text-right font-semibold">{formatKg(x.chargeable)}</dd>
        <dt className="font-semibold">{t('weightEv.amount')}</dt>
        <dd className="tabular text-right font-semibold">{formatINR(x.total)}</dd>
      </dl>
    </section>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {side(t('weightEv.booked'), cmp.booked, 'booked')}
        {side(t('weightEv.verified'), { ...cmp.verified, chargeable: w.verified, total: cmp.booked.total + diff }, 'verified')}
      </div>
      <p className="rounded-xl border bg-card p-4 text-body font-semibold" data-testid="difference">
        {t('weightEv.difference', { kg: formatKg(w.verified - w.booked), amount: formatINR(diff) })}
      </p>

      <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card" aria-labelledby="ev-h">
        <h3 id="ev-h" className="font-semibold">
          {t('weightEv.evidence', { count: w.photos.length })}
        </h3>
        {w.photos.length === 0 ? (
          <p className="text-muted-foreground">{t('weightEv.noPhotos')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-testid="evidence">
            {w.photos.map((ph) => {
              const caption = ph.split(':').slice(1).join(':')
              return (
                <li key={ph} className="flex flex-col gap-1">
                  <img src={photoThumb(caption)} alt={caption} className="aspect-[4/3] w-full rounded-lg object-cover" />
                  <span className="text-caption font-medium">
                    {ph.split(':')[0].replace(`${s.id}-`, '').replace(/-(scale|tape)$/, (m) => ` · ${t(`weightEv.kind${m === '-scale' ? 'Scale' : 'Tape'}`)}`)}
                  </span>
                  <span className="flex items-center gap-1 text-caption text-muted-foreground">
                    <MapPin className="size-3" aria-hidden /> {loc ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : '—'} · {formatDateTime(event?.at ?? w.raisedAt)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className={cn('flex flex-col gap-1 rounded-xl border p-4', ai.verdict === 'review' ? 'border-status-warning bg-status-warning-bg' : 'bg-card')} aria-labelledby="ai-h" data-testid="ai-check">
        <h3 id="ai-h" className="flex items-center gap-2 font-semibold">
          <Bot className="size-4" aria-hidden /> {t('weightEv.aiTitle')} <SimulatedTag />
          <Chip tone={ai.verdict === 'review' ? 'warning' : 'success'}>{t(`weightEv.verdict.${ai.verdict}`)}</Chip>
        </h3>
        <p className="text-table">{t('weightEv.photoCoverage', { n: ai.photoCoverage.withPhotos, total: ai.photoCoverage.changed })}</p>
        {ai.flags.map((f) => (
          <p key={f} className="text-table font-medium">
            {f === 'skuFrozenDiffers'
              ? t('weightEv.flag.skuFrozenDiffers', { skus: frozen.map((k) => `${k.code} ${k.l} × ${k.b} × ${k.h} cm, ${formatKg(k.weight)}`).join('; ') })
              : t(`weightEv.flag.${f}`)}
          </p>
        ))}
      </section>
    </div>
  )
}
