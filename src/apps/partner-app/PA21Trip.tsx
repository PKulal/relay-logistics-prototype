/**
 * Driver's Trip tab — docs/03-partner-app.md §6.4.
 * PA-21 Trip detail before the start, PA-23 on the way, PA-24 on arrival, then
 * the hand-over to the destination hub (PA-19 code → hub's PA-20).
 */
import { ArrowRight, CheckCircle2, PackageCheck, Truck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { nextLegOf } from '@shared/engines/fieldTasks'
import { currentTrip, tripRoute } from '@shared/engines/trip'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatKg, formatTime } from '@shared/lib/format'
import { istDate } from '@shared/lib/time'
import { LANE_VIA } from '@shared/sim/routes'
import { manifestHandover } from '@shared/store/hubActions'
import type { Trip } from '@shared/types'
import { MapView } from '@shared/ui/MapView'
import { AccessDenied } from '@shared/ui/Page'
import { Card } from './FieldUi'
import { HandoverCode } from './HandoverCode'
import PA23OnTheWay from './PA23OnTheWay'
import PA24Arrival from './PA24Arrival'
import { dayTime, tripFacts } from './tripView'
import { useFieldSession } from './useFieldSession'

export default function PA21Trip() {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  if (staff.role !== 'driver') return <div className="p-4"><AccessDenied /></div>

  const trip = currentTrip(data, staff.id)
  if (!trip) {
    // The last trip handed over today
    const done = Object.values(data.trips)
      .filter((x) => x.driverId === staff.id && x.status === 'arrived' && x.arrivedAt && istDate(x.arrivedAt) === istDate(now))
      .at(-1)
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="font-heading text-[22px] font-bold">{t('pa21.title')}</h1>
        {done ? <Delivered trip={done} /> : <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('pa21.none')}</p>}
      </div>
    )
  }
  if (trip.status === 'inTransit') return <PA23OnTheWay trip={trip} />
  if (trip.status === 'arrived') return trip.handoverCode ? <ArrivalHandover trip={trip} /> : <PA24Arrival trip={trip} />
  return <TripDetail trip={trip} />
}

/** PA-21 Trip detail (before the start). */
function TripDetail({ trip }: { trip: Trip }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const f = tripFacts(data, trip)
  const route = tripRoute(data, trip)
  const pending = Object.values(data.manifests).filter((m) => m.tripId === trip.id && m.status === 'dispatched' && !manifestHandover(data, m.id)?.received)
  const ewbs = f.shipments.filter((s) => s.ewb)
  const firstExpiry = ewbs.map((s) => s.ewb!.validTill).sort()[0]

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <div>
        <p className="tabular text-[13px] text-muted-foreground">{trip.id}</p>
        <h1 className="font-heading text-[22px] leading-tight font-bold">
          {f.from.name} → {f.to.name}
        </h1>
        <p className="text-muted-foreground">
          {LANE_VIA[trip.laneId] ? `${t('pa21.via', { road: LANE_VIA[trip.laneId] })} · ` : ''}
          {t('pa21.km', { km: f.lane.distanceKm.toLocaleString('en-IN') })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Fact label={t('pa21.departs')} value={dayTime(trip.departAt)} />
        <Fact label={t('pa21.eta')} value={dayTime(trip.eta)} />
      </div>

      <Card title={t('pa21.truck')}>
        <p className="tabular text-[18px] font-semibold">{f.vehicle?.regNo}</p>
        <p className="text-muted-foreground">{f.vehicle?.type}</p>
      </Card>

      <Card title={t('pa21.load')}>
        {f.legs.length === 0 ? (
          <p className="text-muted-foreground">{t('pa21.notLoaded', { hub: f.from.name })}</p>
        ) : (
          <>
            <p className="tabular font-semibold">{t('pa21.shipments', { count: f.legs.length })} · {t('pa25.bags', { count: f.bags.length })} · {formatKg(f.kg)}</p>
            <ul className="tabular mt-1 text-[13px] text-muted-foreground">
              {f.manifests.map((m) => (
                <li key={m.id}>{t('pa21.manifestLine', { id: m.id, bags: m.bagIds.length })}</li>
              ))}
            </ul>
          </>
        )}
        {pending.map((m) => (
          <Link key={m.id} to={`/app/receive/${m.id}`} className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary font-semibold text-primary">
            <PackageCheck className="size-5" aria-hidden /> {t('pa21.receive', { id: m.id })}
          </Link>
        ))}
      </Card>

      {f.seals.length > 0 && (
        <Card title={t('pa21.seals')}>
          <p className="tabular">{f.seals.join(' · ')}</p>
        </Card>
      )}

      {ewbs.length > 0 && (
        <Card title={t('pa21.ewbs')}>
          <p className="tabular">{t('pa21.ewbLine', { count: ewbs.length, date: formatDate(firstExpiry) })}</p>
          <p className={cn('text-[13px] font-medium', ewbs.every((s) => s.ewb!.partBUpdated) ? 'text-status-success' : 'text-status-warning')}>
            {ewbs.every((s) => s.ewb!.partBUpdated) ? t('pa21.partBDone') : t('pa21.partBPending')}
          </p>
        </Card>
      )}

      <section className="h-80 overflow-hidden rounded-2xl border">
        <MapView
          ariaLabel={t('pa21.map')}
          route={route}
          markers={[
            { ...route[0], id: 'from', tone: 'info', label: f.from.name, emphasis: true },
            { ...route[route.length - 1], id: 'to', tone: 'success', label: f.to.name, emphasis: true },
          ]}
          className="h-full"
        />
      </section>

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        {f.legs.length > 0 ? (
          <Link to="/app/trip/start" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground">
            <Truck className="size-5" aria-hidden /> {t('pa21.start')} <ArrowRight className="size-5" aria-hidden />
          </Link>
        ) : (
          <p className="text-center text-[13px] text-muted-foreground">{t('pa21.startAfterLoad')}</p>
        )}
      </div>
    </div>
  )
}

/** PA-24 → PA-19: the code for the destination hub, then "Handed over". */
function ArrivalHandover({ trip }: { trip: Trip }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const f = tripFacts(data, trip)
  const first = f.legs[0]
  const receiverLeg = first ? nextLegOf(data, first) : undefined
  const receiver = receiverLeg?.staffId ? data.fieldStaff[receiverLeg.staffId] : undefined
  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="tabular text-[13px] text-muted-foreground">{trip.id}</p>
        <h1 className="font-heading text-[22px] font-bold">{t('pa24.handOverTitle')}</h1>
      </div>
      <Card title={t('pa19.to')}>
        <p className="text-[18px] font-semibold">{f.to.name}</p>
        <p className="text-muted-foreground">{receiver ? `${receiver.name} · ` : ''}{t('pa25.bags', { count: f.bags.length })}</p>
      </Card>
      <HandoverCode
        refId={trip.id}
        code={trip.handoverCode!}
        receiverName={receiver?.name ?? f.to.name}
        receiver={receiver && receiverLeg ? { id: receiver.id, name: receiver.name, path: `/app/tasks/${receiverLeg.id}` } : undefined}
      />
    </div>
  )
}

function Delivered({ trip }: { trip: Trip }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const f = tripFacts(data, trip)
  const received = f.legs
    .map((l) => nextLegOf(data, l))
    .map((l) => Object.values(data.events).find((e) => e.legId === l?.id && e.type === 'handoverReceived'))
    .find(Boolean)
  return (
    <section className="flex flex-col items-center gap-2 rounded-2xl border-2 border-status-success bg-status-success-bg p-6 text-center" role="status">
      <CheckCircle2 className="size-12 text-status-success" aria-hidden />
      <p className="font-heading text-[22px] font-bold">{t('pa19.done')}</p>
      <p className="tabular">
        {trip.id} · {f.to.name}
      </p>
      {received && <p className="tabular">{t('pa29.doneLine', { name: data.fieldStaff[received.by]?.name ?? f.to.name, time: formatTime(received.at) })}</p>}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="tabular text-[18px] font-bold">{value}</p>
    </div>
  )
}
