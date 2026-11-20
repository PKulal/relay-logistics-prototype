/**
 * ERP-35 Accounting (light) — docs/04-erp-control-tower.md. Source §9
 * (Accounting), §11 Dept 9 (cash forecast). Read-only views; GL posting,
 * GSTR-2B and the cash forecast are SIMULATED. Export: Excel.
 */
import { FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import * as XLSX from 'xlsx'
import { cn } from '@/shared/lib/utils'
import { cashForecast, glPostings, itcReconciliation, shipmentPnlRows } from '@shared/engines/accounting'
import { laneRows } from '@shared/engines/pricingMonitor'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDayShort, formatINR } from '@shared/lib/format'
import { Button } from '@shared/ui/button'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'

type Tab = 'lanes' | 'shipments'

export default function ERP35Accounting() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [tab, setTab] = useState<Tab>('lanes')
  const lanes = laneRows(data, now)
  const ships = shipmentPnlRows(data)
  const gl = glPostings(data, now)
  const itc = itcReconciliation(data)
  const cash = cashForecast(data, now)

  const exportXlsx = () => {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(lanes.map((r) => ({ lane: r.key, shipments: r.shipments.length, revenue: r.revenue, legCosts: r.legCosts, insurance: r.insurance, claims: r.claims, margin: r.margin, marginPct: r.marginPct }))), 'Lane P&L')
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(ships.map((r) => ({ lr: r.shipment.id, revenue: r.revenue, legCosts: r.legCosts, claims: r.claims, margin: r.margin, marginPct: r.marginPct }))), 'Shipment P&L')
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(itc), 'GST ITC')
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(cash), 'Cash forecast')
    XLSX.writeFile(book, `accounting-${now.slice(0, 10)}.xlsx`)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('erp35.title')}
        subtitle={t('erp35.subtitle')}
        actions={
          <Button variant="outline" onClick={exportXlsx}>
            <FileSpreadsheet /> {t('erp35.export')}
          </Button>
        }
        className="mb-0"
      />

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp35.pnl')}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
          <h2 className="font-heading text-section font-semibold">{t('erp35.pnl')}</h2>
          <div role="tablist" aria-label={t('erp35.pnl')} className="flex rounded-lg border p-0.5">
            {(['lanes', 'shipments'] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('rounded-md px-3 py-1 text-caption font-medium', tab === k && 'bg-primary text-primary-foreground')}>
                {t(`erp35.tab.${k}`)}
              </button>
            ))}
          </div>
        </div>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="pnl">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t(tab === 'lanes' ? 'erp35.col.lane' : 'erp35.col.lr')}</th>
              <th>{t('erp35.col.revenue')}</th>
              <th>{t('erp35.col.legCosts')}</th>
              <th>{t('erp35.col.claims')}</th>
              <th>{t('erp35.col.margin')}</th>
            </tr>
          </thead>
          <tbody>
            {(tab === 'lanes' ? lanes.map((r) => ({ ...r, link: undefined as string | undefined })) : ships.map((r) => ({ ...r, key: r.shipment.id, link: `/erp/shipments/${r.shipment.id}` as string | undefined }))).slice(0, 20).map((r) => (
              <tr key={r.key} className="border-b last:border-0">
                <td className="px-4 py-1.5">
                  {r.link ? (
                    <Link to={r.link} className="tabular text-primary hover:underline">
                      {r.key}
                    </Link>
                  ) : (
                    r.key
                  )}
                </td>
                <td className="tabular">{formatINR(r.revenue)}</td>
                <td className="tabular">{formatINR(r.legCosts)}</td>
                <td className="tabular">{formatINR(r.claims)}</td>
                <td className={cn('tabular font-medium', r.marginPct < 0 ? 'text-status-danger' : r.marginPct < data.settings.targetMarginPct ? 'text-status-warning' : 'text-status-success')}>
                  {formatINR(r.margin)} ({r.marginPct}%)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp35.gl')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            {t('erp35.gl')} <SimulatedTag />
          </h2>
          <ul className="flex flex-col gap-1" data-testid="gl">
            {gl.map((g) => (
              <li key={g.date} className="flex items-center justify-between gap-2">
                <span className="tabular">{formatDate(g.date)}</span>
                <span className="tabular text-caption text-muted-foreground">{t('erp35.entries', { count: g.entries })}</span>
                <Chip tone={g.status === 'posted' ? 'success' : 'info'}>{t(`erp35.gs.${g.status}`)}</Chip>
              </li>
            ))}
          </ul>
        </section>

        <section className="overflow-x-auto rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp35.itc')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            {t('erp35.itc')} <SimulatedTag />
          </h2>
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="itc">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="py-2">{t('erp35.col.month')}</th>
                <th>{t('erp35.col.invoices')}</th>
                <th>{t('erp35.col.books')}</th>
                <th>{t('erp35.col.gstr2b')}</th>
                <th>{t('erp35.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {itc.map((r) => (
                <tr key={r.month} className="border-b last:border-0">
                  <td className="tabular py-1.5">{formatDate(`${r.month}-01`).slice(3)}</td>
                  <td className="tabular">{r.invoices}</td>
                  <td className="tabular">{formatINR(r.books)}</td>
                  <td className="tabular">{formatINR(r.gstr2b)}</td>
                  <td>{r.diff === 0 ? <Chip tone="success">{t('erp35.matched')}</Chip> : <Chip tone="warning">{t('erp35.diff', { amount: formatINR(r.diff) })}</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp35.cash')}>
        <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
          {t('erp35.cash')} <SimulatedTag />
        </h2>
        <div className="h-64" data-testid="cash">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cash.map((c) => ({ day: formatDayShort(c.date), in: c.inflow, out: -c.outflow, balance: c.balance }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} interval={3} />
              <YAxis width={70} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `₹${Math.round(v / 1000)}k`} />
              <Tooltip formatter={(v) => formatINR(Number(v))} />
              <Legend />
              <Line dataKey="in" name={t('erp35.in')} stroke="var(--status-success, #16a34a)" dot={false} isAnimationActive={false} />
              <Line dataKey="out" name={t('erp35.out')} stroke="var(--status-danger, #dc2626)" dot={false} isAnimationActive={false} />
              <Line dataKey="balance" name={t('erp35.balance')} stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-caption text-muted-foreground">{t('erp35.cashNote')}</p>
      </section>
    </div>
  )
}
