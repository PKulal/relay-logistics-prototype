/**
 * CP-13 Book shipment (single) — docs/01-customer-portal.md §6.4.
 * Six steps; each validates before moving on. Confirming creates the shipment in
 * the shared store (legs, events, credit / wallet), so it appears at once in the
 * ERP and in the partners' job inboxes. Then CP-14.
 */
import { ArrowLeft, ArrowRight, BookUser, CircleAlert, FileCheck2, Loader2, MapPin, Pencil, Plus, Save, Sparkles, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { NoPartnerError } from '@shared/engines/assignment'
import { computeEta, earliestPickupDate, pickupDates, pickupSlots } from '@shared/engines/schedule'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateLong, formatINR, formatKg } from '@shared/lib/format'
import { simulateLatency } from '@shared/sim/latency'
import { useDemoStore } from '@shared/store'
import type { BookingDraft, ParcelTier } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Field, NumField } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { PriceBreakdown, WeightBreakdown } from '@shared/ui/PriceBreakdown'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { Stepper } from '@shared/ui/Stepper'
import { Switch } from '@shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group'
import {
  APPOINTMENT_CATEGORIES,
  CATEGORIES,
  confirmationBlocks,
  consigneeFor,
  emptyBooking,
  ewbRequired,
  fromQuote,
  fromShipment,
  heroSample,
  PACKAGING,
  quoteFor,
  STEPS,
  toBookingInput,
  validateStep,
  withConsignee,
  withDefaultSlot,
  type BookingForm,
  type ConsigneeFields,
  type StepErrors,
} from './bookingForm'
import { destinationCheck, emptyRow, num, positive, type QuoteForm, type Row, type ServiceChoice } from './quoteForm'
import { useCustomerSession } from './useCustomerSession'

type Set = <K extends keyof BookingForm>(key: K, value: BookingForm[K]) => void

export default function CP13BookShipment() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const demoNow = useDemoNow()
  const store = useDemoStore

  const draftId = params.get('draft') ?? undefined
  const [form, setForm] = useState<BookingForm>(() => {
    const base = emptyBooking(data, customer, demoNow)
    const state = location.state as { quote?: QuoteForm; repeat?: string } | null
    if (draftId && data.drafts[draftId]) return withDefaultSlot(data, data.drafts[draftId].form as BookingForm, demoNow)
    if (state?.quote) return fromQuote(data, customer.id, base, state.quote, demoNow)
    if (state?.repeat && data.shipments[state.repeat]) return fromShipment(data, base, data.shipments[state.repeat], demoNow)
    return base
  })
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState<StepErrors>({})
  const [busy, setBusy] = useState(false)
  const step = STEPS[stepIndex]

  const set: Set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }
  const quote = useMemo(() => quoteFor(data, customer.id, form), [data, customer.id, form])
  const ctx = { data, customer, now: demoNow, quote }
  const q = quote?.ok ? quote.quote : undefined
  const eta = q ? computeEta(form.pickupDate || earliestPickupDate(demoNow, data.settings.pickupCutoff), q.transitDays) : undefined
  const blocks = step === 'review' ? confirmationBlocks(form, ctx) : []

  const errorText = (key?: string) => {
    if (!key) return undefined
    return key.startsWith('quote.') ? t(`cp12.error.${key.slice(6)}`) : t(`cp13.err.${key}`)
  }
  const fieldError = (field: string) => errorText(errors[field])

  const goTo = (i: number) => {
    setErrors({})
    setStepIndex(i)
  }
  const next = () => {
    const e = validateStep(step, form, ctx)
    if (Object.keys(e).length > 0) {
      setErrors(e)
      toast.error(t('cp13.fixErrors'))
      return
    }
    goTo(stepIndex + 1)
  }

  const saveDraft = () => {
    const id = draftId ?? `DRF-${String(Object.keys(data.drafts).length + 1).padStart(3, '0')}`
    const pin = data.pincodes[form.consignee.pincode]
    const pieces = form.rows.reduce((s, r) => s + (positive(r.qty) ? Math.floor(num(r.qty)) : 0), 0)
    const draft: BookingDraft = {
      id,
      customerId: customer.id,
      userId: user.id,
      savedAt: demoNow,
      label: `${pin ? `${pin.city} ${pin.code}` : t('cp13.noDestination')} · ${t('cp13.pieces', { count: pieces })}`,
      form,
    }
    store.getState().saveDraft(draft)
    toast.success(t('cp13.draftSaved', { id }))
    if (!draftId) navigate(`/customer/book?draft=${id}`, { replace: true })
  }

  const confirm = async () => {
    // Re-check every step, then the business blocks
    for (let i = 0; i < STEPS.length; i++) {
      const e = validateStep(STEPS[i], form, ctx)
      if (Object.keys(e).length > 0) {
        setStepIndex(i)
        setErrors(e)
        toast.error(t('cp13.fixErrors'))
        return
      }
    }
    if (confirmationBlocks(form, ctx).length > 0) return
    setBusy(true)
    await simulateLatency(400, 900)
    try {
      const { consignee, isNew } = consigneeFor(data, customer.id, form)
      if (isNew || consignee.saved !== data.consignees[consignee.id]?.saved) store.getState().saveConsignee(consignee)
      const lr = store.getState().bookShipment(toBookingInput(form, customer.id, user, consignee.id))
      if (draftId) store.getState().deleteDraft(draftId)
      toast.success(t('cp13.booked', { lr }))
      navigate(`/customer/book/done/${lr}`)
    } catch (e) {
      setBusy(false)
      if (e instanceof NoPartnerError) toast.error(t('cp13.noPartner', { leg: t(`leg.${e.legType}`) }))
      else toast.error(t('cp13.bookingFailed'))
    }
  }

  return (
    <div>
      <PageHeader
        title={t('cp13.title')}
        subtitle={draftId ? t('cp13.editingDraft', { id: draftId }) : t('cp13.subtitle')}
        actions={
          <>
            {customer.id === 'C-SHARMA' && (
              <Button variant="outline" size="sm" onClick={() => setForm((f) => heroSample(data, f))}>
                <Sparkles /> {t('cp12.fillSample')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={saveDraft}>
              <Save /> {t('cp13.saveDraft')}
            </Button>
          </>
        }
      />

      <Stepper steps={STEPS.map((s) => t(`cp13.step.${s}`))} current={stepIndex} onStepClick={goTo} className="mb-6" />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-xl border bg-card p-6 shadow-card" aria-labelledby="step-title">
          <h2 id="step-title" className="mb-5 text-section">
            {t('cp13.stepOf', { n: stepIndex + 1, total: STEPS.length })} · {t(`cp13.step.${step}`)}
          </h2>

          {step === 'pickup' && <PickupStep form={form} setForm={setForm} set={set} err={fieldError} />}
          {step === 'consignee' && <ConsigneeStep form={form} setForm={setForm} set={set} err={fieldError} />}
          {step === 'shipment' && <ShipmentStep form={form} setForm={setForm} set={set} err={fieldError} />}
          {step === 'invoice' && <InvoiceStep form={form} set={set} err={fieldError} ewb={ewbRequired(data, form, quote)} />}
          {step === 'payment' && <PaymentStep form={form} set={set} err={fieldError} />}
          {step === 'review' && <ReviewStep form={form} set={set} err={fieldError} onEdit={goTo} eta={eta} blocks={blocks} />}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0 || busy}>
              <ArrowLeft /> {t('cp13.back')}
            </Button>
            {step === 'review' ? (
              <Button size="lg" onClick={confirm} disabled={busy || blocks.length > 0}>
                {busy ? <Loader2 className="animate-spin" /> : <FileCheck2 />} {t('cp13.confirm')}
              </Button>
            ) : (
              <Button onClick={next}>
                {t('cp13.next')} <ArrowRight />
              </Button>
            )}
          </div>
        </section>

        {/* Live summary */}
        <aside className="flex flex-col gap-3 rounded-xl border bg-card p-5 text-body shadow-card lg:sticky lg:top-0" aria-label={t('cp13.summary')}>
          <h2 className="text-card-title">{t('cp13.summary')}</h2>
          <SummaryRow label={t('cp13.route')}>
            {data.pickupLocations[form.locationId]?.name ?? '—'} → {data.pincodes[form.consignee.pincode]?.city ?? form.consignee.pincode ?? '—'}
          </SummaryRow>
          <SummaryRow label={t('cp13.serviceLabel')}>{t(`service.${form.service === 'parcel' ? form.tier : form.service}`)}</SummaryRow>
          {q && (
            <>
              <SummaryRow label={t('weight.chargeable')}>
                <span className="tabular">{formatKg(q.weights.chargeable)}</span>
              </SummaryRow>
              <SummaryRow label={t('cp12.eta')}>{formatDateLong(eta!)}</SummaryRow>
              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="font-semibold">{t('price.total')}</span>
                <span className="tabular font-heading text-section font-bold" data-testid="summary-total">
                  {formatINR(q.price.total)}
                </span>
              </div>
            </>
          )}
          {quote && !quote.ok && <p className="text-caption text-status-danger">{t(`cp12.error.${quote.code}`)}</p>}
          <p className="tabular text-caption text-muted-foreground">
            {customer.billing === 'credit'
              ? t('cp13.availableCredit', { amount: formatINR(customer.creditLimit - customer.creditUsed) })
              : t('cp11.walletBalance', { amount: formatINR(customer.walletBalance) })}
          </p>
        </aside>
      </div>
    </div>
  )
}

// ─── Steps ─────────────────────────────────────────────────────────────────────

interface StepProps {
  form: BookingForm
  set: Set
  err: (field: string) => string | undefined
  setForm?: React.Dispatch<React.SetStateAction<BookingForm>>
}

function PickupStep({ form, set, setForm, err }: StepProps) {
  const { t } = useTranslation()
  const { customer } = useCustomerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const locations = Object.values(data.pickupLocations).filter((l) => l.customerId === customer.id)
  const loc = data.pickupLocations[form.locationId]
  const cutoff = data.settings.pickupCutoff
  const slots = loc ? pickupSlots(loc.window, form.pickupDate, now, cutoff) : []

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label={t('cp13.location')} htmlFor="b-loc" required error={err('locationId')} className="sm:col-span-2">
        <NativeSelect
          id="b-loc"
          value={form.locationId}
          onChange={(e) => {
            const l = data.pickupLocations[e.target.value]
            setForm!((f) => withDefaultSlot(data, { ...f, locationId: l.id, contactName: l.contact.name, contactMobile: l.contact.mobile }, now))
          }}
        >
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} · {l.address} ({l.pincode})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t('cp13.pickupDate')} htmlFor="b-date" required hint={t('cp13.cutoffHint', { cutoff })}>
        <NativeSelect id="b-date" value={form.pickupDate} onChange={(e) => setForm!((f) => withDefaultSlot(data, { ...f, pickupDate: e.target.value, slotFrom: '' }, now))}>
          {pickupDates(now, cutoff).map((d) => (
            <option key={d} value={d}>
              {formatDateLong(d)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t('cp13.slot')} htmlFor="b-slot" required error={err('slotFrom')} hint={loc && t('cp13.windowHint', { from: loc.window.from, to: loc.window.to })}>
        <NativeSelect id="b-slot" value={form.slotFrom} onChange={(e) => set('slotFrom', e.target.value)} aria-invalid={!!err('slotFrom')}>
          {slots.length === 0 && <option value="">{t('cp13.noSlots')}</option>}
          {slots.map((s) => (
            <option key={s.from} value={s.from}>
              {s.from}–{s.to}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={t('cp13.contactName')} htmlFor="b-cname" required error={err('contactName')}>
        <Input id="b-cname" value={form.contactName} onChange={(e) => set('contactName', e.target.value)} />
      </Field>
      <Field label={t('cp13.contactMobile')} htmlFor="b-cmob" required error={err('contactMobile')}>
        <Input id="b-cmob" inputMode="tel" value={form.contactMobile} onChange={(e) => set('contactMobile', e.target.value)} aria-invalid={!!err('contactMobile')} />
      </Field>
      <Field label={t('cp13.instructions')} htmlFor="b-instr" error={err('instructions')} hint={t('cp13.charsLeft', { n: 250 - form.instructions.length })} className="sm:col-span-2">
        <textarea
          id="b-instr"
          maxLength={250}
          rows={2}
          value={form.instructions}
          onChange={(e) => set('instructions', e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-body outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </Field>
    </div>
  )
}

function ConsigneeStep({ form, setForm, err }: StepProps) {
  const { t } = useTranslation()
  const { customer } = useCustomerSession()
  const data = useData((d) => d)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const c = form.consignee
  const setC = (patch: Partial<ConsigneeFields>) =>
    setForm!((f) => {
      const consignee = { ...f.consignee, ...patch }
      // Appointment is on automatically for DC / modern trade (CP-13 Step 2)
      const appointment = patch.category ? APPOINTMENT_CATEGORIES.includes(patch.category) || consignee.appointmentRequired : f.appointment
      return { ...f, consignee: patch.category ? { ...consignee, appointmentRequired: appointment } : consignee, appointment }
    })
  const book = Object.values(data.consignees).filter((x) => x.customerId === customer.id && x.saved !== false)
  const matches = search.trim()
    ? book.filter((x) => `${x.company} ${x.contact} ${data.pincodes[x.pincode]?.city ?? ''} ${x.pincode}`.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : book.slice(0, 6)
  const dest = destinationCheck(data, c.pincode)
  const pin = data.pincodes[c.pincode]

  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <Field label={t('cp13.searchBook')} htmlFor="b-search">
          <div className="relative">
            <BookUser className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              id="b-search"
              className="pl-9"
              value={search}
              placeholder={t('cp13.searchBookPlaceholder')}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onChange={(e) => {
                setSearch(e.target.value)
                setOpen(true)
              }}
              role="combobox"
              aria-expanded={open}
              aria-controls="b-search-list"
            />
          </div>
        </Field>
        {open && matches.length > 0 && (
          <ul id="b-search-list" role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border bg-popover shadow-card">
            {matches.map((m) => (
              <li key={m.id} role="option" aria-selected={form.consigneeId === m.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-accent"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setForm!((f) => withConsignee(f, m))
                    setSearch('')
                    setOpen(false)
                  }}
                >
                  <span className="block font-medium">{m.company || m.contact}</span>
                  <span className="block text-caption text-muted-foreground">
                    {m.contact} · {data.pincodes[m.pincode]?.city} {m.pincode}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('cp13.category')} htmlFor="b-cat" required>
          <NativeSelect id="b-cat" value={c.category} onChange={(e) => setC({ category: e.target.value as ConsigneeFields['category'] })}>
            {CATEGORIES.map((k) => (
              <option key={k} value={k}>
                {t(`cp13.categories.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('cp13.company')} htmlFor="b-co" required error={err('company')}>
          <Input id="b-co" value={c.company} onChange={(e) => setC({ company: e.target.value })} />
        </Field>
        <Field label={t('cp13.contactPerson')} htmlFor="b-cp" required error={err('contact')}>
          <Input id="b-cp" value={c.contact} onChange={(e) => setC({ contact: e.target.value })} />
        </Field>
        <Field label={t('cp13.mobile')} htmlFor="b-mob" required error={err('mobile')} hint={t('cp13.mobileHint')}>
          <Input id="b-mob" inputMode="tel" value={c.mobile} onChange={(e) => setC({ mobile: e.target.value })} aria-invalid={!!err('mobile')} />
        </Field>
        <Field label={t('cp13.altMobile')} htmlFor="b-alt" error={err('altMobile')}>
          <Input id="b-alt" inputMode="tel" value={c.altMobile} onChange={(e) => setC({ altMobile: e.target.value })} />
        </Field>
        <Field label={t('cp13.email')} htmlFor="b-email" error={err('email')}>
          <Input id="b-email" type="email" value={c.email} onChange={(e) => setC({ email: e.target.value })} />
        </Field>
        <Field label={t('cp13.address1')} htmlFor="b-a1" required error={err('address')} className="sm:col-span-2">
          <Input id="b-a1" value={c.address} onChange={(e) => setC({ address: e.target.value })} />
        </Field>
        <Field label={t('cp13.address2')} htmlFor="b-a2">
          <Input id="b-a2" value={c.landmark} onChange={(e) => setC({ landmark: e.target.value })} />
        </Field>
        <Field label={t('cp13.pincode')} htmlFor="b-pin" required error={err('pincode')}>
          <Input id="b-pin" inputMode="numeric" maxLength={6} value={c.pincode} onChange={(e) => setC({ pincode: e.target.value.replace(/\D/g, '') })} aria-invalid={!!err('pincode')} />
          <div className="flex min-h-6 flex-wrap items-center gap-2 text-caption">
            {pin && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden />
                {pin.city}, {pin.state}
              </span>
            )}
            {dest === 'serviceable' && <Chip tone="success">{t('cp12.dest.serviceable')}</Chip>}
            {dest === 'oda' && <Chip tone="warning">{t('cp12.dest.oda')}</Chip>}
            {(dest === 'unknown' || dest === 'notServiceable') && <Chip tone="danger">{t('cp12.dest.notServiceable')}</Chip>}
          </div>
        </Field>
        <Field label={t('cp13.gstin')} htmlFor="b-gst" error={err('gstin')} hint={t('cp13.gstinHint')}>
          <Input id="b-gst" maxLength={15} value={c.gstin} onChange={(e) => setC({ gstin: e.target.value.toUpperCase() })} />
        </Field>
        <label className="flex items-center gap-3 self-end pb-2">
          <Switch checked={form.appointment} onCheckedChange={(v) => setForm!((f) => ({ ...f, appointment: v, consignee: { ...f.consignee, appointmentRequired: v } }))} />
          <span>{t('cp13.appointmentRequired')}</span>
        </label>
      </div>
      <label className="flex items-center gap-2">
        <Checkbox checked={form.saveToBook} onCheckedChange={(v) => setForm!((f) => ({ ...f, saveToBook: v === true }))} />
        {t('cp13.saveToBook')}
      </label>
    </div>
  )
}

function ShipmentStep({ form, set, setForm, err }: StepProps) {
  const { t } = useTranslation()
  const { customer } = useCustomerSession()
  const data = useData((d) => d)
  const skus = Object.values(data.skus).filter((s) => s.customerId === customer.id)
  const quote = quoteFor(data, customer.id, form)
  const setRow = (key: number, patch: Partial<Row>) => setForm!((f) => ({ ...f, rows: f.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }))
  const pieces = form.rows.reduce((s, r) => s + (positive(r.qty) ? Math.floor(num(r.qty)) : 0), 0)
  const minKg = quote?.ok && quote.quote.lane ? quote.quote.rateCard.ptl.find((l) => l.laneId === quote.quote.lane!.id && l.service === form.service)?.minKg : undefined

  return (
    <div className="flex flex-col gap-5">
      <Field label={t('cp12.service')}>
        <ToggleGroup type="single" variant="outline" value={form.service} onValueChange={(v) => v && set('service', v as ServiceChoice)} className="w-full" aria-label={t('cp12.service')}>
          {(['parcel', 'expressPtl', 'standardPtl'] as ServiceChoice[]).map((s) => (
            <ToggleGroupItem key={s} value={s} className="flex-1 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              {t(`service.${s}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
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

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-body font-medium">{t('cp12.packages')}</legend>
        {form.rows.map((r, i) => (
          <div key={r.key} className="grid grid-cols-2 items-end gap-2 rounded-lg border border-gray-100 p-3 sm:grid-cols-6">
            <Field label={t('cp12.sku')} htmlFor={`bs-${r.key}`} small className="col-span-2 sm:col-span-3">
              <NativeSelect
                id={`bs-${r.key}`}
                value={r.skuCode}
                onChange={(e) => {
                  const s = skus.find((x) => x.code === e.target.value)
                  setRow(r.key, s ? { skuCode: s.code, description: s.description, l: String(s.l), b: String(s.b), h: String(s.h), weight: String(s.weight) } : { skuCode: '' })
                }}
              >
                <option value="">{t('cp12.noSku')}</option>
                {skus.map((s) => (
                  <option key={s.id} value={s.code}>
                    {s.code} · {s.description}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('cp13.description')} htmlFor={`bd-${r.key}`} small className="col-span-2 sm:col-span-3">
              <Input id={`bd-${r.key}`} value={r.description ?? ''} onChange={(e) => setRow(r.key, { description: e.target.value })} />
            </Field>
            <NumField label={t('cp12.qty')} id={`bq-${r.key}`} value={r.qty} onChange={(v) => setRow(r.key, { qty: v })} />
            <NumField label={t('cp12.l')} id={`bl-${r.key}`} value={r.l} onChange={(v) => setRow(r.key, { l: v, skuCode: '' })} />
            <NumField label={t('cp12.b')} id={`bb-${r.key}`} value={r.b} onChange={(v) => setRow(r.key, { b: v, skuCode: '' })} />
            <NumField label={t('cp12.h')} id={`bh-${r.key}`} value={r.h} onChange={(v) => setRow(r.key, { h: v, skuCode: '' })} />
            <NumField label={t('cp12.weight')} id={`bw-${r.key}`} value={r.weight} onChange={(v) => setRow(r.key, { weight: v, skuCode: '' })} />
            <Button type="button" variant="ghost" size="icon" disabled={form.rows.length === 1} onClick={() => setForm!((f) => ({ ...f, rows: f.rows.filter((x) => x.key !== r.key) }))} aria-label={t('cp12.removeRow', { n: i + 1 })}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setForm!((f) => ({ ...f, rows: [...f.rows, emptyRow()] }))}>
          <Plus /> {t('cp12.addRow')}
        </Button>
        {err('rows') && (
          <p role="alert" className="text-caption font-medium text-status-danger">
            {err('rows')}
          </p>
        )}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('cp13.packaging')} htmlFor="b-pack" required>
          <NativeSelect id="b-pack" value={form.packaging} onChange={(e) => set('packaging', e.target.value as BookingForm['packaging'])}>
            {PACKAGING.map((p) => (
              <option key={p} value={p}>
                {t(`cp13.packagingTypes.${p}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <label className="flex items-center gap-2 self-end pb-2">
          <Checkbox checked={form.fragile} onCheckedChange={(v) => set('fragile', v === true)} />
          {t('cp13.fragile')}
        </label>
      </div>

      <div className="rounded-lg bg-gray-50 p-4">
        <p className="mb-2 text-caption font-semibold tracking-wide text-muted-foreground uppercase">{t('cp13.totals', { count: pieces })}</p>
        {quote?.ok ? (
          <WeightBreakdown weights={quote.quote.weights} serviceKind={form.service === 'parcel' ? 'parcel' : 'ptl'} minKg={minKg} />
        ) : (
          <p className="text-muted-foreground">{t('cp13.totalsPending')}</p>
        )}
        {err('route') && (
          <p role="alert" className="mt-2 flex items-center gap-1.5 font-medium text-status-danger">
            <CircleAlert className="size-4" aria-hidden /> {err('route')}
          </p>
        )}
      </div>
    </div>
  )
}

function InvoiceStep({ form, set, err, ewb }: StepProps & { ewb: { required: boolean; validityDays: number } }) {
  const { t } = useTranslation()
  const now = useDemoNow()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('cp13.invoiceNo')} htmlFor="b-inv" required error={err('invoiceNo')}>
          <Input id="b-inv" value={form.invoiceNo} onChange={(e) => set('invoiceNo', e.target.value)} />
        </Field>
        <Field label={t('cp13.invoiceDate')} htmlFor="b-invd" required error={err('invoiceDate')}>
          <Input id="b-invd" type="date" max={now.slice(0, 10)} value={form.invoiceDate} onChange={(e) => set('invoiceDate', e.target.value)} />
        </Field>
        <Field label={t('cp13.invoiceValue')} htmlFor="b-invv" required error={err('invoiceValue')} hint={t('cp13.inclGst')}>
          <Input id="b-invv" inputMode="decimal" placeholder="₹" value={form.invoiceValue} onChange={(e) => set('invoiceValue', e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
        <Field label={t('cp13.po')} htmlFor="b-po">
          <Input id="b-po" value={form.po} onChange={(e) => set('po', e.target.value)} />
        </Field>
        <Field label={t('cp13.goods')} htmlFor="b-goods" required error={err('goods')}>
          <Input id="b-goods" value={form.goods} onChange={(e) => set('goods', e.target.value)} />
        </Field>
        <Field label={t('cp13.hsn')} htmlFor="b-hsn" required={ewb.required} error={err('hsn')}>
          <Input id="b-hsn" inputMode="numeric" maxLength={8} value={form.hsn} onChange={(e) => set('hsn', e.target.value.replace(/\D/g, ''))} />
        </Field>
        <Field label={t('cp13.customerRef')} htmlFor="b-ref">
          <Input id="b-ref" value={form.customerRef} onChange={(e) => set('customerRef', e.target.value)} />
        </Field>
        <Field label={t('cp13.invoiceCopy')} required error={err('invoiceFile')} hint={t('cp13.invoiceCopyHint')}>
          {/* SIMULATED: only the file name is kept; nothing is uploaded */}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            className="sr-only"
            aria-label={t('cp13.invoiceCopy')}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file && file.size > 5 * 1024 * 1024) toast.error(t('cp13.fileTooBig'))
              else if (file) set('invoiceFile', file.name)
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload /> {t('cp13.chooseFile')}
            </Button>
            {!form.invoiceFile && (
              <Button type="button" variant="ghost" size="sm" onClick={() => set('invoiceFile', `INV_${form.invoiceNo.split('/').pop() || 'sample'}.pdf`)}>
                {t('cp13.useSample')}
              </Button>
            )}
            {form.invoiceFile && <span className="text-caption font-medium">{form.invoiceFile}</span>}
            <SimulatedTag />
          </div>
        </Field>
      </div>

      {ewb.required ? (
        <fieldset className="rounded-lg bg-status-info-bg p-4">
          <legend className="sr-only">{t('cp13.ewb')}</legend>
          <p className="mb-3 font-medium text-status-info">{t('cp13.ewbRequired', { days: ewb.validityDays })}</p>
          <RadioGroup value={form.ewbOption} onValueChange={(v) => set('ewbOption', v as BookingForm['ewbOption'])} aria-label={t('cp13.ewb')} className="flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <RadioGroupItem value="auto" /> {t('cp13.ewbAuto')}
            </label>
            <label className="flex items-center gap-2">
              <RadioGroupItem value="existing" /> {t('cp13.ewbExisting')}
            </label>
          </RadioGroup>
          {form.ewbOption === 'existing' && (
            <Field label={t('cp13.ewbNo')} htmlFor="b-ewb" required error={err('existingEwbNo')} className="mt-3 max-w-xs">
              <Input id="b-ewb" inputMode="numeric" value={form.existingEwbNo} onChange={(e) => set('existingEwbNo', e.target.value.replace(/[^\d ]/g, ''))} />
            </Field>
          )}
        </fieldset>
      ) : (
        <p className="text-caption text-muted-foreground">{t('cp13.ewbNotRequired')}</p>
      )}
    </div>
  )
}

function PaymentStep({ form, set, err }: StepProps) {
  const { t } = useTranslation()
  const { customer } = useCustomerSession()
  const data = useData((d) => d)
  const modes = (['paid', 'toPay', 'tbb', 'cod'] as const).filter((m) => m !== 'tbb' || customer.billing === 'credit')

  return (
    <div className="flex flex-col gap-5">
      <Field label={t('cp13.paymentMode')} error={err('paymentMode')}>
        <RadioGroup value={form.paymentMode} onValueChange={(v) => set('paymentMode', v as BookingForm['paymentMode'])} aria-label={t('cp13.paymentMode')} className="flex flex-wrap gap-4">
          {modes.map((m) => (
            <label key={m} className="flex items-center gap-2">
              <RadioGroupItem value={m} />
              {t(`cp13.payment.${m}`)}
            </label>
          ))}
        </RadioGroup>
      </Field>
      {form.paymentMode === 'cod' && (
        <Field label={t('cp12.codAmount')} htmlFor="b-cod" required error={err('codAmount')} className="max-w-xs">
          <Input id="b-cod" inputMode="decimal" placeholder="₹" value={form.codAmount} onChange={(e) => set('codAmount', e.target.value.replace(/[^\d.]/g, ''))} />
        </Field>
      )}
      <Field label={t('cp13.insurance')}>
        <RadioGroup value={form.insurance ? 'fov' : 'owner'} onValueChange={(v) => set('insurance', v === 'fov')} aria-label={t('cp13.insurance')} className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <RadioGroupItem value="owner" /> {t('cp13.ownersRisk')}
          </label>
          <label className="flex items-center gap-2">
            <RadioGroupItem value="fov" /> {t('cp13.transitInsurance', { pct: data.rateCards[customer.rateCardId].surcharges.fovPct })}
          </label>
        </RadioGroup>
      </Field>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2">
          <Checkbox checked={form.appointment} onCheckedChange={(v) => set('appointment', v === true)} /> {t('cp12.addOn.appointment')}
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={form.fragile} onCheckedChange={(v) => set('fragile', v === true)} /> {t('cp12.addOn.specialHandling')}
        </label>
      </div>
      <p className="tabular rounded-lg bg-gray-50 p-3">
        {customer.billing === 'credit'
          ? t('cp13.availableCredit', { amount: formatINR(customer.creditLimit - customer.creditUsed) })
          : t('cp11.walletBalance', { amount: formatINR(customer.walletBalance) })}
      </p>
    </div>
  )
}

function ReviewStep({ form, set, err, onEdit, eta, blocks }: StepProps & { onEdit: (i: number) => void; eta?: string; blocks: string[] }) {
  const { t } = useTranslation()
  const { customer } = useCustomerSession()
  const data = useData((d) => d)
  const quote = quoteFor(data, customer.id, form)
  const loc = data.pickupLocations[form.locationId]
  const pin = data.pincodes[form.consignee.pincode]
  const pieces = form.rows.reduce((s, r) => s + Math.floor(num(r.qty) || 0), 0)

  const card = (i: number, title: string, lines: React.ReactNode[]) => (
    <div className="rounded-lg border p-4">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
        <Button variant="ghost" size="xs" onClick={() => onEdit(i)} aria-label={t('cp13.editStep', { step: title })}>
          <Pencil /> {t('cp13.edit')}
        </Button>
      </div>
      {lines.map((l, k) => (
        <p key={k} className="text-body">
          {l}
        </p>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {card(0, t('cp13.step.pickup'), [loc?.name, `${formatDateLong(form.pickupDate)}, ${form.slotFrom}–${String(Number(form.slotFrom.slice(0, 2)) + 2).padStart(2, '0')}${form.slotFrom.slice(2)}`, `${form.contactName}, ${form.contactMobile}`])}
        {card(1, t('cp13.step.consignee'), [form.consignee.company, `${form.consignee.contact}, ${form.consignee.mobile}`, `${form.consignee.address}, ${pin?.city ?? ''} ${form.consignee.pincode}`])}
        {card(2, t('cp13.step.shipment'), [t(`service.${form.service === 'parcel' ? form.tier : form.service}`), `${t('cp13.pieces', { count: pieces })} · ${t(`cp13.packagingTypes.${form.packaging}`)}`, quote?.ok ? `${t('weight.chargeable')} ${formatKg(quote.quote.weights.chargeable)}` : ''])}
        {card(3, t('cp13.step.invoice'), [`${form.invoiceNo} · ${formatDate(form.invoiceDate)}`, formatINR(num(form.invoiceValue) || 0), form.goods])}
        {card(4, t('cp13.step.payment'), [t(`cp13.payment.${form.paymentMode}`), form.insurance ? t('cp13.transitInsurance', { pct: data.rateCards[customer.rateCardId].surcharges.fovPct }) : t('cp13.ownersRisk'), form.appointment ? t('cp13.appointmentRequested') : ''])}
      </div>

      {quote?.ok && (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <PriceBreakdown price={quote.quote.price} gstPct={data.settings.gstPct} />
          <div className="rounded-lg bg-primary-soft p-4">
            <p className="text-caption font-semibold tracking-wide text-muted-foreground uppercase">{t('cp12.eta')}</p>
            <p className="font-heading text-card-title font-bold" data-testid="review-eta">
              {eta && formatDateLong(eta)}
            </p>
            {form.appointment && <p className="mt-1 text-caption text-muted-foreground">{t('cp13.appointmentNote')}</p>}
          </div>
        </div>
      )}

      {blocks.map((b) => (
        <div key={b} role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-status-danger-bg p-3 text-status-danger">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          <span className="font-medium">{t(`cp13.block.${b}`)}</span>
          {b === 'walletLow' && (
            <Link to="/customer/billing/wallet" className="font-semibold underline">
              {t('cp13.recharge')}
            </Link>
          )}
        </div>
      ))}

      <label className="flex items-start gap-2">
        <Checkbox checked={form.acceptTerms} onCheckedChange={(v) => set('acceptTerms', v === true)} className="mt-0.5" aria-invalid={!!err('acceptTerms')} />
        <span>{t('cp13.terms')}</span>
      </label>
      {err('acceptTerms') && (
        <p role="alert" className="text-caption font-medium text-status-danger">
          {err('acceptTerms')}
        </p>
      )}
    </div>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3')}>
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  )
}
