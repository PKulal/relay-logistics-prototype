/**
 * PA-01 Language selection and PA-02 Login (mobile + OTP) —
 * docs/03-partner-app.md §6.1. Source §14 (Hindi + English, Hindi voice
 * prompts). Staff log in with the mobile their company registered (PP-29).
 * SIMULATED: SMS OTP is 123456. Persona chips per the spec prototype note.
 */
import { Volume2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { findLogin } from '@shared/engines/auth'
import { useData } from '@shared/hooks/useDemo'
import { sendOtp } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import { useSession } from '@shared/store/session'
import { OtpStep } from '@shared/ui/auth/OtpStep'
import { Button } from '@shared/ui/button'
import { PhoneFrame } from '@shared/ui/PhoneFrame'
import { Switch } from '@shared/ui/switch'

const CHIPS = [
  { label: 'Ravi · Rider', mobile: '98730 44556' },
  { label: 'Basavaraj · Driver', mobile: '94485 21907' },
  { label: 'Pooja · Hub', mobile: '98102 33871' },
  { label: 'Manju · Rider', mobile: '94486 40213' },
]

function Frame({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div data-app="partner-app" className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-gray-100 sm:py-6">
      <Link to="/" className="hidden text-caption font-medium text-primary hover:underline sm:block">
        {t('header.launcher')}
      </Link>
      <PhoneFrame>
        <div className="flex h-full flex-col gap-5 overflow-y-auto p-5 pt-10">
          <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-9 w-auto self-start" />
          {children}
        </div>
      </PhoneFrame>
    </div>
  )
}

export function PA01Language() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const language = useSession((s) => s.language)
  const setLanguage = useSession((s) => s.setLanguage)
  const [voice, setVoice] = useState(true)
  return (
    <Frame>
      <h1 className="font-heading text-[24px] font-bold">{t('auth.pa.chooseLanguage')}</h1>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('auth.pa.chooseLanguage')}>
        {(
          [
            ['hi', 'हिन्दी'],
            ['en', 'English'],
          ] as const
        ).map(([code, label]) => (
          <button key={code} type="button" role="radio" aria-checked={language === code} onClick={() => setLanguage(code)} className={cn('flex h-28 items-center justify-center rounded-2xl border-2 text-[24px] font-bold', language === code ? 'border-primary bg-primary-soft text-primary' : 'bg-card')}>
            {label}
          </button>
        ))}
      </div>
      <p className="text-caption text-muted-foreground">{t('auth.pa.moreLanguages')}</p>
      <label className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border bg-card p-4">
        <span className="flex items-center gap-2 font-bold">
          <Volume2 className="size-5 text-primary" aria-hidden /> {t('pa13.voice')}
        </span>
        <Switch checked={voice} onCheckedChange={setVoice} aria-label={t('pa13.voice')} />
      </label>
      <Button size="lg" className="mt-auto h-14 text-[18px]" onClick={() => navigate(`/app/login${voice ? '' : '?voice=0'}`)}>
        {t('auth.pa.continue')}
      </Button>
    </Frame>
  )
}

export function PA02Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const data = useData((d) => d)
  const login = useSession((s) => s.login)
  const [mobile, setMobile] = useState('')
  const [error, setError] = useState('')
  const [otpFor, setOtpFor] = useState<{ id: string; mobile: string }>()

  const getOtp = async () => {
    const r = findLogin(data, 'partnerApp', { mobile })
    if (!r.ok) return setError(t(`auth.pa.err.${r.reason}`))
    setError('')
    await sendOtp(r.mobile)
    setOtpFor({ id: r.userId, mobile: r.mobile })
  }
  const done = (id: string) => {
    const store = useDemoStore.getState()
    if (params.get('voice') === '0') store.setVoicePrompts(id, false)
    login('partnerApp', id)
    store.recordLogin('partnerApp', id)
    // First login goes through PA-03; later ones straight to Home
    navigate(store.data.fieldStaff[id]?.appActivatedAt ? '/app' : '/app/setup')
  }

  return (
    <Frame>
      <h1 className="font-heading text-[24px] font-bold">{t('auth.pa.login')}</h1>
      {otpFor ? (
        <OtpStep big mobile={otpFor.mobile} onVerified={() => done(otpFor.id)} onBack={() => setOtpFor(undefined)} />
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void getOtp()
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="font-bold">{t('auth.mobile')}</span>
            <div className="flex">
              <span className="flex items-center rounded-l-xl border border-r-0 bg-muted px-3 text-[18px]">+91</span>
              <input inputMode="numeric" autoComplete="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} className="h-14 min-w-0 flex-1 rounded-r-xl border px-3 text-[20px] tracking-wide outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={t('auth.mobile')} />
            </div>
          </label>
          {error && (
            <p role="alert" className="font-medium text-status-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="h-14 text-[18px]" disabled={mobile.replace(/\D/g, '').length < 10}>
            {t('auth.getOtp')}
          </Button>
          <div className="flex flex-col gap-2 border-t pt-4">
            <span className="text-caption text-muted-foreground">{t('auth.demoUsers')}</span>
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button key={c.mobile} type="button" onClick={() => (setMobile(c.mobile), setError(''))} className="min-h-10 rounded-full border bg-background px-3 text-caption font-medium">
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </form>
      )}
    </Frame>
  )
}
