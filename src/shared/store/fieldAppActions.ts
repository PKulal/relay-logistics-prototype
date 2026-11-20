/**
 * Partner App personal actions: PA-10 training, PA-13 settings and the
 * offline sync queue (source §5.1: works offline, syncs when connected).
 *
 * SIMULATED offline: the demo applies field work to the shared data at once so
 * the other apps keep moving; while the phone is "offline" each new Partner
 * App event is also listed in the phone's sync queue until it is sent.
 */
import { canCompleteTraining, PRACTICE, VIDEOS } from '@shared/engines/fieldDay'
import type { DemoData, FieldStaff, Id, IsoDateTime, Notification, SyncItem } from '@shared/types'

const notify = (data: DemoData, audience: Notification['audience'], title: string, body: string, link: string, at: IsoDateTime): DemoData => {
  const id = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  return { ...data, notifications: { ...data.notifications, [id]: { id, audience, title, body, link, at, read: false } } }
}
const setStaff = (data: DemoData, s: FieldStaff): DemoData => ({ ...data, fieldStaff: { ...data.fieldStaff, [s.id]: s } })

// ── PA-13 sync queue ────────────────────────────────────────────────────────

/** Events the Partner App added between `prev` and `next` go into the sync queue (called while offline). */
export function queueOfflineEvents(prev: DemoData, next: DemoData, at: IsoDateTime): DemoData {
  const queued = new Set(Object.values(next.syncQueue).map((q) => q.eventId))
  const added = Object.values(next.events).filter((e) => !prev.events[e.id] && !queued.has(e.id) && e.app === 'partnerApp' && next.fieldStaff[e.by])
  if (!added.length) return next
  const queue = { ...next.syncQueue }
  let n = Object.keys(queue).length
  for (const e of added) {
    const id = `SQ-${String(++n).padStart(5, '0')}`
    queue[id] = { id, staffId: e.by, eventId: e.id, shipmentId: e.shipmentId, legId: e.legId, type: e.type, photos: e.photos?.length ?? 0, savedAt: e.at ?? at, status: 'waiting', attempts: 0 }
  }
  return { ...next, syncQueue: queue }
}

/**
 * Sync now: with a network every pending item is sent (leaves the queue);
 * without one each item is marked Failed and the staff member is told.
 */
export function syncNow(data: DemoData, staffId: Id | undefined, online: boolean, at: IsoDateTime): DemoData {
  const mine = Object.values(data.syncQueue).filter((q) => !staffId || q.staffId === staffId)
  if (!mine.length) return data
  if (online) return { ...data, syncQueue: Object.fromEntries(Object.entries(data.syncQueue).filter(([, q]) => !mine.includes(q))) }
  const queue = { ...data.syncQueue }
  for (const q of mine) queue[q.id] = { ...q, status: 'failed' as SyncItem['status'], attempts: q.attempts + 1 }
  let next: DemoData = { ...data, syncQueue: queue }
  for (const sid of new Set(mine.map((q) => q.staffId))) next = notify(next, { app: 'partnerApp', userId: sid }, 'Sync failed', `${mine.filter((q) => q.staffId === sid).length} items · no network`, '/app/sync', at)
  return next
}

// ── PA-13 settings ──────────────────────────────────────────────────────────

export function setFieldLanguage(data: DemoData, staffId: Id, language: FieldStaff['language']): DemoData {
  const s = data.fieldStaff[staffId]
  return s && s.language !== language ? setStaff(data, { ...s, language }) : data
}

export function setVoicePrompts(data: DemoData, staffId: Id, on: boolean): DemoData {
  const s = data.fieldStaff[staffId]
  return s ? setStaff(data, { ...s, voicePrompts: on }) : data
}

// ── PA-10 training ──────────────────────────────────────────────────────────

const training = (s: FieldStaff) => s.training ?? { videos: [], practice: [] }

export function watchVideo(data: DemoData, staffId: Id, videoId: string): DemoData {
  const s = data.fieldStaff[staffId]
  if (!s || !(VIDEOS[s.role] as string[]).includes(videoId) || training(s).videos.includes(videoId)) return data
  return setStaff(data, { ...s, training: { ...training(s), videos: [...training(s).videos, videoId] } })
}

/** A practice task passed (every step done on the practice screen). Nothing reaches customers or the shipment data. */
export function passPractice(data: DemoData, staffId: Id, taskId: string): DemoData {
  const s = data.fieldStaff[staffId]
  if (!s || !PRACTICE[s.role].some((p) => p.id === taskId) || training(s).practice.includes(taskId)) return data
  return setStaff(data, { ...s, training: { ...training(s), practice: [...training(s).practice, taskId] } })
}

/** Mark complete: only after all practice tasks pass. Shown to the partner admin on PP-29. */
export function completeTraining(data: DemoData, staffId: Id, at: IsoDateTime): DemoData {
  const s = data.fieldStaff[staffId]
  if (!s || s.trained || !canCompleteTraining(s)) return data
  return setStaff(data, { ...s, trained: true, training: { ...training(s), completedAt: at } })
}
