/**
 * Bank account change (CP-33, PP-33): OTP to the user's mobile, then a new
 * SIMULATED penny-drop; the account changes only when the bank's name matches.
 */
import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DEMO_LOGIN_OTP, sendOtp, verifyLoginOtp } from '@shared/sim/otp'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { SimulatedTag } from '@shared/ui/SimulatedTag'

export type BankInput = { holder: string; account: string; ifsc: string }
export type BankResult = { ok: boolean; matchPct: number; nameReturned: string }

export function BankChangeDialog({ holder, mobile, onSubmit, onClose }: { holder: string; mobile: string; onSubmit: (b: BankInput) => BankResult; onClose: () => void }) {
  const { t } = useTranslation()
  const [b, setB] = useState<BankInput>({ holder, account: '', ifsc: '' })
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [otp, setOtp] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const formOk = b.holder.trim() && b.account.replace(/\D/g, '').length >= 9 && /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(b.ifsc.trim())

  const send = async () => {
    setBusy(true)
    await sendOtp(mobile)
    setBusy(false)
    setStep('otp')
  }
  const verify = () => {
    if (!verifyLoginOtp(otp)) return setErr(t('cp33.otpWrong'))
    const r = onSubmit(b)
    if (!r.ok) return setErr(r.nameReturned ? t('cp33.pennyFail', { name: r.nameReturned, pct: r.matchPct }) : t('cp33.bankInvalid'))
    toast.success(t('cp33.bankChanged', { name: r.nameReturned, pct: r.matchPct }))
    onClose()
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('cp33.changeBank')} <SimulatedTag />
          </DialogTitle>
          <DialogDescription>{step === 'form' ? t('cp33.bankNote') : t('cp33.otpSent', { mobile, otp: DEMO_LOGIN_OTP })}</DialogDescription>
        </DialogHeader>
        {step === 'form' ? (
          <div className="grid gap-3">
            <Field label={t('cp33.f.holder')} htmlFor="bk-holder" required>
              <Input id="bk-holder" value={b.holder} onChange={(e) => setB({ ...b, holder: e.target.value })} />
            </Field>
            <Field label={t('cp33.f.account')} htmlFor="bk-acc" required>
              <Input id="bk-acc" inputMode="numeric" value={b.account} onChange={(e) => setB({ ...b, account: e.target.value.replace(/\D/g, '') })} />
            </Field>
            <Field label="IFSC" htmlFor="bk-ifsc" required>
              <Input id="bk-ifsc" value={b.ifsc} onChange={(e) => setB({ ...b, ifsc: e.target.value.toUpperCase() })} />
            </Field>
          </div>
        ) : (
          <Field label={t('cp33.f.otp')} htmlFor="bk-otp" required>
            <Input id="bk-otp" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
          </Field>
        )}
        {err && (
          <p role="alert" className="text-caption text-status-danger">
            {err}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          {step === 'form' ? (
            <Button disabled={!formOk || busy} onClick={() => void send()}>
              {busy && <Loader2 className="animate-spin" />} {t('cp33.sendOtp')}
            </Button>
          ) : (
            <Button disabled={otp.length !== 6} onClick={verify}>
              {t('cp33.verifyChange')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
