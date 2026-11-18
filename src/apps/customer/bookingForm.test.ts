import { buildSeed, DEMO_START } from '@data/seed'
import { bookShipment } from '@shared/store/booking'
import {
  confirmationBlocks,
  consigneeFor,
  emptyBooking,
  fromQuote,
  fromShipment,
  heroSample,
  quoteFor,
  STEPS,
  toBookingInput,
  validateStep,
  type BookingForm,
} from './bookingForm'
import { SAMPLES, emptyForm } from './quoteForm'

const data = buildSeed()
const sharma = data.customers['C-SHARMA']
const priya = data.customerUsers['CU-PRIYA']
const ctx = (f: BookingForm, d = data, customer = sharma) => ({ data: d, customer, now: DEMO_START, quote: quoteFor(d, customer.id, f) })
const hero = () => ({ ...heroSample(data, emptyBooking(data, sharma, DEMO_START)), acceptTerms: true })

describe('CP-13 hero booking', () => {
  it('defaults to Okhla Factory, today, the first open slot, and Ramesh as contact', () => {
    const f = emptyBooking(data, sharma, DEMO_START)
    expect(f).toMatchObject({ locationId: 'PL-OKHLA', pickupDate: '2026-11-23', slotFrom: '12:00', contactName: 'Ramesh Kumar', paymentMode: 'tbb' })
  })

  it('the sample passes every step and prices at ₹3,628.26', () => {
    const f = hero()
    for (const step of STEPS) expect(validateStep(step, f, ctx(f)), step).toEqual({})
    expect(confirmationBlocks(f, ctx(f))).toEqual([])
    const q = quoteFor(data, sharma.id, f)!
    expect(q.ok && q.quote.price.total).toBe(3628.26)
  })

  it('books LGS-DEL-000781 with the 5 documented legs, a requested appointment and the e-way bill', () => {
    const f = hero()
    const { consignee, isNew } = consigneeFor(data, sharma.id, f)
    expect(consignee.id).toBe('CN-HED')
    expect(isNew).toBe(false)
    const { data: after, shipmentId } = bookShipment(data, toBookingInput(f, sharma.id, priya, consignee.id), '2026-11-23T10:05:00+05:30')
    const s = after.shipments[shipmentId]
    expect(shipmentId).toBe('LGS-DEL-000781')
    expect(s).toMatchObject({
      status: 'booked',
      eta: '2026-11-26',
      pickupSlot: { date: '2026-11-23', from: '14:00', to: '16:00' },
      pickupContact: { name: 'Ramesh Kumar', mobile: '98730 11223' },
      pickupInstructions: 'Use Gate 2',
      packaging: 'carton',
      customerRef: 'DISP-2311-07',
      invoice: { no: 'SE/25-26/1187', value: 180000, po: 'HED/PO/3321', fileUrl: 'INV_1187.pdf' },
      ewb: { no: '3410 2256 7781', validTill: '2026-12-03', source: 'auto' },
      appointment: { date: '2026-11-26', confirmed: false },
    })
    expect(s.price.total).toBe(3628.26)
    expect(s.legIds.map((id) => after.legs[id].partnerId)).toEqual(['P-SWIFTCITY', 'P-NCRXD', 'P-DECCAN', 'P-HUBLIWH', 'P-NKEXP'])
    expect(after.customers['C-SHARMA'].creditLimit - after.customers['C-SHARMA'].creditUsed).toBe(152171.74)
    expect(after.customers['C-SHARMA'].spendMonthToDate).toBe(106028.26)
  })

  it('uses "I already have one" e-way bill numbers as given', () => {
    const f = { ...hero(), ewbOption: 'existing' as const, existingEwbNo: '341099998888' }
    expect(validateStep('invoice', f, ctx(f))).toEqual({})
    expect(toBookingInput(f, sharma.id, priya, 'CN-HED').existingEwbNo).toBe('3410 9999 8888')
  })
})

describe('CP-13 validation', () => {
  it('Step 1: needs an open slot and a 10-digit contact mobile', () => {
    const f = { ...hero(), slotFrom: '10:00', contactMobile: '12345' }
    expect(validateStep('pickup', f, ctx(f))).toEqual({ slotFrom: 'slot', contactMobile: 'mobile' })
  })

  it('Step 2: blocks pincodes we do not serve and bad GSTINs', () => {
    const f = { ...hero(), consignee: { ...hero().consignee, pincode: '600032', gstin: 'XYZ' } }
    expect(validateStep('consignee', f, ctx(f))).toEqual({ pincode: 'notServiceable', gstin: 'gstin' })
  })

  it('Step 3: a route with no lane for PTL is reported', () => {
    const f = { ...hero(), consignee: { ...hero().consignee, pincode: '201301' } } // Noida: same hub, no PTL lane
    expect(validateStep('shipment', f, ctx(f))).toEqual({ route: 'quote.noLane' })
  })

  it('Step 4: invoice copy, no future date, HSN required for an e-way bill, 12-digit existing EWB', () => {
    const f = { ...hero(), invoiceFile: '', invoiceDate: '2026-11-24', hsn: '', ewbOption: 'existing' as const, existingEwbNo: '123' }
    expect(validateStep('invoice', f, ctx(f))).toEqual({ invoiceFile: 'file', invoiceDate: 'futureDate', hsn: 'hsnRequired', existingEwbNo: 'ewbNo' })
  })

  it('Step 4: HSN is optional when no e-way bill is needed (₹50,000 or less)', () => {
    const f = { ...hero(), invoiceValue: '50000', hsn: '' }
    expect(validateStep('invoice', f, ctx(f))).toEqual({})
  })

  it('Step 6: terms must be accepted; credit and wallet blocks are reported', () => {
    expect(validateStep('review', { ...hero(), acceptTerms: false }, ctx(hero()))).toEqual({ acceptTerms: 'terms' })
    const nearLimit = { ...sharma, creditUsed: 498000 }
    expect(confirmationBlocks(hero(), { ...ctx(hero()), customer: nearLimit })).toEqual(['creditExceeded'])
  })
})

describe('CP-13 pre-fill', () => {
  it('from CP-12 "Book this": route, packages, value and add-ons; picks the single saved consignee at that pincode', () => {
    const q = SAMPLES['C-SHARMA'](emptyForm('PL-OKHLA', true))
    const f = fromQuote(data, sharma.id, emptyBooking(data, sharma, DEMO_START), q, DEMO_START)
    expect(f).toMatchObject({ locationId: 'PL-OKHLA', service: 'expressPtl', invoiceValue: '180000', insurance: true, appointment: true, consigneeId: 'CN-HED' })
    expect(f.rows[0]).toMatchObject({ qty: '6', l: '60', weight: '20' })
  })

  it('from a past shipment ("Repeat this booking"): same consignee and grouped packages, fresh invoice', () => {
    const f = fromShipment(data, emptyBooking(data, sharma, DEMO_START), data.shipments['LGS-DEL-000769'], DEMO_START)
    expect(f).toMatchObject({ consigneeId: 'CN-BST', service: 'expressPtl', invoiceNo: '', insurance: true })
    expect(f.rows).toHaveLength(1)
    expect(f.rows[0]).toMatchObject({ skuCode: 'SG-LT-400', qty: '6' })
  })

  it('an edited address-book consignee becomes a new record, in the address book only if asked', () => {
    const f = { ...hero(), consignee: { ...hero().consignee, contact: 'Someone Else' }, saveToBook: false }
    const { consignee, isNew } = consigneeFor(data, sharma.id, f)
    expect(isNew).toBe(true)
    expect(consignee).toMatchObject({ contact: 'Someone Else', saved: false, category: 'distributor' })
    expect(data.consignees[consignee.id]).toBeUndefined()
  })
})
