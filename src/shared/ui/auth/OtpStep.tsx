/**
 * OTP verification (CP-02, PP-02; also PA-02 and ERP-01's second factor).
 * 6 boxes, paste supported; resend after 30 s, at most 3 resends; 3 wrong
 * attempts end the try. SIMULATED: the OTP is always 123456 (shown as a hint).
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { maskForOtp } from '@shared/engines/auth'
import { DEMO_LOGIN_OTP, sendOtp, verifyLoginOtp } from '@shared/sim/otp'
import { Button } from '@shared/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@shared/ui/input-otp'
import { SimulatedTag } from '@shared/ui/SimulatedTag'

const MAX_ATTEMPTS = 3
const MAX_RESENDS = 3
const RESEND_SECONDS = 30

export function OtpStep({ mobile, onVerified, onBack, big }: { mobile?: string; onVerified: () => void; onBack: () => void; big?: boolean }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(0)
  const [resends, setResends] = useState(0)
  const [wait, setWait] = useState(RESEND_SECONDS)
  const locked = wrong >= MAX_ATTEMPTS

  useEffect(() => {
    if (wait <= 0) return
    const id = setTimeout(() => setWait((w) => w - 1), 1000)
    return () => clearTimeout(id)
  }, [wait])

  const verify = (v = code) => {
    if (locked) return
    if (verifyLoginOtp(v)) return onVerified()
    setWrong((w) => w + 1)
    setCode('')
  }

  return (
    <div className="flex flex-col gap-3">
      {mobile && <p className="text-muted-foreground">{t('auth.otpSent', { mobile: maskForOtp(mobile) })}</p>}
      <InputOTP
        maxLength={6}
        value={code}
        autoFocus
        disabled={locked}
        aria-label={t('auth.otp')}
        onChange={(v) => {
          setCode(v)
          if (v.length === 6) verify(v)
        }}
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, i) => (
            <InputOTPSlot key={i} index={i} className={big ? 'size-12 text-[20px]' : undefined} />
          ))}
        </InputOTPGroup>
      </InputOTP>
      {wrong > 0 ? (
        <p role="alert" className="text-caption font-medium text-status-danger">
          {locked ? t('auth.otpLocked') : t('auth.otpWrong', { count: MAX_ATTEMPTS - wrong })}
        </p>
      ) : (
        <p className="flex items-center gap-1 text-caption text-muted-foreground">
          {t('auth.otpHint', { otp: DEMO_LOGIN_OTP })} <SimulatedTag />
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button className={big ? 'h-12 flex-1 text-[16px]' : undefined} disabled={code.length !== 6 || locked} onClick={() => verify()}>
          {t('auth.verify')}
        </Button>
        <Button
          variant="ghost"
          disabled={wait > 0 || resends >= MAX_RESENDS}
          onClick={() => {
            void sendOtp(mobile ?? '')
            setResends((r) => r + 1)
            setWait(RESEND_SECONDS)
            setWrong(0)
          }}
        >
          {wait > 0 ? t('auth.resendIn', { s: wait }) : resends >= MAX_RESENDS ? t('auth.noMoreResends') : t('auth.resend')}
        </Button>
        <Button variant="link" className="px-0" onClick={onBack}>
          {t('auth.changeNumber')}
        </Button>
      </div>
    </div>
  )
}
