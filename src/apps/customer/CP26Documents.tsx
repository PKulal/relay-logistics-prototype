/**
 * CP-26 Document centre — docs/01-customer-portal.md. Source §7.2 (Document
 * Centre: LR, label, e-way bill, invoices, e-POD, GRN, photos; one ZIP per
 * shipment or per month). SIMULATED: the downloads are text stand-ins.
 */
import { Download, FileArchive, FileText, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { DOC_TYPES, documentRows, months, typesFor, type DocRow, type DocType } from '@shared/engines/documents'
import { useData } from '@shared/hooks/useDemo'
import { formatDate } from '@shared/lib/format'
import { makeZip, saveBlob } from '@shared/sim/zip'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { downloadDocuments } from './shipmentFiles'
import { useCustomerSession } from './useCustomerSession'

const LIMIT = 150

export default function CP26Documents() {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const all = documentRows(data, customer.id, user.role)
  const allowed = typesFor(user.role)
  const [types, setTypes] = useState<DocType[]>(allowed)
  const [month, setMonth] = useState('')
  const [q, setQ] = useState('')
  const rows = all.filter((r) => types.includes(r.type) && (!month || r.date.startsWith(month)) && (!q.trim() || `${r.lr ?? ''} ${r.ref}`.toLowerCase().includes(q.toLowerCase())))
  const name = (r: DocRow) => t(r.nameKey)
  const file = (r: DocRow) => ({ name: `${r.lr ?? r.ref.replaceAll('/', '-')}/${name(r)}.txt`, content: [name(r), r.ref, r.lr ?? '', formatDate(r.date), t('cp17.simulatedDoc')].filter(Boolean).join('\n') })
  const lrOnly = q.trim() ? Object.values(data.shipments).find((s) => s.customerId === customer.id && s.id.toLowerCase() === q.trim().toLowerCase()) : undefined

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('cp26.title')}
        subtitle={t('cp26.subtitle', { count: all.length })}
        actions={
          <div className="flex flex-wrap gap-2">
            {lrOnly && (
              <Button variant="outline" onClick={() => downloadDocuments(data, [lrOnly], t)}>
                <FileArchive /> {t('cp26.zipShipment', { lr: lrOnly.id })}
              </Button>
            )}
            <Button disabled={!month || rows.length === 0} onClick={() => saveBlob(makeZip(rows.map(file)), `documents-${month}.zip`)}>
              <FileArchive /> {t('cp26.zipMonth')}
            </Button>
          </div>
        }
        className="mb-0"
      />
      <section className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4 shadow-card" aria-label={t('cp26.filters')}>
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="mb-1 text-caption font-medium">{t('cp26.type')}</legend>
          {DOC_TYPES.filter((x) => allowed.includes(x)).map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={types.includes(x)}
              onClick={() => setTypes(types.includes(x) ? types.filter((y) => y !== x) : [...types, x])}
              className={cn('rounded-full border px-3 py-1 text-caption font-medium', types.includes(x) ? 'border-primary bg-primary-soft text-primary' : 'bg-background')}
            >
              {t(`cp26.t.${x}`)}
            </button>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1">
          <span className="text-caption font-medium">{t('cp26.month')}</span>
          <NativeSelect value={month} onChange={(e) => setMonth(e.target.value)} className="w-40">
            <option value="">{t('cp26.allMonths')}</option>
            {months(all).map((m) => (
              <option key={m} value={m}>
                {formatDate(`${m}-01`).slice(3)}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="relative flex flex-col gap-1">
          <span className="text-caption font-medium">{t('cp26.search')}</span>
          <Search className="pointer-events-none absolute bottom-2.5 left-3 size-4 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="LGS-DEL-000769" className="w-56 pl-9" />
        </label>
        <SimulatedTag />
      </section>
      {rows.length === 0 ? (
        <EmptyState icon={FileText} title={t('cp26.empty')} body={t('cp26.emptyBody')} />
      ) : (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="documents">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('cp26.col.name')}</th>
                <th>{t('cp26.col.type')}</th>
                <th>{t('cp26.col.lr')}</th>
                <th>{t('cp26.col.date')}</th>
                <th>{t('cp26.col.size')}</th>
                <th className="sr-only">{t('cp26.col.download')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, LIMIT).map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-1.5">
                    {name(r)}
                    <span className="tabular block text-caption text-muted-foreground">
                      {r.ref}
                      {r.count ? ` · ${r.count}` : ''}
                    </span>
                  </td>
                  <td>{t(`cp26.t.${r.type}`)}</td>
                  <td className="tabular">
                    {r.lr ? (
                      <Link to={`/customer/shipments/${r.lr}`} className="text-primary hover:underline">
                        {r.lr}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="tabular whitespace-nowrap">{formatDate(r.date)}</td>
                  <td className="tabular text-caption">{r.kb >= 1024 ? `${(r.kb / 1024).toFixed(1)} MB` : `${r.kb} KB`}</td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" aria-label={t('cp26.download', { name: name(r) })} onClick={() => saveBlob(new Blob([file(r).content], { type: 'text/plain' }), file(r).name.replaceAll('/', '_'))}>
                      <Download />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-3 text-caption text-muted-foreground">{t('cp26.showing', { shown: Math.min(LIMIT, rows.length), total: rows.length })}</p>
        </section>
      )}
    </div>
  )
}
