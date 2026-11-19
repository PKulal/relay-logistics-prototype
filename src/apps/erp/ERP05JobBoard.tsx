/**
 * ERP-05 Live job board — docs/04-erp-control-tower.md §6.3.
 * Every shipment and leg, live, filterable; Legs | Shipments | Map views.
 * Rows update as the other apps act and as the demo clock moves.
 */
import { List, Map as MapIcon, Rows3, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { shipmentPosition } from '@shared/engines/position'
import type { SlaState } from '@shared/engines/sla'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDayShort, formatTime } from '@shared/lib/format'
import { useSimulatedLoading } from '@shared/sim/latency'
import { LEG_STATUSES, SHIPMENT_STATUSES, type Service } from '@shared/types'
import { Button } from '@shared/ui/button'
import { DataTable, type Column } from '@shared/ui/DataTable'
import { EmptyState } from '@shared/ui/EmptyState'
import { Input } from '@shared/ui/input'
import { MapView, type MapMarker } from '@shared/ui/MapView'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SlaBadge } from '@shared/ui/SlaBadge'
import { Chip, LegStatusChip, ShipmentStatusChip } from '@shared/ui/StatusChip'
import { Switch } from '@shared/ui/switch'
import { TierBadge } from '@shared/ui/TierBadge'
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group'
import type { Tone } from '@shared/ui/tones'
import { legRows, NO_FILTERS, shipmentRows, SLA_ORDER, type BoardFilters, type LastEvent, type LegRow, type ShipmentRow } from './jobBoard'
import { ShipmentActions } from './ShipmentActions'

type View = 'legs' | 'shipments' | 'map'
const SLA_TONE: Record<SlaState, Tone> = { breached: 'danger', atRisk: 'warning', onTrack: 'info', done: 'success' }
const SERVICES: Service[] = ['expressPtl', 'standardPtl', 'express', 'standard', 'economy']

export default function ERP05JobBoard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const data = useData((d) => d)
  const now = useDemoNow()
  const [view, setView] = useState<View>('legs')
  // ?partner=… opens the board filtered on one partner (ERP-09 Partner health links)
  const [params] = useSearchParams()
  const [f, setF] = useState<BoardFilters>(() => ({ ...NO_FILTERS, partnerId: params.get('partner') ?? '' }))
  const loading = useSimulatedLoading(view)
  const set = <K extends keyof BoardFilters>(k: K, v: BoardFilters[K]) => setF((x) => ({ ...x, [k]: v }))

  const legs = useMemo(() => (view === 'legs' ? legRows(data, f, now) : []), [view, data, f, now])
  const ships = useMemo(() => (view !== 'legs' ? shipmentRows(data, f, now) : []), [view, data, f, now])
  const counts = useMemo(() => {
    const all = shipmentRows(data, { ...NO_FILTERS }, now)
    return { breached: all.filter((r) => r.sla === 'breached').length, atRisk: all.filter((r) => r.sla === 'atRisk').length, active: all.length }
  }, [data, now])

  const open = (lr: string) => navigate(`/erp/shipments/${lr}`)
  const customerName = (id: string) => data.customers[id]?.shortName ?? id
  const lastEvent = (last?: LastEvent) =>
    last ? (
      <span className="block min-w-40">
        <span className="block font-medium">{t(`event.${last.event.type}`)}</span>
        <span className="block text-caption text-muted-foreground">
          {last.place} · {formatDayShort(last.event.at)} {formatTime(last.event.at)}
        </span>
      </span>
    ) : (
      '—'
    )

  const legColumns: Column<LegRow>[] = [
    {
      key: 'lr',
      header: t('erp05.col.lrLeg'),
      cell: (r) => (
        <span className="font-semibold text-primary">
          {r.shipment.id} · L{r.leg.seq}
        </span>
      ),
      sortValue: (r) => `${r.shipment.id}-${r.leg.seq}`,
    },
    { key: 'type', header: t('erp05.col.leg'), cell: (r) => t(`legType.${r.leg.type}`), sortValue: (r) => r.leg.type },
    { key: 'customer', header: t('erp05.col.customer'), cell: (r) => customerName(r.shipment.customerId), sortValue: (r) => customerName(r.shipment.customerId) },
    {
      key: 'partner',
      header: t('erp05.col.partner'),
      cell: (r) => {
        const p = data.partners[r.leg.partnerId]
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            {p.shortName} <TierBadge tier={p.tier} />
          </span>
        )
      },
      sortValue: (r) => data.partners[r.leg.partnerId].shortName,
    },
    { key: 'status', header: t('erp05.col.legStatus'), cell: (r) => <LegStatusChip status={r.leg.status} />, sortValue: (r) => r.leg.status },
    { key: 'sla', header: t('erp05.col.sla'), cell: (r) => <SlaBadge state={r.sla} dueAt={r.leg.slaDueAt} now={now} />, sortValue: (r) => SLA_ORDER[r.sla] * 1e13 + Date.parse(r.leg.slaDueAt) },
    { key: 'last', header: t('erp05.col.lastEvent'), cell: (r) => lastEvent(r.last), sortValue: (r) => (r.last ? -Date.parse(r.last.event.at) : 0) },
    { key: 'actions', header: <span className="sr-only">{t('erp05.col.actions')}</span>, cell: (r) => <ShipmentActions shipment={r.shipment} partnerId={r.leg.partnerId} legId={r.leg.id} /> },
  ]

  const shipmentColumns: Column<ShipmentRow>[] = [
    { key: 'lr', header: t('erp05.col.lr'), cell: (r) => <span className="font-semibold text-primary">{r.shipment.id}</span>, sortValue: (r) => r.shipment.id },
    { key: 'customer', header: t('erp05.col.customer'), cell: (r) => customerName(r.shipment.customerId), sortValue: (r) => customerName(r.shipment.customerId) },
    {
      key: 'route',
      header: t('erp05.col.route'),
      cell: (r) => `${data.pincodes[r.shipment.originPincode].city} → ${data.pincodes[r.shipment.destPincode].city}`,
      sortValue: (r) => data.pincodes[r.shipment.destPincode].city,
    },
    { key: 'service', header: t('erp05.col.service'), cell: (r) => t(`service.${r.shipment.service}`), sortValue: (r) => r.shipment.service },
    { key: 'status', header: t('erp05.col.status'), cell: (r) => <ShipmentStatusChip status={r.shipment.status} />, sortValue: (r) => r.shipment.status },
    {
      key: 'current',
      header: t('erp05.col.currentLeg'),
      cell: (r) => (r.current ? `L${r.current.seq} · ${data.partners[r.current.partnerId].shortName}` : '—'),
    },
    { key: 'sla', header: t('erp05.col.sla'), cell: (r) => <SlaBadge state={r.sla} dueAt={r.current?.slaDueAt} now={now} />, sortValue: (r) => SLA_ORDER[r.sla] },
    { key: 'eta', header: t('erp05.col.eta'), cell: (r) => formatDayShort(r.shipment.eta), sortValue: (r) => r.shipment.eta },
    { key: 'last', header: t('erp05.col.lastEvent'), cell: (r) => lastEvent(r.last), sortValue: (r) => (r.last ? -Date.parse(r.last.event.at) : 0) },
    { key: 'actions', header: <span className="sr-only">{t('erp05.col.actions')}</span>, cell: (r) => <ShipmentActions shipment={r.shipment} partnerId={r.current?.partnerId} /> },
  ]

  const markers: MapMarker[] = ships.map((r) => ({
    id: r.shipment.id,
    ...shipmentPosition(data, r.shipment, now),
    tone: SLA_TONE[r.sla],
    label: `${r.shipment.id} · ${customerName(r.shipment.customerId)} · ${t(`status.shipment.${r.shipment.status}`)}`,
    onClick: () => open(r.shipment.id),
  }))

  const statusOptions = view === 'legs' ? LEG_STATUSES.map((s) => [s, t(`status.leg.${s}`)]) : SHIPMENT_STATUSES.map((s) => [s, t(`status.shipment.${s}`)])
  const filtered = JSON.stringify(f) !== JSON.stringify(NO_FILTERS)
  const empty = <EmptyState title={t('erp05.emptyTitle')} body={t('erp05.emptyBody')} action={filtered && <Button variant="outline" onClick={() => setF(NO_FILTERS)}>{t('erp05.clear')}</Button>} />

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('erp05.title')}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {t('erp05.active', { count: counts.active })}
            <button type="button" onClick={() => setF({ ...NO_FILTERS, sla: 'breached' })}>
              <Chip tone="danger">{t('erp05.breached', { count: counts.breached })}</Chip>
            </button>
            <button type="button" onClick={() => setF({ ...NO_FILTERS, sla: 'atRisk' })}>
              <Chip tone="warning">{t('erp05.atRisk', { count: counts.atRisk })}</Chip>
            </button>
          </span>
        }
        actions={
          <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && (setView(v as View), set('status', ''))} aria-label={t('erp05.view')}>
            <ToggleGroupItem value="legs" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              <Rows3 /> {t('erp05.views.legs')}
            </ToggleGroupItem>
            <ToggleGroupItem value="shipments" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              <List /> {t('erp05.views.shipments')}
            </ToggleGroupItem>
            <ToggleGroupItem value="map" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              <MapIcon /> {t('erp05.views.map')}
            </ToggleGroupItem>
          </ToggleGroup>
        }
        className="mb-0"
      />

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 md:grid-cols-4 2xl:grid-cols-8" role="search" aria-label={t('erp05.filters')}>
        <Input aria-label={t('erp05.f.q')} placeholder={t('erp05.f.q')} value={f.q} onChange={(e) => set('q', e.target.value)} className="col-span-2 md:col-span-1" />
        <Select label={t('erp05.f.customer')} value={f.customerId} onChange={(v) => set('customerId', v)} options={Object.values(data.customers).map((c) => [c.id, c.shortName])} />
        <Select label={t('erp05.f.lane')} value={f.laneId} onChange={(v) => set('laneId', v)} options={Object.values(data.lanes).map((l) => [l.id, `${l.originRegion} → ${l.destRegion}`])} />
        <Select label={t('erp05.f.partner')} value={f.partnerId} onChange={(v) => set('partnerId', v)} options={Object.values(data.partners).map((p) => [p.id, p.shortName])} />
        <Select label={t('erp05.f.hub')} value={f.hubId} onChange={(v) => set('hubId', v)} options={Object.values(data.hubs).map((h) => [h.id, h.name])} />
        <Select label={t('erp05.f.status')} value={f.status} onChange={(v) => set('status', v)} options={statusOptions as [string, string][]} />
        <Select label={t('erp05.f.service')} value={f.service} onChange={(v) => set('service', v as Service | '')} options={SERVICES.map((s) => [s, t(`service.${s}`)])} />
        <Select label={t('erp05.f.sla')} value={f.sla} onChange={(v) => set('sla', v as SlaState | '')} options={(['breached', 'atRisk', 'onTrack'] as SlaState[]).map((s) => [s, t(`slaState.${s}`)])} />
        <div className="col-span-2 flex items-center justify-between gap-3 md:col-span-4 2xl:col-span-8">
          <label className="flex items-center gap-2 text-caption">
            <Switch checked={f.includeDone} onCheckedChange={(v) => set('includeDone', v)} />
            {t('erp05.includeDone')}
          </label>
          {filtered && (
            <Button variant="ghost" size="sm" onClick={() => setF(NO_FILTERS)}>
              <X /> {t('erp05.clear')}
            </Button>
          )}
        </div>
      </div>

      {view === 'legs' && (
        <DataTable rows={legs} columns={legColumns} rowKey={(r) => r.leg.id} loading={loading} pageSize={15} onRowClick={(r) => open(r.shipment.id)} empty={empty} defaultSort={{ key: 'sla', dir: 'asc' }} />
      )}
      {view === 'shipments' && (
        <DataTable rows={ships} columns={shipmentColumns} rowKey={(r) => r.shipment.id} loading={loading} pageSize={15} onRowClick={(r) => open(r.shipment.id)} empty={empty} defaultSort={{ key: 'sla', dir: 'asc' }} />
      )}
      {view === 'map' && (
        <>
          <MapView markers={markers} ariaLabel={t('erp05.mapLabel')} className="h-[560px]" />
          <p className="flex flex-wrap gap-3 text-caption text-muted-foreground">
            {(['breached', 'atRisk', 'onTrack'] as SlaState[]).map((s) => (
              <Chip key={s} tone={SLA_TONE[s]}>
                {t(`slaState.${s}`)}
              </Chip>
            ))}
            <span>{t('erp05.mapNote', { count: markers.length })}</span>
          </p>
        </>
      )}
    </div>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  const { t } = useTranslation()
  return (
    <NativeSelect aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">
        {label}: {t('erp05.all')}
      </option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </NativeSelect>
  )
}
