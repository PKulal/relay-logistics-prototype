/**
 * CP-14 Booking confirmation — docs/01-customer-portal.md §6.4.
 * LR, QR labels (one per piece), e-way bill, pickup, ETA, amount. Labels and the
 * LR are generated in the browser as print views (Print → Save as PDF).
 */
import { CalendarClock, CheckCircle2, Copy, FileText, MapPin, PackagePlus, Printer, Repeat2, Truck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { useData } from '@shared/hooks/useDemo'
import { formatDate, formatDateLong, formatDateTime, formatDayShort, formatINR, formatKg } from '@shared/lib/format'
import type { DemoData, Shipment } from '@shared/types'
import { Button } from '@shared/ui/button'
import { NotFound } from '@shared/ui/Page'
import { PriceBreakdown } from '@shared/ui/PriceBreakdown'
import { PrintArea } from '@shared/ui/PrintArea'
import { QrCode } from '@shared/ui/QrCode'
import { useCustomerSession } from './useCustomerSession'

type PrintMode = 'a4' | 'thermal' | 'lr'

export default function CP14Confirmation() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { lr = '' } = useParams()
  const { customer } = useCustomerSession()
  const data = useData((d) => d)
  const s = data.shipments[lr]
  const [printMode, setPrintMode] = useState<PrintMode | null>(null)

  // Render the chosen print view, print it, then put the screen back
  useEffect(() => {
    if (!printMode) return
    const done = () => setPrintMode(null)
    window.addEventListener('afterprint', done, { once: true })
    const id = setTimeout(() => window.print(), 50)
    return () => {
      clearTimeout(id)
      window.removeEventListener('afterprint', done)
    }
  }, [printMode])

  if (!s || s.customerId !== customer.id) return <NotFound />

  const loc = data.pickupLocations[s.pickupLocationId]
  const consignee = data.consignees[s.consigneeId]
  const dest = data.pincodes[s.destPincode]

  const copyLr = async () => {
    try {
      await navigator.clipboard.writeText(s.id)
      toast.success(t('cp14.copied', { lr: s.id }))
    } catch {
      toast.error(t('cp14.copyFailed'))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Success header */}
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-status-success/30 bg-status-success-bg p-6">
        <CheckCircle2 className="size-10 text-status-success" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="text-page-title">{t('cp14.title')}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{t('cp14.lr')}</span>
            <span className="tabular font-heading text-section font-bold" data-testid="lr">
              {s.id}
            </span>
            <Button variant="ghost" size="icon-sm" onClick={copyLr} aria-label={t('cp14.copy')}>
              <Copy />
            </Button>
          </p>
        </div>
        <Button onClick={() => navigate(`/customer/shipments/${s.id}`)}>
          <Truck /> {t('cp14.track')}
        </Button>
      </section>

      {/* Key facts */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Fact icon={FileText} label={t('cp14.ewb')}>
          {s.ewb ? (
            <>
              <span className="tabular">EWB {s.ewb.no}</span>
              <span className="block text-caption text-muted-foreground">{t('cp14.ewbValid', { date: formatDate(s.ewb.validTill) })}</span>
            </>
          ) : (
            t('cp14.ewbNone')
          )}
        </Fact>
        <Fact icon={MapPin} label={t('cp14.pickup')}>
          {formatDayShort(s.pickupSlot.date)}, {s.pickupSlot.from}–{s.pickupSlot.to}
          <span className="block text-caption text-muted-foreground">{loc.name}</span>
        </Fact>
        <Fact icon={CalendarClock} label={t('cp14.eta')}>
          {formatDayShort(s.eta)}
          {s.appointment && !s.appointment.confirmed && <span className="block text-caption text-muted-foreground">{t('cp14.appointmentPending')}</span>}
        </Fact>
        <Fact icon={FileText} label={t('cp14.amount')}>
          <span className="tabular">{formatINR(s.price.total)}</span> <span className="text-muted-foreground">({t(`payment.${s.paymentMode}`)})</span>
        </Fact>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setPrintMode('a4')}>
          <Printer /> {t('cp14.printA4')}
        </Button>
        <Button variant="outline" onClick={() => setPrintMode('thermal')}>
          <Printer /> {t('cp14.printThermal')}
        </Button>
        <Button variant="outline" onClick={() => setPrintMode('lr')}>
          <FileText /> {t('cp14.downloadLr')}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/customer/book')}>
          <PackagePlus /> {t('cp14.bookAnother')}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/customer/book', { state: { repeat: s.id } })}>
          <Repeat2 /> {t('cp14.repeat')}
        </Button>
      </div>

      {/* Label preview */}
      <section aria-labelledby="labels-h">
        <h2 id="labels-h" className="mb-3 text-section">
          {t('cp14.labels', { count: s.pieces.length })}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {s.pieces.map((p, i) => (
            <Label key={p.id} data={data} s={s} index={i} />
          ))}
        </div>
        <p className="mt-2 text-caption text-muted-foreground">
          {consignee.company} · {dest?.city} {s.destPincode}
        </p>
      </section>

      {/* Print views: only the active one renders, and only it reaches the paper */}
      {printMode && (
        <PrintArea>
          <style>{printMode === 'thermal' ? '@page { size: 4in 6in; margin: 0.15in }' : '@page { size: A4; margin: 10mm }'}</style>
          {printMode === 'lr' ? (
            <LrDocument data={data} s={s} />
          ) : (
            <div className={cn(printMode === 'a4' ? 'grid grid-cols-2 gap-4' : 'flex flex-col')}>
              {s.pieces.map((p, i) => (
                <div key={p.id} className={cn('break-inside-avoid', printMode === 'thermal' ? 'break-after-page' : (i + 1) % 4 === 0 && 'break-after-page')}>
                  <Label data={data} s={s} index={i} large={printMode === 'thermal'} />
                </div>
              ))}
            </div>
          )}
        </PrintArea>
      )}
    </div>
  )
}

function Fact({ icon: Icon, label, children }: { icon: typeof FileText; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <p className="mb-1 flex items-center gap-1.5 text-caption font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className="size-3.5" aria-hidden /> {label}
      </p>
      <div className="font-medium">{children}</div>
    </div>
  )
}

/** One piece label: LR, piece n/N, consignee, pincode, QR (CP-14). */
function Label({ data, s, index, large }: { data: DemoData; s: Shipment; index: number; large?: boolean }) {
  const { t } = useTranslation()
  const piece = s.pieces[index]
  const consignee = data.consignees[s.consigneeId]
  const dest = data.pincodes[s.destPincode]
  const origin = data.pincodes[s.originPincode]
  return (
    <article className={cn('flex flex-col gap-2 rounded-lg border-2 border-ink bg-white p-3 text-ink', large && 'h-[5.6in] p-4 text-[14pt]')} aria-label={t('cp14.labelFor', { n: index + 1, total: s.pieces.length })}>
      <div className="flex items-center justify-between border-b border-ink pb-2">
        <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-7" />
        <span className="font-heading text-section font-bold">{t(`service.${s.service}`)}</span>
      </div>
      <div className="flex gap-3">
        <QrCode value={`${s.id}|${piece.id}|${s.destPincode}`} label={t('cp14.qrFor', { piece: piece.id })} className={large ? 'w-40' : 'w-24'} />
        <div className="min-w-0 flex-1">
          <p className="tabular font-heading text-card-title font-bold">{s.id}</p>
          <p className="tabular font-heading text-page-title font-bold">
            {index + 1}/{s.pieces.length}
          </p>
          <p className="tabular text-caption">{piece.id}</p>
        </div>
      </div>
      <div className="border-t border-ink pt-2 text-table">
        <p className="text-caption font-semibold uppercase">{t('cp14.to')}</p>
        <p className="font-semibold">{consignee.company}</p>
        <p>{consignee.address}</p>
        <p className="tabular font-heading text-section font-bold">
          {dest?.city} {s.destPincode}
        </p>
      </div>
      <div className="flex justify-between border-t border-ink pt-2 text-caption">
        <span>
          {t('cp14.from')}: {origin?.city} {s.originPincode}
        </span>
        <span className="tabular">{formatKg(piece.weight)}</span>
      </div>
    </article>
  )
}

/** Printable LR (consignment note). */
function LrDocument({ data, s }: { data: DemoData; s: Shipment }) {
  const { t } = useTranslation()
  const customer = data.customers[s.customerId]
  const loc = data.pickupLocations[s.pickupLocationId]
  const consignee = data.consignees[s.consigneeId]
  const dest = data.pincodes[s.destPincode]
  const row = (label: string, value: React.ReactNode) => (
    <tr className="border-b border-gray-100">
      <th className="py-1 pr-4 text-left align-top font-semibold">{label}</th>
      <td className="py-1">{value}</td>
    </tr>
  )
  return (
    <div className="text-ink">
      <div className="mb-4 flex items-start justify-between">
        <img src="/brand/logisco-logo.png" alt={t('common.brand')} className="h-12" />
        <div className="text-right">
          <p className="font-heading text-page-title font-bold">{t('cp14.lrTitle')}</p>
          <p className="tabular font-heading text-section">{s.id}</p>
          <p className="text-caption">{formatDateTime(s.bookedAt)}</p>
        </div>
      </div>
      <table className="w-full text-table">
        <tbody>
          {row(t('cp14.consignor'), `${customer.legalName}, ${loc.address} ${loc.pincode} · GSTIN ${customer.gstin}`)}
          {row(t('cp14.consignee'), `${consignee.company}, ${consignee.contact}, ${consignee.address}, ${dest?.city} ${s.destPincode}${consignee.gstin ? ` · GSTIN ${consignee.gstin}` : ''}`)}
          {row(t('cp14.serviceRow'), `${t(`service.${s.service}`)} · ${t(`payment.${s.paymentMode}`)}`)}
          {row(t('cp14.packagesRow'), `${t('cp13.pieces', { count: s.pieces.length })} · ${formatKg(s.weights.actual)} ${t('weight.actual').toLowerCase()} · ${formatKg(s.weights.chargeable)} ${t('weight.chargeable').toLowerCase()}`)}
          {row(t('cp14.invoiceRow'), `${s.invoice.no} · ${formatDate(s.invoice.date)} · ${formatINR(s.invoice.value)}${s.invoice.po ? ` · PO ${s.invoice.po}` : ''}`)}
          {row(t('cp14.goodsRow'), `${s.goodsDescription} · HSN ${s.hsn}`)}
          {row(t('cp14.ewb'), s.ewb ? `${s.ewb.no} · ${t('cp14.ewbValid', { date: formatDate(s.ewb.validTill) })}` : t('cp14.ewbNone'))}
          {row(t('cp14.pickup'), `${formatDateLong(s.pickupSlot.date)}, ${s.pickupSlot.from}–${s.pickupSlot.to}`)}
          {row(t('cp14.eta'), formatDateLong(s.eta))}
        </tbody>
      </table>
      <PriceBreakdown price={s.price} gstPct={data.settings.gstPct} className="mt-4 max-w-md" />
    </div>
  )
}
