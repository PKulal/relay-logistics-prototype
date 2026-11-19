/**
 * PP-10 Onboarding tracker and monitored trial — docs/02-partner-portal.md §6.2.
 * Source §4 Phase 5 Steps 7–8: every onboarding step, then the trial (10 live
 * parcel jobs or 3 PTL / line-haul trips, each scored, AI anomaly flags);
 * score ≥ 80 → go-live at Bronze. Target: 5 business days plus the trial.
 */
import { AlertTriangle, Check, CircleDashed, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { needsHubAudit } from '@shared/engines/partnerOnboarding'
import { formatDate } from '@shared/lib/format'
import { PageHeader } from '@shared/ui/Page'
import { TrialPanel } from '@shared/ui/PartnerOnboardingBits'
import type { PartnerApplication, Partner } from '@shared/types'
import { usePartnerSession } from '../usePartnerSession'
import { stageOf, STEP_PATH, usePartnerApplication } from './steps'

type State = 'done' | 'inProgress' | 'pending' | 'actionNeeded'
interface Row {
  key: string
  state: State
  path?: string
  note?: string
}

function trackerRows(a: PartnerApplication, p: Partner, t: TFunction): Row[] {
  const at = stageOf(a)
  const flagged = a.documents.some((d) => d.status === 'flagged')
  const openConditions = a.outcome?.conditions.filter((c) => !c.closedAt) ?? []
  const g = a.agreement
  const audit = needsHubAudit(p.type, a.hubs.length)
  return [
    { key: 'application', state: 'done', path: STEP_PATH.application, note: t('pp10.note.ref', { ref: a.ref }) },
    {
      key: 'fit',
      state: a.status === 'new' ? 'inProgress' : a.status === 'waitlisted' || (a.status === 'rejected' && !a.kycSubmittedAt) ? 'actionNeeded' : 'done',
      path: STEP_PATH.application,
      note: a.status === 'waitlisted' ? t('ponb.appStatus.waitlisted') : undefined,
    },
    {
      key: 'documents',
      state: at < 1 ? 'pending' : flagged ? 'actionNeeded' : a.kycSubmittedAt ? 'done' : 'inProgress',
      path: at >= 1 ? STEP_PATH.documents : undefined,
      note: flagged ? t('pp10.note.flagged') : undefined,
    },
    {
      key: 'verification',
      state: !a.kycSubmittedAt ? 'pending' : openConditions.length ? 'actionNeeded' : at >= 3 ? 'done' : audit && !a.hubAudit ? 'actionNeeded' : 'inProgress',
      path: a.kycSubmittedAt ? STEP_PATH.verification : undefined,
      note: openConditions.length ? t('pp10.note.conditions', { count: openConditions.length, date: formatDate(openConditions[0].due) }) : audit && !a.hubAudit && at === 2 ? t('pp10.note.bookAudit') : undefined,
    },
    {
      key: 'agreement',
      state: at < 3 ? 'pending' : g?.lines.some((l) => l.status === 'notAccepted' && !l.counter) ? 'actionNeeded' : at >= 4 ? 'done' : g?.status === 'issued' ? 'actionNeeded' : 'inProgress',
      path: at >= 3 ? STEP_PATH.agreement : undefined,
      note: g?.lines.some((l) => l.status === 'notAccepted' && !l.counter) ? t('pp10.note.revise') : at === 3 && g?.status === 'issued' ? t('pp10.note.sign') : undefined,
    },
    { key: 'setup', state: at < 4 ? 'pending' : at >= 5 ? 'done' : 'inProgress', path: at >= 4 ? STEP_PATH.setup : undefined },
    {
      key: 'trial',
      state: at < 5 ? 'pending' : at >= 6 ? 'done' : 'inProgress',
      note: p.trial ? t(`ponb.trial.progress.${p.trial.unit ?? 'trips'}`, { done: p.trial.tripsDone, required: p.trial.tripsRequired }) : undefined,
    },
    { key: 'live', state: at >= 6 ? 'done' : 'pending', note: at >= 6 ? t('pp10.note.bronze') : undefined },
  ]
}

const ICON: Record<State, React.ReactNode> = {
  done: <Check className="size-4 text-status-success" aria-hidden />,
  inProgress: <Loader2 className="size-4 text-status-info" aria-hidden />,
  pending: <CircleDashed className="size-4 text-muted-foreground" aria-hidden />,
  actionNeeded: <AlertTriangle className="size-4 text-status-warning" aria-hidden />,
}

export default function PP10Tracker() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const app = usePartnerApplication()
  if (!app) return <p className="rounded-xl border bg-card p-6 text-muted-foreground">{t('pp05.none')}</p>
  const rows = trackerRows(app, partner, t)

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <PageHeader title={t('pp10.title')} subtitle={t('pp10.subtitle')} className="mb-0" />
      <ol className="flex flex-col divide-y rounded-xl border bg-card shadow-card" data-testid="tracker">
        {rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-3 px-5 py-3" aria-label={t(`pp10.step.${r.key}`)}>
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gray-50">{ICON[r.state]}</span>
            <div className="flex flex-1 flex-col">
              <span className="font-medium">
                {i + 1}. {r.path ? (
                  <Link to={r.path} className="text-primary hover:underline">
                    {t(`pp10.step.${r.key}`)}
                  </Link>
                ) : (
                  t(`pp10.step.${r.key}`)
                )}
              </span>
              {r.note && <span className="text-caption text-muted-foreground">{r.note}</span>}
            </div>
            <span className={cn('text-caption font-medium', r.state === 'actionNeeded' ? 'text-status-warning' : r.state === 'done' ? 'text-status-success' : 'text-muted-foreground')}>{t(`pp10.state.${r.state}`)}</span>
          </li>
        ))}
      </ol>
      <TrialPanel partner={partner} />
    </div>
  )
}
