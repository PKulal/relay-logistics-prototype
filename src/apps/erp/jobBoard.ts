/**
 * ERP-05 Live job board — rows and filters. Pure functions over the shared data,
 * so the board updates live as the other apps act.
 */
import { routeStops } from '@shared/engines/position'
import { DONE_LEG, DONE_SHIPMENT, legSla, shipmentSla, type SlaState } from '@shared/engines/sla'
import { sortEvents } from '@shared/engines/status'
import type { DemoData, Id, IsoDateTime, Leg, LegStatus, Service, Shipment, ShipmentEvent, ShipmentStatus } from '@shared/types'

export interface BoardFilters {
  customerId: Id
  laneId: Id
  partnerId: Id
  hubId: Id
  /** Leg status (legs view) or shipment status (shipments view) */
  status: string
  service: Service | ''
  sla: SlaState | ''
  /** LR search (contains, case-insensitive) */
  q: string
  /** Show finished work too (delivered, cancelled, handed over, closed) */
  includeDone: boolean
}

export const NO_FILTERS: BoardFilters = { customerId: '', laneId: '', partnerId: '', hubId: '', status: '', service: '', sla: '', q: '', includeDone: false }

export interface LastEvent {
  event: ShipmentEvent
  /** Where it happened: a hub name, a city, or "origin → destination" for the lane */
  place: string
}

export interface LegRow {
  leg: Leg
  shipment: Shipment
  sla: SlaState
  last?: LastEvent
}

export interface ShipmentRow {
  shipment: Shipment
  sla: SlaState
  /** Leg in charge right now (first not yet done) */
  current?: Leg
  last?: LastEvent
}

/** Events per shipment, in time order (one pass over all events). */
export function eventsByShipment(data: DemoData): Map<Id, ShipmentEvent[]> {
  const map = new Map<Id, ShipmentEvent[]>()
  for (const e of Object.values(data.events)) {
    const list = map.get(e.shipmentId)
    if (list) list.push(e)
    else map.set(e.shipmentId, [e])
  }
  for (const [k, v] of map) map.set(k, sortEvents(v))
  return map
}

/** Where a leg's work happens, for the "last event" column. */
export function legPlace(data: DemoData, leg: Leg, s: Shipment): string {
  const origin = data.pincodes[s.originPincode]
  const dest = data.pincodes[s.destPincode]
  switch (leg.type) {
    case 'firstMile':
      return origin.city
    case 'originHub':
      return data.hubs[origin.hubId!]?.name ?? origin.city
    case 'lineHaul':
      return s.laneId ? `${data.lanes[s.laneId].originRegion} → ${data.lanes[s.laneId].destRegion}` : `${origin.city} → ${dest.city}`
    case 'destHub':
      return data.hubs[dest.hubId!]?.name ?? dest.city
    case 'lastMile':
      return dest.city
  }
}

function lastOf(data: DemoData, events: ShipmentEvent[], s: Shipment, legId?: Id): LastEvent | undefined {
  const list = legId ? events.filter((e) => e.legId === legId) : events
  const event = list.at(-1)
  if (!event) return undefined
  const leg = event.legId ? data.legs[event.legId] : undefined
  return { event, place: leg ? legPlace(data, leg, s) : data.pincodes[s.originPincode].city }
}

/** Shipment-level filters shared by both views. */
function matchesShipment(data: DemoData, s: Shipment, f: BoardFilters): boolean {
  if (f.customerId && s.customerId !== f.customerId) return false
  if (f.laneId && s.laneId !== f.laneId) return false
  if (f.service && s.service !== f.service) return false
  if (f.q && !s.id.toLowerCase().includes(f.q.trim().toLowerCase())) return false
  if (f.partnerId && !s.legIds.some((id) => data.legs[id].partnerId === f.partnerId)) return false
  if (f.hubId) {
    const hubs = [data.pincodes[s.originPincode].hubId, data.pincodes[s.destPincode].hubId]
    const passes = routeStops(data, s).some((st) => (st.kind === 'originHub' && hubs[0] === f.hubId) || (st.kind === 'destHub' && hubs[1] === f.hubId))
    if (!passes) return false
  }
  return true
}

export function legRows(data: DemoData, f: BoardFilters, now: IsoDateTime): LegRow[] {
  const events = eventsByShipment(data)
  const rows: LegRow[] = []
  for (const s of Object.values(data.shipments)) {
    if (!matchesShipment(data, s, f)) continue
    if (!f.includeDone && DONE_SHIPMENT.includes(s.status)) continue
    for (const id of s.legIds) {
      const leg = data.legs[id]
      if (!f.includeDone && DONE_LEG.includes(leg.status)) continue
      if (f.partnerId && leg.partnerId !== f.partnerId) continue
      if (f.status && leg.status !== (f.status as LegStatus)) continue
      const sla = legSla(leg, now)
      if (f.sla && sla !== f.sla) continue
      rows.push({ leg, shipment: s, sla, last: lastOf(data, events.get(s.id) ?? [], s, leg.id) })
    }
  }
  return rows
}

export function shipmentRows(data: DemoData, f: BoardFilters, now: IsoDateTime): ShipmentRow[] {
  const events = eventsByShipment(data)
  const rows: ShipmentRow[] = []
  for (const s of Object.values(data.shipments)) {
    if (!matchesShipment(data, s, f)) continue
    if (!f.includeDone && DONE_SHIPMENT.includes(s.status)) continue
    if (f.status && s.status !== (f.status as ShipmentStatus)) continue
    const sla = shipmentSla(data, s, now)
    if (f.sla && sla !== f.sla) continue
    rows.push({ shipment: s, sla, current: s.legIds.map((id) => data.legs[id]).find((l) => !DONE_LEG.includes(l.status)), last: lastOf(data, events.get(s.id) ?? [], s) })
  }
  return rows
}

/** Sort order for SLA columns: breached first. */
export const SLA_ORDER: Record<SlaState, number> = { breached: 0, atRisk: 1, onTrack: 2, done: 3 }
