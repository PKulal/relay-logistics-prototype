/**
 * IST time helpers. The demo runs on India time no matter where the reviewer is,
 * and all "now" values come from the store's `demoNow` (CLAUDE.md rule 4).
 * Timestamps are stored as ISO strings with a +05:30 offset.
 */
import type { IsoDate, IsoDateTime } from '@shared/types'

const IST_OFFSET_MIN = 330
const MS_PER_MIN = 60_000
const pad = (n: number) => String(n).padStart(2, '0')

/** Wall-clock parts of an instant in IST. */
export function istParts(iso: IsoDateTime | Date) {
  const ms = (typeof iso === 'string' ? Date.parse(iso) : iso.getTime()) + IST_OFFSET_MIN * MS_PER_MIN
  const d = new Date(ms)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    /** 0 = Sunday */
    weekday: d.getUTCDay(),
  }
}

/** Instant → "2026-11-23T10:05:00+05:30" */
export function toIst(iso: IsoDateTime | Date): IsoDateTime {
  const p = istParts(iso)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}+05:30`
}

/** Build an IST timestamp from a date ("2026-11-23") and time ("14:00"). */
export function ist(date: IsoDate, time = '00:00'): IsoDateTime {
  return `${date}T${time.length === 5 ? `${time}:00` : time}+05:30`
}

/** IST calendar date of an instant: "2026-11-23" */
export function istDate(iso: IsoDateTime): IsoDate {
  return toIst(iso).slice(0, 10)
}

export function addMinutes(iso: IsoDateTime, minutes: number): IsoDateTime {
  return toIst(new Date(Date.parse(iso) + minutes * MS_PER_MIN))
}

export const addHours = (iso: IsoDateTime, hours: number) => addMinutes(iso, hours * 60)
export const addDays = (iso: IsoDateTime, days: number) => addMinutes(iso, days * 1440)

/** Add calendar days to a date: ("2026-11-23", 3) → "2026-11-26" */
export function addDaysToDate(date: IsoDate, days: number): IsoDate {
  return istDate(addDays(ist(date, '12:00'), days))
}

/** Minutes from a to b (negative if b is earlier). */
export function minutesBetween(a: IsoDateTime, b: IsoDateTime): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_MIN)
}

export const isBefore = (a: IsoDateTime, b: IsoDateTime) => Date.parse(a) < Date.parse(b)

/** Sort comparator for ISO timestamps (ascending). */
export const byTime = (a: IsoDateTime, b: IsoDateTime) => Date.parse(a) - Date.parse(b)
