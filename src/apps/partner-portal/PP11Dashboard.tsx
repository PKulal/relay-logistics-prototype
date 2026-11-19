/**
 * PP-11 Dashboard — docs/02-partner-portal.md §6.3.
 * Jobs to accept and assign, today's jobs, capacity, score and tier, payout,
 * COD and alerts. Counts are live from the shared store.
 * Operations sees job / capacity / escalation widgets; Finance sees payout, COD
 * and deductions; Admin sees all.
 */
import { nextPayout, partnerCodOutstanding } from '@shared/engines/payables'
import { AlertTriangle, ArrowRight, BadgeIndianRupee, Gauge, Inbox, ShieldAlert, Siren, UserPlus, Wallet } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { acceptBy, capacityToday, jobEnds, partnerAlerts, partnerLegs, scoreTrend, todayTiles } from '@shared/engines/partnerJobs'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatINR, formatTime } from '@shared/lib/format'
import { person } from '@shared/people'
import { useSimulatedLoading } from '@shared/sim/latency'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { KpiTile } from '@shared/ui/KpiTile'
import { PageHeader } from '@shared/ui/Page'
import { Skeleton } from '@shared/ui/skeleton'
import { TierBadge } from '@shared/ui/TierBadge'
import { AcceptByChip } from './JobBits'
import { usePartnerSession } from './usePartnerSession'
import { activeSos } from '@shared/engines/escalations'

export default function PP11Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const loading = useSimulatedLoading()

  const view = useMemo(() => {
    const legs = partnerLegs(data, partner.id)
    const offered = legs.filter((l) => l.status === 'offered').sort((a, b) => acceptBy(data, a).localeCompare(acceptBy(data, b)))
    return {
      offered,
      toAssign: legs.filter((l) => l.status === 'accepted').length,
      tiles: todayTiles(data, partner.id, now),
      capacity: capacityToday(data, partner.id, now),
      score: scoreTrend(data, partner.id),
      payout: (() => {
        const n = nextPayout(data, partner.id, now)
        return n.payout ?? (n.line ? { net: n.line.net, dueDate: n.date, deductions: n.line.deductions } : undefined)
      })(),
      cod: partnerCodOutstanding(data, partner.id).records,
      escalations: Object.values(data.exceptions).filter((e) => e.ownerPartnerId === partner.id && e.status !== 'resolved'),
      alerts: partnerAlerts(data, partner.id, now),
    }
  }, [data, partner.id, now])

  const ops = user.role !== 'finance'
  const money = user.role !== 'operations'
  const usedPct = view.capacity.capacity ? Math.min(100, Math.round((view.capacity.used / view.capacity.capacity) * 100)) : 0
  const codTotal = view.cod.reduce((s, c) => s + c.amount, 0)

  const sos = activeSos(data.sosAlerts).filter((a) => a.partnerId === partner.id)
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('pp11.title')} subtitle={t('pp11.greeting', { name: user.name.split(' ')[0], partner: partner.shortName })} className="mb-0" />
      {sos.map((a) => (
        <section key={a.id} role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-status-danger bg-status-danger-bg p-4 text-status-danger" data-testid="sos-banner">
          <Siren className="size-6 shrink-0" aria-hidden />
          <p className="flex-1 font-semibold">
            {t('pp11.sos', { name: data.fieldStaff[a.staffId].name, mobile: data.fieldStaff[a.staffId].mobile, time: formatTime(a.at) })}
            <span className="tabular block text-caption font-normal">
              {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
              {a.kind && ` · ${t(`pa12.k.${a.kind}`)}`}
            </span>
          </p>
        </section>
      ))}

      {ops && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          {/* Jobs to accept */}
          <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="accept-h">
            <div className="flex items-center justify-between gap-2">
              <h2 id="accept-h" className="flex items-center gap-2 text-card-title">
                <Inbox className="size-4 text-primary" aria-hidden /> {t('pp11.toAccept', { count: view.offered.length })}
              </h2>
              <Button variant="ghost" size="sm" onClick={() => navigate('/partner/jobs?tab=offered')}>
                {t('pp11.openInbox')} <ArrowRight />
              </Button>
            </div>
            {loading ? (
              <Skeleton className="mt-3 h-24 w-full" />
            ) : view.offered.length === 0 ? (
              <EmptyState title={t('pp11.noOffers')} className="py-6" />
            ) : (
              <ul className="mt-2 divide-y">
                {view.offered.slice(0, 5).map((l) => {
                  const ends = jobEnds(data, l, data.shipments[l.shipmentId])
                  return (
                    <li key={l.id}>
                      <Link to={`/partner/jobs/${l.id}`} className="flex flex-wrap items-center gap-3 py-2.5 hover:bg-accent">
                        <span className="tabular font-semibold text-primary">{l.id}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">
                          {ends.from.name} → {ends.to.name}
                        </span>
                        <AcceptByChip acceptBy={acceptBy(data, l)} now={now} />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <div className="grid gap-4">
            <KpiTile label={t('pp11.toAssign')} value={view.toAssign} icon={UserPlus} loading={loading} onClick={() => navigate('/partner/jobs?tab=accepted')} />
            <section className="rounded-xl border bg-card p-4 shadow-card" aria-labelledby="cap-h">
              <h2 id="cap-h" className="text-caption font-medium text-muted-foreground">
                {t('pp11.capacity')}
              </h2>
              <p className="tabular font-heading text-page-title font-bold">{t('pp11.capacityValue', { used: view.capacity.used, capacity: view.capacity.capacity })}</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100" role="meter" aria-valuemin={0} aria-valuemax={view.capacity.capacity} aria-valuenow={view.capacity.used} aria-label={t('pp11.capacity')}>
                <div className={cn('h-full rounded-full', usedPct > 90 ? 'bg-status-danger' : usedPct > 75 ? 'bg-status-warning' : 'bg-primary')} style={{ width: `${usedPct}%` }} />
              </div>
              {(partner.tier === 'bronze' || partner.tier === 'probation') && <p className="mt-1 text-caption text-muted-foreground">{t(`pp11.tierCap.${partner.tier}`)}</p>}
            </section>
          </div>
        </div>
      )}

      {/* Today's jobs */}
      {ops && (
        <section aria-labelledby="today-h">
          <h2 id="today-h" className="mb-3 text-section">
            {t('pp11.today')}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <KpiTile label={t('pp11.tiles.assigned')} value={view.tiles.assigned} loading={loading} onClick={() => navigate('/partner/jobs?tab=assigned')} />
            <KpiTile label={t('pp11.tiles.inProgress')} value={view.tiles.inProgress} loading={loading} onClick={() => navigate('/partner/jobs?tab=inProgress')} />
            <KpiTile label={t('pp11.tiles.done')} value={view.tiles.done} loading={loading} onClick={() => navigate('/partner/jobs?tab=completed')} />
            <KpiTile label={t('pp11.tiles.failed')} value={view.tiles.failed} loading={loading} hintTone="danger" />
            <KpiTile label={t('pp11.tiles.atRisk')} value={view.tiles.atRisk} loading={loading} className={cn(view.tiles.atRisk > 0 && 'border-status-warning/50')} />
          </div>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Score and tier (everyone) */}
        <section className="rounded-xl border bg-card p-4 shadow-card" aria-labelledby="score-h">
          <h2 id="score-h" className="flex items-center gap-1.5 text-caption font-medium text-muted-foreground">
            <Gauge className="size-4 text-primary" aria-hidden /> {t('pp11.score')}
          </h2>
          <p className="mt-1 flex items-center gap-2">
            <span className="tabular font-heading text-page-title font-bold">{view.score.score}</span>
            <TierBadge tier={view.score.tier} />
          </p>
          {view.score.delta !== null && (
            <p className={cn('text-caption font-semibold', view.score.delta >= 0 ? 'text-status-success' : 'text-status-danger')}>
              {view.score.delta >= 0 ? '↑' : '↓'} {t('pp11.vsLastWeek', { delta: Math.abs(view.score.delta) })}
            </p>
          )}
          {partner.trial && <p className="text-caption text-muted-foreground">{t('pp11.trial', { done: partner.trial.tripsDone, required: partner.trial.tripsRequired })}</p>}
        </section>

        {ops && (
          <KpiTile
            label={t('pp11.escalations')}
            value={view.escalations.length}
            icon={ShieldAlert}
            hint={view.escalations.length === 0 ? t('pp11.none') : undefined}
            loading={loading}
            onClick={() => navigate('/partner/escalations')}
          />
        )}

        {money && (
          <KpiTile
            label={t('pp11.payout')}
            value={view.payout ? formatINR(view.payout.net) : '—'}
            icon={BadgeIndianRupee}
            hint={
              view.payout
                ? t('pp11.payoutOn', { date: formatDate(view.payout.dueDate), deductions: formatINR(view.payout.deductions.reduce((s, d) => s + d.amount, 0)) })
                : t('pp11.noPayout')
            }
            loading={loading}
            onClick={() => navigate('/partner/finance/payouts')}
          />
        )}

        {money && ['A', 'B', 'C'].includes(partner.type) && (
          <KpiTile label={t('pp11.cod')} value={formatINR(codTotal)} icon={Wallet} hint={codTotal === 0 ? t('pp11.noCod') : t('pp11.codDue')} loading={loading} onClick={() => navigate('/partner/finance/cod')} />
        )}
      </div>

      {/* Alerts */}
      <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="alerts-h">
        <h2 id="alerts-h" className="mb-2 flex items-center gap-2 text-card-title">
          <AlertTriangle className="size-4 text-status-warning" aria-hidden /> {t('pp11.alerts')}
        </h2>
        {view.alerts.length === 0 ? (
          <p className="text-muted-foreground">{t('pp11.noAlerts')}</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {view.alerts.map((a, i) => (
              <li key={i} className="flex items-center gap-2">
                <AlertTriangle className="size-4 shrink-0 text-status-warning" aria-hidden />
                {a.kind === 'licenceExpiring' && t('pp11.alert.licence', { name: person(data, a.staffId).name, date: formatDate(a.date) })}
                {a.kind === 'vehicleDocsExpiring' && t('pp11.alert.vehicle', { reg: data.vehicles[a.vehicleId].regNo, date: formatDate(a.date) })}
                {a.kind === 'claimAttributed' && t('pp11.alert.claim', { claim: a.claimId, lr: data.claims[a.claimId].shipmentId })}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
