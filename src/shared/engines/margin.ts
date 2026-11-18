/**
 * Shipment margin — ERP spec §7.2.
 * gross = price before GST − leg costs − insurance premium passed to the insurer
 * net   = gross − risk buffer (% of price before GST)
 */
import { pct, round2 } from './money'

export interface MarginInput {
  /** Customer price before GST */
  subtotal: number
  legCosts: number[]
  /** FOV collected from the customer, paid on to the insurer */
  insurance: number
  riskBufferPct: number
  targetMarginPct: number
}

export interface MarginResult {
  legTotal: number
  gross: number
  grossPct: number
  buffer: number
  net: number
  netPct: number
  /** Net margin below target → flagged in the margin monitor */
  belowTarget: boolean
}

/** Percentage to 1 decimal place. */
const share = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10)

export function computeMargin(i: MarginInput): MarginResult {
  const legTotal = round2(i.legCosts.reduce((s, c) => s + c, 0))
  const gross = round2(i.subtotal - legTotal - i.insurance)
  const buffer = pct(i.subtotal, i.riskBufferPct)
  const net = round2(gross - buffer)
  const netPct = share(net, i.subtotal)
  return { legTotal, gross, grossPct: share(gross, i.subtotal), buffer, net, netPct, belowTarget: netPct < i.targetMarginPct }
}
