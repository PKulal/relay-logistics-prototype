/**
 * ERP-41 Compliance & Legal: e-way bill monitor and registers —
 * docs/04-erp-control-tower.md. Source §11 Dept 11 (contracts, e-way bill
 * monitor, DPDP register, statutory calendar; expiry alerts), §14 (DPDP Act:
 * consent records). Extend / Part B are SIMULATED NIC calls.
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { contractsExpiring, ewbMonitor } from '@shared/engines/departments'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatDuration } from '@shared/lib/format'
import { istDate } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

export default function ERP41Compliance() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const today = istDate(now)
  const ewbs = ewbMonitor(data, now)
  const expiring = contractsExpiring(data, now)
  const statutory = [...data.compliance.statutory].sort((a, b) => a.due.localeCompare(b.due))
  const customerConsents = Object.values(data.customers).filter((c) => c.onboarding?.privacyConsent).length
  // A partner application can't be submitted without the consent (PP-04)
  const partnerConsents = Object.keys(data.applications).length
  const requests = Object.values(data.dpdpRequests).sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.dueAt.localeCompare(b.dueAt))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp41.title')} subtitle={t('erp41.subtitle')} className="mb-0" />

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp41.ewb')}>
        <h2 className="flex items-center gap-2 px-4 pt-4 font-heading text-section font-semibold">
          {t('erp41.ewb')} <SimulatedTag />
        </h2>
        {ewbs.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t('erp41.noEwb')}</p>
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="ewbs">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp41.col.ewb')}</th>
                <th>{t('erp41.col.lr')}</th>
                <th>{t('erp41.col.validity')}</th>
                <th>{t('erp41.col.partB')}</th>
                <th>{t('erp41.col.action')}</th>
              </tr>
            </thead>
            <tbody>
              {ewbs.map(({ shipment: s, hoursLeft }) => (
                <tr key={s.id} className="border-b last:border-0" aria-label={s.id}>
                  <td className="tabular px-4 py-2">{s.ewb!.no}</td>
                  <td>
                    <Link to={`/erp/shipments/${s.id}`} className="tabular text-primary hover:underline">
                      {s.id}
                    </Link>
                  </td>
                  <td className={cn('tabular', hoursLeft < 24 && 'font-semibold text-status-danger')}>{hoursLeft < 0 ? t('erp41.expired') : t('erp41.left', { d: formatDuration(hoursLeft * 60), date: formatDate(s.ewb!.validTill) })}</td>
                  <td>{s.ewb!.partBUpdated ? <Chip tone="success">✓</Chip> : <Chip tone="neutral">{t('erp41.pending')}</Chip>}</td>
                  <td className="py-2">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => (useDemoStore.getState().extendEwayBill(s.id, user.id), toast.success(t('erp41.extended', { lr: s.id })))}>
                        {t('erp41.extend')}
                      </Button>
                      {!s.ewb!.partBUpdated && (
                        <Button size="sm" variant="outline" onClick={() => (useDemoStore.getState().updatePartB(s.id, user.id), toast.success(t('erp41.partBDone', { lr: s.id })))}>
                          {t('erp41.partB')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="px-4 pb-3 text-caption text-muted-foreground">{t('erp41.ewbRule')}</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp41.calendar')}>
          <h2 className="mb-2 font-heading text-section font-semibold">{t('erp41.calendar')}</h2>
          <ul className="flex flex-col gap-1" data-testid="statutory">
            {statutory.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <span>
                  {s.title} <Chip tone="neutral">{t(`erp41.kind.${s.kind}`)}</Chip>
                </span>
                <span className={cn('tabular', s.due <= today ? 'font-semibold text-status-danger' : '')}>{formatDate(s.due)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp41.contracts')}>
          <h2 className="mb-2 font-heading text-section font-semibold">{t('erp41.contracts')}</h2>
          {expiring.length === 0 ? (
            <p className="text-muted-foreground">{t('erp41.noContracts')}</p>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="contracts">
              {expiring.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2" aria-label={c.party}>
                  <span>
                    {c.party} · {c.title} <Chip tone="neutral">{t(`erp41.party.${c.partyType}`)}</Chip>
                  </span>
                  <span className="tabular font-medium text-status-warning">{formatDate(c.end)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp41.dpdp')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp41.dpdp')}</h2>
        <p className="px-4 text-caption text-muted-foreground" data-testid="consents">
          {t('erp41.consents', { customers: customerConsents, partners: partnerConsents })}
        </p>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="dpdp">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp41.col.request')}</th>
              <th>{t('erp41.col.party')}</th>
              <th>{t('erp41.col.kind')}</th>
              <th>{t('erp41.col.due')}</th>
              <th>{t('erp41.col.status')}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b last:border-0" aria-label={r.id}>
                <td className="tabular px-4 py-2">
                  {r.id}
                  <span className="block text-caption text-muted-foreground">{formatDateTime(r.receivedAt)}</span>
                </td>
                <td>{r.party}</td>
                <td>{t(`erp41.req.${r.kind}`)}</td>
                <td className="tabular">{formatDate(r.dueAt)}</td>
                <td className="py-2">
                  {r.status === 'done' ? (
                    <Chip tone="success">{t('erp41.done', { name: data.staff[r.doneBy!]?.name ?? '' })}</Chip>
                  ) : (
                    <Button size="sm" onClick={() => (useDemoStore.getState().closeDpdpRequest(r.id, user.id), toast.success(t('erp41.closed', { id: r.id })))}>
                      {t('erp41.markDone')}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 pb-3 text-caption text-muted-foreground">{t('erp41.breach')}</p>
      </section>
    </div>
  )
}
