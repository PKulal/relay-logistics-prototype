/**
 * Indian display formats (CLAUDE.md rule 8, design-system.md §4).
 * Dates and times are always shown in IST, whatever the viewer's time zone.
 * Callers pass values derived from the store's `demoNow`, never `new Date()`.
 */
import type { IsoDate, IsoDateTime } from '@shared/types'
import { istParts } from './time'

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** 180000 → "₹1,80,000.00" */
export function formatINR(amount: number): string {
  return inr.format(amount)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const pad = (n: number) => String(n).padStart(2, '0')

/** A bare date ("2026-11-23") is a calendar date; anything else is an instant shown in IST. */
function parts(value: IsoDateTime | IsoDate | Date) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return istParts(`${value}T12:00:00+05:30`)
  }
  return istParts(value)
}

/** → "23-Nov-2026" */
export function formatDate(value: IsoDateTime | IsoDate | Date): string {
  const p = parts(value)
  return `${pad(p.day)}-${MONTHS[p.month - 1]}-${p.year}`
}

/** → "Mon 23-Nov" */
export function formatDayShort(value: IsoDateTime | IsoDate | Date): string {
  const p = parts(value)
  return `${DAYS[p.weekday]} ${pad(p.day)}-${MONTHS[p.month - 1]}`
}

/** → "Thu, 26-Nov-2026" (ETA promises) */
export function formatDateLong(value: IsoDateTime | IsoDate | Date): string {
  return `${DAYS[parts(value).weekday]}, ${formatDate(value)}`
}

/** 162 → "162 kg", 7.5 → "7.5 kg" */
export function formatKg(kg: number): string {
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(kg)} kg`
}

/** → "14:05" (24-hour IST) */
export function formatTime(value: IsoDateTime | Date): string {
  const p = istParts(value)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

/** → "23-Nov-2026 14:05" */
export function formatDateTime(value: IsoDateTime | Date): string {
  return `${formatDate(value)} ${formatTime(value)}`
}

/** Masked phone number (DPDP, source §14): "94480 12345" → "94480 •••45". */
export function maskMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '')
  if (digits.length < 6) return mobile
  return `${digits.slice(0, 5)} •••${digits.slice(-2)}`
}

/** "45 m", "2 h 40 m", "1 d 3 h" for a span in minutes. */
export function formatDuration(minutes: number): string {
  const m = Math.round(Math.abs(minutes))
  if (m < 60) return `${m} m`
  if (m < 24 * 60) return m % 60 ? `${Math.floor(m / 60)} h ${m % 60} m` : `${m / 60} h`
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return h ? `${d} d ${h} h` : `${d} d`
}

/** A Monday–Sunday week: "16-Nov – 22-Nov-2026". */
export function formatWeek(monday: string): string {
  const d = new Date(`${monday}T12:00:00+05:30`)
  d.setUTCDate(d.getUTCDate() + 6)
  return `${formatDate(monday).slice(0, 6)} – ${formatDate(d.toISOString().slice(0, 10))}`
}
