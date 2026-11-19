/**
 * Partner onboarding steps (source §4 Phases 1–4) and the step bar shown on
 * PP-05 to PP-07. Agreement, go-live setup and the trial (PP-08 to PP-10)
 * come in Part 4b.
 */
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { useData } from '@shared/hooks/useDemo'
import type { PartnerApplication } from '@shared/types'
import { usePartnerSession } from '../usePartnerSession'

/** The partner's application (the latest one). */
export function usePartnerApplication(): PartnerApplication | undefined {
  const { partner } = usePartnerSession()
  return useData((d) =>
    Object.values(d.applications)
      .filter((a) => a.partnerId === partner.id)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))[0],
  )
}

type StepKey = 'application' | 'documents' | 'verification' | 'agreement' | 'setup' | 'trial'
const ORDER: PartnerApplication['status'][] = ['new', 'invited', 'kyc', 'agreement', 'integration', 'trial', 'live']

export function partnerSteps(a: PartnerApplication): { key: StepKey; path?: string; state: 'done' | 'current' | 'pending' }[] {
  const at = ORDER.indexOf(a.status === 'waitlisted' || a.status === 'rejected' ? 'new' : a.status)
  const state = (doneFrom: number, from: number) => (at >= doneFrom ? 'done' : at >= from ? 'current' : 'pending')
  return [
    { key: 'application', path: '/partner/onboarding/application', state: a.status === 'new' || a.status === 'waitlisted' || a.status === 'rejected' ? 'current' : 'done' },
    { key: 'documents', path: '/partner/onboarding/documents', state: a.kycSubmittedAt ? 'done' : state(2, 1) },
    { key: 'verification', path: '/partner/onboarding/verification', state: state(3, 2) },
    { key: 'agreement', state: state(4, 3) },
    { key: 'setup', state: state(5, 4) },
    { key: 'trial', state: state(6, 5) },
  ]
}

export function PartnerOnboardingSteps({ app, current }: { app: PartnerApplication; current: StepKey }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('onb.steps')} className="mb-6">
      <ol className="flex flex-wrap gap-2">
        {partnerSteps(app).map((s, i) => (
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
                {s.state === 'done' ? <Check className="size-3.5" aria-hidden /> : <span className="tabular">{i + 1}</span>} {t(`ppOnb.step.${s.key}`)}
              </Link>
            ) : (
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption', s.state === 'done' ? 'border-status-success bg-status-success-bg text-status-success' : 'bg-gray-50 text-muted-foreground')}>
                {s.state === 'done' ? <Check className="size-3.5" aria-hidden /> : <span className="tabular">{i + 1}</span>} {t(`ppOnb.step.${s.key}`)}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/** /partner/onboarding: open the step the partner is on (the PP-10 tracker replaces this in Part 4b). */
export function OnboardingHome() {
  const app = usePartnerApplication()
  if (!app) return <Navigate to="/partner/onboarding/application" replace />
  const to = ['new', 'waitlisted', 'rejected'].includes(app.status) && !app.kycSubmittedAt ? 'application' : app.status === 'invited' ? 'documents' : 'verification'
  return <Navigate to={`/partner/onboarding/${to}`} replace />
}
