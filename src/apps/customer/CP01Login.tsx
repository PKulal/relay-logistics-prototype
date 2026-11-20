/**
 * CP-01 Login, CP-02 OTP and CP-03 Forgot password — docs/01-customer-portal.md
 * §6.1. Email + password or mobile OTP; persona chips pre-fill the seeded
 * users (spec prototype note). SIMULATED authentication.
 */
import { MapPin, UserPlus, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AuthShell } from '@shared/ui/auth/AuthShell'
import { ForgotPassword } from '@shared/ui/auth/ForgotPassword'
import { WebLogin } from '@shared/ui/auth/WebLogin'

const CHIPS = [
  { label: 'Priya · Admin', email: 'priya@sharmaelectricals.in', mobile: '98100 23456' },
  { label: 'Ramesh · Dispatch', email: 'ramesh@sharmaelectricals.in', mobile: '98730 11223' },
  { label: 'Kavita · Finance', email: 'kavita@sharmaelectricals.in', mobile: '99100 77881' },
  { label: 'Suresh · Kaveri Handicrafts', email: 'suresh@kaverihandicrafts.in', mobile: '98450 66120' },
]

function Aside() {
  const { t } = useTranslation()
  const item = 'flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card hover:bg-accent'
  return (
    <>
      <Link to="/signup" className={item}>
        <UserPlus className="size-5 text-primary" aria-hidden />
        <span>
          <span className="block font-semibold">{t('auth.cp.signup')}</span>
          <span className="block text-caption text-muted-foreground">{t('auth.cp.signupBody')}</span>
        </span>
      </Link>
      <Link to="/track" className={item}>
        <MapPin className="size-5 text-primary" aria-hidden />
        <span>
          <span className="block font-semibold">{t('auth.cp.track')}</span>
          <span className="block text-caption text-muted-foreground">{t('auth.cp.trackBody')}</span>
        </span>
      </Link>
      <Link to="/launch/customer" className={item}>
        <Users className="size-5 text-primary" aria-hidden />
        <span className="font-semibold">{t('auth.personas')}</span>
      </Link>
    </>
  )
}

export default function CP01Login() {
  const { t } = useTranslation()
  return (
    <AuthShell app="customer" title={t('auth.cp.title')} subtitle={t('auth.cp.subtitle')} aside={<Aside />}>
      <WebLogin app="customer" home="/customer" forgotPath="/customer/forgot-password" chips={CHIPS} />
    </AuthShell>
  )
}

export function CP03ForgotPassword() {
  const { t } = useTranslation()
  return (
    <AuthShell app="customer" title={t('auth.forgotTitle')} subtitle={t('auth.forgotSub')}>
      <ForgotPassword app="customer" loginPath="/customer/login" />
    </AuthShell>
  )
}
