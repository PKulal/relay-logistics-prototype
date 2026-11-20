/**
 * The guided tour script — ERP spec §11.3 "End-to-end demo script", 10 steps.
 * Each step names the app and persona to open, and can be played by the tour
 * itself ("Do it for me") through the same store actions the screens call.
 * `prepare` sets up what a step needs before the reviewer does it by hand.
 * Steps get a getter: every store action replaces `data`, so they re-read state after each call.
 */
import type { DemoState } from '@shared/store/store'
import { riderCode } from '@shared/store/deliveryActions'
import { handoverState } from '@shared/store/handoverActions'
import type { AppKey, DemoData, Id } from '@shared/types'

export const HERO = 'LGS-DEL-000781'
const TRIP = 'TRP-2026-0931'
const MISSED_LEG = 'JOB-000790-L1'
const CLAIM = 'CLM-2026-0151'
const DECCAN_INVOICE = 'DR/0099'
const DECCAN_LEG = 'JOB-000786-L3'
const BATCH_DATE = '2026-11-27'
const BATCH = 'PB-2026-1127'

export interface TourStep {
  id: string
  app: AppKey
  userId: Id
  path: string
  /** Sets up what the step needs (runs when the screen is opened) */
  prepare?: (s: () => DemoState) => void
  /** Plays the step through store actions; omitted for steps that are only looked at */
  run?: (s: () => DemoState) => void
  /** The earlier steps this one depends on are done */
  needs?: (d: DemoData) => boolean
  done: (d: DemoData) => boolean
  /** Where "Do it for me" lands, to show the outcome (defaults to the step's screen) */
  after?: { app: AppKey; userId: Id; path: string }
}

const heroPieces = (d: DemoData) => d.shipments[HERO]?.pieces.map((p) => p.id) ?? []
const booked = (d: DemoData) => !!d.shipments[HERO]

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'book',
    after: { app: 'customer', userId: 'CU-PRIYA', path: `/customer/shipments/${HERO}` },
    app: 'customer',
    userId: 'CU-PRIYA',
    path: '/customer/book',
    done: booked,
    run: (s) =>
      s().bookShipment({
        customerId: 'C-SHARMA',
        bookedByUserId: 'CU-PRIYA',
        pickupLocationId: 'PL-OKHLA',
        consigneeId: 'CN-HED',
        serviceKind: 'ptl',
        service: 'expressPtl',
        paymentMode: 'tbb',
        addOns: { appointment: true, insurance: true, specialHandling: false },
        invoice: { no: 'SE/25-26/1187', date: '2026-11-23', value: 180000 },
        hsn: '8537',
        goodsDescription: 'LT switchgear panels',
        pieces: Array.from({ length: 6 }, () => ({ l: 60, b: 40, h: 40, weight: 20, skuCode: 'SG-LT-400' })),
        pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' },
      }),
  },
  {
    id: 'shipment360',
    app: 'erp',
    userId: 'LS-SANJAY',
    path: `/erp/shipments/${HERO}`,
    needs: booked,
    // Looked at only
    done: () => false,
  },
  {
    id: 'firstMile',
    after: { app: 'customer', userId: 'CU-PRIYA', path: `/customer/shipments/${HERO}` },
    app: 'partnerPortal',
    userId: 'PU-NEHA',
    path: '/partner/jobs',
    needs: booked,
    done: (d) => booked(d) && !['booked', 'pickedUp'].includes(d.shipments[HERO].status),
    run: (s) => {
      const L1 = 'JOB-000781-L1'
      s().acceptLegs([L1], 'PU-NEHA')
      s().assignLegs([L1], 'FS-RAVI', 'V-DL01LT4521', 'PU-NEHA')
      const pieceIds = heroPieces(s().data)
      s().confirmPickup({ legId: L1, staffId: 'FS-RAVI', pieceIds, verified: [], photos: ['invoice'], handedOverBy: 'Ramesh Kumar', confirmation: 'otp', packagingDamaged: false, labelledBy: 'shipper' })
      s().giveHandover({ legId: L1, staffId: 'FS-RAVI', pieceIds, photos: ['p'] })
      const code = handoverState(s().data, L1).given?.handoverCode
      if (code) s().receiveHandover({ legId: 'JOB-000781-L2', staffId: 'FS-POOJA', code, pieceIds, brokenSeals: [], damagedPieceIds: [], photos: [] })
      s().inScan({ hubId: 'HUB-GGN', legIds: ['JOB-000781-L2'], pieceIds, staffId: 'FS-POOJA' })
    },
  },
  {
    id: 'halt',
    app: 'erp',
    userId: 'LS-SANJAY',
    path: '/erp/control-tower/at-risk',
    needs: (d) => booked(d) && d.shipments[HERO].status !== 'booked',
    done: (d) => (d.trips[TRIP]?.halts?.length ?? 0) > 0,
    run: (s) => {
      const pieceIds = heroPieces(s().data)
      for (const p of pieceIds) s().sortPiece('HUB-GGN', p)
      s().sealBag({ bagId: 'BAG-GGN-07', sealNo: 'SL-44817', photo: 'bag', manifestId: 'MAN-GGN-1123', staffId: 'FS-POOJA' })
      s().dispatchManifest({ manifestId: 'MAN-GGN-1123', vehicleNo: 'KA25AB1234', doorSeal: 'SL-44822', photo: 'door', staffId: 'FS-POOJA' })
      const m = s().data.manifests['MAN-GGN-1123']
      s().receiveManifest({ manifestId: 'MAN-GGN-1123', staffId: 'FS-BASAVARAJ', code: m.handoverCode!, bagIds: ['BAG-GGN-07'], brokenSeals: [], photos: [] })
      s().startTrip({ tripId: TRIP, staffId: 'FS-BASAVARAJ', vehicleNo: 'KA25AB1234', sealNos: ['SL-44822'], photo: 'door' })
      // On the road until the night before the line-haul leg is due (06:00, 26-Nov)
      const until = Date.parse(s().data.legs['JOB-000781-L3'].slaDueAt) - 5 * 60 * 60_000
      s().advanceTime(Math.max(0, Math.round((until - Date.parse(s().demoNow)) / 60_000)))
      s().reportHalt({ tripId: TRIP, staffId: 'FS-BASAVARAJ', reason: 'Traffic', minutes: 180 })
      s().messageCustomer(HERO, 'delay', `Your shipment ${HERO} may be delayed; we are on it and will confirm the ETA.`, 'LS-SANJAY')
    },
  },
  {
    id: 'reassign',
    after: { app: 'partnerPortal', userId: 'PU-SUNIL', path: '/partner/jobs' },
    app: 'erp',
    userId: 'LS-SANJAY',
    path: `/erp/control-tower/reassign/${MISSED_LEG}?reason=capacity`,
    // The missed pickup is raised when the clock passes the pickup window
    prepare: (s) => {
      const missed = (d: DemoData) => Object.values(d.exceptions).some((x) => x.legId === MISSED_LEG && x.type === 'pickupMissed')
      if (!missed(s().data) && s().data.legs[MISSED_LEG]?.partnerId !== 'P-QUICKLINK') s().advanceTime(4.5 * 60)
    },
    done: (d) => d.legs[MISSED_LEG]?.partnerId === 'P-QUICKLINK',
    run: (s) => s().reassignLeg({ legId: MISSED_LEG, partnerId: 'P-QUICKLINK', reason: 'capacity', notify: { oldPartner: true, newPartner: true, customer: true } }, 'LS-SANJAY'),
  },
  {
    id: 'deliver',
    after: { app: 'customer', userId: 'CU-PRIYA', path: `/customer/shipments/${HERO}` },
    app: 'partnerApp',
    userId: 'FS-MANJU',
    path: '/app',
    needs: (d) => (d.trips[TRIP]?.halts?.length ?? 0) > 0 || d.trips[TRIP]?.status === 'arrived',
    done: (d) => d.shipments[HERO]?.status === 'delivered',
    run: (s) => {
            const pieceIds = heroPieces(s().data)
      if (s().data.trips[TRIP].status !== 'arrived') {
        s().advanceTime(12 * 60)
        s().arriveTrip(TRIP, 'FS-BASAVARAJ')
      }
      s().handOverAtArrival({ tripId: TRIP, staffId: 'FS-BASAVARAJ', broken: [] })
      s().receiveHandover({ legId: 'JOB-000781-L4', staffId: 'FS-HWH-SHIVA', code: s().data.trips[TRIP].handoverCode!, pieceIds, brokenSeals: [], damagedPieceIds: [], photos: [] })
      s().inScan({ hubId: 'HUB-HBL', legIds: ['JOB-000781-L4'], pieceIds, staffId: 'FS-HWH-SHIVA' })
      s().giveToRider({ hubId: 'HUB-HBL', legIds: ['JOB-000781-L4'], staffId: 'FS-HWH-SHIVA', photos: ['p'] })
      s().receiveLoad({ legIds: ['JOB-000781-L5'], staffId: 'FS-MANJU', code: riderCode(s().data, 'FS-MANJU')!, pieceIds })
      s().startRun(['JOB-000781-L5'], 'FS-MANJU')
      s().completeDelivery({
        legId: 'JOB-000781-L5',
        staffId: 'FS-MANJU',
        pieces: Object.fromEntries(pieceIds.map((p) => [p, { state: 'ok' as const }])),
        receivedBy: 'Mahesh Patil',
        verification: 'otp',
        grn: 'GRN-HED-55120',
        photo: 'pod',
      })
    },
  },
  {
    id: 'claim',
    app: 'erp',
    userId: 'LS-FARHAN',
    path: `/erp/claims/${CLAIM}`,
    done: (d) => !!d.claims[CLAIM]?.settlement,
    run: (s) => s().settleClaim(CLAIM, { amount: 1500, reason: 'Approved; capped (not insured)', method: 'bank', recovery: { partner: 1500, insurer: 0 } }, 'LS-FARHAN'),
  },
  {
    id: 'payouts',
    after: { app: 'partnerPortal', userId: 'PU-ANIL', path: '/partner/finance/payouts' },
    app: 'erp',
    userId: 'LS-LAKSHMI',
    path: '/erp/finance/payables',
    // Deccan bills 58 kg on its leg of LGS-DEL-000786: ₹72 over the matched amount, disputed
    prepare: (s) => {
      if (s().data.partnerInvoices?.[DECCAN_INVOICE]) return
      s().uploadPartnerInvoice('P-DECCAN', { no: DECCAN_INVOICE, date: '2026-11-23', amount: 522, pdf: 'INV-DR-0099.pdf', lineFile: 'lines.xlsx', lines: [{ legId: DECCAN_LEG, billedWeight: 58 }] }, 'PU-PRAKASH')
      s().disputeLine(DECCAN_INVOICE, DECCAN_LEG, 'Weighed 58 kg at our dock', ['weighbridge.jpg'], 'PU-PRAKASH')
    },
    done: (d) => d.payoutBatches?.[BATCH]?.status === 'released',
    run: (s) => {
            s().resolvePartnerDispute(DECCAN_INVOICE, DECCAN_LEG, { decision: 'matched', note: 'Pickup verification 8 kg with photos' }, 'LS-LAKSHMI')
      s().approvePartnerInvoice(DECCAN_INVOICE, 'LS-LAKSHMI')
      if (!s().data.payoutBatches?.[BATCH]) s().submitPayoutBatch(BATCH_DATE, 'LS-LAKSHMI')
      s().releasePayoutBatch(BATCH, 'LS-RAHUL')
    },
  },
  {
    id: 'scoring',
    after: { app: 'erp', userId: 'LS-MEERA', path: '/erp/partners/suspensions' },
    app: 'erp',
    userId: 'LS-MEERA',
    path: '/erp/partners/scoring',
    done: (d) => d.partners['P-FASTTRACK']?.tier === 'probation' && Object.values(d.suspensionCases).some((c) => c.partnerId === 'P-FASTTRACK' && c.step !== 'closed'),
    run: (s) => {
      if (s().data.partners['P-FASTTRACK']?.tier !== 'probation') s().runWeeklyScoring('LS-MEERA')
      const open = Object.values(s().data.suspensionCases).some((c) => c.partnerId === 'P-FASTTRACK' && c.step !== 'closed')
      if (!open) s().openSuspensionCase('P-FASTTRACK', 'scoreBelow60', 'Probation: score 57', 'LS-MEERA')
    },
  },
  {
    id: 'leadership',
    app: 'erp',
    userId: 'LS-RAHUL',
    path: '/erp/leadership',
    done: () => false,
  },
]
