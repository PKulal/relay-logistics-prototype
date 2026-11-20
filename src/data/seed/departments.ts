/**
 * Seed for the light departments (ERP-04, ERP-28, ERP-29, ERP-39, ERP-41).
 * INVENTED throughout, except where noted from the ERP spec samples:
 * ₹1.92 Cr / 17.6%, on-time 93.1%, claims 5.2 per 10k, 214 / 86 active
 * (ERP-04 MTD); TKT-2026-3381 pickup, high (ERP-39); RFQ due 05-Dec at
 * Pricing (ERP-29).
 */
import type { ComplianceReference, DemoData, DpdpRequest, LeadershipSnapshot, Qbr, Rfq, Ticket } from '@shared/types'

const AT = (d: string, t = '10:00') => `${d}T${t}:00+05:30`

export const leadership: LeadershipSnapshot = {
  periods: {
    today: { revenue: 980000, marginPct: 17.9, onTimePct: 94.0, claimsPer10k: 4.8, activeCustomers: 214, activePartners: 86 },
    mtd: { revenue: 19200000, marginPct: 17.6, onTimePct: 93.1, claimsPer10k: 5.2, activeCustomers: 214, activePartners: 86 },
    qtd: { revenue: 54800000, marginPct: 17.2, onTimePct: 92.6, claimsPer10k: 5.6, activeCustomers: 214, activePartners: 86 },
  },
  heatmap: [
    { origin: 'Delhi NCR', dest: 'Delhi NCR', marginPct: 21.4 },
    { origin: 'Delhi NCR', dest: 'Karnataka', marginPct: 18.3 },
    { origin: 'Delhi NCR', dest: 'Maharashtra', marginPct: 16.1 },
    { origin: 'Karnataka', dest: 'Delhi NCR', marginPct: 15.2 },
    { origin: 'Karnataka', dest: 'Karnataka', marginPct: 22.6 },
    { origin: 'Karnataka', dest: 'Maharashtra', marginPct: 12.8 },
    { origin: 'Maharashtra', dest: 'Delhi NCR', marginPct: 14.4 },
    { origin: 'Maharashtra', dest: 'Karnataka', marginPct: 9.8 },
    { origin: 'Maharashtra', dest: 'Maharashtra', marginPct: 20.1 },
  ],
  okrs: [
    { id: 'OKR-1', objective: 'Reliable delivery', keyResult: 'On-time delivery', target: '≥ 95%', actual: '93.1%', ownerId: 'LS-SANJAY', onTrack: false },
    { id: 'OKR-2', objective: 'Profitable growth', keyResult: 'Gross margin', target: '≥ 18%', actual: '17.6%', ownerId: 'LS-DIVYA', onTrack: false },
    { id: 'OKR-3', objective: 'Profitable growth', keyResult: 'Monthly revenue', target: '₹2.0 Cr', actual: '₹1.92 Cr', ownerId: 'LS-ARJUN', onTrack: true },
    { id: 'OKR-4', objective: 'Safe handling', keyResult: 'Claims per 10,000 pieces', target: '≤ 4.0', actual: '5.2', ownerId: 'LS-FARHAN', onTrack: false },
    { id: 'OKR-5', objective: 'Strong network', keyResult: 'Partners Gold or better', target: '≥ 40%', actual: '42%', ownerId: 'LS-MEERA', onTrack: true },
  ],
}

export const compliance: ComplianceReference = {
  statutory: [
    { id: 'ST-1', title: 'TDS deposit (November)', due: '2026-12-07', kind: 'tds' },
    { id: 'ST-2', title: 'GSTR-1 (November)', due: '2026-12-11', kind: 'gst' },
    { id: 'ST-3', title: 'PF / ESI (November)', due: '2026-12-15', kind: 'other' },
    { id: 'ST-4', title: 'GSTR-3B (November)', due: '2026-12-20', kind: 'gst' },
    { id: 'ST-5', title: 'Gurugram trade licence renewal', due: '2026-12-31', kind: 'licence' },
  ],
  contracts: [
    { id: 'CT-1', party: 'Hubli Warehousing', partyType: 'partner', title: 'Hub services agreement', start: '2025-11-25', end: '2026-11-24' },
    { id: 'CT-2', party: 'Sharma Electricals', partyType: 'customer', title: 'Rate card and SLA', start: '2025-12-01', end: '2026-11-30' },
    { id: 'CT-3', party: 'Westline Carriers', partyType: 'partner', title: 'Line-haul agreement', start: '2025-12-20', end: '2026-12-19' },
    { id: 'CT-4', party: 'KraftKart Marketplace', partyType: 'customer', title: 'Marketplace logistics agreement', start: '2026-01-15', end: '2027-01-14' },
    { id: 'CT-5', party: 'SwiftCity Couriers', partyType: 'partner', title: 'First-mile agreement', start: '2025-04-01', end: '2027-03-31' },
  ],
}

const tickets: Ticket[] = [
  { id: 'TKT-2026-3381', raisedBy: 'CU-RAMESH', app: 'customer', customerId: 'C-SHARMA', category: 'pickup', subject: 'Pickup for LGS-DEL-000790 not done yet', shipmentId: 'LGS-DEL-000790', createdAt: AT('2026-11-23', '09:20'), dueAt: AT('2026-11-23', '11:20'), status: 'open', thread: [{ at: AT('2026-11-23', '09:20'), by: 'CU-RAMESH', text: 'Rider has not come for the 09:00 pickup. Goods are ready at Okhla.' }] },
  { id: 'TKT-2026-3379', raisedBy: 'CU-TRIVENI', app: 'customer', customerId: 'C-TRIVENI', category: 'billing', subject: 'Line items for invoice LGS/DL/25-26/03518', createdAt: AT('2026-11-22', '17:05'), dueAt: AT('2026-11-23', '17:05'), status: 'open', thread: [{ at: AT('2026-11-22', '17:05'), by: 'CU-TRIVENI', text: 'Please share the shipment-wise breakup for the August invoice before we release payment.' }] },
  { id: 'TKT-2026-3375', raisedBy: 'CU-SURESH', app: 'customer', customerId: 'C-KAVERI', category: 'tracking', subject: 'Tracking link not opening for the consignee', createdAt: AT('2026-11-22', '12:40'), dueAt: AT('2026-11-23', '12:40'), ownerId: 'LS-FARAH', status: 'inProgress', thread: [{ at: AT('2026-11-22', '12:40'), by: 'CU-SURESH', text: 'My customer in Pune says the link shows an error.' }, { at: AT('2026-11-22', '15:10'), by: 'LS-FARAH', text: 'Checking with the tech team; meanwhile the LR can be tracked on our public page.' }] },
  { id: 'TKT-2026-3368', raisedBy: 'CU-KRAFTKART', app: 'customer', customerId: 'C-KRAFTKART', category: 'delivery', subject: 'Delivery slot change request', createdAt: AT('2026-11-20', '10:15'), dueAt: AT('2026-11-20', '18:15'), ownerId: 'LS-FARAH', status: 'resolved', thread: [{ at: AT('2026-11-20', '10:15'), by: 'CU-KRAFTKART', text: 'Can the consignee get an evening slot?' }, { at: AT('2026-11-20', '11:30'), by: 'LS-FARAH', text: 'Done: moved to 16:00–19:00.' }] },
]

const qbrs: Qbr[] = [{ id: 'QBR-0007', customerId: 'C-SHARMA', date: '2026-10-15', agenda: 'Q2 review: on-time, Hubballi appointments, Mumbai lane', by: 'LS-ARJUN', notes: 'On-time 92% on Delhi → Hubballi; wants a Mumbai lane quote; happy with e-PODs.' }]

const rfqs: Rfq[] = [
  {
    id: 'RFQ-2026-014',
    customerId: 'C-TRIVENI',
    title: 'Noida plant expansion: Pune and Bengaluru dealers',
    dueDate: '2026-12-05',
    lanes: [
      { origin: 'Delhi NCR', dest: 'Pune', monthlyShipments: 220, service: 'standardPtl' },
      { origin: 'Delhi NCR', dest: 'Bengaluru', monthlyShipments: 160, service: 'expressPtl' },
    ],
    status: 'pricing',
    ownerId: 'LS-ARJUN',
    createdAt: AT('2026-11-18', '11:00'),
    log: [
      { at: AT('2026-11-18', '11:00'), by: 'LS-ARJUN', text: 'Received from Triveni procurement' },
      { at: AT('2026-11-19', '16:30'), by: 'LS-ARJUN', text: 'Sent to Pricing' },
    ],
  },
  {
    id: 'RFQ-2026-011',
    prospect: 'Vardhman Home Textiles',
    title: 'Ludhiana → South India distributors',
    dueDate: '2026-11-28',
    lanes: [{ origin: 'Delhi NCR', dest: 'Hubballi', monthlyShipments: 90, service: 'standardPtl' }],
    status: 'submitted',
    ownerId: 'LS-ARJUN',
    createdAt: AT('2026-11-10', '12:00'),
    log: [{ at: AT('2026-11-14', '18:00'), by: 'LS-ARJUN', text: 'Proposal submitted' }],
  },
]

const dpdp: DpdpRequest[] = [
  { id: 'DPR-0004', party: 'Consignee contact, Pune', kind: 'access', receivedAt: AT('2026-11-18', '14:00'), dueAt: AT('2026-11-25', '14:00'), status: 'open' },
  { id: 'DPR-0003', party: 'Former customer contact', kind: 'erasure', receivedAt: AT('2026-11-02', '10:00'), dueAt: AT('2026-11-09', '10:00'), status: 'done', doneBy: 'LS-NEETA', doneAt: AT('2026-11-06', '15:00') },
]

const NPS: Record<string, number> = { 'C-SHARMA': 62, 'C-TRIVENI': 38, 'C-KAVERI': 71, 'C-KRAFTKART': 55, 'C-ANKUR': 49, 'C-URBANLOOM': 58, 'C-GREENLEAF': 66, 'C-DECCANSTEEL': 44 }

const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(list.map((x) => [x.id, x]))

export function addDepartmentSeed(data: DemoData): DemoData {
  const customers = { ...data.customers }
  for (const [id, nps] of Object.entries(NPS)) if (customers[id]) customers[id] = { ...customers[id], nps }
  return {
    ...data,
    customers,
    tickets: { ...data.tickets, ...byId(tickets) },
    qbrs: byId(qbrs),
    rfqs: byId(rfqs),
    dpdpRequests: byId(dpdp),
    leadership,
    compliance,
  }
}
