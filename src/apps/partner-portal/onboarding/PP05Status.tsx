/**
 * PP-05 Application status and network fit — docs/02-partner-portal.md §6.2.
 * Source §4 Phase 1 Step 2: fit → onboarding pack and an Onboarding
 * Coordinator; no fit → waitlist, re-scored monthly. The score is not shown.
 */
import { Download, Loader2, Mail, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { kycChecklist } from '@shared/engines/partnerOnboarding'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import { Button } from '@shared/ui/button'
import { PageHeader } from '@shared/ui/Page'
import { AppStatusChip, useFitText } from '@shared/ui/PartnerOnboardingBits'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { usePartnerSession } from '../usePartnerSession'
import { PartnerOnboardingSteps, usePartnerApplication } from './steps'

export default function PP05Status() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const app = usePartnerApplication()
  const fitText = useFitText()
  const coordinator = useData((d) => (partner.coordinatorId ? d.staff[partner.coordinatorId] : undefined))
  if (!app) return <p className="rounded-xl border bg-card p-6 text-muted-foreground">{t('pp05.none')}</p>

  const invited = !['new', 'waitlisted', 'rejected'].includes(app.status)

  // SIMULATED: the onboarding pack as a text file (process guide, checklist for the type, sample agreement, rate card template)
  const downloadPack = () => {
    const lines = [
      t('pp05.pack.title', { type: partner.type }),
      '',
      `1. ${t('pp05.pack.guide')}`,
      ...['application', 'documents', 'verification', 'agreement', 'setup', 'trial'].map((s, i) => `   ${i + 1}. ${t(`ppOnb.step.${s}`)}`),
      '',
      `2. ${t('pp05.pack.checklist')}`,
      ...kycChecklist(app, partner.type).map((r) => `   [${r.required ? '✓' : t('pp05.pack.optional')}] ${t(`ponb.doc.${r.key}`)}`),
      '',
      `3. ${t('pp05.pack.agreement')}`,
      `4. ${t('pp05.pack.rateCard')}`,
    ]
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `onboarding_pack_type_${partner.type}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={t('pp05.title')} subtitle={t('pp05.subtitle', { ref: app.ref, at: formatDateTime(app.receivedAt) })} className="mb-0" />
      <PartnerOnboardingSteps app={app} current="application" />

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="st-h">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="st-h" className="text-card-title">
            {app.ref}
          </h2>
          <AppStatusChip status={invited ? 'invited' : app.status} />
        </div>
        {app.status === 'new' && (
          <p className="flex items-center gap-2 text-muted-foreground" data-testid="under-review">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t('pp05.underReview')}
          </p>
        )}
        {invited && (
          <div>
            <h3 className="font-semibold">{t('pp05.why')}</h3>
            <p data-testid="fit-reason">{fitText(app)}</p>
          </div>
        )}
        {app.status === 'waitlisted' && (
          <p className="rounded-lg bg-status-warning-bg p-3 text-status-warning" data-testid="waitlist-note">
            {t('pp05.waitlistNote')} {app.rescoreOn && t('pp05.rescoreOn', { date: formatDate(app.rescoreOn) })}
          </p>
        )}
        {app.status === 'rejected' && !app.kycSubmittedAt && (
          <p className="rounded-lg bg-status-danger-bg p-3 text-status-danger">
            {t('pp05.rejected')} {app.decision?.reason}
          </p>
        )}
      </section>

      {invited && (
        <div className="grid gap-4 sm:grid-cols-2">
          {coordinator && (
            <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="co-h">
              <h2 id="co-h" className="text-card-title">
                {t('pp05.coordinator')}
              </h2>
              <p className="flex items-center gap-2 font-semibold">
                <UserRound className="size-4 text-muted-foreground" aria-hidden /> {coordinator.name}
              </p>
              <p className="text-caption text-muted-foreground">{coordinator.title}</p>
              <a href={`mailto:${coordinator.email}`} className="flex items-center gap-2 text-primary hover:underline">
                <Mail className="size-4" aria-hidden /> {coordinator.email}
              </a>
            </section>
          )}
          <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="pk-h">
            <h2 id="pk-h" className="text-card-title">
              {t('pp05.pack.heading')}
            </h2>
            <p className="text-caption text-muted-foreground">{t('pp05.pack.contents')}</p>
            <Button variant="outline" className="self-start" onClick={downloadPack}>
              <Download /> onboarding_pack_type_{partner.type} <SimulatedTag />
            </Button>
          </section>
        </div>
      )}

      {invited && (
        <Button asChild size="lg" className="self-start">
          <Link to="/partner/onboarding/documents">{app.kycSubmittedAt ? t('pp05.viewDocuments') : t('pp05.start')}</Link>
        </Button>
      )}
    </div>
  )
}
