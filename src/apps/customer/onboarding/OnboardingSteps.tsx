/**
 * Step bar for the customer's onboarding (source §6 phases), shown on CP-05
 * to CP-07. The full tracker with the pilot report is CP-10 (Part 3b).
 */
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import type { Customer } from '@shared/types'
import { onboardingSteps } from './steps'

export function OnboardingSteps({ customer, current }: { customer: Customer; current: string }) {
  const { t } = useTranslation()
  const steps = onboardingSteps(customer)
  return (
    <nav aria-label={t('onb.steps')} className="mb-6">
      <ol className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <li key={s.key}>
            {s.path && s.state !== 'pending' ? (
              <Link
                to={s.path}
                aria-current={s.key === current ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption font-medium',
                  s.key === current ? 'border-primary bg-primary text-primary-foreground' : s.state === 'done' ? 'border-status-success bg-status-success-bg text-status-success' : 'bg-card',
                )}
              >
                {s.state === 'done' ? <Check className="size-3.5" aria-hidden /> : <span className="tabular">{i + 1}</span>} {t(`onb.step.${s.key}`)}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-gray-50 px-3 py-1 text-caption text-muted-foreground">
                <span className="tabular">{i + 1}</span> {t(`onb.step.${s.key}`)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
