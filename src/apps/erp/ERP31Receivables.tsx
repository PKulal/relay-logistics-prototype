/**
 * ERP-31 tabs: invoice runs (source §9 Customer Invoicing: monthly consolidated
 * GST invoice, e-POD attached, e-invoice) and collections with AI priority and
 * ageing (§11 Dept 9). Credit hold is not in the client document.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { AGEING_BUCKETS, ageing, collectionsPriority, invoiceRunPreview, invoiceStatus, runPeriods } from '@shared/engines/receivables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Field } from '@shared/ui/FormField'
import { INVOICE_TONE } from '@shared/ui/moneyTones'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

export function InvoiceRuns() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const periods = runPeriods(data)
  const [period, setPeriod] = useState(periods[0] ?? '')
  const lines = period ? invoiceRunPreview(data, period) : []
  const [excluded, setExcluded] = useState<string[]>([])
  const [confirm, setConfirm] = useState(false)
  const chosen = lines.filter((l) => !excluded.includes(l.customerId))
  const total = chosen.reduce((s, l) => s + l.total, 0)
  const recent = Object.values(data.invoices)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 8)
  const generate = () => {
    const ids = useDemoStore.getState().generateInvoices(
      period,
      chosen.map((l) => l.customerId),
      user.id,
    )
    if (ids.length) toast.success(t('erp31.run.done', { count: ids.length, first: ids[0], last: ids.at(-1) }))
    setExcluded([])
  }
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('erp31.run.period')} htmlFor="run-period" className="w-48">
            <NativeSelect id="run-period" value={period} onChange={(e) => setPeriod(e.target.value)} disabled={!periods.length}>
              {periods.map((p) => (
                <option key={p} value={p}>
                  {formatDate(`${p}-01`).slice(3)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <p className="pb-2 text-muted-foreground">{t('erp31.run.customers', { count: lines.length })}</p>
        </div>
        {lines.length === 0 ? (
          <p className="text-muted-foreground">{t('erp31.run.empty')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="run-preview">
                <thead>
                  <tr className="border-b text-left text-caption text-muted-foreground">
                    <th className="w-8 py-2">
                      <span className="sr-only">{t('erp31.run.include')}</span>
                    </th>
                    <th>{t('erp31.run.customer')}</th>
                    <th className="text-right">{t('erp31.run.shipments')}</th>
                    <th className="text-right">{t('erp31.run.taxable')}</th>
                    <th className="text-right">{t('erp31.run.gst')}</th>
                    <th className="text-right">{t('erp31.run.total')}</th>
                    <th>{t('erp31.run.pods')}</th>
                    <th>{t('erp31.run.einvoice')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => {
                    const c = data.customers[l.customerId]
                    return (
                      <tr key={l.customerId} className="border-b last:border-0" aria-label={c.shortName}>
                        <td className="py-2">
                          <Checkbox aria-label={t('erp31.run.includeX', { name: c.shortName })} checked={!excluded.includes(l.customerId)} onCheckedChange={(v) => setExcluded(v === true ? excluded.filter((x) => x !== l.customerId) : [...excluded, l.customerId])} />
                        </td>
                        <td className="font-medium">{c.shortName}</td>
                        <td className="tabular text-right">{l.lrs.length}</td>
                        <td className="tabular text-right">{formatINR(l.taxable)}</td>
                        <td className="tabular text-right">{formatINR(l.gst)}</td>
                        <td className="tabular text-right font-semibold">{formatINR(l.total)}</td>
                        <td>{l.missingPods.length ? <Chip tone="danger">{t('erp31.run.missing', { count: l.missingPods.length })}</Chip> : <Chip tone="success">{t('erp31.run.allPods')}</Chip>}</td>
                        <td>
                          <Chip tone="info">{t('erp31.run.irn')}</Chip>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-3">
              <span className="tabular text-muted-foreground">{t('erp31.run.selected', { count: chosen.length, amount: formatINR(total) })}</span>
              <Button disabled={!chosen.length} onClick={() => setConfirm(true)}>
                {t('erp31.run.generate')}
              </Button>
            </div>
            <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t('erp31.run.confirm', { count: chosen.length })} body={t('erp31.run.confirmBody', { amount: formatINR(total) })} confirmLabel={t('erp31.run.generate')} onConfirm={generate} />
          </>
        )}
      </section>
      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp31.run.recent')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="recent-invoices">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('cp24.col.no')}</th>
              <th>{t('erp31.run.customer')}</th>
              <th>{t('cp24.col.date')}</th>
              <th className="text-right">{t('erp31.run.total')}</th>
              <th>{t('cp24.col.due')}</th>
              <th>{t('cp24.col.status')}</th>
              <th>{t('cp24.col.irn')}</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((i) => {
              const st = invoiceStatus(i, now)
              return (
                <tr key={i.id} className="border-b last:border-0" aria-label={i.id}>
                  <td className="tabular px-4 py-2 font-medium">{i.id}</td>
                  <td>{data.customers[i.customerId].shortName}</td>
                  <td className="tabular">{formatDate(i.date)}</td>
                  <td className="tabular text-right">{formatINR(i.total)}</td>
                  <td className="tabular">{formatDate(i.dueDate)}</td>
                  <td>
                    <Chip tone={INVOICE_TONE[st]}>{t(`cp24.status.${st}`)}</Chip>
                  </td>
                  <td className="tabular text-caption">{i.irn ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

export function Collections() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const ranked = collectionsPriority(data, now)
  const rows = ageing(data, now)
  const remind = (customerId: string, channel: 'email' | 'whatsapp') => {
    useDemoStore.getState().sendReminder(customerId, channel, user.id)
    toast.success(t('erp31.col.sent', { name: data.customers[customerId].shortName, channel: t(`erp31.col.ch.${channel}`) }))
  }
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 font-heading text-section font-semibold">
          {t('erp31.col.priority')} <SimulatedTag />
        </h2>
        {ranked.length === 0 ? (
          <p className="rounded-xl border bg-card p-5 text-muted-foreground">{t('erp31.col.none')}</p>
        ) : (
          <ol className="flex flex-col gap-2" data-testid="priority">
            {ranked.map((p, n) => {
              const c = data.customers[p.customerId]
              return (
                <li key={p.customerId} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-card" aria-label={c.shortName}>
                  <span className="tabular flex size-8 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">{n + 1}</span>
                  <div className="min-w-48 flex-1">
                    <p className="font-semibold">
                      {c.shortName} · <span className="tabular">{formatINR(p.amount)}</span>
                    </p>
                    <p className={cn('text-caption', p.daysOverdue ? 'font-medium text-status-danger' : 'text-muted-foreground')}>
                      {p.daysOverdue ? t('erp31.col.overdueDays', { count: p.daysOverdue }) : t('erp31.col.dueIn', { count: p.dueInDays })}
                      {' · '}
                      {p.lastReminder ? t('erp31.col.lastReminder', { at: formatDateTime(p.lastReminder) }) : t('erp31.col.noReminder')}
                    </p>
                    {p.reasons.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.reasons.map((r) => (
                          <Chip key={r} tone={r === 'overdue' || r === 'nearLimit' ? 'danger' : 'warning'}>
                            {t(`erp31.col.reason.${r}`)}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => remind(p.customerId, 'email')}>
                      {t('erp31.col.remindEmail')}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => remind(p.customerId, 'whatsapp')}>
                      {t('erp31.col.remindWhatsapp')}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp31.col.ageing')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="ageing">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp31.run.customer')}</th>
              {AGEING_BUCKETS.map((b) => (
                <th key={b} className="text-right">
                  {t('erp31.col.days', { range: b })}
                </th>
              ))}
              <th className="text-right">{t('erp31.run.total')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.customerId} className="border-b last:border-0" aria-label={data.customers[r.customerId].shortName}>
                <td className="px-4 py-2 font-medium">{data.customers[r.customerId].shortName}</td>
                {AGEING_BUCKETS.map((b) => (
                  <td key={b} className={cn('tabular text-right', r[b] > 0 && b !== '0-30' && 'font-semibold text-status-danger')}>
                    {r[b] ? formatINR(r[b]) : '—'}
                  </td>
                ))}
                <td className="tabular text-right font-semibold">{formatINR(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
