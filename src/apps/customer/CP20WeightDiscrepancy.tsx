/**
 * CP-20 Weight discrepancy — docs/01-customer-portal.md.
 * Source §7 Step 4: "If different from booked: customer notified with Accept
 * Revised Rate OR Raise Dispute (evidence on screen)". No response in 48 hours
 * → accepted automatically (assumed).
 */
import { ArrowLeft, CheckCircle2, Paperclip } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { WEIGHT_REVISION_RESPONSE_HOURS } from '@shared/engines/customerDashboard'
import { DISPUTE_FILES_MAX, DISPUTE_REASONS, DISPUTE_REMARKS_MAX } from '@shared/engines/weightCheck'
import { useData } from '@shared/hooks/useDemo'
import { formatDateTime, formatINR } from '@shared/lib/format'
import { addHours } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import type { WeightDisputeReason, WeightRevision } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { Field } from '@shared/ui/FormField'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { NotFound, PageHeader } from '@shared/ui/Page'
import { SlaTimer } from '@shared/ui/SlaTimer'
import { Chip } from '@shared/ui/StatusChip'
import { WeightEvidence } from '@shared/ui/WeightEvidence'
import { useCustomerSession } from './useCustomerSession'

const STATUS_TONE: Record<WeightRevision['status'], 'warning' | 'success' | 'info' | 'neutral'> = { pending: 'warning', accepted: 'success', autoAccepted: 'success', disputed: 'info', upheld: 'neutral', reversed: 'success' }

export default function CP20WeightDiscrepancy() {
  const { t } = useTranslation()
  const { lr = '' } = useParams()
  const { customer } = useCustomerSession()
  const s = useData((d) => (d.shipments[lr]?.customerId === customer.id ? d.shipments[lr] : undefined))
  const w = useData((d) => Object.values(d.weightRevisions).filter((x) => x.shipmentId === lr).at(-1))
  if (!s || !w) return <NotFound />

  return (
    <div className="flex max-w-5xl flex-col gap-4">
      <Link to="/customer/exceptions" className="inline-flex items-center gap-1 text-caption font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t('cp20.back')}
      </Link>
      <PageHeader
        title={t('cp20.title')}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Link to={`/customer/shipments/${s.id}`} className="tabular font-medium text-primary hover:underline">
              {s.id}
            </Link>
            <Chip tone={STATUS_TONE[w.status]} bold>
              {t(`cp20.status.${w.status}`)}
            </Chip>
            {w.status === 'pending' && (
              <span className="inline-flex items-center gap-1 text-caption">
                {t('cp20.respondBy')} <SlaTimer dueAt={addHours(w.raisedAt, WEIGHT_REVISION_RESPONSE_HOURS)} totalMinutes={WEIGHT_REVISION_RESPONSE_HOURS * 60} amberPct={5} />
              </span>
            )}
          </span>
        }
        className="mb-0"
      />
      <WeightEvidence shipment={s} revision={w} />
      {w.status === 'pending' ? <Respond revision={w} /> : <Outcome revision={w} />}
    </div>
  )
}

function Respond({ revision: w }: { revision: WeightRevision }) {
  const { t } = useTranslation()
  const { user, customer } = useCustomerSession()
  const [confirm, setConfirm] = useState(false)
  const [disputing, setDisputing] = useState(false)
  const [reason, setReason] = useState<WeightDisputeReason | ''>('')
  const [remarks, setRemarks] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const prepaid = customer.billing === 'prepaid'

  const dispute = () => {
    setTried(true)
    if (!reason || !remarks.trim()) return
    useDemoStore.getState().disputeRevision(w.id, { reason, remarks, files }, user.id)
    toast.success(t('cp20.disputed'))
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="resp-h">
      <h2 id="resp-h" className="text-card-title">
        {t('cp20.respond')}
      </h2>
      <p className="text-muted-foreground">{t('cp20.autoRule', { hours: WEIGHT_REVISION_RESPONSE_HOURS })}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setConfirm(true)}>{t('cp20.accept', { amount: formatINR(w.amountDiff) })}</Button>
        <Button variant="outline" aria-expanded={disputing} onClick={() => setDisputing(!disputing)}>
          {t('cp20.dispute')}
        </Button>
      </div>
      {disputing && (
        <div className="grid gap-4 rounded-lg border bg-gray-50 p-4 sm:grid-cols-2" data-testid="dispute-form">
          <Field label={t('cp20.reason')} htmlFor="cp20-reason" required error={tried && !reason ? t('cp04.err.required') : undefined}>
            <NativeSelect id="cp20-reason" value={reason} onChange={(e) => setReason(e.target.value as WeightDisputeReason)}>
              <option value="">{t('cp04.choose')}</option>
              {DISPUTE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {t(`cp20.reasons.${r}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t('cp20.files', { max: DISPUTE_FILES_MAX })} htmlFor="cp20-files">
            <input
              id="cp20-files"
              type="file"
              multiple
              className="text-caption file:mr-2 file:rounded-md file:border file:bg-background file:px-3 file:py-1.5"
              onChange={(e) => {
                const picked = [...(e.target.files ?? [])].map((f) => f.name)
                if (picked.length > DISPUTE_FILES_MAX) toast.error(t('cp20.tooMany', { max: DISPUTE_FILES_MAX }))
                setFiles(picked.slice(0, DISPUTE_FILES_MAX))
              }}
            />
          </Field>
          <Field
            label={t('cp20.remarks')}
            htmlFor="cp20-remarks"
            required
            className="sm:col-span-2"
            error={tried && !remarks.trim() ? t('cp04.err.required') : undefined}
            hint={t('cp20.remarksCount', { n: remarks.length, max: DISPUTE_REMARKS_MAX })}
          >
            <textarea id="cp20-remarks" maxLength={DISPUTE_REMARKS_MAX} rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-body" />
          </Field>
          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2 sm:col-span-2">
              {files.map((f) => (
                <li key={f} className="inline-flex items-center gap-1 rounded-md bg-background px-2 py-1 text-caption">
                  <Paperclip className="size-3" aria-hidden /> {f}
                </li>
              ))}
            </ul>
          )}
          <Button className="self-start" onClick={dispute}>
            {t('cp20.submitDispute')}
          </Button>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('cp20.confirmTitle', { amount: formatINR(w.amountDiff) })}
        body={prepaid ? t('cp20.confirmWallet', { balance: formatINR(customer.walletBalance) }) : t('cp20.confirmInvoice')}
        confirmLabel={t('cp20.confirm')}
        onConfirm={() => {
          useDemoStore.getState().acceptRevision(w.id, user.id)
          toast.success(prepaid ? t('cp20.acceptedWallet') : t('cp20.acceptedInvoice'))
        }}
      />
    </section>
  )
}

function Outcome({ revision: w }: { revision: WeightRevision }) {
  const { t } = useTranslation()
  const who = useData((d) => (w.respondedBy && w.respondedBy !== 'system' ? (d.customerUsers[w.respondedBy]?.name ?? '') : ''))
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-5 shadow-card" aria-labelledby="out-h" data-testid="outcome">
      <h2 id="out-h" className="text-card-title">
        {t('cp20.outcome')}
      </h2>
      {(w.status === 'accepted' || w.status === 'autoAccepted') && (
        <p className="flex items-center gap-2">
          <CheckCircle2 className="size-4 text-status-success" aria-hidden />
          {w.status === 'accepted' ? t('cp20.acceptedBy', { name: who, at: formatDateTime(w.respondedAt!) }) : t('cp20.autoAccepted', { at: formatDateTime(w.respondedAt!) })}
        </p>
      )}
      {w.chargedTo && <p className="text-muted-foreground">{t(`cp20.charged.${w.chargedTo}`, { amount: formatINR(w.amountDiff) })}</p>}
      {w.dispute && (
        <div className="rounded-lg bg-gray-50 p-3 text-table">
          <p className="font-medium">{t('cp20.yourDispute', { name: who, at: formatDateTime(w.dispute.at) })}</p>
          <p>
            {t(`cp20.reasons.${w.dispute.reason}`)} · {w.dispute.remarks}
          </p>
          {w.dispute.files.length > 0 && <p className="text-caption text-muted-foreground">{w.dispute.files.join(', ')}</p>}
        </div>
      )}
      {w.status === 'disputed' && <p className="text-muted-foreground">{t('cp20.underReview')}</p>}
      {w.resolution && (
        <p className="font-medium" data-testid="resolution">
          {t(`cp20.resolution.${w.resolution.decision}`, { at: formatDateTime(w.resolution.at) })} {w.resolution.note}
        </p>
      )}
    </section>
  )
}
