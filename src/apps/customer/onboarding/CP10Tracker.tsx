/**
 * CP-10 Onboarding tracker and pilot (hyper-care) — docs/01-customer-portal.md §6.1.
 * Source §6 Steps 7–8: every pilot shipment monitored daily, with a daily
 * pilot report to the account manager and the customer, and early warning on
 * SLA risk. Home screen until the account is live.
 */
import { ArrowRight, CheckCircle2, Circle, CircleDot, PackagePlus, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { hasException } from '@shared/engines/customerDashboard'
import { assisted } from '@shared/engines/onboarding'
import { shipmentSla } from '@shared/engines/sla'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate } from '@shared/lib/format'
import { addDaysToDate, istDate } from '@shared/lib/time'
import { PILOT_DAYS, pilotDay } from '@shared/store/contractActions'
import type { Customer, DemoData, IsoDate } from '@shared/types'
import { Button } from '@shared/ui/button'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { useCustomerSession } from '../useCustomerSession'
import { canBookNow, onboardingSteps } from './steps'

export default function CP10Tracker() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, customer: c } = useCustomerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const steps = onboardingSteps(c)
  const kam = c.kamId && assisted(c.track) ? data.staff[c.kamId] : undefined
  const day = pilotDay(c, now)
  const canBook = canBookNow(c) && (user.role === 'admin' || user.role === 'dispatch')

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t('cp10.title')}
        subtitle={c.status === 'live' ? t('cp10.live') : t('cp10.subtitle')}
        actions={
          <Button disabled={!canBook} onClick={() => navigate('/customer/book')}>
            <PackagePlus /> {t('cp10.bookFirst')}
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ol className="flex flex-col divide-y rounded-xl border bg-card shadow-card" aria-label={t('onb.steps')} data-testid="tracker">
          {steps.map((s, i) => {
            const Icon = s.state === 'done' ? CheckCircle2 : s.state === 'current' ? CircleDot : Circle
            return (
              <li key={s.key} className="flex items-center gap-3 px-5 py-3">
                <Icon className={cn('size-5 shrink-0', s.state === 'done' ? 'text-status-success' : s.state === 'current' ? 'text-primary' : 'text-muted-foreground')} aria-hidden />
                <span className="flex-1">
                  <span className="font-medium">
                    {i + 1}. {t(`onb.step.${s.key}`)}
                  </span>
                  {s.key === 'pilot' && c.onboarding?.pilot && (
                    <span className="tabular block text-caption text-muted-foreground">{t('cp10.pilotDay', { day, total: PILOT_DAYS, from: formatDate(c.onboarding.pilot.start), to: formatDate(c.onboarding.pilot.end) })}</span>
                  )}
                </span>
                <Chip tone={s.state === 'done' ? 'success' : s.state === 'current' ? 'info' : 'neutral'}>{t(`cp10.state.${s.state}`)}</Chip>
                {s.state === 'current' && s.path && s.path !== '/customer/onboarding' && (
                  <Button size="sm" variant="outline" asChild>
                    <Link to={s.path}>
                      {t('cp10.continue')} <ArrowRight />
                    </Link>
                  </Button>
                )}
              </li>
            )
          })}
        </ol>
        <aside className="flex flex-col gap-4">
          {kam ? (
            <section className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-card">
              <UserRound className="mt-0.5 size-5 text-primary" aria-hidden />
              <div>
                <p className="text-caption text-muted-foreground">{t('cp10.kam')}</p>
                <p className="font-semibold">{kam.name}</p>
                <p className="text-caption">{kam.title}</p>
                <p className="text-caption">{kam.email}</p>
              </div>
            </section>
          ) : (
            <p className="rounded-xl border bg-card p-4 text-caption text-muted-foreground">{t('cp10.selfServe')}</p>
          )}
          {c.onboarding?.pilot && (
            <section className="rounded-xl border bg-card p-4 text-caption shadow-card">
              <p className="font-semibold">{t('cp10.kpis')}</p>
              <p>{t('cp10.kpiOnTime', { pct: c.onboarding.pilot.kpis.onTimePct })}</p>
              <p>{t('cp10.kpiExceptions', { pct: c.onboarding.pilot.kpis.maxExceptionPct })}</p>
            </section>
          )}
        </aside>
      </div>
      {c.onboarding?.pilot && <PilotReport data={data} c={c} now={now} />}
    </div>
  )
}

/** Daily pilot report (source §6 Step 7). */
function PilotReport({ data, c, now }: { data: DemoData; c: Customer; now: string }) {
  const { t } = useTranslation()
  const p = c.onboarding!.pilot!
  const today = istDate(now)
  const days: IsoDate[] = []
  for (let d = p.start; d <= p.end && d <= today; d = addDaysToDate(d, 1)) days.push(d)
  const mine = Object.values(data.shipments).filter((s) => s.customerId === c.id)
  const atRisk = mine.filter((s) => ['atRisk', 'breached'].includes(shipmentSla(data, s, now)))
  const rows = days
    .map((d) => {
      const booked = mine.filter((s) => istDate(s.bookedAt) === d).length
      const delivered = Object.values(data.events).filter((e) => e.type === 'delivered' && istDate(e.at) === d && data.shipments[e.shipmentId]?.customerId === c.id)
      const onTime = delivered.filter((e) => {
        const leg = e.legId ? data.legs[e.legId] : undefined
        return !leg || e.at <= leg.slaDueAt
      }).length
      const exceptions = mine.filter((s) => hasException(data, s) && Object.values(data.events).some((e) => e.shipmentId === s.id && e.type === 'exceptionReported' && istDate(e.at) === d)).length
      return { d, booked, delivered: delivered.length, onTimePct: delivered.length ? Math.round((onTime / delivered.length) * 100) : undefined, exceptions }
    })
    .reverse()
  return (
    <section className="mt-6 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="pilot-h">
      <h2 id="pilot-h" className="mb-3 text-card-title">
        {t('cp10.report')}
      </h2>
      <table className="w-full text-table" data-testid="pilot-report">
        <thead>
          <tr className="border-b text-left text-caption text-muted-foreground">
            <th className="py-2">{t('cp10.date')}</th>
            <th className="text-right">{t('cp10.booked')}</th>
            <th className="text-right">{t('cp10.onTime')}</th>
            <th className="text-right">{t('cp10.exceptions')}</th>
            <th className="pl-6">{t('cp10.risk')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.d} className="tabular border-b last:border-0">
              <td className="py-2">{formatDate(r.d)}</td>
              <td className="text-right">{r.booked}</td>
              <td className="text-right">{r.onTimePct === undefined ? '—' : `${r.onTimePct}%`}</td>
              <td className="text-right">{r.exceptions}</td>
              <td className="pl-6">
                {r.d === today && atRisk.length
                  ? atRisk.map((s) => (
                      <Link key={s.id} to={`/customer/shipments/${s.id}`} className="mr-2 font-medium text-status-warning hover:underline">
                        {s.id}
                      </Link>
                    ))
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-caption text-muted-foreground">{t('cp10.reportNote')}</p>
    </section>
  )
}
