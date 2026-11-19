/**
 * PP-39 Suspension and offboarding status — docs/02-partner-portal.md.
 * Source §5.4: every step logged with reasons and visible to the partner.
 * The settlement statement PDF is not in the client document; the partner's
 * exit request comes with PP-33 (Settings).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { usePartnerSession } from './usePartnerSession'

export default function PP39Case() {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const data = useData((d) => d)
  const [text, setText] = useState('')
  const c = Object.values(data.suspensionCases)
    .filter((x) => x.partnerId === partner.id)
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0]
  if (!c) return <EmptyState title={t('pp39.none')} className="rounded-xl border bg-card" />
  const payout = c.payoutId ? data.payouts[c.payoutId] : undefined
  const done = c.inFlight.filter((i) => i.decision === 'finish').length

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <PageHeader title={t('pp39.title')} subtitle={`${c.id} · ${t(`erp17.trigger.${c.trigger}`)}`} className="mb-0" />
      <section className="flex flex-col gap-1 rounded-xl border bg-card p-5 shadow-card" data-testid="case">
        <p>
          <span className="font-semibold">{t('pp39.reason')}</span> {c.reason}
        </p>
        <p className="text-caption text-muted-foreground">{t('pp39.opened', { at: formatDateTime(c.openedAt) })}</p>
      </section>

      <ol className="flex flex-col gap-2" aria-label={t('erp17.steps')}>
        <Step n={1} done={!!c.frozenAt} text={c.frozenAt ? t('pp39.frozen', { date: formatDate(c.frozenAt) }) : t('pp39.s1pending')} />
        <Step n={2} done={c.step === 3 || c.step === 'closed'} text={c.frozenAt ? t('pp39.inFlight', { finish: done, transfer: c.inFlight.filter((i) => i.decision === 'transfer').length, open: c.inFlight.filter((i) => !i.decision).length }) : '—'}>
          {c.inFlight.length > 0 && (
            <ul className="mt-1 text-caption">
              {c.inFlight.map((i) => (
                <li key={i.legId} className="tabular">
                  {i.legId} · {i.decision === 'transfer' ? t('erp17.transferredTo', { partner: data.partners[i.toPartnerId!].shortName }) : i.decision === 'finish' ? t('pp39.youFinish') : t('pp39.pending')}
                </li>
              ))}
            </ul>
          )}
        </Step>
        <Step n={3} done={c.step === 'closed'} text={c.settlement ? t('pp39.settlement', { amount: formatINR(c.settlement.finalPayout) }) : '—'}>
          {c.settlement && (
            <ul className="mt-1 text-caption" data-testid="settlement">
              <li className="tabular">
                {t('erp17.earnings')}: {formatINR(c.settlement.earnings)}
              </li>
              {c.settlement.deductions.map((d, n) => (
                <li key={n} className="tabular">
                  {t(`payout.ded.${d.kind}`)} {d.ref} · − {formatINR(d.amount)}
                </li>
              ))}
            </ul>
          )}
        </Step>
      </ol>

      <section className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="font-semibold">{t('pp39.access')}</h2>
        <p data-testid="access">{c.step === 'closed' ? t('pp39.revoked', { date: formatDate(c.closedAt!), utr: payout?.utr ?? '' }) : t('pp39.accessPending')}</p>
      </section>

      <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp17.log')}>
        <h2 className="mb-2 font-heading text-section font-semibold">{t('erp17.log')}</h2>
        <ol className="flex flex-col gap-1 text-table" data-testid="case-log">
          {c.log.map((l, n) => (
            <li key={n} className="flex gap-3">
              <span className="tabular w-32 shrink-0 text-muted-foreground">{formatDateTime(l.at)}</span>
              <span>
                <span className="font-medium">{l.app === 'partnerPortal' ? (data.partnerUsers[l.by]?.name ?? l.by) : 'Logisco'}</span> · {l.text}
              </span>
            </li>
          ))}
        </ol>
        {c.step !== 'closed' && (
          <div className="mt-3 flex flex-col gap-2">
            <label htmlFor="pp39-r" className="font-medium">
              {t('pp39.respond')}
            </label>
            <textarea id="pp39-r" rows={2} value={text} onChange={(e) => setText(e.target.value)} className="rounded-md border border-input bg-background p-2" />
            <Button
              className="self-start"
              disabled={!text.trim()}
              onClick={() => {
                useDemoStore.getState().respondToCase(c.id, text, user.id)
                setText('')
                toast.success(t('pp39.sent'))
              }}
            >
              {t('pp39.send')}
            </Button>
          </div>
        )}
      </section>
    </div>
  )
}

function Step({ n, done, text, children }: { n: number; done: boolean; text: string; children?: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <li className={cn('rounded-xl border bg-card p-4', done && 'border-status-success')} aria-label={t(`erp17.s${n}.title`)}>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{t(`erp17.s${n}.title`)}</span>
        <Chip tone={done ? 'success' : 'neutral'}>{done ? t('pp39.done') : t('pp39.open')}</Chip>
      </div>
      <p className="text-table">{text}</p>
      {children}
    </li>
  )
}
