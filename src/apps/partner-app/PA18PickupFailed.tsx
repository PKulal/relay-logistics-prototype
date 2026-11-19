/**
 * PA-18 Pickup failed — docs/03-partner-app.md. Source §10 Step 3: pickup
 * missed → reassign to a backup first-mile partner within 2 hours. A masked
 * call to the shipper in the last 15 minutes and a photo are required
 * (assumed, as for NDR). SIMULATED: masked call, camera, GPS.
 */
import { ArrowLeft, Check, PhoneCall } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { canReportPickupFail, PICKUP_FAIL_REASONS, type PickupFailReason } from '@shared/store/exceptionActions'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card, Choice } from './FieldUi'
import { useFieldSession } from './useFieldSession'

export default function PA18PickupFailed() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { legId = '' } = useParams()
  const { staff } = useFieldSession()
  const now = useDemoNow()
  const leg = useData((d) => d.legs[legId])
  const s = useData((d) => (leg ? d.shipments[leg.shipmentId] : undefined))
  const loc = useData((d) => (s ? d.pickupLocations[s.pickupLocationId] : undefined))
  const [reason, setReason] = useState<PickupFailReason>()
  const [photo, setPhoto] = useState('')
  const [note, setNote] = useState('')
  const [calledAt, setCalledAt] = useState<string>()
  if (!leg || !s || !loc || leg.staffId !== staff.id || leg.type !== 'firstMile' || leg.status !== 'assigned') return <Navigate to="/app/tasks" replace />
  const contact = (s.pickupContact ?? loc.contact).name

  const ready = !!reason && canReportPickupFail({ legId, staffId: staff.id, reason, photo, calledAt }, now)
  const submit = () => {
    useDemoStore.getState().reportPickupFailed({ legId: leg.id, staffId: staff.id, reason: reason!, photo, note, calledAt })
    toast.success(t('pa18.done'))
    navigate('/app/tasks')
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <button type="button" onClick={() => navigate(`/app/tasks/${leg.id}`)} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <div>
        <p className="tabular text-[13px] text-muted-foreground">{s.id}</p>
        <h1 className="font-heading text-[22px] leading-tight font-bold">{t('pa18.title')}</h1>
        <p className="text-muted-foreground">{loc.name}</p>
      </div>

      <Card title={t('pa18.reason')}>
        <div role="radiogroup" aria-label={t('pa18.reason')} className="flex flex-col">
          {PICKUP_FAIL_REASONS.map((r) => (
            <Choice key={r} checked={reason === r} onClick={() => setReason(r)} label={t(`pa18.r.${r}`)} />
          ))}
        </div>
      </Card>

      <Card title={t('pa18.call')}>
        {calledAt ? (
          <p className="flex items-center gap-2 font-semibold text-status-success" data-testid="call-log">
            <Check className="size-5" aria-hidden /> {t('pa35.called', { time: formatTime(calledAt) })}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => (setCalledAt(now), toast.success(t('pa.calling', { name: contact })))}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary font-semibold text-primary"
          >
            <PhoneCall className="size-5" aria-hidden /> {t('pa35.callNow', { name: contact })} <SimulatedTag />
          </button>
        )}
        <p className="mt-1 text-[13px] text-muted-foreground">{t('pa18.callRule')}</p>
      </Card>

      <PhotoCapture label={t('pa18.photo')} caption={reason ? t(`pa18.r.${reason}`) : t('pa18.photo')} value={photo} onChange={setPhoto} idBase={`${leg.id}-fail`} required />

      <label className="flex flex-col gap-1">
        <span className="font-semibold">{t('pa18.note')}</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('pa18.notePh')} className="rounded-xl border bg-background p-3 text-[16px]" />
      </label>

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        <button type="button" disabled={!ready} onClick={submit} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
          {t('pa18.submit')}
        </button>
        {!ready && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t('pa18.todo')}</p>}
      </div>
    </div>
  )
}
