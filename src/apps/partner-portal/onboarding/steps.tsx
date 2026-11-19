/**
 * Partner onboarding steps (source §4 Phases 1–5) and the step bar shown on
 * PP-05 to PP-09. The full tracker with the trial panel is PP-10.
 */
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
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

export type StepKey = 'application' | 'documents' | 'verification' | 'agreement' | 'setup' | 'trial'
const ORDER: PartnerApplication['status'][] = ['new', 'invited', 'kyc', 'agreement', 'integration', 'trial', 'live']

export const STEP_PATH: Record<StepKey, string> = {
  application: '/partner/onboarding/application',
  documents: '/partner/onboarding/documents',
  verification: '/partner/onboarding/verification',
  agreement: '/partner/onboarding/agreement',
  setup: '/partner/onboarding/setup',
  trial: '/partner/onboarding',
}

/** Where the application is: 0 applied … 6 live (waitlisted / rejected count as applied). */
export const stageOf = (a: PartnerApplication) => ORDER.indexOf(a.status === 'waitlisted' || a.status === 'rejected' ? 'new' : a.status)

export function partnerSteps(a: PartnerApplication): { key: StepKey; state: 'done' | 'current' | 'pending' }[] {
  const at = stageOf(a)
  const state = (doneFrom: number, from: number) => (at >= doneFrom ? 'done' : at >= from ? 'current' : 'pending')
  return [
    { key: 'application', state: at === 0 ? 'current' : 'done' },
    { key: 'documents', state: a.kycSubmittedAt ? 'done' : state(2, 1) },
    { key: 'verification', state: state(3, 2) },
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
        {partnerSteps(app).map((s, i) =>
          s.state !== 'pending' ? (
            <li key={s.key}>
              <Link
                to={STEP_PATH[s.key]}
                aria-current={s.key === current ? 'step' : undefined}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-caption font-medium',
                  s.key === current ? 'border-primary bg-primary text-primary-foreground' : s.state === 'done' ? 'border-status-success bg-status-success-bg text-status-success' : 'bg-card',
                )}
              >
                {s.state === 'done' ? <Check className="size-3.5" aria-hidden /> : <span className="tabular">{i + 1}</span>} {t(`ppOnb.step.${s.key}`)}
              </Link>
            </li>
          ) : (
            <li key={s.key}>
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-gray-50 px-3 py-1 text-caption text-muted-foreground">
                <span className="tabular">{i + 1}</span> {t(`ppOnb.step.${s.key}`)}
              </span>
            </li>
          ),
        )}
      </ol>
    </nav>
  )
}
