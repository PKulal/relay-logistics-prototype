/**
 * CP-11 Dashboard — docs/01-customer-portal.md §6.3.
 * Counts are computed live from the shared store, so they change as shipments
 * move in the other apps (or when the demo clock advances).
 */
import { AlertTriangle, ArrowRight, Calculator, CircleAlert, FileSpreadsheet, IndianRupee, PackagePlus, Search, Truck, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/shared/lib/utils'
import {
  actionsNeeded,
  banners,
  customerShipments,
  customerShipmentsDue,
  dayLabel,
  onTimeRate,
  onTimeTrend,
  periods,
  statusTiles,
  type DateRange,
  type TileKey,
} from '@shared/engines/customerDashboard'
import { codSummary } from '@shared/engines/receivables'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import { useSimulatedLoading } from '@shared/sim/latency'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { KpiTile } from '@shared/ui/KpiTile'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SlaTimer } from '@shared/ui/SlaTimer'
import { Skeleton } from '@shared/ui/skeleton'
import { Chip } from '@shared/ui/StatusChip'
import { useCustomerSession } from './useCustomerSession'

const TILES: TileKey[] = ['booked', 'pickedUp', 'inTransit', 'atDestinationHub', 'outForDelivery', 'delivered', 'exceptions']

export default function CP11Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const demoNow = useDemoNow()
  const [range, setRange] = useState<DateRange>('7d')
  const [locationId, setLocationId] = useState('')
  const [search, setSearch] = useState('')
  const loading = useSimulatedLoading(`${range}|${locationId}`)

  const locations = Object.values(data.pickupLocations).filter((l) => l.customerId === customer.id)
  const { current, previous } = useMemo(() => periods(range, demoNow), [range, demoNow])

  const view = useMemo(() => {
    const loc = locationId || undefined
    const booked = customerShipments(data, customer.id, current, loc)
    const due = customerShipmentsDue(data, customer.id, current, loc)
    const dueBefore = customerShipmentsDue(data, customer.id, previous, loc)
    return {
      tiles: statusTiles(data, booked),
      sla: onTimeRate(data, due, demoNow),
      slaBefore: onTimeRate(data, dueBefore, demoNow),
      trend: onTimeTrend(data, due, current, demoNow),
      actions: actionsNeeded(data, customer.id),
      banners: banners(data, customer),
    }
  }, [data, customer, current, previous, locationId, demoNow])

  // Role rules (CP-11): Dispatch → status, SLA, exceptions · Finance → spend, COD, invoices · Admin → all
  const ops = user.role !== 'finance'
  const money = user.role !== 'dispatch'
  const cod = codSummary(data, customer.id, demoNow)
  const canBook = user.role !== 'finance'
  const slaDelta = view.sla.pct !== null && view.slaBefore.pct !== null ? view.sla.pct - view.slaBefore.pct : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('cp11.title')}
        subtitle={t('cp11.greeting', { name: user.name.split(' ')[0], company: customer.shortName })}
        actions={
          <>
            <NativeSelect aria-label={t('cp11.range')} value={range} onChange={(e) => setRange(e.target.value as DateRange)} className="w-40">
              {(['today', '7d', '30d', 'month'] as DateRange[]).map((r) => (
                <option key={r} value={r}>
                  {t(`cp11.ranges.${r}`)}
                </option>
              ))}
            </NativeSelect>
            {locations.length > 1 && (
              <NativeSelect aria-label={t('cp11.location')} value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-48">
                <option value="">{t('cp11.allLocations')}</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </>
        }
        className="mb-0"
      />

      {/* Banners */}
      {view.banners.map((b) => (
        <div key={b} role="status" className="flex items-center gap-2 rounded-lg border border-status-warning/30 bg-status-warning-bg px-4 py-3 text-status-warning">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          <span className="font-medium">{t(`cp11.banner.${b}`)}</span>
        </div>
      ))}

      {/* Search + quick actions */}
      <div className="flex flex-wrap items-center gap-3">
        <form
          className="relative min-w-64 flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            navigate(`/customer/shipments?q=${encodeURIComponent(search.trim())}`)
          }}
        >
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search.placeholder.customer')}
            aria-label={t('search.label')}
            className="h-10 w-full rounded-md border border-input bg-background pr-3 pl-9 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </form>
        <Button variant="outline" onClick={() => navigate('/customer/quote')}>
          <Calculator /> {t('nav.cp.quote')}
        </Button>
        {canBook && (
          <>
            <Button onClick={() => navigate('/customer/book')}>
              <PackagePlus /> {t('header.bookShipment')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/customer/book/bulk')}>
              <FileSpreadsheet /> {t('nav.cp.bookBulk')}
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => navigate('/customer/shipments')}>
          <Truck /> {t('cp11.track')}
        </Button>
      </div>

      {/* Shipments by status */}
      {ops && (
        <section aria-labelledby="tiles-h">
          <h2 id="tiles-h" className="mb-3 text-section">
            {t('cp11.byStatus')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {TILES.map((tile) => (
              <KpiTile
                key={tile}
                label={tile === 'exceptions' ? t('cp11.exceptionsTile') : t(`status.shipment.${tile}`)}
                value={view.tiles[tile]}
                loading={loading}
                onClick={() => navigate(`/customer/shipments?status=${tile}`)}
                className={cn(tile === 'exceptions' && view.tiles.exceptions > 0 && 'border-status-danger/40')}
              />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* SLA performance */}
        {ops && (
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="sla-h">
            <h2 id="sla-h" className="text-card-title">
              {t('cp11.sla')}
            </h2>
            {loading ? (
              <Skeleton className="mt-4 h-32 w-full" />
            ) : view.sla.pct === null ? (
              <p className="mt-4 text-muted-foreground">{t('cp11.slaNone')}</p>
            ) : (
              <div className="mt-3 flex items-center gap-6">
                <Gauge pct={view.sla.pct} />
                <div className="min-w-0 flex-1">
                  <p className="text-caption text-muted-foreground">{t('cp11.slaDetail', { onTime: view.sla.onTime, due: view.sla.due })}</p>
                  {slaDelta !== null && (
                    <p className={cn('text-caption font-semibold', slaDelta >= 0 ? 'text-status-success' : 'text-status-danger')}>
                      {slaDelta >= 0 ? '↑' : '↓'} {t('cp11.slaVsPrevious', { delta: Math.abs(slaDelta) })}
                    </p>
                  )}
                  <div className="mt-2 h-20" aria-hidden>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={view.trend.map((p) => ({ day: dayLabel(p.date), pct: p.pct }))} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis domain={[0, 105]} hide />
                        <ChartTooltip formatter={(v) => (v == null ? '—' : `${v}%`)} />
                        <Line type="monotone" dataKey="pct" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} connectNulls isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Exceptions needing action */}
        {ops && (
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="exc-h">
            <div className="flex items-center justify-between gap-2">
              <h2 id="exc-h" className="text-card-title">
                {t('cp11.needAction')}
              </h2>
              {view.actions.length > 0 && <Chip tone="danger">{t('cp11.needActionCount', { count: view.actions.length })}</Chip>}
            </div>
            {loading ? (
              <div className="mt-4 flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : view.actions.length === 0 ? (
              <EmptyState title={t('cp11.noActions')} className="py-6" />
            ) : (
              <ul className="mt-3 divide-y">
                {view.actions.slice(0, 5).map((a) => (
                  <li key={`${a.kind}-${a.shipmentId}`} className="flex flex-wrap items-center gap-3 py-2.5">
                    <CircleAlert className="size-4 shrink-0 text-status-danger" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t(`cp11.action.${a.kind}`)}</p>
                      <p className="tabular text-caption text-muted-foreground">
                        {a.shipmentId}
                        {a.reason ? ` · ${t(`ndr.reason.${a.reason}`, { defaultValue: a.reason })}` : ''}
                      </p>
                    </div>
                    <SlaTimer dueAt={a.dueAt} totalMinutes={a.kind === 'weightRevision' ? 48 * 60 : 24 * 60} />
                    <Button size="sm" variant="outline" onClick={() => navigate(`/customer/exceptions?lr=${a.shipmentId}&screen=${a.screenId}`)}>
                      {t('cp11.act')} <ArrowRight />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {view.actions.length > 5 && (
              <Link to="/customer/exceptions" className="mt-2 inline-block text-caption font-medium text-primary hover:underline">
                {t('cp11.seeAll', { count: view.actions.length })}
              </Link>
            )}
          </section>
        )}

        {/* Spend this month */}
        {money && (
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="spend-h">
            <h2 id="spend-h" className="flex items-center gap-2 text-card-title">
              <IndianRupee className="size-4 text-primary" aria-hidden />
              {t('cp11.spend')}
            </h2>
            {loading ? (
              <Skeleton className="mt-4 h-16 w-full" />
            ) : (
              <>
                <p className="tabular mt-2 font-heading text-page-title font-bold">{formatINR(customer.spendMonthToDate)}</p>
                {customer.billing === 'credit' ? (
                  <>
                    <UsageBar used={customer.creditUsed} limit={customer.creditLimit} />
                    <p className="tabular mt-1 text-caption text-muted-foreground">
                      {t('cp11.creditUsed', { used: formatINR(customer.creditUsed), limit: formatINR(customer.creditLimit), available: formatINR(customer.creditLimit - customer.creditUsed) })}
                    </p>
                  </>
                ) : (
                  <p className="tabular mt-1 flex items-center gap-1.5 text-caption text-muted-foreground">
                    <Wallet className="size-3.5" aria-hidden />
                    {t('cp11.walletBalance', { amount: formatINR(customer.walletBalance) })}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {/* COD due */}
        {money && cod.nextRemittance && (
          <KpiTile
            label={t('cp11.codDue')}
            value={formatINR(cod.pending)}
            hint={t('cp11.codNext', { date: formatDate(cod.nextRemittance) })}
            loading={loading}
            onClick={() => navigate('/customer/billing/cod')}
            className="p-5"
          />
        )}

        {/* Invoices due (Finance) — invoices are seeded with CP-24 in Phase 4 */}
        {money && Object.values(data.invoices).some((i) => i.customerId === customer.id) && (
          <KpiTile
            label={t('cp11.invoicesDue')}
            value={Object.values(data.invoices).filter((i) => i.customerId === customer.id && i.status !== 'paid').length}
            loading={loading}
            onClick={() => navigate('/customer/billing/invoices')}
            className="p-5"
          />
        )}
      </div>
    </div>
  )
}

/** Semi-circle gauge for the on-time %. */
function Gauge({ pct }: { pct: number }) {
  const { t } = useTranslation()
  const r = 52
  const len = Math.PI * r
  return (
    <figure className="relative w-36 shrink-0" aria-label={t('cp11.slaGauge', { pct })}>
      <svg viewBox="0 0 120 70" className="w-full" aria-hidden>
        <path d="M 8 62 A 52 52 0 0 1 112 62" fill="none" stroke="var(--color-gray-100)" strokeWidth="12" strokeLinecap="round" />
        <path d="M 8 62 A 52 52 0 0 1 112 62" fill="none" stroke="var(--accent)" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(len * pct) / 100} ${len}`} />
      </svg>
      <figcaption className="tabular absolute inset-x-0 bottom-0 text-center font-heading text-page-title font-bold">{pct}%</figcaption>
    </figure>
  )
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  return (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-100" role="meter" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
      <div className={cn('h-full rounded-full', pct > 80 ? 'bg-status-warning' : 'bg-primary')} style={{ width: `${pct}%` }} />
    </div>
  )
}
