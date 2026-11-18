import { useTranslation } from 'react-i18next'
import { useFlags } from '@shared/hooks/useDemo'
import { cn } from '@/shared/lib/utils'

/**
 * "Simulated" tag for AI outputs and fake integrations (design-system.md §7).
 * Renders only while the demo toolbar's "Show simulation labels" switch is on.
 */
export function SimulatedTag({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { showSimulationLabels } = useFlags()
  if (!showSimulationLabels) return null
  return (
    <span className={cn('inline-flex items-center rounded bg-brand-amber/30 px-1.5 py-px text-[11px] font-semibold text-ink', className)}>
      {t('common.simulated')}
    </span>
  )
}
