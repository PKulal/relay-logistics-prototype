/**
 * The Gurugram hub's day (seed-data.md §3): tonight's Hubballi trip, its open
 * manifest and the open Hubballi bag. Line-haul legs on that lane and departure
 * join the trip (joinTrips) — the hero's when it is booked.
 */
import type { Bag, Manifest, Trip } from '@shared/types'

export const hubDayTrips: Trip[] = [
  {
    id: 'TRP-2026-0931',
    legIds: [],
    laneId: 'LN-DEL-HBL',
    vehicleId: 'V-KA25AB1234',
    driverId: 'FS-BASAVARAJ',
    sealNos: [],
    departAt: '2026-11-23T23:00:00+05:30',
    eta: '2026-11-26T06:00:00+05:30',
    positions: [],
    halts: [],
    status: 'planned',
  },
]

export const hubDayManifests: Manifest[] = [
  { id: 'MAN-GGN-1123', hubId: 'HUB-GGN', destination: 'HUB-HBL', bagIds: [], vehicleId: 'V-KA25AB1234', tripId: 'TRP-2026-0931', status: 'open' },
]

export const hubDayBags: Bag[] = [{ id: 'BAG-GGN-07', hubId: 'HUB-GGN', destination: 'HUB-HBL', pieceIds: [], status: 'open' }]
