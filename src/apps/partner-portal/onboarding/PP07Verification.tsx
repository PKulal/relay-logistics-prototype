/**
 * PP-07 Verification outcome and hub audit — docs/02-partner-portal.md §6.2.
 * Source §4 Phase 2 Step 4: flagged cases are reviewed by Partner Management;
 * Type F (and Type E with a hub) get a site audit with geo-tagged photos —
 * security, CCTV, fire safety, docks, scale calibration — within 5 days.
 * Outcome: Approved / Conditionally approved / Rejected with reasons.
 * Left out under the scope rule: the corrective-actions table and the 90-day
 * re-apply rule (conditions close by re-uploading the document on PP-06).
 */
import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { AUDIT_ITEMS, AUDIT_WITHIN_DAYS, needsHubAudit } from '@shared/engines/partnerOnboarding'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import { addDaysToDate, istDate } from '@shared/lib/time'
import { photoThumb } from '@shared/sim/photos'
import { useDemoStore } from '@shared/store'
import type { PartnerApplication } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { ResultChip, useConditionText } from '@shared/ui/PartnerOnboardingBits'
import { Chip } from '@shared/ui/StatusChip'
import { usePartnerSession } from '../usePartnerSession'
import { PartnerOnboardingSteps, usePartnerApplication } from './steps'

export default function PP07Verification() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const app = usePartnerApplication()
  const condText = useConditionText()
  if (!app) return null
  const o = app.outcome
  const audit = needsHubAudit(partner.type, app.hubs.length)

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <PageHeader title={t('pp07.title')} className="mb-0" />
      <PartnerOnboardingSteps app={app} current="verification" />

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="out-h" data-testid="outcome">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="out-h" className="text-card-title">
            {t('pp07.outcome')}
          </h2>
          {o && <ResultChip result={o.result} />}
        </div>
        {!app.kycSubmittedAt && (
          <p className="text-muted-foreground">
            {t('pp07.submitFirst')}{' '}
            <Link to="/partner/onboarding/documents" className="text-primary hover:underline">
              {t('pp07.goDocuments')}
            </Link>
          </p>
        )}
        {app.kycSubmittedAt && !o && <p className="text-muted-foreground">{t('pp07.underReview')}</p>}
        {o && <p className="text-caption text-muted-foreground">{t('pp07.decidedOn', { at: formatDateTime(o.at) })}</p>}
        {o?.result === 'rejected' && o.reasons && <p className="rounded-lg bg-status-danger-bg p-3 text-status-danger">{o.reasons === 'tampered' ? t('pp07.tampered') : o.reasons}</p>}
        {o && o.conditions.length > 0 && (
          <div>
            <h3 className="mb-2 font-semibold">{t('pp07.conditions')}</h3>
            <ul className="flex flex-col divide-y rounded-lg border">
              {o.conditions.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span>
                    {condText(c)} <span className="text-caption text-muted-foreground">· {t('pp07.due', { date: formatDate(c.due) })}</span>
                  </span>
                  {c.closedAt ? (
                    <Chip tone="success">{t('pp07.closed', { date: formatDate(c.closedAt) })}</Chip>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Chip tone="warning">{t('pp07.open')}</Chip>
                      {c.docKey && (
                        <Link to={`/partner/onboarding/documents#doc-${c.docKey}`} className="text-caption font-medium text-primary hover:underline">
                          {t('pp07.uploadEvidence')}
                        </Link>
                      )}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {app.status === 'agreement' && <p className="rounded-lg bg-status-info-bg p-3 text-status-info">{t('pp07.nextAgreement')}</p>}
      </section>

      {audit && <HubAudit app={app} />}
    </div>
  )
}

function HubAudit({ app }: { app: PartnerApplication }) {
  const { t } = useTranslation()
  const { user } = usePartnerSession()
  const now = useDemoNow()
  const auditor = useData((d) => (app.hubAudit ? d.staff[app.hubAudit.auditorId] : undefined))
  const today = istDate(now)
  const max = addDaysToDate(today, AUDIT_WITHIN_DAYS)
  const [b, setB] = useState({ date: addDaysToDate(today, 3), window: 'morning' as 'morning' | 'afternoon', contact: user.name, phone: user.mobile })
  const h = app.hubAudit
  const canBook = !h && ['invited', 'kyc'].includes(app.status)
  const valid = b.date > today && b.date <= max && b.contact.trim() && /^\d{10}$/.test(b.phone.replace(/\s/g, ''))

  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="au-h" data-testid="hub-audit">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="au-h" className="text-card-title">
          {t('pp07.hubAudit')}
        </h2>
        {h?.result && <ResultChip result={h.result} />}
      </div>
      <p className="text-caption text-muted-foreground">{t('pp07.auditIntro', { hub: app.hubs[0]?.name ?? '', days: AUDIT_WITHIN_DAYS })}</p>

      {canBook && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label={t('pp07.date')} htmlFor="au-date" required hint={t('pp07.within', { date: formatDate(max) })}>
            <Input id="au-date" type="date" min={addDaysToDate(today, 1)} max={max} value={b.date} onChange={(e) => setB({ ...b, date: e.target.value })} />
          </Field>
          <Field label={t('pp07.window')} htmlFor="au-win" required>
            <NativeSelect id="au-win" value={b.window} onChange={(e) => setB({ ...b, window: e.target.value as 'morning' | 'afternoon' })}>
              <option value="morning">{t('ponb.window.morning')}</option>
              <option value="afternoon">{t('ponb.window.afternoon')}</option>
            </NativeSelect>
          </Field>
          <Field label={t('pp07.contact')} htmlFor="au-c" required>
            <Input id="au-c" value={b.contact} onChange={(e) => setB({ ...b, contact: e.target.value })} />
          </Field>
          <Field label={t('pp07.phone')} htmlFor="au-p" required>
            <Input id="au-p" inputMode="tel" value={b.phone} onChange={(e) => setB({ ...b, phone: e.target.value })} />
          </Field>
          <Button className="self-start" disabled={!valid} onClick={() => (useDemoStore.getState().bookHubAudit(app.id, b, user.id), toast.success(t('pp07.booked')))}>
            {t('pp07.book')}
          </Button>
        </div>
      )}

      {h && (
        <p data-testid="audit-slot">
          {t('pp07.slot', { date: formatDate(h.date), window: t(`ponb.window.${h.window}`), auditor: auditor?.name ?? '', contact: h.contact, phone: h.phone })}
        </p>
      )}

      {h?.items && (
        <>
          <p className="font-semibold">{t('pp07.passed', { n: AUDIT_ITEMS.filter((k) => h.items![k].result === 'pass').length, total: AUDIT_ITEMS.length })}</p>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {AUDIT_ITEMS.map((k) => {
              const it = h.items![k]
              return (
                <li key={k} className="flex gap-3 rounded-lg border p-2">
                  <img src={photoThumb(t(`ponb.audit.${k}`))} alt={t('pp07.photoOf', { item: t(`ponb.audit.${k}`) })} className="size-16 rounded object-cover" />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{t(`ponb.audit.${k}`)}</span>
                    <Chip tone={it.result === 'pass' ? 'success' : it.result === 'fail' ? 'danger' : 'warning'}>{t(`ponb.auditResult.${it.result}`)}</Chip>
                    {it.note && <span className="text-caption">{it.note}</span>}
                    <span className="flex items-center gap-1 text-caption text-muted-foreground">
                      <MapPin className="size-3" aria-hidden /> {it.photo.lat.toFixed(4)}, {it.photo.lng.toFixed(4)} · {formatDateTime(it.photo.at)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
