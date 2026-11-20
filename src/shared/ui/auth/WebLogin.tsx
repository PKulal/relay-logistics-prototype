/**
 * Email + password or mobile OTP login for the Customer Portal (CP-01/02) and
 * the Partner Portal (PP-01/02). SIMULATED: any password of 8+ characters
 * works for a seeded user; OTP 123456. Persona chips pre-fill credentials
 * (spec prototype notes). 5 wrong tries lock the form for 15 minutes (assumed).
 */
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { findLogin, validPassword, type LoginError } from '@shared/engines/auth'
import { useData } from '@shared/hooks/useDemo'
import { sendOtp } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import type { AppKey } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { LanguageSelect } from './AuthShell'
import { OtpStep } from './OtpStep'

export interface PersonaChip {
  label: string
  email: string
  mobile: string
}

const MAX_FAILS = 5

export function WebLogin({ app, home, forgotPath, chips, defaultMethod = 'email', errorKeys }: { app: Extract<AppKey, 'customer' | 'partnerPortal'>; home: string; forgotPath: string; chips: PersonaChip[]; defaultMethod?: 'email' | 'mobile'; errorKeys?: Partial<Record<LoginError, string>> }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = useData((d) => d)
  const login = useSession((s) => s.login)
  const [method, setMethod] = useState<'email' | 'mobile'>(defaultMethod)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [mobile, setMobile] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [fails, setFails] = useState(0)
  const [otpFor, setOtpFor] = useState<{ userId: string; mobile: string }>()
  const [busy, setBusy] = useState(false)
  const locked = fails >= MAX_FAILS

  const fail = (reason: LoginError | 'password') => {
    setFails((f) => f + 1)
    setError(t(errorKeys?.[reason as LoginError] ?? `auth.err.${reason}`))
  }
  const finish = (userId: string, name: string) => {
    login(app, userId, remember)
    useDemoStore.getState().recordLogin(app, userId)
    toast.success(t('login.welcome', { name }))
    navigate(home)
  }

  const submit = async () => {
    if (locked) return
    setError('')
    if (method === 'email') {
      const r = findLogin(data, app, { email })
      if (!r.ok) return fail(r.reason)
      if (!validPassword(password)) return fail('password')
      return finish(r.userId, r.name)
    }
    const r = findLogin(data, app, { mobile })
    if (!r.ok) return fail(r.reason)
    setBusy(true)
    await sendOtp(r.mobile)
    setBusy(false)
    setOtpFor({ userId: r.userId, mobile: r.mobile })
  }

  if (otpFor) {
    const name = data.customerUsers[otpFor.userId]?.name ?? data.partnerUsers[otpFor.userId]?.name ?? ''
    return (
      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-section font-semibold">{t('auth.otpTitle')}</h2>
        <OtpStep mobile={otpFor.mobile} onVerified={() => finish(otpFor.userId, name)} onBack={() => setOtpFor(undefined)} />
      </div>
    )
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <div role="tablist" aria-label={t('auth.method')} className="flex w-fit rounded-lg border p-0.5">
        {(['email', 'mobile'] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={method === m} onClick={() => (setMethod(m), setError(''))} className={cn('rounded-md px-3 py-1 text-caption font-medium', method === m && 'bg-primary text-primary-foreground')}>
            {t(`auth.m.${m}`)}
          </button>
        ))}
      </div>
      {method === 'email' ? (
        <>
          <Field label={t('auth.email')} htmlFor="l-email" required>
            <Input id="l-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label={t('auth.password')} htmlFor="l-pass" required hint={t('auth.anyPassword')}>
            <div className="relative">
              <Input id="l-pass" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
              <button type="button" aria-label={t(show ? 'auth.hide' : 'auth.show')} onClick={() => setShow(!show)} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
        </>
      ) : (
        <Field label={t('auth.mobile')} htmlFor="l-mobile" required>
          <div className="flex">
            <span className="flex items-center rounded-l-md border border-r-0 bg-muted px-2 text-caption">+91</span>
            <Input id="l-mobile" inputMode="tel" autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} className="rounded-l-none" />
          </div>
        </Field>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <LanguageSelect className="w-44" />
        <label className="flex items-center gap-2 text-caption">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} /> {t('auth.remember')}
        </label>
      </div>
      {error && (
        <p role="alert" className="text-caption font-medium text-status-danger">
          {locked ? t('auth.locked') : error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={locked || busy}>
          {busy && <Loader2 className="animate-spin" />} {method === 'email' ? t('auth.login') : t('auth.getOtp')}
        </Button>
        <Button type="button" variant="link" className="px-0" onClick={() => navigate(forgotPath)}>
          {t('auth.forgot')}
        </Button>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <span className="text-caption text-muted-foreground">{t('auth.demoUsers')}</span>
          <div className="flex flex-wrap gap-2">
            {chips.map((c) => (
              <button
                key={c.email}
                type="button"
                onClick={() => {
                  setEmail(c.email)
                  setMobile(c.mobile)
                  setPassword('demo-password')
                  setError('')
                }}
                className="rounded-full border bg-background px-3 py-1 text-caption font-medium hover:bg-accent"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  )
}
