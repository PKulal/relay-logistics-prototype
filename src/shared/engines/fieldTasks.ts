/**
 * Partner App tasks (PA-05 Home, PA-06 Task list). A task is a leg seen from
 * the field staff member doing it.
 */
import { istDate } from '@shared/lib/time'
import type { DemoData, FieldStaff, Id, IsoDateTime, Leg, Shipment } from '@shared/types'
import { jobSpecials, type Special } from './partnerJobs'
import { legSla, type SlaState } from './sla'

export type TaskKind = 'pickup' | 'handover' | 'receive' | 'trip' | 'hub' | 'delivery'
export type TaskState = 'todo' | 'inProgress' | 'done' | 'failed'
export const TASK_STATES: TaskState[] = ['todo', 'inProgress', 'done', 'failed']

export interface Task {
  leg: Leg
  shipment: Shipment
  kind: TaskKind
  state: TaskState
  sla: SlaState
  /** Shipper / consignee / hub name and area */
  place: string
  tags: Special[]
  /** Unread "New" assignment notification ids */
  newNotificationIds: Id[]
}

function stateOf(leg: Leg): TaskState {
  switch (leg.status) {
    case 'assigned':
      return 'todo'
    case 'inProgress':
      return 'inProgress'
    case 'exception':
      // A failed pickup is failed; a line-haul halt or seal issue is still in progress
      return leg.type === 'firstMile' ? 'failed' : 'inProgress'
    case 'failedAttempt':
      return 'failed'
    default:
      return 'done'
  }
}

/** The leg before this one in its shipment, if any. */
export function prevLegOf(data: DemoData, leg: Leg): Leg | undefined {
  const ids = data.shipments[leg.shipmentId].legIds
  const i = ids.indexOf(leg.id)
  return i > 0 ? data.legs[ids[i - 1]] : undefined
}

/** The leg after this one in its shipment, if any. */
export function nextLegOf(data: DemoData, leg: Leg): Leg | undefined {
  const ids = data.shipments[leg.shipmentId].legIds
  const i = ids.indexOf(leg.id)
  return i >= 0 && i < ids.length - 1 ? data.legs[ids[i + 1]] : undefined
}

/** A hub job whose goods are on their way in: the staff member's job is to receive them (PA-20). */
export function isReceive(data: DemoData, leg: Leg): boolean {
  return (leg.type === 'originHub' || leg.type === 'destHub' || leg.type === 'lineHaul') && leg.status === 'assigned' && underWay(prevLegOf(data, leg))
}

/** The leg before is moving the goods: in progress, or a truck still going after a halt or breakdown was flagged. */
export function underWay(leg: Leg | undefined): boolean {
  return !!leg && (leg.status === 'inProgress' || (leg.status === 'exception' && leg.type !== 'firstMile'))
}

function kindOf(data: DemoData, leg: Leg): TaskKind {
  switch (leg.type) {
    case 'firstMile':
      // After pickup the rider's job is to hand the goods to the hub
      return leg.status === 'inProgress' ? 'handover' : 'pickup'
    case 'lineHaul':
      return isReceive(data, leg) ? 'receive' : 'trip'
    case 'originHub':
    case 'destHub':
      return isReceive(data, leg) ? 'receive' : 'hub'
    case 'lastMile':
      return 'delivery'
  }
}

function placeOf(data: DemoData, leg: Leg, s: Shipment): string {
  const origin = data.pincodes[s.originPincode]
  const dest = data.pincodes[s.destPincode]
  switch (kindOf(data, leg)) {
    case 'pickup': {
      return `${data.customers[s.customerId].shortName}, ${origin.area}`
    }
    case 'handover':
      return data.hubs[origin.hubId!]?.name ?? origin.city
    case 'trip':
      return `${data.hubs[origin.hubId!]?.name ?? origin.city} → ${data.hubs[dest.hubId!]?.name ?? dest.city}`
    case 'receive': {
      const prev = prevLegOf(data, leg)!
      return `${data.partners[prev.partnerId].shortName} → ${data.hubs[(leg.type === 'destHub' ? dest : origin).hubId!]?.name ?? ''}`
    }
    case 'hub':
      return s.legIds.indexOf(leg.id) <= 1 ? `${origin.city} → ${dest.city}` : `${dest.city}`
    case 'delivery': {
      const c = data.consignees[s.consigneeId]
      return `${c.company || c.contact}, ${dest.area}`
    }
  }
}

/**
 * Today's tasks for one staff member: everything to do up to today, anything in
 * progress, and what was finished or failed today. Sorted to-do first by window.
 */
export function tasksFor(data: DemoData, staffId: Id, now: IsoDateTime): Task[] {
  const today = istDate(now)
  const unread = Object.values(data.notifications).filter((n) => n.audience.app === 'partnerApp' && n.audience.userId === staffId && !n.read)
  const mine = Object.values(data.legs).filter((l) => l.staffId === staffId)
  // When each of my legs last changed, from its events (leg.updatedAt is the time the
  // record was written, which for seeded data is the seed time, not the work time)
  const lastAt = new Map<Id, IsoDateTime>()
  const ids = new Set(mine.map((l) => l.id))
  for (const e of Object.values(data.events)) {
    if (e.legId && ids.has(e.legId) && (!lastAt.has(e.legId) || e.at > lastAt.get(e.legId)!)) lastAt.set(e.legId, e.at)
  }
  const tasks: Task[] = []
  for (const leg of mine) {
    const state = stateOf(leg)
    const day = istDate(leg.window.from)
    if (state === 'todo' && day > today && leg.type !== 'lineHaul') continue // future work shows on its day
    if ((state === 'done' || state === 'failed') && istDate(lastAt.get(leg.id) ?? leg.updatedAt) !== today) continue
    const s = data.shipments[leg.shipmentId]
    tasks.push({
      leg,
      shipment: s,
      kind: kindOf(data, leg),
      state,
      sla: legSla(leg, now),
      place: placeOf(data, leg, s),
      tags: jobSpecials(data, leg, s),
      newNotificationIds: unread.filter((n) => n.title === leg.id).map((n) => n.id),
    })
  }
  const order: Record<TaskState, number> = { inProgress: 0, todo: 1, failed: 2, done: 3 }
  return tasks.sort((a, b) => order[a.state] - order[b.state] || a.leg.window.from.localeCompare(b.leg.window.from))
}

/** The most urgent open task (PA-05 "Next task"). */
export const nextTask = (tasks: Task[]) => tasks.find((t) => t.state === 'inProgress' || t.state === 'todo')

/** Straight-line distance in km (haversine). */
export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10
}

/**
 * SIMULATED distance for a task card: straight line from the staff member's
 * home area (the hub their partner serves) to the task's place. No live GPS yet.
 */
export function taskDistance(data: DemoData, staff: FieldStaff, task: Task): number | undefined {
  const s = task.shipment
  const origin = data.pincodes[s.originPincode]
  const dest = data.pincodes[s.destPincode]
  const homeHubId = staff.hubId ?? (task.kind === 'delivery' ? dest.hubId : origin.hubId)
  const home = homeHubId ? data.pincodes[data.hubs[homeHubId].pincode] : undefined
  const target = task.kind === 'pickup' ? data.pickupLocations[s.pickupLocationId] : task.kind === 'delivery' ? dest : undefined
  return home && target ? km(home, target) : undefined
}

/** PA-05 rider tiles: pickups and deliveries to do / done today, and failed. */
export function riderCounts(tasks: Task[]) {
  const n = (kind: TaskKind[], states: TaskState[]) => tasks.filter((t) => kind.includes(t.kind) && states.includes(t.state)).length
  return {
    pickupsTodo: n(['pickup'], ['todo']),
    pickupsDone: n(['pickup', 'handover'], ['inProgress', 'done']),
    deliveriesTodo: n(['delivery'], ['todo', 'inProgress']),
    deliveriesDone: n(['delivery'], ['done']),
    failed: tasks.filter((t) => t.state === 'failed').length,
  }
}
