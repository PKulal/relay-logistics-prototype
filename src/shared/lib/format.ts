/**
 * Indian display formats (CLAUDE.md rule 8, design-system.md §4).
 * Callers pass dates derived from the store's `demoNow`, never `new Date()`.
 */

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
const pad = (n: number) => String(n).padStart(2, '0')

/** → "23-Nov-2026" (local time) */
export function formatDate(date: Date): string {
  return `${pad(date.getDate())}-${MONTHS[date.getMonth()]}-${date.getFullYear()}`
}

/** → "14:05" (24-hour, local time) */
export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** → "23-Nov-2026 14:05" */
export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`
}
