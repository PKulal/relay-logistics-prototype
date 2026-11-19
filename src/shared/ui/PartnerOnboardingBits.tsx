/**
 * Small pieces shared by the partner onboarding screens in the Partner Portal
 * (PP-05 to PP-07) and the ERP (ERP-11, ERP-12).
 */
import { useTranslation } from 'react-i18next'
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { IsoDateTime, PartnerApplication, PartnerDocument, VerificationResult } from '@shared/types'
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
