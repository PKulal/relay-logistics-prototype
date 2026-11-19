/**
 * Partner Portal job actions (PP-12 to PP-14) as pure state changes.
 * Every change is a chain-of-custody event, so statuses follow the status engine.
 */
import type { DemoData, Id, IsoDateTime, ShipmentEvent } from '@shared/types'
import { applyEvents } from './actions'
import { eventIdFactory } from './booking'

function legEvents(data: DemoData, legIds: Id[], make: (legId: Id) => Omit<ShipmentEvent, 'id' | 'shipmentId' | 'legId'>): ShipmentEvent[] {
  const factories = new Map<Id, () => string>()
  return legIds.map((legId) => {
    const shipmentId = data.legs[legId].shipmentId
    if (!factories.has(shipmentId)) factories.set(shipmentId, eventIdFactory(data, shipmentId))
    return { id: factories.get(shipmentId)!(), shipmentId, legId, ...make(legId) }
  })
}

/** Accept offered jobs (single or bulk). Jobs no longer offered are skipped. */
export function acceptLegs(data: DemoData, legIds: Id[], userId: Id, now: IsoDateTime): DemoData {
  const offered = legIds.filter((id) => data.legs[id]?.status === 'offered')
  return applyEvents(data, legEvents(data, offered, () => ({ type: 'legAccepted', at: now, by: userId, app: 'partnerPortal' })), now)
}

export type FlagReason = 'pincodeNotServed' | 'capacityFull' | 'noVehicle' | 'holiday' | 'other'

/** Flag a job as not serviceable: it goes back to Logisco for reassignment. */
export function flagLeg(data: DemoData, legId: Id, reason: FlagReason, remark: string, userId: Id, now: IsoDateTime): DemoData {
  if (!['offered', 'accepted'].includes(data.legs[legId]?.status)) return data
  return applyEvents(data, legEvents(data, [legId], () => ({ type: 'legFlagged', at: now, by: userId, app: 'partnerPortal', reason, note: remark || undefined })), now)
}

/**
 * Assign accepted (or reassign assigned) jobs to a staff member. The staff member
 * gets a Partner App notification for each job.
 */
export function assignLegs(data: DemoData, legIds: Id[], staffId: Id, vehicleId: Id | undefined, userId: Id, now: IsoDateTime): DemoData {
  const ok = legIds.filter((id) => ['accepted', 'assigned'].includes(data.legs[id]?.status))
  if (ok.length === 0) return data
  let next = applyEvents(
    data,
    legEvents(data, ok, () => ({ type: 'legAssigned', at: now, by: userId, app: 'partnerPortal', assigneeStaffId: staffId, assigneeVehicleId: vehicleId })),
    now,
  )
  const notifications = { ...next.notifications }
  let n = Object.keys(notifications).length
  for (const id of ok) {
    const nid = `NTF-${String(++n).padStart(5, '0')}`
    notifications[nid] = {
      id: nid,
      audience: { app: 'partnerApp', userId: staffId },
      title: id,
      body: data.legs[id].shipmentId,
      link: `/app/tasks/${id}`,
      at: now,
      read: false,
    }
  }
  next = { ...next, notifications }
  return next
}

/** Take a job off its staff member: back to Accepted. */
export function unassignLeg(data: DemoData, legId: Id, userId: Id, now: IsoDateTime): DemoData {
  if (data.legs[legId]?.status !== 'assigned') return data
  return applyEvents(data, legEvents(data, [legId], () => ({ type: 'legUnassigned', at: now, by: userId, app: 'partnerPortal' })), now)
}

export type ProblemKind = 'breakdown' | 'vehicleDelay' | 'consigneeIssue' | 'damageFound' | 'other'

/** PP-13 "Report a problem": raises a support ticket linked to the shipment. */
export function reportProblem(data: DemoData, legId: Id, kind: ProblemKind, text: string, userId: Id, now: IsoDateTime): DemoData {
  const leg = data.legs[legId]
  if (!leg) return data
  const id = `TKT-${String(Object.keys(data.tickets).length + 1).padStart(5, '0')}`
  return {
    ...data,
    tickets: {
      ...data.tickets,
      [id]: { id, raisedBy: userId, app: 'partnerPortal', category: kind, subject: `${legId}: ${kind}`, shipmentId: leg.shipmentId, status: 'open', thread: [{ at: now, by: userId, text }] },
    },
  }
}
