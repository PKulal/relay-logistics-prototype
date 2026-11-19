/**
 * PP-25 Finance panel (daily reconciliation) — docs/02-partner-portal.md.
 * Source §5.1 Daily Reconciliation: legs completed, COD collected, deductions
 * with evidence, payout status. "Raise query" is not in the client document;
 * mismatches are disputed per line in PP-26.
 */
import { ChevronDown, ChevronRight, FileSpreadsheet } from 'lucide-react'
import { Fragment, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { dailyReconciliation, verifiedKg, type DayPayoutStatus, type DayRow } from '@shared/engines/payables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatINR, formatKg, formatTime } from '@shared/lib/format'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { DeductionLink } from './financeBits'
import { usePartnerSession } from './usePartnerSession'

const DAY_TONE: Record<DayPayoutStatus, Tone> = { pendingMatch: 'warning', matched: 'info', inBatch: 'info', paid: 'success' }

export default function PP25Daily() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const rows = dailyReconciliation(data, partner.id, now)
  const [open, setOpen] = useState<string>()

  const exportRows = () => {
    const sheet = rows.flatMap((r) =>
      r.legs.map((l) => ({
        [t('pp25.col.date')]: formatDate(r.date),
        [t('pp25.leg.job')]: l.id,
        [t('pp25.leg.lr')]: l.shipmentId,
        [t('pp25.leg.done')]: formatTime(l.doneAt),
        [t('pp25.leg.weight')]: verifiedKg(data, data.legs[l.id]),
        [t('pp25.leg.earning')]: l.earning,
        [t('pp25.col.status')]: t(`pp25.status.${l.status}`),
      })),
    )
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(sheet), 'Legs')
    XLSX.writeFile(book, `daily-reconciliation-${partner.shortName.split(' ')[0].toLowerCase()}.xlsx`)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('pp25.title')}
        subtitle={t('pp25.subtitle')}
        actions={
          rows.length > 0 && (
            <Button variant="outline" onClick={exportRows}>
              <FileSpreadsheet /> {t('pp25.export')}
            </Button>
          )
        }
        className="mb-0"
      />
      {rows.length === 0 ? (
        <EmptyState title={t('pp25.empty')} className="rounded-xl border bg-card" />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="daily">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp25.col.date')}</th>
                <th className="text-right">{t('pp25.col.legs')}</th>
                <th className="text-right">{t('pp25.col.earnings')}</th>
                <th>{t('pp25.col.deductions')}</th>
                <th className="text-right">{t('pp25.col.cod')}</th>
                <th className="text-right">{t('pp25.col.net')}</th>
                <th>{t('pp25.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.date}>
                  <tr className="border-b last:border-0" aria-label={formatDate(r.date)}>
                    <td className="px-4 py-2">
                      <button type="button" className="tabular inline-flex items-center gap-1 font-medium text-primary hover:underline disabled:text-foreground disabled:no-underline" disabled={!r.legs.length} aria-expanded={open === r.date} onClick={() => setOpen(open === r.date ? undefined : r.date)}>
                        {r.legs.length > 0 && (open === r.date ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />)}
                        {formatDate(r.date)}
                      </button>
                    </td>
                    <td className="tabular text-right">{r.legs.length}</td>
                    <td className="tabular text-right">{formatINR(r.earnings)}</td>
                    <td>
                      {r.deductions.length ? (
                        <ul className="flex flex-col">
                          {r.deductions.map((d, i) => (
                            <li key={i} className="tabular text-status-danger">
                              − {formatINR(d.amount)} <DeductionLink d={d} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="tabular text-right">
                      {formatINR(r.codCollected)} / {formatINR(r.codDeposited)}
                    </td>
                    <td className="tabular text-right font-semibold">{formatINR(r.net)}</td>
                    <td>
                      <Chip tone={DAY_TONE[r.status]}>{t(`pp25.status.${r.status}`)}</Chip>
                    </td>
                  </tr>
                  {open === r.date && <DayLegs row={r} />}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DayLegs({ row }: { row: DayRow }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  return (
    <tr className="border-b bg-muted/40">
      <td colSpan={7} className="px-4 py-3">
        <table className="w-full text-caption [&_td]:py-1 [&_td]:pr-3" data-testid="day-legs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th>{t('pp25.leg.job')}</th>
              <th>{t('pp25.leg.lr')}</th>
              <th>{t('pp25.leg.type')}</th>
              <th>{t('pp25.leg.done')}</th>
              <th className="text-right">{t('pp25.leg.weight')}</th>
              <th className="text-right">{t('pp25.leg.earning')}</th>
              <th>{t('pp25.leg.invoice')}</th>
            </tr>
          </thead>
          <tbody>
            {row.legs.map((l) => (
              <tr key={l.id} aria-label={l.id}>
                <td>
                  <Link to={`/partner/jobs/${l.id}`} className="tabular text-primary hover:underline">
                    {l.id}
                  </Link>
                </td>
                <td className="tabular">{l.shipmentId}</td>
                <td>{t(`legType.${l.type}`)}</td>
                <td className="tabular">{formatTime(l.doneAt)}</td>
                <td className="tabular text-right">{formatKg(verifiedKg(data, data.legs[l.id]))}</td>
                <td className="tabular text-right">{formatINR(l.earning)}</td>
                <td className="tabular">{l.invoiceId ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </td>
    </tr>
  )
}
