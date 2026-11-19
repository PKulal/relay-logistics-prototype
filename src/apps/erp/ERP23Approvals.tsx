/**
 * ERP-23 Discount and rate approvals — docs/04-erp-control-tower.md §6.6.
 * Source §11 Pricing "discount approvals": rate cards with lines below the
 * target margin wait here for the Pricing Head.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cardMargins, linesBelowTarget } from '@shared/engines/rateCardMargin'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { CustomerRateCard } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { PageHeader } from '@shared/ui/Page'
import { RadioGroup, RadioGroupItem } from '@shared/ui/radio-group'
import { useErpSession } from './useErpSession'

export default function ERP23Approvals() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const pending = Object.values(data.rateCards).filter((c) => c.status === 'pendingApproval')
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('erp23.title')} subtitle={t('erp23.subtitle', { count: pending.length })} className="mb-0" />
      {pending.length === 0 && <p className="rounded-xl border bg-card p-6 text-muted-foreground">{t('erp23.empty')}</p>}
      {pending.map((c) => (
        <Approval key={c.id} card={c} />
      ))}
    </div>
  )
}

function Approval({ card }: { card: CustomerRateCard }) {
  const { t } = useTranslation()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const below = useMemo(() => linesBelowTarget(cardMargins(data, card)), [data, card])
  const [decision, setDecision] = useState<'approve' | 'reject' | 'sendBack'>('approve')
  const [comment, setComment] = useState('')
  const canDecide = user.role === 'pricing'
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-label={card.name}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link to={`/erp/pricing/rate-cards/${card.id}`} className="text-card-title text-primary hover:underline">
          {card.name}
        </Link>
        <span className="text-caption text-muted-foreground">
          {t('erp23.requested', { name: data.staff[card.approval?.requestedBy ?? '']?.name ?? '—', at: card.approval ? formatDateTime(card.approval.requestedAt) : '' })}
        </span>
      </div>
      <table className="w-full text-table" data-testid="below-target">
        <thead>
          <tr className="border-b text-left text-caption text-muted-foreground">
            <th className="py-2">{t('erp23.line')}</th>
            <th className="text-right">{t('erp23.margin')}</th>
            <th className="text-right">{t('erp23.target')}</th>
            <th className="text-right">{t('erp23.gap')}</th>
          </tr>
        </thead>
        <tbody>
          {below.map((l) => (
            <tr key={l.key} className="tabular border-b last:border-0">
              <td className="py-2">
                {l.kind === 'ptl'
                  ? `${data.lanes[l.laneId]?.originRegion} → ${data.lanes[l.laneId]?.destRegion} · ${t(`service.${l.service}`)}`
                  : `${t('cp08.zone')} ${l.zone} (${t(`cp08.zoneName.${l.zone}`)}) · ${t(`service.${l.tier}`)}`}
              </td>
              <td className="text-right">{l.m.marginPct.toFixed(1)}%</td>
              <td className="text-right">{data.settings.targetMarginPct}%</td>
              <td className="text-right text-status-danger">{t('erp23.pts', { n: l.m.gap.toFixed(1) })}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <RadioGroup value={decision} onValueChange={(v) => setDecision(v as typeof decision)} className="flex flex-wrap gap-4" aria-label={t('erp23.decision')}>
        {(['approve', 'reject', 'sendBack'] as const).map((d) => (
          <label key={d} className="flex items-center gap-2">
            <RadioGroupItem value={d} /> {t(`erp22.decision.${d}`)}
          </label>
        ))}
      </RadioGroup>
      <Input aria-label={t('erp23.comment')} placeholder={t('erp23.comment')} value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button className="self-start" disabled={!canDecide || (decision !== 'approve' && !comment.trim())} onClick={() => (useDemoStore.getState().decideRateCard(card.id, decision, comment, user.id), toast.success(t('erp23.done')))}>
        {t('erp23.decide')}
      </Button>
      {!canDecide && <p className="text-caption text-muted-foreground">{t('erp23.pricingOnly')}</p>}
    </section>
  )
}
