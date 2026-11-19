/**
 * CP-23 Wallet (prepaid customers) — docs/01-customer-portal.md. Source §6
 * (SME shipper: prepaid wallet), §7.2 Billing & COD, §9 (all collections into
 * Logisco's nodal account). Dispatch sees the balance only. Auto-recharge,
 * low-balance alert and statement download are not in the client document.
 */
import { Wallet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { WALLET_MIN_RECHARGE, WALLET_QUICK_PICKS, walletKind, type WalletKind } from '@shared/engines/receivables'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime, formatINR } from '@shared/lib/format'
import { PAY_METHODS, type PayMethod } from '@shared/sim/payment'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { AccessDenied, PageHeader } from '@shared/ui/Page'
import { PaymentGateway } from '@shared/ui/PaymentGateway'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { useCustomerSession } from './useCustomerSession'

const KIND_TONE: Record<WalletKind, Tone> = { recharge: 'success', bookingDebit: 'neutral', weightRevision: 'warning', rtoCharge: 'warning', refund: 'info', claimCredit: 'info' }

export default function CP23Wallet() {
  const { t } = useTranslation()
  const { customer, user } = useCustomerSession()
  const txns = useData((d) => d.walletTxns)
  const [amount, setAmount] = useState('10000')
  const [method, setMethod] = useState<PayMethod>('upi')
  const [paying, setPaying] = useState(false)
  if (customer.billing !== 'prepaid') return <AccessDenied />
  const money = user.role !== 'dispatch'
  const amt = Number(amount)
  const error = !(amt >= WALLET_MIN_RECHARGE) ? t('cp23.min', { min: formatINR(WALLET_MIN_RECHARGE) }) : undefined
  const list = Object.values(txns)
    .filter((x) => x.customerId === customer.id)
    .sort((a, b) => b.at.localeCompare(a.at))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('cp23.title')} subtitle={t('cp23.subtitle')} className="mb-0" />
      <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
        <section className="flex flex-col gap-1 rounded-xl border bg-card p-5 shadow-card">
          <p className="flex items-center gap-2 text-caption text-muted-foreground">
            <Wallet className="size-4" aria-hidden /> {t('cp23.balance')}
          </p>
          <p className="tabular font-heading text-[32px] font-bold" data-testid="balance">
            {formatINR(customer.walletBalance)}
          </p>
        </section>
        {money && (
          <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card" aria-label={t('cp23.recharge')}>
            <h2 className="font-heading text-section font-semibold">{t('cp23.recharge')}</h2>
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t('cp23.amount')} htmlFor="wl-amt" required error={error} className="w-48">
                <Input id="wl-amt" type="number" min={WALLET_MIN_RECHARGE} className="tabular" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <div className="flex gap-2 pb-0.5">
                {WALLET_QUICK_PICKS.map((v) => (
                  <Button key={v} type="button" variant="outline" size="sm" onClick={() => setAmount(String(v))} className={cn(amt === v && 'border-primary bg-primary-soft')}>
                    {formatINR(v).replace('.00', '')}
                  </Button>
                ))}
              </div>
            </div>
            <fieldset>
              <legend className="mb-2 font-medium">{t('pay.method')}</legend>
              <RadioGroup value={method} onValueChange={(v) => setMethod(v as PayMethod)} className="flex flex-wrap gap-4" aria-label={t('pay.method')}>
                {PAY_METHODS.map((m) => (
                  <label key={m} className="flex items-center gap-2">
                    <RadioGroupItem value={m} aria-label={t(`pay.m.${m}`)} /> {t(`pay.m.${m}`)}
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
            <Button className="self-start" disabled={!!error} onClick={() => setPaying(true)}>
              {t('cp23.rechargeBtn', { amount: error ? '' : formatINR(amt) })}
            </Button>
            <PaymentGateway
              key={String(paying)}
              open={paying}
              onOpenChange={setPaying}
              amount={amt}
              purpose={t('cp23.purpose')}
              method={method}
              onSuccess={(m) => {
                const ref = useDemoStore.getState().rechargeWallet(customer.id, amt, m, user.id)
                if (ref) toast.success(t('cp23.done', { amount: formatINR(amt), ref }))
              }}
              onFailure={() => toast.error(t('pay.failed'))}
            />
          </section>
        )}
      </div>

      {money && (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('cp23.txns')}</h2>
          {list.length === 0 ? (
            <EmptyState title={t('cp23.empty')} />
          ) : (
            <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="wallet-txns">
              <thead>
                <tr className="border-b text-left text-caption text-muted-foreground">
                  <th className="px-4 py-2">{t('cp23.col.at')}</th>
                  <th>{t('cp23.col.type')}</th>
                  <th>{t('cp23.col.ref')}</th>
                  <th className="text-right">{t('cp23.col.amount')}</th>
                  <th className="text-right">{t('cp23.col.balance')}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((x) => {
                  const kind = walletKind(x)
                  return (
                    <tr key={x.id} className="border-b last:border-0" aria-label={x.ref}>
                      <td className="tabular px-4 py-2">{formatDateTime(x.at)}</td>
                      <td>
                        <Chip tone={KIND_TONE[kind]}>{t(`cp23.kind.${kind}`)}</Chip>
                      </td>
                      <td className="tabular">{x.ref}</td>
                      <td className={cn('tabular text-right', x.amount > 0 ? 'text-status-success' : '')}>
                        {x.amount > 0 ? '+ ' : '− '}
                        {formatINR(Math.abs(x.amount))}
                      </td>
                      <td className="tabular text-right">{formatINR(x.balanceAfter)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  )
}
