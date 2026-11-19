/**
 * PP-04 Partner registration — docs/02-partner-portal.md §6.2.
 * Source §4 Phase 1 Step 1: the partner chooses its type (A–F) and the legs it
 * can serve; fills company, coverage, fleet, capacity and indicative rates. A
 * duplicate check runs on GSTIN / PAN / phone and a map previews the coverage.
 * Left out under the scope rule (not in the client document): service tiers,
 * own vs attached fleet (kept only for Type B, which the §4.1 checklist needs),
 * field staff count.
 * SIMULATED: mobile OTP (123456); WhatsApp / email acknowledgement.
 */
import { CheckCircle2, Loader2, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { gstinCheck, networkCities, panValid } from '@shared/engines/onboarding'
import { CAPACITY_UNIT, mayHaveHubs, needsLanes, needsPincodes, PARTNER_TYPES, partnerDuplicate, RATE_UNIT, TYPE_LEGS, TYPE_SERVICES } from '@shared/engines/partnerOnboarding'
import { useData } from '@shared/hooks/useDemo'
import { DEMO_LOGIN_OTP, sendOtp, verifyLoginOtp } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { LEG_TYPES, type LegType, type PartnerApplication, type PartnerServiceOffer, type PartnerSource, type PartnerType, type VehicleClass } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { LanguageToggle } from '@shared/ui/LanguageToggle'
import { MapView } from '@shared/ui/MapView'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Stepper } from '@shared/ui/Stepper'

const SOURCES: PartnerSource[] = ['website', 'app', 'referral', 'sales']
const CONSTITUTIONS: PartnerApplication['constitution'][] = ['proprietorship', 'partnership', 'llp', 'privateLtd', 'publicLtd']
const VEHICLES: VehicleClass[] = ['twoWheeler', 'threeWheeler', 'tempo', 'truck14', 'truck19', 'truck32']
const OFFERS: PartnerServiceOffer[] = ['parcel', 'expressPtl', 'standardPtl']
const FREQ = ['daily', 'alternate', 'weekly'] as const

type Lane = PartnerApplication['lanes'][number]
type Hub = { name: string; address: string; pincode: string; areaSqft: string; docks: string }

interface Form {
  type: PartnerType | ''
  legs: LegType[]
  services: PartnerServiceOffer[]
  companyName: string
  gstRegistered: boolean
  gstin: string
  pan: string
  constitution: PartnerApplication['constitution'] | ''
  name: string
  designation: string
  mobile: string
  email: string
  address: string
  source: PartnerSource | ''
  states: string[]
  cities: string[]
  pincodes: string[]
  lanes: Lane[]
  hubs: Hub[]
  fleet: Partial<Record<VehicleClass, string>>
  ownFleet: boolean
  capacity: string
  rates: Partial<Record<LegType, string>>
}

const EMPTY: Form = { type: '', legs: [], services: [], companyName: '', gstRegistered: true, gstin: '', pan: '', constitution: '', name: '', designation: '', mobile: '', email: '', address: '', source: '', states: [], cities: [], pincodes: [], lanes: [], hubs: [], fleet: {}, ownFleet: false, capacity: '', rates: {} }

/**
 * Demo tooling: a sample applicant per kind of partner. INVENTED names and numbers.
 * D (A, E): line-haul on Delhi → Bengaluru, a single-partner lane → invited.
 * B (C): Delhi pincodes already served by three couriers → waitlisted.
 * F: a hub in Belagavi, where Logisco has none → invited, then a hub audit.
 */
const SAMPLES: Record<'B' | 'D' | 'F', Omit<Form, 'type' | 'legs' | 'services'>> = {
  D: { ...EMPTY, companyName: 'Vindhya Freight Carriers Pvt Ltd', gstin: '07AAHCV5521R1Z3', pan: 'AAHCV5521R', constitution: 'privateLtd', name: 'Harish Tiwari', designation: 'Director', mobile: '98990 31245', email: 'harish@vindhyafreight.in', address: 'Plot 22, Sanjay Gandhi Transport Nagar, New Delhi 110042', source: 'website', states: ['Delhi', 'Karnataka'], cities: ['New Delhi', 'Bengaluru'], lanes: [{ origin: 'New Delhi', dest: 'Bengaluru', frequency: 'daily', transitHours: 60 }], fleet: { truck19: '5', truck32: '12' }, capacity: '80000', rates: { lineHaul: '8.5' } },
  B: { ...EMPTY, companyName: 'Capital Express Couriers', gstin: '07AAGCC3318P1Z6', pan: 'AAGCC3318P', constitution: 'privateLtd', name: 'Sameer Khanna', designation: 'Director', mobile: '98112 45670', email: 'sameer@capitalexpress.in', address: 'C-41, Naraina Industrial Area, New Delhi 110028', source: 'referral', states: ['Delhi'], cities: ['New Delhi'], pincodes: ['110020', '110001', '110037'], fleet: { twoWheeler: '30', tempo: '4' }, capacity: '700', rates: { firstMile: '26', lastMile: '30' } },
  F: { ...EMPTY, companyName: 'Belgaum Cargo Hub Pvt Ltd', gstin: '29AAKCB7710F1Z2', pan: 'AAKCB7710F', constitution: 'privateLtd', name: 'Vinayak Patil', designation: 'Director', mobile: '94481 22007', email: 'vinayak@belgaumcargohub.in', address: 'Plot 9, Udyambag Industrial Estate, Belagavi 590008', source: 'sales', states: ['Karnataka'], cities: ['Belagavi'], hubs: [{ name: 'Udyambag hub', address: 'Plot 9, Udyambag Industrial Estate, Belagavi', pincode: '590001', areaSqft: '30000', docks: '6' }], capacity: '3000', rates: { originHub: '6', destHub: '6' } },
}
const SAMPLE_FOR: Record<PartnerType, 'B' | 'D' | 'F'> = { A: 'D', B: 'B', C: 'B', D: 'D', E: 'D', F: 'F' }

function CheckChips<T extends string>({ label, options, values, onChange, render }: { label: string; options: readonly T[]; values: T[]; onChange: (v: T[]) => void; render: (v: T) => string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o} className={cn('inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-caption', values.includes(o) && 'border-primary bg-primary-soft')}>
          <Checkbox checked={values.includes(o)} onCheckedChange={(c) => onChange(c === true ? [...values, o] : values.filter((v) => v !== o))} />
          {render(o)}
        </label>
      ))}
    </div>
  )
}

export default function PP04PartnerApply() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = useData((d) => d)
  const [f, setF] = useState<Form>(EMPTY)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const [step, setStep] = useState(0)
  const [tried, setTried] = useState(false)
  const [otpState, setOtpState] = useState<'idle' | 'sending' | 'sent' | 'verified'>('idle')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)

  const type = f.type || undefined
  const cities = useMemo(() => networkCities(data), [data])
  const states = [...new Set(cities.map((c) => c.state))].sort()
  const cityOptions = cities.filter((c) => f.states.includes(c.state)).map((c) => c.city)
  const pinOptions = Object.values(data.pincodes).filter((p) => p.serviceable && f.cities.includes(p.city))
  const gstOptional = type === 'C' || type === 'D'
  const gstRequired = !gstOptional || f.gstRegistered
  const g = gstinCheck(f.gstin)
  const dup = partnerDuplicate(data, { gstin: gstRequired ? f.gstin : undefined, pan: f.pan, mobile: f.mobile })
  const mobileOk = /^\d{10}$/.test(f.mobile.replace(/\s/g, ''))
  const hubsNeeded = type === 'F'

  const req = t('cp04.err.required')
  const errors: Record<string, string | undefined>[] = [
    {
      type: !type ? req : undefined,
      legs: !f.legs.length ? req : undefined,
      services: !f.services.length ? req : undefined,
    },
    {
      companyName: !f.companyName.trim() ? req : undefined,
      gstin: gstRequired && !g.ok ? t('cp04.err.gstin') : dup === 'gstin' ? t('pp04.err.duplicate') : undefined,
      pan: !panValid(f.pan) ? t('pp04.err.pan') : gstRequired && g.ok && g.pan !== f.pan.toUpperCase() ? t('pp04.err.panGstin') : dup === 'pan' ? t('pp04.err.duplicate') : undefined,
      constitution: !f.constitution ? req : undefined,
      name: !f.name.trim() ? req : undefined,
      mobile: !mobileOk ? t('cp04.err.mobile') : dup === 'mobile' ? t('pp04.err.duplicate') : otpState !== 'verified' ? t('cp04.err.verifyMobile') : undefined,
      email: !/^\S+@\S+\.\S+$/.test(f.email.trim()) ? t('cp04.err.email') : undefined,
      address: !f.address.trim() ? req : undefined,
      source: !f.source ? req : undefined,
    },
    {
      states: !f.states.length ? req : undefined,
      cities: !f.cities.length ? req : undefined,
      pincodes: type && needsPincodes(type) && f.legs.some((l) => l === 'firstMile' || l === 'lastMile') && !f.pincodes.length ? req : undefined,
      lanes: type && needsLanes(type) && f.legs.includes('lineHaul') && (!f.lanes.length || f.lanes.some((l) => !l.origin || !l.dest || l.origin === l.dest || !(l.transitHours > 0))) ? t('pp04.err.lanes') : undefined,
      hubs: (hubsNeeded && !f.hubs.length) || f.hubs.some((h) => !h.name.trim() || !data.pincodes[h.pincode] || !(Number(h.docks) > 0)) ? t('pp04.err.hubs') : undefined,
    },
    {
      capacity: !(Number(f.capacity) > 0) ? req : undefined,
      rates: f.legs.some((l) => !(Number(f.rates[l]) > 0)) ? t('pp04.err.rates') : undefined,
    },
  ]
  const err = (k: string) => (tried ? errors[step][k] : undefined)
  const stepValid = (i: number) => Object.values(errors[i]).every((e) => !e)

  const chooseType = (tp: PartnerType) => setF((x) => ({ ...x, type: tp, legs: TYPE_LEGS[tp], services: TYPE_SERVICES[tp], gstRegistered: true }))
  const fillSample = () => {
    if (!type) return
    setF((x) => ({ ...x, ...SAMPLES[SAMPLE_FOR[type]], type: x.type, legs: x.legs, services: x.services }))
    setOtpState('idle')
    setOtp('')
  }
  const next = () => {
    setTried(true)
    if (!stepValid(step)) return toast.error(t('cp04.fix'))
    setTried(false)
    setStep(step + 1)
  }
  const submit = async () => {
    setTried(true)
    if (![0, 1, 2, 3].every(stepValid)) return toast.error(t('cp04.fix'))
    setBusy(true)
    await new Promise((r) => setTimeout(r, 500))
    const r = useDemoStore.getState().applyAsPartner({
      type: type!,
      legs: f.legs,
      services: f.services,
      companyName: f.companyName,
      gstin: gstRequired ? f.gstin : '',
      pan: f.pan,
      gstRegistered: gstRequired,
      constitution: f.constitution as PartnerApplication['constitution'],
      contact: { name: f.name.trim(), designation: f.designation.trim(), mobile: f.mobile.trim(), email: f.email.trim() },
      address: f.address.trim(),
      source: f.source as PartnerSource,
      states: f.states,
      cities: f.cities,
      pincodes: needsPincodes(type!) ? f.pincodes : [],
      lanes: needsLanes(type!) ? f.lanes : [],
      hubs: f.hubs.map((h) => ({ name: h.name.trim(), address: h.address.trim(), pincode: h.pincode, areaSqft: Number(h.areaSqft) || 0, docks: Number(h.docks) })),
      fleet: Object.fromEntries(Object.entries(f.fleet).filter(([, n]) => Number(n) > 0).map(([k, n]) => [k, Number(n)])),
      ownFleet: type === 'B' ? f.ownFleet : undefined,
      capacity: Number(f.capacity),
      indicativeRates: f.legs.map((leg) => ({ leg, rate: Number(f.rates[leg]) })),
    })
    useSession.getState().login('partnerPortal', r.userId)
    toast.success(t('pp04.submitted', { ref: r.applicationId }))
    navigate('/partner/onboarding')
  }

  // Coverage preview: declared pincodes, lane end cities and hubs
  const cityPoint = (city: string) => Object.values(data.pincodes).find((p) => p.city === city)
  const markers = [
    ...f.pincodes.map((code) => data.pincodes[code]).filter(Boolean).map((p) => ({ id: `pin-${p.code}`, lat: p.lat, lng: p.lng, tone: 'info' as const, label: `${p.code} · ${p.area}` })),
    ...f.lanes.flatMap((l, i) => [l.origin, l.dest].map((c) => cityPoint(c)).filter(Boolean).map((p, j) => ({ id: `lane-${i}-${j}`, lat: p!.lat, lng: p!.lng, tone: 'success' as const, label: `${l.origin} → ${l.dest}` }))),
    ...f.hubs.map((h, i) => data.pincodes[h.pincode] && { id: `hub-${i}`, lat: data.pincodes[h.pincode].lat, lng: data.pincodes[h.pincode].lng, tone: 'warning' as const, label: h.name || h.pincode, emphasis: true }).filter((m): m is NonNullable<typeof m> => !!m),
  ]

  const steps = [t('pp04.step.type'), t('pp04.step.company'), t('pp04.step.coverage'), t('pp04.step.fleet')]
  const setLane = (i: number, p: Partial<Lane>) => set('lanes', f.lanes.map((l, j) => (j === i ? { ...l, ...p } : l)))
  const setHub = (i: number, p: Partial<Hub>) => set('hubs', f.hubs.map((h, j) => (j === i ? { ...h, ...p } : h)))

  return (
    <div data-app="partner-portal" className="min-h-dvh bg-gray-50">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3 sm:px-8">
        <Link to="/">
          <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-9" />
        </Link>
        <LanguageToggle />
      </header>
      <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-page-title">{t('pp04.title')}</h1>
            <p className="text-muted-foreground">{t('pp04.subtitle')}</p>
          </div>
          {type && step > 0 && step < 4 && (
            <Button variant="outline" size="sm" onClick={fillSample}>
              {t('pp04.fillSample')} <SimulatedTag />
            </Button>
          )}
        </div>
        <Stepper steps={steps} current={step} onStepClick={setStep} />

        {step === 0 && (
          <section className="flex flex-col gap-5 rounded-xl border bg-card p-6 shadow-card" aria-labelledby="type-h">
            <h2 id="type-h" className="text-card-title">
              {t('pp04.step.type')}
            </h2>
            <div role="radiogroup" aria-label={t('pp04.partnerType')} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PARTNER_TYPES.map((tp) => (
                <button
                  key={tp}
                  type="button"
                  role="radio"
                  aria-checked={f.type === tp}
                  onClick={() => chooseType(tp)}
                  className={cn('flex flex-col gap-1 rounded-lg border bg-background p-4 text-left hover:border-primary', f.type === tp && 'border-primary bg-primary-soft ring-1 ring-primary')}
                >
                  <span className="font-semibold">
                    {tp} · {t(`ponb.type.${tp}`)}
                  </span>
                  <span className="text-caption text-muted-foreground">{t(`ponb.typeDesc.${tp}`)}</span>
                </button>
              ))}
            </div>
            {err('type') && <p className="text-caption font-medium text-status-danger">{err('type')}</p>}
            {type && (
              <>
                <Field label={t('pp04.legs')} required error={err('legs')} hint={t('pp04.legsHint')}>
                  <CheckChips label={t('pp04.legs')} options={LEG_TYPES} values={f.legs} onChange={(v) => set('legs', v)} render={(l) => t(`legType.${l}`)} />
                </Field>
                <Field label={t('pp04.services')} required error={err('services')}>
                  <CheckChips label={t('pp04.services')} options={OFFERS} values={f.services} onChange={(v) => set('services', v)} render={(s) => t(`service.${s}`)} />
                </Field>
              </>
            )}
          </section>
        )}

        {step === 1 && (
          <section className="grid gap-4 rounded-xl border bg-card p-6 shadow-card sm:grid-cols-2" aria-labelledby="co-h">
            <h2 id="co-h" className="text-card-title sm:col-span-2">
              {t('pp04.step.company')}
            </h2>
            <Field label={t('pp04.companyName')} htmlFor="pa-name" required error={err('companyName')} className="sm:col-span-2">
              <Input id="pa-name" value={f.companyName} onChange={(e) => set('companyName', e.target.value)} />
            </Field>
            {gstOptional && (
              <label className="flex items-center gap-2 sm:col-span-2">
                <Checkbox checked={f.gstRegistered} onCheckedChange={(v) => set('gstRegistered', v === true)} /> {t('pp04.gstRegistered')}
              </label>
            )}
            {gstRequired && (
              <Field label={t('cp04.gstin')} htmlFor="pa-gstin" required error={err('gstin')} hint={g.ok ? t('cp04.gstinState', { state: g.state }) : t('cp04.gstinHint')}>
                <Input id="pa-gstin" maxLength={15} className="tabular" value={f.gstin} onChange={(e) => {
                  const v = e.target.value.toUpperCase().trim()
                  const c = gstinCheck(v)
                  setF((x) => ({ ...x, gstin: v, pan: c.ok && !x.pan ? c.pan! : x.pan }))
                }} />
              </Field>
            )}
            <Field label={t('pp04.pan')} htmlFor="pa-pan" required error={err('pan')}>
              <Input id="pa-pan" maxLength={10} className="tabular" value={f.pan} onChange={(e) => set('pan', e.target.value.toUpperCase().trim())} />
            </Field>
            <Field label={t('pp04.constitution')} htmlFor="pa-const" required error={err('constitution')}>
              <NativeSelect id="pa-const" value={f.constitution} onChange={(e) => set('constitution', e.target.value as Form['constitution'])}>
                <option value="">{t('cp04.choose')}</option>
                {CONSTITUTIONS.map((c) => (
                  <option key={c} value={c}>
                    {t(`ponb.constitution.${c}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('cp04.name')} htmlFor="pa-contact" required error={err('name')}>
              <Input id="pa-contact" value={f.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label={t('cp04.designation')} htmlFor="pa-desig">
              <Input id="pa-desig" value={f.designation} onChange={(e) => set('designation', e.target.value)} />
            </Field>
            <Field label={t('cp04.mobile')} htmlFor="pa-mobile" required error={err('mobile')}>
              <div className="flex gap-2">
                <Input id="pa-mobile" inputMode="tel" value={f.mobile} disabled={otpState === 'verified'} onChange={(e) => (set('mobile', e.target.value), setOtpState('idle'), setOtp(''))} />
                {otpState === 'verified' ? (
                  <span className="inline-flex items-center gap-1 text-caption font-semibold text-status-success">
                    <CheckCircle2 className="size-4" aria-hidden /> {t('cp04.verified')}
                  </span>
                ) : (
                  <Button type="button" variant="outline" disabled={!mobileOk || otpState === 'sending'} onClick={async () => (setOtpState('sending'), await sendOtp(f.mobile), setOtpState('sent'))}>
                    {otpState === 'sending' && <Loader2 className="animate-spin" />} {t('cp04.sendOtp')}
                  </Button>
                )}
              </div>
            </Field>
            {otpState === 'sent' ? (
              <Field label={t('cp04.otp')} htmlFor="pa-otp" hint={<>{t('login.otpHint', { otp: DEMO_LOGIN_OTP })} <SimulatedTag /></>}>
                <div className="flex gap-2">
                  <Input id="pa-otp" inputMode="numeric" maxLength={6} className="tabular" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
                  <Button type="button" disabled={otp.length !== 6} onClick={() => (verifyLoginOtp(otp) ? setOtpState('verified') : toast.error(t('login.wrongOtp')))}>
                    {t('cp04.verify')}
                  </Button>
                </div>
              </Field>
            ) : (
              <span className="hidden sm:block" />
            )}
            <Field label={t('cp04.email')} htmlFor="pa-email" required error={err('email')}>
              <Input id="pa-email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
            </Field>
            <Field label={t('pp04.source')} htmlFor="pa-src" required error={err('source')}>
              <NativeSelect id="pa-src" value={f.source} onChange={(e) => set('source', e.target.value as PartnerSource)}>
                <option value="">{t('cp04.choose')}</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {t(`ponb.source.${s}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('pp04.address')} htmlFor="pa-addr" required error={err('address')} className="sm:col-span-2">
              <Input id="pa-addr" value={f.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            {dup && <p role="alert" className="rounded-lg bg-status-danger-bg p-3 text-caption font-medium text-status-danger sm:col-span-2">{t('pp04.err.duplicate')}</p>}
          </section>
        )}

        {step === 2 && type && (
          <section className="flex flex-col gap-5 rounded-xl border bg-card p-6 shadow-card" aria-labelledby="cov-h">
            <h2 id="cov-h" className="text-card-title">
              {t('pp04.step.coverage')}
            </h2>
            <Field label={t('pp04.states')} required error={err('states')}>
              <CheckChips label={t('pp04.states')} options={states} values={f.states} onChange={(v) => setF((x) => ({ ...x, states: v, cities: x.cities.filter((c) => cities.some((n) => n.city === c && v.includes(n.state))) }))} render={(s) => s} />
            </Field>
            {f.states.length > 0 && (
              <Field label={t('pp04.cities')} required error={err('cities')}>
                <CheckChips label={t('pp04.cities')} options={cityOptions} values={f.cities} onChange={(v) => setF((x) => ({ ...x, cities: v, pincodes: x.pincodes.filter((p) => v.includes(data.pincodes[p]?.city)) }))} render={(c) => c} />
              </Field>
            )}
            {needsPincodes(type) && f.cities.length > 0 && (
              <Field label={t('pp04.pincodes')} required={f.legs.some((l) => l === 'firstMile' || l === 'lastMile')} error={err('pincodes')} hint={t('pp04.pincodesCount', { count: f.pincodes.length })}>
                <div className="flex flex-col gap-2">
                  <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set('pincodes', pinOptions.map((p) => p.code))}>
                    {t('pp04.allPincodes')}
                  </Button>
                  <CheckChips label={t('pp04.pincodes')} options={pinOptions.map((p) => p.code)} values={f.pincodes} onChange={(v) => set('pincodes', v)} render={(c) => `${c} · ${data.pincodes[c].area}`} />
                </div>
              </Field>
            )}
            {needsLanes(type) && (
              <fieldset className="flex flex-col gap-3" aria-describedby={err('lanes') ? 'lanes-err' : undefined}>
                <legend className="mb-2 font-semibold">{t('pp04.lanes')}</legend>
                {f.lanes.map((l, i) => (
                  <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1fr_9rem_7rem_auto]">
                    <Field label={t('pp04.laneFrom')} htmlFor={`ln-o-${i}`} small>
                      <NativeSelect id={`ln-o-${i}`} value={l.origin} onChange={(e) => setLane(i, { origin: e.target.value })}>
                        <option value="">{t('cp04.choose')}</option>
                        {cities.map((c) => <option key={c.city}>{c.city}</option>)}
                      </NativeSelect>
                    </Field>
                    <Field label={t('pp04.laneTo')} htmlFor={`ln-d-${i}`} small>
                      <NativeSelect id={`ln-d-${i}`} value={l.dest} onChange={(e) => setLane(i, { dest: e.target.value })}>
                        <option value="">{t('cp04.choose')}</option>
                        {cities.map((c) => <option key={c.city}>{c.city}</option>)}
                      </NativeSelect>
                    </Field>
                    <Field label={t('pp04.frequency')} htmlFor={`ln-f-${i}`} small>
                      <NativeSelect id={`ln-f-${i}`} value={l.frequency} onChange={(e) => setLane(i, { frequency: e.target.value as Lane['frequency'] })}>
                        {FREQ.map((q) => <option key={q} value={q}>{t(`ponb.freq.${q}`)}</option>)}
                      </NativeSelect>
                    </Field>
                    <Field label={t('pp04.transitHours')} htmlFor={`ln-h-${i}`} small>
                      <Input id={`ln-h-${i}`} type="number" min={1} value={l.transitHours || ''} onChange={(e) => setLane(i, { transitHours: Number(e.target.value) })} />
                    </Field>
                    <Button type="button" variant="ghost" size="icon" aria-label={t('pp04.remove')} onClick={() => set('lanes', f.lanes.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set('lanes', [...f.lanes, { origin: '', dest: '', frequency: 'daily', transitHours: 0 }])}>
                  <Plus /> {t('pp04.addLane')}
                </Button>
                {err('lanes') && <p id="lanes-err" className="text-caption font-medium text-status-danger">{err('lanes')}</p>}
              </fieldset>
            )}
            {mayHaveHubs(type) && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 font-semibold">
                  {t('pp04.hubs')} {type !== 'F' && <span className="font-normal text-muted-foreground">({t('pp04.ifAny')})</span>}
                </legend>
                {f.hubs.map((h, i) => (
                  <div key={i} className="grid items-end gap-2 sm:grid-cols-[1fr_1.4fr_7rem_7rem_5rem_auto]">
                    <Field label={t('pp04.hubName')} htmlFor={`hb-n-${i}`} small>
                      <Input id={`hb-n-${i}`} value={h.name} onChange={(e) => setHub(i, { name: e.target.value })} />
                    </Field>
                    <Field label={t('pp04.address')} htmlFor={`hb-a-${i}`} small>
                      <Input id={`hb-a-${i}`} value={h.address} onChange={(e) => setHub(i, { address: e.target.value })} />
                    </Field>
                    <Field label={t('pp04.pincode')} htmlFor={`hb-p-${i}`} small>
                      <Input id={`hb-p-${i}`} inputMode="numeric" maxLength={6} value={h.pincode} onChange={(e) => setHub(i, { pincode: e.target.value.replace(/\D/g, '') })} />
                    </Field>
                    <Field label={t('pp04.area')} htmlFor={`hb-s-${i}`} small>
                      <Input id={`hb-s-${i}`} type="number" min={0} value={h.areaSqft} onChange={(e) => setHub(i, { areaSqft: e.target.value })} />
                    </Field>
                    <Field label={t('pp04.docks')} htmlFor={`hb-d-${i}`} small>
                      <Input id={`hb-d-${i}`} type="number" min={1} value={h.docks} onChange={(e) => setHub(i, { docks: e.target.value })} />
                    </Field>
                    <Button type="button" variant="ghost" size="icon" aria-label={t('pp04.remove')} onClick={() => set('hubs', f.hubs.filter((_, j) => j !== i))}>
                      <Trash2 />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => set('hubs', [...f.hubs, { name: '', address: '', pincode: '', areaSqft: '', docks: '' }])}>
                  <Plus /> {t('pp04.addHub')}
                </Button>
                {err('hubs') && <p className="text-caption font-medium text-status-danger">{err('hubs')}</p>}
              </fieldset>
            )}
            <div>
              <h3 className="mb-2 font-semibold">{t('pp04.mapPreview')}</h3>
              <MapView markers={markers} ariaLabel={t('pp04.mapPreview')} className="h-72" />
            </div>
          </section>
        )}

        {step === 3 && type && (
          <section className="flex flex-col gap-5 rounded-xl border bg-card p-6 shadow-card" aria-labelledby="fl-h">
            <h2 id="fl-h" className="text-card-title">
              {t('pp04.step.fleet')}
            </h2>
            {type !== 'F' && (
              <fieldset>
                <legend className="mb-2 font-semibold">{t('pp04.fleet')}</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {VEHICLES.map((v) => (
                    <Field key={v} label={t(`ponb.vehicle.${v}`)} htmlFor={`fl-${v}`} small>
                      <Input id={`fl-${v}`} type="number" min={0} value={f.fleet[v] ?? ''} onChange={(e) => set('fleet', { ...f.fleet, [v]: e.target.value })} />
                    </Field>
                  ))}
                </div>
              </fieldset>
            )}
            {type === 'B' && (
              <label className="flex items-center gap-2">
                <Checkbox checked={f.ownFleet} onCheckedChange={(v) => set('ownFleet', v === true)} /> {t('pp04.ownFleet')}
              </label>
            )}
            <Field label={t('pp04.capacity', { unit: t(`ponb.capUnit.${CAPACITY_UNIT[type]}`) })} htmlFor="pa-cap" required error={err('capacity')} className="max-w-xs">
              <Input id="pa-cap" type="number" min={1} value={f.capacity} onChange={(e) => set('capacity', e.target.value)} />
            </Field>
            <fieldset>
              <legend className="mb-2 font-semibold">{t('pp04.rates')}</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {f.legs.map((l) => (
                  <Field key={l} label={`${t(`legType.${l}`)} (₹ ${t(`ponb.rateUnit.${RATE_UNIT[type]}`)})`} htmlFor={`rt-${l}`} small>
                    <Input id={`rt-${l}`} type="number" min={0} step="0.01" value={f.rates[l] ?? ''} onChange={(e) => set('rates', { ...f.rates, [l]: e.target.value })} />
                  </Field>
                ))}
              </div>
              {err('rates') && <p className="mt-2 text-caption font-medium text-status-danger">{err('rates')}</p>}
            </fieldset>
          </section>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {step > 0 && (
            <Button variant="outline" onClick={() => (setTried(false), setStep(step - 1))}>
              {t('pp04.back')}
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={next}>{t('pp04.next')}</Button>
          ) : (
            <Button size="lg" onClick={submit} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {t('pp04.submit')}
            </Button>
          )}
          <Link to="/launch/partner-portal" className="text-caption font-medium text-primary hover:underline">
            {t('pp04.haveAccount')}
          </Link>
        </div>
      </main>
    </div>
  )
}
