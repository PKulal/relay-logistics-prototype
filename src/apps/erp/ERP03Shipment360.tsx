/**
 * ERP-03 Shipment 360 — docs/04-erp-control-tower.md §6.1.
 * One master shipment and its 2–5 legs: partners, hand-overs, timeline, map,
 * money, documents, tickets and claims, AI decisions. Every action in the other
 * apps shows up here.
 */
import { ArrowLeft, BrainCircuit, CircleCheck, CircleX, FileText, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router-dom'
import { cn } from '@/shared/lib/utils'
import { LrDocument, PieceLabel } from '@shared/docs/ShipmentDocs'
import { computeMargin } from '@shared/engines/margin'
import { routeStops, shipmentPosition } from '@shared/engines/position'
import { priceLine } from '@shared/engines/pricing'
import { legSla, shipmentSla } from '@shared/engines/sla'
import { sortEvents } from '@shared/engines/status'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatDateTime, formatDayShort, formatINR, formatKg } from '@shared/lib/format'
import { person } from '@shared/people'
import type { DemoData, ErpRole, Leg, Shipment, ShipmentEvent } from '@shared/types'
import { Button } from '@shared/ui/button'
import { EmptyState } from '@shared/ui/EmptyState'
import { MapView } from '@shared/ui/MapView'
import { NotFound } from '@shared/ui/Page'
import { PriceBreakdown } from '@shared/ui/PriceBreakdown'
import { PrintArea } from '@shared/ui/PrintArea'
import { SimulatedTag } from '@shared/ui/SimulatedTag'
import { SlaBadge } from '@shared/ui/SlaBadge'
import { Chip, LegStatusChip, ShipmentStatusChip } from '@shared/ui/StatusChip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/ui/tabs'
import { TierBadge } from '@shared/ui/TierBadge'
import { ShipmentActions } from './ShipmentActions'
import { useErpSession } from './useErpSession'

/** Money tab: Leadership, Pricing, Finance, Super Admin (ERP-03 rule). */
const MONEY_ROLES: ErpRole[] = ['leadership', 'pricing', 'finance', 'superAdmin']
/** Sales sees Shipment 360 without leg costs (ERP §3.2). */
const NO_LEG_COSTS: ErpRole[] = ['sales']

export default function ERP03Shipment360() {
  const { t } = useTranslation()
  const { lr = '' } = useParams()
  const { user } = useErpSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const s = data.shipments[lr]
  const [printMode, setPrintMode] = useState<'lr' | 'labels' | null>(null)

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

  const events = useMemo(() => (s ? sortEvents(Object.values(data.events).filter((e) => e.shipmentId === s.id)) : []), [data.events, s])

  if (!s) return <NotFound />

  const customer = data.customers[s.customerId]
  const legs = s.legIds.map((id) => data.legs[id])
  const origin = data.pincodes[s.originPincode]
  const dest = data.pincodes[s.destPincode]
  const showMoney = MONEY_ROLES.includes(user.role)
  const showLegCosts = !NO_LEG_COSTS.includes(user.role)
  const claims = Object.values(data.claims).filter((c) => c.shipmentId === s.id)
  const tickets = Object.values(data.tickets).filter((x) => x.shipmentId === s.id)
  const decisions = Object.values(data.aiDecisions).filter((d) => d.recordId === s.id)
  const current = legs.find((l) => !['handedOver', 'delivered', 'closed', 'withdrawn'].includes(l.status))

  return (
    <div className="flex flex-col gap-6">
      <Link to="/erp/control-tower/jobs" className="inline-flex w-fit items-center gap-1.5 text-caption font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> {t('erp03.backToBoard')}
      </Link>

      {/* Header: LR · customer · service · status · ETA · SLA */}
      <header className="flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="tabular font-heading text-page-title font-bold">{s.id}</h1>
          <ShipmentStatusChip status={s.status} />
          <SlaBadge state={shipmentSla(data, s, now)} dueAt={current?.slaDueAt} now={now} />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-body sm:grid-cols-3 lg:grid-cols-6">
          <Fact label={t('erp03.customer')}>{customer.shortName}</Fact>
          <Fact label={t('erp03.route')}>
            {origin.city} {origin.code} → {dest.city} {dest.code}
          </Fact>
          <Fact label={t('erp03.service')}>{t(`service.${s.service}`)}</Fact>
          <Fact label={t('erp03.eta')}>{formatDayShort(s.eta)}</Fact>
          <Fact label={t('erp03.weight')}>
            {t('cp13.pieces', { count: s.pieces.length })} · {formatKg(s.weights.chargeable)}
          </Fact>
          <Fact label={t('erp03.booked')}>{formatDateTime(s.bookedAt)}</Fact>
        </dl>
        <ShipmentActions shipment={s} partnerId={current?.partnerId} variant="bar" />
      </header>

      {/* Legs panel */}
      <section aria-labelledby="legs-h" className="rounded-xl border bg-card shadow-card">
        <h2 id="legs-h" className="border-b px-5 py-3 text-section">
          {t('erp03.legs', { count: legs.length })}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-table">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2 font-semibold">{t('erp03.col.leg')}</th>
                <th className="px-4 py-2 font-semibold">{t('erp03.col.partner')}</th>
                <th className="px-4 py-2 font-semibold">{t('erp03.col.status')}</th>
                <th className="px-4 py-2 font-semibold">{t('erp03.col.handoverIn')}</th>
                <th className="px-4 py-2 font-semibold">{t('erp03.col.handoverOut')}</th>
                {showLegCosts && <th className="px-4 py-2 text-right font-semibold">{t('erp03.col.cost')}</th>}
              </tr>
            </thead>
            <tbody>
              {legs.map((leg, i) => (
                <LegRowView key={leg.id} data={data} leg={leg} next={legs[i + 1]} events={events} now={now} showCost={showLegCosts} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Tabs defaultValue="timeline">
        <TabsList className="flex-wrap">
          <TabsTrigger value="timeline">{t('erp03.tabs.timeline')}</TabsTrigger>
          <TabsTrigger value="map">{t('erp03.tabs.map')}</TabsTrigger>
          {showMoney && <TabsTrigger value="money">{t('erp03.tabs.money')}</TabsTrigger>}
          <TabsTrigger value="documents">{t('erp03.tabs.documents')}</TabsTrigger>
          <TabsTrigger value="claims">{t('erp03.tabs.claims')}</TabsTrigger>
          <TabsTrigger value="ai">{t('erp03.tabs.ai')}</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <Timeline data={data} s={s} events={events} />
        </TabsContent>

        <TabsContent value="map">
          <MapView
            ariaLabel={t('erp03.mapLabel', { lr: s.id })}
            className="h-[420px]"
            route={routeStops(data, s)}
            markers={[
              ...routeStops(data, s).map((st) => ({ id: st.kind, lat: st.lat, lng: st.lng, tone: 'neutral' as const, label: `${t(`erp03.stop.${st.kind}`)}: ${st.label}` })),
              { id: 'now', ...shipmentPosition(data, s, now), tone: 'info' as const, emphasis: true, label: t('erp03.nowHere', { status: t(`status.shipment.${s.status}`) }) },
            ]}
          />
          <p className="mt-2 text-caption text-muted-foreground">
            {t('erp03.mapNote')} <SimulatedTag />
          </p>
        </TabsContent>

        {showMoney && (
          <TabsContent value="money">
            <Money data={data} s={s} legs={legs} />
          </TabsContent>
        )}

        <TabsContent value="documents">
          <Documents s={s} events={events} onPrint={setPrintMode} />
        </TabsContent>

        <TabsContent value="claims">
          {claims.length === 0 && tickets.length === 0 ? (
            <EmptyState title={t('erp03.noClaims')} />
          ) : (
            <ul className="flex flex-col gap-2">
              {claims.map((c) => (
                <li key={c.id} className="rounded-lg border bg-card p-4">
                  <p className="font-semibold">
                    {c.id} · {t(`erp03.claimType.${c.type}`)} · <Chip tone={c.status === 'settled' ? 'success' : 'warning'}>{t(`erp03.claimStatus.${c.status}`)}</Chip>
                  </p>
                  <p className="tabular text-caption text-muted-foreground">
                    {t('erp03.claimLine', {
                      claimed: formatINR(c.amountClaimed),
                      approved: c.amountApproved !== undefined ? formatINR(c.amountApproved) : '—',
                      partner: c.liablePartnerId ? data.partners[c.liablePartnerId].shortName : '—',
                      leg: c.liableLegId ? `L${data.legs[c.liableLegId]?.seq}` : '—',
                    })}
                  </p>
                </li>
              ))}
              {tickets.map((x) => (
                <li key={x.id} className="rounded-lg border bg-card p-4">
                  {x.id} · {x.subject}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="ai">
          <AiDecisions data={data} decisions={decisions} />
        </TabsContent>
      </Tabs>

      {printMode && (
        <PrintArea>
          <style>{'@page { size: A4; margin: 10mm }'}</style>
          {printMode === 'lr' ? (
            <LrDocument data={data} s={s} />
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {s.pieces.map((p, i) => (
                <div key={p.id} className={cn('break-inside-avoid', (i + 1) % 4 === 0 && 'break-after-page')}>
                  <PieceLabel data={data} s={s} index={i} />
                </div>
              ))}
            </div>
          )}
        </PrintArea>
      )}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

/** One leg: partner, status + SLA, hand-over in (its own receiving scan) and out (the next leg's). */
function LegRowView({ data, leg, next, events, now, showCost }: { data: DemoData; leg: Leg; next?: Leg; events: ShipmentEvent[]; now: string; showCost: boolean }) {
  const { t } = useTranslation()
  const p = data.partners[leg.partnerId]
  const handIn = events.find((e) => e.legId === leg.id && (e.type === 'handoverReceived' || e.type === 'pickupConfirmed'))
  const handOut = next ? events.find((e) => e.legId === next.id && e.type === 'handoverReceived') : events.find((e) => e.legId === leg.id && e.type === 'delivered')
  const scan = (e?: ShipmentEvent) =>
    e ? (
      <span className="block">
        <span className="tabular">{formatDateTime(e.at)}</span>
        <span className="block text-caption text-muted-foreground">
          {person(data, e.by).name}
          {e.sealNos?.length ? ` · ${e.sealNos.join(', ')}` : ''}
          {e.pieceIds ? ` · ${t('cp13.pieces', { count: e.pieceIds.length })}` : ''}
        </span>
      </span>
    ) : (
      <span className="text-muted-foreground">—</span>
    )
  return (
    <tr className="border-t align-top">
      <td className="px-4 py-3">
        <span className="font-semibold">L{leg.seq}</span> {t(`legType.${leg.type}`)}
        <span className="tabular block text-caption text-muted-foreground">{leg.id}</span>
      </td>
      <td className="px-4 py-3">
        <span className="font-medium">{p.shortName}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-caption text-muted-foreground">
          {t('partner.typeShort', { type: p.type })} <TierBadge tier={p.tier} />
        </span>
        {leg.staffId && <span className="block text-caption text-muted-foreground">{person(data, leg.staffId).name}</span>}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-1">
          <LegStatusChip status={leg.status} />
          <SlaBadge state={legSla(leg, now)} dueAt={leg.slaDueAt} now={now} />
        </div>
      </td>
      <td className="px-4 py-3">{scan(handIn)}</td>
      <td className="px-4 py-3">{scan(handOut)}</td>
      {showCost && <td className="tabular px-4 py-3 text-right">{formatINR(leg.cost)}</td>}
    </tr>
  )
}

function Timeline({ data, s, events }: { data: DemoData; s: Shipment; events: ShipmentEvent[] }) {
  const { t } = useTranslation()
  if (events.length === 0) return <EmptyState title={t('erp03.noEvents')} />
  return (
    <ol className="relative flex flex-col gap-0 border-l-2 border-gray-100 pl-6">
      {[...events].reverse().map((e) => {
        const who = person(data, e.by)
        const leg = e.legId ? data.legs[e.legId] : undefined
        return (
          <li key={e.id} className="relative pb-4">
            <span className="absolute top-1.5 -left-[31px] size-3 rounded-full border-2 border-white bg-primary" aria-hidden />
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{t(`event.${e.type}`)}</span>
              {leg && <span className="text-caption text-muted-foreground">L{leg.seq}</span>}
              <Chip tone="neutral">{t(`appName.${e.app}`)}</Chip>
              {e.exceptionKind && <Chip tone="danger">{t(`exception.${e.exceptionKind}`)}</Chip>}
            </p>
            <p className="tabular text-caption text-muted-foreground">
              {formatDateTime(e.at)} · {who.name}
              {who.org && who.org !== data.customers[s.customerId]?.shortName ? ` (${who.org})` : ''}
            </p>
            {(e.reason || e.note || e.sealNos?.length || e.receivedBy) && (
              <p className="text-caption">
                {[e.reason && (e.type === 'deliveryFailed' ? t(`ndr.reason.${e.reason}`, { defaultValue: e.reason }) : e.reason), e.note, e.sealNos?.length ? `${t('erp03.seal')} ${e.sealNos.join(', ')}` : '', e.receivedBy ? t('erp03.receivedBy', { name: e.receivedBy }) : '']
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

function Money({ data, s, legs }: { data: DemoData; s: Shipment; legs: Leg[] }) {
  const { t } = useTranslation()
  const insurance = priceLine(s.price, 'fov')
  const m = computeMargin({ subtotal: s.price.subtotal, legCosts: legs.map((l) => l.cost), insurance, riskBufferPct: data.settings.riskBufferPct, targetMarginPct: data.settings.targetMarginPct })
  const row = (label: React.ReactNode, amount: string, strong?: boolean, key?: string) => (
    <tr key={key} className="border-b border-gray-100">
      <td className={cn('py-1.5', strong && 'font-semibold')}>{label}</td>
      <td className={cn('tabular py-1.5 text-right', strong && 'font-semibold')}>{amount}</td>
    </tr>
  )
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-card-title">{t('erp03.customerPrice')}</h3>
        <PriceBreakdown price={s.price} gstPct={data.settings.gstPct} />
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h3 className="mb-3 text-card-title">{t('erp03.marginTitle')}</h3>
        <table className="w-full text-table">
          <tbody>
            {row(t('erp03.priceBeforeGst'), formatINR(s.price.subtotal), true)}
            {legs.map((l) => row(`L${l.seq} ${data.partners[l.partnerId].shortName} (${t(`legType.${l.type}`)})`, `− ${formatINR(l.cost)}`, false, l.id))}
            {row(t('erp03.insurancePassThrough'), `− ${formatINR(insurance)}`)}
            {row(t('erp03.grossMargin', { pct: m.grossPct }), formatINR(m.gross), true)}
            {row(t('erp03.riskBuffer', { pct: data.settings.riskBufferPct }), `− ${formatINR(m.buffer)}`)}
            {row(t('erp03.netMargin', { pct: m.netPct }), formatINR(m.net), true)}
          </tbody>
        </table>
        <p className={cn('mt-3 flex items-center gap-1.5 font-medium', m.belowTarget ? 'text-status-danger' : 'text-status-success')}>
          {m.belowTarget ? <CircleX className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
          {m.belowTarget ? t('erp03.belowTarget', { pct: data.settings.targetMarginPct }) : t('erp03.aboveTarget', { pct: data.settings.targetMarginPct })}
        </p>
      </section>
    </div>
  )
}

function Documents({ s, events, onPrint }: { s: Shipment; events: ShipmentEvent[]; onPrint: (m: 'lr' | 'labels') => void }) {
  const { t } = useTranslation()
  const delivered = events.find((e) => e.type === 'delivered')
  const seals = [...new Set(events.flatMap((e) => e.sealNos ?? []))]
  const docs: { name: string; detail: React.ReactNode; action?: React.ReactNode }[] = [
    { name: t('erp03.doc.lr'), detail: s.id, action: <Button variant="outline" size="sm" onClick={() => onPrint('lr')}><Printer /> {t('erp03.print')}</Button> },
    { name: t('erp03.doc.labels'), detail: t('cp14.labels', { count: s.pieces.length }), action: <Button variant="outline" size="sm" onClick={() => onPrint('labels')}><Printer /> {t('erp03.print')}</Button> },
    { name: t('erp03.doc.invoice'), detail: `${s.invoice.no} · ${s.invoice.fileUrl ?? t('erp03.noFile')}` },
    {
      name: t('erp03.doc.ewb'),
      detail: s.ewb ? (
        <>
          {s.ewb.no} · {t('cp14.ewbValid', { date: formatDate(s.ewb.validTill) })} ·{' '}
          <Chip tone={s.ewb.partBUpdated ? 'success' : 'warning'}>{s.ewb.partBUpdated ? t('erp03.partBDone') : t('erp03.partBPending')}</Chip>
        </>
      ) : (
        t('cp14.ewbNone')
      ),
    },
  ]
  if (seals.length) docs.push({ name: t('erp03.doc.seals'), detail: seals.join(', ') })
  if (delivered) docs.push({ name: t('erp03.doc.epod'), detail: [delivered.receivedBy && t('erp03.receivedBy', { name: delivered.receivedBy }), delivered.grn, formatDateTime(delivered.at)].filter(Boolean).join(' · ') })

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {docs.map((d) => (
        <li key={d.name} className="flex flex-wrap items-center gap-3 px-5 py-3">
          <FileText className="size-4 text-muted-foreground" aria-hidden />
          <span className="w-40 font-medium">{d.name}</span>
          <span className="min-w-0 flex-1 text-muted-foreground">{d.detail}</span>
          {d.action}
        </li>
      ))}
    </ul>
  )
}

function AiDecisions({ data, decisions }: { data: DemoData; decisions: DemoData['aiDecisions'][string][] }) {
  const { t } = useTranslation()
  if (decisions.length === 0) return <EmptyState icon={BrainCircuit} title={t('erp03.noDecisions')} />
  return (
    <ul className="flex flex-col gap-3">
      {decisions.map((d) => (
        <li key={d.id} className="rounded-xl border bg-card p-4">
          <p className="flex flex-wrap items-center gap-2 font-semibold">
            <BrainCircuit className="size-4 text-primary" aria-hidden />
            {d.kind === 'legAssignment' && d.legId
              ? t('erp03.ai.assigned', { leg: `L${data.legs[d.legId].seq}`, partner: data.partners[d.chosenPartnerId!].shortName })
              : t(`erp03.ai.${d.kind}`)}
            <span className="text-caption font-normal text-muted-foreground">
              {d.model} · {t('erp03.ai.confidence', { pct: Math.round(d.confidence * 100) })}
            </span>
            <SimulatedTag />
          </p>
          {d.candidates && (
            <ol className="mt-2 flex flex-col gap-1 text-table">
              {d.candidates.map((c, i) => (
                <li key={c.partnerId} className={cn('flex flex-wrap items-center gap-2', !c.eligible && 'text-muted-foreground')}>
                  <span className="w-5 text-right">{i + 1}.</span>
                  <span className="font-medium">{data.partners[c.partnerId].shortName}</span>
                  <span className="tabular">{t('erp03.ai.scoreCost', { score: c.score, cost: formatINR(c.cost) })}</span>
                  {c.partnerId === d.chosenPartnerId ? <Chip tone="success">{t('erp03.ai.chosen')}</Chip> : !c.eligible && c.reason && <Chip tone="neutral">{t(`erp03.ai.skip.${c.reason}`)}</Chip>}
                </li>
              ))}
            </ol>
          )}
          {d.margin && (
            <p className="tabular mt-2 text-table">
              {t('erp03.ai.marginLine', { gross: formatINR(d.margin.gross), grossPct: d.margin.grossPct, net: formatINR(d.margin.net), netPct: d.margin.netPct, target: d.margin.targetPct })}{' '}
              <Chip tone={d.margin.belowTarget ? 'danger' : 'success'}>{d.margin.belowTarget ? t('erp03.ai.flagged') : t('erp03.ai.ok')}</Chip>
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
