/**
 * Partner App personal views: PA-09 My day (source §5.2 KPIs: on-time, scan
 * compliance), PA-10 training content (source §4 Step 6), PA-13 sync queue
 * figures (source §5.1 offline).
 */
import { addDaysToDate, istDate } from '@shared/lib/time'
import type { DemoData, EventType, FieldRole, FieldStaff, Id, IsoDate, IsoDateTime, ShipmentEvent } from '@shared/types'
import { cashInHand } from './receivables'

const DONE = new Set(['handedOver', 'delivered', 'closed'])

/** When each of the staff member's legs was finished (last event on a finished leg). */
function doneAt(data: DemoData, staffId: Id): Map<Id, IsoDateTime> {
  const out = new Map<Id, IsoDateTime>()
  for (const e of Object.values(data.events)) {
    const l = e.legId ? data.legs[e.legId] : undefined
    if (l && l.staffId === staffId && DONE.has(l.status) && (out.get(l.id) ?? '') < e.at) out.set(l.id, e.at)
  }
  return out
}

/** Hand-over moments that need scans (and, for pickup and delivery, photos). */
const HANDOVERS: EventType[] = ['pickupConfirmed', 'handoverGiven', 'handoverReceived', 'hubInScan', 'hubOutScan', 'delivered']
const NEEDS_PHOTO: EventType[] = ['pickupConfirmed', 'delivered']

export const compliant = (e: ShipmentEvent) => (e.pieceIds?.length ?? 0) > 0 && (!NEEDS_PHOTO.includes(e.type) || (e.photos?.length ?? 0) > 0)

const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r)
  const y = (b.lat - a.lat) * r
  return Math.sqrt(x * x + y * y) * 6371
}

/** Monday of the week that holds `date`. */
const mondayOf = (date: IsoDate) => {
  const d = new Date(`${date}T12:00:00+05:30`).getUTCDay()
  return addDaysToDate(date, -((d + 6) % 7))
}

export interface MyDay {
  done: number
  onTimePct?: number
  failed: number
  /** SIMULATED GPS: straight-line distance between today's scan points */
  distanceKm: number
  /** Share of today's hand-overs with all scans and photos; undefined with no hand-overs */
  compliancePct?: number
  codInHand: number
  week: { date: IsoDate; done: number }[]
}

export function myDay(data: DemoData, staffId: Id, now: IsoDateTime): MyDay {
  const today = istDate(now)
  const finished = doneAt(data, staffId)
  const todayLegs = [...finished].filter(([, at]) => istDate(at) === today)
  const onTime = todayLegs.filter(([id, at]) => at <= data.legs[id].window.to).length
  const mine = Object.values(data.events)
    .filter((e) => e.by === staffId && istDate(e.at) === today)
    .sort((a, b) => a.at.localeCompare(b.at))
  const failed = mine.filter((e) => e.type === 'pickupFailed' || e.type === 'deliveryFailed').length
  const points = mine.filter((e) => e.lat != null && e.lng != null) as (ShipmentEvent & { lat: number; lng: number })[]
  const distanceKm = Math.round(points.slice(1).reduce((s, p, i) => s + km(points[i], p), 0) * 10) / 10
  const handovers = mine.filter((e) => HANDOVERS.includes(e.type))
  const monday = mondayOf(today)
  const week = Array.from({ length: 7 }, (_, i) => addDaysToDate(monday, i)).map((date) => ({ date, done: [...finished.values()].filter((at) => istDate(at) === date).length }))
  return {
    done: todayLegs.length,
    onTimePct: todayLegs.length ? Math.round((onTime / todayLegs.length) * 100) : undefined,
    failed,
    distanceKm,
    compliancePct: handovers.length ? Math.round((handovers.filter(compliant).length / handovers.length) * 100) : undefined,
    codInHand: cashInHand(data, staffId).reduce((s, r) => s + r.amount, 0),
    week,
  }
}

// ── PA-10 training ──────────────────────────────────────────────────────────

export type VideoId = 'scan' | 'handover' | 'delivery' | 'failed' | 'cod' | 'trip' | 'bags'
export type PracticeStep = 'scan' | 'photo' | 'code' | 'seal' | 'otp' | 'sign'
export interface PracticeTask {
  id: 'pickup' | 'handover' | 'delivery' | 'tripReceive' | 'hubInScan' | 'hubBag'
  steps: PracticeStep[]
}

export const VIDEOS: Record<FieldRole, VideoId[]> = {
  rider: ['scan', 'handover', 'delivery', 'failed', 'cod'],
  driver: ['scan', 'handover', 'trip'],
  hub: ['scan', 'handover', 'bags'],
}

export const PRACTICE: Record<FieldRole, PracticeTask[]> = {
  rider: [
    { id: 'pickup', steps: ['scan', 'photo'] },
    { id: 'handover', steps: ['scan', 'code'] },
    { id: 'delivery', steps: ['scan', 'otp', 'sign'] },
  ],
  driver: [
    { id: 'tripReceive', steps: ['seal', 'code'] },
    { id: 'handover', steps: ['seal', 'code'] },
  ],
  hub: [
    { id: 'hubInScan', steps: ['scan', 'photo'] },
    { id: 'hubBag', steps: ['scan', 'seal'] },
  ],
}

/** Dummy shipment used by every practice task; nothing is sent to customers. */
export const PRACTICE_PIECES = ['PRACTICE-0001-01', 'PRACTICE-0001-02']
export const PRACTICE_SEAL = 'SEAL-PRACTICE-77'
export const PRACTICE_CODE = '4826'

export function trainingStatus(s: FieldStaff): 'done' | 'inProgress' | 'notStarted' {
  if (s.trained) return 'done'
  const t = s.training
  return t && (t.videos.length || t.practice.length) ? 'inProgress' : 'notStarted'
}

/** Mark complete after all practice tasks pass (PA-10). */
export const canCompleteTraining = (s: FieldStaff) => PRACTICE[s.role].every((p) => s.training?.practice.includes(p.id))

// ── PA-13 ───────────────────────────────────────────────────────────────────

/** Photos kept on the phone: ~0.6 MB each (assumed); synced photos cleared after 7 days (assumed). */
export const PHOTO_MB = 0.6
export const APP_VERSION = 'v1.0.0'

export function storageMb(data: DemoData, staffId: Id, now: IsoDateTime): number {
  const since = addDaysToDate(istDate(now), -7)
  const photos = Object.values(data.events)
    .filter((e) => e.by === staffId && istDate(e.at) >= since)
    .reduce((s, e) => s + (e.photos?.length ?? 0), 0)
  return Math.round((12 + photos * PHOTO_MB) * 10) / 10
}

export const queueOf = (data: DemoData, staffId: Id) =>
  Object.values(data.syncQueue)
    .filter((q) => q.staffId === staffId)
    .sort((a, b) => a.savedAt.localeCompare(b.savedAt))
