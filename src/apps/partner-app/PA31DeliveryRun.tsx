/**
 * PA-31 Delivery run — docs/03-partner-app.md §6.6.
 * Load check at the hub (one code for the rider's load, scan every piece),
 * then the day's stops in order of appointment slot, then distance, and
 * "Start run" → Out for Delivery (source §5.1 Delivery, §7 Step 8).
 */
import { ChevronRight, QrCode as QrIcon, Route } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { km, prevLegOf, tasksFor, type Task } from '@shared/engines/fieldTasks'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatINR } from '@shared/lib/format'
import { beep, vibrate } from '@shared/sim/feedback'
import { useDemoStore } from '@shared/store'
import { riderCode } from '@shared/store/deliveryActions'
import { handoverState } from '@shared/store/handoverActions'
import { MapView } from '@shared/ui/MapView'
import { AccessDenied } from '@shared/ui/Page'
import { Scanner } from '@shared/ui/Scanner'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { slotOf } from './deliveryView'
import { Card, Choice } from './FieldUi'
import { useFieldSession } from './useFieldSession'

export default function PA31DeliveryRun() {
  const { t } = useTranslation()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const tasks = useMemo(() => tasksFor(data, staff.id, now).filter((x) => x.leg.type === 'lastMile' && (x.state === 'todo' || x.state === 'inProgress')), [data, staff.id, now])
  const [code, setCode] = useState('')
  const [scanned, setScanned] = useState<string[]>([])
  const [countFinished, setCountFinished] = useState(false)
  if (staff.role !== 'rider') return <div className="p-4"><AccessDenied /></div>

  // Load check: shipments the hub has handed over to me with a code
  const pending = riderCode(data, staff.id)
  const toLoad = tasks.filter((x) => x.kind === 'receive')
  const offered = toLoad.filter((x) => handoverState(data, prevLegOf(data, x.leg)!.id).given?.handoverCode === pending)
  const expected = offered.flatMap((x) => handoverState(data, prevLegOf(data, x.leg)!.id).given?.pieceIds ?? [])
  const codeOk = !!pending && code === pending
  const counted = scanned.length >= expected.length || countFinished

  // Stops: loaded (waiting for the run) and on the run, by slot then distance from the hub
  const hub = (task: Task) => data.hubs[data.pincodes[task.shipment.destPincode].hubId!]
  const distance = (task: Task) => {
    const h = hub(task)
    const pin = data.pincodes[task.shipment.destPincode]
    return h ? km(data.pincodes[h.pincode], pin) : 0
  }
  const stops = tasks
    .filter((x) => x.kind === 'delivery')
    .sort((a, b) => slotOf(data, a.leg).from.localeCompare(slotOf(data, b.leg).from) || distance(a) - distance(b))
  const loaded = stops.filter((x) => x.leg.status === 'assigned')
  const firstHub = stops[0] ? hub(stops[0]) : undefined

  const scanQr = () => {
    // SIMULATED camera: reads the code on the hub's screen
    if (!pending) return
    beep(true)
    vibrate(true)
    setCode(pending)
  }
  const takeLoad = () => {
    useDemoStore.getState().receiveLoad({ legIds: offered.map((x) => x.leg.id), staffId: staff.id, code, pieceIds: scanned })
    toast.success(t('pa31.loaded', { count: offered.length }))
    setCode('')
    setScanned([])
    setCountFinished(false)
  }
  const startRun = () => {
    useDemoStore.getState().startRun(
      loaded.map((x) => x.leg.id),
      staff.id,
    )
    toast.success(t('pa31.started', { count: loaded.length }))
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <h1 className="font-heading text-[22px] font-bold">{t('pa31.title')}</h1>

      {toLoad.length > 0 && (
        <Card title={t('pa31.loadCheck')}>
          {!pending ? (
            <p className="text-muted-foreground">{t('pa31.waitingHub', { count: toLoad.length })}</p>
          ) : (
            <>
              <div className="flex gap-2">
                <input inputMode="numeric" maxLength={6} aria-label={t('pa20.code')} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="tabular h-12 min-w-0 flex-1 rounded-lg border border-input px-3 text-[20px] tracking-[0.3em]" />
                <button type="button" onClick={scanQr} className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border-2 border-primary px-3 font-semibold text-primary">
                  <QrIcon className="size-5" aria-hidden /> {t('pa20.scanQr')}
                </button>
              </div>
              <SimulatedTag className="mt-1" />
              {code.length === 6 && <p className={cn('mt-1 text-[13px] font-semibold', codeOk ? 'text-status-success' : 'text-status-danger')}>{codeOk ? t('pa20.codeOk') : t('pa20.codeWrong')}</p>}
              {codeOk && (
                <div className="mt-3 flex flex-col gap-2">
                  <Scanner expected={expected} scanned={scanned} onScan={(c) => setScanned((x) => [...x, c])} shortLabel={(c) => c.slice(-9)} continuousDefault />
                  {scanned.length < expected.length && <Choice checkbox checked={countFinished} onClick={() => setCountFinished(!countFinished)} label={t('pa20.countFinished', { count: expected.length - scanned.length })} />}
                  <button type="button" disabled={!counted} onClick={takeLoad} className="min-h-14 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground disabled:opacity-40">
                    {scanned.length < expected.length ? t('pa20.acceptException') : t('pa31.takeLoad')}
                  </button>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      <section aria-labelledby="stops-h" className="flex flex-col gap-2">
        <h2 id="stops-h" className="text-[14px] font-semibold tracking-wide text-muted-foreground uppercase">
          {t('pa31.stops', { count: stops.length })}
        </h2>
        {stops.length === 0 && <p className="rounded-2xl border bg-card p-4 text-muted-foreground">{t('pa31.noStops')}</p>}
        {stops.length > 0 && (
          <section className="h-80 overflow-hidden rounded-2xl border">
            <MapView
              ariaLabel={t('pa31.map')}
              markers={[
                ...(firstHub ? [{ ...data.pincodes[firstHub.pincode], id: 'hub', tone: 'info' as const, label: firstHub.name, emphasis: true }] : []),
                ...stops.map((x, i) => ({ ...data.pincodes[x.shipment.destPincode], id: x.leg.id, tone: x.leg.status === 'inProgress' ? ('warning' as const) : ('neutral' as const), label: `${i + 1}. ${x.place}` })),
              ]}
              className="h-full"
            />
          </section>
        )}
        {stops.map((x, i) => {
          const slot = slotOf(data, x.leg)
          const cod = x.shipment.paymentMode === 'cod' ? x.shipment.codAmount : undefined
          return (
            <Link key={x.leg.id} to={`/app/run/${x.leg.id}`} className="flex min-h-20 items-center gap-3 rounded-2xl border bg-card px-4 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-bold">{x.place}</span>
                <span className="tabular block text-[13px] text-muted-foreground">
                  {slot.from}–{slot.to}
                  {slot.appointment ? ` · ${t('pa.tag.appointment')}` : ''} · {t('pa25.pcs', { count: x.shipment.pieces.length })}
                </span>
                <span className="mt-1 flex flex-wrap gap-1">
                  {cod ? <span className="rounded bg-status-warning-bg px-1.5 text-[12px] font-semibold text-status-warning">{t('pa31.cod', { amount: formatINR(cod) })}</span> : null}
                  {x.leg.status === 'inProgress' && <span className="rounded bg-status-info-bg px-1.5 text-[12px] font-semibold text-status-info">{t('pa31.onRun')}</span>}
                  {x.tags
                    .filter((tag) => tag !== 'cod')
                    .map((tag) => (
                      <span key={tag} className="rounded bg-gray-100 px-1.5 text-[12px] font-medium">
                        {t(`pa.tag.${tag}`)}
                      </span>
                    ))}
                </span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          )
        })}
      </section>

      {loaded.length > 0 && (
        <div className="sticky bottom-0 -mx-4 mt-2 border-t bg-background p-3">
          <button type="button" onClick={startRun} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground">
            <Route className="size-5" aria-hidden /> {t('pa31.startRun', { count: loaded.length })}
          </button>
          <p className="mt-1 text-center text-[13px] text-muted-foreground">{t('pa31.startHint')}</p>
        </div>
      )}
    </div>
  )
}
