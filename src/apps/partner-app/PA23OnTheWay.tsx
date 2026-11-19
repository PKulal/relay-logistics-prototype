/**
 * PA-23 Trip in progress — docs/03-partner-app.md §6.4.
 * The truck on the map, distance and ETA, and big buttons to report a halt or
 * a breakdown (source §5.1). The ETA is Logisco's delay estimate (§7 Step 6).
 * SIMULATED: the truck moves with the demo clock; location is the route point.
 */
import { AlertTriangle, Clock, MapPin, OctagonPause, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { activeHalt, etaAtRisk, nextCheckpoint, tripEta, tripPosition, tripProgress, tripRoute } from '@shared/engines/trip'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatTime } from '@shared/lib/format'
import { istDate } from '@shared/lib/time'
import { useDemoStore } from '@shared/store'
import type { Trip } from '@shared/types'
import { MapView } from '@shared/ui/MapView'
import { PhotoCapture } from '@shared/ui/PhotoCapture'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card, Choice } from './FieldUi'
import { dayTime, tripFacts } from './tripView'
import { useFieldSession } from './useFieldSession'

const HALT_REASONS = ['rest', 'traffic', 'police', 'loading', 'other'] as const
const DURATIONS = [30, 60, 120, 180, 360]
const ISSUES = ['engine', 'tyre', 'accident', 'other'] as const
const FIX_HOURS = [1, 2, 4, 8, 12]

type Panel = 'halt' | 'breakdown' | undefined

export default function PA23OnTheWay({ trip }: { trip: Trip }) {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [panel, setPanel] = useState<Panel>()
  const [reason, setReason] = useState<(typeof HALT_REASONS)[number]>('rest')
  const [minutes, setMinutes] = useState(60)
  const [issue, setIssue] = useState<(typeof ISSUES)[number]>('engine')
  const [fixHours, setFixHours] = useState(4)
  const [backup, setBackup] = useState(false)
  const [photo, setPhoto] = useState('')

  const f = tripFacts(data, trip)
  const route = tripRoute(data, trip)
  const progress = tripProgress(trip, now)
  const pos = tripPosition(data, trip, now)
  const covered = Math.round(progress * f.lane.distanceKm)
  const eta = tripEta(trip)
  const late = etaAtRisk(trip)
  const halted = activeHalt(trip, now)
  const next = nextCheckpoint(data, trip, now)
  const arrived = progress >= 1
  // E-way bills that would expire before the truck arrives: Logisco extends them (source §11.1)
  const expiring = f.shipments.filter((s) => s.ewb && s.ewb.validTill < istDate(eta))

  const report = () => {
    if (panel === 'halt') {
      useDemoStore.getState().reportHalt({ tripId: trip.id, staffId: staff.id, reason: t(`pa23.reason.${reason}`, { lng: 'en' }), minutes })
      toast.success(t('pa23.haltSent'))
    } else {
      useDemoStore.getState().reportHalt({ tripId: trip.id, staffId: staff.id, reason: 'breakdown', minutes: fixHours * 60, breakdown: { issue: t(`pa23.issue.${issue}`, { lng: 'en' }), backupVehicle: backup, photos: [photo] } })
      toast.warning(t('pa23.breakdownSent'))
    }
    setPanel(undefined)
    setPhoto('')
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <div>
        <p className="tabular text-[13px] text-muted-foreground">{trip.id}</p>
        <h1 className="font-heading text-[22px] leading-tight font-bold">
          {f.from.name} → {f.to.name}
        </h1>
      </div>

      <section className="h-80 overflow-hidden rounded-2xl border">
        <MapView
          ariaLabel={t('pa21.map')}
          route={route}
          markers={[
            { ...route[0], id: 'from', tone: 'info', label: f.from.name },
            { ...route[route.length - 1], id: 'to', tone: 'success', label: f.to.name },
            { ...pos, id: 'truck', tone: halted ? 'warning' : 'info', label: f.vehicle?.regNo ?? trip.id, emphasis: true },
          ]}
          className="h-full"
        />
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border bg-card p-3">
          <p className="text-[13px] text-muted-foreground">{t('pa23.distance')}</p>
          <p className="tabular text-[18px] font-bold" data-testid="trip-km">
            {t('pa23.kmOf', { done: covered.toLocaleString('en-IN'), total: f.lane.distanceKm.toLocaleString('en-IN') })}
          </p>
          {next && <p className="text-[13px] text-muted-foreground">{t('pa23.next', { place: next })}</p>}
        </div>
        <div className={cn('rounded-2xl border p-3', late ? 'border-status-danger bg-status-danger-bg' : 'bg-card')}>
          <p className="text-[13px] text-muted-foreground">
            {trip.halts.length ? t('pa23.etaRevised') : t('pa21.eta')} <SimulatedTag />
          </p>
          <p className={cn('tabular text-[18px] font-bold', late && 'text-status-danger')} data-testid="trip-eta">
            {dayTime(eta)}
          </p>
          <p className="text-[13px] text-muted-foreground">{t('pa23.due', { time: dayTime(trip.eta) })}</p>
        </div>
      </section>

      {halted && (
        <p className="flex items-center gap-2 rounded-2xl bg-status-warning-bg p-3 font-semibold text-status-warning" role="status">
          <OctagonPause className="size-5 shrink-0" aria-hidden />
          {t('pa23.stopped', { reason: halted.breakdown ? t('pa23.breakdown') : halted.reason, time: formatTime(new Date(Date.parse(halted.at) + halted.minutes * 60_000)) })}
        </p>
      )}
      {late && (
        <p className="flex items-start gap-2 text-[13px] font-semibold text-status-danger" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('pa23.late')}
        </p>
      )}
      {expiring.map((s) => (
        <p key={s.id} className="flex items-start gap-2 rounded-2xl bg-status-warning-bg p-3 text-[13px] font-medium">
          <Clock className="mt-0.5 size-4 shrink-0 text-status-warning" aria-hidden /> {t('pa23.ewbExpiring', { no: s.ewb!.no, date: formatDate(s.ewb!.validTill) })}
        </p>
      ))}

      {!panel && !arrived && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setPanel('halt')} className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-brand-amber bg-card font-bold">
            <OctagonPause className="size-6" aria-hidden /> {t('pa23.reportHalt')}
          </button>
          <button type="button" onClick={() => setPanel('breakdown')} className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-status-danger bg-card font-bold text-status-danger">
            <Wrench className="size-6" aria-hidden /> {t('pa23.reportBreakdown')}
          </button>
        </div>
      )}

      {panel === 'halt' && (
        <Card title={t('pa23.reportHalt')}>
          {HALT_REASONS.map((r) => (
            <Choice key={r} checked={reason === r} onClick={() => setReason(r)} label={t(`pa23.reason.${r}`)} />
          ))}
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-[13px] font-medium">{t('pa23.howLong')}</span>
            <select aria-label={t('pa23.howLong')} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="h-12 rounded-lg border border-input bg-background px-3 text-[16px]">
              {DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {t('pa23.minutes', { count: m })}
                </option>
              ))}
            </select>
          </label>
        </Card>
      )}

      {panel === 'breakdown' && (
        <Card title={t('pa23.reportBreakdown')}>
          {ISSUES.map((i) => (
            <Choice key={i} checked={issue === i} onClick={() => setIssue(i)} label={t(`pa23.issue.${i}`)} />
          ))}
          <p className="tabular mt-2 flex items-center gap-1 text-[13px] text-muted-foreground">
            <MapPin className="size-4" aria-hidden /> {t('pa23.location', { lat: pos.lat.toFixed(4), lng: pos.lng.toFixed(4) })} <SimulatedTag />
          </p>
          <label className="mt-2 flex flex-col gap-1">
            <span className="text-[13px] font-medium">{t('pa23.fixTime')}</span>
            <select aria-label={t('pa23.fixTime')} value={fixHours} onChange={(e) => setFixHours(Number(e.target.value))} className="h-12 rounded-lg border border-input bg-background px-3 text-[16px]">
              {FIX_HOURS.map((h) => (
                <option key={h} value={h}>
                  {t('pa23.hours', { count: h })}
                </option>
              ))}
            </select>
          </label>
          <Choice checkbox checked={backup} onClick={() => setBackup(!backup)} label={t('pa23.backup')} />
          <PhotoCapture className="mt-2" label={t('pa23.breakdownPhoto')} caption={t(`pa23.issue.${issue}`)} value={photo} onChange={setPhoto} idBase={`${trip.id}-breakdown`} required />
        </Card>
      )}

      <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
        {panel ? (
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <button type="button" onClick={() => setPanel(undefined)} className="min-h-14 rounded-2xl border-2 px-4 font-semibold">
              {t('common.cancel')}
            </button>
            <button type="button" disabled={panel === 'breakdown' && !photo} onClick={report} className="min-h-14 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
              {t('pa23.send')}
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={!arrived}
              onClick={() => useDemoStore.getState().arriveTrip(trip.id, staff.id)}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40"
            >
              <MapPin className="size-5" aria-hidden /> {t('pa23.arrived')}
            </button>
            {!arrived && <p className="mt-1 text-center text-[13px] text-muted-foreground">{t('pa23.arriveHint', { hub: f.to.name })}</p>}
          </>
        )}
      </div>
    </div>
  )
}
