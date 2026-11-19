/**
 * PA-22 Start trip — docs/03-partner-app.md §6.4.
 * Confirm the truck and the door seals, photograph the sealed door, start.
 * Start → In Transit for every shipment on board, e-way bill Part B updated
 * with the vehicle number, tracking on (source §5.1, §7 Step 6).
 * SIMULATED: "Scan plate" / "Scan seal" read the assigned truck and seals.
 */
import { AlertTriangle, ArrowLeft, CheckCircle2, ScanLine, Truck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { currentTrip } from '@shared/engines/trip'
import { useData } from '@shared/hooks/useDemo'
import { useDemoStore } from '@shared/store'
import { startBlock } from '@shared/store/tripActions'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card } from './FieldUi'
import { tripFacts } from './tripView'
import { useFieldSession } from './useFieldSession'

export default function PA22StartTrip() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const trip = currentTrip(data, staff.id)
  const [plate, setPlate] = useState('')
  const [seals, setSeals] = useState<string[]>(() => (trip?.sealNos ?? []).map(() => ''))
  const [photo, setPhoto] = useState('')

  if (!trip || trip.startedAt) return <Navigate to="/app/trip" replace />
  const f = tripFacts(data, trip)
  const reg = f.vehicle?.regNo ?? ''
  const typed = plate.replace(/\s/g, '').toUpperCase()
  const block = startBlock(data, { tripId: trip.id, vehicleNo: typed, sealNos: seals.map((s) => s.trim().toUpperCase()) })
  const ready = !!typed && !block && !!photo

  const start = () => {
    navigate('/app/trip')
    useDemoStore.getState().startTrip({ tripId: trip.id, staffId: staff.id, vehicleNo: typed, sealNos: seals.map((s) => s.trim().toUpperCase()), photo })
    toast.success(t('pa22.done', { count: f.legs.length }))
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <button type="button" onClick={() => navigate('/app/trip')} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <div>
        <p className="tabular text-[13px] text-muted-foreground">
          {trip.id} · {f.from.name} → {f.to.name}
        </p>
        <h1 className="font-heading text-[22px] font-bold">{t('pa22.title')}</h1>
      </div>

      <Card title={t('pa29.vehicle')}>
        <div className="flex gap-2">
          <input aria-label={t('pa29.vehicle')} value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} className="tabular h-12 min-w-0 flex-1 rounded-lg border border-input px-3 text-[18px]" />
          <button type="button" onClick={() => setPlate(reg)} className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-primary px-3 font-semibold text-primary">
            <ScanLine className="size-5" aria-hidden /> {t('pa29.scanPlate')}
          </button>
        </div>
        <SimulatedTag className="mt-1" />
        {typed && typed !== reg && (
          <p className="mt-2 flex items-start gap-2 text-[13px] font-semibold text-status-danger" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('pa22.wrongTruck', { reg })}
          </p>
        )}
        {typed === reg && <p className="mt-1 text-[13px] font-medium text-status-success">{t('pa29.vehicleOk')} ✓</p>}
      </Card>

      <Card title={t('pa22.doorSeals')}>
        {trip.sealNos.map((expected, i) => {
          const v = seals[i].trim().toUpperCase()
          return (
            <div key={expected} className="mb-2 flex flex-col gap-1">
              <div className="flex gap-2">
                <input
                  aria-label={t('pa22.sealN', { n: i + 1 })}
                  placeholder="SL-#####"
                  value={seals[i]}
                  onChange={(e) => setSeals((s) => s.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)))}
                  className="tabular h-12 min-w-0 flex-1 rounded-lg border border-input px-3 text-[18px]"
                />
                <button type="button" onClick={() => setSeals((s) => s.map((x, j) => (j === i ? expected : x)))} className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-primary px-3 font-semibold text-primary">
                  <ScanLine className="size-5" aria-hidden /> {t('pa28.scanSeal')}
                </button>
              </div>
              {v && (
                <p className={cn('flex items-center gap-1 text-[13px] font-medium', v === expected ? 'text-status-success' : 'text-status-danger')}>
                  {v === expected ? <CheckCircle2 className="size-4" aria-hidden /> : <AlertTriangle className="size-4" aria-hidden />}
                  {v === expected ? t('pa22.sealOk') : t('pa22.sealMismatch')}
                </p>
              )}
            </div>
          )
        })}
        <PhotoCapture className="mt-2" label={t('pa29.doorPhoto')} caption={`${reg} · ${trip.sealNos.join(', ')}`} value={photo} onChange={setPhoto} idBase={`${trip.id}-start`} required />
      </Card>

      <p className="text-[13px] text-muted-foreground">{t('pa22.onStart', { count: f.legs.length })}</p>

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        <button type="button" disabled={!ready} onClick={start} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
          <Truck className="size-5" aria-hidden /> {t('pa21.start')}
        </button>
        {!ready && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t('pa22.todo')}</p>}
      </div>
    </div>
  )
}
