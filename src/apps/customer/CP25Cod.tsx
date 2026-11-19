/**
 * CP-25 COD remittance — docs/01-customer-portal.md. Source §9 COD Handling
 * (partner deposits within 24 h → remitted to the shipper at T+2; shortages
 * deducted from the partner with evidence), §7.2 COD remittance report.
 */
import { FileSpreadsheet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { codSummary } from '@shared/engines/receivables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR } from '@shared/lib/format'
import type { CodRecord } from '@shared/types'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { KpiTile } from '@shared/ui/KpiTile'
import { REMITTANCE_TONE } from '@shared/ui/moneyTones'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { exportCodReport } from './moneyFiles'
import { useCustomerSession } from './useCustomerSession'

const REC_TONE: Record<CodRecord['status'], Tone> = { pending: 'neutral', collected: 'warning', deposited: 'info', remitted: 'success' }

export default function CP25Cod() {
  const { t } = useTranslation()
  const { customer } = useCustomerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [params, setParams] = useSearchParams()
  const sum = codSummary(data, customer.id, now)
  const records = Object.values(data.codRecords).filter((r) => r.customerId === customer.id)
  const batches = Object.values(data.codRemittances)
    .filter((b) => b.customerId === customer.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  const open = data.codRemittances[params.get('remittance') ?? '']

  if (open && open.customerId === customer.id) {
    const recs = open.recordIds.map((id) => data.codRecords[id])
    return (
      <div className="flex flex-col gap-4">
        <button type="button" onClick={() => setParams({})} className="w-fit text-caption font-medium text-primary hover:underline">
          ← {t('cp25.back')}
        </button>
        <PageHeader
          title={open.id}
          subtitle={t('cp25.detailSub', { date: formatDate(open.date), net: formatINR(open.net), utr: open.utr ?? '—' })}
          actions={
            <Button variant="outline" onClick={() => exportCodReport(recs, t, open.id)}>
              <FileSpreadsheet /> {t('cp25.report')}
            </Button>
          }
          className="mb-0"
        />
        <RecordTable records={recs} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('cp25.title')}
        subtitle={t('cp25.subtitle')}
        actions={
          records.length > 0 && (
            <Button variant="outline" onClick={() => exportCodReport(records, t, `cod-remittance-${customer.shortName.split(' ')[0].toLowerCase()}`)}>
              <FileSpreadsheet /> {t('cp25.report')}
            </Button>
          )
        }
        className="mb-0"
      />
      <div className="grid gap-4 sm:grid-cols-3" data-testid="cod-summary">
        <KpiTile label={t('cp25.pending')} value={formatINR(sum.pending)} />
        <KpiTile label={t('cp25.next')} value={sum.nextRemittance ? formatDate(sum.nextRemittance) : '—'} hint={t('cp25.rule')} />
        <KpiTile label={t('cp25.remitted')} value={formatINR(sum.remittedThisMonth)} />
      </div>
      {batches.length === 0 ? (
        <EmptyState title={t('cp25.empty')} className="rounded-xl border bg-card" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="remittances">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('cp25.col.id')}</th>
                <th>{t('cp25.col.date')}</th>
                <th className="text-right">{t('cp25.col.shipments')}</th>
                <th className="text-right">{t('cp25.col.amounts')}</th>
                <th>{t('cp25.col.utr')}</th>
                <th>{t('cp25.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b last:border-0" aria-label={b.id}>
                  <td className="px-4 py-2">
                    <button type="button" className="tabular font-medium text-primary hover:underline" onClick={() => setParams({ remittance: b.id })}>
                      {b.id}
                    </button>
                  </td>
                  <td className="tabular">{formatDate(b.date)}</td>
                  <td className="tabular text-right">{b.recordIds.length}</td>
                  <td className="tabular text-right">
                    {formatINR(b.gross)} / {formatINR(b.deductions)} / <span className="font-semibold">{formatINR(b.net)}</span>
                  </td>
                  <td className="tabular">{b.utr ?? '—'}</td>
                  <td>
                    <Chip tone={REMITTANCE_TONE[b.status]}>{t(`cp25.status.${b.status}`)}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-caption text-muted-foreground">{t('cp25.shortageRule')}</p>
    </div>
  )
}

function RecordTable({ records }: { records: CodRecord[] }) {
  const { t } = useTranslation()
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
      <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="cod-records">
        <thead>
          <tr className="border-b text-left text-caption text-muted-foreground">
            <th className="px-4 py-2">{t('cp25.col.lr')}</th>
            <th>{t('cp25.col.delivered')}</th>
            <th className="text-right">{t('cp25.col.cod')}</th>
            <th>{t('cp25.col.status')}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b last:border-0" aria-label={r.shipmentId}>
              <td className="tabular px-4 py-2">{r.shipmentId}</td>
              <td className="tabular">{r.deliveredAt ? formatDateTime(r.deliveredAt) : '—'}</td>
              <td className="tabular text-right">{formatINR(r.amount)}</td>
              <td>
                <Chip tone={REC_TONE[r.status]}>{t(`cp25.rec.${r.status}`)}</Chip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
