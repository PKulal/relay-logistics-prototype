/**
 * The key shipments from docs/seed-data.md §4. Each is booked through
 * bookShipment() and moved along with simulated chain-of-custody events, so
 * statuses come from the status engine like every live shipment.
 *
 * The hero LGS-DEL-000781 is NOT here: the reviewer books it live.
 * Consignees, invoice numbers and dates not given in seed-data.md are INVENTED.
 */
import { quote } from '@shared/engines/quote'
import { runJourney } from '@shared/sim/journey'
import { applyEvents } from '@shared/store/actions'
import { bookShipment, eventIdFactory, type BookingInput } from '@shared/store/booking'
import type { DemoData, IsoDateTime } from '@shared/types'

const carton = { l: 60, b: 40, h: 40, weight: 20, skuCode: 'SG-LT-400' }
const cartons = (n: number) => Array.from({ length: n }, () => ({ ...carton }))
const noAddOns = { appointment: false, insurance: false, specialHandling: false }

/** Sharma Electricals bookings share these fields. Seeded credit use is a snapshot, so money is not re-applied. */
const sharma = (b: Omit<BookingInput, 'customerId' | 'pickupLocationId' | 'hsn' | 'goodsDescription' | 'serviceKind' | 'paymentMode'> & Partial<BookingInput>): BookingInput => ({
  customerId: 'C-SHARMA',
  pickupLocationId: 'PL-OKHLA',
  serviceKind: 'ptl',
  paymentMode: 'tbb',
  hsn: '8537',
  goodsDescription: 'LT switchgear panel 400A',
  applyMoney: false,
  ...b,
})

export function addKeyShipments(seed: DemoData, until: IsoDateTime): DemoData {
  let data = seed
  const book = (input: BookingInput, at: IsoDateTime) => (data = bookShipment(data, input, at).data)

  // ── LGS-DEL-000769: settled shortage claim. Piece 4 of 6 missing at the origin hub (6 in, 5 sealed out).
  book(
    sharma({
      lr: 'LGS-DEL-000769',
      bookedByUserId: 'CU-PRIYA',
      consigneeId: 'CN-BST',
      service: 'expressPtl',
      addOns: { ...noAddOns, insurance: true },
      invoice: { no: 'SE/25-26/1102', date: '2026-11-09', value: 180000, po: 'BST/PO/0912' },
      pieces: cartons(6),
      pickupSlot: { date: '2026-11-09', from: '14:00', to: '16:00' },
    }),
    '2026-11-09T11:00:00+05:30',
  )
  data = runJourney(data, 'LGS-DEL-000769', { until, outcome: 'short', shortPieceIds: ['LGS-DEL-000769-04'] })
  data = setPiece(data, 'LGS-DEL-000769', 'LGS-DEL-000769-04', { condition: 'missing' })
  data = {
    ...data,
    exceptions: {
      ...data.exceptions,
      'EXC-000769-1': {
        id: 'EXC-000769-1',
        shipmentId: 'LGS-DEL-000769',
        legId: 'JOB-000769-L2',
        type: 'short',
        raisedAt: findEvent(data, 'LGS-DEL-000769', 'exceptionReported'),
        actionDueAt: '2026-11-11T12:00:00+05:30',
        ownerPartnerId: 'P-NCRXD',
        rootCause: 'Piece 4 scanned in at NCR CrossDock but not sealed out',
        status: 'resolved',
        customerConfirmed: true,
      },
    },
    claims: {
      ...data.claims,
      'CLM-2026-0142': {
        id: 'CLM-2026-0142',
        shipmentId: 'LGS-DEL-000769',
        customerId: 'C-SHARMA',
        type: 'shortage',
        pieceIds: ['LGS-DEL-000769-04'],
        amountClaimed: 30000,
        amountApproved: 30000,
        liableLegId: 'JOB-000769-L2',
        liablePartnerId: 'P-NCRXD',
        recovery: { partner: 10000, insurer: 20000, insurerRef: 'INS-88213' },
        creditNoteId: 'CN-2026-0088',
        raisedAt: '2026-11-14T10:20:00+05:30',
        settleBy: '2026-11-21',
        status: 'settled',
      },
    },
    creditNotes: {
      ...data.creditNotes,
      'CN-2026-0088': {
        id: 'CN-2026-0088',
        customerId: 'C-SHARMA',
        claimId: 'CLM-2026-0142',
        date: '2026-11-19',
        amount: 30000,
        reason: 'Shortage claim CLM-2026-0142: piece 4 of 6 missing',
      },
    },
  }

  // ── LGS-DEL-000776: failed delivery, premises closed. Customer picks a new slot (27-Nov 11:00–13:00) in CP-21.
  book(
    sharma({
      lr: 'LGS-DEL-000776',
      bookedByUserId: 'CU-RAMESH',
      consigneeId: 'CN-SKE',
      service: 'standardPtl',
      addOns: noAddOns,
      invoice: { no: 'SE/25-26/1141', date: '2026-11-16', value: 90000, po: 'SKE/PO/2207' },
      pieces: cartons(3),
      pickupSlot: { date: '2026-11-16', from: '14:00', to: '16:00' },
    }),
    '2026-11-16T10:15:00+05:30',
  )
  data = runJourney(data, 'LGS-DEL-000776', { until, outcome: 'ndr', ndrReason: 'Premises closed', assignees: { 5: 'FS-MANJU' } })
  const ndrAt = findEvent(data, 'LGS-DEL-000776', 'deliveryFailed')
  data = {
    ...data,
    ndrs: { ...data.ndrs, 'NDR-000776-1': { id: 'NDR-000776-1', shipmentId: 'LGS-DEL-000776', attempt: 1, reason: 'Premises closed', at: ndrAt } },
    exceptions: {
      ...data.exceptions,
      'EXC-000776-1': {
        id: 'EXC-000776-1',
        shipmentId: 'LGS-DEL-000776',
        legId: 'JOB-000776-L5',
        type: 'ndr',
        raisedAt: ndrAt,
        actionDueAt: '2026-11-24T18:00:00+05:30',
        ownerPartnerId: 'P-NKEXP',
        status: 'open',
        customerConfirmed: false,
      },
    },
  }

  // ── LGS-DEL-000784: open weight revision. Rider measured two cartons larger at pickup.
  book(
    sharma({
      lr: 'LGS-DEL-000784',
      bookedByUserId: 'CU-PRIYA',
      consigneeId: 'CN-MEM',
      service: 'standardPtl',
      addOns: noAddOns,
      invoice: { no: 'SE/25-26/1163', date: '2026-11-21', value: 120000, po: 'MEM/PO/4410' },
      pieces: cartons(4),
      pickupSlot: { date: '2026-11-21', from: '14:00', to: '16:00' },
    }),
    '2026-11-21T10:30:00+05:30',
  )
  data = runJourney(data, 'LGS-DEL-000784', { until })
  data = addWeightRevision(data, 'LGS-DEL-000784', ['LGS-DEL-000784-03', 'LGS-DEL-000784-04'], { l: 62, b: 42, h: 42 })

  // ── LGS-MYS-000112: Kaveri Handicrafts parcel, Mysuru → Pune, ₹561.09 from the wallet.
  // Wallet before this booking: ₹9,011.09 → ₹8,450.00 after (seed-data.md §5).
  data = {
    ...data,
    customers: { ...data.customers, 'C-KAVERI': { ...data.customers['C-KAVERI'], walletBalance: 9011.09 } },
    walletTxns: {
      ...data.walletTxns,
      'WT-KAV-TOPUP-1120': { id: 'WT-KAV-TOPUP-1120', customerId: 'C-KAVERI', type: 'topUp', ref: 'UPI 433812907715', amount: 5000, balanceAfter: 9011.09, at: '2026-11-20T18:42:00+05:30' },
    },
  }
  book(
    {
      lr: 'LGS-MYS-000112',
      customerId: 'C-KAVERI',
      bookedByUserId: 'CU-SURESH',
      pickupLocationId: 'PL-KAVERI',
      consigneeId: 'CN-CBP',
      serviceKind: 'parcel',
      service: 'standard',
      paymentMode: 'paid',
      addOns: noAddOns,
      invoice: { no: 'KH/25-26/0112', date: '2026-11-21', value: 4500 },
      hsn: '4420',
      goodsDescription: 'Rosewood inlay handicrafts',
      pieces: [{ l: 40, b: 30, h: 30, weight: 6 }],
      pickupSlot: { date: '2026-11-21', from: '14:00', to: '16:00' },
    },
    '2026-11-21T11:00:00+05:30',
  )
  data = runJourney(data, 'LGS-MYS-000112', { until })
  // The booking added its total to month-to-date spend; the seeded ₹4,820 already includes it.
  data = { ...data, customers: { ...data.customers, 'C-KAVERI': { ...data.customers['C-KAVERI'], spendMonthToDate: 4820 } } }

  // ── LGS-DEL-000790: pickup at risk — Ravi has 7 pending pickups today. Reassigned to QuickLink in ERP-08.
  book(
    sharma({
      lr: 'LGS-DEL-000790',
      bookedByUserId: 'CU-RAMESH',
      consigneeId: 'CN-BPC',
      service: 'expressPtl',
      addOns: noAddOns,
      invoice: { no: 'SE/25-26/1186', date: '2026-11-23', value: 120000, po: 'BPC/PO/0377' },
      pieces: cartons(4),
      pickupSlot: { date: '2026-11-23', from: '12:00', to: '14:00' },
    }),
    '2026-11-23T09:20:00+05:30',
  )
  // Doesn't move on its own: the demo reassigns this pickup to QuickLink by hand (ERP-08).
  data = runJourney(data, 'LGS-DEL-000790', { until, assignees: { 1: 'FS-RAVI' }, continues: false })

  return data
}

function findEvent(data: DemoData, shipmentId: string, type: string): IsoDateTime {
  const ev = Object.values(data.events).find((e) => e.shipmentId === shipmentId && e.type === type)
  if (!ev) throw new Error(`Seed: ${shipmentId} has no ${type} event`)
  return ev.at
}

function setPiece(data: DemoData, shipmentId: string, pieceId: string, patch: Partial<DemoData['shipments'][string]['pieces'][number]>): DemoData {
  const s = data.shipments[shipmentId]
  return {
    ...data,
    shipments: { ...data.shipments, [shipmentId]: { ...s, pieces: s.pieces.map((p) => (p.id === pieceId ? { ...p, ...patch } : p)) } },
  }
}

/** Rider measures some pieces larger at pickup → weightRevised event + pending WeightRevision. */
function addWeightRevision(data: DemoData, shipmentId: string, pieceIds: string[], dims: { l: number; b: number; h: number }): DemoData {
  const s = data.shipments[shipmentId]
  const pieces = s.pieces.map((p) => (pieceIds.includes(p.id) ? { ...p, verifiedDims: dims, verifiedWeight: p.weight } : p))
  const revised = quote(data, {
    customerId: s.customerId,
    originPincode: s.originPincode,
    destPincode: s.destPincode,
    serviceKind: s.serviceKind,
    service: s.service,
    pieces: pieces.map((p) => ({ ...(p.verifiedDims ?? p), weight: p.verifiedWeight ?? p.weight })),
    declaredValue: s.invoice.value,
    addOns: s.addOns,
    paymentMode: s.paymentMode,
    codAmount: s.codAmount,
  })
  const pickupAt = findEvent(data, shipmentId, 'pickupConfirmed')
  const pickupLeg = data.legs[s.legIds[0]]
  const id = `WR-${shipmentId.slice(-6)}`
  const withEvent = applyEvents(
    data,
    [{ id: eventIdFactory(data, shipmentId)(), shipmentId, legId: pickupLeg.id, type: 'weightRevised', at: pickupAt, by: pickupLeg.staffId ?? 'system', app: 'partnerApp', pieceIds, photos: [], note: `Measured ${dims.l} × ${dims.b} × ${dims.h} cm` }],
    pickupAt,
  )
  return {
    ...withEvent,
    shipments: { ...withEvent.shipments, [shipmentId]: { ...withEvent.shipments[shipmentId], pieces, weights: { ...s.weights, verifiedChargeable: revised.weights.chargeable } } },
    weightRevisions: {
      ...data.weightRevisions,
      [id]: {
        id,
        shipmentId,
        booked: s.weights.chargeable,
        verified: revised.weights.chargeable,
        amountDiff: Math.round((revised.price.total - s.price.total) * 100) / 100,
        photos: [],
        raisedAt: pickupAt,
        status: 'pending',
      },
    },
  }
}
