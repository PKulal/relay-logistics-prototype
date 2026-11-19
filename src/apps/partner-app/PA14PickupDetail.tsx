/**
 * PA-14 Pickup task detail — docs/03-partner-app.md §6.2.
 * Everything the rider needs before reaching the shipper; "I've arrived" checks
 * the 200 m geo-fence (SIMULATED: always passes) and opens the pickup flow.
 */
import { ArrowLeft, MapPin, Navigation, PhoneCall } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { jobEnds } from '@shared/engines/partnerJobs'
import { useData } from '@shared/hooks/useDemo'
import { formatKg, formatTime } from '@shared/lib/format'
import { addHours } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import type { Leg } from '@shared/types'
import { MapView } from '@shared/ui/MapView'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { useFieldSession } from './useFieldSession'

export default function PA14PickupDetail({ leg }: { leg: Leg }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const s = data.shipments[leg.shipmentId]
  const loc = data.pickupLocations[s.pickupLocationId]
  const customer = data.customers[s.customerId]
  const handTo = jobEnds(data, leg, s).to
  const hubLeg = s.legIds.map((id) => data.legs[id]).find((l) => l.type === 'originHub')
  // Hand-over deadline: the hub needs the goods 2 hours before the truck (seal and load)
  const handBy = hubLeg ? addHours(hubLeg.window.to, -2) : leg.window.to
  // Other LRs this rider collects at the same address in the same slot
  const sameStop = Object.values(data.legs).filter(
    (l) => l.staffId === staff.id && l.type === 'firstMile' && l.status === 'assigned' && data.shipments[l.shipmentId].pickupLocationId === loc.id && l.window.from === leg.window.from,
  )
  const arrived = Object.values(data.events).some((e) => e.legId === leg.id && e.type === 'pickupArrived')

  const requirements = [t('pa14.req.invoice'), ...(s.ewb ? [t('pa14.req.ewb')] : []), ...(s.addOns.specialHandling ? [t('pa14.req.fragile')] : []), t('pa14.req.labels')]

  return (
    <div className="flex flex-col gap-4 p-4">
      <Link to="/app/tasks" className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa14.back')}
      </Link>
      <h1 className="font-heading text-[22px] font-bold">{t('pa.task.pickup')}</h1>

      <section className="rounded-2xl border bg-card p-4">
        <p className="text-[18px] font-bold">{customer.shortName}</p>
        <p className="flex items-start gap-1.5 text-muted-foreground">
          <MapPin className="mt-1 size-4 shrink-0" aria-hidden />
          {loc.name}, {loc.address} {loc.pincode}
        </p>
        <MapView ariaLabel={t('pa14.map')} className="mt-3 h-40" markers={[{ id: 'pin', lat: loc.lat, lng: loc.lng, tone: 'info', emphasis: true, label: loc.name }]} />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary font-semibold text-primary">
            <Navigation className="size-4" aria-hidden /> {t('pa.navigate')}
          </a>
          <button type="button" onClick={() => toast.success(t('pa.calling', { name: (s.pickupContact ?? loc.contact).name }))} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary font-semibold text-primary">
            <PhoneCall className="size-4" aria-hidden /> {(s.pickupContact ?? loc.contact).name}
          </button>
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-2">
        <Info label={t('pa14.window')} value={`${leg.window.from.slice(11, 16)}–${leg.window.to.slice(11, 16)}`} />
        <Info label={t('pa14.handTo')} value={t('pa14.handToValue', { place: handTo.name, time: formatTime(handBy) })} />
      </dl>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 font-bold">{t('pa14.shipments', { count: sameStop.length })}</h2>
        <ul className="flex flex-col gap-1">
          {sameStop.map((l) => {
            const sh = data.shipments[l.shipmentId]
            return (
              <li key={l.id} className="tabular flex justify-between gap-2">
                <span className={l.id === leg.id ? 'font-semibold' : ''}>{sh.id}</span>
                <span className="text-muted-foreground">
                  {t('pp.pcs', { count: sh.pieces.length })} · {formatKg(sh.weights.actual)}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-bold">{t('pa14.requirements')}</h2>
        <ul className="flex flex-wrap gap-2">
          {requirements.map((r) => (
            <li key={r} className="rounded-full bg-gray-100 px-3 py-1 text-[14px] font-medium">
              {r}
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        onClick={() => {
          if (!arrived) useDemoStore.getState().arriveAtPickup(leg.id, staff.id)
          toast.success(t('pa14.arrivedOk'))
          navigate(`/app/tasks/${leg.id}/pickup`)
        }}
        className="min-h-14 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground"
      >
        {arrived ? t('pa14.continue') : t('pa14.arrived')}
      </button>
      <p className="-mt-2 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
        {t('pa14.geofence', { m: data.settings.arrivalGeofenceM })} <SimulatedTag />
      </p>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="tabular font-bold">{value}</dd>
    </div>
  )
}
