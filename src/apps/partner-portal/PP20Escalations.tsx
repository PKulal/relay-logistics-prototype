/**
 * PP-20 Escalations inbox — docs/02-partner-portal.md. Source §5.1: tickets
 * land in the partner's inbox with a response timer; a missed timer reduces
 * the score (§5.2 Responsiveness, 10%). "Request more time" is not in the
 * client document.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { AMBER_MINUTES, escalationsFor, type Escalation, type EscalationStatus } from '@shared/engines/escalations'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDateTime, formatDuration } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { PartnerRootCause } from '@shared/types'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { NotFound, PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { usePartnerSession } from './usePartnerSession'

const STATUS_TONE: Record<EscalationStatus, Tone> = { new: 'danger', acknowledged: 'warning', resolved: 'info', closed: 'neutral' }
const ROOT_CAUSES: PartnerRootCause[] = ['staffShortage', 'vehicleIssue', 'addressIssue', 'customerNotReady', 'weatherTraffic', 'other']

/** "Ack in 40 min" / "Ack missed by 1 h 10 min" */
function Timer({ label, left }: { label: 'ack' | 'resolve'; left?: number }) {
  const { t } = useTranslation()
  if (left === undefined) return <span className="text-muted-foreground">—</span>
  const tone = left < 0 ? 'text-status-danger font-semibold' : left < AMBER_MINUTES ? 'text-status-warning font-semibold' : ''
  return <span className={cn('tabular', tone)}>{left < 0 ? t(`pp20.timer.${label}Missed`, { d: formatDuration(-left) }) : t(`pp20.timer.${label}`, { d: formatDuration(left) })}</span>
}

export default function PP20Escalations() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [params, setParams] = useSearchParams()
  const list = escalationsFor(data, partner.id, now)
  const open = list.find((e) => e.x.id === params.get('ticket'))
  if (params.get('ticket')) return open ? <TicketDetail e={open} onBack={() => setParams({})} /> : <NotFound />
  const active = list.filter((e) => e.status === 'new' || e.status === 'acknowledged').length

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pp20.title')} subtitle={t('pp20.subtitle', { count: active })} className="mb-0" />
      {list.length === 0 ? (
        <EmptyState title={t('pp20.empty')} className="rounded-xl border bg-card" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="escalations">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp20.col.ticket')}</th>
                <th>{t('pp20.col.job')}</th>
                <th>{t('pp20.col.type')}</th>
                <th>{t('pp20.col.raised')}</th>
                <th>{t('pp20.col.timers')}</th>
                <th>{t('pp20.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.x.id} className="border-b last:border-0" aria-label={e.x.id}>
                  <td className="px-4 py-2">
                    <button type="button" className="tabular font-medium text-primary hover:underline" onClick={() => setParams({ ticket: e.x.id })}>
                      {e.x.id}
                    </button>
                  </td>
                  <td className="tabular">
                    {e.x.legId ? (
                      <Link to={`/partner/jobs/${e.x.legId}`} className="text-primary hover:underline">
                        {e.x.legId}
                      </Link>
                    ) : (
                      e.x.shipmentId
                    )}
                  </td>
                  <td>
                    <Chip tone="warning">{t(`pp20.type.${e.x.type}`)}</Chip>
                  </td>
                  <td className="tabular">
                    {t(e.x.report ? 'pp20.by.app' : e.x.auto ? 'pp20.by.system' : 'pp20.by.desk')} · {formatDateTime(e.x.raisedAt)}
                  </td>
                  <td className="flex flex-col py-2">
                    <Timer label="ack" left={e.ackLeft} />
                    <Timer label="resolve" left={e.resolveLeft} />
                  </td>
                  <td>
                    <Chip tone={STATUS_TONE[e.status]}>{t(`pp20.status.${e.status}`)}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-caption text-muted-foreground">{t('pp20.rule')}</p>
    </div>
  )
}

function TicketDetail({ e, onBack }: { e: Escalation; onBack: () => void }) {
  const { t } = useTranslation()
  const { user } = usePartnerSession()
  const data = useData((d) => d)
  const x = e.x
  const [response, setResponse] = useState('')
  const [cause, setCause] = useState<PartnerRootCause | ''>('')
  const [files, setFiles] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const events = Object.values(data.events)
    .filter((ev) => ev.shipmentId === x.shipmentId && (!x.legId || ev.legId === x.legId || !ev.legId))
    .sort((a, b) => a.at.localeCompare(b.at))
  const req = t('cp04.err.required')
  const errors = { response: !response.trim() ? req : undefined, cause: !cause ? req : undefined }
  const canAct = e.status === 'new' || e.status === 'acknowledged'
  const resolve = () => {
    setTried(true)
    if (errors.response || errors.cause) return toast.error(t('cp04.fix'))
    useDemoStore.getState().resolvePartnerTicket(x.id, { response, rootCause: cause as PartnerRootCause, evidence: files }, user.id)
    toast.success(t('pp20.resolved'))
  }
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <button type="button" onClick={onBack} className="w-fit text-caption font-medium text-primary hover:underline">
        ← {t('pp20.back')}
      </button>
      <PageHeader title={`${x.id} · ${t(`pp20.type.${x.type}`)}`} subtitle={`${x.shipmentId}${x.legId ? ` · ${x.legId}` : ''} · ${formatDateTime(x.raisedAt)}`} className="mb-0" />
      <div className="flex flex-wrap items-center gap-3" data-testid="ticket-timers">
        <Chip tone={STATUS_TONE[e.status]}>{t(`pp20.status.${e.status}`)}</Chip>
        <Timer label="ack" left={e.ackLeft} />
        <Timer label="resolve" left={e.resolveLeft} />
      </div>

      {x.report && (
        <section className="rounded-xl border bg-card p-5 shadow-card" data-testid="report">
          <h2 className="mb-1 font-heading text-section font-semibold">{t('pp20.report')}</h2>
          <p>
            {data.fieldStaff[x.report.by]?.name ?? x.report.by}
            {x.report.reason && ` · ${t(`pa18.r.${x.report.reason}`, { defaultValue: x.report.reason })}`}
            {x.report.pieceIds?.length ? ` · ${x.report.pieceIds.join(', ')}` : ''}
          </p>
          {x.report.note && <p className="text-muted-foreground">{x.report.note}</p>}
          <p className="text-caption text-muted-foreground">{t('pp20.photos', { count: x.report.photos.length })}</p>
        </section>
      )}

      <section className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="mb-2 font-heading text-section font-semibold">{t('pp20.timeline')}</h2>
        <ol className="flex flex-col gap-1 text-table" data-testid="ticket-timeline">
          {events.map((ev) => (
            <li key={ev.id} className="flex gap-3">
              <span className="tabular w-32 shrink-0 text-muted-foreground">{formatDateTime(ev.at)}</span>
              <span>
                {t(`event.${ev.type}`, { defaultValue: ev.type })}
                {ev.note && <span className="text-muted-foreground"> · {ev.note}</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {x.partner?.response && (
        <section className="rounded-xl border bg-card p-5 shadow-card" data-testid="our-response">
          <h2 className="mb-1 font-heading text-section font-semibold">{t('pp20.yourResponse')}</h2>
          <p>{x.partner.response}</p>
          <p className="text-caption text-muted-foreground">
            {t(`pp20.cause.${x.partner.rootCause}`)} · {formatDateTime(x.partner.resolvedAt!)}
            {x.partner.evidence?.length ? ` · ${x.partner.evidence.join(', ')}` : ''}
          </p>
          {e.status === 'closed' && <p className="mt-1 font-medium text-status-success">{t('pp20.closedByLogisco')}</p>}
        </section>
      )}

      {canAct && (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={t('pp20.respond')}>
          <h2 className="font-heading text-section font-semibold">{t('pp20.respond')}</h2>
          {e.status === 'new' && (
            <Button
              variant="outline"
              className="self-start"
              onClick={() => {
                useDemoStore.getState().acknowledgeTicket(x.id, user.id)
                toast.success(t('pp20.acked'))
              }}
            >
              {t('pp20.ack')}
            </Button>
          )}
          <Field label={t('pp20.response')} htmlFor="tk-resp" required error={tried ? errors.response : undefined}>
            <textarea id="tk-resp" rows={3} value={response} onChange={(ev) => setResponse(ev.target.value)} className="rounded-md border border-input bg-background p-2" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('pp20.rootCause')} htmlFor="tk-cause" required error={tried ? errors.cause : undefined}>
              <NativeSelect id="tk-cause" value={cause} onChange={(ev) => setCause(ev.target.value as PartnerRootCause)}>
                <option value="">{t('cp04.choose')}</option>
                {ROOT_CAUSES.map((c) => (
                  <option key={c} value={c}>
                    {t(`pp20.cause.${c}`)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t('pp20.evidence')} htmlFor="tk-files">
              <Input id="tk-files" type="file" multiple onChange={(ev) => setFiles([...(ev.target.files ?? [])].map((f) => f.name))} />
            </Field>
          </div>
          <Button className="self-start" onClick={resolve}>
            {t('pp20.resolve')}
          </Button>
        </section>
      )}
    </div>
  )
}
