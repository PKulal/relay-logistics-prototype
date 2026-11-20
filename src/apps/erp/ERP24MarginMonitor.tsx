/**
 * ERP-24 Margin monitor and lane-loss alerts — docs/04-erp-control-tower.md.
 * Source §8.1 (AI margin engine: checks every quote, suggests a different
 * model or flags the rate line, learns loss-making lanes), §11 Dept 3
 * (lane-loss alerts), §9 (lane-level P&L). Dynamic pricing is Phase 2.
 */
import { Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { laneAlerts, laneRows, quoteChecks, type LaneRow } from '@shared/engines/pricingMonitor'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { Switch } from '@shared/ui/switch'

const pct = (n: number) => `${n.toFixed(1)}%`

export default function ERP24MarginMonitor() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [params, setParams] = useSearchParams()
  const rows = laneRows(data, now)
  const open = rows.find((r) => r.key === params.get('lane'))
  if (open) return <LaneDetail row={open} onBack={() => setParams({})} />
  const alerts = laneAlerts(data, rows, now)
  const checks = quoteChecks(data)
  const target = data.settings.targetMarginPct

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp24.title')} subtitle={t('erp24.subtitle', { target, buffer: data.settings.riskBufferPct })} className="mb-0" />

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp24.lanes')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp24.lanes')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="lanes">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp24.col.lane')}</th>
              <th className="text-right">{t('erp24.col.shipments')}</th>
              <th className="text-right">{t('erp24.col.revenue')}</th>
              <th className="text-right">{t('erp24.col.legs')}</th>
              <th className="text-right">{t('erp24.col.claims')}</th>
              <th className="text-right">{t('erp24.col.margin')}</th>
              <th className="text-right">{t('erp24.col.trend')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b last:border-0" aria-label={r.key}>
                <td className="px-4 py-2">
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setParams({ lane: r.key })}>
                    {r.key}
                  </button>
                </td>
                <td className="tabular text-right">{r.shipments.length}</td>
                <td className="tabular text-right">{formatINR(r.revenue)}</td>
                <td className="tabular text-right">{formatINR(r.legCosts)}</td>
                <td className="tabular text-right">{r.claims ? formatINR(r.claims) : '—'}</td>
                <td className={cn('tabular text-right font-semibold', r.belowTarget ? 'text-status-danger' : 'text-status-success')}>{pct(r.marginPct)}</td>
                <td className={cn('tabular text-right text-caption', (r.trend ?? 0) < 0 && 'text-status-danger')}>{r.trend === undefined ? '—' : `${r.trend > 0 ? '↑' : r.trend < 0 ? '↓' : ''} ${Math.abs(r.trend).toFixed(1)} pt`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 pb-3 text-caption text-muted-foreground">{t('erp24.marginNote')}</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp24.alerts')}>
          <h2 className="flex items-center gap-2 font-heading text-section font-semibold">
            <Bot className="size-5 text-muted-foreground" aria-hidden /> {t('erp24.alerts')} <SimulatedTag />
          </h2>
          {alerts.length === 0 ? (
            <p className="text-muted-foreground">{t('erp24.noAlerts')}</p>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="alerts">
              {alerts.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Chip tone={a.kind === 'belowTarget' ? 'danger' : 'warning'}>{t(`erp24.alert.${a.kind}`)}</Chip>
                  <button type="button" className="text-left hover:underline" onClick={() => setParams({ lane: a.lane })}>
                    {a.lane} · {a.kind === 'belowTarget' ? pct(a.pct) : a.kind === 'partnerCost' ? t('erp24.rise', { pct: a.risePct }) : t('erp24.revisions', { count: a.count, of: a.of })}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 opacity-70 shadow-card" aria-label={t('erp24.dynamic')}>
          <h2 className="flex items-center gap-2 font-heading text-section font-semibold">
            {t('erp24.dynamic')} <Chip tone="neutral">{t('erp24.phase2')}</Chip>
          </h2>
          <p>{t('erp24.dynamicBody')}</p>
          <ul className="flex flex-col gap-1 text-table">
            {(['demand', 'capacity', 'season', 'fuel'] as const).map((k) => (
              <li key={k} className="flex items-center justify-between">
                {t(`erp24.factor.${k}`)} <Switch disabled checked={false} aria-label={t(`erp24.factor.${k}`)} />
              </li>
            ))}
          </ul>
          <p className="text-caption text-muted-foreground">{t('erp24.contractExcluded')}</p>
        </section>
      </div>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp24.checks')}>
        <h2 className="flex items-center gap-2 px-4 pt-4 font-heading text-section font-semibold">
          {t('erp24.checks')} <SimulatedTag />
        </h2>
        {checks.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t('erp24.noChecks')}</p>
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="quote-checks">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp24.col.lr')}</th>
                <th>{t('erp24.col.customer')}</th>
                <th>{t('erp24.col.service')}</th>
                <th className="text-right">{t('erp24.col.net')}</th>
                <th>{t('erp24.col.suggestion')}</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.shipment.id} className="border-b last:border-0" aria-label={c.shipment.id}>
                  <td className="px-4 py-2">
                    <Link to={`/erp/shipments/${c.shipment.id}`} className="tabular text-primary hover:underline">
                      {c.shipment.id}
                    </Link>
                    <span className="block text-caption text-muted-foreground">{formatDate(c.at)}</span>
                  </td>
                  <td>{data.customers[c.shipment.customerId].shortName}</td>
                  <td>{t(`service.${c.shipment.service}`)}</td>
                  <td className="tabular text-right font-semibold text-status-danger">{pct(c.netPct)}</td>
                  <td>{c.alternative ? t('erp24.suggestModel', { service: t(`service.${c.alternative.service}`), pct: pct(c.alternative.netPct) }) : t('erp24.suggestRate', { card: c.rateCardId })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}

function LaneDetail({ row, onBack }: { row: LaneRow; onBack: () => void }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="w-fit text-caption font-medium text-primary hover:underline">
        ← {t('erp24.back')}
      </button>
      <PageHeader title={row.key} subtitle={t('erp24.laneSub', { count: row.shipments.length, revenue: formatINR(row.revenue), margin: pct(row.marginPct) })} className="mb-0" />
      <div className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="lane-shipments">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp24.col.lr')}</th>
              <th>{t('erp24.col.customer')}</th>
              <th>{t('erp24.col.service')}</th>
              <th className="text-right">{t('erp24.col.revenue')}</th>
              <th className="text-right">{t('erp24.col.legs')}</th>
              <th className="text-right">{t('erp24.col.insurance')}</th>
              <th className="text-right">{t('erp24.col.claims')}</th>
              <th className="text-right">{t('erp24.col.margin')}</th>
            </tr>
          </thead>
          <tbody>
            {row.shipments.map((p) => (
              <tr key={p.shipment.id} className="border-b last:border-0" aria-label={p.shipment.id}>
                <td className="px-4 py-2">
                  <Link to={`/erp/shipments/${p.shipment.id}`} className="tabular text-primary hover:underline">
                    {p.shipment.id}
                  </Link>
                  <span className="block text-caption text-muted-foreground">{formatDate(p.shipment.bookedAt)}</span>
                </td>
                <td>{data.customers[p.shipment.customerId].shortName}</td>
                <td>{t(`service.${p.shipment.service}`)}</td>
                <td className="tabular text-right">{formatINR(p.revenue)}</td>
                <td className="tabular text-right">{formatINR(p.legCosts)}</td>
                <td className="tabular text-right">{p.insurance ? formatINR(p.insurance) : '—'}</td>
                <td className="tabular text-right">{p.claims ? formatINR(p.claims) : '—'}</td>
                <td className={cn('tabular text-right font-semibold', p.marginPct - data.settings.riskBufferPct < data.settings.targetMarginPct ? 'text-status-danger' : 'text-status-success')}>
                  {formatINR(p.margin)} · {pct(p.marginPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
