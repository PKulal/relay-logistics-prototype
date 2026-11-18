/** Status tones (design-system.md §3), shared by chips, tiles and timers. */
import type { LegStatus, ShipmentStatus } from '@shared/types'

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

/** design-system.md §3 */
export const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-status-success-bg text-status-success',
  warning: 'bg-status-warning-bg text-status-warning',
  danger: 'bg-status-danger-bg text-status-danger',
  info: 'bg-status-info-bg text-status-info',
  neutral: 'bg-status-neutral-bg text-status-neutral',
}

/** Shipment status chips (design-system.md §3, "Shipment status chips"). */
export const SHIPMENT_TONE: Record<ShipmentStatus, Tone> = {
  booked: 'neutral',
  pickedUp: 'info',
  atOriginHub: 'info',
  inTransit: 'info',
  atDestinationHub: 'info',
  outForDelivery: 'info',
  delivered: 'success',
  deliveredWithException: 'warning',
  undelivered: 'danger',
  returnToOrigin: 'danger',
  cancelled: 'neutral',
}

export const LEG_TONE: Record<LegStatus, Tone> = {
  offered: 'neutral',
  accepted: 'info',
  flagged: 'warning',
  withdrawn: 'neutral',
  assigned: 'info',
  inProgress: 'info',
  handedOver: 'success',
  delivered: 'success',
  failedAttempt: 'danger',
  exception: 'danger',
  closed: 'neutral',
}
