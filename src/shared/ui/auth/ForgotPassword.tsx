/**
 * Forgot / reset password (CP-03, PP-03). Never says whether an account
 * exists; OTP to the registered mobile (SIMULATED 123456); new password with a
 * strength meter (min 8, a letter and a number).
 */
import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { findLogin, passwordStrength, resetPasswordOk, validEmail } from '@shared/engines/auth'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import type { AppKey } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { OtpStep } from './OtpStep'

export function ForgotPassword({ app, loginPath }: { app: Extract<AppKey, 'customer' | 'partnerPortal'>; loginPath: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = useData((d) => d)
  const [id, setId] = useState('')
  const [step, setStep] = useState<'id' | 'otp' | 'password' | 'done'>('id')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const found = findLogin(data, app, validEmail(id) ? { email: id } : { mobile: id })
  const strength = passwordStrength(pw)

  if (step === 'done')
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-status-success">
          <CheckCircle2 className="size-5" aria-hidden /> {t('auth.resetDone')}
        </p>
        <Button className="self-start" onClick={() => navigate(loginPath)}>
          {t('auth.backToLogin')}
        </Button>
      </div>
    )

  if (step === 'otp')
    return (
      <div className="flex flex-col gap-3">
        <p>{t('auth.ifExists')}</p>
        <OtpStep mobile={found.ok ? found.mobile : undefined} onVerified={() => setStep(found.ok ? 'password' : 'id')} onBack={() => setStep('id')} />
      </div>
    )

  if (step === 'password')
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!resetPasswordOk(pw) || pw !== pw2 || !found.ok) return
          useDemoStore.getState().recordPasswordReset(app, found.userId)
          setStep('done')
        }}
      >
        <Field label={t('auth.newPassword')} htmlFor="r-pw" required hint={t('auth.pwRule')}>
          <Input id="r-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <div className="flex gap-1" aria-label={t('auth.strength', { n: strength })} role="meter" aria-valuenow={strength} aria-valuemin={0} aria-valuemax={4}>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={cn('h-1.5 flex-1 rounded-full', n <= strength ? (strength >= 3 ? 'bg-status-success' : 'bg-status-warning') : 'bg-gray-100')} />
          ))}
        </div>
        <Field label={t('auth.confirmPassword')} htmlFor="r-pw2" required error={pw2 && pw !== pw2 ? t('auth.noMatch') : undefined}>
          <Input id="r-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        <Button type="submit" className="self-start" disabled={!resetPasswordOk(pw) || pw !== pw2}>
          {t('auth.reset')}
        </Button>
      </form>
    )

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (id.trim()) setStep('otp')
      }}
    >
      <Field label={t('auth.emailOrMobile')} htmlFor="r-id" required>
        <Input id="r-id" value={id} onChange={(e) => setId(e.target.value)} />
      </Field>
      <div className="flex gap-3">
        <Button type="submit" disabled={!id.trim()}>
          {t('auth.sendOtp')}
        </Button>
        <Button type="button" variant="link" className="px-0" onClick={() => navigate(loginPath)}>
          {t('auth.backToLogin')}
        </Button>
      </div>
    </form>
  )
}
