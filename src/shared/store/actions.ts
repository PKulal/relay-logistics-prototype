/**
 * Pure state transitions used by the store. Kept separate from Zustand so they
 * can be unit-tested and reused by the seed generator.
 */
import { deriveStatus } from '@shared/engines/status'
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

  for (const shipmentId of touched) {
    const shipment = shipments[shipmentId]
    const shipmentLegs = shipment.legIds.map((id) => legs[id])
    const shipmentEvents = Object.values(events).filter((e) => e.shipmentId === shipmentId)
    const result = deriveStatus({ legs: shipmentLegs, events: shipmentEvents })

    if (shipment.status !== result.shipmentStatus) {
      shipments[shipmentId] = { ...shipment, status: result.shipmentStatus, updatedAt: now }
    }
    for (const leg of shipmentLegs) {
      const status = result.legStatuses[leg.id]
      if (leg.status !== status) legs[leg.id] = { ...leg, status, updatedAt: now }
    }
  }

  return { ...data, events, shipments, legs }
}

/**
 * Next free LR for an origin code, e.g. ("DEL") → "LGS-DEL-000781".
 * Skips serials already taken by seeded shipments (000784, 000790 …).
 * Returns the LR and the updated serial counters.
 */
export function nextLr(data: DemoData, originCode: string): { lr: Id; lrSerials: DemoData['lrSerials'] } {
  let serial = data.lrSerials[originCode] ?? 1
  const make = (s: number) => `LGS-${originCode}-${String(s).padStart(6, '0')}`
  while (data.shipments[make(serial)]) serial += 1
  return { lr: make(serial), lrSerials: { ...data.lrSerials, [originCode]: serial + 1 } }
}
