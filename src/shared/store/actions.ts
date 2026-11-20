/**
 * Pure state transitions used by the store. Kept separate from Zustand so they
 * can be unit-tested and reused by the seed generator.
 */
import { deriveStatus, sortEvents } from '@shared/engines/status'
import type { DemoData, Id, IsoDateTime, ShipmentEvent } from '@shared/types'

/**
 * Add chain-of-custody events and re-derive the status of every shipment they
 * touch. This is the only way shipment and leg statuses change (CLAUDE.md rule 2).
 * Returns a new DemoData; the input is not mutated.
 */
export function applyEvents(data: DemoData, newEvents: ShipmentEvent[], now: IsoDateTime): DemoData {
  if (newEvents.length === 0) return data

  const events = { ...data.events }
  for (const ev of newEvents) {
    if (!data.shipments[ev.shipmentId]) throw new Error(`Event ${ev.id}: unknown shipment ${ev.shipmentId}`)
    if (ev.legId && !data.legs[ev.legId]) throw new Error(`Event ${ev.id}: unknown leg ${ev.legId}`)
    events[ev.id] = ev
  }

  const touched = new Set(newEvents.map((e) => e.shipmentId))
  const shipments = { ...data.shipments }
  const legs = { ...data.legs }

  // One pass over all events, grouped by the shipments we need to re-derive.
  const byShipment = new Map<Id, ShipmentEvent[]>([...touched].map((id) => [id, []]))
  for (const e of Object.values(events)) byShipment.get(e.shipmentId)?.push(e)

  for (const shipmentId of touched) {
    const shipment = shipments[shipmentId]
    const shipmentLegs = shipment.legIds.map((id) => legs[id])
    const shipmentEvents = byShipment.get(shipmentId)!
    const result = deriveStatus({ legs: shipmentLegs, events: shipmentEvents })

    if (shipment.status !== result.shipmentStatus) {
      shipments[shipmentId] = { ...shipment, status: result.shipmentStatus, updatedAt: now }
    }
    // Who holds each leg also comes from events: the latest legAssigned wins; a later
    // legUnassigned, or a legWithdrawn (ERP-08 reassign to another partner), clears it.
    const assigned = new Map<Id, ShipmentEvent | null>()
    for (const e of sortEvents(shipmentEvents)) {
      if (e.legId && e.type === 'legAssigned') assigned.set(e.legId, e)
      if (e.legId && (e.type === 'legUnassigned' || e.type === 'legWithdrawn')) assigned.set(e.legId, null)
    }

    for (const leg of shipmentLegs) {
      const status = result.legStatuses[leg.id]
      const a = assigned.get(leg.id)
      const staffId = a === null ? undefined : (a?.assigneeStaffId ?? leg.staffId)
      const vehicleId = a === null ? undefined : (a?.assigneeVehicleId ?? leg.vehicleId)
      if (leg.status !== status || leg.staffId !== staffId || leg.vehicleId !== vehicleId) {
        legs[leg.id] = { ...leg, status, staffId, vehicleId, updatedAt: now }
      }
    }
  }

  return { ...data, events, shipments, legs }
}

/** Where a city code's LR serials start when it has no counter yet (Delhi is seeded at 781 for the hero). */
export const NEW_CODE_START_SERIAL = 900

/**
 * Next free LR for an origin code, e.g. ("DEL") → "LGS-DEL-000781".
 * Serials are unique across ALL codes, because job ids carry only the serial
 * (JOB-000781-L1): a serial already used by any shipment is skipped.
 * Returns the LR and the updated serial counters.
 */
export function nextLr(data: DemoData, originCode: string, reserved?: string): { lr: Id; lrSerials: DemoData['lrSerials'] } {
  const used = new Set(Object.keys(data.shipments).map((id) => id.slice(-6)))
  const start = data.lrSerials[originCode] ?? NEW_CODE_START_SERIAL
  let serial = start
  while (used.has(String(serial).padStart(6, '0'))) serial += 1
  // A reserved serial (the hero LR) is skipped without moving the counter past it
  if (reserved && String(serial).padStart(6, '0') === reserved) {
    let other = serial + 1
    while (used.has(String(other).padStart(6, '0'))) other += 1
    return { lr: `LGS-${originCode}-${String(other).padStart(6, '0')}`, lrSerials: { ...data.lrSerials, [originCode]: serial } }
  }
  return { lr: `LGS-${originCode}-${String(serial).padStart(6, '0')}`, lrSerials: { ...data.lrSerials, [originCode]: serial + 1 } }
}
