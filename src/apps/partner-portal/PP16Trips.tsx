/**
 * PP-16 Line-haul trips — docs/02-partner-portal.md. Source §5.1 (Line-Haul
 * Trip: GPS / FASTag tracking, halts, breakdowns, seal check), §7 Step 6 (AI
 * delay prediction from GPS progress; customers get a revised ETA). Positions
 * are SIMULATED GPS / FASTag. Report breakdown raises a Control Tower ticket
 * (same as PA-23); Change vehicle prompts the e-way bill Part B update.
 */
import { AlertTriangle, ArrowLeft, Truck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { bagOfPiece } from '@shared/engines/hub'
import { tripEtaInfo, tripLoad, tripsOf, tripState, type TripState } from '@shared/engines/partnerOps'
import { tripPosition, tripRoute } from '@shared/engines/trip'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDateTime, formatDuration } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import type { Trip } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { MapView } from '@shared/ui/MapView'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Chip } from '@shared/ui/StatusChip'
import type { Tone } from '@shared/ui/tones'
import { usePartnerSession } from './usePartnerSession'

const TONE: Record<TripState, Tone> = { planned: 'neutral', loading: 'info', inTransit: 'info', halted: 'warning', breakdown: 'danger', arrived: 'success', closed: 'neutral' }

export default function PP16Trips() {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [params, setParams] = useSearchParams()
  const trips = tripsOf(data, partner.id)
  const open = data.trips[params.get('trip') ?? '']

  if (open && trips.some((x) => x.id === open.id)) return <TripDetail trip={open} onBack={() => setParams({})} />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t('pp16.title')} subtitle={t('pp16.subtitle', { count: trips.length })} className="mb-0" />
      {trips.length === 0 ? (
        <EmptyState icon={Truck} title={t('pp16.empty')} body={t('pp16.emptyBody')} />
      ) : (
        <section className="overflow-x-auto rounded-xl border bg-card shadow-card">
          <table className="w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="trips">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp16.col.trip')}</th>
                <th>{t('pp16.col.lane')}</th>
                <th>{t('pp16.col.truck')}</th>
                <th>{t('pp16.col.load')}</th>
                <th>{t('pp16.col.times')}</th>
                <th>{t('pp16.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {trips.map((trip) => {
                const st = tripState(data, trip, now)
                const load = tripLoad(data, trip)
                const eta = tripEtaInfo(trip)
                const lane = data.lanes[trip.laneId]
                return (
                  <tr key={trip.id} className="border-b last:border-0" aria-label={trip.id}>
                    <td className="px-4 py-2">
                      <button type="button" className="tabular font-medium text-primary hover:underline" onClick={() => setParams({ trip: trip.id })}>
                        {trip.id}
                      </button>
                    </td>
                    <td>{lane ? `${data.hubs[lane.originHubId]?.name} → ${data.hubs[lane.destHubId]?.name}` : '—'}</td>
                    <td className="text-caption">
                      {data.vehicles[trip.vehicleId]?.regNo} · {data.fieldStaff[trip.driverId]?.name}
                    </td>
                    <td className="text-caption">{t('pp16.load', { shipments: load.shipments, kg: load.kg.toLocaleString('en-IN') })}</td>
                    <td className="tabular text-caption">
                      {formatDateTime(trip.startedAt ?? trip.departAt)} / <span className={eta.atRisk ? 'font-semibold text-status-danger' : ''}>{formatDateTime(eta.eta)}</span>
                    </td>
                    <td>
                      <Chip tone={TONE[st]}>{t(`pp16.st.${st}`)}</Chip>
                      {eta.atRisk && st !== 'arrived' && st !== 'closed' && <span className="ml-1 text-caption font-medium text-status-danger">{t('pp16.etaRisk')}</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function TripDetail({ trip, onBack }: { trip: Trip; onBack: () => void }) {
  const { t } = useTranslation()
  const { user } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [breakdown, setBreakdown] = useState(false)
  const [change, setChange] = useState(false)
  const st = tripState(data, trip, now)
  const load = tripLoad(data, trip)
  const eta = tripEtaInfo(trip)
  const route = tripRoute(data, trip)
  const pos = trip.status === 'inTransit' ? tripPosition(data, trip, now) : undefined
  const lane = data.lanes[trip.laneId]
  const ewbs = load.legs.map((l) => data.shipments[l.shipmentId]).filter((s) => s.ewb)
  const sealIssue = Object.values(data.exceptions).some((x) => x.type === 'sealMismatch' && x.legId && trip.legIds.includes(x.legId))
  const destHub = lane ? lane.destHubId : ''

  return (
    <div className="flex flex-col gap-4">
      <button type="button" onClick={onBack} className="flex w-fit items-center gap-1 text-caption font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> {t('pp16.back')}
      </button>
      <PageHeader
        title={trip.id}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone={TONE[st]}>{t(`pp16.st.${st}`)}</Chip>
            {lane && `${data.hubs[lane.originHubId]?.name} → ${data.hubs[lane.destHubId]?.name}`} · {data.vehicles[trip.vehicleId]?.regNo} · {data.fieldStaff[trip.driverId]?.name}
          </span>
        }
        actions={
          trip.status !== 'arrived' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setChange(true)}>
                {t('pp16.change')}
              </Button>
              <Button variant="destructive" disabled={trip.status !== 'inTransit'} onClick={() => setBreakdown(true)}>
                <AlertTriangle /> {t('pp16.breakdown')}
              </Button>
            </div>
          )
        }
        className="mb-0"
      />
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div>
          <MapView markers={[...(pos ? [{ id: 'truck', ...pos, tone: eta.atRisk ? ('danger' as const) : ('info' as const), label: data.vehicles[trip.vehicleId]?.regNo ?? '', emphasis: true }] : []), ...trip.halts.map((h, i) => ({ id: `h${i}`, lat: h.lat, lng: h.lng, tone: 'warning' as const, label: `${h.reason} · ${formatDuration(h.minutes)}` }))]} route={route} className="h-80" ariaLabel={t('pp16.map')} />
          <p className="mt-1 flex items-center gap-2 text-caption text-muted-foreground">
            {t('pp16.gps')} <SimulatedTag />
          </p>
        </div>
        <section className="flex flex-col gap-2 rounded-xl border bg-card p-4 shadow-card" aria-label={t('pp16.summary')}>
          <p>{t('pp16.load', { shipments: load.shipments, kg: load.kg.toLocaleString('en-IN') })}</p>
          <p className="text-caption text-muted-foreground">{t('pp16.pieces', { count: load.pieces })}</p>
          <p className="tabular">
            {t('pp16.departed', { at: formatDateTime(trip.startedAt ?? trip.departAt) })}
            <span className={eta.atRisk ? 'block font-semibold text-status-danger' : 'block'}>{t(eta.atRisk ? 'pp16.etaLate' : 'pp16.eta', { at: formatDateTime(eta.eta) })}</span>
          </p>
          <p>
            {t('pp16.seals')} <span className="tabular">{trip.sealNos.length ? trip.sealNos.join(', ') : '—'}</span>
          </p>
          <p>
            {t('pp16.partB')}{' '}
            {ewbs.length === 0 ? '—' : ewbs.every((s) => s.ewb!.partBUpdated) ? <Chip tone="success">{t('pp16.partBOk')}</Chip> : <Chip tone="warning">{t('pp16.partBPending', { count: ewbs.filter((s) => !s.ewb!.partBUpdated).length })}</Chip>}
          </p>
          {trip.arrivedAt && (
            <div className="rounded-lg border p-2" data-testid="arrival">
              <p className="font-semibold">{t('pp16.arrival', { at: formatDateTime(trip.arrivedAt) })}</p>
              <p className="text-caption">{sealIssue ? t('pp16.sealIssue') : t('pp16.sealOk', { count: trip.sealNos.length })}</p>
              {destHub && <p className="text-caption text-muted-foreground">{data.hubs[destHub]?.name}</p>}
            </div>
          )}
        </section>
      </div>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('pp16.halts')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('pp16.halts')}</h2>
        {trip.halts.length === 0 ? (
          <p className="p-4 text-muted-foreground">{t('pp16.noHalts')}</p>
        ) : (
          <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="halts">
            <thead>
              <tr className="border-b text-left text-caption text-muted-foreground">
                <th className="px-4 py-2">{t('pp16.col.time')}</th>
                <th>{t('pp16.col.type')}</th>
                <th>{t('pp16.col.duration')}</th>
                <th>{t('pp16.col.remark')}</th>
              </tr>
            </thead>
            <tbody>
              {trip.halts.map((h, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="tabular px-4 py-2">{formatDateTime(h.at)}</td>
                  <td>{h.breakdown ? <Chip tone="danger">{t('pp16.st.breakdown')}</Chip> : t('pp16.halt')}</td>
                  <td className="tabular">{formatDuration(h.minutes)}</td>
                  <td className="text-caption">{h.breakdown ? `${h.breakdown.issue}${h.breakdown.backupVehicle ? ` · ${t('pp16.backupAsked')}` : ''}` : h.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl border bg-card shadow-card" aria-label={t('pp16.manifest')}>
        <h2 className="px-4 pt-4 font-heading text-section font-semibold">{t('pp16.manifest')}</h2>
        <table className="mt-2 w-full text-table [&_td]:pr-3 [&_th]:pr-3" data-testid="trip-manifest">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="px-4 py-2">LR</th>
              <th>{t('pp16.col.pieces')}</th>
              <th>{t('pp16.col.weight')}</th>
              <th>{t('pp16.col.bag')}</th>
            </tr>
          </thead>
          <tbody>
            {load.legs.map((l) => {
              const s = data.shipments[l.shipmentId]
              const bag = lane && s.pieces[0] ? bagOfPiece(data, lane.originHubId, s.pieces[0].id) : undefined
              return (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="px-4 py-1.5">
                    <Link to={`/partner/jobs/${l.id}`} className="tabular text-primary hover:underline">
                      {s.id}
                    </Link>
                  </td>
                  <td className="tabular">{s.pieces.length}</td>
                  <td className="tabular">{Math.round(s.weights.verifiedChargeable ?? s.weights.chargeable)} kg</td>
                  <td className="tabular text-caption">{bag?.id ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {breakdown && <BreakdownDialog trip={trip} onClose={() => setBreakdown(false)} />}
      {change && <ChangeVehicleDialog trip={trip} userId={user.id} onClose={() => setChange(false)} />}
    </div>
  )
}

function BreakdownDialog({ trip, onClose }: { trip: Trip; onClose: () => void }) {
  const { t } = useTranslation()
  const [issue, setIssue] = useState('')
  const [minutes, setMinutes] = useState('180')
  const [backup, setBackup] = useState(true)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pp16.breakdownTitle', { trip: trip.id })}</DialogTitle>
        </DialogHeader>
        <Field label={t('pp16.issue')} htmlFor="bd-issue" required>
          <Input id="bd-issue" value={issue} placeholder={t('pp16.issueHint')} onChange={(e) => setIssue(e.target.value)} />
        </Field>
        <Field label={t('pp16.delay')} htmlFor="bd-min" required>
          <Input id="bd-min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ''))} />
        </Field>
        <label className="flex items-center gap-2">
          <Checkbox checked={backup} onCheckedChange={(v) => setBackup(!!v)} /> {t('pp16.backup')}
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={!issue.trim() || !(Number(minutes) > 0)}
            onClick={() => {
              useDemoStore.getState().reportHalt({ tripId: trip.id, staffId: trip.driverId, reason: 'breakdown', minutes: Number(minutes), breakdown: { issue: issue.trim(), backupVehicle: backup, photos: [] } })
              toast.success(t('pp16.breakdownSent'))
              onClose()
            }}
          >
            {t('pp16.breakdown')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ChangeVehicleDialog({ trip, userId, onClose }: { trip: Trip; userId: string; onClose: () => void }) {
  const { t } = useTranslation()
  const { partner } = usePartnerSession()
  const data = useData((d) => d)
  const vehicles = Object.values(data.vehicles).filter((v) => v.partnerId === partner.id && v.active !== false)
  const drivers = Object.values(data.fieldStaff).filter((s) => s.partnerId === partner.id && s.role === 'driver' && (s.status ?? 'active') === 'active')
  const [vehicleId, setVehicleId] = useState(trip.vehicleId)
  const [driverId, setDriverId] = useState(trip.driverId)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('pp16.changeTitle', { trip: trip.id })}</DialogTitle>
        </DialogHeader>
        <Field label={t('pp16.truck')} htmlFor="cv-v" required>
          <NativeSelect id="cv-v" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.regNo} · {v.type}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t('pp16.driver')} htmlFor="cv-d" required>
          <NativeSelect id="cv-d" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <p className="text-caption text-muted-foreground">{t('pp16.partBNote')}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={vehicleId === trip.vehicleId && driverId === trip.driverId}
            onClick={() => {
              useDemoStore.getState().changeTripVehicle(trip.id, vehicleId, driverId, userId)
              toast.success(t('pp16.changed'))
              onClose()
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
