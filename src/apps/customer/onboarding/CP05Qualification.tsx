/**
 * CP-05 Business qualification — docs/01-customer-portal.md §6.1.
 * The shipping profile (source §6 Step 2): Logisco checks the lanes and sets
 * the onboarding track. The customer sees serviceability only, never costs.
 */
import { ArrowRight, Plus, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { assisted, laneVerdict, networkCities } from '@shared/engines/onboarding'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import type { Qualification, SpendBand } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { useCustomerSession } from '../useCustomerSession'
import { OnboardingSteps } from './OnboardingSteps'

const SPEND: SpendBand[] = ['lt50k', '50kTo2l', '2lTo10l', '10lTo50l', 'gt50l']
const HANDLING: Qualification['specialHandling'] = ['fragile', 'heavy', 'appointment', 'oda', 'reverse']
const PAYMENT: Qualification['payment'] = ['prepaid', 'tbb', 'toPay', 'cod']
const VERDICT_TONE = { serviceable: 'success', oda: 'warning', notServiceable: 'danger' } as const

type Lane = { originPincode: string; destCity: string; perMonth: string }

export default function CP05Qualification() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const saved = customer.onboarding?.qualification
  const [shipments, setShipments] = useState(saved ? String(saved.shipmentsPerMonth) : '')
  const [spend, setSpend] = useState<SpendBand | ''>(saved?.spendBand ?? '')
  const [parcelPct, setParcelPct] = useState(saved?.parcelPct ?? 50)
  const [lanes, setLanes] = useState<Lane[]>(saved ? saved.lanes.map((l) => ({ ...l, perMonth: String(l.perMonth) })) : [{ originPincode: '', destCity: '', perMonth: '' }])
  const [handling, setHandling] = useState<Qualification['specialHandling']>(saved?.specialHandling ?? [])
  const [payment, setPayment] = useState<Qualification['payment']>(saved?.payment ?? [])
  const [tried, setTried] = useState(false)
  const cities = networkCities(data)

  const laneErrors = lanes.map((l) => ({
    origin: !/^\d{6}$/.test(l.originPincode) ? t('cp05.err.pincode') : undefined,
    dest: !l.destCity ? t('cp04.err.required') : undefined,
    perMonth: !(Number(l.perMonth) > 0) ? t('cp05.err.positive') : undefined,
  }))
  const errors = {
    shipments: !(Number(shipments) >= 1) ? t('cp05.err.positive') : undefined,
    spend: !spend ? t('cp04.err.required') : undefined,
    payment: payment.length === 0 ? t('cp05.err.payment') : undefined,
  }
  const valid = !errors.shipments && !errors.spend && !errors.payment && laneErrors.every((e) => !e.origin && !e.dest && !e.perMonth)
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const setLane = (i: number, patch: Partial<Lane>) => setLanes((x) => x.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const submit = () => {
    setTried(true)
    if (!valid) {
      toast.error(t('cp04.fix'))
      return
    }
    useDemoStore.getState().saveQualification(
      customer.id,
      { shipmentsPerMonth: Number(shipments), spendBand: spend as SpendBand, parcelPct, lanes: lanes.map((l) => ({ originPincode: l.originPincode, destCity: l.destCity, perMonth: Number(l.perMonth) })), specialHandling: handling, payment },
      user.id,
    )
    toast.success(t('cp05.saved'))
  }

  const result = customer.onboarding?.qualification
  const kam = customer.kamId ? data.staff[customer.kamId] : undefined

  return (
    <div className="max-w-4xl">
      <OnboardingSteps customer={customer} current="qualification" />
      <PageHeader title={t('cp05.title')} subtitle={t('cp05.subtitle')} />

      <section className="grid gap-4 rounded-xl border bg-card p-6 shadow-card sm:grid-cols-2" aria-labelledby="prof-h">
        <h2 id="prof-h" className="text-card-title sm:col-span-2">
          {t('cp05.profile')}
        </h2>
        <Field label={t('cp05.shipments')} htmlFor="q-ship" required error={tried ? errors.shipments : undefined}>
          <Input id="q-ship" type="number" min={1} value={shipments} onChange={(e) => setShipments(e.target.value)} />
        </Field>
        <Field label={t('cp05.spend')} htmlFor="q-spend" required error={tried ? errors.spend : undefined}>
          <NativeSelect id="q-spend" value={spend} onChange={(e) => setSpend(e.target.value as SpendBand)}>
            <option value="">{t('cp04.choose')}</option>
            {SPEND.map((s) => (
              <option key={s} value={s}>
                {t(`cp05.spendBand.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('cp05.mix')} htmlFor="q-mix" className="sm:col-span-2" hint={t('cp05.mixValue', { parcel: parcelPct, ptl: 100 - parcelPct })}>
          <input id="q-mix" type="range" min={0} max={100} step={10} value={parcelPct} onChange={(e) => setParcelPct(Number(e.target.value))} className="w-full accent-[var(--accent)]" />
        </Field>
      </section>

      <section className="mt-4 flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-card" aria-labelledby="lanes-h">
        <h2 id="lanes-h" className="text-card-title">
          {t('cp05.lanes')}
        </h2>
        {lanes.map((l, i) => (
          <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_1fr_auto] sm:items-end">
            <Field label={t('cp05.origin')} htmlFor={`q-o-${i}`} required error={tried ? laneErrors[i].origin : undefined}>
              <Input id={`q-o-${i}`} inputMode="numeric" maxLength={6} value={l.originPincode} onChange={(e) => setLane(i, { originPincode: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label={t('cp05.dest')} htmlFor={`q-d-${i}`} required error={tried ? laneErrors[i].dest : undefined}>
              <NativeSelect id={`q-d-${i}`} value={l.destCity} onChange={(e) => setLane(i, { destCity: e.target.value })}>
                <option value="">{t('cp04.choose')}</option>
                {cities.map((c) => (
                  <option key={c.city} value={c.city}>
                    {c.city}, {c.state}
                  </option>
                ))}
                <option value="__other">{t('cp05.otherCity')}</option>
              </NativeSelect>
            </Field>
            <Field label={t('cp05.perMonth')} htmlFor={`q-n-${i}`} required error={tried ? laneErrors[i].perMonth : undefined}>
              <Input id={`q-n-${i}`} type="number" min={1} value={l.perMonth} onChange={(e) => setLane(i, { perMonth: e.target.value })} />
            </Field>
            <Button variant="ghost" size="icon" disabled={lanes.length === 1} onClick={() => setLanes((x) => x.filter((_, j) => j !== i))} aria-label={t('cp05.removeLane', { n: i + 1 })}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" className="self-start" disabled={lanes.length >= 5} onClick={() => setLanes((x) => [...x, { originPincode: '', destCity: '', perMonth: '' }])}>
          <Plus /> {t('cp05.addLane')}
        </Button>
      </section>

      <section className="mt-4 grid gap-4 rounded-xl border bg-card p-6 shadow-card sm:grid-cols-2" aria-labelledby="needs-h">
        <h2 id="needs-h" className="text-card-title sm:col-span-2">
          {t('cp05.needs')}
        </h2>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-caption font-medium">{t('cp05.handling')}</legend>
          {HANDLING.map((h) => (
            <label key={h} className="flex items-center gap-2">
              <Checkbox checked={handling.includes(h)} onCheckedChange={() => setHandling((x) => toggle(x, h))} /> {t(`cp05.handlingOpt.${h}`)}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-caption font-medium">
            {t('cp05.payment')} <span className="text-status-danger">*</span>
          </legend>
          {PAYMENT.map((p) => (
            <label key={p} className="flex items-center gap-2">
              <Checkbox checked={payment.includes(p)} onCheckedChange={() => setPayment((x) => toggle(x, p))} /> {t(`cp05.paymentOpt.${p}`)}
            </label>
          ))}
          {tried && errors.payment && <p className="text-caption font-medium text-status-danger">{errors.payment}</p>}
        </fieldset>
      </section>

      <div className="mt-4 flex gap-2">
        <Button onClick={submit}>{result ? t('cp05.update') : t('cp05.submit')}</Button>
      </div>

      {result && (
        <section className="mt-6 flex flex-col gap-4 rounded-xl border-2 border-primary bg-card p-6 shadow-card" aria-labelledby="res-h" data-testid="cp05-result">
          <h2 id="res-h" className="text-card-title">
            {t('cp05.result')}
          </h2>
          <ul className="flex flex-col gap-2">
            {result.lanes.map((l, i) => {
              const v = laneVerdict(data, l.originPincode, l.destCity)
              const o = data.pincodes[l.originPincode]
              return (
                <li key={i} className="flex flex-wrap items-center gap-2">
                  <span className="tabular">
                    {o ? `${o.city} ${o.code}` : l.originPincode} → {l.destCity === '__other' ? t('cp05.otherCity') : l.destCity}
                  </span>
                  <Chip tone={VERDICT_TONE[v]}>{t(`cp05.verdict.${v}`)}</Chip>
                </li>
              )
            })}
          </ul>
          <p>
            {t('cp05.track')}: <strong>{t(`track.${customer.track}`)}</strong>
          </p>
          {assisted(customer.track) && kam ? (
            <div className="flex items-start gap-3 rounded-lg bg-primary-soft p-4">
              <UserRound className="mt-0.5 size-5 text-primary" aria-hidden />
              <div>
                <p className="font-semibold">
                  {kam.name} · {kam.title}
                </p>
                <p className="text-caption">{t('cp05.kamNote')}</p>
              </div>
            </div>
          ) : (
            <p className="text-caption text-muted-foreground">{t('cp05.selfServeNote')}</p>
          )}
          <Button className="self-start" onClick={() => navigate('/customer/onboarding/kyc')}>
            {t('cp05.continue')} <ArrowRight />
          </Button>
        </section>
      )}
    </div>
  )
}
