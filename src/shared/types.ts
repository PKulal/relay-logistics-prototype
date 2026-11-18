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
  note?: string
}

/** ERP-44 system settings — seed-data.md §9 */
export interface Settings {
  ewayBillThreshold: number
  ewayBillKmPerDay: number
  targetMarginPct: number
  riskBufferPct: number
  quoteValidityDays: number
  pickupCutoff: string // "HH:mm"
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
  bronzeVolumeCapPct: number
  gstPct: number
  volumetricDivisor: number
  ptlMinKgExpress: number
  ptlMinKgStandard: number
  cftFactor: number
  tierBands: Record<Exclude<Tier, 'probation'>, number> // lower bound of each band
}

// ─── Customers ─────────────────────────────────────────────────────────────────

export type CustomerType = 'sme' | 'manufacturer' | 'distributor' | 'brand' | 'enterprise' | 'marketplace'
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
  /** Onboarding track, e.g. "enterprise" (KAM-led) or "selfServe" */
  track: 'selfServe' | 'enterprise'
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
  /** COD collected and not yet remitted (CP-11 "COD due", CP-25) */
  cod?: { pending: number; nextRemittance: IsoDate; remittedThisMonth: number }
  kamId?: Id
  rateCardId: Id
  bank?: { name: string; branch: string; ifsc: string; account: string }
  signatory?: { name: string; designation: string; email: string; mobile: string }
  integrations: { tally: boolean }
  branding?: { logoUrl?: string; colour?: string }
  city: string
}

export type CustomerRole = 'admin' | 'dispatch' | 'finance'

export interface CustomerUser {
  id: Id
  customerId: Id
  name: string
  title?: string
  email: string
  mobile: string
  role: CustomerRole
  locationIds: Id[]
  language: 'en' | 'hi'
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
  status: 'draft' | 'flagged' | 'frozen'
}

export interface Lead {
  id: Id
  company: string
  source: string
  aiScore: number
  stage: 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'
  ownerId: Id
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
  trial?: { tripsDone: number; tripsRequired: number; score: number }
  /**
   * SIMULATED partner API integration: offered jobs are accepted and given to the
   * partner's default staff member at once. Off for partners the demo drives by
   * hand in the Partner Portal (SwiftCity, QuickLink).
   */
  autoAccept: boolean
}

export type DocStatus = 'pending' | 'submitted' | 'verified' | 'flagged' | 'rejected'

export interface PartnerApplication {
  id: Id
  partnerId: Id
  ref: string
  fitScore: number
  fitReason: string
  status: 'new' | 'invited' | 'waitlisted' | 'kyc' | 'agreement' | 'integration' | 'trial' | 'live' | 'rejected'
  documents: { name: string; status: DocStatus; note?: string }[]
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
  trained: boolean
  onDuty: boolean
  /** When the staff member last went on duty (PA-05 "On duty since 09:02") */
  dutySince?: IsoDateTime
  language: 'en' | 'hi' | 'kn'
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
  /** CP-13 Step 1: contact for this pickup (defaults to the location's) and instructions */
  pickupContact?: { name: string; mobile: string }
  pickupInstructions?: string
  /** CP-13 Step 3 */
  packaging?: 'carton' | 'bag' | 'pallet' | 'crate' | 'drum' | 'other'
  /** CP-13 Step 4: customer's own reference, searchable */
  customerRef?: string
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
  appointment?: { date: IsoDate; from?: string; to?: string; dock?: string; confirmed: boolean }
  legIds: Id[]
  /**
   * SIMULATED background movement: the journey this shipment follows when the
   * demo clock advances (see sim/journey.ts). Absent for shipments that only
   * move through live demo actions (the hero, LGS-DEL-000790, new bookings).
   */
  sim?: { outcome: 'normal' | 'ndr' | 'short' | 'cancel' | 'pickupFailed' | 'rto'; assignees?: Record<number, Id>; closeAfterDays?: number; ndrReason?: string; shortPieceIds?: Id[] }
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
  halts: { at: IsoDateTime; minutes: number; reason: string; lat: number; lng: number }[]
  status: 'planned' | 'loading' | 'inTransit' | 'arrived'
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
  rootCause?: string
  status: 'open' | 'inProgress' | 'resolved'
  customerConfirmed: boolean
}

export interface WeightRevision {
  id: Id
  shipmentId: Id
  booked: number
  verified: number
  amountDiff: number
  photos: string[]
  raisedAt: IsoDateTime
  status: 'pending' | 'accepted' | 'disputed' | 'autoAccepted'
}

export interface Ndr {
  id: Id
  shipmentId: Id
  attempt: number
  reason: string
  photo?: string
  at: IsoDateTime
  customerChoice?: 'reattempt' | 'changeSlot' | 'changeAddress' | 'rto'
  choiceBy?: Id
  newSlot?: { date: IsoDate; from: string; to: string }
}

export interface Claim {
  id: Id
  shipmentId: Id
  customerId: Id
  type: 'shortage' | 'damage' | 'loss'
  pieceIds: Id[]
  amountClaimed: number
  amountApproved?: number
  liableLegId?: Id
  liablePartnerId?: Id
  recovery: { partner: number; insurer: number; insurerRef?: string }
  creditNoteId?: Id
  raisedAt: IsoDateTime
  settleBy: IsoDate
  status: 'raised' | 'investigating' | 'approved' | 'settled' | 'rejected'
}

export interface Invoice {
  id: Id
  customerId: Id
  period: string
  date: IsoDate
  shipmentCount: number
  taxable: number
  gst: number
  total: number
  dueDate: IsoDate
  status: 'unpaid' | 'paid' | 'overdue' | 'partlyPaid'
  irn?: string
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
  type: 'topUp' | 'debit' | 'refund' | 'adjustment'
  ref: string
  amount: number
  balanceAfter: number
  at: IsoDateTime
}

export interface CodRecord {
  id: Id
  shipmentId: Id
  amount: number
  collectedBy?: Id
  collectedAt?: IsoDateTime
  depositedAt?: IsoDateTime
  remittedAt?: IsoDateTime
  status: 'pending' | 'collected' | 'deposited' | 'remitted'
}

export interface PartnerInvoice {
  id: Id
  partnerId: Id
  cycle: string
  mode: 'selfBilled' | 'uploaded'
  lines: { legId: Id; rate: number; verifiedWeight: number; billed: number; matched: number; result: 'match' | 'mismatch' }[]
  taxable: number
  gst: number
  total: number
  status: 'draft' | 'submitted' | 'matched' | 'disputed' | 'approved' | 'paid'
}

export interface Payout {
  id: Id
  batchId: Id
  partnerId: Id
  invoiceId?: Id
  gross: number
  deductions: { reason: string; amount: number; ref?: string }[]
  net: number
  dueDate: IsoDate
  utr?: string
  status: 'scheduled' | 'pendingApproval' | 'approved' | 'paid' | 'onHold'
}

export interface Ticket {
  id: Id
  raisedBy: Id
  app: AppKey
  category: string
  subject: string
  shipmentId?: Id
  status: 'open' | 'inProgress' | 'resolved' | 'closed'
  thread: { at: IsoDateTime; by: Id; text: string }[]
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
export interface BookingDraft {
  id: Id
  customerId: Id
  userId: Id
  savedAt: IsoDateTime
  /** Short label for the drafts list, e.g. "Hubballi 580030 · 6 pcs" */
  label: string
  form: unknown
}

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
  partnerInvoices: Record<Id, PartnerInvoice>
  payouts: Record<Id, Payout>
  tickets: Record<Id, Ticket>
  /** CP-13 "Save as draft" (listed in Shipments → Drafts) */
  drafts: Record<Id, BookingDraft>
  // cross-cutting
  notifications: Record<Id, Notification>
  aiDecisions: Record<Id, AiDecision>
  auditLog: Record<Id, AuditLog>
  /** Next serial per LR origin code, e.g. { DEL: 781 } → next Delhi LR is LGS-DEL-000781 */
  lrSerials: Record<string, number>
}
