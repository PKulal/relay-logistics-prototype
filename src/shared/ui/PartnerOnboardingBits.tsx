/**
 * Small pieces shared by the partner onboarding screens in the Partner Portal
 * (PP-05 to PP-10) and the ERP (ERP-11 to ERP-14).
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/utils'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { IsoDateTime, Partner, PartnerAgreementLine, PartnerApplication, PartnerDocument, Tier, VerificationResult } from '@shared/types'
import { SimulatedTag } from './SimulatedTag'
import { Chip } from './StatusChip'
import type { Tone } from './tones'

/** "Expiring soon": a verified document whose expiry is within 30 days (PP-06). */
export const expiringSoon = (d: PartnerDocument, now: IsoDateTime) => d.status === 'verified' && !!d.expiry && d.expiry <= addDaysToDate(istDate(now), 30)

const DOC_TONE: Record<PartnerDocument['status'], Tone> = { pending: 'neutral', submitted: 'info', verified: 'success', flagged: 'danger', rejected: 'danger' }

/** Not uploaded | Uploaded | Verified | Flagged (reason) | Expiring soon (PP-06 business rules). */
export function DocStatusChip({ doc, now }: { doc?: PartnerDocument; now: IsoDateTime }) {
  const { t } = useTranslation()
  if (!doc?.file) return <Chip tone="neutral">{t('ponb.docStatus.notUploaded')}</Chip>
  if (expiringSoon(doc, now)) return <Chip tone="warning">{t('ponb.docStatus.expiringSoon')}</Chip>
  return <Chip tone={DOC_TONE[doc.status]}>{t(`ponb.docStatus.${doc.status}`)}</Chip>
}

/** Reason for a flag or re-upload request: a scripted OCR key, or free text from the desk. */
export function useFlagText() {
  const { t } = useTranslation()
  return (doc: PartnerDocument) => (doc.note ? t(`ponb.flagNote.${doc.note}`, { defaultValue: doc.note }) : doc.flag ? t(`ponb.flag.${doc.flag}`) : '')
}

/** A condition with no text is the standard "upload a valid …" condition. */
export function useConditionText() {
  const { t } = useTranslation()
  return (c: NonNullable<PartnerApplication['outcome']>['conditions'][number]) => c.text || (c.docKey ? t('ponb.condition.reupload', { doc: t(`ponb.doc.${c.docKey}`) }) : '')
}

const RESULT_TONE: Record<VerificationResult, Tone> = { approved: 'success', conditional: 'warning', rejected: 'danger' }
export function ResultChip({ result }: { result: VerificationResult }) {
  const { t } = useTranslation()
  return (
    <Chip tone={RESULT_TONE[result]} bold>
      {t(`ponb.result.${result}`)}
    </Chip>
  )
}

const APP_TONE: Record<PartnerApplication['status'], Tone> = { new: 'info', invited: 'success', waitlisted: 'warning', kyc: 'info', agreement: 'info', integration: 'info', trial: 'info', live: 'success', rejected: 'danger' }
export function AppStatusChip({ status }: { status: PartnerApplication['status'] }) {
  const { t } = useTranslation()
  return <Chip tone={APP_TONE[status]}>{t(`ponb.appStatus.${status}`)}</Chip>
}

/** Plain-language fit reason (PP-05 "Why we need you"; ERP-11 fit column). */
export function useFitText() {
  const { t } = useTranslation()
  return (a: PartnerApplication) => (a.fitDetail ? t(`ponb.fit.${a.fitDetail.kind}`, { place: a.fitDetail.place, count: a.fitDetail.partners }) : a.fitReason)
}

/** "Delhi NCR → Belagavi", "Hubballi cluster", "Hubballi hub" for an agreement line (PP-08, ERP-13). */
export function useLineLabel() {
  const { t } = useTranslation()
  const data = useData((d) => d)
  return (l: PartnerAgreementLine) => {
    if (l.leg === 'lineHaul') {
      const lane = data.lanes[l.laneOrCluster]
      return lane ? `${lane.originRegion} → ${l.destCity ?? lane.destRegion}` : l.laneOrCluster
    }
    const hub = data.hubs[l.laneOrCluster]
    const city = (hub && data.pincodes[hub.pincode]?.city) ?? l.laneOrCluster
    return l.leg === 'firstMile' || l.leg === 'lastMile' ? t('ponb.cluster', { city }) : t('ponb.hubAt', { city })
  }
}

/** "₹9.00 / kg, min 50 kg" — the rate in the unit for the line. */
export function useRateText() {
  const { t } = useTranslation()
  return (l: Pick<PartnerAgreementLine, 'rate' | 'unit' | 'minKg' | 'minimum' | 'maxKg'>, rate = l.rate) =>
    [
      t(`ponb.unit.${l.unit}`, { rate: formatINR(rate) }),
      l.minKg ? t('ponb.minKg', { kg: l.minKg }) : '',
      l.minimum ? t('ponb.minimum', { amount: formatINR(l.minimum) }) : '',
      l.maxKg ? t('ponb.maxKg', { kg: l.maxKg }) : '',
    ]
      .filter(Boolean)
      .join(', ')
}

/** Payout cycle by tier (source §5.3): Platinum within 3 days, Gold and Silver weekly, Bronze fortnightly. */
export const paymentCycle = (tier: Tier | null) => (tier === 'platinum' ? 'threeDays' : tier === 'gold' || tier === 'silver' ? 'weekly' : 'fortnightly')

const TRIAL_RESULT_TONE = { inProgress: 'info', live: 'success', extended: 'warning', declined: 'danger' } as const

/** Trial jobs, running score against the pass mark, and the result (PP-10 trial panel, ERP-14). */
export function TrialPanel({ partner }: { partner: Partner }) {
  const { t } = useTranslation()
  const pass = useData((d) => d.settings.trialPassMark)
  const tr = partner.trial
  if (!tr) return null
  const result = tr.decision?.result === 'live' ? 'live' : tr.decision?.result === 'declined' ? 'declined' : tr.decision?.result === 'extended' && tr.tripsDone < tr.tripsRequired ? 'extended' : 'inProgress'
  const unit = tr.unit ?? 'trips'
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="trial-h" data-testid="trial-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="trial-h" className="text-card-title">
          {t('ponb.trial.title')}
        </h2>
        <Chip tone={TRIAL_RESULT_TONE[result]} bold>
          {t(`ponb.trial.result.${result}`)}
        </Chip>
      </div>
      <p className="text-caption text-muted-foreground">
        {t(`ponb.trial.progress.${unit}`, { done: tr.tripsDone, required: tr.tripsRequired })} · {t('ponb.trial.passMark', { pass })}
      </p>
      <div className="flex items-center gap-3">
        <span className={cn('text-section tabular font-semibold', tr.score >= pass ? 'text-status-success' : tr.jobs?.length ? 'text-status-warning' : 'text-muted-foreground')} data-testid="trial-score">
          {tr.jobs?.length ? tr.score : '—'}
        </span>
        <div className="relative h-3 flex-1 rounded-full bg-gray-100" role="meter" aria-label={t('ponb.trial.score')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={tr.score}>
          <div className={cn('h-3 rounded-full', tr.score >= pass ? 'bg-status-success' : 'bg-status-warning')} style={{ width: `${tr.score}%` }} />
          <div className="absolute -top-1 h-5 w-0.5 bg-foreground" style={{ left: `${pass}%` }} aria-hidden />
        </div>
      </div>
      {tr.decision?.reasons && <p className="text-caption">{tr.decision.reasons}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-table" data-testid="trial-jobs">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="py-2">{t('ponb.trial.col.job')}</th>
              <th>{t('ponb.trial.col.date')}</th>
              <th>{t('ponb.trial.col.leg')}</th>
              <th>{t('ponb.trial.col.onTime')}</th>
              <th className="text-right">{t('ponb.trial.col.scans')}</th>
              <th className="pl-4">{t('ponb.trial.col.anomalies')}</th>
              <th className="text-right">{t('ponb.trial.col.score')}</th>
            </tr>
          </thead>
          <tbody>
            {(tr.jobs ?? []).length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-muted-foreground">
                  {t('ponb.trial.noJobs')}
                </td>
              </tr>
            )}
            {(tr.jobs ?? []).map((j) => (
              <tr key={j.ref} className="tabular border-b last:border-0">
                <td className="py-2">
                  {j.ref}
                  {j.simulated && <SimulatedTag />}
                </td>
                <td>{formatDate(j.date)}</td>
                <td>{t(`legType.${j.leg}`)}</td>
                <td>{j.onTime ? t('ponb.yes') : t('ponb.no')}</td>
                <td className="text-right">{j.scanPct}%</td>
                <td className="pl-4">{j.anomalies.length ? j.anomalies.map((a) => t(`ponb.anomaly.${a}`)).join(', ') : '—'}</td>
                <td className="text-right font-semibold">{j.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
