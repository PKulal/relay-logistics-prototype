/**
 * SIMULATED: in production the e-way bill number comes from the government
 * EWB API. Here it is derived from the LR so it is stable across resets:
 * LGS-DEL-000781 → "3410 2256 7781" (seed-data.md §3).
 */
export function simulateEwbNumber(lr: string): string {
  const serial = Number(lr.slice(-6))
  return `3410 2256 ${String(7000 + (serial % 1000)).padStart(4, '0')}`
}
