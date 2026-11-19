/**
 * PA-35 Failed delivery (NDR) — docs/03-partner-app.md.
 * Source §5.1 "NDR: reason code + photo of location; action follows customer's
 * choice"; §7 Step 10. A masked call to the consignee in the last 15 minutes
 * and a location photo are required (assumed, to stop fake attempts).
 * SIMULATED: masked call, GPS.
 */
import { ArrowLeft, Check, PhoneCall } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { canReportNdr } from '@shared/store/ndrActions'
import { NDR_REASONS, type NdrReason } from '@shared/types'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card, Choice } from './FieldUi'
import { useFieldSession } from './useFieldSession'

export default function PA35Ndr() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { legId = '' } = useParams()
  const { staff } = useFieldSession()
  const now = useDemoNow()
  const leg = useData((d) => d.legs[legId])
  const s = useData((d) => (leg ? d.shipments[leg.shipmentId] : undefined))
  const consignee = useData((d) => (s ? d.consignees[s.consigneeId] : undefined))
  const [reason, setReason] = useState<NdrReason>()
  const [photo, setPhoto] = useState('')
  const [note, setNote] = useState('')
  const [calledAt, setCalledAt] = useState<string>()
  if (!leg || !s || !consignee || leg.staffId !== staff.id || leg.type !== 'lastMile') return <Navigate to="/app/run" replace />
  if (leg.status !== 'inProgress') return <Navigate to={`/app/run/${leg.id}`} replace />

  const ready = !!reason && canReportNdr({ photo, calledAt }, now)
  const submit = () => {
    useDemoStore.getState().reportNdr({ legId: leg.id, staffId: staff.id, reason: reason!, photo, note, calledAt })
    toast.success(t('pa35.done'))
    navigate('/app/run')
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <button type="button" onClick={() => navigate(`/app/run/${leg.id}`)} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <div>
        <p className="tabular text-[13px] text-muted-foreground">{s.id}</p>
        <h1 className="font-heading text-[22px] leading-tight font-bold">{t('pa35.title')}</h1>
        <p className="text-muted-foreground">{consignee.company || consignee.contact}</p>
      </div>

      <Card title={t('pa35.reason')}>
        <div role="radiogroup" aria-label={t('pa35.reason')} className="flex flex-col">
          {NDR_REASONS.map((r) => (
            <Choice key={r} checked={reason === r} onClick={() => setReason(r)} label={t(`ndr.reason.${r}`)} />
          ))}
        </div>
      </Card>

      <Card title={t('pa35.call')}>
        {calledAt ? (
          <p className="flex items-center gap-2 font-semibold text-status-success" data-testid="call-log">
            <Check className="size-5" aria-hidden /> {t('pa35.called', { time: formatTime(calledAt) })}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => (setCalledAt(now), toast.success(t('pa.calling', { name: consignee.contact })))}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary font-semibold text-primary"
          >
            <PhoneCall className="size-5" aria-hidden /> {t('pa35.callNow', { name: consignee.contact })} <SimulatedTag />
          </button>
        )}
        <p className="mt-1 text-[13px] text-muted-foreground">{t('pa35.callRule')}</p>
      </Card>

      <PhotoCapture label={t('pa35.photo')} caption={reason ? t(`ndr.reason.${reason}`) : t('pa35.photo')} value={photo} onChange={setPhoto} idBase={`${leg.id}-ndr`} required />

      <label className="flex flex-col gap-1">
        <span className="font-semibold">{t('pa35.note')}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="rounded-xl border bg-background p-3 text-[16px]" />
      </label>

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        <button type="button" disabled={!ready} onClick={submit} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
          {t('pa35.submit')}
        </button>
        {!ready && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t('pa35.todo')}</p>}
      </div>
    </div>
  )
}
