/**
 * PA-29 Out-scan and dispatch — docs/03-partner-app.md §6.5.
 * Choose the manifest, confirm the truck, scan the sealed bags on, seal the
 * door, then hand over to the driver (PA-19 code → driver's PA-20).
 * SIMULATED: "Scan plate" and "Scan seal" read the trip's truck and the next seal.
 */
import { AlertTriangle, ArrowLeft, CheckCircle2, ScanLine } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { bagLabel, destinationName } from '@shared/engines/hub'
import { formatTime } from '@shared/lib/format'
import { isBefore } from '@shared/lib/time'
import { nextDoorSeal, SEAL_PATTERN } from '@shared/sim/seals'
import { useDemoStore } from '@shared/store'
import { manifestHandover } from '@shared/store/hubActions'
import type { Manifest } from '@shared/types'
import { AccessDenied } from '@shared/ui/Page'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { Scanner } from '@shared/ui/Scanner'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card } from './FieldUi'
import { HandoverCode } from './HandoverCode'
import { ManifestPrintButton } from './ManifestPrint'
import { useHub } from './useHub'

export default function PA29OutScan() {
  const { t } = useTranslation()
  const { manifestId } = useParams()
  const { data, hubId } = useHub()
  const [chosen, setChosen] = useState('')
  if (!hubId) return <div className="p-4"><AccessDenied /></div>
  if (manifestId) return <ManifestHandover manifestId={manifestId} />

  const ready = Object.values(data.manifests).filter((m) => m.hubId === hubId && m.status !== 'dispatched' && m.bagIds.some((id) => data.bags[id]?.status === 'sealed'))
  const sent = Object.values(data.manifests).filter((m) => m.hubId === hubId && m.status === 'dispatched')
  const manifest = ready.find((m) => m.id === chosen) ?? ready[0]

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <h1 className="font-heading text-[22px] font-bold">{t('pa29.title')}</h1>
      {!manifest && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('pa29.empty')}</p>}
      {manifest && (
        <>
          <Card title={t('pa29.manifest')}>
            <select aria-label={t('pa29.manifest')} value={manifest.id} onChange={(e) => setChosen(e.target.value)} className="h-12 w-full rounded-lg border border-input bg-background px-3 text-[16px]">
              {ready.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id} · {destinationName(data, m.destination, hubId)} · {t('pa25.bags', { count: m.bagIds.length })}
                </option>
              ))}
            </select>
          </Card>
          <Dispatch key={manifest.id} manifest={manifest} hubId={hubId} />
        </>
      )}
      {sent.length > 0 && (
        <section className="flex flex-col gap-2" aria-labelledby="sent-h">
          <h2 id="sent-h" className="text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t('pa29.sent')}
          </h2>
          {sent.map((m) => (
            <Link key={m.id} to={`/app/outbound/${m.id}`} className="flex min-h-14 items-center justify-between rounded-2xl border bg-card px-4">
              <span className="font-semibold">
                {m.id} · {destinationName(data, m.destination, hubId)}
              </span>
              <span className="text-[13px] text-muted-foreground">{manifestHandover(data, m.id)?.received ? t('pa19.done') : t('pa29.waitingDriver')}</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  )
}

function Dispatch({ manifest, hubId }: { manifest: Manifest; hubId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff, data, now } = useHub()
  const trip = manifest.tripId ? data.trips[manifest.tripId] : undefined
  const tripVehicle = data.vehicles[trip?.vehicleId ?? manifest.vehicleId ?? '']
  const driver = trip ? data.fieldStaff[trip.driverId] : undefined
  const bags = manifest.bagIds.map((id) => data.bags[id]).filter((b) => b?.status === 'sealed')
  const [vehicle, setVehicle] = useState('')
  const [loaded, setLoaded] = useState<string[]>([])
  const [doorSeal, setDoorSeal] = useState('')
  const [photo, setPhoto] = useState('')

  const plate = vehicle.replace(/\s/g, '').toUpperCase()
  const vehicleOk = !!plate && (!tripVehicle || plate === tripVehicle.regNo)
  const sealOk = SEAL_PATTERN.test(doorSeal)
  const late = trip && isBefore(trip.departAt, now)
  const ready = vehicleOk && loaded.length === bags.length && sealOk && !!photo

  const handOver = () => {
    navigate(`/app/outbound/${manifest.id}`)
    useDemoStore.getState().dispatchManifest({ manifestId: manifest.id, vehicleNo: plate, doorSeal, photo, staffId: staff.id })
    toast.success(t('pa29.done', { count: bags.length, vehicle: plate }))
  }

  return (
    <>
      <Card title={t('pa29.trip')}>
        <p className="font-bold">
          {destinationName(data, manifest.destination, hubId)}
          {trip ? ` · ${t('pa28.departs', { time: formatTime(trip.departAt) })}` : ''}
        </p>
        <p className="tabular text-[13px] text-muted-foreground">
          {trip ? `${trip.id} · ` : ''}
          {tripVehicle?.regNo ?? t('pa29.noVehicle')}
          {driver ? ` · ${driver.name}` : ''}
        </p>
        {late && (
          <p className="mt-2 flex items-start gap-2 text-[13px] font-semibold text-status-danger" role="alert">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('pa29.lateCutoff', { time: formatTime(trip.departAt) })}
          </p>
        )}
      </Card>

      <Card title={t('pa29.vehicle')}>
        <div className="flex gap-2">
          <input aria-label={t('pa29.vehicle')} value={vehicle} onChange={(e) => setVehicle(e.target.value.toUpperCase())} className="tabular h-12 min-w-0 flex-1 rounded-lg border border-input px-3 text-[18px]" />
          <button type="button" onClick={() => tripVehicle && setVehicle(tripVehicle.regNo)} className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-primary px-3 font-semibold text-primary">
            <ScanLine className="size-5" aria-hidden /> {t('pa29.scanPlate')}
          </button>
        </div>
        <SimulatedTag className="mt-1" />
        {plate && tripVehicle && plate !== tripVehicle.regNo && <p className="mt-1 text-[13px] font-medium text-status-danger">{t('pa29.vehicleMismatch', { reg: tripVehicle.regNo })}</p>}
        {vehicleOk && tripVehicle && <p className="mt-1 text-[13px] font-medium text-status-success">{t('pa29.vehicleOk')}</p>}
      </Card>

      <Card title={t('pa29.scanBags')}>
        <Scanner expected={bags.map((b) => b.id)} scanned={loaded} onScan={(c) => setLoaded((x) => [...x, c])} shortLabel={(c) => bagLabel({ id: c })} unit="bag" continuousDefault />
      </Card>

      <Card title={t('pa29.doorSeal')}>
        <div className="flex gap-2">
          <input aria-label={t('pa29.doorSeal')} placeholder="SL-#####" value={doorSeal} onChange={(e) => setDoorSeal(e.target.value.toUpperCase().trim())} className="tabular h-12 min-w-0 flex-1 rounded-lg border border-input px-3 text-[18px]" />
          <button type="button" onClick={() => setDoorSeal(nextDoorSeal(data, hubId))} className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-primary px-3 font-semibold text-primary">
            <ScanLine className="size-5" aria-hidden /> {t('pa28.scanSeal')}
          </button>
        </div>
        {doorSeal && !sealOk && <p className="mt-1 text-[13px] font-medium text-status-danger">{t('pa28.sealFormat')}</p>}
        <PhotoCapture className="mt-3" label={t('pa29.doorPhoto')} caption={`${plate || 'Truck'} · ${doorSeal || 'SL-'}`} value={photo} onChange={setPhoto} idBase={`${manifest.id}-door`} required />
      </Card>

      <ManifestPrintButton manifestId={manifest.id} />

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        <button type="button" disabled={!ready} onClick={handOver} className="min-h-14 w-full rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
          {t('pa29.handOver')}
        </button>
        {!ready && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t('pa29.todo')}</p>}
      </div>
    </>
  )
}

/** PA-19 for a manifest: the code for the driver, then "Handed over". */
function ManifestHandover({ manifestId }: { manifestId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, hubId } = useHub()
  const h = manifestHandover(data, manifestId)
  if (!h || h.manifest.status !== 'dispatched' || h.manifest.hubId !== hubId) {
    return (
      <div className="p-4">
        <AccessDenied />
      </div>
    )
  }
  const { manifest, received } = h
  const trip = manifest.tripId ? data.trips[manifest.tripId] : undefined
  const driver = trip ? data.fieldStaff[trip.driverId] : undefined
  const driverName = driver?.name ?? t('pa29.driver')

  return (
    <div className="flex flex-col gap-4 p-4">
      <button type="button" onClick={() => navigate('/app/outbound')} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <div>
        <p className="tabular text-[13px] text-muted-foreground">
          {manifest.id} · {manifest.doorSeal}
        </p>
        <h1 className="font-heading text-[22px] font-bold">{t('pa29.handOverTitle')}</h1>
      </div>
      <Card title={t('pa19.to')}>
        <p className="text-[18px] font-semibold">{driverName}</p>
        <p className="tabular text-muted-foreground">
          {trip ? `${data.vehicles[trip.vehicleId]?.regNo} · ${data.partners[driver?.partnerId ?? '']?.shortName ?? ''}` : ''} · {t('pa25.bags', { count: manifest.bagIds.length })}
        </p>
      </Card>
      {received ? (
        <>
          <section className="flex flex-col items-center gap-2 rounded-2xl border-2 border-status-success bg-status-success-bg p-6 text-center" role="status">
            <CheckCircle2 className="size-12 text-status-success" aria-hidden />
            <p className="font-heading text-[22px] font-bold">{t('pa19.done')}</p>
            <p className="tabular">{t('pa29.doneLine', { name: data.fieldStaff[received.by]?.name ?? driverName, time: formatTime(received.at) })}</p>
          </section>
          <Link to="/app" className="flex min-h-14 items-center justify-center rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground">
            {t('pa29.backHome')}
          </Link>
        </>
      ) : (
        <HandoverCode refId={manifest.id} code={manifest.handoverCode!} receiverName={driverName} receiver={driver ? { id: driver.id, name: driver.name, path: `/app/receive/${manifest.id}` } : undefined} />
      )}
    </div>
  )
}
