/**
 * CP-21 NDR action (failed delivery) — docs/01-customer-portal.md.
 * Source §5.1, §7 Step 10, §10 Step 3: the shipper chooses Reattempt, Change
 * slot / address or Return to origin; the first response (shipper or
 * consignee) applies. Assumed (spec): next 3 working days; address changes
 * within the same pincode; RTO charge equal to the forward freight.
 */
import { ArrowLeft, MapPin } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ndrDueAt, ndrsOf, openNdr, reattemptDates, rtoCharge } from '@shared/engines/ndr'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import { photoThumb } from '@shared/sim/photos'
import { useDemoStore } from '@shared/store'
import { APPOINTMENT_SLOTS } from '@shared/store/appointmentActions'
import type { Ndr, Shipment } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { NotFound, PageHeader } from '@shared/ui/Page'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { SlaTimer } from '@shared/ui/SlaTimer'
import { Chip } from '@shared/ui/StatusChip'
import { useCustomerSession } from './useCustomerSession'

export default function CP21Ndr() {
  const { t } = useTranslation()
  const { lr = '' } = useParams()
  const { customer, user } = useCustomerSession()
  const data = useData((d) => d)
  const s = data.shipments[lr]?.customerId === customer.id ? data.shipments[lr] : undefined
  if (!s) return <NotFound />
  const attempts = ndrsOf(data, s.id)
  if (!attempts.length) return <NotFound />
  const open = openNdr(data, s.id)

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Link to="/customer/exceptions" className="inline-flex items-center gap-1 text-caption font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t('cp20.back')}
      </Link>
      <PageHeader
        title={t('cp21.title')}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link to={`/customer/shipments/${s.id}`} className="tabular font-medium text-primary hover:underline">
              {s.id}
            </Link>
            <Chip tone={open ? 'warning' : 'info'} bold>
              {t(`status.shipment.${s.status}`)}
            </Chip>
            {open && (
              <span className="inline-flex items-center gap-1 text-caption">
                {t('cp20.respondBy')} <SlaTimer dueAt={ndrDueAt(data, open)} totalMinutes={24 * 60} amberPct={9} />
              </span>
            )}
          </span>
        }
        className="mb-0"
      />
      <ol className="flex flex-col gap-3" aria-label={t('cp21.attempts')}>
        {attempts.map((n) => (
          <Attempt key={n.id} s={s} n={n} />
        ))}
      </ol>
      {open ? user.role === 'finance' ? <p className="text-muted-foreground">{t('cp21.dispatchOnly')}</p> : <Choose s={s} /> : null}
    </div>
  )
}

function Attempt({ s, n }: { s: Shipment; n: Ndr }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const ev = Object.values(data.events).find((e) => e.shipmentId === s.id && e.type === 'deliveryFailed' && e.at === n.at)
  const chooser = n.choiceBy === 'consignee' ? t('cp21.byConsignee') : n.choiceBy === 'system' ? t('cp21.bySystem') : (data.customerUsers[n.choiceBy ?? '']?.name ?? '')
  return (
    <li className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card" aria-label={t('cp21.attempt', { n: n.attempt })} data-testid={`attempt-${n.attempt}`}>
      <div className="flex flex-wrap gap-4">
        {n.photo && <img src={photoThumb(n.photo.split(':').slice(1).join(':') || t(`ndr.reason.${n.reason}`))} alt={t('cp21.photo')} className="h-24 w-32 rounded-lg object-cover" />}
        <div className="flex flex-1 flex-col gap-1">
          <p className="font-semibold">
            {t('cp21.attempt', { n: n.attempt })} · {formatDateTime(n.at)}
          </p>
          <p>{t(`ndr.reason.${n.reason}`)}</p>
          {n.note && <p className="text-muted-foreground">“{n.note}”</p>}
          {ev?.lat !== undefined && (
            <p className="flex items-center gap-1 text-caption text-muted-foreground">
              <MapPin className="size-3" aria-hidden /> {ev.lat.toFixed(4)}, {ev.lng?.toFixed(4)}
            </p>
          )}
        </div>
      </div>
      {n.customerChoice && (
        <p className="rounded-lg bg-gray-50 p-2 text-table" data-testid="choice">
          <span className="font-semibold">{t(`cp21.choice.${n.customerChoice}`)}</span>
          {n.newSlot && ` · ${formatDate(n.newSlot.date)} ${n.newSlot.from}–${n.newSlot.to}`}
          {n.updatedAddress && ` · ${n.updatedAddress}`}
          {n.updatedContact && ` · ${n.updatedContact}`}
          {n.instructions && ` · “${n.instructions}”`}
          {n.rtoCharge !== undefined && ` · ${t('cp21.rtoCharged', { amount: formatINR(n.rtoCharge) })}`}
          <span className="block text-caption text-muted-foreground">{t('cp21.chosenBy', { name: chooser, at: formatDateTime(n.choiceAt ?? n.at) })}</span>
        </p>
      )}
    </li>
  )
}

function Choose({ s }: { s: Shipment }) {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const now = useDemoNow()
  const data = useData((d) => d)
  const dates = reattemptDates(now)
  const c = data.consignees[s.consigneeId]
  const [kind, setKind] = useState<'reattempt' | 'changeSlot' | 'rto'>('reattempt')
  const [date, setDate] = useState(dates[0])
  const [slot, setSlot] = useState(APPOINTMENT_SLOTS[1].from)
  const [contact, setContact] = useState('')
  const [address, setAddress] = useState('')
  const [instructions, setInstructions] = useState('')
  const [confirm, setConfirm] = useState(false)
  const charge = rtoCharge(data, s.id)
  const contactOk = !contact.trim() || /^\d{10}$/.test(contact.replace(/\s/g, ''))

  const submit = () => {
    const sl = APPOINTMENT_SLOTS.find((x) => x.from === slot)!
    useDemoStore.getState().respondNdr(
      s.id,
      kind === 'rto' ? { kind } : kind === 'reattempt' ? { kind, date, from: sl.from, to: sl.to, instructions } : { kind, date, from: sl.from, to: sl.to, contact, address, instructions },
      user.id,
    )
    toast.success(kind === 'rto' ? t('cp21.doneRto') : t('cp21.done', { date: formatDate(date), from: sl.from, to: sl.to }))
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="ch-h">
      <h2 id="ch-h" className="text-card-title">
        {t('cp21.yourAction')}
      </h2>
      <p className="text-caption text-muted-foreground">{t('cp21.firstWins')}</p>
      <RadioGroup value={kind} onValueChange={(v) => setKind(v as typeof kind)} className="flex flex-wrap gap-4" aria-label={t('cp21.yourAction')}>
        {(['reattempt', 'changeSlot', 'rto'] as const).map((k) => (
          <label key={k} className="flex items-center gap-2">
            <RadioGroupItem value={k} /> {t(`cp21.choice.${k}`)}
          </label>
        ))}
      </RadioGroup>
      {kind !== 'rto' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('cp21.date')} htmlFor="cp21-date" required hint={t('cp21.dateHint')}>
            <NativeSelect id="cp21-date" value={date} onChange={(e) => setDate(e.target.value)}>
              {dates.map((d) => (
                <option key={d} value={d}>
                  {formatDate(d)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('cp21.slot')} htmlFor="cp21-slot" required>
            <NativeSelect id="cp21-slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
              {APPOINTMENT_SLOTS.map((x) => (
                <option key={x.from} value={x.from}>
                  {x.from}–{x.to}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {kind === 'changeSlot' && (
            <>
              <Field label={t('cp21.contact')} htmlFor="cp21-contact" error={contactOk ? undefined : t('cp04.err.mobile')}>
                <Input id="cp21-contact" inputMode="tel" value={contact} onChange={(e) => setContact(e.target.value)} />
              </Field>
              <Field label={t('cp21.address')} htmlFor="cp21-address" hint={t('cp21.addressHint', { pincode: s.destPincode, current: c.address })}>
                <Input id="cp21-address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </Field>
            </>
          )}
          <Field label={t('cp21.instructions')} htmlFor="cp21-instr" className="sm:col-span-2">
            <Input id="cp21-instr" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={t('cp21.instructionsPh')} />
          </Field>
        </div>
      ) : (
        <p className="rounded-lg bg-status-warning-bg p-3" data-testid="rto-charge">
          {t('cp21.rtoCharge', { amount: formatINR(charge) })} {customer.billing === 'prepaid' ? t('cp21.fromWallet') : t('cp21.toInvoice')}
        </p>
      )}
      <Button className="self-start" disabled={!contactOk} onClick={() => (kind === 'rto' ? setConfirm(true) : submit())}>
        {t('cp21.submit')}
      </Button>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t('cp21.confirmRto', { amount: formatINR(charge) })} body={t('cp21.confirmRtoBody')} confirmLabel={t('cp21.submit')} destructive onConfirm={submit} />
    </section>
  )
}
