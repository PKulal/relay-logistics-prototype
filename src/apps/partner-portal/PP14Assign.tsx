/**
 * PP-14 Assign to field staff — docs/02-partner-portal.md §6.4.
 * One or more accepted jobs go to a rider, driver or hub staff member, who gets
 * them in the Partner App. Line-haul jobs choose truck, driver and co-driver.
 */
import { ArrowLeft, Sparkles, UserCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { JOB_TYPE, staffOptions, suggestedStaff, vehicleRequired } from '@shared/engines/partnerJobs'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { Field } from '@shared/ui/FormField'
import { Input } from '@shared/ui/input'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { Chip } from '@shared/ui/StatusChip'
import { usePartnerSession } from './usePartnerSession'

export default function PP14Assign() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, partner } = usePartnerSession()
  const data = useData((d) => d)
  const now = useDemoNow()

  // Only this partner's jobs that can be (re)assigned
  const legs = (params.get('ids') ?? '')
    .split(',')
    .map((id) => data.legs[id])
    .filter((l) => l && l.partnerId === partner.id && ['accepted', 'assigned'].includes(l.status))
  const legType = legs[0]?.type
  const sameType = legs.every((l) => l.type === legType)
  const options = legType ? staffOptions(data, partner.id, legType, now) : []
  const suggested = suggestedStaff(options)
  const vehicles = Object.values(data.vehicles).filter((v) => v.partnerId === partner.id)
  const needsVehicle = legs.some((l) => vehicleRequired(l, data.shipments[l.shipmentId]))
  const lineHaul = legType === 'lineHaul'

  const [staffId, setStaffId] = useState(legs.length === 1 ? (legs[0].staffId ?? '') : '')
  const [vehicleId, setVehicleId] = useState(legs.length === 1 ? (legs[0].vehicleId ?? '') : '')
  const [coDriver, setCoDriver] = useState('')
  const [note, setNote] = useState(() => {
    const s = legs.length === 1 ? data.shipments[legs[0].shipmentId] : undefined
    return legs[0]?.type === 'firstMile' ? (s?.pickupInstructions ?? '') : ''
  })
  const [tried, setTried] = useState(false)

  if (legs.length === 0) {
    return <EmptyState title={t('pp14.nothing')} body={t('pp14.nothingBody')} action={<Button onClick={() => navigate('/partner/jobs?tab=accepted')}>{t('pp14.toInbox')}</Button>} />
  }

  const chosen = options.find((o) => o.staff.id === staffId)
  const pickStaff = (id: string) => {
    setStaffId(id)
    const own = data.fieldStaff[id]?.vehicleId
    if (own) setVehicleId(own)
  }
  const errors = {
    staff: !chosen ? t('pp14.err.staff') : chosen.block ? t(`pp14.block.${chosen.block}`) : undefined,
    vehicle: needsVehicle && !vehicleId ? t('pp14.err.vehicle') : undefined,
    mixed: !sameType ? t('pp14.err.mixed') : undefined,
  }
  const valid = !errors.staff && !errors.vehicle && !errors.mixed

  const assign = () => {
    setTried(true)
    if (!valid) return
    const fullNote = [note.trim(), coDriver ? t('pp14.coDriverNote', { name: data.fieldStaff[coDriver].name }) : ''].filter(Boolean).join(' · ')
    useDemoStore.getState().assignLegs(
      legs.map((l) => l.id),
      staffId,
      vehicleId || undefined,
      fullNote,
      user.id,
    )
    toast.success(t('pp14.done', { count: legs.length, name: chosen!.staff.name }))
    navigate(legs.length === 1 ? `/partner/jobs/${legs[0].id}` : '/partner/jobs?tab=assigned')
  }

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <Link to="/partner/jobs?tab=accepted" className="inline-flex w-fit items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t('pp13.back')}
      </Link>
      <PageHeader title={lineHaul ? t('pp14.titleTrip') : t('pp14.title')} subtitle={t('pp14.subtitle')} className="mb-0" />

      {/* Jobs selected */}
      <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="sel-h">
        <h2 id="sel-h" className="mb-2 text-card-title">
          {t('pp14.selected', { count: legs.length })}
        </h2>
        <ul className="flex flex-wrap gap-2">
          {legs.map((l) => (
            <li key={l.id}>
              <Chip tone="info" className="tabular">
                {l.id} · {t(`pp.jobType.${JOB_TYPE[l.type]}`)} · {l.window.from.slice(11, 16)}–{l.window.to.slice(11, 16)}
              </Chip>
            </li>
          ))}
        </ul>
        {errors.mixed && <p className="mt-2 text-caption font-medium text-status-danger">{errors.mixed}</p>}
      </section>

      {/* Staff */}
      <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="staff-h">
        <h2 id="staff-h" className="mb-1 text-card-title">
          {lineHaul ? t('pp14.driver') : t('pp14.staff')}
        </h2>
        {suggested.length > 0 && (
          <p className="mb-3 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" aria-hidden /> {t('pp14.suggested')}
            {suggested.map((o) => (
              <button key={o.staff.id} type="button" onClick={() => pickStaff(o.staff.id)} className="rounded-full border px-2 py-0.5 font-medium text-foreground hover:border-primary">
                {o.staff.name}
              </button>
            ))}
          </p>
        )}
        <div role="radiogroup" aria-label={lineHaul ? t('pp14.driver') : t('pp14.staff')} className="grid gap-2 sm:grid-cols-2">
          {options.map((o) => (
            <button
              key={o.staff.id}
              type="button"
              role="radio"
              aria-checked={staffId === o.staff.id}
              disabled={!!o.block}
              onClick={() => pickStaff(o.staff.id)}
              className={cn(
                'flex flex-col items-start rounded-lg border p-3 text-left',
                staffId === o.staff.id ? 'border-primary bg-primary-soft' : 'hover:bg-accent',
                o.block && 'cursor-not-allowed opacity-60',
              )}
            >
              <span className="font-semibold">{o.staff.name}</span>
              <span className="text-caption text-muted-foreground">
                {t(`roles.field.${o.staff.role}`)} · {t('pp14.jobsToday', { count: o.jobsToday })} · {o.staff.onDuty ? t('pa.onDuty') : t('pa.offDuty')}
              </span>
              {o.block && <span className="mt-1 text-caption font-medium text-status-danger">{t(`pp14.block.${o.block}`)}</span>}
            </button>
          ))}
        </div>
        {tried && errors.staff && <p className="mt-2 text-caption font-medium text-status-danger">{errors.staff}</p>}
      </section>

      {/* Vehicle / truck, co-driver, note */}
      <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-2" aria-label={t('pp14.details')}>
        <Field label={lineHaul ? t('pp14.truck') : t('pp14.vehicle')} htmlFor="as-veh" required={needsVehicle} error={tried ? errors.vehicle : undefined} hint={needsVehicle ? t('pp14.vehicleRule') : undefined}>
          <NativeSelect id="as-veh" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
            <option value="">{t('pp14.noVehicle')}</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.regNo} · {v.type}
              </option>
            ))}
          </NativeSelect>
        </Field>
        {lineHaul && (
          <Field label={t('pp14.coDriver')} htmlFor="as-co">
            <NativeSelect id="as-co" value={coDriver} onChange={(e) => setCoDriver(e.target.value)}>
              <option value="">{t('pp14.none')}</option>
              {options
                .filter((o) => o.staff.id !== staffId && !o.block)
                .map((o) => (
                  <option key={o.staff.id} value={o.staff.id}>
                    {o.staff.name}
                  </option>
                ))}
            </NativeSelect>
          </Field>
        )}
        {lineHaul && vehicleId && (
          <p className="text-caption text-muted-foreground sm:col-span-2">
            {data.vehicles[vehicleId].fastagId ? t('pp14.fastag', { id: data.vehicles[vehicleId].fastagId }) : t('pp14.noFastag')} ·{' '}
            {data.vehicles[vehicleId].gpsId ? t('pp14.gps', { id: data.vehicles[vehicleId].gpsId }) : t('pp14.noGps')} · {t('pp14.docsValid', { date: formatDate(data.vehicles[vehicleId].docExpiry) })}
          </p>
        )}
        <Field label={t('pp14.note')} htmlFor="as-note" hint={t('pp14.noteHint')} className="sm:col-span-2">
          <Input id="as-note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </section>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>
          {t('common.cancel')}
        </Button>
        <Button size="lg" onClick={assign}>
          <UserCheck /> {t('pp14.assign')}
        </Button>
      </div>
    </div>
  )
}
