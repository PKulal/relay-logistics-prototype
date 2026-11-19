/**
 * CP-04 Sign up (lead capture) — docs/01-customer-portal.md §6.1.
 * A new business creates its account (source §6 Phase 1 Step 1): the lead is
 * created in Logisco's CRM with its source, after a duplicate check by GSTIN.
 * SIMULATED: mobile OTP (123456).
 */
import { CheckCircle2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { BUSINESS_TYPES, gstinCheck, gstinTaken, INDUSTRIES, networkCities } from '@shared/engines/onboarding'
import { useData } from '@shared/hooks/useDemo'
import { DEMO_LOGIN_OTP, sendOtp, verifyLoginOtp } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import type { CustomerType, LeadSource } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { LanguageToggle } from '@shared/ui/LanguageToggle'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { SimulatedTag } from '@shared/ui/SimulatedTag'

const SOURCES: LeadSource[] = ['website', 'salesVisit', 'referral', 'ondc', 'tender', 'partnerReferral']

export default function CP04SignUp() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = useData((d) => d)
  const language = useSession((s) => s.language)
  const [f, setF] = useState({ legalName: '', gstin: '', businessType: '' as CustomerType | '', industry: '', city: '', name: '', designation: '', email: '', mobile: '', source: '' as LeadSource | '', referral: '', privacy: false, gstConsent: false })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const [otpState, setOtpState] = useState<'idle' | 'sending' | 'sent' | 'verified'>('idle')
  const [otp, setOtp] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)

  const g = gstinCheck(f.gstin)
  const taken = g.ok && gstinTaken(data, f.gstin)
  const mobileOk = /^\d{10}$/.test(f.mobile.replace(/\s/g, ''))
  const emailTaken = Object.values(data.customerUsers).some((u) => u.email.toLowerCase() === f.email.trim().toLowerCase())
  const errors: Partial<Record<string, string>> = {
    legalName: !f.legalName.trim() ? t('cp04.err.required') : f.legalName.length > 120 ? t('cp04.err.tooLong') : undefined,
    gstin: !f.gstin.trim() ? t('cp04.err.required') : !g.ok ? t('cp04.err.gstin') : taken ? t('cp04.err.gstinTaken') : undefined,
    businessType: !f.businessType ? t('cp04.err.required') : undefined,
    industry: !f.industry ? t('cp04.err.required') : undefined,
    city: !f.city.trim() ? t('cp04.err.required') : undefined,
    name: !f.name.trim() ? t('cp04.err.required') : undefined,
    email: !/^\S+@\S+\.\S+$/.test(f.email.trim()) ? t('cp04.err.email') : emailTaken ? t('cp04.err.emailTaken') : undefined,
    mobile: !mobileOk ? t('cp04.err.mobile') : otpState !== 'verified' ? t('cp04.err.verifyMobile') : undefined,
    source: !f.source ? t('cp04.err.required') : undefined,
    privacy: !f.privacy ? t('cp04.err.privacy') : undefined,
  }
  const err = (k: string) => (tried ? errors[k] : undefined)
  const valid = Object.values(errors).every((e) => !e)

  const sendCode = async () => {
    setOtpState('sending')
    await sendOtp(f.mobile)
    setOtpState('sent')
  }

  const create = async () => {
    setTried(true)
    if (!valid) {
      toast.error(t('cp04.fix'))
      return
    }
    setBusy(true)
    await new Promise((r) => setTimeout(r, 500))
    const { userId } = useDemoStore.getState().signUp({
      legalName: f.legalName,
      gstin: f.gstin,
      businessType: f.businessType as CustomerType,
      industry: f.industry,
      city: f.city,
      contact: { name: f.name, designation: f.designation, email: f.email, mobile: f.mobile },
      source: f.source as LeadSource,
      referralCode: f.referral,
      privacyConsent: f.privacy,
      gstConsent: f.gstConsent,
      language,
    })
    useSession.getState().login('customer', userId)
    toast.success(t('cp04.created'))
    navigate('/customer/onboarding/qualification')
  }

  return (
    <div data-app="customer" className="min-h-dvh bg-gray-50">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3 sm:px-8">
        <Link to="/">
          <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-9" />
        </Link>
        <LanguageToggle />
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        <div>
          <h1 className="text-page-title">{t('cp04.title')}</h1>
          <p className="text-muted-foreground">{t('cp04.subtitle')}</p>
        </div>

        <section className="grid gap-4 rounded-xl border bg-card p-6 shadow-card sm:grid-cols-2" aria-labelledby="biz-h">
          <h2 id="biz-h" className="text-card-title sm:col-span-2">
            {t('cp04.business')}
          </h2>
          <Field label={t('cp04.legalName')} htmlFor="su-legal" required error={err('legalName')} className="sm:col-span-2">
            <Input id="su-legal" maxLength={120} value={f.legalName} onChange={(e) => set('legalName', e.target.value)} />
          </Field>
          <Field label={t('cp04.gstin')} htmlFor="su-gstin" required error={err('gstin') ?? (taken ? errors.gstin : undefined)} hint={g.ok ? t('cp04.gstinState', { state: g.state }) : t('cp04.gstinHint')}>
            <Input id="su-gstin" maxLength={15} value={f.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase().trim())} className="tabular" />
          </Field>
          <Field label={t('cp04.state')} htmlFor="su-state">
            <Input id="su-state" value={g.state ?? ''} readOnly className="bg-gray-50" />
          </Field>
          <Field label={t('cp04.businessType')} htmlFor="su-type" required error={err('businessType')}>
            <NativeSelect id="su-type" value={f.businessType} onChange={(e) => set('businessType', e.target.value as CustomerType)}>
              <option value="">{t('cp04.choose')}</option>
              {BUSINESS_TYPES.map((b) => (
                <option key={b} value={b}>
                  {t(`customerType.${b}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('cp04.industry')} htmlFor="su-ind" required error={err('industry')}>
            <NativeSelect id="su-ind" value={f.industry} onChange={(e) => set('industry', e.target.value)}>
              <option value="">{t('cp04.choose')}</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {t(`industry.${i}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('cp04.city')} htmlFor="su-city" required error={err('city')}>
            <Input id="su-city" list="su-cities" value={f.city} onChange={(e) => set('city', e.target.value)} />
            <datalist id="su-cities">
              {networkCities(data).map((c) => (
                <option key={c.city} value={c.city} />
              ))}
            </datalist>
          </Field>
        </section>

        <section className="grid gap-4 rounded-xl border bg-card p-6 shadow-card sm:grid-cols-2" aria-labelledby="contact-h">
          <h2 id="contact-h" className="text-card-title sm:col-span-2">
            {t('cp04.contact')}
          </h2>
          <Field label={t('cp04.name')} htmlFor="su-name" required error={err('name')}>
            <Input id="su-name" value={f.name} onChange={(e) => set('name', e.target.value)} />
          </Field>
          <Field label={t('cp04.designation')} htmlFor="su-desig">
            <Input id="su-desig" value={f.designation} onChange={(e) => set('designation', e.target.value)} />
          </Field>
          <Field label={t('cp04.email')} htmlFor="su-email" required error={err('email')}>
            <Input id="su-email" type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label={t('cp04.mobile')} htmlFor="su-mobile" required error={err('mobile')}>
            <div className="flex gap-2">
              <Input id="su-mobile" inputMode="tel" value={f.mobile} onChange={(e) => (set('mobile', e.target.value), setOtpState('idle'), setOtp(''))} disabled={otpState === 'verified'} />
              {otpState === 'verified' ? (
                <span className="inline-flex items-center gap-1 text-caption font-semibold text-status-success">
                  <CheckCircle2 className="size-4" aria-hidden /> {t('cp04.verified')}
                </span>
              ) : (
                <Button type="button" variant="outline" disabled={!mobileOk || otpState === 'sending'} onClick={sendCode}>
                  {otpState === 'sending' ? <Loader2 className="animate-spin" /> : null} {t('cp04.sendOtp')}
                </Button>
              )}
            </div>
          </Field>
          {otpState === 'sent' && (
            <Field label={t('cp04.otp')} htmlFor="su-otp" hint={<>{t('login.otpHint', { otp: DEMO_LOGIN_OTP })} <SimulatedTag /></>}>
              <div className="flex gap-2">
                <Input id="su-otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="tabular" />
                <Button type="button" disabled={otp.length !== 6} onClick={() => (verifyLoginOtp(otp) ? setOtpState('verified') : toast.error(t('login.wrongOtp')))}>
                  {t('cp04.verify')}
                </Button>
              </div>
            </Field>
          )}
        </section>

        <section className="grid gap-4 rounded-xl border bg-card p-6 shadow-card sm:grid-cols-2" aria-labelledby="src-h">
          <h2 id="src-h" className="text-card-title sm:col-span-2">
            {t('cp04.sourceConsent')}
          </h2>
          <Field label={t('cp04.source')} htmlFor="su-src" required error={err('source')}>
            <NativeSelect id="su-src" value={f.source} onChange={(e) => set('source', e.target.value as LeadSource)}>
              <option value="">{t('cp04.choose')}</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {t(`leadSource.${s}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {(f.source === 'referral' || f.source === 'partnerReferral') && (
            <Field label={t('cp04.referral')} htmlFor="su-ref">
              <Input id="su-ref" value={f.referral} onChange={(e) => set('referral', e.target.value)} />
            </Field>
          )}
          <label className="flex items-start gap-2 sm:col-span-2">
            <Checkbox checked={f.privacy} onCheckedChange={(v) => set('privacy', v === true)} className="mt-0.5" aria-invalid={!!err('privacy')} />
            <span>{t('cp04.privacy')}</span>
          </label>
          {err('privacy') && <p className="text-caption font-medium text-status-danger sm:col-span-2">{err('privacy')}</p>}
          <label className="flex items-start gap-2 sm:col-span-2">
            <Checkbox checked={f.gstConsent} onCheckedChange={(v) => set('gstConsent', v === true)} className="mt-0.5" />
            <span>{t('cp04.gstConsent')}</span>
          </label>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={create} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />} {t('cp04.create')}
          </Button>
          <Link to="/launch/customer" className="text-caption font-medium text-primary hover:underline">
            {t('cp04.haveAccount')}
          </Link>
        </div>
      </main>
    </div>
  )
}
