/**
 * PP-23 Performance scorecard — docs/02-partner-portal.md. Source §5.2: six
 * KPIs, Parcel / PTL weights, visible to the partner. "This week" is worked out
 * live from the demo data with the jobs behind each number; earlier weeks are
 * the published scores. "Query a KPI", AI tips and a custom period are not in
 * the client document.
 */
import { FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from 'recharts'
import * as XLSX from 'xlsx'
import { cn } from '@/shared/lib/utils'
import { liveKpis, type KpiDetail } from '@shared/engines/liveScore'
import { band, KPI_KEYS, kpiPct, points, profileOf, scoresOf, WEIGHTS } from '@shared/engines/scoring'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatWeek } from '@shared/lib/format'
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { KpiKey, WeeklyScore } from '@shared/types'
import { Button } from '@shared/ui/button'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { TierBadge } from '@shared/ui/TierBadge'
import { usePartnerSession } from './usePartnerSession'

type Period = 'this' | 'last' | 'four'

export default function PP23Scorecard() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [period, setPeriod] = useState<Period>('last')
  const [open, setOpen] = useState<KpiKey>()
  const published = scoresOf(data, partner.id)
  const profile = profileOf(partner)
  const today = istDate(now)
  const monday = addDaysToDate(today, -((new Date(`${today}T12:00:00+05:30`).getUTCDay() + 6) % 7))
  const live = period === 'this' ? liveKpis(data, partner.id, monday, today) : undefined
  const last = published.at(-1)
  const four = published.slice(-4)
  const kpis: WeeklyScore['kpis'] | undefined =
    live?.kpis ??
    (period === 'last'
      ? last?.kpis
      : four.length
        ? (Object.fromEntries(Object.keys(four[0].kpis).map((k) => [k, Math.round((four.reduce((s, w) => s + w.kpis[k as keyof WeeklyScore['kpis']], 0) / four.length) * 10) / 10])) as WeeklyScore['kpis'])
        : undefined)
  const pts = kpis ? points(kpis, profile) : undefined
  const total = pts ? Math.round(Object.values(pts).reduce((s, x) => s + x, 0) * 10) / 10 : 0
  const label = period === 'this' ? t('pp23.thisWeek', { from: formatDate(monday).slice(0, 6), to: formatDate(today) }) : period === 'last' && last ? formatWeek(last.week) : four.length ? `${formatDate(four[0].week)} – ${formatDate(addDaysToDate(four.at(-1)!.week, 6))}` : ''
  const trend = published.slice(-12).map((w) => ({ week: formatDate(w.week).slice(0, 6), score: w.total }))

  const download = () => {
    const rows = published.slice(-12).map((w) => ({ [t('pp23.col.week')]: formatWeek(w.week), ...Object.fromEntries(KPI_KEYS.map((k) => [t(`kpi.${k}`), kpiPct(w.kpis, k)])), [t('pp23.total')]: w.total, [t('pp23.col.tier')]: t(`tier.${w.tierAfter ?? 'bronze'}`) }))
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'Scorecard')
    XLSX.writeFile(book, `scorecard-${partner.shortName.split(' ')[0].toLowerCase()}.xlsx`)
  }

  if (!partner.tier && !published.length)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t('pp23.title')} subtitle={t('pp23.notScored')} className="mb-0" />
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('pp23.title')}
        subtitle={t('pp23.subtitle')}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/partner/scorecard/tier">{t('pp23.tierLink')}</Link>
            </Button>
            <Button variant="outline" onClick={download} disabled={!published.length}>
              <FileSpreadsheet /> {t('pp23.download')}
            </Button>
          </div>
        }
        className="mb-0"
      />
      <div className="flex flex-wrap items-center gap-3">
        <NativeSelect aria-label={t('pp23.period')} value={period} onChange={(e) => (setPeriod(e.target.value as Period), setOpen(undefined))} className="w-48">
          {(['this', 'last', 'four'] as const).map((p) => (
            <option key={p} value={p}>
              {t(`pp23.p.${p}`)}
            </option>
          ))}
        </NativeSelect>
        <span className="text-muted-foreground">{label}</span>
        <span className="text-caption text-muted-foreground">· {t('pp23.profile', { profile: t(`kpi.profile.${profile}`) })}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <section className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-5 shadow-card" data-testid="total">
          <p className="text-caption text-muted-foreground">{t('pp23.total')}</p>
          <p className="tabular font-heading text-[44px] font-bold leading-none">{total.toFixed(1)}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, total)}%` }} />
          </div>
          <TierBadge tier={band(total)} />
          {period === 'this' && <p className="text-center text-caption text-muted-foreground">{t('pp23.liveNote')}</p>}
        </section>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="kpis">
          {KPI_KEYS.map((k) => {
            const value = kpis ? (k === 'damage' ? t('pp23.per10k', { n: kpis.damagePer10k }) : `${kpiPct(kpis, k)}%`) : '—'
            return (
              <button
                key={k}
                type="button"
                disabled={!live}
                onClick={() => setOpen(open === k ? undefined : k)}
                aria-label={t(`kpi.${k}`)}
                className={cn('flex flex-col gap-1 rounded-xl border bg-card p-4 text-left shadow-card', live && 'hover:border-primary', open === k && 'border-primary bg-primary-soft')}
              >
                <span className="text-caption font-medium text-muted-foreground">
                  {t(`kpi.${k}`)} · {WEIGHTS[profile][k]}%
                </span>
                <span className="tabular font-heading text-section font-bold">
                  {value} <span className="text-muted-foreground">→ {pts ? pts[k].toFixed(1) : '—'}</span>
                </span>
                <span className="text-caption text-muted-foreground">{t(`kpi.measure.${k}`)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {live && open && <Drill k={open} d={live.detail[open]} />}
      {!live && <p className="text-caption text-muted-foreground">{t('pp23.drillOnlyLive')}</p>}

      <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('pp23.trend')}>
        <h2 className="mb-2 font-heading text-section font-semibold">{t('pp23.trend')}</h2>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis domain={[40, 100]} tick={{ fontSize: 11 }} />
              <ChartTooltip />
              <Line type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}

function Drill({ k, d }: { k: KpiKey; d: KpiDetail }) {
  const { t } = useTranslation()
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('pp23.drill', { kpi: t(`kpi.${k}`) })} data-testid="drill">
      <h2 className="mb-1 font-heading text-section font-semibold">{t('pp23.drill', { kpi: t(`kpi.${k}`) })}</h2>
      <p className="mb-2 text-muted-foreground">{k === 'damage' ? t('pp23.damageCount', { pieces: d.counted, claims: d.failed.length }) : t('pp23.counted', { counted: d.counted, failed: d.failed.length })}</p>
      {d.failed.length > 0 && (
        <ul className="flex flex-col gap-1 text-table">
          {d.failed.map((f) => (
            <li key={f.ref} className="flex gap-3">
              <Link to={f.ref.startsWith('JOB-') ? `/partner/jobs/${f.ref}` : f.ref.startsWith('CLM-') ? `/partner/claims/${f.ref}` : `/partner/escalations?ticket=${f.ref}`} className="tabular text-primary hover:underline">
                {f.ref}
              </Link>
              <span>{t(`pp23.reason.${f.reason}`, { defaultValue: f.reason })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
