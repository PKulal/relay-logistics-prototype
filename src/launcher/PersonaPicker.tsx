/**
 * Launcher step 2: pick who to be, then a mock login with OTP 123456.
 * (The specced login screens CP-01/02, PP-01/02, PA-02 and ERP-01 come later;
 * this is the demo's quick way in.)
 */
import { ArrowLeft, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { APPS, type AppId } from '@shared/apps'
import { useData } from '@shared/hooks/useDemo'
import { personasFor, type Persona } from '@shared/personas'
import { DEMO_LOGIN_OTP, sendOtp, verifyLoginOtp } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@shared/ui/input-otp'
import { Label } from '@shared/ui/label'
import { SimulatedTag } from '@shared/ui/SimulatedTag'

export default function PersonaPicker() {
  const { t } = useTranslation()
  const { appId } = useParams<{ appId: AppId }>()
  const app = APPS.find((a) => a.id === appId)
  const data = useData((d) => d)
  const personas = useMemo(() => (app ? personasFor(app.key, data) : []), [app, data])
  const [chosen, setChosen] = useState<Persona>()
  const [showAll, setShowAll] = useState(false)

  if (!app) return <Navigate to="/" replace />

  const featured = personas.filter((p) => p.featured)
  const others = personas.filter((p) => !p.featured)

  return (
    <div data-app={app.id} className="min-h-dvh bg-gray-50">
      <header className="h-14 border-b bg-background">
        <div className="mx-auto flex h-full max-w-4xl items-center gap-3 px-6">
          <Link to="/" className="inline-flex items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            {t('common.backToLauncher')}
          </Link>
          <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="ml-auto h-8 w-auto" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-caption font-semibold tracking-wide text-primary uppercase">{t(`${app.i18nKey}.name`)}</p>
        <h1 className="mt-1 text-page-title">{t('personas.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('personas.subtitle')}</p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {featured.map((p) => (
            <PersonaCard key={p.id} persona={p} onPick={setChosen} />
          ))}
        </ul>

        {others.length > 0 && (
          <div className="mt-8">
            <button type="button" onClick={() => setShowAll((s) => !s)} className="inline-flex items-center gap-1 font-medium text-primary" aria-expanded={showAll}>
              {showAll ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              {t('personas.more', { count: others.length })}
            </button>
            {showAll && (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {others.map((p) => (
                  <PersonaCard key={p.id} persona={p} onPick={setChosen} compact />
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      {chosen && <LoginDialog persona={chosen} appPath={app.path} onClose={() => setChosen(undefined)} />}
    </div>
  )
}

function PersonaCard({ persona, onPick, compact }: { persona: Persona; onPick: (p: Persona) => void; compact?: boolean }) {
  const { t } = useTranslation()
  return (
    <li>
      <button
        type="button"
        onClick={() => onPick(persona)}
        className="flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left shadow-card transition-shadow hover:border-primary hover:shadow-md"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-semibold text-primary">
          {persona.name
            .split(' ')
            .map((w) => w[0])
            .slice(0, 2)
            .join('')}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{persona.name}</span>
          <span className="block truncate text-caption text-muted-foreground">
            {t(persona.roleKey)} · {persona.org}
          </span>
          {!compact && <span className="tabular block truncate text-caption text-muted-foreground">{persona.login}</span>}
        </span>
      </button>
    </li>
  )
}

function LoginDialog({ persona, appPath, onClose }: { persona: Persona; appPath: string; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const login = useSession((s) => s.login)
  const [step, setStep] = useState<'send' | 'verify'>('send')
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState(false)

  const send = async () => {
    setBusy(true)
    await sendOtp(persona.login)
    setBusy(false)
    setStep('verify')
  }

  const verify = (value = code) => {
    if (!verifyLoginOtp(value)) {
      setError(true)
      return
    }
    login(persona.app, persona.id)
    // CP-28: an invited user becomes active on first login
    if (persona.app === 'customer') useDemoStore.getState().recordCustomerLogin(persona.id)
    toast.success(t('login.welcome', { name: persona.name }))
    navigate(appPath)
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('login.title', { name: persona.name })}</DialogTitle>
          <DialogDescription>
            {t(persona.roleKey)} · {persona.org}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="login-id">{persona.login.includes('@') ? t('login.email') : t('login.mobile')}</Label>
          <input id="login-id" readOnly value={persona.login} className="tabular h-9 rounded-md border border-input bg-gray-50 px-3 text-body" />
        </div>

        {step === 'verify' && (
          <div className="flex flex-col gap-2">
            <Label>{t('login.otp')}</Label>
            <InputOTP
              maxLength={6}
              value={code}
              autoFocus
              onChange={(v) => {
                setCode(v)
                setError(false)
                if (v.length === 6) verify(v)
              }}
              aria-invalid={error}
            >
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
            {error ? (
              <p role="alert" className="text-caption font-medium text-status-danger">
                {t('login.wrongOtp')}
              </p>
            ) : (
              <p className="text-caption text-muted-foreground">
                {t('login.otpHint', { otp: DEMO_LOGIN_OTP })}
                <SimulatedTag className="ml-1" />
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {step === 'send' ? (
            <Button onClick={send} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {t('login.sendOtp')}
            </Button>
          ) : (
            <Button onClick={() => verify()} disabled={code.length !== 6}>
              {t('login.verify')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
