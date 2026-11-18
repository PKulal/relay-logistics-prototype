/**
 * SIMULATED hand-over code (PA-19): a real app would get a one-time code from
 * the server, or exchange signed codes phone-to-phone when offline. Here it is
 * a stable 6-digit number derived from the leg and the time it was shown.
 */
export function makeHandoverCode(legId: string, at: string): string {
  let h = 2166136261
  for (const ch of `${legId}|${at}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0
  return String(100000 + (h % 900000))
}

/** "418552" → "418 552" */
export const spacedCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`

/** What the hand-over QR encodes. */
export const handoverQrValue = (legId: string, code: string) => `LOGISCO-HO:${legId}:${code}`
