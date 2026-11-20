/**
 * ERP-25 Quote and margin simulator — docs/04-erp-control-tower.md.
 * Source §8 (leg planning, sum of leg rates vs customer price, risk buffer,
 * target margin), §8.1 (AI margin engine). Fully calculated from the seed rate
 * cards; "Try another partner mix" swaps a leg's partner among the eligible ones.
 */
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { emptyRow, positive, toQuoteInput, OTHER_PINCODE, type QuoteForm, type ServiceChoice } from '@apps/customer/quoteForm'
import { simulate } from '@shared/engines/pricingMonitor'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatINR } from '@shared/lib/format'
import { istDate } from '@shared/lib/time'
import type { ParcelTier, PaymentMode } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { PriceBreakdown } from '@shared/ui/PriceBreakdown'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'

const SERVICES: ServiceChoice[] = ['parcel', 'expressPtl', 'standardPtl']
const TIERS: ParcelTier[] = ['economy', 'standard', 'express']
const MODES: PaymentMode[] = ['paid', 'toPay', 'tbb', 'cod']

const blank = (): QuoteForm => ({ service: 'expressPtl', tier: 'standard', origin: OTHER_PINCODE, originPincode: '', destPincode: '', rows: [emptyRow()], value: '', paymentMode: 'tbb', codAmount: '', addOns: { appointment: false, insurance: false, specialHandling: false } })
/** ERP spec §7.2 worked example */
const hero = (): QuoteForm => ({ ...blank(), originPincode: '110020', destPincode: '580030', rows: [{ ...emptyRow(), qty: '6', l: '60', b: '40', h: '40', weight: '20' }], value: '180000', addOns: { appointment: true, insurance: true, specialHandling: false } })

export default function ERP25Simulator() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const customers = Object.values(data.customers).filter((c) => c.rateCardId && data.rateCards[c.rateCardId])
  const [customerId, setCustomerId] = useState('C-SHARMA')
  const [f, setF] = useState<QuoteForm>(blank)
  const [mix, setMix] = useState<Record<number, string>>({})
  const set = <K extends keyof QuoteForm>(k: K, v: QuoteForm[K]) => (setF({ ...f, [k]: v }), setMix({}))
  const input = toQuoteInput(data, customerId, f)
  const r = input ? simulate(data, input, istDate(now), mix) : undefined
  const sim = r?.ok ? r.sim : undefined
  const target = data.settings.targetMarginPct

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('erp25.title')}
        subtitle={t('erp25.subtitle')}
        actions={
          <Button variant="outline" onClick={() => (setCustomerId('C-SHARMA'), setF(hero()), setMix({}))}>
            {t('erp25.sample')}
          </Button>
        }
        className="mb-0"
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp25.inputs')}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('erp25.customer')} htmlFor="sim-c" hint={data.rateCards[data.customers[customerId]?.rateCardId]?.name}>
              <NativeSelect id="sim-c" value={customerId} onChange={(e) => (setCustomerId(e.target.value), setMix({}))}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.shortName}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('erp25.service')} htmlFor="sim-s">
              <NativeSelect id="sim-s" value={f.service} onChange={(e) => set('service', e.target.value as ServiceChoice)}>
                {SERVICES.map((s) => (
                  <option key={s} value={s}>
                    {t(s === 'parcel' ? 'erp25.parcel' : `service.${s}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {f.service === 'parcel' && (
              <Field label={t('cp12.tier')} htmlFor="sim-t">
                <NativeSelect id="sim-t" value={f.tier} onChange={(e) => set('tier', e.target.value as ParcelTier)}>
                  {TIERS.map((s) => (
                    <option key={s} value={s}>
                      {t(`service.${s}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <Field label={t('erp25.origin')} htmlFor="sim-o">
              <Input id="sim-o" inputMode="numeric" maxLength={6} className="tabular" value={f.originPincode} onChange={(e) => set('originPincode', e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label={t('erp25.dest')} htmlFor="sim-d">
              <Input id="sim-d" inputMode="numeric" maxLength={6} className="tabular" value={f.destPincode} onChange={(e) => set('destPincode', e.target.value.replace(/\D/g, ''))} />
            </Field>
            <Field label={t('erp25.value')} htmlFor="sim-v">
              <Input id="sim-v" type="number" className="tabular" value={f.value} onChange={(e) => set('value', e.target.value)} />
            </Field>
            <Field label={t('erp25.payment')} htmlFor="sim-p">
              <NativeSelect id="sim-p" value={f.paymentMode} onChange={(e) => set('paymentMode', e.target.value as PaymentMode)}>
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {t(`payment.${m}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {f.paymentMode === 'cod' && (
              <Field label={t('erp25.cod')} htmlFor="sim-cod">
                <Input id="sim-cod" type="number" className="tabular" value={f.codAmount} onChange={(e) => set('codAmount', e.target.value)} />
              </Field>
            )}
          </div>
          <fieldset>
            <legend className="mb-1 font-medium">{t('erp25.pieces')}</legend>
            <div className="flex flex-col gap-2">
              {f.rows.map((row, i) => (
                <div key={row.key} className="flex flex-wrap items-center gap-2">
                  {(['qty', 'l', 'b', 'h', 'weight'] as const).map((k) => (
                    <Input
                      key={k}
                      aria-label={t('erp25.rowField', { n: i + 1, field: t(`erp25.f.${k}`) })}
                      placeholder={t(`erp25.f.${k}`)}
                      type="number"
                      className={cn('tabular h-9 w-20', row[k] !== '' && !positive(row[k]) && 'border-status-danger')}
                      value={row[k]}
                      onChange={(e) => set('rows', f.rows.map((x) => (x.key === row.key ? { ...x, [k]: e.target.value } : x)))}
                    />
                  ))}
                  {f.rows.length > 1 && (
                    <Button variant="ghost" size="sm" aria-label={t('erp25.removeRow')} onClick={() => set('rows', f.rows.filter((x) => x.key !== row.key))}>
                      <Trash2 />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" className="self-start" onClick={() => set('rows', [...f.rows, emptyRow()])}>
                <Plus /> {t('erp25.addRow')}
              </Button>
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 font-medium">{t('cp12.addOns')}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(['appointment', 'insurance', 'specialHandling'] as const).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <Checkbox checked={f.addOns[k]} onCheckedChange={(c) => set('addOns', { ...f.addOns, [k]: c === true })} /> {t(`cp12.addOn.${k}`)}
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp25.result')} aria-live="polite">
          {!input && <p className="text-muted-foreground">{t('erp25.fillIn')}</p>}
          {r && !r.ok && (
            <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-status-danger">
              {r.code === 'noPartner' ? t('erp25.noPartner') : t(`cp12.error.${r.code}`)}
            </p>
          )}
          {sim && (
            <>
              <div>
                <h2 className="mb-1 font-heading text-section font-semibold">{t('erp25.customerPrice')}</h2>
                <PriceBreakdown price={sim.quote.price} gstPct={data.settings.gstPct} />
              </div>
              <div>
                <h2 className="mb-1 flex items-center gap-2 font-heading text-section font-semibold">
                  {t('erp25.legs')} <SimulatedTag />
                </h2>
                <table className="w-full text-table [&_td]:py-1 [&_td]:pr-3" data-testid="sim-legs">
                  <tbody>
                    {sim.legs.map((l, i) => (
                      <tr key={i} className="border-b last:border-0" aria-label={t(`legType.${l.type}`)}>
                        <td className="w-32">{t(`legType.${l.type}`)}</td>
                        <td>
                          <NativeSelect aria-label={t('erp25.partnerFor', { leg: t(`legType.${l.type}`) })} value={l.partnerId ?? ''} onChange={(e) => setMix({ ...mix, [i]: e.target.value })} className="h-8">
                            {l.options.map((o, n) => (
                              <option key={o.partnerId} value={o.partnerId}>
                                {data.partners[o.partnerId].shortName} · {o.score} {n === 0 ? `· ${t('erp25.engineChoice')}` : ''}
                              </option>
                            ))}
                          </NativeSelect>
                        </td>
                        <td className="tabular text-right">{formatINR(l.cost)}</td>
                      </tr>
                    ))}
                    <tr className="font-semibold">
                      <td colSpan={2}>{t('erp25.legTotal')}</td>
                      <td className="tabular text-right">{formatINR(sim.margin.legTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-table" data-testid="sim-margin">
                <dt>{t('erp25.subtotal')}</dt>
                <dd className="tabular text-right">{formatINR(sim.quote.price.subtotal)}</dd>
                <dt>{t('erp25.legCosts')}</dt>
                <dd className="tabular text-right">− {formatINR(sim.margin.legTotal)}</dd>
                {sim.insurance > 0 && (
                  <>
                    <dt>{t('erp25.insurance')}</dt>
                    <dd className="tabular text-right">− {formatINR(sim.insurance)}</dd>
                  </>
                )}
                <dt className="font-semibold">{t('erp25.gross')}</dt>
                <dd className="tabular text-right font-semibold">
                  {formatINR(sim.margin.gross)} ({sim.margin.grossPct}%)
                </dd>
                <dt>{t('erp25.buffer', { pct: data.settings.riskBufferPct })}</dt>
                <dd className="tabular text-right">− {formatINR(sim.margin.buffer)}</dd>
                <dt className="font-semibold">{t('erp25.net')}</dt>
                <dd className={cn('tabular text-right font-semibold', sim.margin.belowTarget ? 'text-status-danger' : 'text-status-success')}>
                  {formatINR(sim.margin.net)} ({sim.margin.netPct}%)
                </dd>
              </dl>
              <Chip tone={sim.margin.belowTarget ? 'danger' : 'success'} className="self-start">
                {sim.margin.belowTarget ? t('erp25.below', { target }) : t('erp25.above', { target })}
              </Chip>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
