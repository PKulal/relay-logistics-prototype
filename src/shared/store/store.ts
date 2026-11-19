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
import type { Consignee, Customer, DemoData, Id, IsoDate, IsoDateTime, KycRecord, LeadStage, PartnerAgreement, PartnerDocKey, PickupLocation, Qualification, ShipmentEvent, VerificationResult } from '@shared/types'
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
import type { CreditDecision, CreditRequest, DecisionKind, SignUpInput } from './onboardingActions'
import * as ctr from './contractActions'
import * as pon from './partnerOnboardingActions'
import * as pag from './partnerAgreementActions'
import type { CommercialDecisionKind, LineEdit, NewStaff } from './partnerAgreementActions'
import type { AuditItems, CheckInput, PartnerApplyInput, PartnerDecisionKind, VerificationDecision } from './partnerOnboardingActions'
import type { IntegrationStep, RateEdit, SkuRow } from './contractActions'
import type { AppointmentInput } from './appointmentActions'
import type { CompleteDelivery, GiveToRider, ReceiveLoad } from './deliveryActions'
import type { ArrivalHandover, ReportHalt, StartTrip } from './tripActions'

export const STORAGE_KEY = 'logisco-demo-v1'
/** Bump when the seed or data shape changes: saved data from an older version is replaced by a fresh seed. */
export const STORE_VERSION = 15

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
  autoDecide: (customerId: Id, kind: DecisionKind) => void
  /** Onboarding Phases 3–4 (CP-08 to CP-10; ERP-22/23/27) */
  createNegotiatedCard: (customerId: Id, fromId: Id, by: Id) => Id
  editRateCard: (cardId: Id, e: RateEdit) => void
  submitRateCard: (cardId: Id, by: Id) => void
  decideRateCard: (cardId: Id, decision: 'approve' | 'reject' | 'sendBack', comment: string, by: Id) => void
  issueContract: (customerId: Id, rateCardId: Id, by: Id) => void
  requestContractChanges: (customerId: Id, line: string, remark: string, by: Id) => void
  signContract: (customerId: Id, method: 'aadhaarOtp' | 'dsc' | 'clickWrap', by: Id) => void
  setIntegration: (customerId: Id, s: IntegrationStep) => void
  uploadSkus: (customerId: Id, rows: SkuRow[], by: Id) => void
  fixSku: (skuId: Id, d: { l: number; b: number; h: number; weight: number }) => void
  completeIntegration: (customerId: Id, skipped: boolean, by: Id) => void
  markLive: (customerId: Id, by: Id) => void
  setTrack: (customerId: Id, track: Customer['track'], by: Id) => void
  /** Partner onboarding, Phases 1–2 (PP-04 to PP-07; ERP-11/12) */
  applyAsPartner: (x: PartnerApplyInput) => { applicationId: Id; partnerId: Id; userId: Id }
  decideFit: (appId: Id, decision: 'invite' | 'waitlist' | 'reject', o: { coordinatorId?: Id; reason?: string }, by: Id) => void
  uploadPartnerDoc: (appId: Id, key: PartnerDocKey, f: { file: string; number?: string; expiry?: IsoDate }) => void
  runPartnerCheck: (appId: Id, c: CheckInput) => void
  submitPartnerKyc: (appId: Id, by: Id) => void
  requestReupload: (appId: Id, key: PartnerDocKey, reason: string, by: Id) => void
  decideVerification: (appId: Id, d: VerificationDecision, by: Id) => void
  bookHubAudit: (appId: Id, b: { date: IsoDate; window: 'morning' | 'afternoon'; contact: string; phone: string }, by: Id) => void
  recordHubAudit: (appId: Id, items: AuditItems, result: VerificationResult, by: Id) => void
  autoDecidePartner: (appId: Id, kind: PartnerDecisionKind) => void
  /** Partner onboarding, Phases 3–5 (PP-08 to PP-10; ERP-13/14) */
  draftPartnerAgreement: (appId: Id, by: Id) => void
  editAgreementLine: (appId: Id, lineId: Id, e: LineEdit) => void
  editAgreementTerms: (appId: Id, t: Partial<Omit<PartnerAgreement, 'lines' | 'status'>>) => void
  approveLineBelowTarget: (appId: Id, lineId: Id, by: Id) => void
  issuePartnerAgreement: (appId: Id, by: Id) => void
  proposePartnerChanges: (appId: Id, counters: { lineId: Id; rate: number; remark: string }[], by: Id) => void
  answerCounter: (appId: Id, lineId: Id, accept: boolean, by: Id) => void
  signPartnerAgreement: (appId: Id, method: 'aadhaarOtp' | 'dsc', selfBilling: boolean, by: Id) => void
  generateSandboxKey: (appId: Id) => void
  setWebhook: (appId: Id, url: string) => void
  recordApiTest: (appId: Id) => void
  addFieldStaff: (partnerId: Id, s: NewStaff) => void
  completePractice: (staffId: Id) => void
  markReadyForTrial: (appId: Id, by: Id) => void
  simulateTrialJob: (partnerId: Id) => void
  decideTrial: (partnerId: Id, d: 'live' | 'extend' | 'decline', reasons: string, by: Id) => void
  autoDecideCommercial: (id: Id, kind: CommercialDecisionKind) => void
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
      createNegotiatedCard: (customerId, fromId, by) => {
        const r = ctr.createNegotiatedCard(get().data, customerId, fromId, by, get().demoNow)
        set({ data: r.data })
        return r.cardId
      },
      editRateCard: (cardId, e) => set((s) => ({ data: ctr.editRateCard(s.data, cardId, e) })),
      submitRateCard: (cardId, by) => set((s) => ({ data: ctr.submitRateCard(s.data, cardId, by, s.demoNow) })),
      decideRateCard: (cardId, decision, comment, by) => set((s) => ({ data: ctr.decideRateCard(s.data, cardId, decision, comment, by, s.demoNow) })),
      issueContract: (customerId, rateCardId, by) => set((s) => ({ data: ctr.issueContract(s.data, customerId, rateCardId, by, s.demoNow) })),
      requestContractChanges: (customerId, line, remark, by) => set((s) => ({ data: ctr.requestContractChanges(s.data, customerId, line, remark, by, s.demoNow) })),
      signContract: (customerId, method, by) => set((s) => ({ data: ctr.signContract(s.data, customerId, method, by, s.demoNow) })),
      setIntegration: (customerId, step) => set((s) => ({ data: ctr.setIntegration(s.data, customerId, step, s.demoNow) })),
      uploadSkus: (customerId, rows, by) => set((s) => ({ data: ctr.uploadSkus(s.data, customerId, rows, by, s.demoNow) })),
      fixSku: (skuId, d) => set((s) => ({ data: ctr.fixSku(s.data, skuId, d) })),
      completeIntegration: (customerId, skipped, by) => set((s) => ({ data: ctr.completeIntegration(s.data, customerId, skipped, by, s.demoNow) })),
      markLive: (customerId, by) => set((s) => ({ data: ctr.markLive(s.data, customerId, by, s.demoNow) })),
      setTrack: (customerId, track, by) => set((s) => ({ data: onb.setTrack(s.data, customerId, track, by, s.demoNow) })),
      applyAsPartner: (x) => {
        const r = pon.applyAsPartner(get().data, x, get().demoNow)
        set({ data: r.data })
        return { applicationId: r.applicationId, partnerId: r.partnerId, userId: r.userId }
      },
      decideFit: (appId, decision, o, by) => set((s) => ({ data: pon.decideFit(s.data, appId, decision, o, by, s.demoNow) })),
      uploadPartnerDoc: (appId, key, f) => set((s) => ({ data: pon.uploadPartnerDoc(s.data, appId, key, f, s.demoNow) })),
      runPartnerCheck: (appId, c) => set((s) => ({ data: pon.runPartnerCheck(s.data, appId, c, s.demoNow) })),
      submitPartnerKyc: (appId, by) => set((s) => ({ data: pon.submitPartnerKyc(s.data, appId, by, s.demoNow) })),
      requestReupload: (appId, key, reason, by) => set((s) => ({ data: pon.requestReupload(s.data, appId, key, reason, by, s.demoNow) })),
      decideVerification: (appId, d, by) => set((s) => ({ data: pon.decideVerification(s.data, appId, d, by, s.demoNow) })),
      bookHubAudit: (appId, b, by) => set((s) => ({ data: pon.bookHubAudit(s.data, appId, b, by, s.demoNow) })),
      recordHubAudit: (appId, items, result, by) => set((s) => ({ data: pon.recordHubAudit(s.data, appId, items, result, by, s.demoNow) })),
      autoDecidePartner: (appId, kind) => set((s) => ({ data: pon.autoDecidePartner(s.data, appId, kind, s.demoNow) })),
      draftPartnerAgreement: (appId, by) => set((s) => ({ data: pag.draftPartnerAgreement(s.data, appId, by, s.demoNow) })),
      editAgreementLine: (appId, lineId, e) => set((s) => ({ data: pag.editAgreementLine(s.data, appId, lineId, e) })),
      editAgreementTerms: (appId, t) => set((s) => ({ data: pag.editAgreementTerms(s.data, appId, t) })),
      approveLineBelowTarget: (appId, lineId, by) => set((s) => ({ data: pag.approveLineBelowTarget(s.data, appId, lineId, by, s.demoNow) })),
      issuePartnerAgreement: (appId, by) => set((s) => ({ data: pag.issuePartnerAgreement(s.data, appId, by, s.demoNow) })),
      proposePartnerChanges: (appId, counters, by) => set((s) => ({ data: pag.proposePartnerChanges(s.data, appId, counters, by, s.demoNow) })),
      answerCounter: (appId, lineId, accept, by) => set((s) => ({ data: pag.answerCounter(s.data, appId, lineId, accept, by, s.demoNow) })),
      signPartnerAgreement: (appId, method, selfBilling, by) => set((s) => ({ data: pag.signPartnerAgreement(s.data, appId, method, selfBilling, by, s.demoNow) })),
      generateSandboxKey: (appId) => set((s) => ({ data: pag.generateSandboxKey(s.data, appId) })),
      setWebhook: (appId, url) => set((s) => ({ data: pag.setWebhook(s.data, appId, url) })),
      recordApiTest: (appId) => set((s) => ({ data: pag.recordApiTest(s.data, appId, s.demoNow) })),
      addFieldStaff: (partnerId, st) => set((s) => ({ data: pag.addFieldStaff(s.data, partnerId, st) })),
      completePractice: (staffId) => set((s) => ({ data: pag.completePractice(s.data, staffId) })),
      markReadyForTrial: (appId, by) => set((s) => ({ data: pag.markReadyForTrial(s.data, appId, by, s.demoNow) })),
      simulateTrialJob: (partnerId) => set((s) => ({ data: pag.simulateTrialJob(s.data, partnerId, s.demoNow) })),
      decideTrial: (partnerId, d, reasons, by) => set((s) => ({ data: pag.decideTrial(s.data, partnerId, d, reasons, by, s.demoNow) })),
      autoDecideCommercial: (id, kind) => set((s) => ({ data: pag.autoDecideCommercial(s.data, id, kind, s.demoNow) })),


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
