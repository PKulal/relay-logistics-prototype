/**
 * ERP-39 Customer Success: tickets and account health — docs/04-erp-control-tower.md.
 * Source §11 Dept 4 (tickets, account health, QBRs, NPS; ticket triage, churn
 * prediction). Replies reach the customer as a notification; the Customer
 * Portal's support screen (CP-37) comes with the Settings item.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { accountStats, churnRisk, ndrFollowUps, ticketPriority } from '@shared/engines/departments'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDateTime, formatDuration } from '@shared/lib/format'
import { minutesBetween } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import type { Ticket } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const
const RISK_TONE = { low: 'success', medium: 'warning', high: 'danger' } as const
const RANK = { high: 0, medium: 1, low: 2 }

export default function ERP39CustomerSuccess() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [open, setOpen] = useState<string>()
  const tickets = Object.values(data.tickets)
    .filter((x) => x.customerId)
    .map((x) => ({ x, priority: ticketPriority(data, x, now) }))
    .sort((a, b) => Number(a.x.status === 'resolved' || a.x.status === 'closed') - Number(b.x.status === 'resolved' || b.x.status === 'closed') || RANK[a.priority] - RANK[b.priority] || (a.x.dueAt ?? '').localeCompare(b.x.dueAt ?? ''))
  const ndrs = ndrFollowUps(data, now)
  const accounts = Object.values(data.customers).filter((c) => c.status === 'live')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp39.title')} subtitle={t('erp39.subtitle', { count: tickets.filter((x) => x.x.status !== 'resolved' && x.x.status !== 'closed').length })} className="mb-0" />

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp39.queue')}>
        <h2 className="flex items-center gap-2 px-4 pt-4 font-heading text-section font-semibold">
          {t('erp39.queue')} <SimulatedTag />
        </h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="tickets">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp39.col.ticket')}</th>
              <th>{t('erp39.col.customer')}</th>
              <th>{t('erp39.col.category')}</th>
              <th>{t('erp39.col.priority')}</th>
              <th>{t('erp39.col.sla')}</th>
              <th>{t('erp39.col.owner')}</th>
              <th>{t('erp39.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(({ x, priority }) => {
              const left = x.dueAt ? minutesBetween(now, x.dueAt) : undefined
              const done = x.status === 'resolved' || x.status === 'closed'
              return [
                <tr key={x.id} className="border-b last:border-0" aria-label={x.id}>
                  <td className="px-4 py-2">
                    <button type="button" className="tabular font-medium text-primary hover:underline" onClick={() => setOpen(open === x.id ? undefined : x.id)}>
                      {x.id}
                    </button>
                    <span className="block text-caption text-muted-foreground">{x.subject}</span>
                  </td>
                  <td>{data.customers[x.customerId!]?.shortName}</td>
                  <td>{t(`erp39.cat.${x.category}`, { defaultValue: x.category })}</td>
                  <td>
                    <Chip tone={PRIORITY_TONE[priority]}>{t(`erp39.priority.${priority}`)}</Chip>
                  </td>
                  <td className={cn('tabular', !done && left !== undefined && left < 0 && 'font-semibold text-status-danger')}>{done || left === undefined ? '—' : left < 0 ? t('erp39.overdue', { d: formatDuration(-left) }) : t('erp39.left', { d: formatDuration(left) })}</td>
                  <td>{x.ownerId ? data.staff[x.ownerId]?.name : '—'}</td>
                  <td>
                    <Chip tone={done ? 'success' : x.status === 'inProgress' || x.status === 'waiting' ? 'info' : 'warning'}>{t(`erp39.status.${x.status}`)}</Chip>
                  </td>
                </tr>,
                open === x.id ? <TicketThread key={`${x.id}-t`} x={x} /> : null,
              ]
            })}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp39.ndr')}>
          <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp39.ndr', { count: ndrs.length })}</h2>
          {ndrs.length === 0 ? (
            <p className="p-4 text-muted-foreground">{t('erp39.noNdr')}</p>
          ) : (
            <ul className="flex flex-col gap-1 p-4" data-testid="ndr-followup">
              {ndrs.map(({ ndr, dueAt }) => (
                <li key={ndr.id}>
                  <Link to={`/erp/shipments/${ndr.shipmentId}`} className="tabular text-primary hover:underline">
                    {ndr.shipmentId}
                  </Link>{' '}
                  · {data.customers[data.shipments[ndr.shipmentId].customerId].shortName} · {t(`ndr.reason.${ndr.reason}`)} · {t('erp39.dueWas', { at: formatDateTime(dueAt) })}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp39.health')}>
          <h2 className="flex items-center gap-2 px-4 pt-4 font-heading text-section font-semibold">
            {t('erp39.health')} <SimulatedTag />
          </h2>
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="account-health">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp39.col.customer')}</th>
                <th className="text-right">{t('erp39.col.nps')}</th>
                <th className="text-right">{t('erp39.col.onTime')}</th>
                <th className="text-right">{t('erp39.col.open')}</th>
                <th>{t('erp39.col.churn')}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((c) => {
                const risk = churnRisk(data, c.id, now)
                const onTime = accountStats(data, c.id, now).onTimePct
                const openTickets = Object.values(data.tickets).filter((x) => x.customerId === c.id && x.status !== 'resolved' && x.status !== 'closed').length
                return (
                  <tr key={c.id} className="border-b last:border-0" aria-label={c.shortName}>
                    <td className="px-4 py-2">
                      <Link to={`/erp/sales/accounts?id=${c.id}`} className="text-primary hover:underline">
                        {c.shortName}
                      </Link>
                    </td>
                    <td className={cn('tabular text-right', (c.nps ?? 100) < 45 && 'text-status-danger')}>{c.nps ?? '—'}</td>
                    <td className="tabular text-right">{onTime === undefined ? '—' : `${onTime}%`}</td>
                    <td className="tabular text-right">{openTickets}</td>
                    <td>
                      <Chip tone={RISK_TONE[risk.level]}>{t(`erp28.risk.${risk.level}`)}</Chip>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}

function TicketThread({ x }: { x: Ticket }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const [text, setText] = useState('')
  const who = (id: string) => data.staff[id]?.name ?? data.customerUsers[id]?.name ?? id
  const send = (resolve: boolean) => {
    useDemoStore.getState().replyTicket(x.id, text, resolve, user.id)
    setText('')
    toast.success(t(resolve ? 'erp39.resolved' : 'erp39.replied'))
  }
  return (
    <tr className="border-b bg-muted/40">
      <td colSpan={7} className="px-4 py-3">
        <ol className="flex flex-col gap-1" data-testid="thread">
          {x.thread.map((m, i) => (
            <li key={i}>
              <span className="text-caption text-muted-foreground">
                {formatDateTime(m.at)} · {who(m.by)}
              </span>
              <span className="block">{m.text}</span>
            </li>
          ))}
        </ol>
        {x.status !== 'resolved' && x.status !== 'closed' && (
          <div className="mt-2 flex flex-wrap gap-2">
            <Input aria-label={t('erp39.reply')} placeholder={t('erp39.reply')} value={text} onChange={(e) => setText(e.target.value)} className="min-w-72 flex-1" />
            <Button variant="outline" disabled={!text.trim()} onClick={() => send(false)}>
              {t('erp39.send')}
            </Button>
            <Button disabled={!text.trim()} onClick={() => send(true)}>
              {t('erp39.sendResolve')}
            </Button>
          </div>
        )}
      </td>
    </tr>
  )
}
