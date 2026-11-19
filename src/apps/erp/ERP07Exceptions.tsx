/**
 * ERP-07 Exceptions queue — docs/04-erp-control-tower.md §6.3.
 * Source §10 Steps 1–3: auto-tickets with the responsible leg partner and the
 * Logisco desk as owners, the action and target time for each type, the AI
 * root cause, and no closing without the customer's confirmation.
 */
import { Bot, CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { ACTION_HOURS } from '@shared/engines/exceptionDetect'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { TicketAction } from '@shared/store/controlTowerActions'
import type { ExceptionKind, ShipmentException } from '@shared/types'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { SlaTimer } from '@shared/ui/SlaTimer'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'
import { SosAlerts } from './SosAlerts'

const FILTERS = ['open', 'resolved', 'all'] as const
const INVESTIGATE: ExceptionKind[] = ['sealMismatch', 'short', 'excess', 'damage', 'weightMismatch']

export default function ERP07Exceptions() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const [params, setParams] = useSearchParams()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open')
  const all = Object.values(data.exceptions).sort((a, b) => Number(a.status === 'resolved') - Number(b.status === 'resolved') || Date.parse(a.actionDueAt) - Date.parse(b.actionDueAt))
  const shown = all.filter((x) => (filter === 'all' ? true : filter === 'open' ? x.status !== 'resolved' : x.status === 'resolved'))
  const selected = data.exceptions[params.get('id') ?? '']
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp07.title')} subtitle={t('erp07.subtitle', { count: all.filter((x) => x.status !== 'resolved').length })} className="mb-0" />
      <SosAlerts />
      <div className="flex gap-2" role="group" aria-label={t('erp07.filter')}>
        {FILTERS.map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {t(`erp07.f.${f}`)}
          </Button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title={t('erp07.empty')} className="rounded-xl border bg-card" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="tickets">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp07.col.ticket')}</th>
                <th>{t('erp07.col.type')}</th>
                <th>{t('erp07.col.owner')}</th>
                <th>{t('erp07.col.target')}</th>
                <th>{t('erp07.col.cause')}</th>
                <th>{t('erp07.col.confirmation')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((x) => (
                <tr key={x.id} className={cn('border-b last:border-0', selected?.id === x.id && 'bg-primary-soft')} aria-label={x.id}>
                  <td className="px-4 py-2">
                    <button type="button" className="tabular font-medium text-primary hover:underline" onClick={() => setParams({ id: x.id })}>
                      {x.id}
                    </button>
                    <span className="tabular block text-caption text-muted-foreground">{x.shipmentId}</span>
                  </td>
                  <td className="py-2">
                    <Chip tone={x.status === 'resolved' ? 'neutral' : x.type === 'ndr' || x.type === 'pickupMissed' ? 'danger' : 'warning'}>{t(`cp19.type.${x.type}`)}</Chip>
                  </td>
                  <td className="py-2">
                    {x.ownerPartnerId ? data.partners[x.ownerPartnerId]?.shortName : '—'} + {t('erp07.ctDesk')}
                  </td>
                  <td className="py-2">{x.status === 'resolved' ? t('erp07.closedOn', { date: formatDate(x.closedAt ?? x.actionDueAt) }) : <SlaTimer dueAt={x.actionDueAt} totalMinutes={(ACTION_HOURS[x.type] ?? 24) * 60} />}</td>
                  <td className="py-2">{x.aiCause ? <Chip tone="info">{t(`erp07.cause.${x.aiCause}`)}</Chip> : '—'}</td>
                  <td className="py-2">
                    <Chip tone={x.customerConfirmed ? 'success' : 'neutral'}>{x.customerConfirmed ? t('erp07.confirmed') : t('erp07.pending')}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && <Detail key={selected.id} x={selected} />}
    </div>
  )
}

function Detail({ x }: { x: ShipmentException }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const [note, setNote] = useState('')
  const s = data.shipments[x.shipmentId]
  const leg = x.legId ? data.legs[x.legId] : undefined
  const canAct = (user.role === 'controlTower' || user.role === 'superAdmin') && x.status !== 'resolved'
  const run = (a: TicketAction, msg: string) => {
    useDemoStore.getState().ticketAction(x.id, a, note, user.id)
    setNote('')
    toast.success(msg)
  }
  const prev = leg ? s.legIds.map((id) => data.legs[id]).find((l) => l.seq === leg.seq - 1) : undefined

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp07.detail', { id: x.id })} data-testid="ticket-detail">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-card-title">
          {x.id} · {t(`cp19.type.${x.type}`)}
        </h2>
        <Link to={`/erp/shipments/${s.id}`} className="font-medium text-primary hover:underline">
          {t('erp07.timeline', { lr: s.id })}
        </Link>
      </div>
      <p className="text-caption text-muted-foreground">
        {t('erp07.raised', { at: formatDateTime(x.raisedAt) })} {x.auto && <span>· {t('erp07.auto')}</span>}
        {leg && ` · L${leg.seq} ${t(`legType.${leg.type}`)} · ${data.partners[leg.partnerId].shortName}`}
      </p>
      {x.aiCause && (
        <p className="flex items-center gap-2">
          <Bot className="size-4 text-muted-foreground" aria-hidden /> {t('erp07.aiCause', { cause: t(`erp07.cause.${x.aiCause}`) })} <SimulatedTag />
        </p>
      )}
      {x.rootCause && <p className="text-table">{x.rootCause}</p>}
      {x.report && (
        <p className="text-table" data-testid="field-report">
          {t('erp07.report', { name: data.fieldStaff[x.report.by]?.name ?? x.report.by, photos: x.report.photos.length })}
          {x.report.reason && ` · ${t(`pa18.r.${x.report.reason}`, { defaultValue: x.report.reason })}`}
          {x.report.pieceIds?.length ? ` · ${x.report.pieceIds.join(', ')}` : ''}
          {x.report.note && ` · ${x.report.note}`}
        </p>
      )}
      {x.partner?.response && (
        <p className="rounded-lg bg-primary-soft p-3 text-table" data-testid="partner-response">
          <span className="font-semibold">{t('erp07.partnerSays', { partner: data.partners[x.ownerPartnerId!].shortName })}</span> {x.partner.response} · {t(`pp20.cause.${x.partner.rootCause}`)}
        </p>
      )}

      {canAct && (
        <div className="flex flex-col gap-2 rounded-lg bg-gray-50 p-3">
          <p className="font-semibold">{t(`erp07.todo.${x.type}`)}</p>
          <Field label={t('erp07.note')} htmlFor="e07-note" small>
            <Input id="e07-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {x.type === 'pickupMissed' && leg && (
              <Button asChild size="sm">
                <Link to={`/erp/control-tower/reassign/${leg.id}?reason=capacity`}>{t('erp07.a.reassign')}</Link>
              </Button>
            )}
            {(x.type === 'delay' || x.type === 'breakdown') && (
              <Button size="sm" onClick={() => run('sendEta', t('erp07.done.sendEta'))}>
                {t('erp07.a.sendEta')}
              </Button>
            )}
            {INVESTIGATE.includes(x.type) && (
              <Button size="sm" onClick={() => run('investigate', t('erp07.done.investigate'))}>
                {t('erp07.a.investigate', { partner: prev ? data.partners[prev.partnerId].shortName : '' })}
              </Button>
            )}
            {x.type === 'ndr' && (
              <Button size="sm" onClick={() => run('resendNdr', t('erp07.done.resendNdr'))}>
                {t('erp07.a.resendNdr')}
              </Button>
            )}
            {x.type === 'ewbExpiry' && (
              <>
                <Button size="sm" onClick={() => run('extendEwb', t('erp07.done.extendEwb'))}>
                  {t('erpActions.extendEwb')}
                </Button>
                <Button size="sm" variant="outline" disabled={s.ewb?.partBUpdated} onClick={() => run('partB', t('erp07.done.partB'))}>
                  {t('erpActions.partB')}
                </Button>
              </>
            )}
            {!x.customerConfirmed && (
              <Button size="sm" variant="outline" onClick={() => run('customerConfirmed', t('erp07.done.customerConfirmed'))}>
                <CheckCircle2 /> {t('erp07.a.customerConfirmed')}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={!x.customerConfirmed}
              title={x.customerConfirmed ? undefined : t('erp07.needConfirmation')}
              onClick={() => (useDemoStore.getState().closeTicket(x.id, note, user.id), setNote(''), toast.success(t('erp07.done.closed')))}
            >
              {t('erp07.a.close')}
            </Button>
          </div>
          {!x.customerConfirmed && <p className="text-caption text-muted-foreground">{t('erp07.needConfirmation')}</p>}
        </div>
      )}

      {(x.log?.length ?? 0) > 0 && (
        <ol className="flex flex-col gap-1 border-l-2 pl-3 text-table" aria-label={t('erp07.log')}>
          {x.log!.map((l, i) => (
            <li key={i}>
              <span className="tabular text-caption text-muted-foreground">{formatDateTime(l.at)}</span> · {data.staff[l.by]?.name ?? l.by} · {t(`erp07.logAction.${l.action}`, { defaultValue: l.action })}
              {l.note && ` · ${l.note}`}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
