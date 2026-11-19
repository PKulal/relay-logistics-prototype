/**
 * PA-34 COD collection — docs/03-partner-app.md. Source §5.1 (delivery: COD
 * collection), §9. Shown inside PA-33 before "Complete delivery". Partial COD
 * isn't allowed: the rider uses "Cannot deliver" → "COD amount not ready".
 * SIMULATED: the UPI QR and the payment check.
 */
import { Banknote, CheckCircle2, QrCode as QrIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { formatINR } from '@shared/lib/format'
import { simulateUpiRef } from '@shared/sim/payment'
import type { CodCollection } from '@shared/store/moneyActions'
import { QrCode } from '@shared/ui/QrCode'
import { SimulatedTag } from '@shared/ui/SimulatedTag'

interface Props {
  lr: string
  due: number
  at: string
  value?: CodCollection
  onChange: (v: CodCollection | undefined) => void
}

export function PA34CodCollect({ lr, due, at, value, onChange }: Props) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'cash' | 'upi'>('cash')
  const [received, setReceived] = useState('')
  const [upiRef, setUpiRef] = useState('')
  const amount = Number(received)
  const mismatch = received !== '' && amount !== due
  const canConfirm = amount === due && (mode === 'cash' || !!upiRef)

  if (value)
    return (
      <section className="flex items-center gap-3 rounded-2xl border-2 border-status-success bg-status-success-bg p-4" data-testid="cod-collected">
        <CheckCircle2 className="size-8 shrink-0 text-status-success" aria-hidden />
        <div className="flex-1">
          <p className="tabular font-bold">{t('pa34.collected', { amount: formatINR(value.amount) })}</p>
          <p className="text-[13px]">{value.mode === 'upi' ? t('pa34.upiDone', { ref: value.upiRef }) : t('pa34.cashDone')}</p>
        </div>
        <button type="button" onClick={() => onChange(undefined)} className="min-h-10 text-[13px] font-semibold text-primary">
          {t('pa34.undo')}
        </button>
      </section>
    )

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-status-warning bg-status-warning-bg p-4" aria-label={t('pa34.title')}>
      <div className="flex items-center gap-3">
        <Banknote className="size-8 shrink-0 text-status-warning" aria-hidden />
        <div>
          <p className="text-[13px] font-semibold">{t('pa34.due')}</p>
          <p className="tabular font-heading text-[28px] font-bold leading-tight" data-testid="cod-due">
            {formatINR(due)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('pa34.mode')}>
        {(['cash', 'upi'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => {
              setMode(m)
              setUpiRef('')
            }}
            className={cn('min-h-12 rounded-xl border-2 bg-card font-semibold', mode === m && 'border-primary bg-primary-soft text-primary')}
          >
            {t(`pa34.m.${m}`)}
          </button>
        ))}
      </div>
      {mode === 'upi' && (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-card p-3">
          <QrCode value={`upi://pay?pa=logisco.nodal@hdfcbank&pn=Logisco&am=${due}&tn=${lr}`} label={t('pa34.qr')} className="size-40" />
          <p className="flex items-center gap-1 text-[13px] text-muted-foreground">
            <QrIcon className="size-4" aria-hidden /> {t('pa34.qrHint')} <SimulatedTag />
          </p>
          {upiRef ? (
            <p className="tabular text-[13px] font-semibold text-status-success">{t('pa34.upiRef', { ref: upiRef })}</p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setUpiRef(simulateUpiRef(lr, at))
                setReceived(String(due))
              }}
              className="min-h-12 w-full rounded-xl border-2 border-primary font-semibold text-primary"
            >
              {t('pa34.checkUpi')}
            </button>
          )}
        </div>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-[13px] font-semibold">{t('pa34.received')}</span>
        <input type="number" inputMode="numeric" aria-label={t('pa34.received')} value={received} onChange={(e) => setReceived(e.target.value)} className="tabular h-12 rounded-lg border border-input bg-card px-3 text-[18px]" />
        {mismatch && <span className="text-[13px] font-semibold text-status-danger">{t('pa34.mustEqual', { amount: formatINR(due) })}</span>}
      </label>
      <button type="button" disabled={!canConfirm} onClick={() => onChange({ mode, amount, upiRef: mode === 'upi' ? upiRef : undefined })} className="min-h-12 rounded-xl bg-primary font-bold text-primary-foreground disabled:opacity-40">
        {t('pa34.confirm')}
      </button>
      <p className="text-[13px] text-muted-foreground">{t('pa34.partial')}</p>
    </section>
  )
}
