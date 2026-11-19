/**
 * ERP-33 Payout batches — docs/04-erp-control-tower.md. Source §9 Platform
 * Pays Partner (weekly by NEFT / IMPS, faster for higher tiers, early pay at a
 * small fee), §5.3 payout speed by tier, §12 guardrails (AI never pays on its
 * own). Finance makes the batch; a different approver releases it.
 * SIMULATED: the NEFT / IMPS file and UTRs.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { batchPreview, nextBatchDate, tiersDue, type PayoutLine } from '@shared/engines/payables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { Payout } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { TierBadge } from '@shared/ui/TierBadge'
import { useErpSession } from './useErpSession'

const CHECKER_ROLES = ['leadership', 'superAdmin']
const batchIdOf = (date: string) => `PB-${date.slice(0, 4)}-${date.slice(5, 7)}${date.slice(8)}`

export default function ERP33Payouts() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const date = nextBatchDate(now)
  const batch = data.payoutBatches[batchIdOf(date)]
  const lines: (PayoutLine | Payout)[] = batch ? batch.payoutIds.map((id) => data.payouts[id]) : batchPreview(data, date)
  const payable = lines.filter((l) => l.net > 0)
  const total = payable.reduce((s, l) => s + l.net, 0)
  const isChecker = CHECKER_ROLES.includes(user.role)
  const [confirm, setConfirm] = useState<'submit' | 'release'>()
  const earlyReqs = Object.values(data.payouts).filter((p) => p.kind === 'earlyPay' && p.status === 'pendingApproval')
  const history = Object.values(data.payoutBatches)
    .filter((b) => b.status === 'released')
    .sort((a, b) => b.date.localeCompare(a.date))
  const name = (id?: string) => (id ? (data.staff[id]?.name ?? id) : '—')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp33.title')} subtitle={t('erp33.subtitle')} className="mb-0" />

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp33.batch')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-section font-semibold">{t('erp33.batchOn', { date: formatDate(date), id: batchIdOf(date) })}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1 text-caption text-muted-foreground">
              {t('erp33.tiers')}
              {(batch?.tiers ?? tiersDue(date)).filter((x) => x !== 'probation').map((x) => (
                <Chip key={x} tone="neutral">
                  {t(`tier.${x}`)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="tabular font-heading text-page-title font-bold" data-testid="batch-total">
              {formatINR(total)}
            </p>
            {batch ? (
              <Chip tone={batch.status === 'released' ? 'success' : 'info'}>{t(`erp33.status.${batch.status}`)}</Chip>
            ) : (
              <span className="text-caption text-muted-foreground">{t('erp33.draft')}</span>
            )}
          </div>
        </div>

        {lines.length === 0 ? (
          <p className="text-muted-foreground">{t('erp33.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="batch-lines">
              <thead>
                <tr className="border-b text-left text-caption text-muted-foreground">
                  <th className="py-2">{t('erp33.col.partner')}</th>
                  <th>{t('erp33.col.invoices')}</th>
                  <th className="text-right">{t('erp33.col.earnings')}</th>
                  <th>{t('erp33.col.deductions')}</th>
                  <th className="text-right">{t('erp33.col.net')}</th>
                  {batch && <th>{t('erp33.col.utr')}</th>}
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const p = data.partners[l.partnerId]
                  const utr = 'utr' in l ? l.utr : undefined
                  return (
                    <tr key={l.partnerId} className={cn('border-b align-top last:border-0', l.net <= 0 && 'text-muted-foreground')} aria-label={p.shortName}>
                      <td className="py-2">
                        <span className="font-medium">{p.shortName}</span> <TierBadge tier={p.tier} />
                      </td>
                      <td className="tabular text-caption">{(l.invoiceIds ?? []).join(', ') || '—'}</td>
                      <td className="tabular text-right">{formatINR(l.gross)}</td>
                      <td>
                        {l.deductions.length ? (
                          <ul>
                            {l.deductions.map((d, i) => (
                              <li key={i} className="text-caption">
                                <span className="tabular text-status-danger">− {formatINR(d.amount)}</span> {t(`payout.ded.${d.kind ?? 'penalty'}`)}
                                {d.ref &&
                                  (d.kind === 'claim' ? (
                                    <>
                                      {' · '}
                                      <Link to={`/erp/claims/${d.ref}`} className="tabular text-primary hover:underline">
                                        {d.ref}
                                      </Link>
                                    </>
                                  ) : (
                                    <span className="tabular"> · {d.ref}</span>
                                  ))}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="tabular text-right font-semibold">
                        {formatINR(l.net)}
                        {l.net <= 0 && <span className="block text-caption font-normal text-status-warning">{t('erp33.carry')}</span>}
                      </td>
                      {batch && <td className="tabular text-caption">{utr ?? '—'}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {batch?.status === 'pendingApproval' && (
            <span className="text-caption text-muted-foreground">{t('erp33.madeBy', { maker: name(batch.makerId), at: formatDateTime(batch.submittedAt) })}</span>
          )}
          {!batch && (
            <Button disabled={!payable.length} onClick={() => setConfirm('submit')}>
              {t('erp33.submit')}
            </Button>
          )}
          {batch?.status === 'pendingApproval' &&
            (isChecker && batch.makerId !== user.id ? (
              <Button onClick={() => setConfirm('release')}>{t('erp33.release')}</Button>
            ) : (
              <span className="text-caption font-medium">{t('erp33.waitingApprover')}</span>
            ))}
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp33.early')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp33.early')}</h2>
        {earlyReqs.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t('erp33.noEarly')}</p>
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="early-pay">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp33.col.request')}</th>
                <th>{t('erp33.col.partner')}</th>
                <th className="text-right">{t('erp33.col.amount')}</th>
                <th className="text-right">{t('erp33.col.fee')}</th>
                <th className="text-right">{t('erp33.col.net')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {earlyReqs.map((p) => (
                <tr key={p.id} className="border-b last:border-0" aria-label={p.id}>
                  <td className="tabular px-4 py-2">{p.id}</td>
                  <td>{data.partners[p.partnerId].shortName}</td>
                  <td className="tabular text-right">{formatINR(p.gross)}</td>
                  <td className="tabular text-right">{formatINR(p.fee ?? 0)}</td>
                  <td className="tabular text-right font-semibold">{formatINR(p.net)}</td>
                  <td className="py-2 text-right">
                    {isChecker ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          useDemoStore.getState().releaseEarlyPay(p.id, user.id)
                          toast.success(t('erp33.earlyReleased', { id: p.id }))
                        }}
                      >
                        {t('erp33.releaseImps')}
                      </Button>
                    ) : (
                      <span className="text-caption text-muted-foreground">{t('erp33.waitingApprover')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp33.history')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp33.history')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="batch-history">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp33.col.batch')}</th>
              <th>{t('erp33.col.date')}</th>
              <th className="text-right">{t('erp33.col.partners')}</th>
              <th className="text-right">{t('erp33.col.net')}</th>
              <th>{t('erp33.col.makerChecker')}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((b) => (
              <tr key={b.id} className="border-b last:border-0" aria-label={b.id}>
                <td className="tabular px-4 py-2 font-medium">{b.id}</td>
                <td className="tabular">{formatDate(b.date)}</td>
                <td className="tabular text-right">{b.payoutIds.length}</td>
                <td className="tabular text-right">{formatINR(b.payoutIds.reduce((s, id) => s + data.payouts[id].net, 0))}</td>
                <td className="text-caption">
                  {name(b.makerId)} / {name(b.checkerId)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(undefined)}
        title={confirm === 'release' ? t('erp33.confirmRelease', { amount: formatINR(total) }) : t('erp33.confirmSubmit', { count: payable.length })}
        body={confirm === 'release' ? t('erp33.releaseBody', { count: payable.length }) : t('erp33.submitBody', { amount: formatINR(total) })}
        confirmLabel={confirm === 'release' ? t('erp33.release') : t('erp33.submit')}
        onConfirm={() => {
          if (confirm === 'submit') {
            const id = useDemoStore.getState().submitPayoutBatch(date, user.id)
            if (id) toast.success(t('erp33.submitted', { id }))
          } else if (batch) {
            useDemoStore.getState().releasePayoutBatch(batch.id, user.id)
            toast.success(t('erp33.released', { id: batch.id }))
          }
        }}
      />
    </div>
  )
}
