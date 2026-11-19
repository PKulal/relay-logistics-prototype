/**
 * CP-12 Get quote — docs/01-customer-portal.md §6.4.
 * All-in price and ETA before booking. Everything is calculated live by the
 * quote engine from the seeded rate cards, so the result follows every input.
 */
import { CircleAlert, MapPin, PackagePlus, Plus, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { ewayBillCheck } from '@shared/engines/ewayBill'
import { computeEta, earliestPickupDate } from '@shared/engines/schedule'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { istDate } from '@shared/lib/time'
import { formatDate, formatDateLong, formatINR } from '@shared/lib/format'
import type { ParcelTier, PaymentMode } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Chip } from '@shared/ui/StatusChip'
import { Field, NumField } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { PriceBreakdown, WeightBreakdown } from '@shared/ui/PriceBreakdown'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group'
import {
  destinationCheck,
  emptyForm,
  emptyRow,
  num,
  OTHER_PINCODE,
  positive,
  SAMPLES,
  toQuoteInput,
  tryQuote,
  type QuoteForm,
  type Row,
  type ServiceChoice,
} from './quoteForm'
import { useCustomerSession } from './useCustomerSession'

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function CP12GetQuote() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const demoNow = useDemoNow()
  const locations = Object.values(data.pickupLocations).filter((l) => l.customerId === customer.id)
  const skus = Object.values(data.skus).filter((s) => s.customerId === customer.id)
  const defaultLocation = locations.find((l) => l.isDefault)?.id ?? locations[0]?.id ?? OTHER_PINCODE
  const credit = customer.billing === 'credit'
  const canBook = user.role === 'admin' || user.role === 'dispatch'

  const [form, setForm] = useState<QuoteForm>(() => emptyForm(defaultLocation, credit))
  const set = <K extends keyof QuoteForm>(key: K, value: QuoteForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const setRow = (key: number, patch: Partial<Row>) => setForm((f) => ({ ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }))

  const dest = destinationCheck(data, form.destPincode)
  const destPin = data.pincodes[form.destPincode]
  const input = useMemo(() => toQuoteInput(data, customer.id, form), [data, customer.id, form])
  const result = useMemo(() => (input ? tryQuote(data, input) : null), [data, input])
  const codTooHigh = form.paymentMode === 'cod' && positive(form.codAmount) && positive(form.value) && num(form.codAmount) > num(form.value)
  const codMissing = form.paymentMode === 'cod' && !positive(form.codAmount)

  const pickupDate = earliestPickupDate(demoNow, data.settings.pickupCutoff)
  const q = result?.ok ? result.quote : undefined
  const eta = q ? computeEta(pickupDate, q.transitDays) : undefined
  const ptlLine = q?.lane && input?.serviceKind === 'ptl' ? q.rateCard.ptl.find((l) => l.laneId === q.lane!.id && l.service === input.service) : undefined
  const ewb =
    q && input
      ? ewayBillCheck({
          goodsValue: input.declaredValue,
          originState: q.origin.state,
          destState: q.dest.state,
          distanceKm: q.lane?.distanceKm ?? 120,
          generatedOn: istDate(demoNow),
          threshold: data.settings.ewayBillThreshold,
          kmPerDay: data.settings.ewayBillKmPerDay,
        })
      : undefined
  const tiers = useMemo(() => {
    if (form.service !== 'parcel') return []
    return (['economy', 'standard', 'express'] as ParcelTier[]).map((tier) => {
      const i = toQuoteInput(data, customer.id, form, tier)
      const r = i ? tryQuote(data, i) : null
      return { tier, quote: r?.ok ? r.quote : undefined }
    })
  }, [data, customer.id, form])

  const blocked = !q || codTooHigh || codMissing

  return (
    <div>
      <PageHeader
        title={t('cp12.title')}
        subtitle={t('cp12.subtitle')}
        actions={
          <>
            {SAMPLES[customer.id] && (
              <Button variant="outline" size="sm" onClick={() => setForm((f) => SAMPLES[customer.id](f))}>
                <Sparkles /> {t('cp12.fillSample')}
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setForm(emptyForm(defaultLocation, credit))}>
              <RotateCcw /> {t('cp12.reset')}
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* ── Inputs ─────────────────────────────── */}
        <form className="flex flex-col gap-6 rounded-xl border bg-card p-6 shadow-card" onSubmit={(e) => e.preventDefault()} aria-label={t('cp12.formLabel')}>
          <Field label={t('cp12.service')}>
            <ToggleGroup
              type="single"
              variant="outline"
              value={form.service}
              onValueChange={(v) => v && set('service', v as ServiceChoice)}
              className="w-full"
              aria-label={t('cp12.service')}
            >
              {(['parcel', 'expressPtl', 'standardPtl'] as ServiceChoice[]).map((s) => (
                <ToggleGroupItem key={s} value={s} className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                  {t(`service.${s}`)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('cp12.origin')} htmlFor="q-origin">
              <NativeSelect id="q-origin" value={form.origin} onChange={(e) => set('origin', e.target.value)}>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.pincode})
                  </option>
                ))}
                <option value={OTHER_PINCODE}>{t('cp12.otherPincode')}</option>
              </NativeSelect>
              {form.origin === OTHER_PINCODE && (
                <Input className="mt-2" inputMode="numeric" maxLength={6} placeholder={t('cp12.pincodePlaceholder')} aria-label={t('cp12.originPincode')} value={form.originPincode} onChange={(e) => set('originPincode', e.target.value.replace(/\D/g, ''))} />
              )}
            </Field>

            <Field label={t('cp12.destination')} htmlFor="q-dest">
              <Input id="q-dest" inputMode="numeric" maxLength={6} placeholder={t('cp12.pincodePlaceholder')} value={form.destPincode} onChange={(e) => set('destPincode', e.target.value.replace(/\D/g, ''))} aria-invalid={dest === 'unknown' || dest === 'notServiceable'} />
              <div className="mt-1.5 flex min-h-6 flex-wrap items-center gap-2 text-caption">
                {destPin && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <MapPin className="size-3.5" aria-hidden />
                    {destPin.area}, {destPin.city}, {destPin.state}
                  </span>
                )}
                {dest === 'serviceable' && <Chip tone="success">{t('cp12.dest.serviceable')}</Chip>}
                {dest === 'oda' && <Chip tone="warning">{t('cp12.dest.oda')}</Chip>}
                {(dest === 'unknown' || dest === 'notServiceable') && <Chip tone="danger">{t('cp12.dest.notServiceable')}</Chip>}
              </div>
            </Field>
          </div>

          {/* Package rows */}
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-body font-medium">{t('cp12.packages')}</legend>
            {form.rows.map((r, i) => (
              <div key={r.key} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-gray-100 p-3 sm:grid-cols-[minmax(0,2.4fr)_repeat(5,minmax(0,1fr))_auto]">
                <Field label={t('cp12.sku')} htmlFor={`sku-${r.key}`} small className="col-span-2 sm:col-span-1">
                  <NativeSelect
                    id={`sku-${r.key}`}
                    value={r.skuCode}
                    onChange={(e) => {
                      const s = skus.find((x) => x.code === e.target.value)
                      setRow(r.key, s ? { skuCode: s.code, l: String(s.l), b: String(s.b), h: String(s.h), weight: String(s.weight) } : { skuCode: '' })
                    }}
                  >
                    <option value="">{t('cp12.noSku')}</option>
                    {skus.map((s) => (
                      <option key={s.id} value={s.code}>
                        {s.code} · {s.description}
                        {s.status === 'flagged' ? ` (${t('cp12.flagged')})` : ''}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <NumField label={t('cp12.qty')} id={`qty-${r.key}`} value={r.qty} onChange={(v) => setRow(r.key, { qty: v })} />
                <NumField label={t('cp12.l')} id={`l-${r.key}`} value={r.l} onChange={(v) => setRow(r.key, { l: v, skuCode: '' })} />
                <NumField label={t('cp12.b')} id={`b-${r.key}`} value={r.b} onChange={(v) => setRow(r.key, { b: v, skuCode: '' })} />
                <NumField label={t('cp12.h')} id={`h-${r.key}`} value={r.h} onChange={(v) => setRow(r.key, { h: v, skuCode: '' })} />
                <NumField label={t('cp12.weight')} id={`w-${r.key}`} value={r.weight} onChange={(v) => setRow(r.key, { weight: v, skuCode: '' })} />
                <Button type="button" variant="ghost" size="icon" disabled={form.rows.length === 1} onClick={() => setForm((f) => ({ ...f, rows: f.rows.filter((x) => x.key !== r.key) }))} aria-label={t('cp12.removeRow', { n: i + 1 })}>
                  <Trash2 />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, rows: [...f.rows, emptyRow()] }))}>
                <Plus /> {t('cp12.addRow')}
              </Button>
              <span className="tabular text-caption text-muted-foreground">
                {t('cp12.totalActual', {
                  kg: form.rows.reduce((s, r) => s + (positive(r.qty) && positive(r.weight) ? num(r.qty) * num(r.weight) : 0), 0),
                })}
              </span>
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('cp12.value')} htmlFor="q-value">
              <Input id="q-value" inputMode="decimal" placeholder="₹" value={form.value} onChange={(e) => set('value', e.target.value.replace(/[^\d.]/g, ''))} />
            </Field>
            <Field label={t('cp12.paymentMode')} htmlFor="q-pay">
              <NativeSelect id="q-pay" value={form.paymentMode} onChange={(e) => set('paymentMode', e.target.value as PaymentMode)}>
                <option value="paid">{t('payment.paid')}</option>
                <option value="toPay">{t('payment.toPay')}</option>
                {credit && <option value="tbb">{t('payment.tbb')}</option>}
                <option value="cod">{t('payment.cod')}</option>
              </NativeSelect>
            </Field>
            {form.paymentMode === 'cod' && (
              <Field label={t('cp12.codAmount')} htmlFor="q-cod" error={codTooHigh ? t('cp12.codTooHigh') : undefined}>
                <Input id="q-cod" inputMode="decimal" placeholder="₹" value={form.codAmount} onChange={(e) => set('codAmount', e.target.value.replace(/[^\d.]/g, ''))} aria-invalid={codTooHigh} />
              </Field>
            )}
          </div>

          {form.service === 'parcel' && (
            <Field label={t('cp12.tier')}>
              <RadioGroup value={form.tier} onValueChange={(v) => set('tier', v as ParcelTier)} className="flex flex-wrap gap-4" aria-label={t('cp12.tier')}>
                {(['economy', 'standard', 'express'] as ParcelTier[]).map((tier) => (
                  <label key={tier} className="flex cursor-pointer items-center gap-2">
                    <RadioGroupItem value={tier} />
                    {t(`service.${tier}`)}
                  </label>
                ))}
              </RadioGroup>
            </Field>
          )}

          <fieldset>
            <legend className="mb-2 text-body font-medium">{t('cp12.addOns')}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(['appointment', 'insurance', 'specialHandling'] as const).map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2">
                  <Checkbox checked={form.addOns[k]} onCheckedChange={(c) => set('addOns', { ...form.addOns, [k]: c === true })} />
                  {t(`cp12.addOn.${k}`)}
                </label>
              ))}
            </div>
          </fieldset>
        </form>

        {/* ── Result panel ───────────────────────── */}
        <aside className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-card lg:sticky lg:top-0" aria-label={t('cp12.result')} aria-live="polite">
          <h2 className="text-section">{t('cp12.result')}</h2>

          {!input && <p className="text-muted-foreground">{t('cp12.fillIn')}</p>}

          {result && !result.ok && (
            <div role="alert" className="flex gap-2 rounded-lg bg-status-danger-bg p-3 text-status-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t(`cp12.error.${result.code}`)}</span>
            </div>
          )}

          {q && input && (
            <>
              <Section title={t('cp12.chargeableWeight')}>
                <WeightBreakdown weights={q.weights} serviceKind={input.serviceKind} minKg={ptlLine?.minKg} />
              </Section>

              <Section title={t('cp12.priceBuildUp')}>
                <PriceBreakdown price={q.price} gstPct={data.settings.gstPct} />
              </Section>

              <Section title={t('cp12.eta')}>
                <p className="font-heading text-card-title font-semibold" data-testid="eta">
                  {formatDateLong(eta!)}
                </p>
                <p className="text-caption text-muted-foreground">{t('cp12.etaBasis', { days: q.transitDays, pickup: formatDate(pickupDate), cutoff: data.settings.pickupCutoff })}</p>
              </Section>

              {ewb?.required && (
                <p className="rounded-lg bg-status-info-bg p-3 text-caption text-status-info">{t('cp12.ewbNote', { days: ewb.validityDays })}</p>
              )}

              {form.service === 'parcel' && (
                <Section title={t('cp12.tierComparison')}>
                  <div className="grid grid-cols-3 gap-2">
                    {tiers.map(({ tier, quote: tq }) => (
                      <button
                        key={tier}
                        type="button"
                        onClick={() => set('tier', tier)}
                        aria-pressed={form.tier === tier}
                        className={cn('rounded-lg border p-2 text-left', form.tier === tier ? 'border-primary bg-primary-soft' : 'hover:bg-accent')}
                      >
                        <span className="block text-caption font-semibold">{t(`service.${tier}`)}</span>
                        <span className="tabular block font-semibold">{tq ? formatINR(tq.price.total) : '—'}</span>
                        <span className="block text-caption text-muted-foreground">{tq ? formatDate(computeEta(pickupDate, tq.transitDays)) : ''}</span>
                      </button>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}

          <div className="mt-2 flex flex-col gap-2">
            {canBook && (
              <Button size="lg" disabled={blocked} onClick={() => navigate('/customer/book', { state: { quote: form } })}>
                <PackagePlus /> {t('cp12.bookThis')}
              </Button>
            )}
            {(dest === 'unknown' || dest === 'notServiceable') && <p className="text-center text-caption font-medium text-status-danger">{t('cp12.notServed')}</p>}
          </div>
        </aside>
      </div>

    </div>
  )
}

// ─── Small layout helpers ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t pt-4 first-of-type:border-t-0 first-of-type:pt-0">
      <h3 className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}
