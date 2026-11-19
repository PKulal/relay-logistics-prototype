/**
 * CP-19 Exception queue — docs/01-customer-portal.md.
 * Source §7.2 "Exception Queue: shipments on hold needing customer input, NDR
 * actions, weight disputes, claims"; §10. Finance users see weight disputes and
 * claims only.
 */
import { ArrowRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { exceptionQueue, inTab, type QueueTab } from '@shared/engines/customerExceptions'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDateTime, formatINR } from '@shared/lib/format'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { PageHeader } from '@shared/ui/Page'
import { SlaTimer } from '@shared/ui/SlaTimer'
import { Chip } from '@shared/ui/StatusChip'
import { useCustomerSession } from './useCustomerSession'

const ALL_TABS: QueueTab[] = ['action', 'ndr', 'weight', 'hold', 'claims']

export default function CP19Exceptions() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [params] = useSearchParams()
  const tabs = user.role === 'finance' ? (['weight', 'claims'] as QueueTab[]) : ALL_TABS
  const [tab, setTab] = useState<QueueTab>(tabs[0])
  const rows = useMemo(() => exceptionQueue(data, customer.id, now), [data, customer.id, now])

  // From the dashboard / notifications: ?lr=…&screen=CP-20 opens the matching screen
  const lr = params.get('lr')
  if (lr && params.get('screen') === 'CP-20') return <Navigate to={`/customer/exceptions/weight/${lr}`} replace />
  if (lr && params.get('screen') === 'CP-21') return <Navigate to={`/customer/exceptions/ndr/${lr}`} replace />

  const shown = inTab(rows, tab)
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('cp19.title')} subtitle={t('cp19.subtitle', { count: inTab(rows, 'action').length })} className="mb-0" />
      <div role="tablist" aria-label={t('cp19.title')} className="flex flex-wrap gap-2">
        {tabs.map((k) => (
          <Button key={k} role="tab" aria-selected={tab === k} size="sm" variant={tab === k ? 'default' : 'outline'} onClick={() => setTab(k)}>
            {t(`cp19.tab.${k}`)} <span className="tabular rounded-full bg-black/10 px-1.5 text-caption">{inTab(rows, k).length}</span>
          </Button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title={t('cp19.empty')} body={t('cp19.emptyBody')} className="rounded-xl border bg-card" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table" data-testid="queue">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('cp19.col.lr')}</th>
                <th>{t('cp19.col.type')}</th>
                <th>{t('cp19.col.raised')}</th>
                <th>{t('cp19.col.details')}</th>
                <th>{t('cp19.col.respondBy')}</th>
                <th className="pr-4" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.key} className="border-b last:border-0" aria-label={`${r.shipmentId} ${t(`cp19.type.${r.type}`)}`}>
                  <td className="px-4 py-2">
                    <Link to={`/customer/shipments/${r.shipmentId}`} className="tabular font-medium text-primary hover:underline">
                      {r.shipmentId}
                    </Link>
                  </td>
                  <td>
                    <Chip tone={r.type === 'weightDisputed' ? 'info' : r.tab === 'hold' ? 'neutral' : 'warning'}>{t(`cp19.type.${r.type}`)}</Chip>
                  </td>
                  <td className="tabular">{formatDateTime(r.raisedAt)}</td>
                  <td>{r.amount !== undefined ? t('cp19.amount', { amount: formatINR(r.amount) }) : r.type === 'ndr' && r.details ? t(`ndr.reason.${r.details}`, { defaultValue: r.details }) : (r.details ?? '—')}</td>
                  <td>{r.dueAt ? <SlaTimer dueAt={r.dueAt} totalMinutes={r.totalMinutes} amberPct={Math.round((120 / (r.totalMinutes ?? 120)) * 100)} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="pr-4 text-right">
                    <Button size="sm" variant={r.dueAt ? 'default' : 'outline'} onClick={() => navigate(r.to)}>
                      {r.dueAt ? t('cp19.takeAction') : t('cp19.view')} <ArrowRight />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
