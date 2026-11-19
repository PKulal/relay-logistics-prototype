/**
 * PP-24 Tier and benefits — docs/02-partner-portal.md. Source §5.3: what each
 * tier gets and what happens if the score falls (Gold: improvement plan).
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { BENEFITS, scoresOf, toNextTier } from '@shared/engines/scoring'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatWeek } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { TierBadge } from '@shared/ui/TierBadge'
import { usePartnerSession } from './usePartnerSession'

export default function PP24Tier() {
  const { t } = useTranslation()
  const { partner, user } = usePartnerSession()
  const data = useData((d) => d)
  const tier = partner.tier ?? 'bronze'
  const history = scoresOf(data, partner.id).slice(-12).reverse()
  const latest = history[0]
  const next = toNextTier(latest?.total ?? partner.score, tier)
  const plan = Object.values(data.improvementPlans)
    .filter((p) => p.partnerId === partner.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Link to="/partner/scorecard" className="w-fit text-caption font-medium text-primary hover:underline">
        ← {t('pp24.back')}
      </Link>
      <PageHeader title={t('pp24.title')} subtitle={t('pp24.subtitle')} className="mb-0" />

      <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-[auto_1fr]" data-testid="tier">
        <div className="flex flex-col items-start gap-2">
          <TierBadge tier={partner.tier} score={partner.score} />
          {!partner.tier && <Chip tone="info">{t('tier.trial')}</Chip>}
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="font-semibold">{t('pp24.benefits')}</h2>
            <ul className="mt-1 flex flex-wrap gap-2" data-testid="benefits">
              {BENEFITS[tier].map((b) => (
                <li key={b} className="rounded-full bg-primary-soft px-3 py-1 text-caption font-medium text-primary">
                  {t(`pp24.b.${b}`)}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-semibold">{t('pp24.ifFalls')}</h2>
            <p data-testid="if-falls">{t(`pp24.falls.${tier}`)}</p>
          </div>
          {next && (
            <div>
              <h2 className="font-semibold">{t('pp24.progress')}</h2>
              <p className="text-caption text-muted-foreground" data-testid="next-tier">
                {next.points > 0 ? t('pp24.toNext', { points: next.points, tier: t(`tier.${next.next}`) }) : t('pp24.reached', { tier: t(`tier.${next.next}`) })}
              </p>
              <div className="mt-1 h-2 w-full max-w-md overflow-hidden rounded-full bg-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(5, 100 - next.points * 10)}%` }} />
              </div>
            </div>
          )}
        </div>
      </section>

      {plan && (
        <section className="flex flex-col gap-2 rounded-xl border-2 border-status-warning bg-status-warning-bg p-5" aria-label={t('pp24.plan')} data-testid="plan">
          <h2 className="font-heading text-section font-semibold">{t('pp24.plan')}</h2>
          <p>{t('pp24.planBody', { deadline: formatDate(plan.deadline), coordinator: data.staff[plan.coordinatorId]?.name ?? plan.coordinatorId })}</p>
          <p>
            {t('pp24.targets')}{' '}
            {plan.targets.map((k) => (
              <Chip key={k} tone="warning" className="mr-1">
                {t(`kpi.${k}`)}
              </Chip>
            ))}
          </p>
          {plan.acknowledgedAt ? (
            <p className="font-medium">{t('pp24.acknowledged', { name: data.partnerUsers[plan.acknowledgedBy!]?.name ?? '', at: formatDateTime(plan.acknowledgedAt) })}</p>
          ) : (
            <Button
              className="self-start"
              onClick={() => {
                useDemoStore.getState().acknowledgePlan(plan.id, user.id)
                toast.success(t('pp24.acked'))
              }}
            >
              {t('pp24.acknowledge')}
            </Button>
          )}
        </section>
      )}

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('pp24.history')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="tier-history">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">{t('pp23.col.week')}</th>
              <th className="text-right">{t('pp24.score')}</th>
              <th>{t('pp23.col.tier')}</th>
              <th>{t('pp24.change')}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((w) => (
              <tr key={w.id} className="border-b last:border-0" aria-label={formatWeek(w.week)}>
                <td className="tabular px-4 py-2">{formatWeek(w.week)}</td>
                <td className="tabular text-right">{w.total.toFixed(1)}</td>
                <td>
                  <TierBadge tier={w.tierAfter} />
                </td>
                <td>{w.tierBefore !== w.tierAfter ? t('pp24.changed', { from: t(`tier.${w.tierBefore ?? 'bronze'}`), to: t(`tier.${w.tierAfter ?? 'bronze'}`) }) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
