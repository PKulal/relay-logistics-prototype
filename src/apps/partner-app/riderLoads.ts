import { nextLegOf } from '@shared/engines/fieldTasks'
import type { HubItem } from '@shared/engines/hub'
import { handoverState } from '@shared/store/handoverActions'
import type { DemoData } from '@shared/types'

export interface RiderLoad {
  riderId: string
  items: HubItem[]
  pieceIds: string[]
  /** Code shown and not yet taken */
  code?: string
}

/** In-hub shipments going out for local delivery, by rider. */
export function riderLoads(data: DemoData, items: HubItem[]): RiderLoad[] {
  const byRider = new Map<string, RiderLoad>()
  for (const i of items.filter((x) => x.stage === 'toSort' || x.stage === 'sorted')) {
    const next = nextLegOf(data, i.leg)
    if (next?.type !== 'lastMile' || !next.staffId) continue
    const g = byRider.get(next.staffId) ?? { riderId: next.staffId, items: [], pieceIds: [] }
    g.items.push(i)
    g.pieceIds.push(...i.pieceIds)
    const { given, received } = handoverState(data, i.leg.id)
    if (given?.handoverCode && !received) g.code = given.handoverCode
    byRider.set(next.staffId, g)
  }
  return [...byRider.values()]
}
