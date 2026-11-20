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
import type { FieldStaff, JobPushEvent, PartnerIntegration, ApiKey, WebhookEvent, LegType, Rfq, SettingsChange, SosAlert, SuspensionTrigger, Tier, Consignee, Customer, DemoData, Id, IsoDate, IsoDateTime, KycRecord, LeadStage, PartnerAgreement, PartnerDocKey, PickupLocation, Qualification, ShipmentEvent, VerificationResult } from '@shared/types'
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
import * as wt from './weightActions'
import * as ndr from './ndrActions'
import * as ct from './controlTowerActions'
import * as clm from './claimActions'
import * as money from './moneyActions'
import * as pay from './payoutActions'
import * as exc from './exceptionActions'
import * as sc from './scoringActions'
import * as net from './networkActions'
import * as dept from './departmentActions'
import type { NewRfq } from './departmentActions'
import * as cs from './customerSettingsActions'
import * as ps from './partnerSettingsActions'
import * as fa from './fieldAppActions'
import type { HubInput, PortalUserError, PortalUserInput, StaffEdit, StaffError, StaffInput, VehicleError, VehicleInput } from './partnerSettingsActions'
import type { ConsigneeInput, LocationInput, SkuInput, TicketInput, UserError, UserInput } from './customerSettingsActions'
import type { CapacityEdit, CoverageChange, LaneEdit, NewPincode, PincodeEdit } from './networkActions'
import type { HubReport, PickupFailed, TicketResolution } from './exceptionActions'
import type { PartnerCodDeposit, UploadInvoice } from './payoutActions'
import type { CodDeposit } from './moneyActions'
import type { PayMethod } from '@shared/sim/payment'
import type { PartnerClaimResponse, RaiseClaim, Settle } from './claimActions'
import type { Reassign, TicketAction } from './controlTowerActions'
import type { NdrChoice, ReportNdr } from './ndrActions'
import type { DisputeInput } from './weightActions'
import type { CommercialDecisionKind, LineEdit, NewStaff } from './partnerAgreementActions'
import type { AuditItems, CheckInput, PartnerApplyInput, PartnerDecisionKind, VerificationDecision } from './partnerOnboardingActions'
import type { IntegrationStep, RateEdit, SkuRow } from './contractActions'
import type { AppointmentInput } from './appointmentActions'
import type { CompleteDelivery, GiveToRider, ReceiveLoad } from './deliveryActions'
import type { ArrivalHandover, ReportHalt, StartTrip } from './tripActions'

export const STORAGE_KEY = 'logisco-demo-v1'
/** Bump when the seed or data shape changes: saved data from an older version is replaced by a fresh seed. */
export const STORE_VERSION = 26

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
  /** Weight revisions (CP-20, ERP-31) */
  acceptRevision: (wrId: Id, by: Id) => void
  disputeRevision: (wrId: Id, d: DisputeInput, by: Id) => void
  resolveDispute: (wrId: Id, decision: 'upheld' | 'reversed', note: string, by: Id) => void
  /** Failed delivery (PA-35, CP-21, CP-18) */
  reportNdr: (x: ReportNdr) => void
  /** `by`: customer user id or 'consignee' */
  respondNdr: (lr: Id, c: NdrChoice, by: Id) => void
  /** Control Tower (ERP-06 to ERP-09) */
  reassignLeg: (x: Reassign, by: Id) => void
  applyRiskSuggestion: (legId: Id, by: Id) => void
  dismissRisk: (legId: Id, reason: string, by: Id) => void
  ticketAction: (id: Id, action: TicketAction, note: string, by: Id) => void
  closeTicket: (id: Id, note: string, by: Id) => void
  contactPartner: (partnerId: Id, kind: 'call' | 'message', by: Id) => void
  /** Claims (CP-22, ERP-36/37, PP-22) */
  raiseClaim: (x: RaiseClaim, by: Id) => Id | undefined
  addClaimInfo: (id: Id, text: string, files: string[], by: Id) => void
  startInvestigation: (id: Id, by: Id) => void
  settleClaim: (id: Id, x: Settle, by: Id) => void
  requestClaimConfirmation: (id: Id, by: Id) => void
  confirmClaim: (id: Id, by: Id) => void
  reopenClaim: (id: Id, reason: string, by: Id) => void
  respondToClaim: (id: Id, r: PartnerClaimResponse, by: Id) => void
  decidePartnerClaim: (id: Id, d: 'upheld' | 'waived' | 'recoveredFromInsurer', note: string, by: Id) => void
  /** Customer money (CP-23/24/25, PA-36, ERP-31/34) */
  rechargeWallet: (customerId: Id, amount: number, method: PayMethod, by: Id) => string | undefined
  payInvoices: (invoiceIds: Id[], method: PayMethod, by: Id) => string | undefined
  generateInvoices: (period: string, customerIds: Id[], by: Id) => Id[]
  sendReminder: (customerId: Id, channel: 'email' | 'whatsapp', by: Id) => void
  depositCod: (staffId: Id, x: CodDeposit) => void
  createRemittanceBatch: (customerId: Id, by: Id) => Id | undefined
  decideRemittanceBatch: (id: Id, decision: 'approve' | 'hold', by: Id) => void
  raiseCodShortage: (recordId: Id, amount: number, evidence: string, by: Id) => void
  /** Partner money (PP-25..28, ERP-32/33) */
  runSelfBilling: (cycle: string, by: Id) => Id[]
  uploadPartnerInvoice: (partnerId: Id, x: UploadInvoice, by: Id) => Id | undefined
  acceptMatchedLine: (invoiceId: Id, legId: Id, by: Id) => void
  disputeLine: (invoiceId: Id, legId: Id, reason: string, files: string[], by: Id) => void
  resolvePartnerDispute: (invoiceId: Id, legId: Id, x: { decision: 'matched' | 'billed' | 'partial'; amount?: number; note: string }, by: Id) => void
  approvePartnerInvoice: (invoiceId: Id, by: Id) => void
  submitPayoutBatch: (date: IsoDate, by: Id) => Id | undefined
  releasePayoutBatch: (id: Id, by: Id) => void
  requestEarlyPay: (partnerId: Id, amount: number, by: Id) => Id | undefined
  releaseEarlyPay: (id: Id, by: Id) => void
  recordPartnerCodDeposit: (partnerId: Id, x: PartnerCodDeposit, by: Id) => void
  /** Exceptions (PA-18, PA-30, PP-20, PP-21, PA-12) */
  reportPickupFailed: (x: PickupFailed) => void
  reportHubException: (x: HubReport) => Id | undefined
  acknowledgeTicket: (id: Id, by: Id) => void
  resolvePartnerTicket: (id: Id, r: TicketResolution, by: Id) => void
  injectEscalation: (partnerId: Id) => Id | undefined
  assignReattempt: (legId: Id, staffId: Id, by: Id) => void
  triggerSos: (staffId: Id) => Id | undefined
  setSosKind: (id: Id, kind: NonNullable<SosAlert['kind']>) => void
  cancelSos: (id: Id) => void
  resolveSos: (id: Id, note: string, by: Id) => void
  /** Scoring and suspension (ERP-16, ERP-17, PP-24, PP-39) */
  overrideTier: (scoreId: Id, tier: Tier | undefined, reason: string, by: Id) => void
  publishScores: (week: IsoDate, by: Id) => void
  runWeeklyScoring: (by: Id) => IsoDate | undefined
  acknowledgePlan: (planId: Id, by: Id) => void
  openSuspensionCase: (partnerId: Id, trigger: SuspensionTrigger, reason: string, by: Id) => void
  freezePartner: (caseId: Id, by: Id) => void
  decideInFlight: (caseId: Id, legId: Id, decision: 'finish' | 'transfer', by: Id) => void
  moveToSettlement: (caseId: Id, by: Id) => void
  requestClose: (caseId: Id, by: Id) => void
  approveClose: (caseId: Id, by: Id) => void
  respondToCase: (caseId: Id, text: string, by: Id) => void
  /** Network (ERP-18 to ERP-21, PP-18, PP-19) */
  updatePincode: (code: string, edit: PincodeEdit, by: Id) => void
  addPincode: (x: NewPincode, by: Id) => void
  updateLane: (id: Id, edit: LaneEdit, by: Id) => void
  proposeSettings: (changes: SettingsChange['changes'], reason: string, by: Id) => Id | undefined
  decideSettings: (id: Id, approve: boolean, by: Id) => void
  setCapacity: (partnerId: Id, x: CapacityEdit, by: Id) => void
  requestCoverageChange: (partnerId: Id, x: CoverageChange, by: Id) => Id | undefined
  decideCoverageChange: (id: Id, approve: boolean, note: string, by: Id) => void
  createRecruitmentNeed: (legType: LegType, place: string, by: Id) => void
  /** Light departments (ERP-28, ERP-29, ERP-39, ERP-40, ERP-41) */
  scheduleQbr: (customerId: Id, date: IsoDate, agenda: string, by: Id) => void
  logAccountNote: (customerId: Id, text: string, by: Id) => void
  createRfq: (x: NewRfq, by: Id) => Id | undefined
  setRfqStatus: (id: Id, status: Rfq['status'], note: string, by: Id) => void
  draftProposal: (id: Id, by: Id) => void
  replyTicket: (id: Id, text: string, resolve: boolean, by: Id) => void
  confirmSlot: (lr: Id, slot: { date: IsoDate; from: string; to: string }, by: Id) => void
  closeDpdpRequest: (id: Id, by: Id) => void
  /** Customer Portal settings and support (CP-28 to CP-34, CP-36, CP-37) */
  inviteCustomerUser: (customerId: Id, x: UserInput, by: Id) => { id?: Id; error?: UserError }
  updateCustomerUser: (id: Id, x: Omit<UserInput, 'email'>, by: Id) => { error?: UserError }
  setCustomerUserEnabled: (id: Id, enabled: boolean, by: Id) => { error?: UserError }
  resendInvite: (id: Id, by: Id) => void
  recordCustomerLogin: (id: Id) => void
  upsertPickupLocation: (customerId: Id, x: LocationInput, id: Id | undefined, by: Id) => { id?: Id; error?: 'required' | 'notServiceable' }
  setLocationActive: (id: Id, active: boolean, by: Id) => void
  setDefaultLocation: (id: Id, by: Id) => void
  saveAddress: (customerId: Id, x: ConsigneeInput, id: Id | undefined, by: Id) => { id?: Id; error?: 'required' | 'notServiceable' }
  removeAddress: (id: Id, by: Id) => void
  importAddresses: (customerId: Id, rows: ConsigneeInput[], by: Id) => { added: number; skipped: number }
  saveSku: (customerId: Id, x: SkuInput, id: Id | undefined, by: Id) => { id?: Id; error?: 'required' | 'codeTaken' }
  acceptSkuFlag: (id: Id, by: Id) => void
  importSkus: (customerId: Id, rows: SkuInput[], by: Id) => { added: number; flagged: number; skipped: number }
  createApiKey: (customerId: Id, name: string, env: ApiKey['env'], by: Id) => string | undefined
  revokeApiKey: (customerId: Id, keyId: Id, by: Id) => void
  addWebhook: (customerId: Id, url: string, events: WebhookEvent[], by: Id) => string | undefined
  removeWebhook: (customerId: Id, id: Id, by: Id) => void
  regenerateSecret: (customerId: Id, id: Id, by: Id) => string | undefined
  testWebhook: (customerId: Id, id: Id) => { status?: number; ms?: number }
  setErpConnector: (customerId: Id, erp: 'tally' | 'sap' | 'zoho' | undefined, by: Id) => void
  setOndcLink: (customerId: Id, sellerId: string | undefined, by: Id) => void
  saveBillingPrefs: (customerId: Id, prefs: NonNullable<Customer['billingPrefs']>, by: Id) => void
  changeBank: (customerId: Id, b: { holder: string; account: string; ifsc: string }, by: Id) => { ok: boolean; matchPct: number; nameReturned: string }
  replaceKycDoc: (customerId: Id, kind: NonNullable<Customer['kycDocs']>[number]['kind'], file: string, by: Id) => void
  setUserLanguage: (userId: Id, language: 'en' | 'hi') => void
  setConsigneeMessages: (customerId: Id, on: boolean, by: Id) => void
  raiseTicket: (customerId: Id, x: TicketInput, by: Id) => Id | undefined
  customerReplyTicket: (id: Id, text: string, attachment: string | undefined, by: Id) => void
  confirmResolved: (id: Id, by: Id) => void
  /** Partner Portal settings (PP-29 to PP-36) */
  createStaff: (partnerId: Id, x: StaffInput, by: Id) => { id?: Id; error?: StaffError }
  updateStaff: (id: Id, x: StaffEdit, by: Id) => { error?: StaffError }
  setStaffStatus: (id: Id, status: NonNullable<FieldStaff['status']>, by: Id) => void
  resendAppLink: (id: Id, by: Id) => void
  saveVehicle: (partnerId: Id, x: VehicleInput, id: Id | undefined, by: Id) => { id?: Id; error?: VehicleError }
  setVehicleActive: (id: Id, active: boolean, by: Id) => void
  saveHub: (partnerId: Id, x: HubInput, id: Id | undefined, by: Id) => { id?: Id; error?: 'required' | 'notServiceable' | 'safety' }
  uploadRenewal: (partnerId: Id, docId: Id, file: string, newExpiry: IsoDate, by: Id) => void
  changePartnerBank: (partnerId: Id, b: { holder: string; account: string; ifsc: string }, by: Id) => { ok: boolean; matchPct: number; nameReturned: string }
  requestExit: (partnerId: Id, reason: string, by: Id) => void
  invitePortalUser: (partnerId: Id, x: PortalUserInput, by: Id) => { id?: Id; error?: PortalUserError }
  updatePortalUser: (id: Id, x: Pick<PortalUserInput, 'name' | 'mobile' | 'role' | 'hubIds'>, by: Id) => { error?: PortalUserError }
  setPortalUserEnabled: (id: Id, enabled: boolean, by: Id) => { error?: PortalUserError }
  recordPartnerLogin: (id: Id) => void
  setPortalUserLanguage: (id: Id, language: 'en' | 'hi') => void
  createPartnerApiKey: (partnerId: Id, name: string, env: ApiKey['env'], by: Id) => string | undefined
  revokePartnerApiKey: (partnerId: Id, keyId: Id, by: Id) => void
  setJobWebhook: (partnerId: Id, url: string, events: JobPushEvent[], by: Id) => { saved: boolean; secret?: string }
  testJobWebhook: (partnerId: Id) => { status?: number; ms?: number }
  saveStatusMapping: (partnerId: Id, mapping: PartnerIntegration['statusMapping'], by: Id) => void
  /** Partner App personal (PA-10, PA-13) */
  syncNow: (staffId: Id) => void
  setFieldLanguage: (staffId: Id, language: FieldStaff['language']) => void
  setVoicePrompts: (staffId: Id, on: boolean) => void
  watchVideo: (staffId: Id, videoId: string) => void
  passPractice: (staffId: Id, taskId: string) => void
  completeTraining: (staffId: Id) => void
  /** Demo toolbar: Deccan's third trial trip (the hero trip) */
  completeTrialTrip: (tripId: Id) => void
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
          // … and weight revisions left unanswered for 48 hours are accepted (CP-20 rule)
          // … and failed deliveries with no response get their reattempt (CP-21 rule)
          // … and new exceptions are auto-ticketed (source §10 Steps 1–2)
          return { demoNow, data: ct.raiseAutoTickets(money.codFromDeliveries(ndr.autoReattempt(wt.autoAcceptRevisions(advanceJourneys(s.data, s.demoNow, demoNow), demoNow), demoNow)), demoNow) }
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
      acceptRevision: (wrId, by) => set((s) => ({ data: wt.acceptRevision(s.data, wrId, by, s.demoNow) })),
      disputeRevision: (wrId, d, by) => set((s) => ({ data: wt.disputeRevision(s.data, wrId, d, by, s.demoNow) })),
      resolveDispute: (wrId, decision, note, by) => set((s) => ({ data: wt.resolveDispute(s.data, wrId, decision, note, by, s.demoNow) })),
      reportNdr: (x) => set((s) => ({ data: ndr.reportNdr(s.data, x, s.demoNow) })),
      respondNdr: (lr, c, by) => set((s) => ({ data: ndr.respondNdr(s.data, lr, c, by, s.demoNow) })),
      reassignLeg: (x, by) => set((s) => ({ data: ct.reassignLeg(s.data, x, by, s.demoNow) })),
      applyRiskSuggestion: (legId, by) => set((s) => ({ data: ct.applyRiskSuggestion(s.data, legId, by, s.demoNow) })),
      dismissRisk: (legId, reason, by) => set((s) => ({ data: ct.dismissRisk(s.data, legId, reason, by, s.demoNow) })),
      ticketAction: (id, action, note, by) => set((s) => ({ data: ct.ticketAction(s.data, id, action, note, by, s.demoNow) })),
      closeTicket: (id, note, by) => set((s) => ({ data: ct.closeTicket(s.data, id, note, by, s.demoNow) })),
      contactPartner: (partnerId, kind, by) => set((s) => ({ data: ct.contactPartner(s.data, partnerId, kind, by, s.demoNow) })),
      raiseClaim: (x, by) => {
        const r = clm.raiseClaim(get().data, x, by, get().demoNow)
        set({ data: r.data })
        return r.claimId
      },
      addClaimInfo: (id, text, files, by) => set((s) => ({ data: clm.addClaimInfo(s.data, id, text, files, by, s.demoNow) })),
      startInvestigation: (id, by) => set((s) => ({ data: clm.startInvestigation(s.data, id, by, s.demoNow) })),
      settleClaim: (id, x, by) => set((s) => ({ data: clm.settleClaim(s.data, id, x, by, s.demoNow) })),
      requestClaimConfirmation: (id, by) => set((s) => ({ data: clm.requestClaimConfirmation(s.data, id, by, s.demoNow) })),
      confirmClaim: (id, by) => set((s) => ({ data: clm.confirmClaim(s.data, id, by, s.demoNow) })),
      reopenClaim: (id, reason, by) => set((s) => ({ data: clm.reopenClaim(s.data, id, reason, by, s.demoNow) })),
      respondToClaim: (id, r, by) => set((s) => ({ data: clm.respondToClaim(s.data, id, r, by, s.demoNow) })),
      decidePartnerClaim: (id, d, note, by) => set((s) => ({ data: clm.decidePartnerClaim(s.data, id, d, note, by, s.demoNow) })),
      rechargeWallet: (customerId, amount, method, by) => {
        const r = money.rechargeWallet(get().data, customerId, amount, method, by, get().demoNow)
        set({ data: r.data })
        return r.ref
      },
      payInvoices: (ids, method, by) => {
        const r = money.payInvoices(get().data, ids, method, by, get().demoNow)
        set({ data: r.data })
        return r.ref
      },
      generateInvoices: (period, customerIds, by) => {
        const r = money.generateInvoices(get().data, period, customerIds, by, get().demoNow)
        set({ data: r.data })
        return r.ids
      },
      sendReminder: (customerId, channel, by) => set((s) => ({ data: money.sendReminder(s.data, customerId, channel, by, s.demoNow) })),
      depositCod: (staffId, x) => set((s) => ({ data: money.depositCod(s.data, staffId, x, s.demoNow) })),
      createRemittanceBatch: (customerId, by) => {
        const r = money.createRemittanceBatch(get().data, customerId, by, get().demoNow)
        set({ data: r.data })
        return r.id
      },
      decideRemittanceBatch: (id, decision, by) => set((s) => ({ data: money.decideRemittanceBatch(s.data, id, decision, by, s.demoNow) })),
      raiseCodShortage: (recordId, amount, evidence, by) => set((s) => ({ data: money.raiseCodShortage(s.data, recordId, amount, evidence, by, s.demoNow) })),
      runSelfBilling: (cycle, by) => {
        const r = pay.runSelfBilling(get().data, cycle, by, get().demoNow)
        set({ data: r.data })
        return r.ids
      },
      uploadPartnerInvoice: (partnerId, x, by) => {
        const r = pay.uploadPartnerInvoice(get().data, partnerId, x, by, get().demoNow)
        set({ data: r.data })
        return r.id
      },
      acceptMatchedLine: (invoiceId, legId, by) => set((s) => ({ data: pay.acceptMatchedLine(s.data, invoiceId, legId, by, s.demoNow) })),
      disputeLine: (invoiceId, legId, reason, files, by) => set((s) => ({ data: pay.disputeLine(s.data, invoiceId, legId, reason, files, by, s.demoNow) })),
      resolvePartnerDispute: (invoiceId, legId, x, by) => set((s) => ({ data: pay.resolveDispute(s.data, invoiceId, legId, x, by, s.demoNow) })),
      approvePartnerInvoice: (invoiceId, by) => set((s) => ({ data: pay.approvePartnerInvoice(s.data, invoiceId, by, s.demoNow) })),
      submitPayoutBatch: (date, by) => {
        const r = pay.submitPayoutBatch(get().data, date, by, get().demoNow)
        set({ data: r.data })
        return r.id
      },
      releasePayoutBatch: (id, by) => set((s) => ({ data: pay.releasePayoutBatch(s.data, id, by, s.demoNow) })),
      requestEarlyPay: (partnerId, amount, by) => {
        const r = pay.requestEarlyPay(get().data, partnerId, amount, by, get().demoNow)
        set({ data: r.data })
        return r.id
      },
      releaseEarlyPay: (id, by) => set((s) => ({ data: pay.releaseEarlyPay(s.data, id, by, s.demoNow) })),
      recordPartnerCodDeposit: (partnerId, x, by) => set((s) => ({ data: pay.recordPartnerCodDeposit(s.data, partnerId, x, by, s.demoNow) })),
      reportPickupFailed: (x) => set((s) => ({ data: exc.reportPickupFailed(s.data, x, s.demoNow) })),
      reportHubException: (x) => {
        const r = exc.reportHubException(get().data, x, get().demoNow)
        set({ data: r.data })
        return r.id
      },
      acknowledgeTicket: (id, by) => set((s) => ({ data: exc.acknowledgeTicket(s.data, id, by, s.demoNow) })),
      resolvePartnerTicket: (id, r, by) => set((s) => ({ data: exc.resolvePartnerTicket(s.data, id, r, by, s.demoNow) })),
      injectEscalation: (partnerId) => {
        const r = exc.injectEscalation(get().data, partnerId, get().demoNow)
        set({ data: r.data })
        return r.id
      },
      assignReattempt: (legId, staffId, by) => set((s) => ({ data: exc.assignReattempt(s.data, legId, staffId, by, s.demoNow) })),
      triggerSos: (staffId) => {
        const r = exc.triggerSos(get().data, staffId, get().demoNow)
        set({ data: r.data })
        return r.id
      },
      setSosKind: (id, kind) => set((s) => ({ data: exc.setSosKind(s.data, id, kind) })),
      cancelSos: (id) => set((s) => ({ data: exc.cancelSos(s.data, id, s.demoNow) })),
      resolveSos: (id, note, by) => set((s) => ({ data: exc.resolveSos(s.data, id, note, by, s.demoNow) })),
      overrideTier: (scoreId, tier, reason, by) => set((s) => ({ data: sc.overrideTier(s.data, scoreId, tier, reason, by, s.demoNow) })),
      publishScores: (week, by) => set((s) => ({ data: sc.publishScores(s.data, week, by, s.demoNow) })),
      runWeeklyScoring: (by) => {
        const r = sc.runWeeklyScoring(get().data, by, get().demoNow)
        set({ data: r.data })
        return r.week
      },
      acknowledgePlan: (planId, by) => set((s) => ({ data: sc.acknowledgePlan(s.data, planId, by, s.demoNow) })),
      openSuspensionCase: (partnerId, trigger, reason, by) => set((s) => ({ data: sc.openSuspensionCase(s.data, partnerId, trigger, reason, by, s.demoNow) })),
      freezePartner: (caseId, by) => set((s) => ({ data: sc.freezePartner(s.data, caseId, by, s.demoNow) })),
      decideInFlight: (caseId, legId, decision, by) => set((s) => ({ data: sc.decideInFlight(s.data, caseId, legId, decision, by, s.demoNow) })),
      moveToSettlement: (caseId, by) => set((s) => ({ data: sc.moveToSettlement(s.data, caseId, by, s.demoNow) })),
      requestClose: (caseId, by) => set((s) => ({ data: sc.requestClose(s.data, caseId, by, s.demoNow) })),
      approveClose: (caseId, by) => set((s) => ({ data: sc.approveClose(s.data, caseId, by, s.demoNow) })),
      respondToCase: (caseId, text, by) => set((s) => ({ data: sc.respondToCase(s.data, caseId, text, by, s.demoNow) })),
      updatePincode: (code, edit, by) => set((s) => ({ data: net.updatePincode(s.data, code, edit, by, s.demoNow) })),
      addPincode: (x, by) => set((s) => ({ data: net.addPincode(s.data, x, by, s.demoNow) })),
      updateLane: (id, edit, by) => set((s) => ({ data: net.updateLane(s.data, id, edit, by, s.demoNow) })),
      proposeSettings: (changes, reason, by) => {
        const r = net.proposeSettings(get().data, changes, reason, by, get().demoNow)
        set({ data: r.data })
        return r.id
      },
      decideSettings: (id, approve, by) => set((s) => ({ data: net.decideSettings(s.data, id, approve, by, s.demoNow) })),
      setCapacity: (partnerId, x, by) => set((s) => ({ data: net.setCapacity(s.data, partnerId, x, by, s.demoNow) })),
      requestCoverageChange: (partnerId, x, by) => {
        const r = net.requestCoverageChange(get().data, partnerId, x, by, get().demoNow)
        set({ data: r.data })
        return r.id
      },
      decideCoverageChange: (id, approve, note, by) => set((s) => ({ data: net.decideCoverageChange(s.data, id, approve, note, by, s.demoNow) })),
      createRecruitmentNeed: (legType, place, by) => set((s) => ({ data: net.createRecruitmentNeed(s.data, legType, place, by, s.demoNow) })),
      scheduleQbr: (customerId, date, agenda, by) => set((s) => ({ data: dept.scheduleQbr(s.data, customerId, date, agenda, by, s.demoNow) })),
      logAccountNote: (customerId, text, by) => set((s) => ({ data: dept.logAccountNote(s.data, customerId, text, by, s.demoNow) })),
      createRfq: (x, by) => {
        const r = dept.createRfq(get().data, x, by, get().demoNow)
        set({ data: r.data })
        return r.id
      },
      setRfqStatus: (id, status, note, by) => set((s) => ({ data: dept.setRfqStatus(s.data, id, status, note, by, s.demoNow) })),
      draftProposal: (id, by) => set((s) => ({ data: dept.draftProposal(s.data, id, by, s.demoNow) })),
      replyTicket: (id, text, resolve, by) => set((s) => ({ data: dept.replyTicket(s.data, id, text, resolve, by, s.demoNow) })),
      confirmSlot: (lr, slot, by) => set((s) => ({ data: dept.confirmSlot(s.data, lr, slot, by, s.demoNow) })),
      closeDpdpRequest: (id, by) => set((s) => ({ data: dept.closeDpdpRequest(s.data, id, by, s.demoNow) })),
      ...(() => {
        // Run a pure action against the current data; keep what it returns besides the data
        const run = <R extends { data: DemoData }>(fn: (d: DemoData, now: IsoDateTime) => R): Omit<R, 'data'> => {
          const { data, ...rest } = fn(get().data, get().demoNow)
          set({ data })
          return rest
        }
        const upd = (fn: (d: DemoData, now: IsoDateTime) => DemoData) => set((s) => ({ data: fn(s.data, s.demoNow) }))
        return {
          inviteCustomerUser: (customerId: Id, x: UserInput, by: Id) => run((d, now) => cs.inviteCustomerUser(d, customerId, x, by, now)),
          updateCustomerUser: (id: Id, x: Omit<UserInput, 'email'>, by: Id) => run((d, now) => cs.updateCustomerUser(d, id, x, by, now)),
          setCustomerUserEnabled: (id: Id, enabled: boolean, by: Id) => run((d, now) => cs.setCustomerUserEnabled(d, id, enabled, by, now)),
          resendInvite: (id: Id, by: Id) => upd((d, now) => cs.resendInvite(d, id, by, now)),
          recordCustomerLogin: (id: Id) => upd((d, now) => cs.recordCustomerLogin(d, id, now)),
          upsertPickupLocation: (customerId: Id, x: LocationInput, id: Id | undefined, by: Id) => run((d, now) => cs.savePickupLocation(d, customerId, x, id, by, now)),
          setLocationActive: (id: Id, active: boolean, by: Id) => upd((d, now) => cs.setLocationActive(d, id, active, by, now)),
          setDefaultLocation: (id: Id, by: Id) => upd((d, now) => cs.setDefaultLocation(d, id, by, now)),
          saveAddress: (customerId: Id, x: ConsigneeInput, id: Id | undefined, by: Id) => run((d, now) => cs.saveAddress(d, customerId, x, id, by, now)),
          removeAddress: (id: Id, by: Id) => upd((d, now) => cs.removeAddress(d, id, by, now)),
          importAddresses: (customerId: Id, rows: ConsigneeInput[], by: Id) => run((d, now) => cs.importAddresses(d, customerId, rows, by, now)),
          saveSku: (customerId: Id, x: SkuInput, id: Id | undefined, by: Id) => run((d, now) => cs.saveSku(d, customerId, x, id, by, now)),
          acceptSkuFlag: (id: Id, by: Id) => upd((d, now) => cs.acceptSkuFlag(d, id, by, now)),
          importSkus: (customerId: Id, rows: SkuInput[], by: Id) => run((d, now) => cs.importSkus(d, customerId, rows, by, now)),
          createApiKey: (customerId: Id, name: string, env: ApiKey['env'], by: Id) => run((d, now) => cs.createApiKey(d, customerId, name, env, by, now)).key,
          revokeApiKey: (customerId: Id, keyId: Id, by: Id) => upd((d, now) => cs.revokeApiKey(d, customerId, keyId, by, now)),
          addWebhook: (customerId: Id, url: string, events: WebhookEvent[], by: Id) => run((d, now) => cs.addWebhook(d, customerId, url, events, by, now)).secret,
          removeWebhook: (customerId: Id, id: Id, by: Id) => upd((d, now) => cs.removeWebhook(d, customerId, id, by, now)),
          regenerateSecret: (customerId: Id, id: Id, by: Id) => run((d, now) => cs.regenerateSecret(d, customerId, id, by, now)).secret,
          testWebhook: (customerId: Id, id: Id) => run((d, now) => cs.testWebhook(d, customerId, id, now)),
          setErpConnector: (customerId: Id, erpKind: 'tally' | 'sap' | 'zoho' | undefined, by: Id) => upd((d, now) => cs.setErpConnector(d, customerId, erpKind, by, now)),
          setOndcLink: (customerId: Id, sellerId: string | undefined, by: Id) => upd((d, now) => cs.setOndcLink(d, customerId, sellerId, by, now)),
          saveBillingPrefs: (customerId: Id, prefs: NonNullable<Customer['billingPrefs']>, by: Id) => upd((d, now) => cs.saveBillingPrefs(d, customerId, prefs, by, now)),
          changeBank: (customerId: Id, b: { holder: string; account: string; ifsc: string }, by: Id) => run((d, now) => cs.changeBank(d, customerId, b, by, now)),
          replaceKycDoc: (customerId: Id, kind: NonNullable<Customer['kycDocs']>[number]['kind'], file: string, by: Id) => upd((d, now) => cs.replaceKycDoc(d, customerId, kind, file, by, now)),
          setUserLanguage: (userId: Id, language: 'en' | 'hi') => upd((d) => cs.setUserLanguage(d, userId, language)),
          setConsigneeMessages: (customerId: Id, on: boolean, by: Id) => upd((d, now) => cs.setConsigneeMessages(d, customerId, on, by, now)),
          raiseTicket: (customerId: Id, x: TicketInput, by: Id) => run((d, now) => cs.raiseTicket(d, customerId, x, by, now)).id,
          customerReplyTicket: (id: Id, text: string, attachment: string | undefined, by: Id) => upd((d, now) => cs.customerReplyTicket(d, id, text, attachment, by, now)),
          confirmResolved: (id: Id, by: Id) => upd((d, now) => cs.confirmResolved(d, id, by, now)),
          createStaff: (partnerId: Id, x: StaffInput, by: Id) => run((d, now) => ps.createStaff(d, partnerId, x, by, now)),
          updateStaff: (id: Id, x: StaffEdit, by: Id) => run((d, now) => ps.updateStaff(d, id, x, by, now)),
          setStaffStatus: (id: Id, status: NonNullable<FieldStaff['status']>, by: Id) => upd((d, now) => ps.setStaffStatus(d, id, status, by, now)),
          resendAppLink: (id: Id, by: Id) => upd((d, now) => ps.resendAppLink(d, id, by, now)),
          saveVehicle: (partnerId: Id, x: VehicleInput, id: Id | undefined, by: Id) => run((d, now) => ps.saveVehicle(d, partnerId, x, id, by, now)),
          setVehicleActive: (id: Id, active: boolean, by: Id) => upd((d, now) => ps.setVehicleActive(d, id, active, by, now)),
          saveHub: (partnerId: Id, x: HubInput, id: Id | undefined, by: Id) => run((d, now) => ps.saveHub(d, partnerId, x, id, by, now)),
          uploadRenewal: (partnerId: Id, docId: Id, file: string, newExpiry: IsoDate, by: Id) => upd((d, now) => ps.uploadRenewal(d, partnerId, docId, file, newExpiry, by, now)),
          changePartnerBank: (partnerId: Id, b: { holder: string; account: string; ifsc: string }, by: Id) => run((d, now) => ps.changePartnerBank(d, partnerId, b, by, now)),
          requestExit: (partnerId: Id, reason: string, by: Id) => upd((d, now) => ps.requestExit(d, partnerId, reason, by, now)),
          invitePortalUser: (partnerId: Id, x: PortalUserInput, by: Id) => run((d, now) => ps.invitePortalUser(d, partnerId, x, by, now)),
          updatePortalUser: (id: Id, x: Pick<PortalUserInput, 'name' | 'mobile' | 'role' | 'hubIds'>, by: Id) => run((d, now) => ps.updatePortalUser(d, id, x, by, now)),
          setPortalUserEnabled: (id: Id, enabled: boolean, by: Id) => run((d, now) => ps.setPortalUserEnabled(d, id, enabled, by, now)),
          recordPartnerLogin: (id: Id) => upd((d, now) => ps.recordPartnerLogin(d, id, now)),
          setPortalUserLanguage: (id: Id, language: 'en' | 'hi') => upd((d) => ps.setPortalUserLanguage(d, id, language)),
          createPartnerApiKey: (partnerId: Id, name: string, env: ApiKey['env'], by: Id) => run((d, now) => ps.createPartnerApiKey(d, partnerId, name, env, by, now)).key,
          revokePartnerApiKey: (partnerId: Id, keyId: Id, by: Id) => upd((d, now) => ps.revokePartnerApiKey(d, partnerId, keyId, by, now)),
          setJobWebhook: (partnerId: Id, url: string, events: JobPushEvent[], by: Id) => {
            const before = get().data
            const r = run((d, now) => ps.setJobWebhook(d, partnerId, url, events, by, now))
            return { saved: get().data !== before, secret: r.secret }
          },
          testJobWebhook: (partnerId: Id) => run((d, now) => ps.testJobWebhook(d, partnerId, now)),
          saveStatusMapping: (partnerId: Id, mapping: PartnerIntegration['statusMapping'], by: Id) => upd((d, now) => ps.saveStatusMapping(d, partnerId, mapping, by, now)),
          syncNow: (staffId: Id) => upd((d, now) => fa.syncNow(d, staffId, !get().flags.offline, now)),
          setFieldLanguage: (staffId: Id, language: FieldStaff['language']) => upd((d) => fa.setFieldLanguage(d, staffId, language)),
          setVoicePrompts: (staffId: Id, on: boolean) => upd((d) => fa.setVoicePrompts(d, staffId, on)),
          watchVideo: (staffId: Id, videoId: string) => upd((d) => fa.watchVideo(d, staffId, videoId)),
          passPractice: (staffId: Id, taskId: string) => upd((d) => fa.passPractice(d, staffId, taskId)),
          completeTraining: (staffId: Id) => upd((d, now) => fa.completeTraining(d, staffId, now)),
        }
      })(),
      completeTrialTrip: (tripId) => set((s) => ({ data: trip.completeTrialTrip(s.data, tripId, s.demoNow) })),


      setFlag: (flag, value) =>
        set((s) => ({
          flags: { ...s.flags, [flag]: value },
          // PA-13: back online → every phone's queue is sent
          ...(flag === 'offline' && !value && s.flags.offline ? { data: fa.syncNow(s.data, undefined, true, s.demoNow) } : {}),
        })),

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

// PA-13 (SIMULATED offline): while the Partner App is offline, its new events are also listed in the phone's sync queue
useDemoStore.subscribe((s, prev) => {
  if (!s.flags.offline || s.data.events === prev.data.events) return
  const next = fa.queueOfflineEvents(prev.data, s.data, s.demoNow)
  if (next !== s.data) useDemoStore.setState({ data: next })
})
