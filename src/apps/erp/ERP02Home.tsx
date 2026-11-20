/**
 * ERP-02 Home — docs/04-erp-control-tower.md. Source §11 (departments), §12
 * (AI briefing, guardrails: a person approves). Role cards, the approvals
 * inbox (maker-checker items for this role) and the daily AI briefing.
 * Control Tower and Leadership start on their own boards (ERP-05, ERP-04).
 */
import { Bot, CheckSquare, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { dailyBriefing } from '@shared/engines/departments'
import { approvals, homeCards } from '@shared/engines/erpHome'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import { KpiTile } from '@shared/ui/KpiTile'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import { useErpSession } from './useErpSession'

export default function ERP02Home() {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const cards = homeCards(data, user.role, now)
  const inbox = approvals(data, user.role)
  const briefing = dailyBriefing(data, now)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp02.hello', { name: user.name.split(' ')[0] })} subtitle={t('erp02.subtitle', { role: t(`roles.erp.${user.role}`), date: formatDate(now) })} className="mb-0" />
      {cards.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3" data-testid="home-cards">
          {cards.map((c) => (
            <Link key={c.key} to={c.to}>
              <KpiTile label={t(`erp02.card.${c.key}`)} value={String(c.value)} hint={c.tone === 'danger' && c.value ? t('erp02.act') : undefined} />
            </Link>
          ))}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        <section id="approvals" className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp02.approvals')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            <CheckSquare className="size-5 text-muted-foreground" aria-hidden /> {t('erp02.approvals')} <Chip tone={inbox.length ? 'warning' : 'success'}>{inbox.length}</Chip>
          </h2>
          {inbox.length === 0 ? (
            <p className="text-muted-foreground">{t('erp02.noApprovals')}</p>
          ) : (
            <ul className="flex flex-col divide-y" data-testid="approvals">
              {inbox.map((a, i) => (
                <li key={i}>
                  <Link to={a.to} className="flex items-center gap-2 py-2 hover:text-primary">
                    <Chip tone="info">{t(`erp02.kind.${a.kind}`)}</Chip>
                    <span className="flex-1">{a.ref}</span>
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5 shadow-card" aria-label={t('erp04.briefing')}>
          <h2 className="mb-2 flex items-center gap-2 font-heading text-section font-semibold">
            <Bot className="size-5 text-muted-foreground" aria-hidden /> {t('erp04.briefing')} <SimulatedTag />
          </h2>
          <ul className="flex list-disc flex-col gap-1 pl-5">
            {briefing.map((b, i) => (
              <li key={i}>
                {b.kind === 'booked' && t('erp04.b.booked', { count: b.count, avg: b.avg, date: formatDate(b.date) })}
                {b.kind === 'sos' && t('erp04.b.sos', { count: b.count })}
                {b.kind === 'probation' && t('erp04.b.probation', { partners: b.partners.join(', ') })}
                {b.kind === 'nearProbation' && t('erp04.b.nearProbation', { partners: b.partners.join(', ') })}
                {b.kind === 'overdue' && t('erp04.b.overdue', { customer: b.customer, amount: formatINR(b.amount), days: b.days })}
                {b.kind === 'codLate' && t('erp04.b.codLate', { partner: b.partner, amount: formatINR(b.amount), hours: b.hours })}
                {b.kind === 'breaches' && t('erp04.b.breaches', { count: b.count })}
                {b.kind === 'gaps' && t('erp04.b.gaps', { count: b.count })}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
