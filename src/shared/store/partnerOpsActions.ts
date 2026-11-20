/**
 * PP-16 Change vehicle: new truck and driver on a trip; the e-way bills on
 * board need a Part B update (source §8 / §10 Step 3), so Control Tower is told.
 */
import type { DemoData, Id, IsoDateTime } from '@shared/types'
import { audit } from './erpActions'

export function changeTripVehicle(data: DemoData, tripId: Id, vehicleId: Id, driverId: Id, by: Id, at: IsoDateTime): DemoData {
  const trip = data.trips[tripId]
  const v = data.vehicles[vehicleId]
  const d = data.fieldStaff[driverId]
  if (!trip || !v || !d || trip.status === 'arrived' || (trip.vehicleId === vehicleId && trip.driverId === driverId)) return data
  const shipments = { ...data.shipments }
  for (const legId of trip.legIds) {
    const s = shipments[data.legs[legId]?.shipmentId]
    if (s?.ewb) shipments[s.id] = { ...s, ewb: { ...s.ewb, partBUpdated: false }, updatedAt: at }
  }
  const nid = `NTF-${String(Object.keys(data.notifications).length + 1).padStart(5, '0')}`
  const next: DemoData = {
    ...data,
    shipments,
    trips: { ...data.trips, [tripId]: { ...trip, vehicleId, driverId } },
    notifications: { ...data.notifications, [nid]: { id: nid, audience: { app: 'erp', role: 'controlTower' }, title: 'Vehicle changed: update e-way bill Part B', body: `${tripId} · ${v.regNo}`, link: '/erp/compliance', at, read: false } },
  }
  return audit(next, { userId: by, app: 'partnerPortal', action: 'trip.changeVehicle', recordId: tripId, at, before: { vehicleId: trip.vehicleId, driverId: trip.driverId }, after: { vehicleId, driverId } })
}
