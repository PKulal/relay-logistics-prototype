/**
 * Customer Portal settings rules (CP-28 to CP-33): admins, bookable locations,
 * serviceability, SKU weights and the SIMULATED AI SKU outlier check.
 */
import type { Customer, CustomerUser, DemoData, Id, PickupLocation, Settings, Sku } from '@shared/types'

export const userStatus = (u: CustomerUser) => u.status ?? 'active'

export const usersOf = (data: DemoData, customerId: Id) => Object.values(data.customerUsers).filter((u) => u.customerId === customerId)

/** CP-28: at least one active Admin must always exist. */
export const activeAdmins = (data: DemoData, customerId: Id) => usersOf(data, customerId).filter((u) => u.role === 'admin' && userStatus(u) === 'active')

export const isLastAdmin = (data: DemoData, u: CustomerUser) => u.role === 'admin' && userStatus(u) === 'active' && activeAdmins(data, u.customerId).length === 1

export const locationActive = (l: PickupLocation) => l.active !== false

/** CP-13 pickup locations a user may book from: active, and in the user's location access (empty = all). */
export function bookableLocations(data: DemoData, customer: Customer, user?: CustomerUser): PickupLocation[] {
  return Object.values(data.pickupLocations).filter((l) => l.customerId === customer.id && locationActive(l) && (!user?.locationIds.length || user.locationIds.includes(l.id)))
}

/** CP-29 / CP-30: a pincode must be known and serviceable before it is saved. */
export const serviceable = (data: DemoData, pincode: string) => !!data.pincodes[pincode.trim()]?.serviceable

/** CP-31 read-only weights: volumetric (Parcel, L×B×H / divisor) and CFT (PTL, cubic feet × CFT factor). */
export function skuWeights(s: Pick<Sku, 'l' | 'b' | 'h'>, settings: Pick<Settings, 'volumetricDivisor' | 'cftFactor'>) {
  const cm3 = s.l * s.b * s.h
  return { volumetric: Math.round((cm3 / settings.volumetricDivisor) * 10) / 10, cft: Math.round((cm3 / 28316.85) * settings.cftFactor * 10) / 10 }
}

export const skuCodeTaken = (data: DemoData, customerId: Id, code: string, exceptId?: Id) =>
  Object.values(data.skus).some((s) => s.customerId === customerId && s.id !== exceptId && s.code.toLowerCase() === code.trim().toLowerCase())
