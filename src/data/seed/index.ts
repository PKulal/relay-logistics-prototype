/**
 * Builds the complete demo data set. Called on first load and by resetDemo(),
 * so every reset produces identical data.
 */
import type { DemoData, IsoDateTime } from '@shared/types'
import { consignees, customers, customerUsers, pickupLocations, skus } from './customers'
import { extraConsignees, extraCustomers, extraCustomerUsers, extraPickupLocations, extraSkus } from './customers-extra'
import { generateShipments } from './generator'
import { hubs, lanes, partnerRates, pincodes, rateCards, settings } from './master'
import { applications, namedFieldStaff, namedPartners, namedPartnerUsers, namedVehicles, weeklyScores } from './partners'
import { extraFieldStaff, extraPartners, extraPartnerUsers, extraVehicles } from './partners-extra'
import { addKeyShipments } from './shipments-key'
import { staff } from './staff'
import { byId } from './util'

/** Monday 23-Nov-2026 10:00 IST — booking day for the hero shipment (seed-data.md §1). */
export const DEMO_START: IsoDateTime = '2026-11-23T10:00:00+05:30'

/** The hero shipment is NOT pre-seeded: the reviewer books it live and it gets this LR. */
export const HERO_LR = 'LGS-DEL-000781'

/**
 * Master data, customers, partners and people — before any shipments exist.
 * structuredClone so callers can never mutate the module-level seed arrays.
 */
export function buildBaseSeed(): DemoData {
  return structuredClone({
    pincodes: byId(pincodes),
    hubs: byId(hubs),
    lanes: byId(lanes),
    rateCards: byId(rateCards),
    partnerRates: byId(partnerRates),
    settings,

    customers: byId([...customers, ...extraCustomers]),
    customerUsers: byId([...customerUsers, ...extraCustomerUsers]),
    pickupLocations: byId([...pickupLocations, ...extraPickupLocations]),
    consignees: byId([...consignees, ...extraConsignees]),
    skus: byId([...skus, ...extraSkus]),
    leads: {},

    partners: byId([...namedPartners, ...extraPartners]),
    applications: byId(applications),
    partnerUsers: byId([...namedPartnerUsers, ...extraPartnerUsers]),
    fieldStaff: byId([...namedFieldStaff, ...extraFieldStaff]),
    vehicles: byId([...namedVehicles, ...extraVehicles]),
    weeklyScores: byId(weeklyScores),

    staff: byId(staff),

    shipments: {},
    legs: {},
    events: {},
    trips: {},
    bags: {},
    manifests: {},

    exceptions: {},
    weightRevisions: {},
    ndrs: {},
    claims: {},
    invoices: {},
    creditNotes: {},
    walletTxns: {},
    codRecords: {},
    partnerInvoices: {},
    payouts: {},
    tickets: {},

    notifications: {},
    aiDecisions: {},
    auditLog: {},

    // Next Delhi booking becomes LGS-DEL-000781 (the hero). nextLr() skips numbers already used.
    lrSerials: { DEL: 781 },
  } satisfies DemoData)
}

/**
 * The full demo data set at Mon 23-Nov-2026 10:00: base data, the key shipments
 * (seed-data.md §4) and ~120 generated background shipments.
 */
export function buildSeed(): DemoData {
  return generateShipments(addKeyShipments(buildBaseSeed(), DEMO_START), DEMO_START)
}
