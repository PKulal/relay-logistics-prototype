/**
 * SIMULATED seal scanning (PA-28, PA-29): the camera "reads" the next seal from
 * the hub's roll. Bag seals start at SL-44817 (the hero's bag, seed-data.md §3);
 * truck door seals at SL-44822.
 */
import type { DemoData, Id } from '@shared/types'

export const SEAL_PATTERN = /^SL-\d{5}$/

export function nextBagSeal(data: DemoData, hubId: Id): string {
  const used = Object.values(data.bags).filter((b) => b.hubId === hubId && b.sealNo).length
  return `SL-${44817 + used}`
}

export function nextDoorSeal(data: DemoData, hubId: Id): string {
  const used = Object.values(data.manifests).filter((m) => m.hubId === hubId && m.doorSeal).length
  return `SL-${44822 + used}`
}
