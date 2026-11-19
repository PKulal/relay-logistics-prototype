/**
 * PP-27 Payouts — docs/02-partner-portal.md. Source §9 Platform Pays Partner
 * (weekly by NEFT / IMPS, faster for higher tiers; early-pay option at a small
 * fee), §5.3 payout speed by tier. TDS and payout-advice PDFs are not in the
 * client document. SIMULATED: OTP (123456), IMPS and UTRs.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { earlyPayAvailable, nextPayout } from '@shared/engines/payables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import { verifyLoginOtp } from '@shared/sim/otp'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PAYOUT_TONE } from '@shared/ui/moneyTones'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { DeductionLink } from './financeBits'
import { usePartnerSession } from './usePartnerSession'

export default function PP27Payouts() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const next = nextPayout(data, partner.id, now)
  const shown = next.payout ?? next.line
  const history = Object.values(data.payouts)
    .filter((p) => p.partnerId === partner.id && (p.status === 'paid' || p.kind === 'earlyPay'))
    .sort((a, b) => (b.paidAt ?? b.dueDate).localeCompare(a.paidAt ?? a.dueDate))
  const tier = partner.tier ?? 'bronze'
  const early = tier === 'gold' || tier === 'silver'

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pp27.title')} subtitle={t(`pp27.cycle.${tier}`)} className="mb-0" />
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={t('pp27.next')} data-testid="next-payout">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-section font-semibold">{t('pp27.nextOn', { date: formatDate(next.date) })}</h2>
          <p className="tabular font-heading text-page-title font-bold">{shown ? formatINR(shown.net) : formatINR(0)}</p>
        </div>
        {next.payout && <Chip tone={PAYOUT_TONE[next.payout.status]}>{t(`pp27.status.${next.payout.status}`)}</Chip>}
        {shown ? (
          <table className="w-full text-table [&_td]:py-1">
            <tbody>
              <tr>
                <td>{t('pp27.earnings')}</td>
                <td className="tabular text-right">{formatINR(shown.gross)}</td>
              </tr>
              {shown.deductions.map((d, i) => (
                <tr key={i}>
                  <td>
                    <DeductionLink d={d} />
                  </td>
                  <td className="tabular text-right text-status-danger">− {formatINR(d.amount)}</td>
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <td className="pt-2">{t('pp27.net')}</td>
                <td className="tabular pt-2 text-right">{formatINR(shown.net)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-muted-foreground">{t('pp27.nothingYet')}</p>
        )}
        {shown && shown.net < 0 && <p className="text-caption text-status-warning">{t('pp27.carry')}</p>}
      </section>

      {early && <EarlyPay />}

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('pp27.history')}</h2>
        {history.length === 0 ? (
          <EmptyState title={t('pp27.noHistory')} />
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="payout-history">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp27.col.id')}</th>
                <th>{t('pp27.col.date')}</th>
                <th className="text-right">{t('pp27.col.gross')}</th>
                <th className="text-right">{t('pp27.col.deductions')}</th>
                <th className="text-right">{t('pp27.col.net')}</th>
                <th>{t('pp27.col.mode')}</th>
                <th>{t('pp27.col.utr')}</th>
                <th>{t('pp27.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map((p) => (
                <tr key={p.id} className="border-b last:border-0" aria-label={p.id}>
                  <td className="tabular px-4 py-2 font-medium">
                    {p.id}
                    {p.kind === 'earlyPay' && <span className="ml-1 text-caption text-muted-foreground">{t('pp27.earlyTag')}</span>}
                  </td>
                  <td className="tabular">{formatDate(p.paidAt ?? p.dueDate)}</td>
                  <td className="tabular text-right">{formatINR(p.gross)}</td>
                  <td className="tabular text-right">{formatINR(p.deductions.reduce((s, d) => s + d.amount, 0))}</td>
                  <td className="tabular text-right font-semibold">{formatINR(p.net)}</td>
                  <td>{p.mode ?? '—'}</td>
                  <td className="tabular">{p.utr ?? '—'}</td>
                  <td>
                    <Chip tone={PAYOUT_TONE[p.status]}>{t(`pp27.status.${p.status}`)}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function EarlyPay() {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const data = useData((d) => d)
  const available = earlyPayAvailable(data, partner.id)
  const pct = data.settings.earlyPayFeePct
  const [amount, setAmount] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [otp, setOtp] = useState('')
  const amt = Number(amount)
  const fee = Math.round(amt * pct) / 100
  const error = amount && !(amt > 0 && amt <= available) ? t('pp27.early.max', { amount: formatINR(available) }) : undefined
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={t('pp27.early.title')}>
      <h2 className="font-heading text-section font-semibold">{t('pp27.early.title')}</h2>
      <p className="tabular" data-testid="early-available">
        {t('pp27.early.available', { amount: formatINR(available), pct })}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('pp27.early.amount')} htmlFor="ep-amt" required error={error} className="w-56">
          <Input id="ep-amt" type="number" className="tabular" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        {amt > 0 && !error && <p className="tabular pb-2 text-muted-foreground">{t('pp27.early.feeNet', { fee: formatINR(fee), net: formatINR(amt - fee) })}</p>}
      </div>
      <Button className="self-start" disabled={!amt || !!error || !available} onClick={() => setConfirm(true)}>
        {t('pp27.early.request')}
      </Button>
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t('pp27.early.otpTitle')} <SimulatedTag />
            </DialogTitle>
            <DialogDescription>{t('pp27.early.otpBody', { amount: formatINR(amt), mobile: user.mobile })}</DialogDescription>
          </DialogHeader>
          <Input aria-label={t('pp27.early.otp')} inputMode="numeric" maxLength={6} className="tabular tracking-[0.3em]" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={!verifyLoginOtp(otp)}
              onClick={() => {
                const id = useDemoStore.getState().requestEarlyPay(partner.id, amt, user.id)
                setConfirm(false)
                setOtp('')
                if (!id) return toast.error(t('pp27.early.failed'))
                setAmount('')
                toast.success(t('pp27.early.done', { id }))
              }}
            >
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
