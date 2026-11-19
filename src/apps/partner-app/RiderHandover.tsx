/**
 * Hub → rider hand-over (PA-19 for the last mile; source §5.1 "Hand-Over …
 * both sides confirm"). Shipments in the hub that go out for local delivery,
 * grouped by the rider who delivers them; one code covers the rider's load,
 * which they take on PA-31 (load check).
 */
import { ArrowLeft, Bike, CheckCircle2, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { AccessDenied } from '@shared/ui/Page'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { Scanner } from '@shared/ui/Scanner'
import { Card } from './FieldUi'
import { HandoverCode } from './HandoverCode'
import { riderLoads } from './riderLoads'
import { useHub } from './useHub'

/** "To riders" list on the Outbound tab. */
export function ToRiders() {
  const { t } = useTranslation()
  const { data, items } = useHub()
  const loads = riderLoads(data, items)
  if (!loads.length) return null
  return (
    <section className="flex flex-col gap-2" aria-labelledby="riders-h">
      <h2 id="riders-h" className="text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">
        {t('rider.toRiders')}
      </h2>
      {loads.map((l) => {
        const rider = data.fieldStaff[l.riderId]
        return (
          <Link key={l.riderId} to={`/app/outbound/rider/${l.riderId}`} className="flex min-h-16 items-center gap-3 rounded-2xl border bg-card px-4 py-2">
            <Bike className="size-6 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                {rider.name} · {data.partners[rider.partnerId].shortName}
              </span>
              <span className="tabular block text-[13px] text-muted-foreground">
                {t('pa21.shipments', { count: l.items.length })} · {t('pa25.pcs', { count: l.pieceIds.length })}
                {l.code ? ` · ${t('pa29.waitingDriver')}` : ''}
              </span>
            </span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </Link>
        )
      })}
    </section>
  )
}

export default function RiderHandover() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { riderId = '' } = useParams()
  const { staff, data, hubId, hub, items } = useHub()
  const [scanned, setScanned] = useState<string[]>([])
  const [photo, setPhoto] = useState('')
  if (!hubId || !hub) return <div className="p-4"><AccessDenied /></div>
  const rider = data.fieldStaff[riderId]
  const load = riderLoads(data, items).find((l) => l.riderId === riderId)

  const header = (
    <>
      <button type="button" onClick={() => navigate('/app/outbound')} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <h1 className="font-heading text-[22px] font-bold">{t('rider.title', { name: rider?.name ?? '' })}</h1>
    </>
  )

  if (!rider || !load) {
    // Taken: the last hand-over to this rider today
    const taken = Object.values(data.events)
      .filter((e) => e.type === 'handoverReceived' && e.by === riderId)
      .sort((a, b) => a.at.localeCompare(b.at))
      .at(-1)
    return (
      <div className="flex flex-col gap-4 p-4">
        {header}
        {taken ? (
          <section className="flex flex-col items-center gap-2 rounded-2xl border-2 border-status-success bg-status-success-bg p-6 text-center" role="status">
            <CheckCircle2 className="size-12 text-status-success" aria-hidden />
            <p className="font-heading text-[22px] font-bold">{t('pa19.done')}</p>
            <p className="tabular">{t('pa29.doneLine', { name: rider?.name ?? '', time: formatTime(taken.at) })}</p>
          </section>
        ) : (
          <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('rider.nothing')}</p>
        )}
      </div>
    )
  }

  if (load.code) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {header}
        <HandoverCode refId={`${hubId}-${riderId}`} code={load.code} receiverName={rider.name} receiver={{ id: rider.id, name: rider.name, path: '/app/run' }} />
      </div>
    )
  }

  const ready = scanned.length === load.pieceIds.length && !!photo
  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      {header}
      <Card title={t('pa19.to')}>
        <p className="text-[18px] font-semibold">{rider.name}</p>
        <p className="text-muted-foreground">
          {data.partners[rider.partnerId].shortName} · {t('pa21.shipments', { count: load.items.length })}
        </p>
        <p className="tabular mt-1 text-[13px] text-muted-foreground">{load.items.map((i) => i.shipment.id).join(', ')}</p>
      </Card>
      <Card title={t('pa19.items')}>
        <Scanner expected={load.pieceIds} scanned={scanned} onScan={(c) => setScanned((x) => [...x, c])} shortLabel={(c) => c.slice(-9)} continuousDefault />
      </Card>
      <Card title={t('pa19.photoTitle')}>
        <PhotoCapture label={t('pa19.photo')} caption={t('pa19.photoCaption', { count: scanned.length })} value={photo} onChange={setPhoto} idBase={`${hubId}-to-${riderId}`} required />
      </Card>
      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        <button
          type="button"
          disabled={!ready}
          onClick={() => useDemoStore.getState().giveToRider({ hubId, legIds: load.items.map((i) => i.leg.id), staffId: staff.id, photos: [photo] })}
          className="min-h-14 w-full rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40"
        >
          {t('pa19.showCode')}
        </button>
        {!ready && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t('pa19.todo')}</p>}
      </div>
    </div>
  )
}
