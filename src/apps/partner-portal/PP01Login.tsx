/**
 * PP-01 Login, PP-02 OTP and PP-03 Forgot password — docs/02-partner-portal.md
 * §6.1. Live partners land on the dashboard, applicants on the onboarding
 * tracker, suspended partners on their case (the portal routes them). Field
 * staff are sent to the Partner App. "Check application status" takes the
 * reference + mobile to PP-05. SIMULATED authentication.
 */
import { ClipboardCheck, Handshake, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { AuthShell } from '@shared/ui/auth/AuthShell'
import { ForgotPassword } from '@shared/ui/auth/ForgotPassword'
import { OtpStep } from '@shared/ui/auth/OtpStep'
import { WebLogin } from '@shared/ui/auth/WebLogin'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'

const CHIPS = [
  { label: 'Vikram · SwiftCity Admin', email: 'vikram@swiftcity.in', mobile: '98111 22334' },
  { label: 'Neha · SwiftCity Operations', email: 'neha@swiftcity.in', mobile: '98111 22335' },
  { label: 'Anil · SwiftCity Finance', email: 'anil@swiftcity.in', mobile: '98111 22336' },
  { label: 'Prakash · Deccan (trial)', email: 'prakash@deccanroadlines.in', mobile: '94480 77302' },
  { label: 'Deepak · NCR CrossDock (hub)', email: 'deepak@ncrcrossdock.in', mobile: '98100 66720' },
]

function StatusDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = useData((d) => d)
  const login = useSession((s) => s.login)
  const [ref, setRef] = useState('APP-2026-0412')
  const [mobile, setMobile] = useState('')
  const [err, setErr] = useState('')
  const [userId, setUserId] = useState<string>()
  const digits = (m: string) => m.replace(/\D/g, '').slice(-10)

  const find = () => {
    const app = Object.values(data.applications).find((a) => a.ref.toUpperCase() === ref.trim().toUpperCase())
    const u = app && Object.values(data.partnerUsers).find((x) => x.partnerId === app.partnerId && digits(x.mobile) === digits(mobile))
    if (!u) return setErr(t('auth.pp.statusNotFound'))
    setUserId(u.id)
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('auth.pp.status')}</DialogTitle>
          <DialogDescription>{t('auth.pp.statusBody')}</DialogDescription>
        </DialogHeader>
        {userId ? (
          <OtpStep
            mobile={mobile}
            onVerified={() => {
              login('partnerPortal', userId)
              useDemoStore.getState().recordLogin('partnerPortal', userId)
              navigate('/partner/onboarding/application')
            }}
            onBack={() => setUserId(undefined)}
          />
        ) : (
          <>
            <Field label={t('auth.pp.ref')} htmlFor="s-ref" required>
              <Input id="s-ref" value={ref} onChange={(e) => setRef(e.target.value)} />
            </Field>
            <Field label={t('auth.mobile')} htmlFor="s-mobile" required hint="94480 77302">
              <Input id="s-mobile" inputMode="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} />
            </Field>
            {err && (
              <p role="alert" className="text-caption text-status-danger">
                {err}
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button disabled={!ref.trim() || digits(mobile).length !== 10} onClick={find}>
                {t('auth.getOtp')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default function PP01Login() {
  const { t } = useTranslation()
  const [status, setStatus] = useState(false)
  const item = 'flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-card hover:bg-accent'
  return (
    <AuthShell
      app="partner-portal"
      title={t('auth.pp.title')}
      subtitle={t('auth.pp.subtitle')}
      aside={
        <>
          <Link to="/partner/apply" className={item}>
            <Handshake className="size-5 text-primary" aria-hidden />
            <span>
              <span className="block font-semibold">{t('auth.pp.become')}</span>
              <span className="block text-caption text-muted-foreground">{t('auth.pp.becomeBody')}</span>
            </span>
          </Link>
          <button type="button" className={item} onClick={() => setStatus(true)}>
            <ClipboardCheck className="size-5 text-primary" aria-hidden />
            <span>
              <span className="block font-semibold">{t('auth.pp.status')}</span>
              <span className="block text-caption text-muted-foreground">{t('auth.pp.statusHint')}</span>
            </span>
          </button>
          <Link to="/launch/partner-portal" className={item}>
            <Users className="size-5 text-primary" aria-hidden />
            <span className="font-semibold">{t('auth.personas')}</span>
          </Link>
        </>
      }
    >
      <WebLogin app="partnerPortal" home="/partner" forgotPath="/partner/forgot-password" chips={CHIPS} defaultMethod="mobile" />
      {status && <StatusDialog onClose={() => setStatus(false)} />}
    </AuthShell>
  )
}

export function PP03ForgotPassword() {
  const { t } = useTranslation()
  return (
    <AuthShell app="partner-portal" title={t('auth.forgotTitle')} subtitle={t('auth.forgotSub')}>
      <ForgotPassword app="partnerPortal" loginPath="/partner/login" />
    </AuthShell>
  )
}
