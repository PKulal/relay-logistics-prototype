/**
 * ERP-04 Command dashboard — docs/04-erp-control-tower.md. Source §11 Dept 0
 * (command dashboard, OKRs, board packs; daily AI briefing; scenario
 * modelling). Company-wide revenue, margin, on-time, claims and active counts
 * are the seeded snapshot (spec prototype note); shipments, cash, network
 * health and the briefing are live. Board pack = the browser's print to PDF.
 */
import { Bot, Printer } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { dailyBriefing, liveTiles, networkHealth, scenario } from '@shared/engines/departments'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import type { LeadershipSnapshot } from '@shared/types'
import { Button } from '@shared/ui/button'
import { KpiTile } from '@shared/ui/KpiTile'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { TierBadge } from '@shared/ui/TierBadge'

type Period = keyof LeadershipSnapshot['periods']
const crore = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} Cr` : `₹${(n / 1e5).toFixed(1)} L`)
const heatTone = (pct: number) => (pct >= 18 ? 'bg-status-success-bg text-status-success' : pct >= 15 ? 'bg-status-warning-bg text-status-warning' : 'bg-status-danger-bg text-status-danger')

export default function ERP04Command() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [period, setPeriod] = useState<Period>('mtd')
  const snap = data.leadership.periods[period]
  const live = liveTiles(data, period, now)
  const briefing = dailyBriefing(data, now)
  const health = networkHealth(data, now)
  const regions = [...new Set(data.leadership.heatmap.map((h) => h.origin))]
  const dests = [...new Set(data.leadership.heatmap.map((h) => h.dest))]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('erp04.title')}
        subtitle={t('erp04.subtitle', { date: formatDate(now) })}
        actions={
          <div className="flex gap-2 print:hidden">
            <div role="tablist" aria-label={t('erp04.period')} className="flex rounded-lg border p-0.5">
              {(['today', 'mtd', 'qtd'] as const).map((p) => (
                <button key={p} type="button" role="tab" aria-selected={period === p} onClick={() => setPeriod(p)} className={cn('rounded-md px-3 py-1 text-caption font-medium', period === p && 'bg-primary text-primary-foreground')}>
                  {t(`erp04.p.${p}`)}
                </button>
              ))}
            </div>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> {t('erp04.boardPack')}
            </Button>
          </div>
        }
        className="mb-0"
      />

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6" data-testid="kpis">
        <Link to="/erp/control-tower/jobs">
          <KpiTile label={t('erp04.k.shipments')} value={`${live.booked} / ${live.delivered}`} hint={t('erp04.bookedDelivered')} />
        </Link>
        <Link to="/erp/pricing/margin">
          <KpiTile label={t('erp04.k.revenue')} value={crore(snap.revenue)} hint={t('erp04.margin', { pct: snap.marginPct })} />
        </Link>
        <Link to="/erp/control-tower/at-risk">
          <KpiTile label={t('erp04.k.onTime')} value={`${snap.onTimePct}%`} />
        </Link>
        <Link to="/erp/claims/desk">
          <KpiTile label={t('erp04.k.claims')} value={snap.claimsPer10k.toFixed(1)} hint={t('erp04.per10k')} />
        </Link>
        <Link to="/erp/sales/accounts">
          <KpiTile label={t('erp04.k.active')} value={`${snap.activeCustomers} / ${snap.activePartners}`} hint={t('erp04.customersPartners')} />
        </Link>
        <Link to="/erp/finance/invoicing?tab=collections">
          <KpiTile label={t('erp04.k.cash')} value={formatINR(live.receivables)} hint={t('erp04.cashHint', { payouts: formatINR(live.payouts), cod: formatINR(live.codHeld) })} />
        </Link>
      </div>
      <p className="text-caption text-muted-foreground">{t('erp04.snapshotNote')}</p>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp04.briefing')}>
          <h2 className="flex items-center gap-2 font-heading text-section font-semibold">
            <Bot className="size-5 text-muted-foreground" aria-hidden /> {t('erp04.briefing')} <SimulatedTag />
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5" data-testid="briefing">
            {briefing.map((b, i) => (
              <li key={i}>
                {b.kind === 'booked' && t('erp04.b.booked', { count: b.count, avg: b.avg, date: formatDate(b.date) })}
                {b.kind === 'sos' && t('erp04.b.sos', { count: b.count })}
                {b.kind === 'probation' && t('erp04.b.probation', { partners: b.partners.join(', ') })}
                {b.kind === 'nearProbation' && t('erp04.b.nearProbation', { partners: b.partners.join(', ') })}
                {b.kind === 'overdue' && t('erp04.b.overdue', { customer: b.customer, amount: crore(b.amount), days: b.days })}
                {b.kind === 'codLate' && t('erp04.b.codLate', { partner: b.partner, amount: formatINR(b.amount), hours: b.hours })}
                {b.kind === 'breaches' && t('erp04.b.breaches', { count: b.count })}
                {b.kind === 'gaps' && t('erp04.b.gaps', { count: b.count })}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp04.heatmap')}>
          <h2 className="font-heading text-section font-semibold">{t('erp04.heatmap')}</h2>
          <table className="w-full text-center text-table" data-testid="heatmap">
            <thead>
              <tr className="text-caption text-muted-foreground">
                <th className="text-left">{t('erp04.fromTo')}</th>
                {dests.map((d) => (
                  <th key={d}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regions.map((o) => (
                <tr key={o}>
                  <th className="py-1 text-left font-medium">{o}</th>
                  {dests.map((d) => {
                    const cell = data.leadership.heatmap.find((h) => h.origin === o && h.dest === d)
                    return (
                      <td key={d} className="p-0.5">
                        {cell ? <span className={cn('tabular block rounded-md py-2 font-semibold', heatTone(cell.marginPct))}>{cell.marginPct}%</span> : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp04.network')}>
          <h2 className="font-heading text-section font-semibold">{t('erp04.network')}</h2>
          <div className="flex flex-wrap gap-2" data-testid="tiers">
            {(['platinum', 'gold', 'silver', 'bronze', 'probation'] as const).map((tier) => (
              <span key={tier} className="flex items-center gap-1">
                <TierBadge tier={tier} /> <span className="tabular font-semibold">{health.tiers[tier]}</span>
              </span>
            ))}
            {health.tiers.trial > 0 && <Chip tone="info">{t('erp04.trial', { count: health.tiers.trial })}</Chip>}
          </div>
          <p>
            <Link to="/erp/network/gaps" className="text-primary hover:underline">
              {t('erp04.gaps', { recruit: health.recruit, backup: health.backup })}
            </Link>
          </p>
          <p className="text-caption text-muted-foreground">{health.dwell.length ? t('erp04.dwell', { hub: data.hubs[health.dwell[0].hubId]?.name, hours: health.dwell[0].avgHours }) : t('erp04.noDwell')}</p>
        </section>

        <Scenario base={snap} />
      </div>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('erp04.okrs')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('erp04.okrs')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="okrs">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp04.col.objective')}</th>
              <th>{t('erp04.col.kr')}</th>
              <th>{t('erp04.col.target')}</th>
              <th>{t('erp04.col.actual')}</th>
              <th>{t('erp04.col.owner')}</th>
            </tr>
          </thead>
          <tbody>
            {data.leadership.okrs.map((o) => (
              <tr key={o.id} className="border-b last:border-0" aria-label={o.keyResult}>
                <td className="px-4 py-2">{o.objective}</td>
                <td>{o.keyResult}</td>
                <td className="tabular">{o.target}</td>
                <td>
                  <Chip tone={o.onTrack ? 'success' : 'warning'}>{o.actual}</Chip>
                </td>
                <td>{data.staff[o.ownerId]?.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Scenario({ base }: { base: { revenue: number; marginPct: number } }) {
  const { t } = useTranslation()
  const [x, setX] = useState({ volumePct: 0, fuelPct: 0, partnerCostPct: 0 })
  const r = scenario(base, x)
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card print:hidden" aria-label={t('erp04.scenario')}>
      <h2 className="flex items-center gap-2 font-heading text-section font-semibold">
        {t('erp04.scenario')} <SimulatedTag />
      </h2>
      {(['volumePct', 'fuelPct', 'partnerCostPct'] as const).map((k) => (
        <label key={k} className="flex items-center gap-3">
          <span className="w-40 text-caption">{t(`erp04.s.${k}`)}</span>
          <input type="range" min={-20} max={20} step={1} aria-label={t(`erp04.s.${k}`)} value={x[k]} onChange={(e) => setX({ ...x, [k]: Number(e.target.value) })} className="flex-1 accent-[var(--accent)]" />
          <span className="tabular w-12 text-right">
            {x[k] > 0 ? '+' : ''}
            {x[k]}%
          </span>
        </label>
      ))}
      <p className="tabular" data-testid="scenario-result">
        {t('erp04.s.result', { revenue: crore(r.revenue), pct: r.marginPct, delta: `${r.deltaPts > 0 ? '+' : ''}${r.deltaPts}` })}
      </p>
      <p className="text-caption text-muted-foreground">{t('erp04.s.note')}</p>
    </section>
  )
}
