/**
 * SIMULATED payment gateway (CP-23 recharge, CP-24 pay now): the customer picks
 * UPI / net banking / card, then the demo chooses Success or Failure.
 * All collections go into Logisco's nodal account (source §9).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatINR } from '@shared/lib/format'
import { PAY_METHODS, type PayMethod } from '@shared/sim/payment'
import { Button } from './button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './dialog'
import { RadioGroup, RadioGroupItem } from './radio-group'
import { SimulatedTag } from './SimulatedTag'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  amount: number
  /** What is being paid, e.g. "Wallet recharge" or the invoice numbers */
  purpose: string
  method?: PayMethod
  onSuccess: (method: PayMethod) => void
  onFailure: () => void
}

export function PaymentGateway({ open, onOpenChange, amount, purpose, method: initial = 'upi', onSuccess, onFailure }: Props) {
  const { t } = useTranslation()
  const [method, setMethod] = useState<PayMethod>(initial)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t('pay.title')} <SimulatedTag />
          </DialogTitle>
          <DialogDescription>{t('pay.body', { purpose })}</DialogDescription>
        </DialogHeader>
        <p className="tabular font-heading text-page-title font-bold" data-testid="pay-amount">
          {formatINR(amount)}
        </p>
        <RadioGroup value={method} onValueChange={(v) => setMethod(v as PayMethod)} aria-label={t('pay.method')} className="gap-2">
          {PAY_METHODS.map((m) => (
            <label key={m} className="flex items-center gap-2 rounded-lg border p-3 has-[[data-state=checked]]:border-primary">
              <RadioGroupItem value={m} aria-label={t(`pay.m.${m}`)} /> {t(`pay.m.${m}`)}
            </label>
          ))}
        </RadioGroup>
        <p className="text-caption text-muted-foreground">{t('pay.nodal')}</p>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              onFailure()
            }}
          >
            {t('pay.failure')}
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false)
              onSuccess(method)
            }}
          >
            {t('pay.success', { amount: formatINR(amount) })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
