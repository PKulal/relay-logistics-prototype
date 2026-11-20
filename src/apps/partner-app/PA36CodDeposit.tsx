/**
 * PA-36 COD in hand and deposit — docs/03-partner-app.md. Source §9 (partner
 * deposits COD within 24 hours). The rider hands all cash to the partner office
 * cashier (OTP) or the bank (slip photo). SIMULATED: cashier OTP 1234, camera.
 */
import { ArrowLeft, Banknote } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { cashInHand } from '@shared/engines/receivables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatINR, formatTime } from '@shared/lib/format'
import { minutesBetween } from '@shared/lib/time'
import { verifyCashierOtp } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card, Choice } from './FieldUi'
import { useFieldSession } from './useFieldSession'

export default function PA36CodDeposit() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const held = cashInHand(data, staff.id).sort((a, b) => a.collectedAt!.localeCompare(b.collectedAt!))
  const total = held.reduce((s, r) => s + r.amount, 0)
  const [to, setTo] = useState<'office' | 'bank'>('office')
  const [amount, setAmount] = useState('')
  const [otp, setOtp] = useState('')
  const [slip, setSlip] = useState('')
  const amountOk = Number(amount) === total
  const proofOk = to === 'office' ? verifyCashierOtp(otp) : !!slip
  const ready = held.length > 0 && amountOk && proofOk

  const submit = () => {
    useDemoStore.getState().depositCod(staff.id, { to, amount: total, ref: to === 'office' ? `Cashier OTP ✓ ${formatTime(now)}` : slip })
    toast.success(t('pa36.done', { amount: formatINR(total) }))
    navigate('/app')
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <button type="button" onClick={() => navigate('/app')} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <h1 className="font-heading text-[22px] font-bold">{t('pa36.title')}</h1>

      {held.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('pa36.none')}</p>
      ) : (
        <>
          <Card title={t('pa36.inHand', { count: held.length })}>
            <ul className="flex flex-col divide-y" data-testid="cash-in-hand">
              {held.map((r) => {
                const hours = Math.floor(minutesBetween(r.collectedAt!, now) / 60)
                return (
                  <li key={r.id} className="flex items-center justify-between py-2" aria-label={r.shipmentId}>
                    <span>
                      <span className="tabular block font-medium">{r.shipmentId}</span>
                      <span className={cn('text-[13px] text-muted-foreground', hours > data.settings.codDepositHours && 'font-semibold text-status-danger')}>{t('pa36.since', { time: formatTime(r.collectedAt!), hours })}</span>
                    </span>
                    <span className="tabular font-semibold">{formatINR(r.amount)}</span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 flex items-center justify-between border-t pt-2 font-bold">
              <span className="flex items-center gap-2">
                <Banknote className="size-5 text-status-warning" aria-hidden /> {t('pa36.total')}
              </span>
              <span className="tabular text-[20px]" data-testid="cash-total">
                {formatINR(total)}
              </span>
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground">{t('pa36.rule', { hours: data.settings.codDepositHours })}</p>
          </Card>

          <Card title={t('pa36.to')}>
            <div role="radiogroup" aria-label={t('pa36.to')}>
              <Choice checked={to === 'office'} onClick={() => setTo('office')} label={t('pa36.office')} />
              <Choice checked={to === 'bank'} onClick={() => setTo('bank')} label={t('pa36.bank')} />
            </div>
          </Card>

          <Card title={t('pa36.amount')}>
            <input type="number" inputMode="numeric" aria-label={t('pa36.amount')} value={amount} onChange={(e) => setAmount(e.target.value)} className="tabular h-12 w-full rounded-lg border border-input px-3 text-[18px]" />
            {amount !== '' && !amountOk && <p className="mt-1 text-[13px] font-semibold text-status-danger">{t('pa36.mustEqual', { amount: formatINR(total) })}</p>}
          </Card>

          <Card title={to === 'office' ? t('pa36.otp') : t('pa36.slip')}>
            {to === 'office' ? (
              <>
                <input inputMode="numeric" maxLength={4} aria-label={t('pa36.otp')} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="tabular h-12 w-32 rounded-lg border border-input px-3 text-[18px] tracking-[0.3em]" />
                <p className="mt-1 flex items-center gap-1 text-[13px] text-muted-foreground">
                  {t('pa36.otpHint')} <SimulatedTag />
                </p>
              </>
            ) : (
              <PhotoCapture label={t('pa36.slip')} caption={t('pa36.slipCaption', { amount: formatINR(total) })} value={slip} onChange={setSlip} idBase={`${staff.id}-slip`} required />
            )}
          </Card>
        </>
      )}

      {held.length > 0 && (
        <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
          <button type="button" disabled={!ready} onClick={submit} className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
            {t('pa36.submit')}
          </button>
        </div>
      )}
    </div>
  )
}
