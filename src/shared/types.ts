/**
 * Domain types for the shared demo store — source: docs/data-model.md.
 * Conventions:
 *  - Every entity has `id: string`.
 *  - Timestamps are ISO strings in IST, e.g. "2026-11-23T10:05:00+05:30" (see lib/time.ts).
 *  - Money is in rupees as a number rounded to 2 decimals (see engines' round2).
 *  - Shipment.status and Leg.status are DERIVED by engines/status.ts from events.
 *    Apps never set them directly (CLAUDE.md rule 2).
 */

export type Id = string
export type IsoDateTime = string
/** "YYYY-MM-DD" (IST calendar date) */
export type IsoDate = string

// ─── Enumerations ──────────────────────────────────────────────────────────────

/** Customer-facing shipment status list (Customer Portal spec §8). */
export const SHIPMENT_STATUSES = [
  'booked',
  'pickedUp',
  'atOriginHub',
  'inTransit',
  'atDestinationHub',
  'outForDelivery',
  'delivered',
  'undelivered',
  'deliveredWithException',
  'returnToOrigin',
  'cancelled',
] as const
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]

/** Leg (job) status list (Partner Portal spec §8). */
export const LEG_STATUSES = [
  'offered',
  'accepted',
  'flagged',
  'withdrawn',
  'assigned',
  'inProgress',
  'handedOver',
  'delivered',
  'failedAttempt',
  'exception',
  'closed',
] as const
export type LegStatus = (typeof LEG_STATUSES)[number]

export const LEG_TYPES = ['firstMile', 'originHub', 'lineHaul', 'destHub', 'lastMile'] as const
export type LegType = (typeof LEG_TYPES)[number]

export type ServiceKind = 'parcel' | 'ptl'
export type ParcelTier = 'economy' | 'standard' | 'express'
export type PtlService = 'expressPtl' | 'standardPtl'
export type Service = ParcelTier | PtlService

/** Parcel zones (assumed): A within city · B within state · C metro↔metro · D rest of India · E special */
export type ParcelZone = 'A' | 'B' | 'C' | 'D' | 'E'

export type PaymentMode = 'paid' | 'toPay' | 'tbb' | 'cod'

export type PartnerType = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
export type Tier = 'platinum' | 'gold' | 'silver' | 'bronze' | 'probation'
export type PartnerStatus =
  | 'applied'
  | 'kyc'
  | 'agreement'
  | 'integration'
  | 'trial'
  | 'live'
  | 'probation'
  | 'suspended'
  | 'offboarded'

export type AppKey = 'customer' | 'partnerPortal' | 'partnerApp' | 'erp'

// ─── Master data ───────────────────────────────────────────────────────────────

export interface Pincode {
  id: Id // = code
  code: string
  area: string
  city: string
  state: string
  /** Rate region used by PTL lanes, e.g. "Delhi NCR", "Karnataka" */
  region: string
  /** Hub that serves this pincode (origin / destination hub for long-haul legs) */
  hubId?: Id
  metro: boolean
  /** Zone E: North-East, J&K */
  special: boolean
  oda: boolean
  serviceable: boolean
  lat: number
  lng: number
}

export interface Hub {
  id: Id
  partnerId: Id
  name: string
  address: string
  pincode: string
  docks: number
  hours: string
  auditStatus: 'pending' | 'passed' | 'failed'
}

/** PP-19 → ERP-21: a partner asks to add or remove pincodes or lanes; Network Planning decides. */
export interface CoverageRequest {
  id: Id
  partnerId: Id
  action: 'add' | 'remove'
  pincodes: string[]
  laneIds: Id[]
  effectiveFrom: IsoDate
  reason: string
  requestedBy: Id
  requestedAt: IsoDateTime
  status: 'pending' | 'approved' | 'rejected'
  decidedBy?: Id
  decidedAt?: IsoDateTime
  note?: string
}

/** ERP-21 "Create recruitment need": raises the network-fit score of matching applicants (ERP-11). */
export interface RecruitmentNeed {
  id: Id
  legType: LegType
  /** Pincode for first / last mile; lane id for line-haul */
  place: string
  createdBy: Id
  createdAt: IsoDateTime
  open: boolean
}

/** ERP-20 settings change waiting for approval (maker-checker). */
export interface SettingsChange {
  id: Id
  changes: Partial<Pick<Settings, 'pickupCutoff' | 'lineHaulArrival' | 'destHubHandoverBy' | 'intraRegionHubBy'>>
  reason: string
  by: Id
  at: IsoDateTime
  status: 'pending' | 'approved' | 'rejected'
  checkerId?: Id
  decidedAt?: IsoDateTime
}

export interface Lane {
  id: Id
  originRegion: string
  destRegion: string
  originHubId: Id
  destHubId: Id
  distanceKm: number
  transitDays: Record<Service, number>
  /** "HH:mm" IST, daily */
  departureTime: string
  lineHaulPartnerIds: Id[]
}

export interface ParcelRate {
  first: number // first 0.5 kg
  additional: number // each additional 0.5 kg
}

export interface PtlRateLine {
  laneId: Id
  service: PtlService
  perKg: number
  minKg: number
  cftFactor: number
}

export interface Surcharges {
  fuelPct: number
  odaPerKg: number
  odaMin: number
  docketPtl: number
  docketParcel: number
  appointment: number
  codPct: number
  codMin: number
  toPayFee: number
  fovPct: number
  specialHandlingPerPiece: number
  liabilityPerKg: number
  liabilityMax: number
}

export interface CustomerRateCard {
  id: Id
  name: string
  customerId?: Id
  type: 'standard' | 'negotiated' | 'contract'
  parcel: Record<ParcelZone, Record<ParcelTier, ParcelRate>>
  ptl: PtlRateLine[]
  surcharges: Surcharges
  validFrom: IsoDate
  validTo: IsoDate
  status: 'draft' | 'pendingApproval' | 'live' | 'expired'
  /** ERP-22 / ERP-23: who asked for approval, and the decision */
  approval?: { requestedBy: Id; requestedAt: IsoDateTime; decidedBy?: Id; decidedAt?: IsoDateTime; decision?: 'approve' | 'reject' | 'sendBack'; comment?: string }
}

export type RateUnit = 'perShipment' | 'perKg' | 'perTrip' | 'perPiece' | 'storagePerDay'

export interface PartnerRateLine {
  id: Id
  partnerId: Id
  legType: LegType
  /** Lane id for line-haul; hub id for hub legs and for the first / last-mile cluster around that hub */
  laneOrCluster: string
  /** Omitted = applies to both parcel and PTL */
  serviceKind?: ServiceKind
  rate: number
  unit: RateUnit
  /** Minimum charge in ₹ */
  minimum?: number
  /** Minimum chargeable weight in kg (per-kg lines) */
  minKg?: number
  /** Max weight this line covers, e.g. "PTL pickup up to 200 kg" */
  maxKg?: number
  /** Line-haul only: applies to drops in this city beyond the destination hub (e.g. Belagavi on Delhi → Hubballi) */
  destCity?: string
  note?: string
}

/** ERP-44 system settings — seed-data.md §9 */
export interface Settings {
  ewayBillThreshold: number
  ewayBillKmPerDay: number
  targetMarginPct: number
  riskBufferPct: number
  pickupCutoff: string // "HH:mm"
  /** ERP-20 leg windows (source §8: cut-offs and hand-over windows aligned so legs connect) */
  lineHaulArrival: string
  destHubHandoverBy: string
  intraRegionHubBy: string
  partnerAcceptanceMinutes: number
  arrivalGeofenceM: number
  weightTolerancePct: number
  weightToleranceKg: number
  ndrMaxAttempts: number
  codDepositHours: number
  codRemittanceDays: number
  codRemittanceDaysTopTier: number
  partnerDisputeSlaHours: number
  claimSettlementDays: number
  claimWindowDays: number
  earlyPayFeePct: number
  creditGraceDays: number
  trialPassMark: number
  /** Source §5.3: Bronze partner falling below 60 → volume cut by 50% */
  probationVolumeCutPct: number
  gstPct: number
  volumetricDivisor: number
  ptlMinKgExpress: number
  ptlMinKgStandard: number
  cftFactor: number
  tierBands: Record<Exclude<Tier, 'probation'>, number> // lower bound of each band
}

// ─── Customers ─────────────────────────────────────────────────────────────────

export type CustomerType = 'sme' | 'manufacturer' | 'distributor' | 'brand' | 'enterprise' | 'marketplace'
/** Source §6: self-serve SME · inside sales · KAM · KAM + solutions team · API / ONDC self-serve */
export type CustomerTrack = 'selfServe' | 'insideSales' | 'kam' | 'kamSolutions' | 'apiOndc'
export type CustomerStatus =
  | 'lead'
  | 'qualified'
  | 'kyc'
  | 'credit'
  | 'contract'
  | 'integration'
  | 'pilot'
  | 'live'
  | 'onHold'

export interface Customer {
  id: Id
  legalName: string
  shortName: string
  gstin: string
  pan: string
  cin?: string
  entityType: string
  type: CustomerType
  /** Onboarding track (source §6 customer types; ERP-27) */
  track: CustomerTrack
  status: CustomerStatus
  billing: 'prepaid' | 'credit'
  creditLimit: number
  creditUsed: number
  creditTermsDays: number
  securityDeposit: number
  walletBalance: number
  /**
   * Billed value this calendar month (CP-11 "Spend this month"). Seeded as a
   * snapshot that covers unmodelled shipments too; every booking adds its total.
   */
  spendMonthToDate: number
  /** ERP-28 / ERP-39 account health: latest NPS survey score (seeded) */
  nps?: number
  kamId?: Id
  rateCardId: Id
  bank?: { name: string; branch: string; ifsc: string; account: string }
  signatory?: { name: string; designation: string; email: string; mobile: string }
  /** CP-09 (source §6 Step 6): ERP connector, API key, ONDC link, Excel template */
  integrations: {
    tally: boolean
    erp?: 'tally' | 'sap' | 'zoho'
    apiKey?: string
    ondcSellerId?: string
    templateDownloaded?: boolean
    /** CP-32 */
    erpSync?: { lastAt: IsoDateTime; everyMinutes: number }
    apiKeys?: ApiKey[]
    webhooks?: Webhook[]
  }
  branding?: { logoUrl?: string; colour?: string }
  /** CP-33 billing settings */
  billingPrefs?: { address: string; frequency: 'perShipment' | 'monthly'; emails: string; poMandatory: boolean }
  /** CP-33 KYC documents on file */
  kycDocs?: { kind: 'gst' | 'pan' | 'coi' | 'cheque'; file: string; uploadedAt: IsoDateTime; expiresOn?: IsoDate }[]
  reKycDue?: IsoDate
  /** CP-34 (source §13): tracking, appointment and delivery messages to receivers. Default on. */
  consigneeMessages?: boolean
  city: string
  /** Onboarding record (CP-04 to CP-10, ERP-26/27/30); absent for accounts seeded live */
  onboarding?: CustomerOnboarding
}

export type BusinessType = CustomerType
export type LeadSource = 'website' | 'salesVisit' | 'referral' | 'ondc' | 'tender' | 'partnerReferral'
export type SpendBand = 'lt50k' | '50kTo2l' | '2lTo10l' | '10lTo50l' | 'gt50l'
export type CheckState = 'notStarted' | 'verified' | 'flagged'

export interface Qualification {
  shipmentsPerMonth: number
  spendBand: SpendBand
  /** Share of Parcel, 0–100; the rest is PTL */
  parcelPct: number
  lanes: { originPincode: string; destCity: string; perMonth: number }[]
  specialHandling: ('fragile' | 'heavy' | 'appointment' | 'oda' | 'reverse')[]
  payment: ('prepaid' | 'tbb' | 'toPay' | 'cod')[]
}

export interface KycRecord {
  gstin: { state: CheckState; legalName?: string; tradeName?: string; address?: string; active?: boolean; registeredOn?: IsoDate; constitution?: string }
  pan: { state: CheckState; value: string }
  cin?: string
  signatory?: { name: string; designation: string; email: string; mobile: string }
  bank: { state: CheckState; holder?: string; account?: string; ifsc?: string; bankName?: string; branch?: string; type?: 'current' | 'savings'; nameReturned?: string; matchPct?: number }
  /** notStarted → submitted: verified, or underReview when a check was flagged → verified after review */
  status: 'notStarted' | 'underReview' | 'verified'
  submittedAt?: IsoDateTime
  reviewedBy?: Id
}

export interface CreditApplication {
  requestedLimit: number
  termsDays: 15 | 30 | 45
  yearsInBusiness: number
  gstConsent: boolean
  depositWilling: boolean
  submittedAt: IsoDateTime
  status: 'underReview' | 'approved' | 'approvedLower' | 'declined'
  /** Logisco's AI credit-risk score (never shown to the customer) */
  score: number
  scoreReasons: string[]
  approvedLimit?: number
  approvedTerms?: 15 | 30 | 45
  deposit?: number
  remarks?: string
  decidedBy?: Id
  decidedAt?: IsoDateTime
  /** Customer accepted the terms → billing switches to TBB */
  accepted?: boolean
}

export interface CustomerOnboarding {
  source: LeadSource
  referralCode?: string
  industry: string
  createdAt: IsoDateTime
  privacyConsent: boolean
  gstConsent: boolean
  qualification?: Qualification
  kyc?: KycRecord
  credit?: CreditApplication
  contract?: ContractRecord
  /** CP-09 done (or skipped: portal booking only) */
  integrationDone?: { at: IsoDateTime; skipped: boolean }
  /** Source §6 Step 7: 2 weeks of hyper-care */
  pilot?: { start: IsoDate; end: IsoDate; kpis: { onTimePct: number; maxExceptionPct: number } }
  liveAt?: IsoDateTime
}

/** Source §6 Step 5: rate card, SLA and contract, generated and e-signed. */
export interface ContractRecord {
  rateCardId: Id
  issuedAt: IsoDateTime
  issuedBy: Id
  status: 'issued' | 'changesRequested' | 'signed'
  effectiveDate: IsoDate
  termMonths: number
  changeRequests: { at: IsoDateTime; by: Id; line: string; remark: string }[]
  signedAt?: IsoDateTime
  signedBy?: Id
  method?: 'aadhaarOtp' | 'dsc' | 'clickWrap'
}

export type CustomerRole = 'admin' | 'dispatch' | 'finance'

/** CP-32 API key. The full key is shown once at creation; only the last 4 are kept. */
export interface ApiKey {
  id: Id
  name: string
  env: 'sandbox' | 'production'
  last4: string
  createdAt: IsoDateTime
  lastUsedAt?: IsoDateTime
  revokedAt?: IsoDateTime
}

export const WEBHOOK_EVENTS = ['booked', 'pickedUp', 'inTransit', 'outForDelivery', 'delivered', 'ndr', 'exception', 'invoice'] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export interface Webhook {
  id: Id
  url: string
  events: WebhookEvent[]
  secretLast4: string
  createdAt: IsoDateTime
  /** SIMULATED test delivery */
  lastTest?: { at: IsoDateTime; status: number }
}

export interface CustomerUser {
  id: Id
  customerId: Id
  name: string
  title?: string
  email: string
  mobile: string
  role: CustomerRole
  /** Pickup locations this user can book from; empty = all (CP-28) */
  locationIds: Id[]
  language: 'en' | 'hi'
  /** CP-28: Invited until first login. Default active. */
  status?: 'active' | 'invited' | 'disabled'
  invitedAt?: IsoDateTime
  lastLoginAt?: IsoDateTime
}

export interface PickupLocation {
  id: Id
  customerId: Id
  name: string
  address: string
  pincode: string
  lat: number
  lng: number
  contact: { name: string; mobile: string }
  window: { from: string; to: string } // "HH:mm"
  days: string // e.g. "Mon–Sat"
  isDefault: boolean
  /** CP-29: inactive locations can't be booked from. Default true. */
  active?: boolean
}

/** CP-13 Step 2 consignee types */
export type ConsigneeCategory = 'distributor' | 'retailer' | 'dc' | 'modernTrade' | 'factory' | 'otherBusiness'

export interface Consignee {
  id: Id
  customerId: Id
  type: 'business' | 'individual'
  category?: ConsigneeCategory
  company: string
  contact: string
  mobile: string
  altMobile?: string
  email?: string
  /** Address line 1 */
  address: string
  /** Address line 2 / landmark */
  landmark?: string
  pincode: string
  gstin?: string
  appointmentRequired: boolean
  /** Shown in the address book (CP-30). False = kept only for the shipments that used it. Default true. */
  saved?: boolean
  /** CP-30: pre-selected when booking to this consignee */
  defaultService?: 'parcel' | PtlService
  /** CP-30: holidays / receiving hours, used for appointment slots */
  receivingHours?: string
}

export interface Sku {
  id: Id
  customerId: Id
  code: string
  description: string
  l: number
  b: number
  h: number
  weight: number
  hsn: string
  unitValue: number
  /** frozen = verified by Logisco; flagged = AI outlier; draft = with Logisco for review */
  status: 'draft' | 'flagged' | 'frozen'
}

/** ERP-26 pipeline stages (source §6 phases) */
export const LEAD_STAGES = ['new', 'qualified', 'kyc', 'credit', 'contract', 'pilot', 'live', 'lost'] as const
export type LeadStage = (typeof LEAD_STAGES)[number]

export interface Lead {
  id: Id
  company: string
  gstin: string
  source: LeadSource
  industry: string
  businessType: CustomerType
  /** Declared shipments per month (from qualification) */
  declaredVolume?: number
  /** AI lead score from industry, lanes and declared volume (source §6 Step 1) */
  aiScore: number
  stage: LeadStage
  ownerId?: Id
  customerId?: Id
  contact: { name: string; email: string; mobile: string }
  createdAt: IsoDateTime
  activities: { at: IsoDateTime; by: Id; kind: 'call' | 'visit' | 'email' | 'note' | 'stage'; note: string }[]
}

// ─── Partners ──────────────────────────────────────────────────────────────────

export interface Partner {
  id: Id
  name: string
  shortName: string
  type: PartnerType
  legs: LegType[]
  services: Service[]
  gstin: string
  pan: string
  city: string
  status: PartnerStatus
  /** null while in trial (no tier yet) */
  tier: Tier | null
  score: number
  capacityPerDay: number
  /** PP-18 capacity calendar (source §5.1 "daily capacity and holidays"): per-date overrides and closed days */
  capacityOverrides?: Record<IsoDate, number>
  closedDates?: IsoDate[]
  /**
   * Jobs already committed today from work outside the modelled shipments.
   * Assignment adds today's modelled legs on top. (MetroDash is seeded at capacity.)
   */
  baseLoadToday: number
  /** Pincodes served for first / last mile */
  coveragePincodes: string[]
  laneIds: Id[]
  hubIds: Id[]
  coordinatorId?: Id
  trial?: PartnerTrial
  /**
   * SIMULATED partner API integration: offered jobs are accepted and given to the
   * partner's default staff member at once. Off for partners the demo drives by
   * hand in the Partner Portal (SwiftCity, QuickLink).
   */
  autoAccept: boolean
}

/** Monitored trial (source §4 Step 7): 10 parcel jobs, or 3 PTL / line-haul trips. */
export interface PartnerTrial {
  tripsDone: number
  tripsRequired: number
  /** Running trial score, 0–100 (average of the job scores) */
  score: number
  unit?: 'trips' | 'jobs' | 'cycles'
  startedAt?: IsoDateTime
  jobs?: TrialJob[]
  decision?: { result: 'live' | 'extended' | 'declined'; reasons?: string; by: Id; at: IsoDateTime }
}

export type TrialAnomaly = 'lateArrival' | 'longHalt' | 'breakdown' | 'missedScan' | 'weightGap'

/** One scored trial job (PP-10, ERP-14). */
export interface TrialJob {
  /** Trip or job id */
  ref: Id
  date: IsoDate
  leg: LegType
  onTime: boolean
  /** Share of pieces scanned at hand-over, % */
  scanPct: number
  /** SIMULATED AI anomaly flags in scans, weights and timings */
  anomalies: TrialAnomaly[]
  score: number
  /** Created by the demo action, not by a real job */
  simulated?: boolean
}

export type PenaltyKind = 'missedPickup' | 'lateArrival' | 'lateDelivery' | 'missedScan' | 'lateTicket'

/** A rate line of the partner agreement (PP-08, ERP-13); keyed like the rate engine. */
export interface PartnerAgreementLine {
  id: Id
  leg: LegType
  /** Lane id for line-haul; hub id for hub legs and the first / last-mile cluster around it */
  laneOrCluster: Id
  destCity?: string
  serviceKind?: ServiceKind
  rate: number
  unit: RateUnit
  minKg?: number
  minimum?: number
  maxKg?: number
  /** Logisco's position after the AI margin check (the partner never sees the margin) */
  status: 'accepted' | 'notAccepted'
  /** Partner counter-proposal */
  counter?: { rate: number; remark: string; at: IsoDateTime }
  /** Pricing approved this line below target margin (maker-checker, assumed) */
  pricingApproval?: { by: Id; at: IsoDateTime }
}

/** Source §4 Step 5: rate card, hand-over windows and cut-offs, SLA, penalty matrix, liability cap, payment cycle, optional deposit. */
export interface PartnerAgreement {
  lines: PartnerAgreementLine[]
  /** Cut-off time per leg the partner serves, "HH:mm" */
  cutoffs: Partial<Record<LegType, string>>
  ticketAckHours: number
  penalties: Record<PenaltyKind, number>
  liabilityPerKg: number
  liabilityMax: number
  deposit?: number
  status: 'draft' | 'issued' | 'negotiation' | 'signed'
  issuedAt?: IsoDateTime
  issuedBy?: Id
  signed?: { at: IsoDateTime; by: Id; method: 'aadhaarOtp' | 'dsc'; selfBilling: boolean }
}

export type ApiTestStep = 'receive' | 'accept' | 'status' | 'pod'

export type DocStatus = 'pending' | 'submitted' | 'verified' | 'flagged' | 'rejected'

/** Partner KYC documents (source §4.1 checklist; PP-06 sections). */
export type PartnerDocKey =
  | 'gstin'
  | 'pan'
  | 'incorporation'
  | 'udyam'
  | 'transportLicence'
  | 'bank'
  | 'insurance'
  | 'premisesInsurance'
  | 'vehicles'
  | 'driverLicence'
  | 'policeVerification'
  | 'hubDocs'

/** Automatic checks (source §4 Step 3; ERP-12 "API checks"). */
export type PartnerCheckKey = 'gstin' | 'pan' | 'pennyDrop' | 'vahan' | 'sarathi' | 'digilocker'

export type OcrFlag = 'tampered' | 'duplicate' | 'mismatch' | 'expired'

export interface PartnerDocument {
  key: PartnerDocKey
  status: DocStatus
  file?: string
  /** Fetched from DigiLocker instead of uploaded */
  viaDigilocker?: boolean
  /** Policy / registration / licence number typed with the upload */
  number?: string
  expiry?: IsoDate
  /** SIMULATED AI OCR: values read from the file */
  ocr?: { label: string; value: string }[]
  flag?: OcrFlag
  /** Reason shown with a flag or a re-upload request */
  note?: string
  uploadedAt?: IsoDateTime
}

export interface PartnerCheck {
  ok: boolean
  /** Structured detail; screens word it through i18n */
  detail: Record<string, string | number>
  at: IsoDateTime
}

export type PartnerSource = 'website' | 'app' | 'referral' | 'sales'
export type VehicleClass = 'twoWheeler' | 'threeWheeler' | 'tempo' | 'truck14' | 'truck19' | 'truck32'
export type PartnerServiceOffer = 'parcel' | 'expressPtl' | 'standardPtl'
export type VerificationResult = 'approved' | 'conditional' | 'rejected'
export type AuditItem = 'security' | 'cctv' | 'fireSafety' | 'docks' | 'scale'

export interface PartnerApplication {
  id: Id
  partnerId: Id
  ref: string
  receivedAt: IsoDateTime
  source: PartnerSource
  services: PartnerServiceOffer[]
  constitution: 'proprietorship' | 'partnership' | 'llp' | 'privateLtd' | 'publicLtd'
  contact: { name: string; designation: string; mobile: string; email: string }
  address: string
  gstRegistered: boolean
  states: string[]
  cities: string[]
  /** First / last mile (Types A, B, C) */
  pincodes: string[]
  /** Line-haul (Types A, D, E): city to city */
  lanes: { origin: string; dest: string; frequency: 'daily' | 'alternate' | 'weekly'; transitHours: number }[]
  /** Types E, F (and B if it runs a hub) */
  hubs: { name: string; address: string; pincode: string; areaSqft: number; docks: number }[]
  fleet: Partial<Record<VehicleClass, number>>
  /** Type B: own fleet (source §4.1 note 4: vehicle documents only if own fleet) */
  ownFleet?: boolean
  /** In the unit for the type: shipments (A–C), kg (D, E), pieces (F) per day */
  capacity: number
  indicativeRates: { leg: LegType; rate: number }[]
  /** AI network-gap fit (source §4 Step 2); the reason is structured for i18n */
  fitScore: number
  fitReason: string
  fitDetail?: { kind: 'laneGap' | 'laneCovered' | 'pincodeGap' | 'pincodeCovered' | 'hubGap' | 'hubCovered' | 'none'; place: string; partners: number }
  status: 'new' | 'invited' | 'waitlisted' | 'kyc' | 'agreement' | 'integration' | 'trial' | 'live' | 'rejected'
  decision?: { by: Id; at: IsoDateTime; reason?: string }
  /** Monthly re-score date for waitlisted applications */
  rescoreOn?: IsoDate
  documents: PartnerDocument[]
  checks: Partial<Record<PartnerCheckKey, PartnerCheck>>
  kycSubmittedAt?: IsoDateTime
  /** Verification outcome (PP-07, ERP-12) */
  outcome?: {
    result: VerificationResult
    conditions: { text: string; due: IsoDate; docKey?: PartnerDocKey; closedAt?: IsoDateTime }[]
    reasons?: string
    by: Id
    at: IsoDateTime
  }
  /** Rate card, terms and agreement (PP-08, ERP-13) */
  agreement?: PartnerAgreement
  /** Go-live setup (PP-09): API sandbox for Types A / E */
  setup?: { apiKey?: string; webhookUrl?: string; tests?: { step: ApiTestStep; ok: boolean; at: IsoDateTime }[]; readyAt?: IsoDateTime }
  /** Hub audit: Type F, and Type E with a hub (source §4 Step 4) */
  hubAudit?: {
    date: IsoDate
    window: 'morning' | 'afternoon'
    contact: string
    phone: string
    auditorId: Id
    items?: Record<AuditItem, { result: 'pass' | 'fail' | 'observation'; note?: string; photo: { lat: number; lng: number; at: IsoDateTime } }>
    result?: VerificationResult
    completedAt?: IsoDateTime
  }
}

export type PartnerRole = 'admin' | 'operations' | 'finance'

export interface PartnerUser {
  id: Id
  partnerId: Id
  name: string
  mobile: string
  email: string
  role: PartnerRole
}

export type FieldRole = 'rider' | 'driver' | 'hub'

export interface FieldStaff {
  id: Id
  partnerId: Id
  name: string
  mobile: string
  role: FieldRole
  vehicleId?: Id
  hubId?: Id
  licenceValidTill?: IsoDate
  policeVerified: boolean
  /** Practice mode completed in the Partner App (source §4 Step 6) */
  trained: boolean
  language: 'en' | 'hi' | 'kn'
  /** Added at go-live setup with photo and ID (PP-09) */
  photo?: string
  idProof?: { kind: 'aadhaar' | 'dl' | 'voterId'; last4: string }
}

export interface Vehicle {
  id: Id
  partnerId: Id
  regNo: string
  type: string
  payloadKg: number
  fastagId?: string
  gpsId?: string
  docExpiry: IsoDate
}

export interface WeeklyScore {
  id: Id
  partnerId: Id
  /** ISO week start date (Monday) */
  week: IsoDate
  profile: 'parcel' | 'ptl'
  /** KPI results in % (damage: claims per 10k pieces) */
  kpis: {
    pickup: number
    onTime: number
    firstAttempt: number
    damagePer10k: number
    damagePct: number
    scanCompliance: number
    responsiveness: number
  }
  total: number
  tierBefore: Tier | null
  tierAfter: Tier | null
  /** ERP-16: calculated weeks wait for the Partner Manager to publish */
  published: boolean
  publishedAt?: IsoDateTime
  publishedBy?: Id
  /** Rule the tier engine applied (source §5.3) */
  rule?: TierRule
  /** ERP-16 override of the proposed tier, with a reason (assumed) */
  override?: { tier: Tier; reason: string; by: Id }
}

export type KpiKey = 'pickup' | 'onTime' | 'firstAttempt' | 'damage' | 'scanCompliance' | 'responsiveness'
export type TierRule = 'up' | 'same' | 'platinumGrace' | 'platinumDown' | 'improvementPlan' | 'warning' | 'volumeCut' | 'suspensionReview'

/** Source §5.3: a Gold partner dropping below band gets an improvement plan. */
export interface ImprovementPlan {
  id: Id
  partnerId: Id
  week: IsoDate
  targets: KpiKey[]
  deadline: IsoDate
  coordinatorId: Id
  createdAt: IsoDateTime
  acknowledgedAt?: IsoDateTime
  acknowledgedBy?: Id
}

export type SuspensionTrigger = 'scoreBelow60' | 'fraud' | 'documentExpiry' | 'partnerRequest'

/** Source §5.4: trigger → freeze and transfer → settle and close; every step logged and visible to the partner. */
export interface SuspensionCase {
  id: Id
  partnerId: Id
  trigger: SuspensionTrigger
  reason: string
  auto: boolean
  openedAt: IsoDateTime
  openedBy: Id
  step: 1 | 2 | 3 | 'closed'
  frozenAt?: IsoDateTime
  /** Step 2: each in-flight leg finished by the partner or transferred to a backup */
  inFlight: { legId: Id; decision?: 'finish' | 'transfer'; toPartnerId?: Id }[]
  /** Step 3: final payout = earnings − deductions with evidence */
  settlement?: { earnings: number; deductions: { kind: PayoutDeductionKind; reason: string; amount: number; ref?: string }[]; finalPayout: number }
  closeRequestedBy?: Id
  closeRequestedAt?: IsoDateTime
  checkerId?: Id
  closedAt?: IsoDateTime
  payoutId?: Id
  log: { at: IsoDateTime; by: Id; app: AppKey; text: string }[]
}

// ─── Shipments ─────────────────────────────────────────────────────────────────

export interface Piece {
  id: Id // LR-01 …
  l: number
  b: number
  h: number
  weight: number
  skuCode?: string
  verifiedDims?: { l: number; b: number; h: number }
  verifiedWeight?: number
  condition?: 'ok' | 'damaged' | 'missing'
}

export type PriceLineCode = 'freight' | 'fuel' | 'oda' | 'docket' | 'appointment' | 'cod' | 'toPay' | 'fov' | 'specialHandling'

export interface PriceLine {
  code: PriceLineCode
  amount: number
  /**
   * Numbers behind the line, for the screen to render through i18n,
   * e.g. freight { kg: 162, rate: 14 } → "162 kg × ₹14.00".
   */
  basis: { kg?: number; rate?: number; pct?: number; value?: number; pieces?: number; slabs?: number; first?: number; additional?: number }
}

export interface Price {
  lines: PriceLine[]
  subtotal: number
  gst: number
  total: number
}

export interface Shipment {
  id: Id // = LR, e.g. LGS-DEL-000781
  customerId: Id
  bookedByUserId: Id
  bookedAt: IsoDateTime
  pickupLocationId: Id
  consigneeId: Id
  originPincode: string
  destPincode: string
  laneId?: Id
  serviceKind: ServiceKind
  service: Service
  paymentMode: PaymentMode
  codAmount?: number
  addOns: { appointment: boolean; insurance: boolean; specialHandling: boolean }
  /** fileUrl: SIMULATED upload — the file name of the invoice copy */
  invoice: { no: string; date: IsoDate; value: number; po?: string; fileUrl?: string }
  hsn: string
  goodsDescription: string
  /** source: generated by Logisco (default) or entered by the customer ("I already have one") */
  ewb?: { no: string; validTill: IsoDate; partBUpdated: boolean; source?: 'auto' | 'customer' }
  pickupSlot: { date: IsoDate; from: string; to: string }
  /** CP-13 Step 1: contact for this pickup (defaults to the location's) */
  pickupContact?: { name: string; mobile: string }
  pieces: Piece[]
  weights: { actual: number; volumetricOrCft: number; chargeable: number; verifiedChargeable?: number }
  price: Price
  /** Derived from events by engines/status.ts */
  status: ShipmentStatus
  eta: IsoDate
  /**
   * Appointment delivery. Booked as "requested" (date = ETA, no slot); the consignee
   * confirms a slot on the public tracking page (CP-18), which sets from / to / dock.
   */
  /** CP-18: the consignee books the slot (source §7 Step 8), with gate / dock, receiving contact and gate pass */
  appointment?: { date: IsoDate; from?: string; to?: string; dock?: string; confirmed: boolean; contactName?: string; contactMobile?: string; gatePass?: string; bookedAt?: IsoDateTime }
  legIds: Id[]
  /**
   * SIMULATED background movement: the journey this shipment follows when the
   * demo clock advances (see sim/journey.ts). Absent for shipments that only
   * move through live demo actions (the hero, LGS-DEL-000790, new bookings).
   */
  sim?: { outcome: 'normal' | 'ndr' | 'short' | 'cancel' | 'pickupFailed' | 'rto'; assignees?: Record<number, Id>; closeAfterDays?: number; ndrReason?: NdrReason; shortPieceIds?: Id[] }
  updatedAt: IsoDateTime
}

export interface Leg {
  id: Id // JOB-000781-L1
  shipmentId: Id
  seq: number
  type: LegType
  partnerId: Id
  staffId?: Id
  vehicleId?: Id
  /** Derived from events by engines/status.ts */
  status: LegStatus
  window: { from: IsoDateTime; to: IsoDateTime }
  slaDueAt: IsoDateTime
  cost: number
  /** Partner rate line the cost came from (3-way match) */
  rateLineId?: Id
  tripId?: Id
  updatedAt: IsoDateTime
}

export interface Trip {
  id: Id
  legIds: Id[]
  laneId: Id
  vehicleId: Id
  driverId: Id
  sealNos: string[]
  departAt: IsoDateTime
  eta: IsoDateTime
  positions: { at: IsoDateTime; lat: number; lng: number }[]
  /** PA-23 halts and breakdowns, with the expected duration */
  halts: { at: IsoDateTime; minutes: number; reason: string; lat: number; lng: number; breakdown?: { issue: string; backupVehicle: boolean; photos: string[] } }[]
  status: 'planned' | 'loading' | 'inTransit' | 'arrived'
  /** Line-haul legs the driver took from the hub (PA-20); background shipments move on their own */
  loadedLegIds?: Id[]
  /** PA-22 / PA-24: when the trip actually started and arrived */
  startedAt?: IsoDateTime
  arrivedAt?: IsoDateTime
  /** PA-24 → PA-19: code the destination hub enters to take the load */
  handoverCode?: string
}

export interface Bag {
  id: Id
  manifestId?: Id
  hubId: Id
  destination: string
  pieceIds: Id[]
  sealNo?: string
  status: 'open' | 'sealed' | 'dispatched' | 'received'
  /** PA-28: hub scale weight, sealed-bag photo, when and by whom */
  weightKg?: number
  photo?: string
  sealedAt?: IsoDateTime
  sealedBy?: Id
}

export interface Manifest {
  id: Id
  hubId: Id
  destination: string
  bagIds: Id[]
  vehicleId?: Id
  tripId?: Id
  status: 'open' | 'closed' | 'dispatched'
  /** PA-29: truck door seal, loading photo, dispatch time and the hand-over code for the driver */
  doorSeal?: string
  photo?: string
  dispatchedAt?: IsoDateTime
  handoverCode?: string
}

/** Chain-of-custody event types (Partner App spec §7.1, §8). */
export const EVENT_TYPES = [
  'booked',
  'legOffered',
  'legAccepted',
  'legFlagged',
  'legWithdrawn',
  'legAssigned',
  'legUnassigned',
  'pickupArrived',
  'pickupConfirmed',
  'pickupFailed',
  'weightRevised',
  'handoverGiven',
  'handoverReceived',
  'hubInScan',
  'bagSealed',
  'hubOutScan',
  'tripStarted',
  'haltReported',
  'tripArrived',
  'runStarted',
  'delivered',
  'deliveryFailed',
  'reattemptScheduled',
  'exceptionReported',
  'rtoInitiated',
  'cancelled',
  'legClosed',
] as const
export type EventType = (typeof EVENT_TYPES)[number]

export type ExceptionKind =
  | 'pickupMissed'
  | 'sealMismatch'
  | 'short'
  | 'excess'
  | 'damage'
  | 'delay'
  | 'breakdown'
  | 'ndr'
  | 'weightMismatch'
  /** Auto-ticket: e-way bill expiring within 24 hours (source §10 Step 3) */
  | 'ewbExpiry'
  /** A hand-over or hub scan that should have happened (source §10 Step 1); internal, not shown to the customer */
  | 'missedScan'

export interface ShipmentEvent {
  id: Id
  shipmentId: Id
  legId?: Id
  type: EventType
  /** Phone / device time of the action */
  at: IsoDateTime
  /** staffId / userId / "system" */
  by: Id
  app: AppKey | 'system'
  lat?: number
  lng?: number
  pieceIds?: Id[]
  sealNos?: string[]
  vehicleNo?: string
  photos?: string[]
  counterpartStaffId?: Id
  /** handoverGiven: the code the receiver scans or types (PA-19 → PA-20) */
  handoverCode?: string
  /** exceptionReported: what went wrong */
  exceptionKind?: ExceptionKind
  /** haltReported: true when the delay puts the ETA at risk */
  etaAtRisk?: boolean
  /** legAssigned: the rider / driver / hub staff given the leg, and their vehicle */
  assigneeStaffId?: Id
  assigneeVehicleId?: Id
  /** delivered: recipient, OTP, GRN */
  receivedBy?: string
  grn?: string
  /** deliveryFailed / pickupFailed: reason code */
  reason?: string
  note?: string
}

// ─── Exceptions, claims, money ─────────────────────────────────────────────────

export interface ShipmentException {
  id: Id
  shipmentId: Id
  legId?: Id
  type: ExceptionKind
  raisedAt: IsoDateTime
  actionDueAt: IsoDateTime
  ownerPartnerId?: Id
  /** Free-text finding (e.g. from an investigation) */
  rootCause?: string
  /** SIMULATED AI root-cause class (source §10 Step 1: "classifies the root cause") */
  aiCause?: RootCause
  status: 'open' | 'inProgress' | 'resolved'
  customerConfirmed: boolean
  /** Raised by the detector (auto-ticket) rather than by a person in an app */
  auto?: boolean
  /** What the Control Tower did (ERP-07) */
  log?: { at: IsoDateTime; by: Id; action: string; note?: string }[]
  closedAt?: IsoDateTime
  closedBy?: Id
  /** PA-18 / PA-30: who reported it in the app, with evidence */
  report?: { by: Id; pieceIds?: Id[]; photos: string[]; note?: string; reason?: string }
  /** PP-20: the partner's side of the escalation (source §5.1 response timer; §5.2 Responsiveness) */
  partner?: PartnerTicketSide
}

export type PartnerRootCause = 'staffShortage' | 'vehicleIssue' | 'addressIssue' | 'customerNotReady' | 'weatherTraffic' | 'other'

export interface PartnerTicketSide {
  ackDueAt: IsoDateTime
  ackAt?: IsoDateTime
  ackBy?: Id
  response?: string
  evidence?: string[]
  rootCause?: PartnerRootCause
  resolvedAt?: IsoDateTime
  resolvedBy?: Id
}

/** PA-12 SOS from a field staff phone (source §5.1). SIMULATED location sharing and emergency call. */
export interface SosAlert {
  id: Id
  staffId: Id
  partnerId: Id
  at: IsoDateTime
  lat: number
  lng: number
  kind?: 'accident' | 'theft' | 'medical' | 'threat' | 'other'
  status: 'active' | 'cancelled' | 'resolved'
  cancelledAt?: IsoDateTime
  resolvedAt?: IsoDateTime
  resolvedBy?: Id
  note?: string
}

export type RootCause = 'partnerCapacity' | 'partnerNoShow' | 'lineHaulDelay' | 'hubDwell' | 'lastMileDelay' | 'pickupDelay' | 'consignee' | 'handoverGap' | 'longTransit' | 'vehicle'

export type ReassignReason = 'slaRisk' | 'partnerRequest' | 'capacity' | 'quality' | 'customerRequest' | 'other'

export type WeightDisputeReason = 'dimensions' | 'weight' | 'wrongPiece' | 'skuFrozen' | 'other'

/**
 * Weight revision after pickup (source §7 Step 4; CP-20). The customer accepts
 * the revised rate or disputes it; Finance decides a dispute (ERP-31).
 */
export interface WeightRevision {
  id: Id
  shipmentId: Id
  /** Chargeable kg, booked vs verified */
  booked: number
  verified: number
  /** Price difference including GST */
  amountDiff: number
  photos: string[]
  raisedAt: IsoDateTime
  status: 'pending' | 'accepted' | 'disputed' | 'autoAccepted' | 'upheld' | 'reversed'
  /** Who accepted (customer user), or 'system' for the 48-hour rule */
  respondedBy?: Id
  respondedAt?: IsoDateTime
  dispute?: { reason: WeightDisputeReason; remarks: string; files: string[]; by: Id; at: IsoDateTime }
  resolution?: { decision: 'upheld' | 'reversed'; note: string; by: Id; at: IsoDateTime }
  /** How the difference was charged: prepaid wallet debit, or added to the credit invoice */
  chargedTo?: 'wallet' | 'invoice'
}

/** PA-35 reason codes (source §5.1 "NDR: reason code + photo of location") */
export const NDR_REASONS = ['notAvailable', 'premisesClosed', 'refused', 'addressIncomplete', 'appointmentUnavailable', 'codNotReady', 'other'] as const
export type NdrReason = (typeof NDR_REASONS)[number]

/**
 * A failed delivery attempt (PA-35) and the response to it (CP-21 shipper, CP-18
 * consignee; source §10: "WhatsApp buttons for consignee and shipper:
 * Reattempt · Change Slot / Address · RTO"). The first response applies.
 */
export interface Ndr {
  id: Id
  shipmentId: Id
  legId?: Id
  attempt: number
  reason: NdrReason
  photo?: string
  note?: string
  /** Masked call to the consignee before giving up (PA-35 check) */
  calledAt?: IsoDateTime
  at: IsoDateTime
  customerChoice?: 'reattempt' | 'changeSlot' | 'rto'
  /** Customer user id, 'consignee', or 'system' (no response / max attempts) */
  choiceBy?: Id
  choiceAt?: IsoDateTime
  newSlot?: { date: IsoDate; from: string; to: string }
  updatedContact?: string
  /** Within the same pincode (assumed) */
  updatedAddress?: string
  instructions?: string
  rtoCharge?: number
}

export type ClaimType = 'damage' | 'shortage' | 'loss' | 'pilferage'

/** Partner side of a claim (PP-22) */
export type ClaimPartnerStatus = 'notified' | 'accepted' | 'contested' | 'insuranceClaim' | 'decided' | 'deducted' | 'recoveredFromInsurer'

/**
 * Customer claim (source §10 Step 4: chain-of-custody evidence, liability engine,
 * settled within 7 days, then recovered from the partner payout or insurer).
 */
export interface Claim {
  id: Id
  shipmentId: Id
  customerId: Id
  type: ClaimType
  pieceIds: Id[]
  amountClaimed: number
  amountApproved?: number
  description?: string
  files?: string[]
  raisedBy?: Id
  liableLegId?: Id
  liablePartnerId?: Id
  /** Who pays Logisco back: partner payout (up to its liability cap), partner's insurer, Logisco's insurer */
  recovery: { partner: number; partnerInsurer?: number; insurer: number; insurerRef?: string }
  creditNoteId?: Id
  decision?: { amount: number; reason: string; by: Id; at: IsoDateTime }
  settlement?: { method: 'creditNote' | 'bank'; ref: string; by: Id; at: IsoDateTime }
  /** "Add information" from the customer (CP-22) */
  info?: { at: IsoDateTime; by: Id; text: string; files: string[] }[]
  raisedAt: IsoDateTime
  settleBy: IsoDate
  status: 'raised' | 'investigating' | 'approved' | 'partlyApproved' | 'rejected' | 'settled' | 'closed'
  confirmationRequestedAt?: IsoDateTime
  confirmedAt?: IsoDateTime
  reopenedAt?: IsoDateTime
  partner?: {
    status: ClaimPartnerStatus
    reason?: string
    files?: string[]
    insurer?: string
    policy?: string
    respondedAt?: IsoDateTime
    /** Claims desk outcome of a contest */
    decision?: 'upheld' | 'waived'
    payoutDate?: IsoDate
  }
}

/** GST invoice to a credit customer (CP-24, ERP-31; source §9 "GST invoice per shipment or monthly consolidated; e-POD attached; e-invoice where applicable"). */
export interface Invoice {
  id: Id
  customerId: Id
  /** "2026-10" for a monthly invoice */
  period: string
  date: IsoDate
  shipmentCount: number
  taxable: number
  gst: number
  total: number
  dueDate: IsoDate
  status: 'unpaid' | 'paid' | 'overdue' | 'partlyPaid'
  /** SIMULATED e-invoice IRN (NIC) */
  irn?: string
  /** Line items (generated invoices). Seeded older invoices predate the demo data and have none. */
  lrs?: Id[]
  payment?: { at: IsoDateTime; ref: string; method: 'upi' | 'netBanking' | 'card'; by: Id }
  /** Collections reminders sent (ERP-31) */
  reminders?: { at: IsoDateTime; by: Id; channel: 'email' | 'whatsapp' }[]
}

export interface CreditNote {
  id: Id
  customerId: Id
  claimId?: Id
  date: IsoDate
  amount: number
  reason: string
}

export interface WalletTxn {
  id: Id
  customerId: Id
  type: 'topUp' | 'debit' | 'refund' | 'adjustment' | 'claimCredit'
  ref: string
  amount: number
  balanceAfter: number
  at: IsoDateTime
}

/**
 * Cash on delivery for one shipment (source §9: partner deposits within 24 h →
 * remitted to the shipper at T+2, T+1 for top tier; shortages deducted from the
 * partner with evidence). Older records may refer to LRs before the demo data.
 */
export interface CodRecord {
  id: Id
  shipmentId: Id
  customerId: Id
  /** Last-mile partner holding the cash */
  partnerId?: Id
  amount: number
  mode?: 'cash' | 'upi'
  upiRef?: string
  deliveredAt?: IsoDateTime
  collectedBy?: Id
  collectedAt?: IsoDateTime
  depositedAt?: IsoDateTime
  /** office: cashier OTP; bank: deposit slip photo; nodal: UPI straight into Logisco's account */
  deposit?: { to: 'office' | 'bank' | 'nodal'; ref: string; by?: Id }
  remittanceId?: Id
  remittedAt?: IsoDateTime
  /** atOffice: the rider handed the cash to the partner office (PA-36), which deposits it to Logisco in PP-28 */
  status: 'pending' | 'collected' | 'atOffice' | 'deposited' | 'remitted'
  /** PP-28: the partner office's deposit into Logisco's collection account */
  partnerDeposit?: { method: 'bankTransfer' | 'cashSlip' | 'upi'; ref: string; by: Id; at: IsoDateTime }
  /** Cash short against the amount due (ERP-34): deducted from the partner, never the shipper */
  shortage?: { amount: number; evidence: string; by: Id; at: IsoDateTime; status: 'raised' | 'deducted' }
}

/** COD remittance batch to a shipper (CP-25, ERP-34): maker-checker as for payouts. */
export interface CodRemittance {
  id: Id
  customerId: Id
  date: IsoDate
  recordIds: Id[]
  gross: number
  deductions: number
  net: number
  utr?: string
  status: 'pendingApproval' | 'remitted' | 'onHold'
  makerId?: Id
  checkerId?: Id
}

/** One leg on a partner invoice, matched 3 ways (source §9): agreed rate × verified weight × e-POD / hand-over. */
export interface PartnerInvoiceLine {
  legId: Id
  rate: number
  unit: RateUnit
  verifiedWeight: number
  /** Weight the partner billed (uploaded invoices) */
  billedWeight?: number
  billed: number
  matched: number
  /** e-POD or hand-over scan present */
  pod: boolean
  result: 'match' | 'mismatch'
  reason?: 'weight' | 'amount' | 'noPod'
  /** Partner's answer to a mismatch (PP-26) */
  partner?: 'accepted' | 'disputed'
  /** Dispute desk (ERP-32): 48-hour SLA */
  dispute?: { reason: string; files: string[]; at: IsoDateTime; by: Id; dueAt: IsoDateTime; decision?: 'matched' | 'billed' | 'partial'; amount?: number; note?: string; decidedBy?: Id; decidedAt?: IsoDateTime }
  /** Amount payable once the line is closed */
  final?: number
}

/** Partner invoice per payout cycle (PP-26, ERP-32): self-billed by Logisco or uploaded by the partner. */
export interface PartnerInvoice {
  id: Id
  partnerId: Id
  /** "2026-11-16/2026-11-22" */
  cycle: string
  date?: IsoDate
  mode: 'selfBilled' | 'uploaded'
  /** Seeded older invoices predate the demo data and have no lines */
  lines: PartnerInvoiceLine[]
  taxable: number
  gst: number
  total: number
  /** submitted: mismatches waiting for the partner; matched: every line closed; approved: in the next payout */
  status: 'submitted' | 'matched' | 'disputed' | 'approved' | 'paid'
  pdf?: string
  lineFile?: string
  createdBy?: Id
  createdAt?: IsoDateTime
  approvedBy?: Id
  approvedAt?: IsoDateTime
}

export type PayoutDeductionKind = 'penalty' | 'claim' | 'codShortage' | 'earlyPay'

/** A payout to a partner (PP-27, ERP-33): the weekly cycle by tier, or an early-pay request. */
export interface Payout {
  id: Id
  batchId?: Id
  partnerId: Id
  kind?: 'cycle' | 'earlyPay' | 'final'
  invoiceId?: Id
  invoiceIds?: Id[]
  gross: number
  deductions: { kind?: PayoutDeductionKind; reason: string; amount: number; ref?: string }[]
  net: number
  dueDate: IsoDate
  mode?: 'NEFT' | 'IMPS'
  utr?: string
  paidAt?: IsoDateTime
  /** Early pay: who asked, the fee, and the batch that later set it off against the cycle payout */
  requestedBy?: Id
  fee?: number
  settledInBatch?: Id
  status: 'scheduled' | 'pendingApproval' | 'approved' | 'paid' | 'onHold'
}

/** ERP-33 payout batch: Finance makes it, a different approver releases it. */
export interface PayoutBatch {
  id: Id
  date: IsoDate
  tiers: Tier[]
  payoutIds: Id[]
  status: 'pendingApproval' | 'released'
  makerId: Id
  submittedAt: IsoDateTime
  checkerId?: Id
  releasedAt?: IsoDateTime
}

export type TicketCategory = 'shipment' | 'pickup' | 'delivery' | 'billing' | 'damage' | 'tracking' | 'account' | 'integration' | 'other'

/** Customer support ticket (ERP-39; CP-37). */
export interface Ticket {
  id: Id
  raisedBy: Id
  app: AppKey
  /** TicketCategory for customer tickets; partner problem kinds (PP-13) otherwise */
  category: TicketCategory | string
  subject: string
  shipmentId?: Id
  customerId?: Id
  createdAt?: IsoDateTime
  /** Response SLA */
  dueAt?: IsoDateTime
  ownerId?: Id
  /** waiting = Logisco replied and waits for the customer (CP-37 "Waiting for you") */
  status: 'open' | 'inProgress' | 'waiting' | 'resolved' | 'closed'
  thread: { at: IsoDateTime; by: Id; text: string; attachment?: string }[]
  invoiceId?: Id
}

/** ERP-28 quarterly business review. */
export interface Qbr {
  id: Id
  customerId: Id
  date: IsoDate
  agenda: string
  by: Id
  notes?: string
}

export interface AccountNote {
  id: Id
  customerId: Id
  at: IsoDateTime
  by: Id
  text: string
}

/** ERP-29 RFQ / tender (source §6 Enterprise; §11 Dept 1). */
export interface Rfq {
  id: Id
  /** Existing account, or a prospect name */
  customerId?: Id
  prospect?: string
  title: string
  dueDate: IsoDate
  lanes: { origin: string; dest: string; monthlyShipments: number; service: Service }[]
  status: 'received' | 'pricing' | 'submitted' | 'won' | 'lost'
  ownerId: Id
  createdAt: IsoDateTime
  /** AI first draft generated (from the rate card and lanes) */
  proposalAt?: IsoDateTime
  log: { at: IsoDateTime; by: Id; text: string }[]
}

/** ERP-41 DPDP register: a data principal's request. */
export interface DpdpRequest {
  id: Id
  party: string
  kind: 'access' | 'correction' | 'erasure'
  receivedAt: IsoDateTime
  dueAt: IsoDateTime
  status: 'open' | 'done'
  doneBy?: Id
  doneAt?: IsoDateTime
}

/**
 * Company-wide figures for the command dashboard (ERP-04 prototype note:
 * pre-computed seed values; shipment counts are live). INVENTED.
 */
export interface LeadershipSnapshot {
  periods: Record<'today' | 'mtd' | 'qtd', { revenue: number; marginPct: number; onTimePct: number; claimsPer10k: number; activeCustomers: number; activePartners: number }>
  heatmap: { origin: string; dest: string; marginPct: number }[]
  okrs: { id: Id; objective: string; keyResult: string; target: string; actual: string; ownerId: Id; onTrack: boolean }[]
}

/** ERP-41 statutory calendar and contract register (seeded reference data). */
export interface ComplianceReference {
  statutory: { id: Id; title: string; due: IsoDate; kind: 'gst' | 'tds' | 'licence' | 'other' }[]
  contracts: { id: Id; party: string; partyType: 'customer' | 'partner'; title: string; start: IsoDate; end: IsoDate }[]
}

// ─── Logisco staff ─────────────────────────────────────────────────────────────

export type ErpRole =
  | 'leadership'
  | 'sales'
  | 'pricing'
  | 'customerSuccess'
  | 'partnerManagement'
  | 'networkPlanning'
  | 'controlTower'
  | 'hubOps'
  | 'finance'
  | 'claims'
  | 'compliance'
  | 'hubAuditor'
  | 'superAdmin'

export interface StaffUser {
  id: Id
  name: string
  title: string
  role: ErpRole
  email: string
}

// ─── Cross-cutting ─────────────────────────────────────────────────────────────

export interface Notification {
  id: Id
  audience: { app: AppKey; userId?: Id; role?: string; partnerId?: Id; customerId?: Id }
  title: string
  body: string
  link?: string
  at: IsoDateTime
  read: boolean
}

/**
 * A recorded AI / engine decision with its reasons (ERP-03 "AI decisions", ERP-43).
 * Structured, not sentences: screens word it through i18n.
 */
export interface AiDecision {
  id: Id
  /** e.g. "assignment-v1", "margin-check-v1", "eta-v1" */
  model: string
  /** Shipment (LR) the decision belongs to */
  recordId: Id
  kind: 'legAssignment' | 'marginCheck' | 'etaPrediction'
  legId?: Id
  at: IsoDateTime
  /** 0–1 */
  confidence: number
  /** legAssignment: every partner considered, ranked (score ↓, cost ↑, transit ↑) */
  candidates?: { partnerId: Id; score: number; cost: number; eligible: boolean; reason?: string }[]
  chosenPartnerId?: Id
  /** marginCheck */
  margin?: { gross: number; grossPct: number; net: number; netPct: number; targetPct: number; belowTarget: boolean }
  acceptedByUserId?: Id
}

export interface AuditLog {
  id: Id
  userId: Id
  app: AppKey
  action: string
  recordId: Id
  at: IsoDateTime
  before?: unknown
  after?: unknown
}

/** A saved, unfinished CP-13 booking. `form` is the booking form as the screen holds it. */
// ─── The whole data set ────────────────────────────────────────────────────────

/** Everything the four apps share. Collections are keyed by id. */
export interface DemoData {
  // master
  pincodes: Record<Id, Pincode>
  hubs: Record<Id, Hub>
  lanes: Record<Id, Lane>
  rateCards: Record<Id, CustomerRateCard>
  partnerRates: Record<Id, PartnerRateLine>
  settings: Settings
  // customers
  customers: Record<Id, Customer>
  customerUsers: Record<Id, CustomerUser>
  pickupLocations: Record<Id, PickupLocation>
  consignees: Record<Id, Consignee>
  skus: Record<Id, Sku>
  leads: Record<Id, Lead>
  // partners
  partners: Record<Id, Partner>
  applications: Record<Id, PartnerApplication>
  partnerUsers: Record<Id, PartnerUser>
  fieldStaff: Record<Id, FieldStaff>
  vehicles: Record<Id, Vehicle>
  weeklyScores: Record<Id, WeeklyScore>
  // logisco
  staff: Record<Id, StaffUser>
  // shipments
  shipments: Record<Id, Shipment>
  legs: Record<Id, Leg>
  events: Record<Id, ShipmentEvent>
  trips: Record<Id, Trip>
  bags: Record<Id, Bag>
  manifests: Record<Id, Manifest>
  // exceptions & money
  exceptions: Record<Id, ShipmentException>
  weightRevisions: Record<Id, WeightRevision>
  ndrs: Record<Id, Ndr>
  claims: Record<Id, Claim>
  invoices: Record<Id, Invoice>
  creditNotes: Record<Id, CreditNote>
  walletTxns: Record<Id, WalletTxn>
  codRecords: Record<Id, CodRecord>
  codRemittances: Record<Id, CodRemittance>
  partnerInvoices: Record<Id, PartnerInvoice>
  payoutBatches: Record<Id, PayoutBatch>
  sosAlerts: Record<Id, SosAlert>
  improvementPlans: Record<Id, ImprovementPlan>
  coverageRequests: Record<Id, CoverageRequest>
  recruitmentNeeds: Record<Id, RecruitmentNeed>
  settingsChanges: Record<Id, SettingsChange>
  qbrs: Record<Id, Qbr>
  accountNotes: Record<Id, AccountNote>
  rfqs: Record<Id, Rfq>
  dpdpRequests: Record<Id, DpdpRequest>
  leadership: LeadershipSnapshot
  compliance: ComplianceReference
  suspensionCases: Record<Id, SuspensionCase>
  payouts: Record<Id, Payout>
  tickets: Record<Id, Ticket>
  /** ERP-06: AI risk suggestions an operator dismissed, by leg */
  riskDismissals: Record<Id, { legId: Id; reason: string; by: Id; at: IsoDateTime }>
  // cross-cutting
  notifications: Record<Id, Notification>
  aiDecisions: Record<Id, AiDecision>
  auditLog: Record<Id, AuditLog>
  /** Next serial per LR origin code, e.g. { DEL: 781 } → next Delhi LR is LGS-DEL-000781 */
  lrSerials: Record<string, number>
}
