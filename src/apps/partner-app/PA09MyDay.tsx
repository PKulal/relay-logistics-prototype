/**
 * PA-09 My day and performance — docs/03-partner-app.md. Source §5.2 KPIs
 * (on-time, scan compliance). Distance is SIMULATED GPS (straight lines between
 * today's scan points). Per-task earnings are not built (no basis in the
 * client document).
 */
import { Banknote, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { myDay } from '@shared/engines/fieldDay'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDayShort, formatINR } from '@shared/lib/format'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { useFieldSession } from './useFieldSession'

export default function PA09MyDay() {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const d = myDay(data, staff.id, now)
  const tile = 'flex flex-col rounded-2xl border bg-card p-3'

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-heading text-[22px] font-bold">{t('pa09.title')}</h1>
      <section aria-label={t('pa09.today')} className="grid grid-cols-2 gap-2" data-testid="my-day">
        <div className={tile}>
          <span className="text-caption text-muted-foreground">{t('pa09.done')}</span>
          <span className="tabular text-[24px] font-bold">{d.done}</span>
        </div>
        <div className={tile}>
          <span className="text-caption text-muted-foreground">{t('pa09.onTime')}</span>
          <span className="tabular text-[24px] font-bold">{d.onTimePct == null ? '—' : `${d.onTimePct}%`}</span>
        </div>
        <div className={tile}>
          <span className="text-caption text-muted-foreground">{t('pa09.failed')}</span>
          <span className="tabular text-[24px] font-bold">{d.failed}</span>
        </div>
        <div className={tile}>
          <span className="flex items-center gap-1 text-caption text-muted-foreground">
            {t('pa09.distance')} <SimulatedTag />
          </span>
          <span className="tabular text-[24px] font-bold">{d.distanceKm} km</span>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4" aria-label={t('pa09.compliance')}>
        <h2 className="font-bold">{t('pa09.compliance')}</h2>
        <p className="tabular text-[24px] font-bold">{d.compliancePct == null ? '—' : `${d.compliancePct}%`}</p>
        <p className="text-caption text-muted-foreground">{t('pa09.complianceHint')}</p>
      </section>

      {staff.role === 'rider' && (
        <Link to="/app/cod" className="flex min-h-12 items-center gap-3 rounded-2xl border bg-card p-4">
          <Banknote className="size-6 text-primary" aria-hidden />
          <span className="flex-1">
            <span className="block font-bold">{t('pa09.cod')}</span>
            <span className="tabular block">{formatINR(d.codInHand)}</span>
          </span>
          <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
        </Link>
      )}

      <section className="rounded-2xl border bg-card p-4" aria-label={t('pa09.week')}>
        <h2 className="mb-2 font-bold">{t('pa09.week')}</h2>
        <div className="h-40" data-testid="week">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={d.week.map((w) => ({ day: t(`pp18.d.${formatDayShort(w.date).slice(0, 3).toLowerCase()}`), done: w.done }))}>
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} width={24} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Bar dataKey="done" fill="var(--accent)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-caption text-muted-foreground">{t('pa09.weekTotal', { count: d.week.reduce((s, w) => s + w.done, 0) })}</p>
      </section>
    </div>
  )
}
