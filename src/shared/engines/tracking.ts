/**
 * What the customer and the consignee see of a shipment (CP-16, CP-17, CP-18):
 * one status track, a scan timeline with places but no partner names (source
 * §2 "one tracking number however many partners"), documents and the e-POD.
 */
import type { DemoData, ExceptionKind, Id, IsoDateTime, Shipment, ShipmentEvent, ShipmentStatus } from '@shared/types'

/** Source §7.1 status track. */
export const STATUS_TRACK: ShipmentStatus[] = ['booked', 'pickedUp', 'atOriginHub', 'inTransit', 'atDestinationHub', 'outForDelivery', 'delivered']

/** Step reached on the track (exception statuses map onto it). */
export function trackStep(status: ShipmentStatus): number {
  switch (status) {
    case 'deliveredWithException':
      return 6
    case 'undelivered':
      return 5
    case 'returnToOrigin':
    case 'cancelled':
      return 0
    default:
      return Math.max(0, STATUS_TRACK.indexOf(status))
  }
}

/** Events a customer sees; partner-internal job events (offers, assignments, payouts) stay hidden. */
const CUSTOMER_EVENTS: ShipmentEvent['type'][] = [
  'booked',
  'pickupConfirmed',
  'pickupFailed',
  'weightRevised',
  'handoverReceived',
  'hubInScan',
  'bagSealed',
  'tripStarted',
  'haltReported',
  'tripArrived',
  'runStarted',
  'delivered',
  'deliveryFailed',
  'reattemptScheduled',
  'exceptionReported',
  'rtoInitiated',
  'cancelled',
]

export interface TimelineEntry {
  id: Id
  at: IsoDateTime
  /** i18n key under cp17.ev */
  kind: string
  /** City or hub city; never a partner name */
  place: string
  pieces?: number
  exceptionKind?: ExceptionKind
  note?: string
}

/** Newest first. */
export function customerTimeline(data: DemoData, s: Shipment): TimelineEntry[] {
  const origin = data.pincodes[s.originPincode]
  const dest = data.pincodes[s.destPincode]
  const hubCity = (hubId?: Id) => (hubId && data.hubs[hubId] ? data.pincodes[data.hubs[hubId].pincode].city : undefined)
  const originHub = hubCity(origin.hubId) ?? origin.city
  const destHub = hubCity(dest.hubId) ?? dest.city
  return Object.values(data.events)
    .filter((e) => e.shipmentId === s.id && CUSTOMER_EVENTS.includes(e.type))
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id))
    .flatMap((e): TimelineEntry[] => {
      const leg = e.legId ? data.legs[e.legId] : undefined
      const where = (() => {
        switch (leg?.type) {
          case 'firstMile':
            return origin.city
          case 'originHub':
            return originHub
          case 'lineHaul':
            return e.type === 'tripArrived' ? destHub : e.type === 'haltReported' ? '' : originHub
          case 'destHub':
            return destHub
          case 'lastMile':
            return e.type === 'handoverReceived' ? destHub : dest.city
          default:
            return origin.city
        }
      })()
      // A hand-over received is a hub arrival, loading on the truck, or the delivery agent taking it
      const kind = e.type === 'handoverReceived' ? (leg?.type === 'lineHaul' ? 'loaded' : leg?.type === 'lastMile' ? 'withAgent' : 'atHub') : e.type
      // Only the line-haul hand-over is shown once; the hub in-scan right after says the same
      if (e.type === 'hubInScan') return []
      return [{ id: e.id, at: e.at, kind, place: where, pieces: e.pieceIds?.length, exceptionKind: e.exceptionKind, note: e.type === 'delivered' ? e.receivedBy : undefined }]
    })
}

/** ETA moved after a truck delay (AI delay estimate, source §7 Step 6). */
export const etaRevised = (data: DemoData, s: Shipment) => Object.values(data.events).some((e) => e.shipmentId === s.id && e.type === 'haltReported' && e.etaAtRisk)

export interface ShipmentDoc {
  key: 'lr' | 'labels' | 'ewb' | 'invoice' | 'pickupPhotos' | 'epod' | 'grn' | 'deliveryPhotos'
  /** Short detail line, e.g. the EWB number */
  detail?: string
  /** Number of photos, for photo sets */
  count?: number
}

/** Source §7.2 Document Centre: LR, label, e-way bill, invoices, e-POD, GRN, photos. */
export function shipmentDocs(data: DemoData, s: Shipment): ShipmentDoc[] {
  const ev = (type: ShipmentEvent['type']) => Object.values(data.events).filter((e) => e.shipmentId === s.id && e.type === type)
  const picked = ev('pickupConfirmed').at(-1)
  const delivered = ev('delivered').at(-1)
  const docs: ShipmentDoc[] = [
    { key: 'lr', detail: s.id },
    { key: 'labels', count: s.pieces.length },
  ]
  if (s.ewb) docs.push({ key: 'ewb', detail: s.ewb.no })
  if (s.invoice.fileUrl) docs.push({ key: 'invoice', detail: s.invoice.fileUrl })
  if (picked?.photos?.length) docs.push({ key: 'pickupPhotos', count: picked.photos.length })
  if (delivered) docs.push({ key: 'epod', detail: delivered.receivedBy })
  if (delivered?.grn) docs.push({ key: 'grn', detail: delivered.grn })
  if (delivered?.photos?.length) docs.push({ key: 'deliveryPhotos', count: delivered.photos.length })
  return docs
}

/** Proof of delivery (CP-17 tab 5): the delivered event and any short / damaged pieces at delivery. */
export function proofOfDelivery(data: DemoData, s: Shipment) {
  const events = Object.values(data.events).filter((e) => e.shipmentId === s.id)
  const delivered = events.filter((e) => e.type === 'delivered').at(-1)
  if (!delivered) return undefined
  const lastMile = delivered.legId
  const issues = events
    .filter((e) => e.type === 'exceptionReported' && e.legId === lastMile && (e.exceptionKind === 'short' || e.exceptionKind === 'damage'))
    .flatMap((e) => (e.pieceIds ?? []).map((p, i) => ({ pieceId: p, kind: e.exceptionKind!, photo: e.photos?.[i], remark: e.note?.split('; ').find((n) => n.startsWith(p.slice(-2)))?.slice(4) })))
  return { delivered, issues, cod: data.codRecords ? Object.values(data.codRecords).find((c) => c.shipmentId === s.id) : undefined }
}

/** Universal search (source §7.2): LR, AWB, invoice no., PO no., consignee name or mobile. */
export function matchesSearch(data: DemoData, s: Shipment, q: string): boolean {
  const needle = q.trim().toLowerCase().replace(/\s+/g, '')
  if (!needle) return true
  const c = data.consignees[s.consigneeId]
  const hay = [s.id, s.invoice.no, s.invoice.po ?? '', c?.company ?? '', c?.contact ?? '', c?.mobile ?? ''].map((x) => x.toLowerCase().replace(/\s+/g, ''))
  return hay.some((h) => h.includes(needle))
}
