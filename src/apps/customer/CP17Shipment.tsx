/**
 * CP-17 Shipment detail and tracking — docs/01-customer-portal.md §6.4.
 * Status track, scan timeline with the live truck, details, charges, documents
 * and proof of delivery (source §7 Steps 3–11, §7.1, §7.2). Partner names are
 * never shown: one tracking number, one status list (source §2).
 */
import { ArrowLeft, CalendarClock, Check, Copy, Download, MessageCircle, Printer, ShieldAlert, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { claimableShipments } from '@shared/engines/claims'
import { toast } from 'sonner'
import { cn } from '@/shared/lib/utils'
import { routeStops, shipmentPosition } from '@shared/engines/position'
import { customerTimeline, etaRevised, proofOfDelivery, shipmentDocs, trackStep } from '@shared/engines/tracking'
import { tripRoute } from '@shared/engines/trip'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatINR, formatKg, maskMobile } from '@shared/lib/format'
import { useDemoStore } from '@shared/store'
import { canBookSlot } from '@shared/store/appointmentActions'
import type { DemoData, Shipment } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@shared/ui/dialog'
import { MapView, type MapMarker } from '@shared/ui/MapView'
import { NotFound } from '@shared/ui/Page'
import { PriceBreakdown } from '@shared/ui/PriceBreakdown'
import { ShipmentStatusChip, Chip } from '@shared/ui/StatusChip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'
import { AppointmentForm } from './AppointmentForm'
import { StatusTrack } from './StatusTrack'
import { downloadDocuments, usePrintShipments } from './shipmentFiles'
import { useCustomerSession } from './useCustomerSession'

export default function CP17Shipment() {
  const { t } = useTranslation()
  const { lr = '' } = useParams()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const navigate = useNavigate()
  const [slotOpen, setSlotOpen] = useState(false)
  const printer = usePrintShipments(data)
  const s = data.shipments[lr]
  if (!s || s.customerId !== customer.id) return <NotFound />

  const step = trackStep(s.status)
  const delivered = s.status === 'delivered' || s.status === 'deliveredWithException'
  const claimable = claimableShipments(data, s.customerId, now).some((x) => x.id === s.id)
  const openExceptions = Object.values(data.exceptions).filter((x) => x.shipmentId === s.id && x.status !== 'resolved')
  const pendingRevision = Object.values(data.weightRevisions).find((w) => w.shipmentId === s.id && w.status === 'pending')
  const pod = proofOfDelivery(data, s)
  const link = `${window.location.origin}/track/${s.id}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      /* clipboard blocked: the toast still shows the link */
    }
    toast.success(t('cp17.linkCopied', { link }))
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to="/customer/shipments" className="inline-flex w-fit items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t('cp17.back')}
      </Link>

      {/* Header */}
      <section className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="tabular font-heading text-page-title font-bold">{s.id}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <ShipmentStatusChip status={s.status} />
              {!delivered && (
                <span className="tabular text-body" data-testid="cp17-eta">
                  {t('cp17.eta', { date: formatDate(s.eta) })}
                  {etaRevised(data, s) && (
                    <Chip tone="warning" className="ml-2">
                      {t('cp17.revised')}
                    </Chip>
                  )}
                </span>
              )}
              {s.appointment?.confirmed && (
                <Chip tone="info">
                  {t('cp17.slot', { date: formatDate(s.appointment.date), from: s.appointment.from, to: s.appointment.to })}
                  {s.appointment.dock ? ` · ${s.appointment.dock}` : ''}
                </Chip>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canBookSlot(s) && (
              <Button variant="outline" size="sm" onClick={() => setSlotOpen(true)}>
                <CalendarClock /> {s.appointment?.confirmed ? t('cp17.changeSlot') : t('cp17.bookSlot')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy /> {t('cp17.share')}
            </Button>
            <Button variant="outline" size="sm" asChild>
              {/* SIMULATED WhatsApp share */}
              <a href={`https://wa.me/?text=${encodeURIComponent(t('cp17.waText', { lr: s.id, link }))}`} target="_blank" rel="noreferrer">
                <MessageCircle /> {t('cp17.whatsapp')}
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadDocuments(data, [s], t)}>
              <Download /> {t('cp17.downloadAll')}
            </Button>
            {delivered && (
              <Button variant="outline" size="sm" disabled={!claimable} title={claimable ? undefined : t('cp17.claimClosed')} onClick={() => navigate(`/customer/claims/new?lr=${s.id}`)}>
                <ShieldAlert /> {t('cp16.raiseClaim')}
              </Button>
            )}
          </div>
        </div>

        <StatusTrack step={step} status={s.status} />

        {(openExceptions.length > 0 || pendingRevision) && (
          <div role="alert" className="flex flex-col gap-1 rounded-lg bg-status-warning-bg p-3 text-body">
            {pendingRevision && (
              <p className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4 shrink-0 text-status-warning" aria-hidden /> {t('cp17.revisionPending', { amount: formatINR(pendingRevision.amountDiff) })}
                <Link to={`/customer/exceptions/weight/${s.id}`} className="ml-auto text-primary hover:underline">
                  {t('cp17.reviewRevision')}
                </Link>
              </p>
            )}
            {openExceptions.map((x) => (
              <p key={x.id} className="flex items-center gap-2 font-medium">
                <TriangleAlert className="size-4 shrink-0 text-status-warning" aria-hidden /> {t(`cp17.exception.${x.type}`)}
                {x.type === 'ndr' && (
                  <Link to={`/customer/exceptions/ndr/${s.id}`} className="ml-auto text-primary hover:underline">
                    {t('cp17.chooseNdr')}
                  </Link>
                )}
              </p>
            ))}
          </div>
        )}
      </section>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">{t('cp17.tab.timeline')}</TabsTrigger>
          <TabsTrigger value="details">{t('cp17.tab.details')}</TabsTrigger>
          <TabsTrigger value="charges">{t('cp17.tab.charges')}</TabsTrigger>
          <TabsTrigger value="documents">{t('cp17.tab.documents')}</TabsTrigger>
          {pod && <TabsTrigger value="pod">{t('cp17.tab.pod')}</TabsTrigger>}
        </TabsList>

        <TabsContent value="timeline" className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
          <Timeline data={data} s={s} />
          <TrackMap data={data} s={s} now={now} />
        </TabsContent>

        <TabsContent value="details">
          <Details data={data} s={s} />
        </TabsContent>

        <TabsContent value="charges">
          <section className="rounded-xl border bg-card p-5 shadow-card">
            <h2 className="mb-3 text-card-title">{t('cp17.booked')}</h2>
            <PriceBreakdown price={s.price} gstPct={data.settings.gstPct} />
            <h2 className="mt-6 mb-2 text-card-title">{t('cp17.revisions')}</h2>
            {Object.values(data.weightRevisions).filter((w) => w.shipmentId === s.id).length === 0 ? (
              <p className="text-muted-foreground">{t('cp17.noRevisions')}</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {Object.values(data.weightRevisions)
                  .filter((w) => w.shipmentId === s.id)
                  .map((w) => (
                    <li key={w.id} className="tabular flex flex-wrap items-center gap-2">
                      {t('cp17.weightRevision', { booked: formatKg(w.booked), verified: formatKg(w.verified), amount: formatINR(w.amountDiff) })}
                      <Chip tone={w.status === 'pending' ? 'warning' : 'neutral'}>{t(`cp17.revisionStatus.${w.status}`)}</Chip>
                    </li>
                  ))}
              </ul>
            )}
            <p className="tabular mt-6 text-card-title">
              {t('cp17.final')}: {formatINR(s.price.total + Object.values(data.weightRevisions).filter((w) => w.shipmentId === s.id && (w.status === 'accepted' || w.status === 'autoAccepted' || w.status === 'upheld')).reduce((n, w) => n + w.amountDiff, 0))}
            </p>
          </section>
        </TabsContent>

        <TabsContent value="documents">
          <section className="rounded-xl border bg-card shadow-card">
            <ul className="divide-y">
              {shipmentDocs(data, s).map((d) => (
                <li key={d.key} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <span>
                    <span className="font-medium">{t(`cp17.doc.${d.key}`)}</span>
                    <span className="tabular block text-caption text-muted-foreground">{[d.detail, d.count ? t('cp17.items', { count: d.count }) : ''].filter(Boolean).join(' · ')}</span>
                  </span>
                  {d.key === 'lr' || d.key === 'labels' ? (
                    <Button variant="outline" size="sm" onClick={() => printer.print(d.key === 'lr' ? 'lr' : 'labels', [s])}>
                      <Printer /> {t('cp17.print')}
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => downloadDocuments(data, [s], t)}>
                      <Download /> {t('cp17.download')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        {pod && (
          <TabsContent value="pod">
            <section className="grid gap-4 rounded-xl border bg-card p-5 shadow-card sm:grid-cols-2">
              <Fact label={t('cp17.receivedBy')} value={pod.delivered.receivedBy ?? '—'} />
              <Fact label={t('cp17.verification')} value={pod.delivered.note === 'e-signature' ? t('cp17.eSigned') : t('cp17.otpVerified')} />
              <Fact label={t('cp17.grn')} value={pod.delivered.grn ?? '—'} />
              <Fact label={t('cp17.deliveredAt')} value={`${formatDateTime(pod.delivered.at)}${pod.delivered.lat ? ` · ${pod.delivered.lat.toFixed(2)}°N ${pod.delivered.lng!.toFixed(2)}°E` : ''}`} />
              <div className="sm:col-span-2">
                <p className="text-caption text-muted-foreground">{t('cp17.issues')}</p>
                {pod.issues.length === 0 ? (
                  <p className="flex items-center gap-1 font-medium text-status-success">
                    <Check className="size-4" aria-hidden /> {t('cp17.noIssues')}
                  </p>
                ) : (
                  <ul className="tabular">
                    {pod.issues.map((i) => (
                      <li key={i.pieceId}>
                        {i.pieceId} · {t(`cp17.exception.${i.kind}`)}
                        {i.remark ? ` · ${i.remark}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {pod.cod && <Fact label={t('cp17.cod')} value={formatINR(pod.cod.amount)} />}
            </section>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={slotOpen} onOpenChange={setSlotOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('cp17.slotTitle', { lr: s.id })}</DialogTitle>
          </DialogHeader>
          <AppointmentForm
            s={s}
            consignee={data.consignees[s.consigneeId]}
            submitLabel={t('cp18.confirm')}
            onSubmit={(a) => {
              useDemoStore.getState().bookAppointment(s.id, a, user.id)
              setSlotOpen(false)
              toast.success(t('cp18.booked', { date: formatDate(a.date), from: a.from, to: a.to }))
            }}
          />
        </DialogContent>
      </Dialog>
      {printer.view}
    </div>
  )
}

function Timeline({ data, s }: { data: DemoData; s: Shipment }) {
  const { t } = useTranslation()
  const rows = customerTimeline(data, s)
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card" aria-labelledby="tl-h">
      <h2 id="tl-h" className="mb-3 text-card-title">
        {t('cp17.timeline')}
      </h2>
      <ol className="flex flex-col" data-testid="cp17-timeline">
        {rows.map((r, i) => (
          <li key={r.id} className="relative flex gap-3 pb-4 last:pb-0">
            <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', i === 0 ? 'bg-primary' : 'bg-gray-500')} aria-hidden />
            <div className="min-w-0">
              <p className="font-medium">
                {t(`cp17.ev.${r.kind}`)}
                {r.exceptionKind ? ` · ${t(`cp17.exception.${r.exceptionKind}`)}` : ''}
              </p>
              <p className="tabular text-caption text-muted-foreground">
                {formatDateTime(r.at)}
                {r.place ? ` · ${r.place}` : ''}
                {r.pieces ? ` · ${t('cp17.pcs', { count: r.pieces })}` : ''}
                {r.note ? ` · ${r.note}` : ''} · {t('cp17.network')}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

function TrackMap({ data, s, now }: { data: DemoData; s: Shipment; now: string }) {
  const { t } = useTranslation()
  const stops = routeStops(data, s)
  const lh = s.legIds.map((id) => data.legs[id]).find((l) => l.type === 'lineHaul')
  const trip = lh?.tripId ? data.trips[lh.tripId] : undefined
  const pos = shipmentPosition(data, s, now)
  const route = trip ? [stops[0], ...tripRoute(data, trip), stops[stops.length - 1]] : stops
  const markers: MapMarker[] = [
    ...stops.map((p, i) => ({ ...p, id: `stop-${i}`, tone: 'neutral' as const, label: p.label })),
    { ...pos, id: 'now', tone: 'info', label: t('cp17.hereNow'), emphasis: true },
  ]
  return <MapView markers={markers} route={route} ariaLabel={t('cp17.map')} className="h-[420px]" />
}

function Details({ data, s }: { data: DemoData; s: Shipment }) {
  const { t } = useTranslation()
  const loc = data.pickupLocations[s.pickupLocationId]
  const c = data.consignees[s.consigneeId]
  const dest = data.pincodes[s.destPincode]
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="mb-2 text-card-title">{t('cp17.pickup')}</h2>
        <p className="font-medium">{loc.name}</p>
        <p className="text-muted-foreground">{loc.address}</p>
        <p className="tabular text-caption text-muted-foreground">
          {(s.pickupContact ?? loc.contact).name} · {(s.pickupContact ?? loc.contact).mobile}
        </p>
      </section>
      <section className="rounded-xl border bg-card p-5 shadow-card">
        <h2 className="mb-2 text-card-title">{t('cp17.consignee')}</h2>
        <p className="font-medium">{c.company || c.contact}</p>
        <p className="text-muted-foreground">
          {c.address}, {dest.city} {dest.code}
        </p>
        <p className="tabular text-caption text-muted-foreground">
          {c.contact} · {maskMobile(c.mobile)}
        </p>
      </section>
      <section className="rounded-xl border bg-card p-5 shadow-card lg:col-span-2">
        <h2 className="mb-2 text-card-title">{t('cp17.pieces')}</h2>
        <table className="w-full text-table">
          <thead>
            <tr className="border-b text-left text-caption text-muted-foreground">
              <th className="py-2">{t('cp17.piece')}</th>
              <th>{t('cp17.bookedDims')}</th>
              <th>{t('cp17.verifiedDims')}</th>
            </tr>
          </thead>
          <tbody>
            {s.pieces.map((p) => (
              <tr key={p.id} className="tabular border-b last:border-0">
                <td className="py-2">{p.id}</td>
                <td>
                  {p.l} × {p.b} × {p.h} cm · {formatKg(p.weight)}
                </td>
                <td>{p.verifiedDims ? `${p.verifiedDims.l} × ${p.verifiedDims.b} × ${p.verifiedDims.h} cm · ${formatKg(p.verifiedWeight ?? p.weight)}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="rounded-xl border bg-card p-5 shadow-card lg:col-span-2">
        <h2 className="mb-2 text-card-title">{t('cp17.invoiceEwb')}</h2>
        <p className="tabular">
          {t('cp17.invoiceLine', { no: s.invoice.no, value: formatINR(s.invoice.value) })}
          {s.invoice.po ? ` · ${t('cp17.po', { po: s.invoice.po })}` : ''}
        </p>
        {s.ewb ? (
          <p className="tabular">
            {t('cp17.ewbLine', { no: s.ewb.no, date: formatDate(s.ewb.validTill) })} · {s.ewb.partBUpdated ? t('cp17.partBDone') : t('cp17.partBPending')}
          </p>
        ) : (
          <p className="text-muted-foreground">{t('cp17.noEwb')}</p>
        )}
      </section>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="tabular font-medium">{value}</p>
    </div>
  )
}
