/**
 * CP-16 Shipments list and universal search — docs/01-customer-portal.md §6.4.
 * Find by LR, invoice no., PO no. or consignee (source §7.2 Universal Search),
 * filter, list or map, and act on one or many shipments.
 */
import { Download, FileSpreadsheet, List, Map as MapIcon, MoreHorizontal, Printer, Repeat2, Search, ShieldAlert, Truck } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { hasException } from '@shared/engines/customerDashboard'
import { shipmentPosition } from '@shared/engines/position'
import { shipmentSla, type SlaState } from '@shared/engines/sla'
import { matchesSearch } from '@shared/engines/tracking'
import { claimableShipments } from '@shared/engines/claims'
import { useData, useDemoNow } from '@shared/hooks/useDemo'
import { formatDate, formatINR, formatKg } from '@shared/lib/format'
import { addDays, istDate } from '@shared/lib/time'
import { SHIPMENT_STATUSES, type PaymentMode, type Service, type Shipment } from '@shared/types'
import { Button } from '@shared/ui/button'
import { Checkbox } from '@shared/ui/checkbox'
import { DataTable, type Column } from '@shared/ui/DataTable'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@shared/ui/dropdown-menu'
import { Input } from '@shared/ui/input'
import { MapView, type MapMarker } from '@shared/ui/MapView'
import { NativeSelect } from '@shared/ui/NativeSelect'
import { PageHeader } from '@shared/ui/Page'
import { SlaBadge } from '@shared/ui/SlaBadge'
import { ShipmentStatusChip } from '@shared/ui/StatusChip'
import { Switch } from '@shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group'
import { SHIPMENT_TONE } from '@shared/ui/tones'
import { downloadDocuments, exportShipments, usePrintShipments } from './shipmentFiles'
import { useCustomerSession } from './useCustomerSession'

/** Statuses a customer sees (source §7.1, plus the exception statuses). */
const STATUSES = SHIPMENT_STATUSES
const SERVICES: Service[] = ['economy', 'standard', 'express', 'expressPtl', 'standardPtl']
const PAYMENT: PaymentMode[] = ['paid', 'toPay', 'tbb', 'cod']
const RANGES = ['7', '30', '90', 'all'] as const

interface Filters {
  q: string
  status: string
  range: (typeof RANGES)[number]
  service: string
  location: string
  state: string
  payment: string
  sla: string
  exceptions: boolean
}

/** "23-Nov": the list is recent, the year adds width without information (full date in CP-17). */
const shortDate = (d: string) => formatDate(d).slice(0, 6)

export default function CP16Shipments() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, customer } = useCustomerSession()
  const data = useData((d) => d)
  const now = useDemoNow()
  const claimableIds = useMemo(() => new Set(claimableShipments(data, customer.id, now).map((x) => x.id)), [data, customer.id, now])
  const canBook = user.role === 'admin' || user.role === 'dispatch'
  const [f, setF] = useState<Filters>({ q: params.get('q') ?? '', status: params.get('status') === 'exceptions' ? '' : (params.get('status') ?? ''), range: 'all', service: '', location: '', state: '', payment: '', sla: '', exceptions: params.get('exceptions') === '1' || params.get('status') === 'exceptions' })
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((x) => ({ ...x, [k]: v }))
  const [view, setView] = useState<'list' | 'map'>('list')
  const [selected, setSelected] = useState<string[]>([])
  const printer = usePrintShipments(data)

  const mine = useMemo(() => Object.values(data.shipments).filter((s) => s.customerId === customer.id), [data, customer.id])
  const locations = Object.values(data.pickupLocations).filter((l) => l.customerId === customer.id)
  const states = [...new Set(mine.map((s) => data.pincodes[s.destPincode].state))].sort()
  const slaOf = (s: Shipment): SlaState => shipmentSla(data, s, now)

  const rows = useMemo(() => {
    const since = f.range === 'all' ? '' : istDate(addDays(now, -Number(f.range)))
    return mine.filter(
      (s) =>
        matchesSearch(data, s, f.q) &&
        // In Transit includes At Origin Hub, as on the dashboard tile (CP-11)
        (!f.status || s.status === f.status || (f.status === 'inTransit' && s.status === 'atOriginHub')) &&
        (!since || istDate(s.bookedAt) >= since) &&
        (!f.service || s.service === f.service) &&
        (!f.location || s.pickupLocationId === f.location) &&
        (!f.state || data.pincodes[s.destPincode].state === f.state) &&
        (!f.payment || s.paymentMode === f.payment) &&
        (!f.sla || shipmentSla(data, s, now) === f.sla) &&
        (!f.exceptions || hasException(data, s)),
    )
  }, [mine, data, f, now])

  const deliveredAt = (s: Shipment) => Object.values(data.events).find((e) => e.shipmentId === s.id && e.type === 'delivered')?.at
  const chosen = rows.filter((s) => selected.includes(s.id))
  const toggle = (id: string) => setSelected((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]))
  const allOn = rows.length > 0 && rows.every((s) => selected.includes(s.id))

  const columns: Column<Shipment>[] = [
    {
      key: 'sel',
      header: <Checkbox checked={allOn} onCheckedChange={(v) => setSelected(v ? rows.map((s) => s.id) : [])} aria-label={t('cp16.selectAll')} />,
      cell: (s) => <Checkbox checked={selected.includes(s.id)} onCheckedChange={() => toggle(s.id)} onClick={(e) => e.stopPropagation()} aria-label={t('cp16.select', { lr: s.id })} />,
    },
    {
      key: 'lr',
      header: t('cp16.col.lr'),
      sortValue: (s) => s.id,
      cell: (s) => (
        <Link to={`/customer/shipments/${s.id}`} className="tabular font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
          {s.id}
        </Link>
      ),
    },
    { key: 'booked', header: t('cp16.col.booked'), sortValue: (s) => s.bookedAt, cell: (s) => <span className="tabular whitespace-nowrap">{shortDate(s.bookedAt)}</span> },
    {
      key: 'consignee',
      header: t('cp16.col.consignee'),
      sortValue: (s) => data.consignees[s.consigneeId].company || data.consignees[s.consigneeId].contact,
      cell: (s) => {
        const c = data.consignees[s.consigneeId]
        return (
          <span>
            {c.company || c.contact}
            <span className="block text-caption text-muted-foreground">{data.pincodes[s.destPincode].city}</span>
          </span>
        )
      },
    },
    {
      key: 'pieces',
      header: t('cp16.col.piecesService'),
      cell: (s) => (
        <span className="tabular whitespace-nowrap">
          {`${s.pieces.length} / ${formatKg(s.weights.verifiedChargeable ?? s.weights.chargeable)}`}
          <span className="block text-caption text-muted-foreground">{t(`service.${s.service}`)}</span>
        </span>
      ),
    },
    { key: 'status', header: t('cp16.col.status'), sortValue: (s) => s.status, cell: (s) => <ShipmentStatusChip status={s.status} /> },
    {
      key: 'eta',
      header: t('cp16.col.eta'),
      sortValue: (s) => deliveredAt(s) ?? s.eta,
      cell: (s) => {
        const at = deliveredAt(s)
        return <span className="tabular whitespace-nowrap">{at ? t('cp16.deliveredOn', { date: shortDate(at) }) : shortDate(s.eta)}</span>
      },
    },
    { key: 'sla', header: t('cp16.col.sla'), cell: (s) => <SlaBadge state={slaOf(s)} now={now} /> },
    { key: 'amount', header: t('cp16.col.amount'), align: 'right', sortValue: (s) => s.price.total, cell: (s) => <span className="tabular">{formatINR(s.price.total)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">{t('cp16.actions')}</span>,
      cell: (s) => {
        const done = s.status === 'delivered' || s.status === 'deliveredWithException'
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('cp16.actionsFor', { lr: s.id })} onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(`/customer/shipments/${s.id}`)}>
                <Truck /> {t('cp16.track')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => printer.print('labels', [s])}>
                <Printer /> {t('cp16.printLabels')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => downloadDocuments(data, [s], t)}>
                <Download /> {t('cp16.downloadDocs')}
              </DropdownMenuItem>
              {canBook && (
                <DropdownMenuItem onSelect={() => navigate('/customer/book', { state: { repeat: s.id } })}>
                  <Repeat2 /> {t('cp16.bookAgain')}
                </DropdownMenuItem>
              )}
              {done && (
                <DropdownMenuItem disabled={!claimableIds.has(s.id)} onSelect={() => navigate(`/customer/claims/new?lr=${s.id}`)}>
                  <ShieldAlert /> {t('cp16.raiseClaim')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const markers: MapMarker[] = rows.map((s) => ({ ...shipmentPosition(data, s, now), id: s.id, tone: SHIPMENT_TONE[s.status], label: `${s.id} · ${t(`status.shipment.${s.status}`)}`, onClick: () => navigate(`/customer/shipments/${s.id}`) }))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('cp16.title')}
        subtitle={t('cp16.subtitle', { count: mine.length })}
        actions={
          <ToggleGroup type="single" variant="outline" value={view} onValueChange={(v) => v && setView(v as 'list' | 'map')} aria-label={t('cp16.view')}>
            <ToggleGroupItem value="list" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              <List /> {t('cp16.list')}
            </ToggleGroupItem>
            <ToggleGroupItem value="map" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
              <MapIcon /> {t('cp16.map')}
            </ToggleGroupItem>
          </ToggleGroup>
        }
        className="mb-0"
      />

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card" aria-label={t('cp16.filters')}>
        <label className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={f.q} onChange={(e) => set('q', e.target.value)} placeholder={t('cp16.searchPlaceholder')} aria-label={t('cp16.search')} className="pl-9" />
        </label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <NativeSelect aria-label={t('cp16.col.status')} value={f.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">{t('cp16.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.shipment.${s}`)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label={t('cp16.bookedDate')} value={f.range} onChange={(e) => set('range', e.target.value as Filters['range'])}>
            {RANGES.map((r) => (
              <option key={r} value={r}>
                {t(`cp16.range.${r}`)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label={t('cp16.col.service')} value={f.service} onChange={(e) => set('service', e.target.value)}>
            <option value="">{t('cp16.allServices')}</option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>
                {t(`service.${s}`)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label={t('cp16.payment')} value={f.payment} onChange={(e) => set('payment', e.target.value)}>
            <option value="">{t('cp16.allPayment')}</option>
            {PAYMENT.map((p) => (
              <option key={p} value={p}>
                {t(`payment.${p}`)}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label={t('cp16.location')} value={f.location} onChange={(e) => set('location', e.target.value)}>
            <option value="">{t('cp16.allLocations')}</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label={t('cp16.destState')} value={f.state} onChange={(e) => set('state', e.target.value)}>
            <option value="">{t('cp16.allStates')}</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label={t('cp16.col.sla')} value={f.sla} onChange={(e) => set('sla', e.target.value)}>
            <option value="">{t('cp16.allSla')}</option>
            {(['onTrack', 'atRisk', 'breached'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`slaState.${s}`)}
              </option>
            ))}
          </NativeSelect>
          <label className="flex items-center gap-2 text-body">
            <Switch checked={f.exceptions} onCheckedChange={(v) => set('exceptions', v)} aria-label={t('cp16.exceptionsOnly')} />
            {t('cp16.exceptionsOnly')}
          </label>
        </div>
      </section>

      {/* Bulk actions for selected rows */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption text-muted-foreground">{t('cp16.selected', { count: chosen.length, total: rows.length })}</span>
        <Button variant="outline" size="sm" disabled={!chosen.length} onClick={() => exportShipments(data, chosen, t)}>
          <FileSpreadsheet /> {t('cp16.export')}
        </Button>
        <Button variant="outline" size="sm" disabled={!chosen.length} onClick={() => printer.print('labels', chosen)}>
          <Printer /> {t('cp16.printLabels')}
        </Button>
        <Button variant="outline" size="sm" disabled={!chosen.length} onClick={() => downloadDocuments(data, chosen, t)}>
          <Download /> {t('cp16.downloadDocs')}
        </Button>
      </div>

      {view === 'list' ? (
        <DataTable rows={rows} columns={columns} rowKey={(s) => s.id} pageSize={25} onRowClick={(s) => navigate(`/customer/shipments/${s.id}`)} defaultSort={{ key: 'booked', dir: 'desc' }} />
      ) : (
        <MapView markers={markers} ariaLabel={t('cp16.mapLabel')} className="h-[520px]" />
      )}
      {printer.view}
    </div>
  )
}
