/**
 * The one store shared by all four apps (docs/data-model.md).
 * - Persisted to localStorage under "logisco-demo-v1".
 * - Synced across tabs with BroadcastChannel("logisco") — see sync.ts.
 * - Time comes from `demoNow`, never Date.now() (CLAUDE.md rule 4).
 * Who is logged in is per tab and lives in the session store, not here.
 */
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { buildSeed, DEMO_START } from '@data/seed'
import { addMinutes } from '@shared/lib/time'
import { advanceJourneys } from '@shared/sim/journey'
import type { Consignee, Customer, DemoData, Id, IsoDateTime, KycRecord, LeadStage, PickupLocation, Qualification, ShipmentEvent } from '@shared/types'
import { applyEvents } from './actions'
import { bookShipment, type BookingInput } from './booking'
import * as erp from './erpActions'
import type { MessageTemplate } from './erpActions'
import * as pp from './partnerActions'
import type { FlagReason, ProblemKind } from './partnerActions'
import * as pick from './pickupActions'
import type { PickupConfirmation } from './pickupActions'
import * as hand from './handoverActions'
import type { HandoverGive, HandoverReceive } from './handoverActions'
import * as hub from './hubActions'
import type { Dispatch, InScan, ReceiveManifest, SealBag } from './hubActions'
import * as trip from './tripActions'
import * as dlv from './deliveryActions'
import * as appt from './appointmentActions'
import * as onb from './onboardingActions'
import type { CreditDecision, CreditRequest, SignUpInput } from './onboardingActions'
import type { AppointmentInput } from './appointmentActions'
import type { CompleteDelivery, GiveToRider, ReceiveLoad } from './deliveryActions'
import type { ArrivalHandover, ReportHalt, StartTrip } from './tripActions'

export const STORAGE_KEY = 'logisco-demo-v1'
/** Bump when the seed or data shape changes: saved data from an older version is replaced by a fresh seed. */
export const STORE_VERSION = 11

export interface DemoFlags {
  /** Demo toolbar: show "Simulated" tags on AI outputs and fake integrations */
  showSimulationLabels: boolean
  /** Demo toolbar: Partner App offline mode */
  offline: boolean
  /** Demo toolbar: onboarding decisions wait for an ERP user instead of approving automatically */
  manualApprovals: boolean
}

export interface DemoState {
  data: DemoData
  demoNow: IsoDateTime
  flags: DemoFlags

  /** Move the demo clock forward. Time never goes backwards. */
  advanceTime: (minutes: number) => void
  /** Add chain-of-custody events; shipment and leg statuses are re-derived. */
  addEvents: (events: ShipmentEvent[]) => void
  /** CP-13: create a shipment (legs, events, credit / wallet, spend). Returns the LR. Throws QuoteError / NoPartnerError. */
  bookShipment: (input: BookingInput) => Id
  /** Add or update a consignee (CP-13 Step 2, CP-30) */
  saveConsignee: (consignee: Consignee) => void
  /** ERP one-click actions (SIMULATED integrations; each writes an audit entry) */
  extendEwayBill: (lr: Id, userId: Id) => void
  updatePartB: (lr: Id, userId: Id) => void
  messageCustomer: (lr: Id, template: MessageTemplate, body: string, userId: Id) => void
  logMaskedCall: (lr: Id, partnerId: Id, userId: Id) => void
  /** Partner Portal job actions (PP-12 to PP-14) */
  acceptLegs: (legIds: Id[], userId: Id) => void
  flagLeg: (legId: Id, reason: FlagReason, remark: string, userId: Id) => void
  assignLegs: (legIds: Id[], staffId: Id, vehicleId: Id | undefined, userId: Id) => void
  unassignLeg: (legId: Id, userId: Id) => void
  reportProblem: (legId: Id, kind: ProblemKind, text: string, userId: Id) => void
  /** Partner App (PA-05, PA-14 to PA-17) */
  arriveAtPickup: (legId: Id, staffId: Id) => void
  confirmPickup: (c: PickupConfirmation) => void
  markNotificationsRead: (ids: Id[]) => void
  /** Partner App hand-overs (PA-19 give, PA-20 receive) */
  giveHandover: (g: HandoverGive) => void
  receiveHandover: (r: HandoverReceive) => void
  /** Partner App hub (PA-26 to PA-29) */
  inScan: (x: InScan) => void
  /** Returns the bag the piece went in */
  sortPiece: (hubId: Id, pieceId: Id) => Id | undefined
  removeFromBag: (bagId: Id, pieceId: Id) => void
  sealBag: (x: SealBag) => void
  dispatchManifest: (x: Dispatch) => void
  receiveManifest: (x: ReceiveManifest) => void
  /** Partner App driver trip (PA-22 to PA-24) */
  startTrip: (x: StartTrip) => void
  reportHalt: (x: ReportHalt) => void
  arriveTrip: (tripId: Id, staffId: Id) => void
  handOverAtArrival: (x: ArrivalHandover) => void
  /** Partner App last mile (hub → rider, PA-31 to PA-33) */
  giveToRider: (x: GiveToRider) => void
  receiveLoad: (x: ReceiveLoad) => void
  startRun: (legIds: Id[], staffId: Id) => void
  completeDelivery: (x: CompleteDelivery) => void
  /** CP-18 / CP-17 delivery appointment; `by` is the customer user or "consignee" */
  bookAppointment: (lr: Id, a: AppointmentInput, by: Id) => void
  /** Customer onboarding, Phases 1–2 (CP-04 to CP-07; ERP-26/27/30) */
  signUp: (x: SignUpInput) => { customerId: Id; userId: Id }
  saveQualification: (customerId: Id, q: Qualification, by: Id) => void
  verifyGstin: (customerId: Id, cin?: string) => void
  verifyPan: (customerId: Id, pan: string) => void
  verifyBank: (customerId: Id, b: { holder: string; account: string; ifsc: string; type: 'current' | 'savings' }) => void
  saveSignatory: (customerId: Id, s: NonNullable<KycRecord['signatory']>) => void
  savePickupLocation: (customerId: Id, loc: Omit<PickupLocation, 'id' | 'customerId' | 'isDefault'> & { isDefault?: boolean }) => void
  removePickupLocation: (id: Id) => void
  submitKyc: (customerId: Id, by: Id) => void
  clearKyc: (customerId: Id, by: Id) => void
  submitCredit: (customerId: Id, r: CreditRequest, by: Id) => void
  decideCredit: (customerId: Id, d: CreditDecision, by: Id) => void
  acceptCredit: (customerId: Id, by: Id) => void
  assignLead: (leadId: Id, ownerId: Id, by: Id) => void
  moveLead: (leadId: Id, stage: LeadStage, by: Id) => void
  logLeadActivity: (leadId: Id, kind: 'call' | 'visit' | 'email', note: string, by: Id) => void
  autoDecide: (customerId: Id, kind: 'kyc' | 'credit') => void
  setTrack: (customerId: Id, track: Customer['track'], by: Id) => void
  setFlag: <K extends keyof DemoFlags>(flag: K, value: DemoFlags[K]) => void
  /** Restore the seed data in every app (other tabs follow via sync). */
  resetDemo: () => void
}

export type PersistedDemoState = Pick<DemoState, 'data' | 'demoNow' | 'flags'>

export const initialFlags: DemoFlags = { showSimulationLabels: false, offline: false, manualApprovals: false }

export function freshState(): PersistedDemoState {
  return { data: buildSeed(), demoNow: DEMO_START, flags: { ...initialFlags } }
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set, get) => ({
      ...freshState(),

      advanceTime: (minutes) => {
        if (minutes <= 0) return
        set((s) => {
          const demoNow = addMinutes(s.demoNow, minutes)
          // Background shipments move along their simulated journeys (ERP spec §11.1).
          return { demoNow, data: advanceJourneys(s.data, s.demoNow, demoNow) }
        })
      },

      addEvents: (events) => set((s) => ({ data: applyEvents(s.data, events, s.demoNow) })),

      bookShipment: (input) => {
        const { data, demoNow } = get()
        const result = bookShipment(data, { autoAccept: true, ...input }, demoNow)
        set({ data: result.data })
        return result.shipmentId
      },

      saveConsignee: (consignee) => set((s) => ({ data: { ...s.data, consignees: { ...s.data.consignees, [consignee.id]: consignee } } })),


      extendEwayBill: (lr, userId) => set((s) => ({ data: erp.extendEwayBill(s.data, lr, userId, s.demoNow) })),
      updatePartB: (lr, userId) => set((s) => ({ data: erp.updatePartB(s.data, lr, userId, s.demoNow) })),
      messageCustomer: (lr, template, body, userId) => set((s) => ({ data: erp.messageCustomer(s.data, lr, template, body, userId, s.demoNow) })),
      logMaskedCall: (lr, partnerId, userId) => set((s) => ({ data: erp.logMaskedCall(s.data, lr, partnerId, userId, s.demoNow) })),

      acceptLegs: (legIds, userId) => set((s) => ({ data: pp.acceptLegs(s.data, legIds, userId, s.demoNow) })),
      flagLeg: (legId, reason, remark, userId) => set((s) => ({ data: pp.flagLeg(s.data, legId, reason, remark, userId, s.demoNow) })),
      assignLegs: (legIds, staffId, vehicleId, userId) => set((s) => ({ data: pp.assignLegs(s.data, legIds, staffId, vehicleId, userId, s.demoNow) })),
      unassignLeg: (legId, userId) => set((s) => ({ data: pp.unassignLeg(s.data, legId, userId, s.demoNow) })),
      reportProblem: (legId, kind, text, userId) => set((s) => ({ data: pp.reportProblem(s.data, legId, kind, text, userId, s.demoNow) })),

      arriveAtPickup: (legId, staffId) => set((s) => ({ data: pick.arriveAtPickup(s.data, legId, staffId, s.demoNow) })),
      confirmPickup: (c) => set((s) => ({ data: pick.confirmPickup(s.data, c, s.demoNow) })),
      markNotificationsRead: (ids) => set((s) => ({ data: pick.markRead(s.data, ids) })),
      giveHandover: (g) => set((s) => ({ data: hand.giveHandover(s.data, g, s.demoNow) })),
      receiveHandover: (r) => set((s) => ({ data: hand.receiveHandover(s.data, r, s.demoNow) })),
      inScan: (x) => set((s) => ({ data: hub.inScan(s.data, x, s.demoNow) })),
      sortPiece: (hubId, pieceId) => {
        const r = hub.sortPiece(get().data, hubId, pieceId)
        set({ data: r.data })
        return r.bagId
      },
      removeFromBag: (bagId, pieceId) => set((s) => ({ data: hub.removeFromBag(s.data, bagId, pieceId) })),
      sealBag: (x) => set((s) => ({ data: hub.sealBag(s.data, x, s.demoNow) })),
      dispatchManifest: (x) => set((s) => ({ data: hub.dispatchManifest(s.data, x, s.demoNow) })),
      receiveManifest: (x) => set((s) => ({ data: hub.receiveManifest(s.data, x, s.demoNow) })),
      startTrip: (x) => set((s) => ({ data: trip.startTrip(s.data, x, s.demoNow) })),
      reportHalt: (x) => set((s) => ({ data: trip.reportHalt(s.data, x, s.demoNow) })),
      arriveTrip: (tripId, staffId) => set((s) => ({ data: trip.arriveTrip(s.data, tripId, staffId, s.demoNow) })),
      handOverAtArrival: (x) => set((s) => ({ data: trip.handOverAtArrival(s.data, x, s.demoNow) })),
      giveToRider: (x) => set((s) => ({ data: dlv.giveToRider(s.data, x, s.demoNow) })),
      receiveLoad: (x) => set((s) => ({ data: dlv.receiveLoad(s.data, x, s.demoNow) })),
      startRun: (legIds, staffId) => set((s) => ({ data: dlv.startRun(s.data, legIds, staffId, s.demoNow) })),
      completeDelivery: (x) => set((s) => ({ data: dlv.completeDelivery(s.data, x, s.demoNow) })),
      bookAppointment: (lr, a, by) => set((s) => ({ data: appt.bookAppointment(s.data, lr, a, by, s.demoNow) })),
      signUp: (x) => {
        const r = onb.signUp(get().data, x, get().demoNow)
        set({ data: r.data })
        return { customerId: r.customerId, userId: r.userId }
      },
      saveQualification: (customerId, q, by) => set((s) => ({ data: onb.saveQualification(s.data, customerId, q, by, s.demoNow) })),
      verifyGstin: (customerId, cin) => set((s) => ({ data: onb.verifyGstin(s.data, customerId, cin, s.demoNow) })),
      verifyPan: (customerId, pan) => set((s) => ({ data: onb.verifyPan(s.data, customerId, pan, s.demoNow) })),
      verifyBank: (customerId, b) => set((s) => ({ data: onb.verifyBank(s.data, customerId, b, s.demoNow) })),
      saveSignatory: (customerId, sig) => set((s) => ({ data: onb.saveSignatory(s.data, customerId, sig, s.demoNow) })),
      savePickupLocation: (customerId, loc) => set((s) => ({ data: onb.savePickupLocation(s.data, customerId, loc) })),
      removePickupLocation: (id) => set((s) => ({ data: onb.removePickupLocation(s.data, id) })),
      submitKyc: (customerId, by) => set((s) => ({ data: onb.submitKyc(s.data, customerId, by, s.demoNow) })),
      clearKyc: (customerId, by) => set((s) => ({ data: onb.clearKyc(s.data, customerId, by, s.demoNow) })),
      submitCredit: (customerId, r, by) => set((s) => ({ data: onb.submitCredit(s.data, customerId, r, by, s.demoNow) })),
      decideCredit: (customerId, d, by) => set((s) => ({ data: onb.decideCredit(s.data, customerId, d, by, s.demoNow) })),
      acceptCredit: (customerId, by) => set((s) => ({ data: onb.acceptCredit(s.data, customerId, by, s.demoNow) })),
      assignLead: (leadId, ownerId, by) => set((s) => ({ data: onb.assignLead(s.data, leadId, ownerId, by, s.demoNow) })),
      moveLead: (leadId, stage, by) => set((s) => ({ data: onb.moveLead(s.data, leadId, stage, by, s.demoNow) })),
      logLeadActivity: (leadId, kind, note, by) => set((s) => ({ data: onb.logLeadActivity(s.data, leadId, kind, note, by, s.demoNow) })),
      autoDecide: (customerId, kind) => set((s) => ({ data: onb.autoDecide(s.data, customerId, kind, s.demoNow) })),
      setTrack: (customerId, track, by) => set((s) => ({ data: onb.setTrack(s.data, customerId, track, by, s.demoNow) })),


      setFlag: (flag, value) => set((s) => ({ flags: { ...s.flags, [flag]: value } })),

      resetDemo: () => set(freshState()),
    }),
    {
      name: STORAGE_KEY,
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): PersistedDemoState => ({ data: s.data, demoNow: s.demoNow, flags: s.flags }),
      // Old saved data can't be trusted against a new seed: start fresh.
      migrate: () => freshState(),
    },
  ),
)
