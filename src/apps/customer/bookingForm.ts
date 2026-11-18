/**
 * CP-13 Book shipment — form model, pre-fill, step validation and conversion to
 * a booking. Pure functions (no React), unit-tested in bookingForm.test.ts.
 */
import { bookingChecks, type BookingBlock } from '@shared/engines/bookingChecks'
import { ewayBillCheck } from '@shared/engines/ewayBill'
import type { QuoteInput } from '@shared/engines/quote'
import { pickupDates, pickupSlots } from '@shared/engines/schedule'
import { istDate } from '@shared/lib/time'
import type { BookingInput } from '@shared/store/booking'
import type { Consignee, ConsigneeCategory, Customer, CustomerUser, DemoData, Id, IsoDateTime, ParcelTier, PaymentMode, Shipment } from '@shared/types'
import { emptyRow, num, positive, tryQuote, type QuoteForm, type QuoteResult, type Row, type ServiceChoice } from './quoteForm'

export const STEPS = ['pickup', 'consignee', 'shipment', 'invoice', 'payment', 'review'] as const
export type Step = (typeof STEPS)[number]

export type Packaging = NonNullable<Shipment['packaging']>
export const PACKAGING: Packaging[] = ['carton', 'bag', 'pallet', 'crate', 'drum', 'other']
export const CATEGORIES: ConsigneeCategory[] = ['distributor', 'retailer', 'dc', 'modernTrade', 'factory', 'otherBusiness']
/** Appointment switches on automatically for these (CP-13 Step 2) */
export const APPOINTMENT_CATEGORIES: ConsigneeCategory[] = ['dc', 'modernTrade']

export interface ConsigneeFields {
  category: ConsigneeCategory
  company: string
  contact: string
  mobile: string
  altMobile: string
  email: string
  address: string
  landmark: string
  pincode: string
  gstin: string
  appointmentRequired: boolean
}

export interface BookingForm {
  // Step 1 — pickup
  locationId: Id
  pickupDate: string
  slotFrom: string
  contactName: string
  contactMobile: string
  instructions: string
  // Step 2 — consignee
  /** Address-book entry the fields came from (cleared when the fields are edited) */
  consigneeId: Id
  consignee: ConsigneeFields
  saveToBook: boolean
  // Step 3 — shipment
  service: ServiceChoice
  tier: ParcelTier
  rows: Row[]
  packaging: Packaging
  fragile: boolean
  // Step 4 — invoice and e-way bill
  invoiceNo: string
  invoiceDate: string
  invoiceValue: string
  /** SIMULATED upload: the chosen file's name */
  invoiceFile: string
  po: string
  goods: string
  hsn: string
  customerRef: string
  ewbOption: 'auto' | 'existing'
  existingEwbNo: string
  // Step 5 — payment and add-ons
  paymentMode: PaymentMode
  codAmount: string
  insurance: boolean
  appointment: boolean
  // Step 6
  acceptTerms: boolean
}

const blankConsignee = (): ConsigneeFields => ({
  category: 'distributor',
  company: '',
  contact: '',
  mobile: '',
  altMobile: '',
  email: '',
  address: '',
  landmark: '',
  pincode: '',
  gstin: '',
  appointmentRequired: false,
})

export function emptyBooking(data: DemoData, customer: Customer, now: IsoDateTime): BookingForm {
  const locations = Object.values(data.pickupLocations).filter((l) => l.customerId === customer.id)
  const loc = locations.find((l) => l.isDefault) ?? locations[0]
  const form: BookingForm = {
    locationId: loc?.id ?? '',
    pickupDate: '',
    slotFrom: '',
    contactName: loc?.contact.name ?? '',
    contactMobile: loc?.contact.mobile ?? '',
    instructions: '',
    consigneeId: '',
    consignee: blankConsignee(),
    saveToBook: true,
    service: customer.billing === 'credit' ? 'expressPtl' : 'parcel',
    tier: 'standard',
    rows: [emptyRow()],
    packaging: 'carton',
    fragile: false,
    invoiceNo: '',
    invoiceDate: istDate(now),
    invoiceValue: '',
    invoiceFile: '',
    po: '',
    goods: '',
    hsn: '',
    customerRef: '',
    ewbOption: 'auto',
    existingEwbNo: '',
    paymentMode: customer.billing === 'credit' ? 'tbb' : 'paid',
    codAmount: '',
    insurance: false,
    appointment: false,
    acceptTerms: false,
  }
  return withDefaultSlot(data, form, now)
}

/** Pick the first pickup date and slot still available (keeps a valid choice). */
export function withDefaultSlot(data: DemoData, f: BookingForm, now: IsoDateTime): BookingForm {
  const loc = data.pickupLocations[f.locationId]
  if (!loc) return f
  const cutoff = data.settings.pickupCutoff
  const dates = pickupDates(now, cutoff)
  const date = dates.includes(f.pickupDate) ? f.pickupDate : (dates.find((d) => pickupSlots(loc.window, d, now, cutoff).length > 0) ?? dates[0])
  const slots = pickupSlots(loc.window, date, now, cutoff)
  const slotFrom = slots.some((s) => s.from === f.slotFrom) ? f.slotFrom : (slots[0]?.from ?? '')
  return { ...f, pickupDate: date, slotFrom }
}

/** Fill the consignee step from an address-book entry. */
export function withConsignee(f: BookingForm, c: Consignee): BookingForm {
  const appointment = c.appointmentRequired || (!!c.category && APPOINTMENT_CATEGORIES.includes(c.category))
  return {
    ...f,
    consigneeId: c.id,
    consignee: {
      category: c.category ?? (c.type === 'business' ? 'distributor' : 'otherBusiness'),
      company: c.company,
      contact: c.contact,
      mobile: c.mobile,
      altMobile: c.altMobile ?? '',
      email: c.email ?? '',
      address: c.address,
      landmark: c.landmark ?? '',
      pincode: c.pincode,
      gstin: c.gstin ?? '',
      appointmentRequired: appointment,
    },
    appointment,
    saveToBook: false, // already in the address book
  }
}

/** CP-12 "Book this": carry the quote's route, packages, value, payment and add-ons. */
export function fromQuote(data: DemoData, customerId: Id, base: BookingForm, q: QuoteForm, now: IsoDateTime): BookingForm {
  const loc = data.pickupLocations[q.origin]
  const f: BookingForm = {
    ...base,
    locationId: loc ? loc.id : base.locationId,
    contactName: loc ? loc.contact.name : base.contactName,
    contactMobile: loc ? loc.contact.mobile : base.contactMobile,
    consignee: { ...base.consignee, pincode: q.destPincode },
    service: q.service,
    tier: q.tier,
    rows: q.rows.map((r) => ({ ...r, key: emptyRow().key })),
    invoiceValue: q.value,
    paymentMode: q.paymentMode,
    codAmount: q.codAmount,
    insurance: q.addOns.insurance,
    appointment: q.addOns.appointment,
    fragile: q.addOns.specialHandling,
  }
  // If the quote's pincode matches one saved consignee, offer it straight away
  const match = Object.values(data.consignees).filter((c) => c.customerId === customerId && c.saved !== false && c.pincode === q.destPincode)
  return withDefaultSlot(data, match.length === 1 ? withConsignee(f, match[0]) : f, now)
}

/** CP-14 "Repeat this booking": same route, consignee, packages and options; new date and invoice. */
export function fromShipment(data: DemoData, base: BookingForm, s: Shipment, now: IsoDateTime): BookingForm {
  const consignee = data.consignees[s.consigneeId]
  const loc = data.pickupLocations[s.pickupLocationId]
  let f: BookingForm = {
    ...base,
    locationId: s.pickupLocationId,
    contactName: s.pickupContact?.name ?? loc.contact.name,
    contactMobile: s.pickupContact?.mobile ?? loc.contact.mobile,
    instructions: s.pickupInstructions ?? '',
    service: s.serviceKind === 'parcel' ? 'parcel' : (s.service as ServiceChoice),
    tier: s.serviceKind === 'parcel' ? (s.service as ParcelTier) : base.tier,
    rows: groupPieces(s),
    packaging: s.packaging ?? 'carton',
    fragile: s.addOns.specialHandling,
    invoiceValue: String(s.invoice.value),
    goods: s.goodsDescription,
    hsn: s.hsn,
    paymentMode: s.paymentMode,
    codAmount: s.codAmount ? String(s.codAmount) : '',
    insurance: s.addOns.insurance,
  }
  if (consignee) f = withConsignee(f, consignee)
  return withDefaultSlot(data, { ...f, appointment: s.addOns.appointment }, now)
}

/** Identical pieces become one row with a quantity. */
function groupPieces(s: Shipment): Row[] {
  const rows: Row[] = []
  for (const p of s.pieces) {
    const same = rows.find((r) => r.skuCode === (p.skuCode ?? '') && num(r.l) === p.l && num(r.b) === p.b && num(r.h) === p.h && num(r.weight) === p.weight)
    if (same) same.qty = String(num(same.qty) + 1)
    else rows.push({ ...emptyRow(), skuCode: p.skuCode ?? '', qty: '1', l: String(p.l), b: String(p.b), h: String(p.h), weight: String(p.weight) })
  }
  return rows
}

// ─── Derived values ────────────────────────────────────────────────────────────

export function toQuoteInputFromBooking(data: DemoData, customerId: Id, f: BookingForm): QuoteInput | null {
  const origin = data.pickupLocations[f.locationId]?.pincode
  if (!origin || !/^\d{6}$/.test(f.consignee.pincode)) return null
  const pieces = []
  for (const r of f.rows) {
    if (![r.qty, r.l, r.b, r.h, r.weight].every(positive)) return null
    for (let i = 0; i < Math.floor(num(r.qty)); i++) pieces.push({ l: num(r.l), b: num(r.b), h: num(r.h), weight: num(r.weight) })
  }
  return {
    customerId,
    originPincode: origin,
    destPincode: f.consignee.pincode,
    serviceKind: f.service === 'parcel' ? 'parcel' : 'ptl',
    service: f.service === 'parcel' ? f.tier : f.service,
    pieces,
    // Goods value isn't asked until Step 4; price without insurance until then
    declaredValue: positive(f.invoiceValue) ? num(f.invoiceValue) : 0,
    addOns: { appointment: f.appointment, insurance: f.insurance && positive(f.invoiceValue), specialHandling: f.fragile },
    paymentMode: f.paymentMode,
    codAmount: f.paymentMode === 'cod' && positive(f.codAmount) ? num(f.codAmount) : undefined,
  }
}

export function quoteFor(data: DemoData, customerId: Id, f: BookingForm): QuoteResult | null {
  const input = toQuoteInputFromBooking(data, customerId, f)
  return input ? tryQuote(data, input) : null
}

export function ewbRequired(data: DemoData, f: BookingForm, q: QuoteResult | null): { required: boolean; validityDays: number } {
  if (!q?.ok || !positive(f.invoiceValue)) return { required: false, validityDays: 0 }
  const r = ewayBillCheck({
    goodsValue: num(f.invoiceValue),
    originState: q.quote.origin.state,
    destState: q.quote.dest.state,
    distanceKm: q.quote.lane?.distanceKm ?? 120,
    generatedOn: f.invoiceDate,
    threshold: data.settings.ewayBillThreshold,
    kmPerDay: data.settings.ewayBillKmPerDay,
  })
  return { required: r.required, validityDays: r.validityDays }
}

// ─── Validation ────────────────────────────────────────────────────────────────

const MOBILE = /^\d{10}$/
const digits = (s: string) => s.replace(/\D/g, '')

/** Field → i18n error key (under "cp13.err"). Empty object = the step is valid. */
export type StepErrors = Partial<Record<string, string>>

export interface ValidationCtx {
  data: DemoData
  customer: Customer
  now: IsoDateTime
  quote: QuoteResult | null
}

export function validateStep(step: Step, f: BookingForm, ctx: ValidationCtx): StepErrors {
  const e: StepErrors = {}
  const { data, now } = ctx
  switch (step) {
    case 'pickup': {
      const loc = data.pickupLocations[f.locationId]
      if (!loc) e.locationId = 'required'
      else if (!pickupSlots(loc.window, f.pickupDate, now, data.settings.pickupCutoff).some((s) => s.from === f.slotFrom)) e.slotFrom = 'slot'
      if (!f.contactName.trim()) e.contactName = 'required'
      if (!MOBILE.test(digits(f.contactMobile))) e.contactMobile = 'mobile'
      if (f.instructions.length > 250) e.instructions = 'tooLong'
      break
    }
    case 'consignee': {
      const c = f.consignee
      if (!c.company.trim()) e.company = 'required'
      if (!c.contact.trim()) e.contact = 'required'
      if (!MOBILE.test(digits(c.mobile))) e.mobile = 'mobile'
      if (c.altMobile && !MOBILE.test(digits(c.altMobile))) e.altMobile = 'mobile'
      if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) e.email = 'email'
      if (!c.address.trim()) e.address = 'required'
      const pin = data.pincodes[c.pincode]
      if (!/^\d{6}$/.test(c.pincode)) e.pincode = 'pincode'
      else if (!pin || !pin.serviceable) e.pincode = 'notServiceable'
      if (c.gstin && !/^[0-9A-Z]{15}$/.test(c.gstin)) e.gstin = 'gstin'
      break
    }
    case 'shipment': {
      if (f.rows.some((r) => ![r.qty, r.l, r.b, r.h, r.weight].every(positive))) e.rows = 'rows'
      else if (ctx.quote && !ctx.quote.ok) e.route = `quote.${ctx.quote.code}`
      break
    }
    case 'invoice': {
      if (!f.invoiceNo.trim()) e.invoiceNo = 'required'
      if (!/^\d{4}-\d{2}-\d{2}$/.test(f.invoiceDate)) e.invoiceDate = 'required'
      else if (f.invoiceDate > istDate(now)) e.invoiceDate = 'futureDate'
      if (!positive(f.invoiceValue)) e.invoiceValue = 'amount'
      if (!f.invoiceFile) e.invoiceFile = 'file'
      if (!f.goods.trim()) e.goods = 'required'
      const ewb = ewbRequired(data, f, ctx.quote)
      if (f.hsn && !/^\d{4,8}$/.test(f.hsn)) e.hsn = 'hsn'
      else if (ewb.required && !f.hsn) e.hsn = 'hsnRequired'
      if (ewb.required && f.ewbOption === 'existing' && !/^\d{12}$/.test(digits(f.existingEwbNo))) e.existingEwbNo = 'ewbNo'
      break
    }
    case 'payment': {
      if (f.paymentMode === 'cod') {
        if (!positive(f.codAmount)) e.codAmount = 'amount'
        else if (num(f.codAmount) > num(f.invoiceValue)) e.codAmount = 'codTooHigh'
      }
      if (f.paymentMode === 'tbb' && ctx.customer.billing !== 'credit') e.paymentMode = 'tbbCreditOnly'
      break
    }
    case 'review': {
      if (!f.acceptTerms) e.acceptTerms = 'terms'
      break
    }
  }
  return e
}

/** Business blocks at confirmation (CP spec §7.4): wallet, credit, overdue invoices … */
export function confirmationBlocks(f: BookingForm, ctx: ValidationCtx): BookingBlock[] {
  if (!ctx.quote?.ok) return []
  return bookingChecks(
    ctx.data,
    ctx.customer,
    {
      total: ctx.quote.quote.price.total,
      paymentMode: f.paymentMode,
      codAmount: f.paymentMode === 'cod' ? num(f.codAmount) : undefined,
      invoiceValue: num(f.invoiceValue),
      invoiceDate: f.invoiceDate,
      ewbRequired: ewbRequired(ctx.data, f, ctx.quote).required,
      hsn: f.hsn,
    },
    ctx.now,
  )
}

// ─── Booking ───────────────────────────────────────────────────────────────────

/**
 * The consignee to book against: the address-book entry if its fields are
 * unchanged, otherwise a new record (shown in the address book only if
 * "Save to address book" is ticked).
 */
export function consigneeFor(data: DemoData, customerId: Id, f: BookingForm): { consignee: Consignee; isNew: boolean } {
  const existing = data.consignees[f.consigneeId]
  const c = f.consignee
  const record = (id: Id, saved: boolean): Consignee => ({
    id,
    customerId,
    type: 'business',
    category: c.category,
    company: c.company.trim(),
    contact: c.contact.trim(),
    mobile: c.mobile.trim(),
    altMobile: c.altMobile.trim() || undefined,
    email: c.email.trim() || undefined,
    address: c.address.trim(),
    landmark: c.landmark.trim() || undefined,
    pincode: c.pincode,
    gstin: c.gstin.trim() || undefined,
    appointmentRequired: c.appointmentRequired,
    saved,
  })
  if (existing) {
    const same = record(existing.id, existing.saved ?? true)
    const unchanged = (['company', 'contact', 'mobile', 'address', 'pincode'] as const).every((k) => same[k] === existing[k])
    if (unchanged) return { consignee: { ...existing, ...same }, isNew: false }
  }
  const n = Object.values(data.consignees).filter((x) => x.customerId === customerId).length + 1
  return { consignee: record(`CN-${customerId.slice(2)}-${String(n).padStart(3, '0')}`, f.saveToBook), isNew: true }
}

export function toBookingInput(f: BookingForm, customerId: Id, user: CustomerUser, consigneeId: Id): BookingInput {
  const loc = f.locationId
  return {
    customerId,
    bookedByUserId: user.id,
    pickupLocationId: loc,
    consigneeId,
    serviceKind: f.service === 'parcel' ? 'parcel' : 'ptl',
    service: f.service === 'parcel' ? f.tier : f.service,
    paymentMode: f.paymentMode,
    codAmount: f.paymentMode === 'cod' ? num(f.codAmount) : undefined,
    addOns: { appointment: f.appointment, insurance: f.insurance, specialHandling: f.fragile },
    invoice: { no: f.invoiceNo.trim(), date: f.invoiceDate, value: num(f.invoiceValue), po: f.po.trim() || undefined, fileUrl: f.invoiceFile },
    hsn: f.hsn,
    goodsDescription: f.goods.trim(),
    pieces: f.rows.flatMap((r) => Array.from({ length: Math.floor(num(r.qty)) }, () => ({ l: num(r.l), b: num(r.b), h: num(r.h), weight: num(r.weight), skuCode: r.skuCode || undefined }))),
    pickupSlot: { date: f.pickupDate, from: f.slotFrom, to: addTwoHours(f.slotFrom) },
    pickupContact: { name: f.contactName.trim(), mobile: f.contactMobile.trim() },
    pickupInstructions: f.instructions.trim() || undefined,
    packaging: f.packaging,
    customerRef: f.customerRef.trim() || undefined,
    existingEwbNo: f.ewbOption === 'existing' ? digits(f.existingEwbNo).replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3') : undefined,
  }
}

const addTwoHours = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${String(h + 2).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** The hero booking from seed-data.md §3 — used by the "Fill sample" button. */
export function heroSample(data: DemoData, f: BookingForm): BookingForm {
  const withHed = withConsignee(f, data.consignees['CN-HED'])
  return {
    ...withHed,
    locationId: 'PL-OKHLA',
    slotFrom: f.pickupDate === '2026-11-23' ? '14:00' : f.slotFrom,
    contactName: 'Ramesh Kumar',
    contactMobile: '98730 11223',
    instructions: 'Use Gate 2',
    consignee: { ...withHed.consignee, landmark: 'Near Gate 3', email: 'stores@hublielectric.in' },
    service: 'expressPtl',
    rows: [{ ...emptyRow(), skuCode: 'SG-LT-400', description: 'Switchgear panels', qty: '6', l: '60', b: '40', h: '40', weight: '20' }],
    packaging: 'carton',
    invoiceNo: 'SE/25-26/1187',
    invoiceValue: '180000',
    invoiceFile: 'INV_1187.pdf',
    po: 'HED/PO/3321',
    goods: 'LT switchgear panels',
    hsn: '8537',
    customerRef: 'DISP-2311-07',
    paymentMode: 'tbb',
    insurance: true,
    appointment: true,
  }
}
