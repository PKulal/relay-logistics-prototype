import { CircleAlert, Diamond } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import type { Tier } from '@shared/types'

/** design-system.md §3, "Partner tier badges" */
const TIER_CLASS: Record<Tier, string> = {
  platinum: 'bg-tier-platinum-bg text-tier-platinum',
  gold: 'bg-tier-gold-bg text-tier-gold',
  silver: 'bg-tier-silver-bg text-tier-silver',
  bronze: 'bg-tier-bronze-bg text-tier-bronze',
  probation: 'bg-status-danger-bg text-status-danger',
}

/** Partner tier, optionally with the score: "Gold 86". `null` = in trial (no tier yet). */
export function TierBadge({ tier, score, className }: { tier: Tier | null; score?: number; className?: string }) {
  const { t } = useTranslation()
  if (!tier) {
    return (
      <span className={cn('inline-flex items-center rounded-full bg-status-info-bg px-2 py-0.5 text-caption font-medium text-status-info', className)}>
        {t('tier.trial')}
        {score !== undefined && <span className="tabular ml-1">{score}</span>}
      </span>
    )
  }
  const Icon = tier === 'platinum' ? Diamond : tier === 'probation' ? CircleAlert : null
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold', TIER_CLASS[tier], className)}>
      {Icon && <Icon className="size-3.5" aria-hidden />}
      {t(`tier.${tier}`)}
      {score !== undefined && <span className="tabular font-medium">{score}</span>}
    </span>
  )
}
