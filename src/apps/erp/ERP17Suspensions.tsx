/**
 * ERP-17 Suspension and offboarding case — docs/04-erp-control-tower.md.
 * Source §5.4: trigger (score below 60 for 2 weeks, fraud / theft / tampering,
 * repeated document expiry, partner request) → freeze and transfer → settle
 * and close; every step logged with reasons and visible to the partner.
 * The Partner Manager makes the case; a different approver closes it.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { bestBackup } from '@shared/engines/controlTower'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { openCaseOf } from '@shared/store/scoringActions'
import type { SuspensionCase, SuspensionTrigger } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { TierBadge } from '@shared/ui/TierBadge'
import { useErpSession } from './useErpSession'

const TRIGGERS: SuspensionTrigger[] = ['scoreBelow60', 'fraud', 'documentExpiry', 'partnerRequest']
const CHECKER_ROLES = ['leadership', 'superAdmin']

export default function ERP17Suspensions() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const [params, setParams] = useSearchParams()
  const cases = Object.values(data.suspensionCases).sort((a, b) => Number(a.step === 'closed') - Number(b.step === 'closed') || b.openedAt.localeCompare(a.openedAt))
  const open = data.suspensionCases[params.get('case') ?? '']
  if (open) return <CaseView c={open} onBack={() => setParams({})} />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp17.title')} subtitle={t('erp17.subtitle')} className="mb-0" />
      <StartCase partnerId={params.get('partner') ?? ''} onStarted={(id) => setParams({ case: id })} />
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        {cases.length === 0 ? (
          <p className="p-5 text-muted-foreground">{t('erp17.empty')}</p>
        ) : (
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="cases">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp17.col.case')}</th>
                <th>{t('erp17.col.partner')}</th>
                <th>{t('erp17.col.trigger')}</th>
                <th>{t('erp17.col.opened')}</th>
                <th>{t('erp17.col.step')}</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id} className="border-b last:border-0" aria-label={c.id}>
                  <td className="px-4 py-2">
                    <button type="button" className="tabular font-medium text-primary hover:underline" onClick={() => setParams({ case: c.id })}>
                      {c.id}
                    </button>
                  </td>
                  <td>{data.partners[c.partnerId].shortName}</td>
                  <td>{t(`erp17.trigger.${c.trigger}`)}</td>
                  <td className="tabular">
                    {formatDateTime(c.openedAt)} {c.auto && <span className="text-caption text-muted-foreground">· {t('erp17.auto')}</span>}
                  </td>
                  <td>
                    <Chip tone={c.step === 'closed' ? 'neutral' : 'warning'}>{t(`erp17.step.${c.step}`)}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StartCase({ partnerId, onStarted }: { partnerId: string; onStarted: (id: string) => void }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const candidates = Object.values(data.partners).filter((p) => ['live', 'probation', 'trial'].includes(p.status) && !openCaseOf(data, p.id))
  const [pid, setPid] = useState(candidates.some((p) => p.id === partnerId) ? partnerId : '')
  const [trigger, setTrigger] = useState<SuspensionTrigger>('scoreBelow60')
  const [reason, setReason] = useState('')
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp17.start')}>
      <h2 className="font-heading text-section font-semibold">{t('erp17.start')}</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={t('erp17.col.partner')} htmlFor="sc-p">
          <NativeSelect id="sc-p" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">{t('cp04.choose')}</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.shortName} · {p.score}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('erp17.col.trigger')} htmlFor="sc-t">
          <NativeSelect id="sc-t" value={trigger} onChange={(e) => setTrigger(e.target.value as SuspensionTrigger)}>
            {TRIGGERS.map((x) => (
              <option key={x} value={x}>
                {t(`erp17.trigger.${x}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('erp17.reason')} htmlFor="sc-r">
          <Input id="sc-r" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <Button
        className="self-start"
        disabled={!pid || !reason.trim()}
        onClick={() => {
          useDemoStore.getState().openSuspensionCase(pid, trigger, reason, user.id)
          const c = openCaseOf(useDemoStore.getState().data, pid)
          if (c) {
            toast.success(t('erp17.started', { id: c.id }))
            onStarted(c.id)
          }
        }}
      >
        {t('erp17.startBtn')}
      </Button>
    </section>
  )
}

function CaseView({ c, onBack }: { c: SuspensionCase; onBack: () => void }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const p = data.partners[c.partnerId]
  const [confirm, setConfirm] = useState<'freeze' | 'close'>()
  const isChecker = CHECKER_ROLES.includes(user.role)
  const act = (f: () => void, msg: string) => {
    f()
    toast.success(msg)
  }
  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <button type="button" onClick={onBack} className="w-fit text-caption font-medium text-primary hover:underline">
        ← {t('erp17.back')}
      </button>
      <PageHeader title={`${c.id} · ${p.shortName}`} subtitle={`${t(`erp17.trigger.${c.trigger}`)} · ${c.reason}`} actions={<TierBadge tier={p.tier} score={p.score} />} className="mb-0" />
      <ol className="grid gap-2 sm:grid-cols-3" aria-label={t('erp17.steps')}>
        {([1, 2, 3] as const).map((n) => {
          const done = c.step === 'closed' || (typeof c.step === 'number' && c.step > n)
          return (
            <li key={n} className={cn('rounded-lg border p-3', c.step === n && 'border-primary bg-primary-soft', done && 'opacity-70')}>
              <p className="font-semibold">{t(`erp17.s${n}.title`)}</p>
              <p className="text-caption text-muted-foreground">{t(`erp17.s${n}.what`)}</p>
            </li>
          )
        })}
      </ol>

      {c.step === 1 && (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card">
          <p>{t('erp17.s1.body')}</p>
          <Button className="self-start" variant="destructive" onClick={() => setConfirm('freeze')}>
            {t('erp17.freeze')}
          </Button>
        </section>
      )}

      {c.frozenAt && (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp17.s2.title')}>
          <h2 className="font-heading text-section font-semibold">
            {t('erp17.s2.title')} · {t('erp17.frozenOn', { date: formatDate(c.frozenAt) })}
          </h2>
          {c.inFlight.length === 0 ? (
            <p className="text-muted-foreground">{t('erp17.noInFlight')}</p>
          ) : (
            <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="in-flight">
              <thead>
                <tr className="border-b text-left text-caption text-muted-foreground">
                  <th className="py-2">{t('erp17.col.job')}</th>
                  <th>{t('erp17.col.status')}</th>
                  <th>{t('erp17.col.decision')}</th>
                </tr>
              </thead>
              <tbody>
                {c.inFlight.map((i) => {
                  const leg = data.legs[i.legId]
                  const backup = !i.decision && leg.status !== 'inProgress' ? bestBackup(data, i.legId) : undefined
                  return (
                    <tr key={i.legId} className="border-b last:border-0" aria-label={i.legId}>
                      <td className="tabular py-2">
                        {i.legId} <span className="text-caption text-muted-foreground">· {t(`legType.${leg.type}`)}</span>
                      </td>
                      <td>{t(`status.leg.${leg.status}`, { defaultValue: leg.status })}</td>
                      <td className="py-1">
                        {i.decision ? (
                          <span>{i.decision === 'transfer' ? t('erp17.transferredTo', { partner: data.partners[i.toPartnerId!].shortName }) : t('erp17.finishes')}</span>
                        ) : c.step === 2 ? (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => act(() => useDemoStore.getState().decideInFlight(c.id, i.legId, 'finish', user.id), t('erp17.decided'))}>
                              {t('erp17.finish')}
                            </Button>
                            <Button size="sm" variant="outline" disabled={!backup} title={backup ? undefined : t('erp17.noBackup')} onClick={() => act(() => useDemoStore.getState().decideInFlight(c.id, i.legId, 'transfer', user.id), t('erp17.decided'))}>
                              {backup ? t('erp17.transferTo', { partner: data.partners[backup.partnerId].shortName }) : t('erp17.transfer')}
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {c.step === 2 && (
            <Button className="self-start" disabled={c.inFlight.some((i) => !i.decision)} onClick={() => act(() => useDemoStore.getState().moveToSettlement(c.id, user.id), t('erp17.toSettlement'))}>
              {t('erp17.goSettle')}
            </Button>
          )}
        </section>
      )}

      {c.settlement && (
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp17.s3.title')} data-testid="settlement">
          <h2 className="font-heading text-section font-semibold">{t('erp17.s3.title')}</h2>
          <table className="w-full max-w-xl text-table [&_td]:py-1">
            <tbody>
              <tr>
                <td>{t('erp17.earnings')}</td>
                <td className="tabular text-right">{formatINR(c.settlement.earnings)}</td>
              </tr>
              {c.settlement.deductions.map((d, n) => (
                <tr key={n}>
                  <td>
                    {t(`payout.ded.${d.kind}`)}
                    {d.ref && (d.kind === 'claim' ? <Link to={`/erp/claims/${d.ref}`} className="tabular ml-1 text-primary hover:underline">{d.ref}</Link> : <span className="tabular ml-1">{d.ref}</span>)}
                  </td>
                  <td className="tabular text-right text-status-danger">− {formatINR(d.amount)}</td>
                </tr>
              ))}
              <tr className="border-t font-semibold">
                <td className="pt-2">{t('erp17.finalPayout')}</td>
                <td className="tabular pt-2 text-right">{formatINR(c.settlement.finalPayout)}</td>
              </tr>
            </tbody>
          </table>
          <ul className="text-caption text-muted-foreground">
            {(['settled', 'payout', 'revoke', 'archive'] as const).map((k) => (
              <li key={k}>
                {c.step === 'closed' ? '✓' : '○'} {t(`erp17.check.${k}`)}
              </li>
            ))}
          </ul>
          {c.step === 3 && !c.closeRequestedBy && (
            <Button className="self-start" onClick={() => act(() => useDemoStore.getState().requestClose(c.id, user.id), t('erp17.sentForApproval'))}>
              {t('erp17.submitClose')}
            </Button>
          )}
          {c.step === 3 && c.closeRequestedBy && (isChecker && c.closeRequestedBy !== user.id ? (
            <Button className="self-start" variant="destructive" onClick={() => setConfirm('close')}>
              {t('erp17.approveClose')}
            </Button>
          ) : (
            <p className="font-medium">{t('erp17.waitingApprover', { maker: data.staff[c.closeRequestedBy]?.name ?? c.closeRequestedBy })}</p>
          ))}
          {c.step === 'closed' && c.payoutId && <p className="font-medium text-status-success">{t('erp17.closed', { amount: formatINR(data.payouts[c.payoutId].net), utr: data.payouts[c.payoutId].utr })}</p>}
        </section>
      )}

      <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp17.log')}>
        <h2 className="mb-2 font-heading text-section font-semibold">{t('erp17.log')}</h2>
        <ol className="flex flex-col gap-1 text-table" data-testid="case-log">
          {c.log.map((l, n) => (
            <li key={n} className="flex gap-3">
              <span className="tabular w-32 shrink-0 text-muted-foreground">{formatDateTime(l.at)}</span>
              <span>
                <span className="font-medium">{l.app === 'partnerPortal' ? (data.partnerUsers[l.by]?.name ?? l.by) : l.by === 'system' ? t('erp17.system') : (data.staff[l.by]?.name ?? l.by)}</span> · {l.text}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(undefined)}
        destructive
        title={confirm === 'freeze' ? t('erp17.confirmFreeze', { partner: p.shortName }) : t('erp17.confirmClose', { partner: p.shortName })}
        body={confirm === 'freeze' ? t('erp17.freezeBody') : t('erp17.closeBody', { amount: formatINR(c.settlement?.finalPayout ?? 0) })}
        confirmLabel={confirm === 'freeze' ? t('erp17.freeze') : t('erp17.approveClose')}
        onConfirm={() => {
          if (confirm === 'freeze') act(() => useDemoStore.getState().freezePartner(c.id, user.id), t('erp17.frozen'))
          else act(() => useDemoStore.getState().approveClose(c.id, user.id), t('erp17.offboarded'))
        }}
      />
    </div>
  )
}
