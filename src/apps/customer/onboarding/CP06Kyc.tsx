/**
 * CP-06 KYC verification — docs/01-customer-portal.md §6.1.
 * Source §6 Step 3: GSTIN, PAN, CIN, authorised signatory, bank account and
 * pickup addresses; GSTIN / PAN verified by API, bank penny-drop, AI address
 * correction pins pickup points. SIMULATED: the API calls, penny-drop and the
 * pin suggestion. GSTIN ending "Z9" and IFSC FAIL0000000 show the flagged path.
 */
import { ArrowRight, Loader2, MapPin, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { IFSC_FORMAT, panValid } from '@shared/engines/onboarding'
import { useData } from '@shared/hooks/useDemo'
import { formatDate } from '@shared/lib/format'
import { simulateLatency } from '@shared/sim/latency'
import { useDemoStore } from '@shared/store'
import { kycReady } from '@shared/store/onboardingActions'
import type { CheckState } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { MapView } from '@shared/ui/MapView'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { Switch } from '@shared/ui/switch'
import { useCustomerSession } from '../useCustomerSession'
import { OnboardingSteps } from './OnboardingSteps'

/** 06:00 … 22:00 every half hour */
const HALF_HOURS = Array.from({ length: 33 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

const STATE_TONE: Record<CheckState, 'neutral' | 'success' | 'warning'> = { notStarted: 'neutral', verified: 'success', flagged: 'warning' }

function Section({ title, state, children }: { title: string; state: CheckState; children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-card-title">{title}</h2>
        <Chip tone={STATE_TONE[state]}>{t(`cp06.state.${state}`)}</Chip>
      </div>
      {children}
    </section>
  )
}

export default function CP06Kyc() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, customer: c } = useCustomerSession()
  const data = useData((d) => d)
  const store = useDemoStore.getState
  const k = c.onboarding?.kyc
  const [busy, setBusy] = useState<string>()
  const run = async (key: string, fn: () => void) => {
    setBusy(key)
    await simulateLatency(1200, 1700)
    fn()
    setBusy(undefined)
  }

  // Section 1
  const [cin, setCin] = useState(k?.cin ?? c.cin ?? '')
  const [pan, setPan] = useState(k?.pan.value ?? c.pan)
  const company = c.entityType === 'Private Ltd' || c.entityType === 'Public Ltd'
  // Section 2
  const [sig, setSig] = useState(k?.signatory ?? { name: '', designation: '', email: '', mobile: '' })
  // Section 3
  const [bank, setBank] = useState({ holder: k?.bank.holder ?? c.legalName, account: k?.bank.account ?? '', confirm: k?.bank.account ?? '', ifsc: k?.bank.ifsc ?? '', type: k?.bank.type ?? ('current' as 'current' | 'savings') })
  const accountOk = /^\d{9,18}$/.test(bank.account) && bank.account === bank.confirm
  const ifscOk = IFSC_FORMAT.test(bank.ifsc)
  // Section 4
  const blank = { name: '', address: '', landmark: '', pincode: '', contact: '', mobile: '', from: '10:00', to: '17:00', days: 'Mon–Sat', isDefault: false, pinConfirmed: false }
  const [loc, setLoc] = useState(blank)
  const [tryLoc, setTryLoc] = useState(false)
  const locations = Object.values(data.pickupLocations).filter((l) => l.customerId === c.id)
  const pin = data.pincodes[loc.pincode]
  // SIMULATED AI address correction: the pin sits a little off the pincode centre, on the address
  const suggested = pin ? { lat: pin.lat + 0.004, lng: pin.lng - 0.003 } : undefined
  const locErrors = {
    name: !loc.name.trim(),
    address: !loc.address.trim(),
    pincode: !pin,
    contact: !loc.contact.trim(),
    mobile: !/^\d{10}$/.test(loc.mobile.replace(/\s/g, '')),
    pin: !loc.pinConfirmed,
    window: loc.from >= loc.to,
  }

  const addLocation = () => {
    setTryLoc(true)
    if (Object.values(locErrors).some(Boolean)) return
    store().savePickupLocation(c.id, {
      name: loc.name.trim(),
      address: [loc.address.trim(), loc.landmark.trim()].filter(Boolean).join(', '),
      pincode: loc.pincode,
      lat: suggested!.lat,
      lng: suggested!.lng,
      contact: { name: loc.contact.trim(), mobile: loc.mobile.trim() },
      window: { from: loc.from, to: loc.to },
      days: loc.days,
      isDefault: loc.isDefault,
    })
    setLoc(blank)
    setTryLoc(false)
    toast.success(t('cp06.locationAdded'))
  }

  const sigOk = !!sig.name.trim() && !!sig.designation.trim() && /^\S+@\S+\.\S+$/.test(sig.email) && /^\d{10}$/.test(sig.mobile.replace(/\s/g, ''))
  const ready = kycReady(data, c.id)
  const nextPath = c.billing === 'credit' ? '/customer/onboarding/credit' : '/customer/onboarding/next'

  return (
    <div className="max-w-4xl">
      <OnboardingSteps customer={c} current="kyc" />
      <PageHeader title={t('cp06.title')} subtitle={t('cp06.subtitle')} />

      {k?.status === 'verified' && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border-2 border-status-success bg-status-success-bg p-4">
          <ShieldCheck className="size-6 text-status-success" aria-hidden />
          <span className="font-semibold">{t('cp06.verifiedBanner')}</span>
          <Button size="sm" className="ml-auto" onClick={() => navigate(nextPath)}>
            {t('cp06.continue')} <ArrowRight />
          </Button>
        </div>
      )}
      {k?.status === 'underReview' && (
        <div role="status" className="mb-4 rounded-xl border-2 border-status-warning bg-status-warning-bg p-4 font-medium">
          {t('cp06.underReview')}
        </div>
      )}

      <div className="flex flex-col gap-4">
        {/* 1. Business identity */}
        <Section title={t('cp06.s1')} state={k?.gstin.state === 'flagged' || k?.pan.state === 'flagged' ? 'flagged' : k?.gstin.state === 'verified' && k.pan.state === 'verified' ? 'verified' : 'notStarted'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('cp04.gstin')} htmlFor="k-gstin">
              <Input id="k-gstin" value={c.gstin} readOnly className="tabular bg-gray-50" />
            </Field>
            {company && (
              <Field label={t('cp06.cin')} htmlFor="k-cin" required hint={t('cp06.cinHint')}>
                <Input id="k-cin" maxLength={21} value={cin} onChange={(e) => setCin(e.target.value.toUpperCase())} className="tabular" />
              </Field>
            )}
          </div>
          <Button variant="outline" className="self-start" disabled={!!busy || (company && cin.length !== 21)} onClick={() => run('gstin', () => store().verifyGstin(c.id, cin || undefined))}>
            {busy === 'gstin' && <Loader2 className="animate-spin" />} {t('cp06.verifyGstin')} <SimulatedTag />
          </Button>
          {k?.gstin.state && k.gstin.state !== 'notStarted' && (
            <dl className="grid gap-x-6 gap-y-1 text-body sm:grid-cols-2" data-testid="gst-result">
              <Fact label={t('cp06.legalName')} value={k.gstin.legalName} />
              <Fact label={t('cp06.tradeName')} value={k.gstin.tradeName} />
              <Fact label={t('cp06.gstStatus')} value={k.gstin.active ? t('cp06.active') : t('cp06.cancelled')} danger={!k.gstin.active} />
              <Fact label={t('cp06.registeredOn')} value={k.gstin.registeredOn ? formatDate(k.gstin.registeredOn) : ''} />
              <Fact label={t('cp06.constitution')} value={k.gstin.constitution} />
              <Fact label={t('cp06.address')} value={k.gstin.address} />
            </dl>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label={t('cp06.pan')} htmlFor="k-pan" required hint={t('cp06.panHint')} error={pan && !panValid(pan) ? t('cp06.err.pan') : undefined}>
              <Input id="k-pan" maxLength={10} value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} className="tabular" />
            </Field>
            <Button variant="outline" disabled={!!busy || !panValid(pan)} onClick={() => run('pan', () => store().verifyPan(c.id, pan))}>
              {busy === 'pan' && <Loader2 className="animate-spin" />} {t('cp06.verifyPan')}
            </Button>
          </div>
          {k?.pan.state === 'flagged' && <p className="text-caption font-medium text-status-warning">{t('cp06.panMismatch')}</p>}
        </Section>

        {/* 2. Authorised signatory */}
        <Section title={t('cp06.s2')} state={k?.signatory ? 'verified' : 'notStarted'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('cp06.sigName')} htmlFor="k-sn" required>
              <Input id="k-sn" value={sig.name} onChange={(e) => setSig({ ...sig, name: e.target.value })} />
            </Field>
            <Field label={t('cp04.designation')} htmlFor="k-sd" required>
              <Input id="k-sd" value={sig.designation} onChange={(e) => setSig({ ...sig, designation: e.target.value })} />
            </Field>
            <Field label={t('cp04.email')} htmlFor="k-se" required hint={t('cp06.sigEmailHint')}>
              <Input id="k-se" type="email" value={sig.email} onChange={(e) => setSig({ ...sig, email: e.target.value })} />
            </Field>
            <Field label={t('cp04.mobile')} htmlFor="k-sm" required>
              <Input id="k-sm" inputMode="tel" value={sig.mobile} onChange={(e) => setSig({ ...sig, mobile: e.target.value })} />
            </Field>
          </div>
          <Button variant="outline" className="self-start" disabled={!sigOk} onClick={() => (store().saveSignatory(c.id, sig), toast.success(t('cp06.sigSaved')))}>
            {t('cp06.saveSignatory')}
          </Button>
        </Section>

        {/* 3. Bank account */}
        <Section title={t('cp06.s3')} state={k?.bank.state ?? 'notStarted'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('cp06.holder')} htmlFor="k-bh" required hint={t('cp06.holderHint')}>
              <Input id="k-bh" value={bank.holder} onChange={(e) => setBank({ ...bank, holder: e.target.value })} />
            </Field>
            <Field label={t('cp06.ifsc')} htmlFor="k-bi" required error={bank.ifsc && !ifscOk ? t('cp06.err.ifsc') : undefined}>
              <Input id="k-bi" maxLength={11} value={bank.ifsc} onChange={(e) => setBank({ ...bank, ifsc: e.target.value.toUpperCase() })} className="tabular" />
            </Field>
            <Field label={t('cp06.account')} htmlFor="k-ba" required>
              <Input id="k-ba" inputMode="numeric" type="password" autoComplete="off" value={bank.account} onChange={(e) => setBank({ ...bank, account: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label={t('cp06.confirmAccount')} htmlFor="k-bc" required error={bank.confirm && bank.confirm !== bank.account ? t('cp06.err.accountMatch') : undefined}>
              <Input id="k-bc" inputMode="numeric" value={bank.confirm} onChange={(e) => setBank({ ...bank, confirm: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <RadioGroup value={bank.type} onValueChange={(v) => setBank({ ...bank, type: v as 'current' | 'savings' })} className="flex gap-4" aria-label={t('cp06.accountType')}>
              {(['current', 'savings'] as const).map((v) => (
                <label key={v} className="flex items-center gap-2">
                  <RadioGroupItem value={v} /> {t(`cp06.accountTypes.${v}`)}
                </label>
              ))}
            </RadioGroup>
          </div>
          <Button variant="outline" className="self-start" disabled={!!busy || !accountOk || !ifscOk || !bank.holder.trim()} onClick={() => run('bank', () => store().verifyBank(c.id, { holder: bank.holder, account: bank.account, ifsc: bank.ifsc, type: bank.type }))}>
            {busy === 'bank' && <Loader2 className="animate-spin" />} {t('cp06.pennyDrop')} <SimulatedTag />
          </Button>
          {k?.bank.state && k.bank.state !== 'notStarted' && (
            <p className={k.bank.state === 'verified' ? 'font-medium text-status-success' : 'font-medium text-status-warning'} data-testid="bank-result">
              {k.bank.state === 'verified' ? t('cp06.bankOk', { bank: k.bank.bankName, name: k.bank.nameReturned, pct: k.bank.matchPct }) : t('cp06.bankFlagged', { pct: k.bank.matchPct })}
            </p>
          )}
        </Section>

        {/* 4. Pickup addresses */}
        <Section title={t('cp06.s4')} state={locations.length ? 'verified' : 'notStarted'}>
          {locations.length > 0 && (
            <ul className="flex flex-col divide-y rounded-lg border">
              {locations.map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-2 p-3">
                  <span>
                    <span className="font-semibold">{l.name}</span> {l.isDefault && <Chip tone="info">{t('cp06.default')}</Chip>}
                    <span className="block text-caption text-muted-foreground">
                      {l.address} · {l.pincode} · {l.window.from}–{l.window.to}, {l.days}
                    </span>
                  </span>
                  <Button variant="ghost" size="icon" aria-label={t('cp06.removeLocation', { name: l.name })} onClick={() => store().removePickupLocation(l.id)}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('cp06.locName')} htmlFor="l-name" required error={tryLoc && locErrors.name ? t('cp04.err.required') : undefined}>
              <Input id="l-name" value={loc.name} onChange={(e) => setLoc({ ...loc, name: e.target.value })} />
            </Field>
            <Field label={t('cp06.pincode')} htmlFor="l-pin" required error={tryLoc && locErrors.pincode ? t('cp05.err.pincode') : undefined} hint={pin ? `${pin.city}, ${pin.state} · ${pin.serviceable ? t('cp05.verdict.serviceable') : t('cp05.verdict.notServiceable')}` : undefined}>
              <Input id="l-pin" inputMode="numeric" maxLength={6} value={loc.pincode} onChange={(e) => setLoc({ ...loc, pincode: e.target.value.replace(/\D/g, ''), pinConfirmed: false })} />
            </Field>
            <Field label={t('cp06.address1')} htmlFor="l-a1" required className="sm:col-span-2" error={tryLoc && locErrors.address ? t('cp04.err.required') : undefined}>
              <Input id="l-a1" value={loc.address} onChange={(e) => setLoc({ ...loc, address: e.target.value })} />
            </Field>
            <Field label={t('cp06.address2')} htmlFor="l-a2" className="sm:col-span-2">
              <Input id="l-a2" value={loc.landmark} onChange={(e) => setLoc({ ...loc, landmark: e.target.value })} />
            </Field>
            {suggested && (
              <div className="flex flex-col gap-2 sm:col-span-2">
                <MapView markers={[{ ...suggested, id: 'pin', tone: 'info', label: loc.name || t('cp06.pin'), emphasis: true }]} ariaLabel={t('cp06.pin')} className="h-56" />
                <label className="flex items-center gap-2 text-body">
                  <Switch checked={loc.pinConfirmed} onCheckedChange={(v) => setLoc({ ...loc, pinConfirmed: v })} aria-label={t('cp06.confirmPin')} />
                  <MapPin className="size-4 text-primary" aria-hidden /> {t('cp06.pinSuggested', { lat: suggested.lat.toFixed(4), lng: suggested.lng.toFixed(4) })} <SimulatedTag />
                </label>
                {tryLoc && locErrors.pin && <p className="text-caption font-medium text-status-danger">{t('cp06.err.pin')}</p>}
              </div>
            )}
            <Field label={t('cp06.locContact')} htmlFor="l-c" required error={tryLoc && locErrors.contact ? t('cp04.err.required') : undefined}>
              <Input id="l-c" value={loc.contact} onChange={(e) => setLoc({ ...loc, contact: e.target.value })} />
            </Field>
            <Field label={t('cp06.locMobile')} htmlFor="l-m" required error={tryLoc && locErrors.mobile ? t('cp04.err.mobile') : undefined}>
              <Input id="l-m" inputMode="tel" value={loc.mobile} onChange={(e) => setLoc({ ...loc, mobile: e.target.value })} />
            </Field>
            <Field label={t('cp06.window')} htmlFor="l-from" required error={tryLoc && locErrors.window ? t('cp06.err.window') : undefined}>
              <div className="flex items-center gap-2">
                {/* 24-hour times (CLAUDE.md rule 8); a native time input follows the computer's 12-hour setting */}
                <NativeSelect id="l-from" value={loc.from} onChange={(e) => setLoc({ ...loc, from: e.target.value })} aria-label={t('cp06.from')}>
                  {HALF_HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </NativeSelect>
                –
                <NativeSelect value={loc.to} onChange={(e) => setLoc({ ...loc, to: e.target.value })} aria-label={t('cp06.to')}>
                  {HALF_HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </Field>
            <Field label={t('cp06.days')} htmlFor="l-days" required>
              <NativeSelect id="l-days" value={loc.days} onChange={(e) => setLoc({ ...loc, days: e.target.value })}>
                {['Mon–Fri', 'Mon–Sat', 'Mon–Sun'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {locations.length > 0 && (
              <label className="flex items-center gap-2">
                <Switch checked={loc.isDefault} onCheckedChange={(v) => setLoc({ ...loc, isDefault: v })} aria-label={t('cp06.makeDefault')} /> {t('cp06.makeDefault')}
              </label>
            )}
          </div>
          <Button variant="outline" className="self-start" onClick={addLocation}>
            <Plus /> {t('cp06.addLocation')}
          </Button>
        </Section>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={!ready || k?.status === 'verified' || k?.status === 'underReview'} onClick={() => (store().submitKyc(c.id, user.id), toast.success(t('cp06.submitted')))}>
          {t('cp06.submit')}
        </Button>
        {!ready && <span className="text-caption text-muted-foreground">{t('cp06.todo')}</span>}
      </div>
    </div>
  )
}

function Fact({ label, value, danger }: { label: string; value?: string; danger?: boolean }) {
  return (
    <div>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className={danger ? 'font-semibold text-status-danger' : 'font-medium'}>{value || '—'}</dd>
    </div>
  )
}
