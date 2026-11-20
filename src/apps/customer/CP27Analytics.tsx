/**
 * CP-27 Analytics — docs/01-customer-portal.md. Source §7.2 (Analytics:
 * lane-wise transit, on-time, damage, cost per kg, CO2). Numbers are the
 * pre-computed history in the seed (spec prototype note); CO2 is an estimate.
 * Export: Excel, or PDF through the browser's print.
 */
import { BarChart3, FileSpreadsheet, Printer } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import * as XLSX from 'xlsx'
import { useData } from '@shared/hooks/useDemo'
import { formatWeek } from '@shared/lib/format'
import type { CustomerAnalytics } from '@shared/types'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { KpiTile } from '@shared/ui/KpiTile'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { useCustomerSession } from './useCustomerSession'

type Lane = CustomerAnalytics['lanes'][number]
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const r1 = (n: number) => Math.round(n * 10) / 10

export default function CP27Analytics() {
  const { t } = useTranslation()
  const { customer } = useCustomerSession()
  const a = useData((d) => d.customerAnalytics[customer.id])
  const [period, setPeriod] = useState<'30d' | 'quarter'>('quarter')
  const [service, setService] = useState('')
  const [state, setState] = useState('')
  const [lane, setLane] = useState('')

  if (!a) return <EmptyState icon={BarChart3} title={t('cp27.empty')} body={t('cp27.emptyBody')} />

  const weeks = period === '30d' ? a.weeks.slice(-4) : a.weeks
  const before = period === '30d' ? a.weeks.slice(-8, -4) : a.weeks.slice(0, 6)
  const label = (l: Lane) => `${l.origin} → ${l.dest}`
  const lanes = a.lanes.filter((l) => (!service || l.service === service) && (!state || l.destState === state) && (!lane || label(l) === lane))
  const damage = r1(avg(weeks.map((w) => w.damagePer1000)))
  const co2 = r1(avg(weeks.map((w) => w.co2PerShipment)))
  const trend = (now: number, prev: number) => (prev ? r1(now - prev) : 0)
  const share = period === '30d' ? 4 / 13 : 1

  const exportXlsx = () => {
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(lanes.map((l) => ({ [t('cp27.col.lane')]: label(l), [t('cp27.col.shipments')]: Math.round(l.shipments * share), [t('cp27.col.transit')]: l.avgTransit, [t('cp27.col.promised')]: l.promised, [t('cp27.col.onTime')]: l.onTimePct, [t('cp27.col.damage')]: l.damagePct, [t('cp27.col.cost')]: l.costPerKg, [t('cp27.col.co2')]: l.co2 }))), 'Lanes')
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(weeks.map((w) => ({ week: w.week, shipments: w.shipments, onTimePct: w.onTimePct, damagePer1000: w.damagePer1000, co2: w.co2PerShipment }))), 'Weeks')
    XLSX.writeFile(book, `analytics-${customer.shortName.split(' ')[0].toLowerCase()}-${period}.xlsx`)
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('cp27.title')}
        subtitle={t('cp27.subtitle')}
        actions={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={exportXlsx}>
              <FileSpreadsheet /> {t('cp27.excel')}
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> {t('cp27.pdf')}
            </Button>
          </div>
        }
        className="mb-0"
      />
      <section className="flex flex-wrap gap-3 rounded-xl border bg-card p-4 shadow-card print:hidden" aria-label={t('cp27.filters')}>
        {(
          [
            ['period', period, (v: string) => setPeriod(v as typeof period), [['30d', t('cp27.p.30d')], ['quarter', t('cp27.p.quarter')]]],
            ['service', service, setService, [['', t('cp27.all')], ...[...new Set(a.lanes.map((l) => l.service))].map((s) => [s, t(`service.${s}`)])]],
            ['state', state, setState, [['', t('cp27.all')], ...[...new Set(a.lanes.map((l) => l.destState))].map((s) => [s, s])]],
            ['lane', lane, setLane, [['', t('cp27.all')], ...a.lanes.map((l) => [label(l), label(l)])]],
          ] as [string, string, (v: string) => void, string[][]][]
        ).map(([k, v, set, opts]) => (
          <label key={k} className="flex flex-col gap-1">
            <span className="text-caption font-medium">{t(`cp27.f.${k}`)}</span>
            <NativeSelect value={v} onChange={(e) => set(e.target.value)} className="w-48">
              {opts.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </NativeSelect>
          </label>
        ))}
      </section>

      <div className="grid gap-3 sm:grid-cols-4" data-testid="analytics-kpis">
        <KpiTile label={t('cp27.k.onTime')} value={`${r1(avg(weeks.map((w) => w.onTimePct)))}%`} hint={t('cp27.vs', { d: trend(avg(weeks.map((w) => w.onTimePct)), avg(before.map((w) => w.onTimePct))) })} />
        <KpiTile label={t('cp27.k.shipments')} value={weeks.reduce((s, w) => s + w.shipments, 0).toLocaleString('en-IN')} />
        <KpiTile label={t('cp27.k.damage')} value={String(damage)} hint={t('cp27.per1000', { d: trend(damage, avg(before.map((w) => w.damagePer1000))) })} />
        <KpiTile label={t('cp27.k.co2')} value={`${co2} kg`} hint={t('cp27.co2Hint', { d: trend(co2, avg(before.map((w) => w.co2PerShipment))) })} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('cp27.onTimeTrend')}>
          <h2 className="mb-2 font-heading text-section font-semibold">{t('cp27.onTimeTrend')}</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeks.map((w) => ({ week: formatWeek(w.week), pct: w.onTimePct }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis domain={[80, 100]} width={32} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line dataKey="pct" name={t('cp27.k.onTime')} stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('cp27.transit')}>
          <h2 className="mb-2 font-heading text-section font-semibold">{t('cp27.transit')}</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lanes.map((l) => ({ lane: l.dest, actual: l.avgTransit, promised: l.promised }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="lane" tick={{ fontSize: 11 }} />
                <YAxis width={28} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="actual" name={t('cp27.actual')} fill="var(--accent)" isAnimationActive={false} />
                <Bar dataKey="promised" name={t('cp27.promised')} fill="var(--color-gray-300, #cbd5e1)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-xl border bg-card p-5 shadow-card xl:col-span-2" aria-label={t('cp27.cost')}>
          <h2 className="mb-2 font-heading text-section font-semibold">{t('cp27.cost')}</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lanes.map((l) => ({ lane: l.dest, cost: l.costPerKg }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="lane" tick={{ fontSize: 11 }} />
                <YAxis width={32} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="cost" name={t('cp27.perKg')} fill="var(--accent)" isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('cp27.top')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('cp27.top')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="lanes">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('cp27.col.lane')}</th>
              <th>{t('cp27.col.shipments')}</th>
              <th>{t('cp27.col.transit')}</th>
              <th>{t('cp27.col.onTime')}</th>
              <th>{t('cp27.col.damage')}</th>
              <th>{t('cp27.col.cost')}</th>
              <th>{t('cp27.col.co2')}</th>
            </tr>
          </thead>
          <tbody>
            {[...lanes]
              .sort((x, y) => y.shipments - x.shipments)
              .map((l) => (
                <tr key={label(l)} className="border-b last:border-0">
                  <td className="px-4 py-2">
                    {label(l)} <span className="text-caption text-muted-foreground">· {t(`service.${l.service}`)}</span>
                  </td>
                  <td className="tabular">{Math.round(l.shipments * share)}</td>
                  <td className="tabular">{t('cp27.vsPromised', { actual: l.avgTransit, promised: l.promised })}</td>
                  <td className="tabular">{l.onTimePct}%</td>
                  <td className="tabular">{l.damagePct}%</td>
                  <td className="tabular">₹{l.costPerKg.toFixed(1)}</td>
                  <td className="tabular">{l.co2} kg</td>
                </tr>
              ))}
          </tbody>
        </table>
        <p className="px-4 py-3 text-caption text-muted-foreground">{t('cp27.note')}</p>
      </section>
    </div>
  )
}
