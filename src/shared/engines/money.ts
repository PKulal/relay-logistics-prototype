/** Round to paise. EPSILON guards against 2.675 → 2.67 style float errors. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Percentage of a base, rounded to paise. */
export const pct = (base: number, percent: number) => round2((base * percent) / 100)
