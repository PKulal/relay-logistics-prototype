import type { DemoData, Leg } from '@shared/types'

/** Delivery slot: the booked appointment, else the leg window. */
export function slotOf(data: DemoData, leg: Leg): { from: string; to: string; appointment: boolean } {
  const a = data.shipments[leg.shipmentId].appointment
  if (a?.confirmed && a.from && a.to) return { from: a.from, to: a.to, appointment: true }
  return { from: leg.window.from.slice(11, 16), to: leg.window.to.slice(11, 16), appointment: false }
}
