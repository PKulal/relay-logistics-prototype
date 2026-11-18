/**
 * Builds the complete demo data set. Called on first load and by resetDemo(),
 * so every reset produces identical data.
 */
import type { DemoData, IsoDateTime } from '@shared/types'
import { consignees, customers, customerUsers, pickupLocations, skus } from './customers'
import { hubs, lanes, partnerRates, pincodes, rateCards, settings } from './master'
import { applications, namedFieldStaff, namedPartners, namedPartnerUsers, namedVehicles, weeklyScores } from './partners'
import { extraPartners, extraPartnerUsers } from './partners-extra'
import { staff } from './staff'
import { byId } from './util'

/** Monday 23-Nov-2026 10:00 IST — booking day for the hero shipment (seed-data.md §1). */
export const DEMO_START: IsoDateTime = '2026-11-23T10:00:00+05:30'

/** The hero shipment is NOT pre-seeded: the reviewer books it live and it gets this LR. */
export const HERO_LR = 'LGS-DEL-000781'

export function buildSeed(): DemoData {
  // structuredClone so callers can never mutate the module-level seed arrays
  return structuredClone({
    pincodes: byId(pincodes),
    hubs: byId(hubs),
    lanes: byId(lanes),
    rateCards: byId(rateCards),
    partnerRates: byId(partnerRates),
    settings,

    customers: byId(customers),
    customerUsers: byId(customerUsers),
    pickupLocations: byId(pickupLocations),
    consignees: byId(consignees),
    skus: byId(skus),
    leads: {},

    partners: byId([...namedPartners, ...extraPartners]),
    applications: byId(applications),
    partnerUsers: byId([...namedPartnerUsers, ...extraPartnerUsers]),
    fieldStaff: byId(namedFieldStaff),
    vehicles: byId(namedVehicles),
    weeklyScores: byId(weeklyScores),

    staff: byId(staff),

    // Shipments, legs and events are added with the engines (build-plan Phase 1b).
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
