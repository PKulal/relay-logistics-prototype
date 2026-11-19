/**
 * CP-18 Public branded tracking page and consignee appointment —
 * docs/01-customer-portal.md §6.4. No login (source §2: the consignee needs no
 * app). Logisco + the shipper's brand (§7.2 Branded Tracking); the consignee
 * books the delivery slot and uploads the gate pass (§7 Step 8), shown next to
 * the WhatsApp chat that offers the same buttons (SIMULATED WhatsApp). After a
 * failed delivery the consignee answers the NDR here or in WhatsApp (§10: buttons
 * for consignee and shipper; the first response applies).
 */
import { CalendarCheck, PackageX, PhoneCall, Search } from 'lucide-react'
import { useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ndrsOf, openNdr, reattemptDates } from '@shared/engines/ndr'
import { customerTimeline, etaRevised, trackStep } from '@shared/engines/tracking'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { APPOINTMENT_SLOTS, canBookSlot } from '@shared/store/appointmentActions'
import type { Ndr, Shipment } from '@shared/types'
import { Button } from '@shared/ui/button'
import { ConfirmDialog } from '@shared/ui/ConfirmDialog'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { Input } from '@shared/ui/input'
import { LanguageToggle } from '@shared/ui/LanguageToggle'
import { PhoneFrame } from '@shared/ui/PhoneFrame'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { AppointmentForm } from '../customer/AppointmentForm'
import { StatusTrack } from '../customer/StatusTrack'

export default function CP18Track() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lr = '' } = useParams()
  const data = useData((d) => d)
  const [q, setQ] = useState(lr)
  const formRef = useRef<HTMLDivElement>(null)
  const ndrRef = useRef<HTMLDivElement>(null)
  const [ndrPick, setNdrPick] = useState<NdrPick>()
  const s: Shipment | undefined = data.shipments[lr.trim().toUpperCase()]
  const pickNdr = (k: NdrPick) => (setNdrPick(k), ndrRef.current?.scrollIntoView({ behavior: 'smooth' }))

  const find = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(`/track/${q.trim().toUpperCase()}`)
  }

  return (
    <div data-app="customer" className="flex min-h-dvh flex-col items-center gap-6 bg-gray-100 px-4 py-6 lg:flex-row lg:items-start lg:justify-center">
      <PhoneFrame label={t('cp18.trackingPage')}>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
          {/* Logisco + shipper brand */}
          <header className="flex items-center justify-between gap-2 border-b px-4 pt-8 pb-3">
            <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-7" />
            {s && <span className="truncate text-caption font-semibold text-muted-foreground">{t('cp18.for', { name: data.customers[s.customerId].shortName })}</span>}
            <LanguageToggle compact className="min-h-10" />
          </header>

          <form onSubmit={find} className="flex gap-2 p-4" role="search">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="LGS-DEL-000781" aria-label={t('cp18.trackBy')} className="tabular" />
            <Button type="submit" size="icon" aria-label={t('cp18.find')}>
              <Search />
            </Button>
          </form>

          {!lr ? (
            <p className="px-4 text-muted-foreground">{t('cp18.enterLr')}</p>
          ) : !s ? (
            <p className="px-4 font-medium text-status-danger" role="alert">
              {t('cp18.notFound', { lr })}
            </p>
          ) : (
            <TrackingView s={s} formRef={formRef} ndrRef={ndrRef} ndrPick={ndrPick} setNdrPick={setNdrPick} />
          )}
        </div>
      </PhoneFrame>

      {s && <WhatsAppChat s={s} onBook={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })} onNdr={pickNdr} />}
      <Link to="/" className="text-caption font-medium text-primary hover:underline lg:absolute lg:top-4 lg:left-4">
        {t('header.launcher')}
      </Link>
    </div>
  )
}

type NdrPick = 'reattempt' | 'changeSlot' | 'rto'

function TrackingView({ s, formRef, ndrRef, ndrPick, setNdrPick }: { s: Shipment; formRef: React.RefObject<HTMLDivElement | null>; ndrRef: React.RefObject<HTMLDivElement | null>; ndrPick?: NdrPick; setNdrPick: (k: NdrPick) => void }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const last = customerTimeline(data, s)[0]
  const c = data.consignees[s.consigneeId]
  const lastMile = s.legIds.map((id) => data.legs[id]).find((l) => l.type === 'lastMile')
  const deliveryDay = s.status === 'outForDelivery'
  const delivered = s.status === 'delivered' || s.status === 'deliveredWithException'

  return (
    <div className="flex flex-col gap-4 px-4 pb-8">
      <div>
        <p className="tabular font-heading text-[20px] font-bold">{s.id}</p>
        <p className="text-muted-foreground">
          {c.company || c.contact}, {data.pincodes[s.destPincode].city}
        </p>
      </div>
      <StatusTrack step={trackStep(s.status)} status={s.status} />
      <div className="rounded-xl border bg-card p-3">
        <p className="font-semibold">{t(`status.shipment.${s.status}`)}</p>
        {!delivered && (
          <p className="tabular" data-testid="cp18-eta">
            {t('cp17.eta', { date: formatDate(s.eta) })}
            {etaRevised(data, s) ? ` · ${t('cp17.revised')}` : ''}
          </p>
        )}
        {last && (
          <p className="tabular text-caption text-muted-foreground">
            {t('cp18.lastUpdate', { what: t(`cp17.ev.${last.kind}`), at: formatDateTime(last.at) })}
            {last.place ? ` · ${last.place}` : ''}
          </p>
        )}
      </div>

      {deliveryDay && lastMile?.staffId && (
        // SIMULATED masked call to the delivery agent (source §7 Step 8, §13)
        <Button variant="outline" onClick={() => toast.success(t('cp18.calling'))}>
          <PhoneCall /> {t('cp18.callAgent')}
        </Button>
      )}

      {ndrsOf(data, s.id).length > 0 && <NdrResponse s={s} ndrRef={ndrRef} pick={ndrPick} setPick={setNdrPick} />}

      {s.addOns.appointment && (
        <section ref={formRef} className="flex flex-col gap-3 rounded-xl border bg-card p-3" aria-labelledby="appt-h">
          <h2 id="appt-h" className="flex items-center gap-2 font-semibold">
            <CalendarCheck className="size-4 text-primary" aria-hidden /> {t('cp18.appointment')}
          </h2>
          {s.appointment?.confirmed && (
            <p className="tabular font-medium text-status-success" data-testid="cp18-slot">
              {t('cp17.slot', { date: formatDate(s.appointment.date), from: s.appointment.from, to: s.appointment.to })}
              {s.appointment.dock ? ` · ${s.appointment.dock}` : ''}
            </p>
          )}
          {canBookSlot(s) ? (
            <AppointmentForm
              compact
              s={s}
              consignee={c}
              submitLabel={s.appointment?.confirmed ? t('cp18.change') : t('cp18.confirm')}
              onSubmit={(a) => {
                useDemoStore.getState().bookAppointment(s.id, a, 'consignee')
                toast.success(t('cp18.booked', { date: formatDate(a.date), from: a.from, to: a.to }))
              }}
            />
          ) : (
            !s.appointment?.confirmed && <p className="text-caption text-muted-foreground">{t('cp18.tooLate')}</p>
          )}
        </section>
      )}
      <p className="text-caption text-muted-foreground">{t('cp18.privacy')}</p>
    </div>
  )
}

/** The WhatsApp message the consignee receives, with the same buttons (SIMULATED). */
function WhatsAppChat({ s, onBook, onNdr }: { s: Shipment; onBook: () => void; onNdr: (k: NdrPick) => void }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const shipper = data.customers[s.customerId].shortName
  const bubble = 'max-w-[85%] rounded-lg rounded-tl-none bg-white p-3 text-body shadow-card'
  return (
    <section className="flex w-full max-w-sm flex-col gap-2" aria-label={t('cp18.whatsapp')}>
      <p className="flex items-center gap-2 text-caption font-medium text-muted-foreground">
        {t('cp18.whatsapp')} <SimulatedTag />
      </p>
      <div className="flex flex-col gap-2 rounded-2xl bg-status-success-bg p-4">
        <div className={bubble}>
          <p>{t('cp18.waShipped', { shipper, lr: s.id, date: formatDate(s.eta) })}</p>
          <div className="mt-2 grid gap-1 border-t pt-2">
            <span className="text-center font-semibold text-status-info">{t('cp18.waTrack')}</span>
            {s.addOns.appointment && canBookSlot(s) && (
              <button type="button" onClick={onBook} className="text-center font-semibold text-status-info">
                {t('cp18.waBook')}
              </button>
            )}
          </div>
        </div>
        {s.appointment?.confirmed && (
          <div className={bubble}>
            {t('cp18.waConfirmed', { date: formatDate(s.appointment.date), from: s.appointment.from, to: s.appointment.to })}
            {s.appointment.dock ? ` · ${s.appointment.dock}` : ''}
          </div>
        )}
        {s.status === 'outForDelivery' && <div className={bubble}>{t('cp18.waOut')}</div>}
        {ndrsOf(data, s.id).map((n) => (
          <div key={n.id} className={bubble} data-testid="wa-ndr">
            <p>{t('cp18.waNdr', { lr: s.id, reason: t(`ndr.reason.${n.reason}`) })}</p>
            {openNdr(data, s.id)?.id === n.id ? (
              <div className="mt-2 grid gap-1 border-t pt-2">
                {(['reattempt', 'changeSlot', 'rto'] as const).map((k) => (
                  <button key={k} type="button" onClick={() => onNdr(k)} className="text-center font-semibold text-status-info">
                    {t(`cp18.ndr.${k}`)}
                  </button>
                ))}
              </div>
            ) : (
              n.customerChoice && <p className="mt-2 border-t pt-2 font-medium">{ndrOutcome(t, data.customers[s.customerId].shortName, n)}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

/** "You chose …" / "Sharma Electricals chose …" for the consignee (first response applies). */
function ndrOutcome(t: TFunction, shipper: string, n: Ndr): string {
  const what = n.customerChoice === 'rto' ? t('cp18.ndr.rto') : t('cp18.ndrSlot', { date: formatDate(n.newSlot!.date), from: n.newSlot!.from, to: n.newSlot!.to })
  return n.choiceBy === 'consignee' ? t('cp18.ndrYou', { what }) : n.choiceBy === 'system' ? t('cp18.ndrAuto', { what }) : t('cp18.ndrShipper', { shipper, what })
}

/** Failed delivery response on the tracking page (CP-18; same options as CP-21). */
function NdrResponse({ s, ndrRef, pick, setPick }: { s: Shipment; ndrRef: React.RefObject<HTMLDivElement | null>; pick?: NdrPick; setPick: (k: NdrPick) => void }) {
  const { t } = useTranslation()
  const data = useData((d) => d)
  const now = useDemoNow()
  const dates = reattemptDates(now)
  const [date, setDate] = useState(dates[0])
  const [slot, setSlot] = useState(APPOINTMENT_SLOTS[1].from)
  const [confirm, setConfirm] = useState(false)
  const open = openNdr(data, s.id)
  const last = ndrsOf(data, s.id).at(-1)!
  const send = (k: NdrPick) => {
    const sl = APPOINTMENT_SLOTS.find((x) => x.from === slot)!
    useDemoStore.getState().respondNdr(s.id, k === 'rto' ? { kind: 'rto' } : { kind: k, date, from: sl.from, to: sl.to }, 'consignee')
    toast.success(k === 'rto' ? t('cp18.ndrSentRto') : t('cp18.ndrSent', { date: formatDate(date), from: sl.from, to: sl.to }))
  }
  return (
    <section ref={ndrRef} className="flex flex-col gap-3 rounded-xl border border-status-warning bg-status-warning-bg p-3" aria-labelledby="ndr-h" data-testid="cp18-ndr">
      <h2 id="ndr-h" className="flex items-center gap-2 font-semibold">
        <PackageX className="size-4" aria-hidden /> {t('cp18.ndrTitle', { n: last.attempt })}
      </h2>
      <p className="text-caption">{t(`ndr.reason.${last.reason}`)}</p>
      {!open ? (
        <p className="font-medium" data-testid="cp18-ndr-outcome">
          {ndrOutcome(t, data.customers[s.customerId].shortName, last)}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label={t('cp18.ndrChoose')}>
            {(['reattempt', 'changeSlot', 'rto'] as const).map((k) => (
              <Button key={k} type="button" size="sm" role="radio" aria-checked={pick === k} variant={pick === k ? 'default' : 'outline'} onClick={() => setPick(k)} className="h-auto min-h-10 whitespace-normal">
                {t(`cp18.ndr.${k}`)}
              </Button>
            ))}
          </div>
          {pick && pick !== 'rto' && (
            <div className="grid grid-cols-2 gap-2">
              <NativeSelect aria-label={t('cp21.date')} value={date} onChange={(e) => setDate(e.target.value)}>
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {formatDate(d)}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect aria-label={t('cp21.slot')} value={slot} onChange={(e) => setSlot(e.target.value)}>
                {APPOINTMENT_SLOTS.map((x) => (
                  <option key={x.from} value={x.from}>
                    {x.from}–{x.to}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          {pick && (
            <Button type="button" onClick={() => (pick === 'rto' ? setConfirm(true) : send(pick))}>
              {t('cp18.ndrConfirm')}
            </Button>
          )}
          <ConfirmDialog open={confirm} onOpenChange={setConfirm} title={t('cp18.ndrRtoTitle')} body={t('cp18.ndrRtoBody')} confirmLabel={t('cp18.ndrConfirm')} destructive onConfirm={() => send('rto')} />
        </>
      )}
    </section>
  )
}
