/**
 * PA-32 Delivery stop detail — docs/03-partner-app.md §6.6.
 * Consignee, masked call, appointment check, pieces and COD; "I've arrived"
 * opens PA-33 (source §5.1 Delivery: masked call, appointment check).
 */
import { AlertTriangle, ArrowLeft, Banknote, Navigation, PhoneCall } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatINR } from '@shared/lib/format'
import { istDate } from '@shared/lib/time'
import { MapView } from '@shared/ui/MapView'
import { NotFound } from '@shared/ui/Page'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { Card } from './FieldUi'
import { slotOf } from './deliveryView'
import { useFieldSession } from './useFieldSession'

export default function PA32Stop() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { legId = '' } = useParams()
  const { staff } = useFieldSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const leg = data.legs[legId]
  if (!leg || leg.staffId !== staff.id || leg.type !== 'lastMile') return <div className="p-4"><NotFound /></div>

  const s = data.shipments[leg.shipmentId]
  const c = data.consignees[s.consigneeId]
  const pin = data.pincodes[s.destPincode]
  const slot = slotOf(data, leg)
  const hhmm = now.slice(11, 16)
  const a = s.appointment
  // Appointment check (source §5.1): outside the booked slot is a warning, not a block
  const outsideSlot = slot.appointment && (istDate(now) !== a?.date || hhmm < slot.from || hhmm > slot.to)
  const cod = s.paymentMode === 'cod' ? s.codAmount : undefined
  const onRun = leg.status === 'inProgress'
  const done = leg.status === 'delivered'

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <button type="button" onClick={() => navigate('/app/run')} className="inline-flex min-h-12 w-fit items-center gap-1.5 font-medium text-muted-foreground">
        <ArrowLeft className="size-5" aria-hidden /> {t('pa15.back')}
      </button>
      <div>
        <p className="tabular text-[13px] text-muted-foreground">{s.id}</p>
        <h1 className="font-heading text-[22px] leading-tight font-bold">{c.company || c.contact}</h1>
        <p className="text-muted-foreground">
          {c.address}
          {c.landmark ? ` · ${c.landmark}` : ''} · {pin.code}
        </p>
      </div>

      <section className="h-80 overflow-hidden rounded-2xl border">
        <MapView ariaLabel={t('pa32.map')} markers={[{ ...pin, id: 'stop', tone: 'info', label: c.company || c.contact, emphasis: true }]} className="h-full" />
      </section>

      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card">
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center gap-2 font-semibold text-primary">
          <Navigation className="size-4" aria-hidden /> {t('pa.navigate')}
        </a>
        {/* SIMULATED masked call: neither side sees the other's number (source §13) */}
        <button type="button" onClick={() => toast.success(t('pa.calling', { name: c.contact }))} className="flex min-h-12 items-center justify-center gap-2 border-l font-semibold text-primary">
          <PhoneCall className="size-4" aria-hidden /> {t('pa.call')}
        </button>
      </div>

      <Card title={t('pa32.contact')}>
        <p className="text-[18px] font-semibold">{c.contact}</p>
        <p className="text-[13px] text-muted-foreground">{t('pa32.masked')}</p>
      </Card>

      <Card title={s.addOns.appointment ? t('pa32.appointment') : t('pa32.window')}>
        {s.addOns.appointment && !a?.confirmed ? (
          <p className="font-semibold text-status-warning">{t('pa32.notBooked', { date: a?.date ? formatDate(a.date) : '' })}</p>
        ) : (
          <p className="tabular text-[18px] font-semibold">
            {slot.from}–{slot.to}
            {a?.dock ? ` · ${t('pa32.dock', { dock: a.dock })}` : ''}
          </p>
        )}
        {outsideSlot && (
          <p className="mt-1 flex items-start gap-2 text-[13px] font-semibold text-status-warning" role="status">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {t('pa32.outsideSlot')}
          </p>
        )}
      </Card>

      <Card title={t('pa32.pieces')}>
        <p className="tabular">{t('pa25.pcs', { count: s.pieces.length })} · {s.goodsDescription}</p>
      </Card>

      {cod ? (
        <section className="flex items-center gap-3 rounded-2xl border-2 border-status-warning bg-status-warning-bg p-4">
          <Banknote className="size-8 shrink-0 text-status-warning" aria-hidden />
          <div>
            <p className="text-[13px] font-semibold">{t('pa32.cod')}</p>
            <p className="tabular font-heading text-[26px] font-bold">{formatINR(cod)}</p>
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-0 -mx-4 mt-2 grid grid-cols-[auto_1fr] gap-2 border-t bg-background p-3">
        <Link to={`/app/run/${leg.id}/ndr`} className="flex min-h-14 items-center justify-center rounded-2xl border-2 px-3 font-semibold">
          {t('pa32.cannot')}
        </Link>
        {onRun ? (
          <Link to={`/app/run/${leg.id}/deliver`} className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary text-[18px] font-bold text-primary-foreground">
            {t('pa23.arrived')} <SimulatedTag />
          </Link>
        ) : (
          <p className="flex items-center justify-center text-center text-[13px] text-muted-foreground">{done ? t('pa33.done') : t('pa32.startFirst')}</p>
        )}
      </div>
    </div>
  )
}
