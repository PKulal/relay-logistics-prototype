/**
 * ERP-15 Partner directory and Partner 360 — docs/04-erp-control-tower.md.
 * Source §11 Dept 5 (onboarding, scorecards, tiers, contracts), §12 (partner
 * churn risk: SIMULATED AI). One page per partner (?partner=ID).
 */
import { ArrowLeft, Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/shared/lib/utils'
import { directory, partnerChurn, type DirectoryStatus } from '@shared/engines/partnerDirectory'
import { docRegister } from '@shared/engines/partnerSettings'
import { KPI_KEYS, kpiPct, scoresOf } from '@shared/engines/scoring'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR, formatWeek } from '@shared/lib/format'
import type { Partner } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { TierBadge } from '@shared/ui/TierBadge'
import type { Tone } from '@shared/ui/tones'

const STATUS_TONE: Record<DirectoryStatus, Tone> = { onboarding: 'info', trial: 'info', live: 'success', probation: 'warning', suspended: 'danger', offboarded: 'neutral' }
const CHURN_TONE = { low: 'success', medium: 'warning', high: 'danger' } as const
const TABS = ['overview', 'performance', 'jobs', 'money', 'documents', 'contract'] as const

export default function ERP15Partners() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const open = data.partners[params.get('partner') ?? '']
  if (open) return <Partner360 partner={open} onBack={() => setParams({})} />
  const rows = directory(data, now).filter((r) => !q.trim() || `${r.partner.name} ${r.partner.city} ${r.partner.type}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp15.title')} subtitle={t('erp15.subtitle', { count: rows.length })} className="mb-0" />
      <label className="relative max-w-sm">
        <span className="sr-only">{t('erp15.search')}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input className="pl-9" placeholder={t('erp15.search')} value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="partner-directory">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('erp15.col.partner')}</th>
              <th>{t('erp15.col.type')}</th>
              <th>{t('erp15.col.tier')}</th>
              <th>{t('erp15.col.legs')}</th>
              <th>{t('erp15.col.coverage')}</th>
              <th>{t('erp15.col.capacity')}</th>
              <th>{t('erp15.col.status')}</th>
              <th>{t('erp15.col.docs')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.partner.id} className="border-b last:border-0" aria-label={r.partner.shortName}>
                <td className="px-4 py-2">
                  <button type="button" className="font-medium text-primary hover:underline" onClick={() => setParams({ partner: r.partner.id })}>
                    {r.partner.shortName}
                  </button>
                  <span className="block text-caption text-muted-foreground">{r.partner.city}</span>
                </td>
                <td>{r.partner.type}</td>
                <td>{r.partner.tier ? <TierBadge tier={r.partner.tier} score={r.partner.score} /> : <Chip tone="info">{t('tier.trial')}</Chip>}</td>
                <td className="text-caption">{r.partner.legs.map((l) => t(`legType.${l}`)).join(', ')}</td>
                <td className="tabular text-caption">{t('erp15.coverage', { cities: r.cities, lanes: r.lanes })}</td>
                <td className={cn('tabular', r.capacityPct > 90 && 'font-semibold text-status-danger')}>{r.capacityPct}%</td>
                <td>
                  <Chip tone={STATUS_TONE[r.status]}>{t(`erp15.st.${r.status}`)}</Chip>
                </td>
                <td className={cn('tabular', r.docsDue > 0 && 'font-semibold text-status-warning')}>{r.docsDue || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Partner360({ partner: p, onBack }: { partner: Partner; onBack: () => void }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [tab, setTab] = useState<(typeof TABS)[number]>('overview')
  const churn = partnerChurn(data, p.id, now)
  const coordinator = p.coordinatorId ? data.staff[p.coordinatorId] : undefined

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="flex w-fit items-center gap-1 text-caption font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> {t('erp15.back')}
      </button>
      <PageHeader
        title={p.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {t('partner.typeShort', { type: p.type })} · {p.city}
            {p.tier && <TierBadge tier={p.tier} score={p.score} />}
            <span className="flex items-center gap-1">
              {t('erp15.churn')} <Chip tone={CHURN_TONE[churn.level]}>{t(`erp15.risk.${churn.level}`)}</Chip>
              {churn.reasons.length > 0 && <span className="text-caption text-muted-foreground">({churn.reasons.map((r) => t(`erp15.why.${r}`)).join(', ')})</span>}
              <SimulatedTag />
            </span>
          </span>
        }
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/erp/partners/scoring">{t('erp15.plan')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/erp/partners/suspensions">{t('erp15.suspension')}</Link>
            </Button>
          </div>
        }
        className="mb-0"
      />
      <div role="tablist" aria-label={p.shortName} className="flex w-fit flex-wrap rounded-lg border bg-card p-0.5">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn('rounded-md px-3 py-1 text-caption font-medium', tab === k && 'bg-primary text-primary-foreground')}>
            {t(`erp15.tab.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp15.contacts')}>
            <h2 className="mb-2 font-heading text-section font-semibold">{t('erp15.contacts')}</h2>
            <ul className="flex flex-col gap-1">
              {Object.values(data.partnerUsers)
                .filter((u) => u.partnerId === p.id)
                .map((u) => (
                  <li key={u.id}>
                    {u.name} · {t(`roles.partner.${u.role}`)} <span className="tabular text-caption text-muted-foreground">· {u.mobile}</span>
                  </li>
                ))}
            </ul>
            <p className="mt-2 text-caption text-muted-foreground">{t('erp15.coordinator', { name: coordinator?.name ?? '—' })}</p>
          </section>
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp15.coverageTitle')}>
            <h2 className="mb-2 font-heading text-section font-semibold">{t('erp15.coverageTitle')}</h2>
            <p>{[...new Set(p.coveragePincodes.map((c) => data.pincodes[c]?.city).filter(Boolean))].join(', ') || '—'}</p>
            <p className="text-caption text-muted-foreground">{p.laneIds.map((id) => `${data.lanes[id]?.originRegion} → ${data.lanes[id]?.destRegion}`).join(' · ')}</p>
            <p className="mt-2">{t('erp15.capacityIs', { n: p.capacityPerDay })}</p>
          </section>
        </div>
      )}

      {tab === 'performance' && <Performance partner={p} />}

      {tab === 'jobs' && (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="partner-jobs">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp15.col.job')}</th>
                <th>LR</th>
                <th>{t('erp15.col.leg')}</th>
                <th>{t('erp15.col.window')}</th>
                <th>{t('erp15.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(data.legs)
                .filter((l) => l.partnerId === p.id)
                .sort((a, b) => b.window.from.localeCompare(a.window.from))
                .slice(0, 30)
                .map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="tabular px-4 py-1.5">{l.id}</td>
                    <td>
                      <Link to={`/erp/shipments/${l.shipmentId}`} className="tabular text-primary hover:underline">
                        {l.shipmentId}
                      </Link>
                    </td>
                    <td>{t(`legType.${l.type}`)}</td>
                    <td className="tabular text-caption">{formatDateTime(l.window.to)}</td>
                    <td>{t(`status.leg.${l.status}`)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'money' && (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="partner-money">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('erp15.col.payout')}</th>
                <th>{t('erp15.col.gross')}</th>
                <th>{t('erp15.col.deductions')}</th>
                <th>{t('erp15.col.net')}</th>
                <th>{t('erp15.col.due')}</th>
                <th>UTR</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(data.payouts)
                .filter((x) => x.partnerId === p.id)
                .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
                .map((x) => (
                  <tr key={x.id} className="border-b last:border-0">
                    <td className="tabular px-4 py-1.5">{x.id}</td>
                    <td className="tabular">{formatINR(x.gross)}</td>
                    <td className="tabular">{formatINR(x.deductions.reduce((s, d) => s + d.amount, 0))}</td>
                    <td className="tabular font-medium">{formatINR(x.net)}</td>
                    <td className="tabular">{formatDate(x.dueDate)}</td>
                    <td className="tabular text-caption">{x.utr ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'documents' && (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="partner-docs">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp32.col.doc')}</th>
                <th>{t('pp32.col.owner')}</th>
                <th>{t('pp32.col.expiry')}</th>
                <th>{t('pp32.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {docRegister(data, p.id, now).map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-1.5">{t(`pp32.kind.${r.kind}`)}</td>
                  <td>{r.ownerName}</td>
                  <td className="tabular">{r.expiry ? formatDate(r.expiry) : '—'}</td>
                  <td>
                    <Chip tone={r.status === 'valid' ? 'success' : r.status === 'expired' ? 'danger' : r.status === 'expiring' ? 'warning' : 'info'}>{t(`pp32.state.${r.status}`)}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'contract' && (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <p className="px-4 pt-4">{p.profile ? t('pp33.signed', { date: formatDate(p.profile.agreementSignedOn) }) : t('erp15.noContract')}</p>
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="partner-rates">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp33.col.leg')}</th>
                <th>{t('pp33.col.where')}</th>
                <th>{t('pp33.col.rate')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(data.partnerRates)
                .filter((r) => r.partnerId === p.id)
                .map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-1.5">{t(`legType.${r.legType}`)}</td>
                    <td>{data.lanes[r.laneOrCluster] ? `${data.lanes[r.laneOrCluster].originRegion} → ${data.lanes[r.laneOrCluster].destRegion}` : (data.hubs[r.laneOrCluster]?.name ?? r.laneOrCluster)}</td>
                    <td className="tabular">
                      {formatINR(r.rate)} {t(`ponb.rateUnit.${r.unit}`)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function Performance({ partner: p }: { partner: Partner }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const scores = scoresOf(data, p.id).filter((w) => w.published)
  if (!scores.length) return <p className="text-muted-foreground">{t('erp15.noScores')}</p>
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp15.tab.performance')}>
      <div className="h-64" data-testid="perf-chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={scores.map((w) => ({ week: formatWeek(w.week), total: w.total, ...Object.fromEntries(KPI_KEYS.map((k) => [k, kpiPct(w.kpis, k)])) }))}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
            <YAxis width={32} tick={{ fontSize: 11 }} domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Line dataKey="total" name={t('pp23.total')} stroke="var(--accent)" strokeWidth={3} dot={false} isAnimationActive={false} />
            {KPI_KEYS.slice(0, 3).map((k, i) => (
              <Line key={k} dataKey={k} name={t(`kpi.short.${k}`)} stroke={['#64748b', '#94a3b8', '#cbd5e1'][i]} dot={false} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <h3 className="mt-3 font-semibold">{t('erp15.tierHistory')}</h3>
      <ul className="flex flex-wrap gap-2 text-caption">
        {scores.slice(-8).map((w) => (
          <li key={w.week} className="flex items-center gap-1">
            {formatWeek(w.week)} <TierBadge tier={w.tierAfter ?? 'bronze'} score={w.total} />
          </li>
        ))}
      </ul>
    </section>
  )
}
